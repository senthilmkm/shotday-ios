// Date math used by the side-effect prompt logic and the home top card.
//
// Conventions:
//   - "Day after shot" = whole calendar days between the most recent
//     injection and "now", clamped to 1..3 for the side-effect prompt.
//     Day 0 (same calendar day as the shot) is excluded — we don't ask
//     about side effects on shot day itself.
//   - All math is done in the device's local time zone via
//     `dateOnly()` which strips the time component.

import type { Injection } from '../types/domain';

/** Returns a new Date with hours/min/sec/ms zeroed out (local time). */
export function dateOnly(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Whole calendar days between two dates (local time). Negative if `to` is before `from`. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = dateOnly(from).getTime();
  const b = dateOnly(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the most recent injection from a list, or null when empty.
 * Sorts by `takenAt` (newest first) — does not assume input ordering.
 */
export function mostRecentInjection(history: Injection[]): Injection | null {
  if (history.length === 0) return null;
  let best: Injection = history[0]!;
  for (const inj of history) {
    if (new Date(inj.takenAt).getTime() > new Date(best.takenAt).getTime()) {
      best = inj;
    }
  }
  return best;
}

/**
 * "Which day-after-shot is it right now?"
 *   - 0  → same calendar day as the shot (we don't prompt yet)
 *   - 1, 2, 3 → in the post-shot side-effect window
 *   - >3 or no history → null (not in window)
 */
export function dayAfterShot(history: Injection[], now: Date): 1 | 2 | 3 | null {
  const last = mostRecentInjection(history);
  if (!last) return null;
  const d = calendarDaysBetween(new Date(last.takenAt), now);
  if (d === 1 || d === 2 || d === 3) return d;
  return null;
}

/** True when `now` is in the side-effect prompt window. */
export function isInPostShotWindow(history: Injection[], now: Date): boolean {
  return dayAfterShot(history, now) !== null;
}

/**
 * Days since the most recent shot, capped at null when there's no history.
 * Used for the home top card's "EARLIER TODAY / YESTERDAY / N DAYS AGO" label.
 */
export function daysSinceLastShot(history: Injection[], now: Date): number | null {
  const last = mostRecentInjection(history);
  if (!last) return null;
  return Math.max(0, calendarDaysBetween(new Date(last.takenAt), now));
}

/** Index 0..6 (Sunday..Saturday) for our DayOfWeek strings. */
export const DAY_OF_WEEK_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** Days from `now` until the next occurrence of `targetDay` (0 = today). */
export function daysUntilNext(targetDay: string, now: Date): number {
  const todayIdx = now.getDay();
  const targetIdx = DAY_OF_WEEK_INDEX[targetDay];
  if (targetIdx === undefined) return 0;
  return (targetIdx - todayIdx + 7) % 7;
}
