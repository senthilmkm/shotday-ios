import { buildSmartAlerts, markSmartAlertsSeen, unreadSmartAlertCount } from './smartAlerts';
import { EMPTY_DB, type ShotdayDb } from '../types/domain';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

const now = new Date('2026-06-19T18:00:00');

describe('smart alerts', () => {
  it('surfaces mandatory missing-data alerts for a low-data user', () => {
    const out = buildSmartAlerts(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0,
          currentDoseLabel: '',
          weight: 180,
          weightUnit: 'LB',
          shotDay: 'FRIDAY',
        },
      }),
      now,
    );

    expect(out.map((alert) => alert.title)).toEqual(
      expect.arrayContaining([
        'Set current medication + dose',
        "Log this week's shot",
        "Add this week's weight",
        'Log protein today',
        'Set refill tracking',
        'Doctor report data incomplete',
        'Export / backup reminder',
      ]),
    );
    expect(unreadSmartAlertCount(out)).toBe(out.length);
  });

  it('asks for symptoms after a shot until a post-shot symptom log exists', () => {
    const shot = '2026-06-17T09:00:00';
    const base = db({
      profile: {
        ...EMPTY_DB.profile,
        onboardingComplete: true,
        currentDoseMg: 0.5,
        currentDoseLabel: '0.5 mg',
        weight: 180,
        shotDay: 'WEDNESDAY',
      },
      injections: [{ id: 'shot', takenAt: shot, zone: 'BELLY_UL', doseMg: 0.5 }],
    });

    expect(buildSmartAlerts(base, now).map((alert) => alert.title)).toContain(
      'Check symptoms after shot',
    );
    expect(
      buildSmartAlerts(
        {
          ...base,
          sideEffects: [
            {
              id: 'sym',
              loggedAt: '2026-06-18T18:00:00',
              dayAfterShot: 1,
              metrics: {
                NAUSEA: 1,
                FATIGUE: 1,
                CONSTIPATION: 1,
                APPETITE_SUPPRESSION: 1,
                MOOD: 1,
                ANXIETY: 1,
              },
              chips: [],
              customSymptoms: [],
              doseMg: 0.5,
            },
          ],
        },
        now,
      ).map((alert) => alert.title),
    ).not.toContain('Check symptoms after shot');
  });

  it('shows refill risk and picked-up alerts based on refill state', () => {
    const base = db({
      profile: {
        ...EMPTY_DB.profile,
        onboardingComplete: true,
        currentDoseMg: 0.5,
        currentDoseLabel: '0.5 mg',
        weight: 180,
        shotDay: 'FRIDAY',
      },
      refill: { dosesPerPen: 4, lastFilledAt: '2026-06-01T00:00:00', refillRequested: false },
      injections: [
        { id: 'a', takenAt: '2026-06-01T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
        { id: 'b', takenAt: '2026-06-08T09:00:00', zone: 'BELLY_UR', doseMg: 0.5 },
        { id: 'c', takenAt: '2026-06-15T09:00:00', zone: 'BELLY_LL', doseMg: 0.5 },
      ],
    });

    expect(buildSmartAlerts(base, now).map((alert) => alert.title)).toContain('Refill coming up');
    expect(
      buildSmartAlerts({ ...base, refill: { ...base.refill!, refillRequested: true } }, now).map(
        (alert) => alert.title,
      ),
    ).toContain('Mark refill picked up');
  });

  it('marks alerts read without changing active alert generation', () => {
    const alerts = buildSmartAlerts(db(), now);
    const state = markSmartAlertsSeen(EMPTY_DB.smartAlerts, alerts, now);
    const reread = buildSmartAlerts({ ...db(), smartAlerts: state }, now, state);

    expect(reread.length).toBe(alerts.length);
    expect(unreadSmartAlertCount(reread)).toBe(0);
  });

  it('expires period-based alerts after 30 days', () => {
    const out = buildSmartAlerts(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          weight: 180,
          shotDay: 'FRIDAY',
        },
      }),
      new Date('2026-07-25T12:00:00'),
    );

    expect(out.some((alert) => alert.id === 'shot:2026-06-19')).toBe(false);
  });

  it('does not show protein alert before evening', () => {
    const out = buildSmartAlerts(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          weight: 180,
          shotDay: 'FRIDAY',
        },
      }),
      new Date('2026-06-19T09:00:00'),
    );

    expect(out.map((alert) => alert.title)).not.toContain('Log protein today');
  });

  it('keeps dose review visible after the original dose-change alert would have expired', () => {
    const out = buildSmartAlerts(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          drug: 'OZEMPIC',
          currentDoseMg: 0.25,
          currentDoseLabel: '0.25 mg',
          weight: 180,
          shotDay: 'FRIDAY',
        },
        doseHistory: [
          { id: 'dose', startedAt: '2026-05-01T09:00:00', label: '0.25 mg', mg: 0.25 },
        ],
      }),
      new Date('2026-06-19T18:00:00'),
    );

    const alert = out.find((item) => item.title === 'Confirm dose change');
    expect(alert).toBeDefined();
    expect(alert?.id).toBe('dose-review:2026-06-19');
  });

  it('does not mark doctor report ready from old all-time data', () => {
    const out = buildSmartAlerts(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          weight: 180,
          shotDay: 'FRIDAY',
        },
        injections: [{ id: 'old-shot', takenAt: '2025-01-01T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
        weightEntries: [
          { id: 'old-w1', loggedAt: '2025-01-01T09:00:00', weight: 180, unit: 'LB' },
          { id: 'old-w2', loggedAt: '2025-01-08T09:00:00', weight: 178, unit: 'LB' },
        ],
        foods: [{ id: 'old-food', loggedAt: '2025-01-01T12:00:00', name: 'Shake', proteinGrams: 30, preset: true }],
        sideEffects: [
          {
            id: 'old-sym',
            loggedAt: '2025-01-02T18:00:00',
            dayAfterShot: 1,
            metrics: {
              NAUSEA: 1,
              FATIGUE: 1,
              CONSTIPATION: 1,
              APPETITE_SUPPRESSION: 1,
              MOOD: 1,
              ANXIETY: 1,
            },
            chips: [],
            customSymptoms: [],
            doseMg: 0.5,
          },
        ],
        refillHistory: [
          { id: 'old-refill', type: 'SETUP', loggedAt: '2025-01-01T09:00:00', dosesPerPen: 4 },
        ],
      }),
      now,
    );

    expect(out.map((alert) => alert.title)).toContain('Doctor report data incomplete');
    expect(out.map((alert) => alert.title)).not.toContain('Doctor report ready');
  });

  it('routes doctor report incomplete to the first missing data action', () => {
    const out = buildSmartAlerts(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          weight: 180,
          shotDay: 'FRIDAY',
        },
        injections: [{ id: 'shot', takenAt: '2026-06-19T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
        foods: [{ id: 'food', loggedAt: '2026-06-19T12:00:00', name: 'Shake', proteinGrams: 30, preset: true }],
        sideEffects: [
          {
            id: 'sym',
            loggedAt: '2026-06-19T18:00:00',
            dayAfterShot: 1,
            metrics: {
              NAUSEA: 1,
              FATIGUE: 1,
              CONSTIPATION: 1,
              APPETITE_SUPPRESSION: 1,
              MOOD: 1,
              ANXIETY: 1,
            },
            chips: [],
            customSymptoms: [],
            doseMg: 0.5,
          },
        ],
        refill: { dosesPerPen: 4, lastFilledAt: '2026-06-01T00:00:00', refillRequested: false },
      }),
      now,
    );

    const alert = out.find((item) => item.title === 'Doctor report data incomplete');
    expect(alert?.action?.type).toBe('WEIGHT');
    expect(alert?.action?.label).toBe('Add weight');
  });
});
