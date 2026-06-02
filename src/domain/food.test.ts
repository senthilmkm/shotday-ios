import type { FoodEntry } from '../types/domain';
import {
  FOOD_PRESETS,
  buildCustomEntry,
  buildPresetEntry,
  entriesForDay,
  totalProteinForDay,
} from './food';

describe('FOOD_PRESETS', () => {
  it('has 8 tiles for the 2x4 grid', () => {
    expect(FOOD_PRESETS).toHaveLength(8);
  });

  it('has unique IDs', () => {
    const ids = FOOD_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has a positive protein gram count', () => {
    for (const p of FOOD_PRESETS) {
      expect(p.proteinGrams).toBeGreaterThan(0);
    }
  });
});

describe('buildPresetEntry', () => {
  it('marks the entry as preset and copies grams from the tile', () => {
    const preset = FOOD_PRESETS[0]!;
    const entry = buildPresetEntry(preset, new Date(2026, 5, 1, 12, 0));
    expect(entry.preset).toBe(true);
    expect(entry.proteinGrams).toBe(preset.proteinGrams);
    expect(entry.name).toBe(preset.name);
  });

  it('produces unique-enough IDs across rapid taps', () => {
    const preset = FOOD_PRESETS[0]!;
    const a = buildPresetEntry(preset, new Date(2026, 5, 1, 12, 0, 0, 0));
    const b = buildPresetEntry(preset, new Date(2026, 5, 1, 12, 0, 0, 1));
    expect(a.id).not.toBe(b.id);
  });
});

describe('buildCustomEntry', () => {
  it('rounds grams to whole numbers', () => {
    const entry = buildCustomEntry('Smoothie', 27.6, new Date(2026, 5, 1));
    expect(entry.proteinGrams).toBe(28);
  });

  it('falls back to "Custom" when name is empty/whitespace', () => {
    const entry = buildCustomEntry('   ', 20, new Date(2026, 5, 1));
    expect(entry.name).toBe('Custom');
  });

  it('throws for non-positive or non-finite grams', () => {
    expect(() => buildCustomEntry('x', 0, new Date())).toThrow();
    expect(() => buildCustomEntry('x', -5, new Date())).toThrow();
    expect(() => buildCustomEntry('x', Number.NaN, new Date())).toThrow();
  });

  it('marks the entry as preset:false', () => {
    const entry = buildCustomEntry('Smoothie', 25, new Date(2026, 5, 1));
    expect(entry.preset).toBe(false);
  });
});

describe('totalProteinForDay', () => {
  function entry(loggedAt: string, g: number): FoodEntry {
    return { id: loggedAt, loggedAt, name: 'X', proteinGrams: g, preset: false };
  }

  it('sums entries on the same calendar day in local time', () => {
    const now = new Date(2026, 5, 1, 18, 0); // June 1, 6 PM local
    const entries: FoodEntry[] = [
      entry(new Date(2026, 5, 1, 7, 30).toISOString(), 23),
      entry(new Date(2026, 5, 1, 12, 30).toISOString(), 35),
      entry(new Date(2026, 5, 1, 19, 0).toISOString(), 12),
    ];
    expect(totalProteinForDay(entries, now)).toBe(70);
  });

  it('excludes entries from yesterday', () => {
    const now = new Date(2026, 5, 1, 9, 0);
    const entries: FoodEntry[] = [
      entry(new Date(2026, 4, 31, 22, 0).toISOString(), 50),
      entry(new Date(2026, 5, 1, 8, 0).toISOString(), 23),
    ];
    expect(totalProteinForDay(entries, now)).toBe(23);
  });

  it('excludes entries from tomorrow', () => {
    const now = new Date(2026, 5, 1, 23, 0);
    const entries: FoodEntry[] = [
      entry(new Date(2026, 5, 2, 1, 0).toISOString(), 50),
      entry(new Date(2026, 5, 1, 8, 0).toISOString(), 23),
    ];
    expect(totalProteinForDay(entries, now)).toBe(23);
  });

  it('returns 0 with no entries', () => {
    expect(totalProteinForDay([], new Date())).toBe(0);
  });
});

describe('entriesForDay', () => {
  function entry(loggedAt: string, name: string): FoodEntry {
    return { id: loggedAt, loggedAt, name, proteinGrams: 20, preset: false };
  }

  it('sorts newest first', () => {
    const now = new Date(2026, 5, 1, 18, 0);
    const entries: FoodEntry[] = [
      entry(new Date(2026, 5, 1, 7, 30).toISOString(), 'breakfast'),
      entry(new Date(2026, 5, 1, 12, 30).toISOString(), 'lunch'),
      entry(new Date(2026, 5, 1, 19, 0).toISOString(), 'dinner'),
    ];
    const result = entriesForDay(entries, now);
    expect(result.map((e) => e.name)).toEqual(['dinner', 'lunch', 'breakfast']);
  });

  it('excludes entries from outside today', () => {
    const now = new Date(2026, 5, 1, 18, 0);
    const entries: FoodEntry[] = [
      entry(new Date(2026, 4, 31, 22, 0).toISOString(), 'yesterday'),
      entry(new Date(2026, 5, 1, 12, 30).toISOString(), 'today'),
      entry(new Date(2026, 5, 2, 1, 0).toISOString(), 'tomorrow'),
    ];
    const result = entriesForDay(entries, now);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('today');
  });
});
