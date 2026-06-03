// Dose-safety guardrails for logging a new injection.
//
// GLP-1 receptor agonists (Ozempic, Wegovy, Mounjaro, Zepbound) are
// once-weekly drugs. Manufacturer guidance:
//   - If a dose is missed and ≤5 days have passed since the scheduled
//     dose, take it as soon as remembered.
//   - If >5 days have passed, skip the missed dose entirely and resume
//     on the next scheduled day.
// A second injection within the same week therefore has no medical
// indication and risks severe nausea, dehydration, hypoglycemia
// (semaglutide), or pancreatitis flares.
//
// The safety check is RELATIVE TO THE LOGGED TIME, not the wall clock.
// A user backdating "I took a shot last Sunday at 9 AM, am logging
// today" needs the conflict check to compare against neighbors on
// BOTH sides of last Sunday — both the prior week's shot and any
// later shot they may have already logged. Earlier versions of this
// function used `now` as the reference and missed the bidirectional
// case.

import type { Injection } from '../types/domain';
import { calendarDaysBetween } from './dateMath';

export type DoseSafety =
  | { kind: 'OK' }
  | { kind: 'BLOCK_REPLACE'; existing: Injection }
  | { kind: 'WARN_TOO_SOON'; daysAgo: number; existingDoseMg: number };

/**
 * Number of calendar days within which a second injection is still a
 * "warn" (not silent). 5 matches manufacturer "missed dose" windows
 * for both semaglutide and tirzepatide.
 */
export const TOO_SOON_DAYS_THRESHOLD = 5;

/**
 * Inspect injection history and classify whether it's safe to record
 * a new injection at `takenAt`.
 *
 * `takenAt` is the time the user is *recording* — not necessarily
 * "now". For a backdated log this is the date the shot was actually
 * taken; for a normal log it's the moment of tap.
 *
 * Pure — no I/O, no Date.now() — so it's trivially testable.
 */
export function checkDoseSafety(
  injections: Injection[],
  takenAt: Date,
): DoseSafety {
  // Same-calendar-day conflict (block + replace). Pick the most
  // recently logged same-day injection; that's the one the user most
  // likely wants to overwrite.
  const sameDay = injections
    .filter((i) => calendarDaysBetween(new Date(i.takenAt), takenAt) === 0)
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
  if (sameDay) {
    return { kind: 'BLOCK_REPLACE', existing: sameDay };
  }

  // Bidirectional neighbor check: look for the closest existing
  // injection on either side of takenAt within the warn window.
  let closest: Injection | null = null;
  let closestAbsDays = Infinity;
  for (const i of injections) {
    const days = Math.abs(calendarDaysBetween(new Date(i.takenAt), takenAt));
    if (days >= 1 && days <= TOO_SOON_DAYS_THRESHOLD && days < closestAbsDays) {
      closestAbsDays = days;
      closest = i;
    }
  }
  if (closest) {
    return {
      kind: 'WARN_TOO_SOON',
      daysAgo: closestAbsDays,
      existingDoseMg: closest.doseMg,
    };
  }

  return { kind: 'OK' };
}
