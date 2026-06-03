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
 * Default number of days after a shot during which we still consider
 * the user "in the post-shot window" (i.e. side-effect data is
 * shot-relevant). 7 days = full weekly cycle.
 *
 * 3 was a mistake — Wegovy 2.4 mg patients routinely report GI side
 * effects on day 4–6, and silently flipping later reports to "ad-hoc"
 * stamped `dayAfterShot = 1` was corrupting the symptom timeline.
 */
export const POST_SHOT_WINDOW_DAYS = 7;

/**
 * "Which day-after-shot is it right now?"
 *   - 0           → same calendar day as the shot (we don't prompt yet)
 *   - 1..7        → in the post-shot side-effect window
 *   - >7 or no history → null (not in window)
 *
 * The narrow `1..3` range was widened to `1..7` to cover the full
 * weekly cycle. The return type is intentionally `number | null` (not
 * a literal union) so callers don't drift if we ever extend further.
 */
export function dayAfterShot(history: Injection[], now: Date): number | null {
  const last = mostRecentInjection(history);
  if (!last) return null;
  const d = calendarDaysBetween(new Date(last.takenAt), now);
  if (d >= 1 && d <= POST_SHOT_WINDOW_DAYS) return d;
  return null;
}

/**
 * Same as `dayAfterShot` but always returns a value in 1..7 (clamped),
 * used when the user explicitly opens the symptoms screen and we
 * don't want to silently call it "ad-hoc". Returns `null` only when
 * there is no shot history at all.
 */
export function dayAfterShotClamped(history: Injection[], now: Date): number | null {
  const last = mostRecentInjection(history);
  if (!last) return null;
  const d = calendarDaysBetween(new Date(last.takenAt), now);
  if (d <= 0) return null;
  return Math.min(d, POST_SHOT_WINDOW_DAYS);
}

/** True when `now` is in the side-effect prompt window (1..7 days after the most recent shot). */
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
