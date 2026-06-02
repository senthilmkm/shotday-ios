// Food / protein domain: preset tiles, entry building, daily aggregation.
//
// Preset gram values come from USDA FoodData Central averages, rounded to
// "good enough for tracking" — this is not a calorie-counter, just a
// protein hit log. Users with serious nutrition needs should use a real
// app like Cronometer.

import type { FoodEntry } from '../types/domain';

export interface FoodPreset {
  id: string;
  name: string;
  /** Suggested serving description shown under the name. */
  serving: string;
  proteinGrams: number;
}

export const FOOD_PRESETS: FoodPreset[] = [
  { id: 'chicken', name: 'Chicken', serving: '4 oz / 113 g', proteinGrams: 35 },
  { id: 'yogurt', name: 'Greek yogurt', serving: '1 cup / 245 g', proteinGrams: 23 },
  { id: 'eggs', name: 'Eggs', serving: '2 large', proteinGrams: 12 },
  { id: 'shake', name: 'Protein shake', serving: '1 scoop', proteinGrams: 25 },
  { id: 'cottage', name: 'Cottage cheese', serving: '1 cup', proteinGrams: 28 },
  { id: 'tuna', name: 'Tuna', serving: '4 oz / 113 g', proteinGrams: 28 },
  { id: 'edamame', name: 'Edamame', serving: '1 cup', proteinGrams: 18 },
  { id: 'steak', name: 'Steak', serving: '4 oz / 113 g', proteinGrams: 30 },
];

/** Builds a FoodEntry from a preset tap. */
export function buildPresetEntry(preset: FoodPreset, now: Date): FoodEntry {
  return {
    id: `food-${now.getTime()}-${preset.id}`,
    loggedAt: now.toISOString(),
    name: preset.name,
    proteinGrams: preset.proteinGrams,
    preset: true,
  };
}

/** Builds a FoodEntry from custom user input. */
export function buildCustomEntry(name: string, proteinGrams: number, now: Date): FoodEntry {
  if (!Number.isFinite(proteinGrams) || proteinGrams <= 0) {
    throw new Error(`Invalid protein grams: ${proteinGrams}`);
  }
  const trimmed = name.trim() || 'Custom';
  return {
    id: `food-${now.getTime()}-custom`,
    loggedAt: now.toISOString(),
    name: trimmed,
    proteinGrams: Math.round(proteinGrams),
    preset: false,
  };
}

/**
 * Sums protein grams from all entries logged on the same calendar day as `now`.
 * "Same calendar day" uses local time — midnight rollover resets the gauge.
 */
export function totalProteinForDay(foods: FoodEntry[], now: Date): number {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  let sum = 0;
  for (const f of foods) {
    const t = new Date(f.loggedAt).getTime();
    if (t >= startMs && t < endMs) sum += f.proteinGrams;
  }
  return sum;
}

/**
 * Returns entries logged on the same calendar day as `now`, newest first.
 * Used by the "Today" section of the food log screen.
 */
export function entriesForDay(foods: FoodEntry[], now: Date): FoodEntry[] {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return foods
    .filter((f) => {
      const t = new Date(f.loggedAt).getTime();
      return t >= startMs && t < endMs;
    })
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
}
