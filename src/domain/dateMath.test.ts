import type { Injection } from '../types/domain';
import {
  calendarDaysBetween,
  dateOnly,
  dayAfterShot,
  daysSinceLastShot,
  daysUntilNext,
  isInPostShotWindow,
  mostRecentInjection,
} from './dateMath';

function inj(takenAt: string, id = takenAt): Injection {
  return { id, takenAt, zone: 'BELLY_UL', doseMg: 0.5 };
}

describe('dateOnly', () => {
  it('strips the time component', () => {
    const d = new Date('2026-06-01T18:30:45.999Z');
    const stripped = dateOnly(d);
    expect(stripped.getHours()).toBe(0);
    expect(stripped.getMinutes()).toBe(0);
    expect(stripped.getSeconds()).toBe(0);
    expect(stripped.getMilliseconds()).toBe(0);
  });

  it('does not mutate the input', () => {
    const original = new Date('2026-06-01T18:30:45.999Z');
    const t = original.getTime();
    dateOnly(original);
    expect(original.getTime()).toBe(t);
  });
});

describe('calendarDaysBetween', () => {
  it('returns 0 for same-day dates with different times', () => {
    expect(
      calendarDaysBetween(new Date(2026, 5, 1, 9, 0), new Date(2026, 5, 1, 23, 0)),
    ).toBe(0);
  });

  it('returns positive for forward in time', () => {
    expect(calendarDaysBetween(new Date(2026, 5, 1), new Date(2026, 5, 4))).toBe(3);
  });

  it('returns negative for backward in time', () => {
    expect(calendarDaysBetween(new Date(2026, 5, 4), new Date(2026, 5, 1))).toBe(-3);
  });
});

describe('mostRecentInjection', () => {
  it('returns null on empty', () => {
    expect(mostRecentInjection([])).toBeNull();
  });

  it('returns the newest by takenAt regardless of array order', () => {
    const result = mostRecentInjection([
      inj('2026-05-01T09:00:00Z'),
      inj('2026-05-31T09:00:00Z'),
      inj('2026-05-15T09:00:00Z'),
    ]);
    expect(result?.takenAt).toBe('2026-05-31T09:00:00Z');
  });
});

describe('dayAfterShot', () => {
  it('returns null when no history', () => {
    expect(dayAfterShot([], new Date(2026, 5, 1))).toBeNull();
  });

  it('returns null on shot day itself (day 0)', () => {
    const history = [inj('2026-06-01T09:00:00')];
    expect(dayAfterShot(history, new Date(2026, 5, 1, 21, 0))).toBeNull();
  });

  it('returns 1, 2, 3 in the prompt window', () => {
    const history = [inj('2026-06-01T09:00:00')];
    expect(dayAfterShot(history, new Date(2026, 5, 2, 8, 0))).toBe(1);
    expect(dayAfterShot(history, new Date(2026, 5, 3, 8, 0))).toBe(2);
    expect(dayAfterShot(history, new Date(2026, 5, 4, 8, 0))).toBe(3);
  });

  it('returns null beyond day 3', () => {
    const history = [inj('2026-06-01T09:00:00')];
    expect(dayAfterShot(history, new Date(2026, 5, 5, 8, 0))).toBeNull();
    expect(dayAfterShot(history, new Date(2026, 5, 8, 8, 0))).toBeNull();
  });
});

describe('isInPostShotWindow', () => {
  it('mirrors dayAfterShot non-null', () => {
    const history = [inj('2026-06-01T09:00:00')];
    expect(isInPostShotWindow(history, new Date(2026, 5, 1, 21, 0))).toBe(false);
    expect(isInPostShotWindow(history, new Date(2026, 5, 2, 8, 0))).toBe(true);
    expect(isInPostShotWindow(history, new Date(2026, 5, 5, 8, 0))).toBe(false);
  });
});

describe('daysSinceLastShot', () => {
  it('returns null with no history', () => {
    expect(daysSinceLastShot([], new Date(2026, 5, 1))).toBeNull();
  });

  it('returns 0 same calendar day', () => {
    const history = [inj('2026-06-01T09:00:00')];
    expect(daysSinceLastShot(history, new Date(2026, 5, 1, 21, 0))).toBe(0);
  });

  it('clamps to 0 for clock skew (negative deltas)', () => {
    const history = [inj('2026-06-05T09:00:00')];
    expect(daysSinceLastShot(history, new Date(2026, 5, 1))).toBe(0);
  });

  it('counts whole calendar days', () => {
    const history = [inj('2026-06-01T09:00:00')];
    expect(daysSinceLastShot(history, new Date(2026, 5, 8, 8, 0))).toBe(7);
  });
});

describe('daysUntilNext', () => {
  it('returns 0 when target is today', () => {
    // June 1, 2026 is a Monday
    expect(daysUntilNext('MONDAY', new Date(2026, 5, 1))).toBe(0);
  });

  it('returns 1..6 for upcoming days', () => {
    expect(daysUntilNext('TUESDAY', new Date(2026, 5, 1))).toBe(1);
    expect(daysUntilNext('SUNDAY', new Date(2026, 5, 1))).toBe(6);
  });

  it('returns 0 for unknown day strings (degrades safely)', () => {
    expect(daysUntilNext('FUNDAY', new Date(2026, 5, 1))).toBe(0);
  });
});
