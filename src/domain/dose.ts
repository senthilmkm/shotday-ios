// Drug-specific escalation ladders.
// Source: each drug's FDA-approved label (Ozempic, Wegovy, Mounjaro, Zepbound).
// We deliberately model only the standard escalation paths users follow at
// home; off-label or compounded variants fall through to "CUSTOM" and the
// user enters values manually.

import type { DoseRung, DrugFamily, LadderId } from '../types/domain';

/** Semaglutide ladder (Ozempic + Wegovy share this, with one extra rung on Wegovy). */
export const SEMAGLUTIDE_LADDER: DoseRung[] = [
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

/** Maps the drug family the user picked to which ladder applies. */
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

/** Returns the rung array for a given ladder. CUSTOM returns an empty array — UI surfaces a manual numeric input instead. */
export function rungsForLadder(ladder: LadderId): DoseRung[] {
  switch (ladder) {
    case 'SEMAGLUTIDE':
      return SEMAGLUTIDE_LADDER;
    case 'TIRZEPATIDE':
      return TIRZEPATIDE_LADDER;
    case 'CUSTOM':
      return [];
  }
}

/** Convenience: rungs for a drug family. */
export function rungsForDrug(drug: DrugFamily): DoseRung[] {
  return rungsForLadder(ladderIdForDrug(drug));
}

/**
 * Find the index (0-based) of the rung that matches the given mg.
 * Returns -1 if not found (e.g., custom dose, or off-ladder value).
 * Comparison uses strict mg equality — assumes UI only writes ladder
 * values into currentDoseMg unless drug === 'OTHER'.
 */
export function rungIndexForMg(ladder: LadderId, mg: number): number {
  return rungsForLadder(ladder).findIndex((r) => r.mg === mg);
}

/** Returns the next rung up, or null if already at the top of the ladder. */
export function nextRung(ladder: LadderId, currentMg: number): DoseRung | null {
  const rungs = rungsForLadder(ladder);
  const idx = rungs.findIndex((r) => r.mg === currentMg);
  if (idx === -1 || idx === rungs.length - 1) return null;
  return rungs[idx + 1] ?? null;
}

/** Returns the previous rung, or null if already at the bottom. */
export function previousRung(ladder: LadderId, currentMg: number): DoseRung | null {
  const rungs = rungsForLadder(ladder);
  const idx = rungs.findIndex((r) => r.mg === currentMg);
  if (idx <= 0) return null;
  return rungs[idx - 1] ?? null;
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
