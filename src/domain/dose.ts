// Drug-specific escalation ladders.
// Source: each drug's FDA-approved label.
//   - Ozempic    : 0.25 → 0.5 → 1.0 → 2.0 mg  (no 1.7 / 2.4 — those are Wegovy-only).
//   - Wegovy     : 0.25 → 0.5 → 1.0 → 1.7 → 2.4 mg
//   - Mounjaro   : 2.5 → 5.0 → 7.5 → 10 → 12.5 → 15 mg
//   - Zepbound   : same as Mounjaro
//   - OTHER      : custom; ladder unknown, surfaced as a numeric input.
//
// Ozempic and Wegovy share the active ingredient (semaglutide) but
// have DIFFERENT pen strengths and DIFFERENT FDA-approved escalation
// schedules. Earlier versions of this file modelled them as a single
// "SEMAGLUTIDE_LADDER" — that bug recommended doses to Ozempic users
// that their pen literally cannot deliver. Don't merge them again.

import type { DoseRung, DrugFamily, LadderId } from '../types/domain';

/** Ozempic — type 2 diabetes indication. Top dose is 2.0 mg. */
export const OZEMPIC_LADDER: DoseRung[] = [
  { label: '0.25 mg', mg: 0.25 },
  { label: '0.5 mg', mg: 0.5 },
  { label: '1.0 mg', mg: 1.0 },
  { label: '2.0 mg', mg: 2.0 },
];

/** Wegovy — chronic weight management indication. Top dose is 2.4 mg. */
export const WEGOVY_LADDER: DoseRung[] = [
  { label: '0.25 mg', mg: 0.25 },
  { label: '0.5 mg', mg: 0.5 },
  { label: '1.0 mg', mg: 1.0 },
  { label: '1.7 mg', mg: 1.7 },
  { label: '2.4 mg', mg: 2.4 },
];

/** Tirzepatide ladder (Mounjaro + Zepbound share this). */
export const TIRZEPATIDE_LADDER: DoseRung[] = [
  { label: '2.5 mg', mg: 2.5 },
  { label: '5.0 mg', mg: 5.0 },
  { label: '7.5 mg', mg: 7.5 },
  { label: '10 mg', mg: 10 },
  { label: '12.5 mg', mg: 12.5 },
  { label: '15 mg', mg: 15 },
];

/**
 * Categorical ladder identifier — useful for analytics / charts that
 * want to group both semaglutide drugs together. NOT used for picking
 * rungs (that goes through `rungsForDrug` to keep Ozempic and Wegovy
 * separate).
 */
export function ladderIdForDrug(drug: DrugFamily): LadderId {
  switch (drug) {
    case 'OZEMPIC':
    case 'WEGOVY':
      return 'SEMAGLUTIDE';
    case 'MOUNJARO':
    case 'ZEPBOUND':
      return 'TIRZEPATIDE';
    case 'OTHER':
      return 'CUSTOM';
  }
}

/** Returns the rung array for a given drug. OTHER returns []. */
export function rungsForDrug(drug: DrugFamily): DoseRung[] {
  switch (drug) {
    case 'OZEMPIC':
      return OZEMPIC_LADDER;
    case 'WEGOVY':
      return WEGOVY_LADDER;
    case 'MOUNJARO':
    case 'ZEPBOUND':
      return TIRZEPATIDE_LADDER;
    case 'OTHER':
      return [];
  }
}

/**
 * Find the index (0-based) of the rung that matches the given mg.
 * Returns -1 if not found (e.g., custom dose, or off-ladder value
 * after a drug switch).
 */
export function rungIndexForMg(drug: DrugFamily, mg: number): number {
  return rungsForDrug(drug).findIndex((r) => r.mg === mg);
}

/** Returns the next rung up, or null if already at the top of the ladder. */
export function nextRung(drug: DrugFamily, currentMg: number): DoseRung | null {
  const rungs = rungsForDrug(drug);
  const idx = rungs.findIndex((r) => r.mg === currentMg);
  if (idx === -1 || idx === rungs.length - 1) return null;
  return rungs[idx + 1] ?? null;
}

/** Returns the previous rung, or null if already at the bottom. */
export function previousRung(drug: DrugFamily, currentMg: number): DoseRung | null {
  const rungs = rungsForDrug(drug);
  const idx = rungs.findIndex((r) => r.mg === currentMg);
  if (idx <= 0) return null;
  return rungs[idx - 1] ?? null;
}

/**
 * True when `mg` does not appear on the standard ladder for `drug`.
 * Used to detect a "stranded" dose after the user switches drugs in
 * Settings (e.g. they were on Ozempic 0.5 mg and switched to Mounjaro
 * — 0.5 mg is not on the tirzepatide ladder).
 */
export function isOffLadder(drug: DrugFamily, mg: number): boolean {
  if (drug === 'OTHER') return false;
  if (mg <= 0) return false;
  return rungIndexForMg(drug, mg) === -1;
}

/**
 * Standard FDA dose-escalation interval is 4 weeks per rung (28 days).
 * Used to calculate the "Next eligible bump" date shown on the dose-ladder screen.
 */
export const STANDARD_ESCALATION_INTERVAL_DAYS = 28;

/**
 * Days remaining until the user is eligible to move up a rung.
 * Returns 0 when the interval has already passed (eligible now).
 * Negative input dates are clamped to 0 to keep the UI honest.
 */
export function daysUntilEligibleToBump(
  startedAt: Date,
  now: Date,
  intervalDays: number = STANDARD_ESCALATION_INTERVAL_DAYS,
): number {
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  if (elapsedDays < 0) return intervalDays;
  return Math.max(0, intervalDays - elapsedDays);
}
