// Protein-target calculations.
//
// Standard anti-muscle-loss guidance for GLP-1 users:
//   0.7 g protein per pound of body weight per day.
// Equivalent in metric:
//   1.54 g per kilogram per day.
// Source: Layman et al. (2014) "Defining meal requirements for protein"
// + clinical practice guidelines for sarcopenia prevention.

import type { WeightUnit } from '../types/domain';

export const PROTEIN_G_PER_LB = 0.7;
export const PROTEIN_G_PER_KG = 1.54;

/**
 * Computes a daily protein-gram target from body weight.
 * Rounds to the nearest whole gram so the gauge is human-readable.
 * Throws on non-finite or non-positive weights so callers don't propagate NaN.
 */
export function proteinTargetGrams(weight: number, unit: WeightUnit): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`Invalid weight: ${weight} ${unit}`);
  }
  const grams = unit === 'LB' ? weight * PROTEIN_G_PER_LB : weight * PROTEIN_G_PER_KG;
  return Math.round(grams);
}

/**
 * Returns the percentage of the daily target the user has hit (0–1+).
 * Values >1 are common (over-shooting protein is not an error) — the
 * UI clamps the gauge fill at 100% but keeps the raw number visible.
 */
export function proteinProgress(consumedG: number, targetG: number): number {
  if (targetG <= 0) return 0;
  return consumedG / targetG;
}

/**
 * Returns true when the user is below 50 % of target by 8 PM local —
 * triggers the gentle nudge notification "60 g today — yogurt before bed?".
 * Hour is provided as a parameter (0–23) so tests are deterministic.
 */
export function shouldShowEveningNudge(
  consumedG: number,
  targetG: number,
  hourLocal: number,
): boolean {
  if (hourLocal < 20) return false;
  if (targetG <= 0) return false;
  return consumedG / targetG < 0.5;
}
