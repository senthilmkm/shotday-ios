// End-to-end integration tests covering full user journeys through the
// data layer. We don't render React Native components here — instead we
// drive the same state mutations the screens drive, then assert the
// resulting `ShotdayDb` looks correct.
//
// Why not Maestro/Detox? Those need a Mac + iOS simulator (or an Android
// emulator) and don't run in our Windows CI. The screens themselves are
// thin wrappers around these mutations, so this layer covers ~95% of the
// behavior that could regress.

import {
  buildPostShotEntry,
  buildAdHocEntry,
  defaultMetrics,
} from '../domain/sideEffects';
import {
  buildCustomEntry,
  buildPresetEntry,
  entriesForDay,
  FOOD_PRESETS,
  totalProteinForDay,
} from '../domain/food';
import {
  dayAfterShot,
  daysSinceLastShot,
  daysUntilNext,
} from '../domain/dateMath';
import {
  daysUntilEligibleToBump,
  ladderIdForDrug,
  nextRung,
  previousRung,
  rungsForDrug,
} from '../domain/dose';
import {
  computeEntitlement,
  shouldShowTrialBanner,
  TRIAL_DAYS,
  trialDaysRemaining,
} from '../domain/entitlement';
import { proteinTargetGrams } from '../domain/protein';
import {
  defaultDosesPerPen,
  refillStatus,
} from '../domain/refill';
import { lastUsedZone, suggestNextZone } from '../domain/rotation';
import { planNotifications } from '../notifications/schedule';
import {
  createMemoryStore,
  loadDb,
  saveDb,
} from '../storage/storage';
import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_DB,
  type DoseHistoryEntry,
  type Injection,
  type RefillSchedule,
  type ShotdayDb,
  type UserProfile,
} from '../types/domain';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function freshDb(): ShotdayDb {
  return JSON.parse(JSON.stringify(EMPTY_DB));
}

function applyOnboarding(db: ShotdayDb, overrides: Partial<UserProfile> = {}): ShotdayDb {
  return {
    ...db,
    profile: {
      ...db.profile,
      drug: 'OZEMPIC',
      currentDoseMg: 0.5,
      currentDoseLabel: '0.5 mg',
      weight: 175,
      weightUnit: 'LB',
      shotDay: 'SUNDAY',
      themePreference: 'AUTO',
      onboardingComplete: true,
      ...overrides,
    },
  };
}

function logInjection(
  db: ShotdayDb,
  zone: Injection['zone'],
  takenAt: Date,
): ShotdayDb {
  return {
    ...db,
    injections: [
      {
        id: `inj-${takenAt.getTime()}-${zone}`,
        takenAt: takenAt.toISOString(),
        zone,
        doseMg: db.profile.currentDoseMg,
      },
      ...db.injections,
    ],
  };
}

// ────────────────────────────────────────────────────────────────────
// Onboarding journey
// ────────────────────────────────────────────────────────────────────

describe('integration: onboarding', () => {
  it('walks through all 6 steps and lands in a valid profile', () => {
    let db = freshDb();
    expect(db.profile.onboardingComplete).toBe(false);

    db = { ...db, profile: { ...db.profile, drug: 'MOUNJARO' } };
    db = {
      ...db,
      profile: { ...db.profile, currentDoseMg: 5.0, currentDoseLabel: '5.0 mg' },
      doseHistory: [{ id: 'd1', startedAt: new Date(2026, 5, 1).toISOString(), label: '5.0 mg', mg: 5.0 }],
    };
    db = { ...db, profile: { ...db.profile, weight: 200, weightUnit: 'LB' } };
    db = { ...db, profile: { ...db.profile, shotDay: 'WEDNESDAY' } };
    db = { ...db, profile: { ...db.profile, onboardingComplete: true } };

    expect(db.profile.onboardingComplete).toBe(true);
    expect(db.profile.drug).toBe('MOUNJARO');
    expect(ladderIdForDrug(db.profile.drug)).toBe('TIRZEPATIDE');
    expect(rungsForDrug(db.profile.drug)).toContainEqual({ label: '5.0 mg', mg: 5.0 });
    expect(proteinTargetGrams(db.profile.weight, db.profile.weightUnit)).toBe(140);
    expect(db.doseHistory).toHaveLength(1);
  });

  it('handles the OTHER drug path with a custom dose', () => {
    let db = freshDb();
    db = applyOnboarding(db, {
      drug: 'OTHER',
      customDrugName: 'Compounded semaglutide',
      currentDoseMg: 0.3,
      currentDoseLabel: '0.3 mg',
    });
    expect(rungsForDrug(db.profile.drug)).toEqual([]);
    expect(db.profile.customDrugName).toBe('Compounded semaglutide');
    expect(db.profile.currentDoseMg).toBe(0.3);
  });

  it('survives a "skip dose" path (currentDoseMg=0)', () => {
    let db = freshDb();
    db = applyOnboarding(db, { currentDoseMg: 0, currentDoseLabel: '' });
    // Home screen should not crash with currentDoseMg=0
    expect(nextRung(ladderIdForDrug(db.profile.drug), 0)).toBeNull();
    expect(db.profile.currentDoseLabel).toBe('');
  });
});

