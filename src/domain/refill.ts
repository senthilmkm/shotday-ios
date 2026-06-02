// Refill calculations.
//
// Two questions that the home card and the dedicated screen need to answer:
//   1. How many doses are left in the current pen/vial?
//   2. How urgent is the refill alert?
//
// The math is simple — count injections logged since the user marked their
// pen as filled, subtract from `dosesPerPen`, and clamp to >=0. The tricky
// bits are:
//   - Cooldown: when the user taps "Refill requested", we silence the
//     URGENT alert until they update lastFilledAt (i.e., picked it up).
//   - First-time setup: with no refill record at all, the home card should
//     show a CTA, not a stale number.

import type { Injection, RefillSchedule } from '../types/domain';

export type RefillAlertLevel = 'NONE' | 'INFO' | 'URGENT' | 'EMPTY';

export interface RefillStatus {
  /** True when the user hasn't set up refill tracking yet. */
  unconfigured: boolean;
  /** Doses remaining in the current pen/vial. 0 when out. */
  dosesRemaining: number;
  /** Total doses the pen holds (mirrors `RefillSchedule.dosesPerPen`). */
  dosesPerPen: number;
  /** True when the user has tapped "Refill requested" and we suppress the URGENT pulse. */
  refillRequested: boolean;
  /** Alert level for the home card border + icon color. */
  alertLevel: RefillAlertLevel;
}

/** Threshold (inclusive) below which we surface the URGENT alert. */
export const URGENT_THRESHOLD = 1;

/** Threshold (inclusive) for the gentle INFO heads-up. */
export const INFO_THRESHOLD = 2;

/**
 * Computes the refill status from current state.
 * `now` is unused today but reserved so we can later add days-of-supply
 * estimation (e.g., "covers you through Sun Jul 5") which depends on the
 * shotDay and current date.
 */
export function refillStatus(
  refill: RefillSchedule | null,
  injections: Injection[],
  _now: Date,
): RefillStatus {
  if (!refill) {
    return {
      unconfigured: true,
      dosesRemaining: 0,
      dosesPerPen: 0,
      refillRequested: false,
      alertLevel: 'NONE',
    };
  }
  const filledMs = new Date(refill.lastFilledAt).getTime();
  const usedSinceFill = injections.filter(
    (i) => new Date(i.takenAt).getTime() >= filledMs,
  ).length;
  const dosesRemaining = Math.max(0, refill.dosesPerPen - usedSinceFill);

  let alertLevel: RefillAlertLevel = 'NONE';
  if (dosesRemaining === 0) {
    alertLevel = 'EMPTY';
  } else if (dosesRemaining <= URGENT_THRESHOLD) {
    alertLevel = refill.refillRequested ? 'INFO' : 'URGENT';
  } else if (dosesRemaining <= INFO_THRESHOLD) {
    alertLevel = 'INFO';
  }

  return {
    unconfigured: false,
    dosesRemaining,
    dosesPerPen: refill.dosesPerPen,
    refillRequested: refill.refillRequested,
    alertLevel,
  };
}

/**
 * Default doses-per-pen for the major drugs. Used to pre-fill the refill
 * setup screen so the user usually only has to confirm.
 *   - Ozempic + Wegovy pens deliver 4 weekly doses.
 *   - Mounjaro + Zepbound vials are single-use (1 dose / vial).
 */
export function defaultDosesPerPen(drug: string): number {
  switch (drug) {
    case 'OZEMPIC':
    case 'WEGOVY':
      return 4;
    case 'MOUNJARO':
    case 'ZEPBOUND':
      return 1;
    default:
      return 4;
  }
}
