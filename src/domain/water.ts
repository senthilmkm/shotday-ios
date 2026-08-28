// Water / hydration calculations and presets.
//
// Standard GLP-1 hydration guidance:
//   - GLP-1 receptor agonists slow gastric emptying and suppress central
//     thirst cues. Dehydration is the primary risk factor for constipation,
//     headaches, nausea, and acute renal stress.
//   - Baseline recommendation: half body weight in ounces per day
//     (0.5 oz / lb or ~32 ml / kg), with a clinical minimum of 64 oz (2,000 ml)
//     and an upper target clamp of 128 oz (~3,800 ml).

import type { WaterEntry, WeightUnit } from '../types/domain';

export const MIN_WATER_OZ = 64;
export const MAX_WATER_OZ = 128;
export const MIN_WATER_ML = 2000;
export const MAX_WATER_ML = 3800;

export const ML_PER_OZ = 29.5735;

export interface WaterPreset {
  id: string;
  name: string;
  amountOz: number;
  amountMl: number;
  icon: string;
}

export const WATER_PRESETS: WaterPreset[] = [
  {
    id: 'glass',
    name: 'Glass',
    amountOz: 8,
    amountMl: 240,
    icon: '🥛',
  },
  {
    id: 'bottle',
    name: 'Bottle',
    amountOz: 16,
    amountMl: 500,
    icon: '💧',
  },
  {
    id: 'tumbler',
    name: 'Tumbler',
    amountOz: 24,
    amountMl: 750,
    icon: '🥤',
  },
  {
    id: 'flask',
    name: 'Flask',
    amountOz: 32,
    amountMl: 1000,
    icon: '🍶',
  },
];

/**
 * Converts ounces to milliliters, rounded to nearest whole ml.
 */
export function ozToMl(oz: number): number {
  if (!Number.isFinite(oz) || oz <= 0) return 0;
  return Math.round(oz * ML_PER_OZ);
}

/**
 * Converts milliliters to ounces, rounded to 1 decimal place.
 */
export function mlToOz(ml: number): number {
  if (!Number.isFinite(ml) || ml <= 0) return 0;
  return Math.round((ml / ML_PER_OZ) * 10) / 10;
}

/**
 * Computes daily target in fluid ounces based on body weight.
 * Minimum is 64 oz, maximum is 128 oz.
 * If weight is 0 or invalid, returns default minimum 64 oz.
 */
export function waterTargetOz(weight: number, unit: WeightUnit): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return MIN_WATER_OZ;
  }
  const weightInLb = unit === 'LB' ? weight : weight * 2.20462;
  const rawTarget = weightInLb * 0.5;
  const clamped = Math.min(MAX_WATER_OZ, Math.max(MIN_WATER_OZ, rawTarget));
  return Math.round(clamped);
}

/**
 * Computes daily target in milliliters based on body weight.
 * Minimum is 2,000 ml, maximum is 3,800 ml.
 * If weight is 0 or invalid, returns default minimum 2,000 ml.
 */
export function waterTargetMl(weight: number, unit: WeightUnit): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return MIN_WATER_ML;
  }
  const targetOz = waterTargetOz(weight, unit);
  return ozToMl(targetOz);
}

/**
 * Filters water entries belonging to a given calendar day (local time).
 */
export function entriesForDay(entries: WaterEntry[], day: Date): WaterEntry[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  return entries.filter((e) => {
    const t = new Date(e.loggedAt);
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
  });
}

/**
 * Returns total fluid ounces and milliliters consumed for a given day.
 */
export function totalWaterForDay(
  entries: WaterEntry[],
  day: Date,
): { oz: number; ml: number } {
  const dayEntries = entriesForDay(entries, day);
  const totalOz = dayEntries.reduce((sum, e) => sum + (Number.isFinite(e.amountOz) ? e.amountOz : 0), 0);
  const roundedOz = Math.round(totalOz * 10) / 10;
  return {
    oz: roundedOz,
    ml: ozToMl(roundedOz),
  };
}

/**
 * Returns progress ratio (0 to 1+).
 */
export function waterProgress(consumedOz: number, targetOz: number): number {
  if (!Number.isFinite(consumedOz) || !Number.isFinite(targetOz) || targetOz <= 0) {
    return 0;
  }
  return consumedOz / targetOz;
}

/**
 * Helper to construct a fresh WaterEntry with standard ID.
 */
export function buildWaterEntry(
  amountOz: number,
  label?: string,
  date: Date = new Date(),
): WaterEntry {
  if (!Number.isFinite(amountOz) || amountOz <= 0) {
    throw new Error(`Invalid water amount: ${amountOz} oz`);
  }
  return {
    id: `water-${date.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    loggedAt: date.toISOString(),
    amountOz: Math.round(amountOz * 10) / 10,
    label: label?.trim() || undefined,
  };
}

/**
 * Returns true when user is below 50% of target by 8 PM (20:00) local time.
 */
export function shouldShowWaterEveningNudge(
  consumedOz: number,
  targetOz: number,
  hourLocal: number,
): boolean {
  if (hourLocal < 20) return false;
  if (targetOz <= 0) return false;
  return consumedOz / targetOz < 0.5;
}