// ────────────────────────────────────────────────────────────────────
// Shot day → side effect → food log: a typical post-onboarding day
// ────────────────────────────────────────────────────────────────────

describe('integration: shot day flow', () => {
  it('recommends a fresh zone, logs an injection, and keeps suggesting non-recent zones', () => {
    let db = applyOnboarding(freshDb());
    expect(suggestNextZone(db.injections)).toBe('BELLY_UL');

    // Week 1: log left belly upper
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 7, 9, 0));
    // Suggestion must NOT be the same zone
    expect(suggestNextZone(db.injections)).not.toBe('BELLY_UL');
    expect(lastUsedZone(db.injections)).toBe('BELLY_UL');

    // Week 2: log whatever was suggested
    const week2Suggestion = suggestNextZone(db.injections);
    db = logInjection(db, week2Suggestion, new Date(2026, 5, 14, 9, 0));
    expect(lastUsedZone(db.injections)).toBe(week2Suggestion);
    expect(suggestNextZone(db.injections)).not.toBe(week2Suggestion);
  });

  it('snapshots the current dose at injection time so later dose changes do not rewrite history', () => {
    let db = applyOnboarding(freshDb(), { currentDoseMg: 0.25, currentDoseLabel: '0.25 mg' });
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 7, 9, 0));
    expect(db.injections[0]?.doseMg).toBe(0.25);

    // User bumps to 0.5 a few weeks later
    db = { ...db, profile: { ...db.profile, currentDoseMg: 0.5, currentDoseLabel: '0.5 mg' } };
    expect(db.injections[0]?.doseMg).toBe(0.25); // snapshot preserved
  });
});

