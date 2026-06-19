import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_DB,
  type Injection,
  type ShotdayDb,
  type UserProfile,
} from '../types/domain';
import {
  dayAfterWeekday,
  isInQuietHours,
  MON,
  nextHour,
  planNotifications,
  SAT,
  SUN,
  WED,
} from './schedule';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  ...EMPTY_DB.profile,
  onboardingComplete: true,
  drug: 'OZEMPIC',
  currentDoseMg: 0.5,
  currentDoseLabel: '0.5 mg',
  weight: 175,
  weightUnit: 'LB',
  shotDay: 'SUNDAY',
  ...overrides,
});

const dbOf = (
  profileOverrides: Partial<UserProfile> = {},
  injections: Injection[] = [],
  refill: ShotdayDb['refill'] = null,
): ShotdayDb => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  profile: profile(profileOverrides),
  injections,
  sideEffects: [],
  foods: [],
  weightEntries: [],
  doseHistory: [],
  refill,
  refillHistory: [],
  smartAlerts: { byId: {} },
});

const inj = (takenAt: string): Injection => ({
  id: takenAt,
  takenAt,
  zone: 'BELLY_UL',
  doseMg: 0.5,
});

// ─────────────────────────────────────────────────────────────────────
// dayAfterWeekday
// ─────────────────────────────────────────────────────────────────────

describe('dayAfterWeekday', () => {
  it('Sunday(1) → Monday(2)', () => {
    expect(dayAfterWeekday(SUN)).toBe(MON);
  });

  it('Wednesday(4) → Thursday(5)', () => {
    expect(dayAfterWeekday(WED)).toBe(5);
  });

  it('Saturday(7) wraps to Sunday(1)', () => {
    expect(dayAfterWeekday(SAT)).toBe(SUN);
  });
});

// ─────────────────────────────────────────────────────────────────────
// isInQuietHours
// ─────────────────────────────────────────────────────────────────────

