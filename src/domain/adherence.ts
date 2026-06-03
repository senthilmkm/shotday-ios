// Adherence helpers — answers the question "have I been taking my
// weekly shot on schedule?" in a way the home screen can render as a
// small status ring.
//
// The "week" boundary is anchored to the user's preferred shot day
// (profile.shotDay). A weekly window runs as a half-open interval
// [start, end) of seven calendar days, where `end` is **midnight of
// the day AFTER** the week's shotDay. This means the shotDay itself
// is fully contained in its own week — a shot logged Sunday at any
// time of day belongs to the week that ends on that Sunday.
//
// Concretely, for shotDay = Sunday, the current week's window is
//   [Mon 00:00 (start of week), next-Mon 00:00 (start of next week)).
// A shot logged at any moment from Mon 00:00 through Sun 23:59:59
// counts the current week as a "hit".
//
// We deliberately do not distinguish "missed" from "pre-install" —
// both render as a hollow segment on the ring. Trying to infer "was
// this user actually using the app yet?" from injection history is a
// rabbit hole and the ring's purpose is just at-a-glance adherence.

import type { DayOfWeek, Injection } from '../types/domain';
import { DAY_OF_WEEK_INDEX } from './dateMath';

/** Local-time midnight of the given date. */
function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Returns the most recent occurrence of `targetDay` (today included) at
 * local midnight. E.g. if today is Wed Jun 3 and `targetDay = SUNDAY`,
 * returns Sun May 31.
 */
function mostRecentOccurrenceOf(targetDay: DayOfWeek, now: Date): Date {
  const todayIdx = now.getDay();
  const targetIdx = DAY_OF_WEEK_INDEX[targetDay];
  if (targetIdx === undefined) return startOfDay(now);
  const daysSince = (todayIdx - targetIdx + 7) % 7;
  const out = startOfDay(now);
  out.setDate(out.getDate() - daysSince);
  return out;
}

/**
 * Returns the upcoming occurrence of `targetDay` from `now` (today
 * counts as "upcoming" only when today === targetDay).
 */
function nextOccurrenceOf(targetDay: DayOfWeek, now: Date): Date {
  const todayIdx = now.getDay();
  const targetIdx = DAY_OF_WEEK_INDEX[targetDay];
  if (targetIdx === undefined) return startOfDay(now);
  const daysAhead = (targetIdx - todayIdx + 7) % 7;
  const out = startOfDay(now);
  out.setDate(out.getDate() + daysAhead);
  return out;
}

/**
 * Returns an array of `weeks` booleans, oldest → newest, telling whether
 * an injection was logged inside each weekly window leading up to (and
 * including) the current week.
 *
 *   - The current week ends on the upcoming `shotDay` (inclusive).
 *   - Each window is 7 calendar days, ending at midnight on its shotDay
 *     and starting 6 days earlier at midnight.
 *   - The current week (last in the array) is in-progress: it counts as
 *     a "hit" if the user has already logged a shot in this week's
 *     window, otherwise it's hollow (NOT a miss yet).
 *
 * Examples (shotDay = SUNDAY, today = Wed Jun 3):
 *   - Week 8 (current): [Mon Jun 1 … Sun Jun 7]
 *   - Week 7: [Mon May 25 … Sun May 31]
 *   - …
 *   - Week 1: [Mon Apr 13 … Sun Apr 19]
 *
 * Pure: no `Date.now()`, deterministic given inputs.
 */
export function recentWeeklyAdherence(
  injections: Injection[],
  shotDay: DayOfWeek,
  now: Date,
  weeks: number = 8,
): boolean[] {
  if (weeks <= 0) return [];

  // currentWeekEnd is the EXCLUSIVE upper bound of the current week:
  // midnight of the day AFTER the upcoming shotDay. This ensures
  // shotDay itself (any time of day) is contained in [start, end).
  const nextShotDay = nextOccurrenceOf(shotDay, now);
  const currentWeekEnd = new Date(nextShotDay);
  currentWeekEnd.setDate(nextShotDay.getDate() + 1);

  const out: boolean[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    // Window ending on currentWeekEnd - w * 7 days.
    const end = new Date(currentWeekEnd);
    end.setDate(currentWeekEnd.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);

    // Half-open interval [start, end).
    const startMs = start.getTime();
    const endMs = end.getTime();
    const hit = injections.some((i) => {
      const t = new Date(i.takenAt).getTime();
      return t >= startMs && t < endMs;
    });
    out.push(hit);
  }
  return out;
}

/**
 * Convenience: count the number of "hit" weeks in the last `weeks`
 * weeks. Useful for the center label of the ring ("5/8").
 */
export function adherenceCount(adherence: boolean[]): number {
  let n = 0;
  for (const hit of adherence) if (hit) n++;
  return n;
}

// Re-exports for tests that need to validate boundary logic without
// reaching into private helpers.
export const __test = { mostRecentOccurrenceOf, nextOccurrenceOf };