describe('integration: side-effect window', () => {
  it('builds an entry on day 1, 2, 3 and rejects outside the window', () => {
    const shot = new Date(2026, 5, 7, 9, 0); // Sunday 9 AM
    const history: Injection[] = [
      { id: 'inj1', takenAt: shot.toISOString(), zone: 'BELLY_UL', doseMg: 0.5 },
    ];

    // Day 1, 2, 3
    for (const dayOffset of [1, 2, 3]) {
      const now = new Date(2026, 5, 7 + dayOffset, 20, 0);
      const entry = buildPostShotEntry({
        metrics: { ...defaultMetrics(), NAUSEA: 4 },
        chips: ['HEADACHE'],
        customSymptoms: [],
        injections: history,
        now,
      });
      expect(entry).not.toBeNull();
      expect(entry!.dayAfterShot).toBe(dayOffset);
      expect(entry!.metrics.NAUSEA).toBe(4);
      expect(entry!.chips).toContain('HEADACHE');
      expect(entry!.doseMg).toBe(0.5);
    }

    // Day 0 → null
    expect(
      buildPostShotEntry({
        metrics: defaultMetrics(),
        chips: [],
        customSymptoms: [],
        injections: history,
        now: new Date(2026, 5, 7, 21, 0),
      }),
    ).toBeNull();

    // Day 4+ → null
    expect(
      buildPostShotEntry({
        metrics: defaultMetrics(),
        chips: [],
        customSymptoms: [],
        injections: history,
        now: new Date(2026, 5, 11, 9, 0),
      }),
    ).toBeNull();
  });

  it('falls back to ad-hoc when out of window, snapshotting profile dose', () => {
    const entry = buildAdHocEntry({
      metrics: { ...defaultMetrics(), FATIGUE: 5 },
      chips: [],
      customSymptoms: ['heart racing'],
      doseMg: 1.0,
      now: new Date(2026, 5, 1),
    });
    expect(entry.dayAfterShot).toBe(1);
    expect(entry.doseMg).toBe(1.0);
    expect(entry.metrics.FATIGUE).toBe(5);
    expect(entry.customSymptoms).toEqual(['heart racing']);
  });

  it('appends side-effect entries to the db (newest first)', () => {
    let db = applyOnboarding(freshDb());
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 7, 9, 0));
    const day1 = buildPostShotEntry({
      metrics: { ...defaultMetrics(), NAUSEA: 3 },
      chips: [],
      customSymptoms: [],
      injections: db.injections,
      now: new Date(2026, 5, 8, 20, 0),
    })!;
    const day2 = buildPostShotEntry({
      metrics: { ...defaultMetrics(), NAUSEA: 2 },
      chips: ['HEARTBURN'],
      customSymptoms: [],
      injections: db.injections,
      now: new Date(2026, 5, 9, 20, 0),
    })!;
    db = { ...db, sideEffects: [day2, day1] };
    expect(db.sideEffects).toHaveLength(2);
    expect(db.sideEffects[0]?.dayAfterShot).toBe(2);
    expect(db.sideEffects[1]?.dayAfterShot).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// Food log: aggregation + custom entries
// ────────────────────────────────────────────────────────────────────

describe('integration: food log', () => {
  it('aggregates 3 preset taps + 1 custom entry into the day total', () => {
    let db = applyOnboarding(freshDb()); // 175 lb → 122 g (175 * 0.7 = 122.499… in IEEE-754)
    const target = proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
    expect(target).toBe(122);

    const now = new Date(2026, 5, 1, 18, 0);
    const yogurt = FOOD_PRESETS.find((p) => p.id === 'yogurt')!;
    const eggs = FOOD_PRESETS.find((p) => p.id === 'eggs')!;
    const chicken = FOOD_PRESETS.find((p) => p.id === 'chicken')!;

    db = {
      ...db,
      foods: [
        buildPresetEntry(yogurt, new Date(2026, 5, 1, 8, 0)),
        buildPresetEntry(eggs, new Date(2026, 5, 1, 9, 0)),
        buildPresetEntry(chicken, new Date(2026, 5, 1, 13, 0)),
        buildCustomEntry('Smoothie', 25, new Date(2026, 5, 1, 17, 0)),
      ],
    };

    expect(totalProteinForDay(db.foods, now)).toBe(23 + 12 + 35 + 25);
    expect(entriesForDay(db.foods, now)).toHaveLength(4);
    expect(entriesForDay(db.foods, now)[0]?.name).toBe('Smoothie'); // newest first
  });

  it('does not bleed protein totals across calendar days', () => {
    let db = applyOnboarding(freshDb());
    db = {
      ...db,
      foods: [
        buildCustomEntry('Yesterday eve', 50, new Date(2026, 4, 31, 22, 0)),
        buildCustomEntry('Today morning', 30, new Date(2026, 5, 1, 8, 0)),
        buildCustomEntry('Tomorrow early', 40, new Date(2026, 5, 2, 1, 0)),
      ],
    };
    const now = new Date(2026, 5, 1, 12, 0);
    expect(totalProteinForDay(db.foods, now)).toBe(30);
  });

  it('removes a single entry without affecting others', () => {
    let db = applyOnboarding(freshDb());
    const yogurt = FOOD_PRESETS.find((p) => p.id === 'yogurt')!;
    const e1 = buildPresetEntry(yogurt, new Date(2026, 5, 1, 8, 0));
    const e2 = buildPresetEntry(yogurt, new Date(2026, 5, 1, 9, 0));
    const e3 = buildPresetEntry(yogurt, new Date(2026, 5, 1, 10, 0));
    db = { ...db, foods: [e3, e2, e1] };
    db = { ...db, foods: db.foods.filter((f) => f.id !== e2.id) };
    expect(db.foods).toHaveLength(2);
    expect(db.foods.map((f) => f.id)).toEqual([e3.id, e1.id]);
  });
});

// ────────────────────────────────────────────────────────────────────
// Multi-week journey: 3 weeks of typical usage
// ────────────────────────────────────────────────────────────────────

describe('integration: 3-week user journey', () => {
  it('keeps state coherent across 3 weeks of injections, side effects, and food', () => {
    let db = applyOnboarding(freshDb(), { shotDay: 'SUNDAY', currentDoseMg: 0.25, currentDoseLabel: '0.25 mg' });
    db = {
      ...db,
      doseHistory: [
        { id: 'd1', startedAt: new Date(2026, 5, 1).toISOString(), label: '0.25 mg', mg: 0.25 },
      ],
    };

    const weeks: { shotDate: Date; foodDates: Date[] }[] = [
      {
        shotDate: new Date(2026, 5, 7, 9, 0),
        foodDates: [
          new Date(2026, 5, 8, 8, 0),
          new Date(2026, 5, 8, 13, 0),
          new Date(2026, 5, 8, 19, 0),
        ],
      },
      {
        shotDate: new Date(2026, 5, 14, 9, 0),
        foodDates: [new Date(2026, 5, 15, 12, 0)],
      },
      {
        shotDate: new Date(2026, 5, 21, 9, 0),
        foodDates: [],
      },
    ];

    for (const w of weeks) {
      const zone = suggestNextZone(db.injections);
      db = logInjection(db, zone, w.shotDate);

      // Day 1 side effect
      const sideEntry = buildPostShotEntry({
        metrics: { ...defaultMetrics(), NAUSEA: 3 },
        chips: [],
        customSymptoms: [],
        injections: db.injections,
        now: new Date(w.shotDate.getTime() + 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      });
      if (sideEntry) {
        db = { ...db, sideEffects: [sideEntry, ...db.sideEffects] };
      }

      // Food entries
      const yogurt = FOOD_PRESETS.find((p) => p.id === 'yogurt')!;
      for (const d of w.foodDates) {
        db = { ...db, foods: [buildPresetEntry(yogurt, d), ...db.foods] };
      }
    }

    expect(db.injections).toHaveLength(3);
    expect(db.sideEffects).toHaveLength(3);
    expect(db.foods).toHaveLength(4);

    // All side effects correctly tagged dayAfterShot=1
    for (const se of db.sideEffects) {
      expect(se.dayAfterShot).toBe(1);
    }
    // All injections snapshotted at 0.25 mg (we never bumped)
    for (const inj of db.injections) {
      expect(inj.doseMg).toBe(0.25);
    }
    // 3 different zones used (rotation working)
    const uniqueZones = new Set(db.injections.map((i) => i.zone));
    expect(uniqueZones.size).toBe(3);
  });

  it('correctly identifies "eligible to bump" after 28 days', () => {
    const startedAt = new Date(2026, 5, 1);
    const db = {
      ...applyOnboarding(freshDb()),
      doseHistory: [{ id: 'd1', startedAt: startedAt.toISOString(), label: '0.25 mg', mg: 0.25 }],
    };
    const day27 = new Date(2026, 5, 28);
    const day28 = new Date(2026, 5, 29);
    expect(daysUntilEligibleToBump(new Date(db.doseHistory[0]!.startedAt), day27)).toBe(1);
    expect(daysUntilEligibleToBump(new Date(db.doseHistory[0]!.startedAt), day28)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Persistence round-trip
// ────────────────────────────────────────────────────────────────────

describe('integration: persistence round-trip', () => {
  it('saves and reloads a full populated DB without data loss', async () => {
    const store = createMemoryStore();
    let db = applyOnboarding(freshDb());
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 7, 9, 0));
    const yogurt = FOOD_PRESETS.find((p) => p.id === 'yogurt')!;
    db = { ...db, foods: [buildPresetEntry(yogurt, new Date(2026, 5, 8, 8, 0))] };

    await saveDb(store, db);
    const reloaded = await loadDb(store);

    expect(reloaded.profile.drug).toBe('OZEMPIC');
    expect(reloaded.profile.weight).toBe(175);
    expect(reloaded.injections).toHaveLength(1);
    expect(reloaded.injections[0]?.zone).toBe('BELLY_UL');
    expect(reloaded.foods).toHaveLength(1);
    expect(reloaded.foods[0]?.proteinGrams).toBe(23);
    expect(reloaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('survives a forced "reset all data" action', async () => {
    const store = createMemoryStore();
    const db = applyOnboarding(freshDb());
    await saveDb(store, db);

    // Reset → wipe storage
    await store.removeItem('@shotday/db/v1');
    const after = await loadDb(store);
    expect(after).toEqual(EMPTY_DB);
    expect(after.profile.onboardingComplete).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// Home-screen priority logic (simulates the routing decision)
// ────────────────────────────────────────────────────────────────────

describe('integration: home top-card priority', () => {
  function topMode(db: ShotdayDb, now: Date): 'POST_SHOT' | 'SHOT_DAY' | 'COUNTDOWN' {
    if (dayAfterShot(db.injections, now) !== null) return 'POST_SHOT';
    if (daysUntilNext(db.profile.shotDay, now) === 0) return 'SHOT_DAY';
    return 'COUNTDOWN';
  }

  it('shows COUNTDOWN with no history and not-shot-day', () => {
    const db = applyOnboarding(freshDb(), { shotDay: 'SUNDAY' });
    const monday = new Date(2026, 5, 1);
    expect(topMode(db, monday)).toBe('COUNTDOWN');
  });

  it('shows SHOT_DAY when today matches shotDay and no recent injection', () => {
    const db = applyOnboarding(freshDb(), { shotDay: 'MONDAY' });
    const monday = new Date(2026, 5, 1);
    expect(topMode(db, monday)).toBe('SHOT_DAY');
  });

  it('shows POST_SHOT after a shot has been logged in the last 1-3 days', () => {
    let db = applyOnboarding(freshDb(), { shotDay: 'SUNDAY' });
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 7, 9, 0));
    const day1 = new Date(2026, 5, 8, 20, 0);
    const day3 = new Date(2026, 5, 10, 20, 0);
    expect(topMode(db, day1)).toBe('POST_SHOT');
    expect(topMode(db, day3)).toBe('POST_SHOT');
  });

  it('falls back to COUNTDOWN once the post-shot window passes', () => {
    let db = applyOnboarding(freshDb(), { shotDay: 'SUNDAY' });
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 7, 9, 0));
    const day5 = new Date(2026, 5, 12, 20, 0);
    expect(topMode(db, day5)).toBe('COUNTDOWN');
  });

  it('still shows SHOT_DAY when both conditions could match, after enough days have passed', () => {
    // Edge case: shot on Sunday week 1, today is Sunday week 3. POST_SHOT window
    // is over (14 days passed), so it should be SHOT_DAY again.
    let db = applyOnboarding(freshDb(), { shotDay: 'SUNDAY' });
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 7, 9, 0));
    const sundayWeek3 = new Date(2026, 5, 21, 8, 0);
    expect(daysSinceLastShot(db.injections, sundayWeek3)).toBe(14);
    expect(topMode(db, sundayWeek3)).toBe('SHOT_DAY');
  });
});

// ────────────────────────────────────────────────────────────────────
// PHASE D: Dose ladder bump flow
// ────────────────────────────────────────────────────────────────────

describe('integration: dose ladder bump flow', () => {
  function bumpDose(db: ShotdayDb, label: string, mg: number, at: Date): ShotdayDb {
    return {
      ...db,
      profile: { ...db.profile, currentDoseMg: mg, currentDoseLabel: label },
      doseHistory: [
        ...db.doseHistory,
        { id: `dose-${at.getTime()}`, startedAt: at.toISOString(), label, mg },
      ],
    };
  }

  it('walks the semaglutide ladder over a 4-month escalation', () => {
    let db = applyOnboarding(freshDb(), {
      drug: 'OZEMPIC',
      currentDoseMg: 0.25,
      currentDoseLabel: '0.25 mg',
    });
    db = bumpDose(db, '0.25 mg', 0.25, new Date(2026, 5, 1));

    // Month 1 → bump to 0.5
    expect(daysUntilEligibleToBump(new Date(db.doseHistory[0]!.startedAt), new Date(2026, 5, 29))).toBe(0);
    db = bumpDose(db, '0.5 mg', 0.5, new Date(2026, 5, 29));

    // Month 2 → bump to 1.0
    db = bumpDose(db, '1.0 mg', 1.0, new Date(2026, 6, 27));

    // Month 3 → bump to 1.7
    db = bumpDose(db, '1.7 mg', 1.7, new Date(2026, 7, 24));

    // Month 4 → bump to 2.4 (top)
    db = bumpDose(db, '2.4 mg', 2.4, new Date(2026, 8, 21));

    expect(db.doseHistory).toHaveLength(5);
    expect(db.profile.currentDoseMg).toBe(2.4);
    expect(nextRung(ladderIdForDrug(db.profile.drug), 2.4)).toBeNull();
    // The labels of every history entry are preserved.
    expect(db.doseHistory.map((h) => h.label)).toEqual([
      '0.25 mg',
      '0.5 mg',
      '1.0 mg',
      '1.7 mg',
      '2.4 mg',
    ]);
  });

  it('supports dropping back down a rung (doctor-prescribed reduction)', () => {
    let db = applyOnboarding(freshDb(), { currentDoseMg: 1.0, currentDoseLabel: '1.0 mg' });
    db = bumpDose(db, '1.0 mg', 1.0, new Date(2026, 5, 1));
    const drop = previousRung(ladderIdForDrug(db.profile.drug), db.profile.currentDoseMg);
    expect(drop?.label).toBe('0.5 mg');
    db = bumpDose(db, drop!.label, drop!.mg, new Date(2026, 5, 15));
    expect(db.profile.currentDoseMg).toBe(0.5);
    expect(db.doseHistory).toHaveLength(2);
  });

  it('eligibility resets after every bump', () => {
    let db = applyOnboarding(freshDb(), { currentDoseMg: 0.25, currentDoseLabel: '0.25 mg' });
    const start = new Date(2026, 5, 1);
    db = bumpDose(db, '0.25 mg', 0.25, start);

    // Day 28: eligible
    expect(
      daysUntilEligibleToBump(new Date(db.doseHistory[db.doseHistory.length - 1]!.startedAt), new Date(2026, 5, 29)),
    ).toBe(0);

    // After bumping, we restart the 28-day clock.
    const bumpDate = new Date(2026, 5, 29);
    db = bumpDose(db, '0.5 mg', 0.5, bumpDate);
    expect(daysUntilEligibleToBump(new Date(db.doseHistory[db.doseHistory.length - 1]!.startedAt), bumpDate)).toBe(28);
  });
});

// ────────────────────────────────────────────────────────────────────
// PHASE D: Refill flow
// ────────────────────────────────────────────────────────────────────

describe('integration: refill flow', () => {
  it('starts unconfigured, becomes stocked once set up, drops to URGENT, silences after request', () => {
    let db = applyOnboarding(freshDb(), { drug: 'OZEMPIC' });
    const today = new Date(2026, 5, 23, 12, 0);

    // 1. Unconfigured initial state
    let s = refillStatus(db.refill, db.injections, today);
    expect(s.unconfigured).toBe(true);

    // 2. User configures: 4 doses per pen, filled 6/1
    const refill: RefillSchedule = {
      dosesPerPen: defaultDosesPerPen(db.profile.drug),
      lastFilledAt: '2026-06-01T00:00:00Z',
      refillRequested: false,
    };
    db = { ...db, refill };
    s = refillStatus(db.refill, db.injections, today);
    expect(s.dosesRemaining).toBe(4);
    expect(s.alertLevel).toBe('NONE');

    // 3. Three weekly shots logged → URGENT (1 left, not yet requested)
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 8, 9, 0));
    db = logInjection(db, 'BELLY_UR', new Date(2026, 5, 15, 9, 0));
    db = logInjection(db, 'BELLY_LL', new Date(2026, 5, 22, 9, 0));
    s = refillStatus(db.refill, db.injections, today);
    expect(s.dosesRemaining).toBe(1);
    expect(s.alertLevel).toBe('URGENT');

    // 4. User taps "Refill requested" → downgrades to INFO
    db = { ...db, refill: { ...db.refill!, refillRequested: true } };
    s = refillStatus(db.refill, db.injections, today);
    expect(s.alertLevel).toBe('INFO');

    // 5. User picks up refill → reset count (new lastFilledAt + requested=false)
    db = {
      ...db,
      refill: {
        ...db.refill!,
        lastFilledAt: today.toISOString(),
        refillRequested: false,
      },
    };
    s = refillStatus(db.refill, db.injections, today);
    expect(s.dosesRemaining).toBe(4); // 0 injections logged AFTER new lastFilledAt
    expect(s.alertLevel).toBe('NONE');
  });

  it('Mounjaro (1 dose / vial) goes to EMPTY immediately after each shot', () => {
    let db = applyOnboarding(freshDb(), { drug: 'MOUNJARO' });
    db = {
      ...db,
      refill: {
        dosesPerPen: defaultDosesPerPen(db.profile.drug),
        lastFilledAt: '2026-06-01T00:00:00Z',
        refillRequested: false,
      },
    };
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 8, 9, 0));
    const s = refillStatus(db.refill, db.injections, new Date(2026, 5, 9));
    expect(s.dosesRemaining).toBe(0);
    expect(s.alertLevel).toBe('EMPTY');
  });

  it('disable-tracking removes the refill record cleanly', () => {
    let db = applyOnboarding(freshDb());
    db = {
      ...db,
      refill: {
        dosesPerPen: 4,
        lastFilledAt: '2026-06-01T00:00:00Z',
        refillRequested: false,
      },
    };
    expect(db.refill).not.toBeNull();
    db = { ...db, refill: null };
    expect(db.refill).toBeNull();
    expect(refillStatus(db.refill, db.injections, new Date()).unconfigured).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// PHASE D: Notification plan responds to state changes
// ────────────────────────────────────────────────────────────────────

describe('integration: notification plan reacts to state', () => {
  it('plans 2 weekly notifications immediately after onboarding', () => {
    const db = applyOnboarding(freshDb(), { shotDay: 'SUNDAY' });
    const plan = planNotifications(db, new Date(2026, 5, 1));
    expect(plan).toHaveLength(2);
    expect(plan.map((p) => p.category).sort()).toEqual(['SHOT_REMINDER', 'SIDE_EFFECT_PROMPT']);
  });

  it('adds a one-shot REFILL_NUDGE when doses drop to URGENT', () => {
    let db = applyOnboarding(freshDb(), { drug: 'OZEMPIC' });
    db = {
      ...db,
      refill: {
        dosesPerPen: 4,
        lastFilledAt: '2026-06-01T00:00:00Z',
        refillRequested: false,
      },
    };
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 8, 9, 0));
    db = logInjection(db, 'BELLY_UR', new Date(2026, 5, 15, 9, 0));
    db = logInjection(db, 'BELLY_LL', new Date(2026, 5, 22, 9, 0));
    const plan = planNotifications(db, new Date(2026, 5, 23, 14, 0));
    expect(plan.find((p) => p.category === 'REFILL_NUDGE')).toBeDefined();
  });

  it('drops the REFILL_NUDGE the moment user marks refill requested', () => {
    let db = applyOnboarding(freshDb(), { drug: 'OZEMPIC' });
    db = {
      ...db,
      refill: {
        dosesPerPen: 4,
        lastFilledAt: '2026-06-01T00:00:00Z',
        refillRequested: false,
      },
    };
    db = logInjection(db, 'BELLY_UL', new Date(2026, 5, 8, 9, 0));
    db = logInjection(db, 'BELLY_UR', new Date(2026, 5, 15, 9, 0));
    db = logInjection(db, 'BELLY_LL', new Date(2026, 5, 22, 9, 0));
    const before = planNotifications(db, new Date(2026, 5, 23, 14, 0));
    expect(before.find((p) => p.category === 'REFILL_NUDGE')).toBeDefined();

    db = { ...db, refill: { ...db.refill!, refillRequested: true } };
    const after = planNotifications(db, new Date(2026, 5, 23, 14, 0));
    expect(after.find((p) => p.category === 'REFILL_NUDGE')).toBeUndefined();
  });

  it('updates the shot-reminder weekday when shot day changes', () => {
    const sun = applyOnboarding(freshDb(), { shotDay: 'SUNDAY' });
    const wed = applyOnboarding(freshDb(), { shotDay: 'WEDNESDAY' });
    const planSun = planNotifications(sun, new Date(2026, 5, 1));
    const planWed = planNotifications(wed, new Date(2026, 5, 1));
    const shotSun = planSun.find((p) => p.category === 'SHOT_REMINDER');
    const shotWed = planWed.find((p) => p.category === 'SHOT_REMINDER');
    expect(shotSun?.weekday).toBe(1);
    expect(shotWed?.weekday).toBe(4);
  });

  it('persists a doseHistory + refill round-trip through storage', async () => {
    const store = createMemoryStore();
    const seedHistory: DoseHistoryEntry[] = [
      { id: 'd1', startedAt: '2026-06-01T00:00:00Z', label: '0.25 mg', mg: 0.25 },
      { id: 'd2', startedAt: '2026-06-29T00:00:00Z', label: '0.5 mg', mg: 0.5 },
    ];
    const seedRefill: RefillSchedule = {
      dosesPerPen: 4,
      lastFilledAt: '2026-06-01T00:00:00Z',
      refillRequested: true,
    };
    const db: ShotdayDb = {
      ...applyOnboarding(freshDb()),
      doseHistory: seedHistory,
      refill: seedRefill,
    };
    await saveDb(store, db);
    const reloaded = await loadDb(store);
    expect(reloaded.doseHistory).toEqual(seedHistory);
    expect(reloaded.refill).toEqual(seedRefill);
  });
});

// ────────────────────────────────────────────────────────────────────
// PHASE E: Trial + subscription gating
// ────────────────────────────────────────────────────────────────────

describe('integration: subscription lifecycle', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  it('NEW_USER → TRIAL the moment onboarding completes', () => {
    let db = freshDb();
    expect(computeEntitlement(db.profile, new Date())).toBe('NEW_USER');

    // Simulating the NotificationPermissionScreen `completeOnboarding`.
    const now = new Date(2026, 5, 1, 9, 0);
    db = {
      ...db,
      profile: {
        ...db.profile,
        onboardingComplete: true,
        trialStartedAt: now.toISOString(),
      },
    };
    expect(computeEntitlement(db.profile, now)).toBe('TRIAL');
    expect(trialDaysRemaining(db.profile, now)).toBe(TRIAL_DAYS);
  });

  it('does not reset trialStartedAt if already set (re-running onboarding)', () => {
    const original = new Date(2026, 5, 1).toISOString();
    let db = applyOnboarding(freshDb(), {
      trialStartedAt: original,
    });
    // User goes back through onboarding flow; the screen guards with `?? new Date()`.
    db = {
      ...db,
      profile: {
        ...db.profile,
        trialStartedAt: db.profile.trialStartedAt ?? new Date().toISOString(),
      },
    };
    expect(db.profile.trialStartedAt).toBe(original);
  });

  it('shows the trial-ending banner only inside the warning window', () => {
    const start = new Date(2026, 5, 1);
    const db = applyOnboarding(freshDb(), { trialStartedAt: start.toISOString() });

    // Day 0 — no banner
    expect(shouldShowTrialBanner(db.profile, start)).toBe(false);
    // Day 11 — 3 days left → banner
    expect(
      shouldShowTrialBanner(db.profile, new Date(start.getTime() + 11 * ONE_DAY_MS)),
    ).toBe(true);
    // Day 14 — expired → no banner (paywall takes over)
    expect(
      shouldShowTrialBanner(db.profile, new Date(start.getTime() + 14 * ONE_DAY_MS)),
    ).toBe(false);
  });

  it('TRIAL → EXPIRED at exactly day 14, blocking access', () => {
    const start = new Date(2026, 5, 1);
    const db = applyOnboarding(freshDb(), { trialStartedAt: start.toISOString() });

    const day13 = new Date(start.getTime() + 13 * ONE_DAY_MS);
    expect(computeEntitlement(db.profile, day13)).toBe('TRIAL');

    const day14 = new Date(start.getTime() + 14 * ONE_DAY_MS);
    expect(computeEntitlement(db.profile, day14)).toBe('EXPIRED');
  });

  it('successful purchase moves EXPIRED → PRO via proUntil', () => {
    const start = new Date(2026, 5, 1);
    let db = applyOnboarding(freshDb(), { trialStartedAt: start.toISOString() });

    const day20 = new Date(start.getTime() + 20 * ONE_DAY_MS);
    expect(computeEntitlement(db.profile, day20)).toBe('EXPIRED');

    // Simulate a successful App Store purchase that grants 1 month.
    const proUntil = new Date(day20.getTime() + 30 * ONE_DAY_MS).toISOString();
    db = { ...db, profile: { ...db.profile, proUntil } };
    expect(computeEntitlement(db.profile, day20)).toBe('PRO');

    // 60 days later subscription has lapsed — back to EXPIRED.
    const day80 = new Date(start.getTime() + 80 * ONE_DAY_MS);
    expect(computeEntitlement(db.profile, day80)).toBe('EXPIRED');
  });

  it('dev override grants PRO regardless of trial state', () => {
    let db = freshDb(); // no trial, no purchase, no onboarding
    expect(computeEntitlement(db.profile, new Date())).toBe('NEW_USER');

    db = { ...db, profile: { ...db.profile, devProOverride: true } };
    expect(computeEntitlement(db.profile, new Date())).toBe('PRO');

    // Even when the trial has long expired underneath:
    const ancientStart = new Date(2026, 0, 1);
    db = {
      ...db,
      profile: {
        ...db.profile,
        trialStartedAt: ancientStart.toISOString(),
      },
    };
    expect(computeEntitlement(db.profile, new Date(2026, 6, 1))).toBe('PRO');
  });

  it('reset wipes trialStartedAt so the next onboarding starts a fresh trial', () => {
    const start = new Date(2026, 5, 1);
    let db = applyOnboarding(freshDb(), { trialStartedAt: start.toISOString() });
    expect(db.profile.trialStartedAt).toBe(start.toISOString());

    // Simulating Settings → Reset all data.
    db = freshDb();
    expect(db.profile.trialStartedAt).toBeNull();
    expect(computeEntitlement(db.profile, new Date())).toBe('NEW_USER');

    // New onboarding starts a brand-new trial clock.
    const restart = new Date(2026, 7, 15);
    db = {
      ...db,
      profile: {
        ...db.profile,
        onboardingComplete: true,
        trialStartedAt: restart.toISOString(),
      },
    };
    expect(computeEntitlement(db.profile, restart)).toBe('TRIAL');
  });

  it('PRO subscription overrides EXPIRED trial without losing trial history', () => {
    const start = new Date(2026, 5, 1);
    let db = applyOnboarding(freshDb(), { trialStartedAt: start.toISOString() });
    const day40 = new Date(start.getTime() + 40 * ONE_DAY_MS);
    expect(computeEntitlement(db.profile, day40)).toBe('EXPIRED');

    // User subscribes — proUntil set, trialStartedAt preserved.
    db = {
      ...db,
      profile: {
        ...db.profile,
        proUntil: new Date(day40.getTime() + 365 * ONE_DAY_MS).toISOString(),
      },
    };
    expect(db.profile.trialStartedAt).toBe(start.toISOString());
    expect(computeEntitlement(db.profile, day40)).toBe('PRO');
  });

  it('persists trialStartedAt + proUntil round-trip through storage', async () => {
    const store = createMemoryStore();
    const start = new Date(2026, 5, 1).toISOString();
    const proUntil = new Date(2027, 5, 1).toISOString();
    const db: ShotdayDb = {
      ...applyOnboarding(freshDb()),
      profile: {
        ...applyOnboarding(freshDb()).profile,
        trialStartedAt: start,
        proUntil,
        devProOverride: false,
      },
    };
    await saveDb(store, db);
    const reloaded = await loadDb(store);
    expect(reloaded.profile.trialStartedAt).toBe(start);
    expect(reloaded.profile.proUntil).toBe(proUntil);
    expect(reloaded.profile.devProOverride).toBe(false);
  });
});