describe('isInQuietHours', () => {
  const p = profile({ quietHoursStart: 22, quietHoursEnd: 7 });

  it('inside the wrap-around window', () => {
    expect(isInQuietHours(23, p)).toBe(true);
    expect(isInQuietHours(0, p)).toBe(true);
    expect(isInQuietHours(6, p)).toBe(true);
  });

  it('outside the wrap-around window', () => {
    expect(isInQuietHours(8, p)).toBe(false);
    expect(isInQuietHours(20, p)).toBe(false);
    expect(isInQuietHours(21, p)).toBe(false);
  });

  it('start === end means quiet hours disabled', () => {
    const q = profile({ quietHoursStart: 0, quietHoursEnd: 0 });
    expect(isInQuietHours(2, q)).toBe(false);
    expect(isInQuietHours(14, q)).toBe(false);
  });

  it('non-wrapping window (e.g., 13-15 lunch quiet)', () => {
    const q = profile({ quietHoursStart: 13, quietHoursEnd: 15 });
    expect(isInQuietHours(14, q)).toBe(true);
    expect(isInQuietHours(13, q)).toBe(true);
    expect(isInQuietHours(15, q)).toBe(false); // end-exclusive
    expect(isInQuietHours(12, q)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// nextHour
// ─────────────────────────────────────────────────────────────────────

describe('nextHour', () => {
  it('returns same-day hour if it is still future', () => {
    const now = new Date(2026, 5, 1, 8, 0);
    expect(nextHour(now, 9).getHours()).toBe(9);
    expect(nextHour(now, 9).getDate()).toBe(1);
  });

  it('rolls to next day when hour has passed', () => {
    const now = new Date(2026, 5, 1, 14, 0);
    const result = nextHour(now, 9);
    expect(result.getHours()).toBe(9);
    expect(result.getDate()).toBe(2);
  });

  it('rolls to next day when hour exactly equals current hour:minute', () => {
    const now = new Date(2026, 5, 1, 9, 0);
    const result = nextHour(now, 9);
    expect(result.getDate()).toBe(2); // edge case: must be strictly after
  });
});

// ─────────────────────────────────────────────────────────────────────
// planNotifications
// ─────────────────────────────────────────────────────────────────────

describe('planNotifications — gating', () => {
  it('returns empty plan when onboarding incomplete', () => {
    const db = dbOf({ onboardingComplete: false });
    expect(planNotifications(db, new Date())).toEqual([]);
  });

  it('returns empty plan for invalid shot day string', () => {
    const db = dbOf({ shotDay: 'NOT_A_DAY' as never });
    expect(planNotifications(db, new Date())).toEqual([]);
  });
});

describe('planNotifications — weekly schedule', () => {
  it('plans both shot reminder and side-effect prompt for Sunday shot day', () => {
    const db = dbOf({ shotDay: 'SUNDAY', shotReminderHour: 9, sideEffectPromptHour: 20 });
    const plan = planNotifications(db, new Date(2026, 5, 1));

    const shot = plan.find((p) => p.category === 'SHOT_REMINDER');
    const post = plan.find((p) => p.category === 'SIDE_EFFECT_PROMPT');
    expect(shot).toBeDefined();
    expect(shot?.weekday).toBe(SUN);
    expect(shot?.hour).toBe(9);
    expect(post).toBeDefined();
    expect(post?.weekday).toBe(MON); // day after Sunday
    expect(post?.hour).toBe(20);
  });

  it('wraps Saturday → Sunday for the post-shot prompt', () => {
    const db = dbOf({ shotDay: 'SATURDAY' });
    const plan = planNotifications(db, new Date(2026, 5, 1));
    const post = plan.find((p) => p.category === 'SIDE_EFFECT_PROMPT');
    expect(post?.weekday).toBe(SUN);
  });

  it('skips channels whose hour falls in quiet hours', () => {
    const db = dbOf({
      shotDay: 'SUNDAY',
      shotReminderHour: 5, // inside default quiet 22→7
      sideEffectPromptHour: 20,
      quietHoursStart: 22,
      quietHoursEnd: 7,
    });
    const plan = planNotifications(db, new Date(2026, 5, 1));
    expect(plan.find((p) => p.category === 'SHOT_REMINDER')).toBeUndefined();
    expect(plan.find((p) => p.category === 'SIDE_EFFECT_PROMPT')).toBeDefined();
  });

  it('uses currentDoseLabel in shot-reminder body when set', () => {
    const db = dbOf({ currentDoseLabel: '1.0 mg' });
    const plan = planNotifications(db, new Date(2026, 5, 1));
    const shot = plan.find((p) => p.category === 'SHOT_REMINDER');
    expect(shot?.body).toContain('1.0 mg');
  });
});

describe('planNotifications — refill nudge', () => {
  it('does not plan a refill nudge when refill is unconfigured', () => {
    const db = dbOf({}, [], null);
    const plan = planNotifications(db, new Date(2026, 5, 1));
    expect(plan.find((p) => p.category === 'REFILL_NUDGE')).toBeUndefined();
  });

  it('does not plan when 3+ doses remain (NONE level)', () => {
    const db = dbOf({}, [], {
      dosesPerPen: 4,
      lastFilledAt: new Date(2026, 5, 1).toISOString(),
      refillRequested: false,
    });
    const plan = planNotifications(db, new Date(2026, 5, 5));
    expect(plan.find((p) => p.category === 'REFILL_NUDGE')).toBeUndefined();
  });

  it('does not plan at INFO level (2 doses left)', () => {
    const injections = [inj('2026-06-08T09:00:00Z'), inj('2026-06-15T09:00:00Z')];
    const db = dbOf({}, injections, {
      dosesPerPen: 4,
      lastFilledAt: '2026-06-01T00:00:00Z',
      refillRequested: false,
    });
    const plan = planNotifications(db, new Date(2026, 5, 16));
    // INFO does not nudge — only URGENT or EMPTY.
    expect(plan.find((p) => p.category === 'REFILL_NUDGE')).toBeUndefined();
  });

  it('plans a one-shot nudge at URGENT level', () => {
    const injections = [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
    ];
    const db = dbOf({ refillReminderHour: 9 }, injections, {
      dosesPerPen: 4,
      lastFilledAt: '2026-06-01T00:00:00Z',
      refillRequested: false,
    });
    const plan = planNotifications(db, new Date(2026, 5, 23, 14, 0));
    const nudge = plan.find((p) => p.category === 'REFILL_NUDGE');
    expect(nudge).toBeDefined();
    expect(nudge?.oneShotAt).toBeDefined();
    expect(nudge?.oneShotAt?.getHours()).toBe(9);
    // 14:00 already past 9:00 → fires tomorrow
    expect(nudge?.oneShotAt?.getDate()).toBe(24);
  });

  it('suppresses nudge once user marks refill as requested', () => {
    const injections = [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
    ];
    const db = dbOf({}, injections, {
      dosesPerPen: 4,
      lastFilledAt: '2026-06-01T00:00:00Z',
      refillRequested: true,
    });
    const plan = planNotifications(db, new Date(2026, 5, 23, 14, 0));
    expect(plan.find((p) => p.category === 'REFILL_NUDGE')).toBeUndefined();
  });

  it('plans an EMPTY-level nudge with the harsher copy', () => {
    const injections = [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
      inj('2026-06-29T09:00:00Z'),
    ];
    const db = dbOf({}, injections, {
      dosesPerPen: 4,
      lastFilledAt: '2026-06-01T00:00:00Z',
      refillRequested: false,
    });
    const plan = planNotifications(db, new Date(2026, 5, 30));
    const nudge = plan.find((p) => p.category === 'REFILL_NUDGE');
    expect(nudge?.title).toContain('No doses');
  });
});

describe('planNotifications — identifier stability', () => {
  it('produces the same identifier for the same configuration (idempotent re-plan)', () => {
    const db = dbOf({ shotDay: 'WEDNESDAY' });
    const a = planNotifications(db, new Date(2026, 5, 1));
    const b = planNotifications(db, new Date(2026, 6, 15));
    expect(a.find((x) => x.category === 'SHOT_REMINDER')?.identifier).toBe(
      b.find((x) => x.category === 'SHOT_REMINDER')?.identifier,
    );
  });

  it('changes the shot-reminder identifier when shot day moves', () => {
    const dbA = dbOf({ shotDay: 'SUNDAY' });
    const dbB = dbOf({ shotDay: 'WEDNESDAY' });
    const a = planNotifications(dbA, new Date(2026, 5, 1));
    const b = planNotifications(dbB, new Date(2026, 5, 1));
    expect(a.find((x) => x.category === 'SHOT_REMINDER')?.identifier).not.toBe(
      b.find((x) => x.category === 'SHOT_REMINDER')?.identifier,
    );
  });
});
