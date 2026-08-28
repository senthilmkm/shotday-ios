import {
  buildWaterEntry,
  entriesForDay,
  MAX_WATER_ML,
  MAX_WATER_OZ,
  MIN_WATER_ML,
  MIN_WATER_OZ,
  mlToOz,
  ozToMl,
  shouldShowWaterEveningNudge,
  totalWaterForDay,
  WATER_PRESETS,
  waterProgress,
  waterTargetMl,
  waterTargetOz,
} from './water';
import type { WaterEntry } from '../types/domain';

describe('water domain logic', () => {
  describe('conversions (ozToMl and mlToOz)', () => {
    it('converts oz to ml correctly', () => {
      expect(ozToMl(8)).toBe(237); // ~236.588 -> 237
      expect(ozToMl(16)).toBe(473);
      expect(ozToMl(24)).toBe(710);
      expect(ozToMl(32)).toBe(946);
      expect(ozToMl(0)).toBe(0);
      expect(ozToMl(-5)).toBe(0);
      expect(ozToMl(NaN)).toBe(0);
    });

    it('converts ml to oz correctly', () => {
      expect(mlToOz(250)).toBe(8.5);
      expect(mlToOz(500)).toBe(16.9);
      expect(mlToOz(1000)).toBe(33.8);
      expect(mlToOz(0)).toBe(0);
      expect(mlToOz(-100)).toBe(0);
      expect(mlToOz(NaN)).toBe(0);
    });
  });

  describe('waterTargetOz and waterTargetMl', () => {
    it('returns minimum 64 oz when weight is 0 or unconfigured', () => {
      expect(waterTargetOz(0, 'LB')).toBe(MIN_WATER_OZ);
      expect(waterTargetOz(-10, 'LB')).toBe(MIN_WATER_OZ);
      expect(waterTargetOz(NaN, 'LB')).toBe(MIN_WATER_OZ);
      expect(waterTargetMl(0, 'KG')).toBe(MIN_WATER_ML);
      expect(waterTargetMl(-10, 'KG')).toBe(MIN_WATER_ML);
    });

    it('computes 0.5 oz per lb and clamps within bounds', () => {
      // 100 lb -> 50 oz -> clamped to min 64 oz
      expect(waterTargetOz(100, 'LB')).toBe(64);

      // 180 lb -> 90 oz
      expect(waterTargetOz(180, 'LB')).toBe(90);

      // 220 lb -> 110 oz
      expect(waterTargetOz(220, 'LB')).toBe(110);

      // 300 lb -> 150 oz -> clamped to max 128 oz
      expect(waterTargetOz(300, 'LB')).toBe(MAX_WATER_OZ);
    });

    it('computes target correctly for KG weight', () => {
      // 80 kg * 2.20462 = 176.37 lb -> 88.18 oz -> 88 oz
      expect(waterTargetOz(80, 'KG')).toBe(88);
      expect(waterTargetMl(80, 'KG')).toBe(ozToMl(88));

      // 50 kg -> ~110 lb -> 55 oz -> clamped to min 64 oz
      expect(waterTargetOz(50, 'KG')).toBe(64);

      // 150 kg -> ~330 lb -> clamped to max 128 oz
      expect(waterTargetOz(150, 'KG')).toBe(MAX_WATER_OZ);
    });
  });

  describe('WATER_PRESETS', () => {
    it('provides standard presets with icons and sizes', () => {
      expect(WATER_PRESETS.length).toBe(4);
      expect(WATER_PRESETS.map((p) => p.amountOz)).toEqual([8, 16, 24, 32]);
      expect(WATER_PRESETS[0]?.name).toBe('Glass');
      expect(WATER_PRESETS[1]?.name).toBe('Bottle');
      expect(WATER_PRESETS[2]?.name).toBe('Tumbler');
      expect(WATER_PRESETS[3]?.name).toBe('Flask');
    });
  });

  describe('buildWaterEntry', () => {
    it('creates a valid WaterEntry with timestamp and label', () => {
      const date = new Date('2026-08-28T14:30:00Z');
      const entry = buildWaterEntry(16, 'Bottle (16 oz)', date);

      expect(entry.id).toMatch(/^water-\d+-[a-z0-9]+$/);
      expect(entry.loggedAt).toBe(date.toISOString());
      expect(entry.amountOz).toBe(16);
      expect(entry.label).toBe('Bottle (16 oz)');
    });

    it('handles empty or undefined label', () => {
      const entry = buildWaterEntry(8, '   ');
      expect(entry.amountOz).toBe(8);
      expect(entry.label).toBeUndefined();
    });

    it('throws on invalid or non-positive amount', () => {
      expect(() => buildWaterEntry(0)).toThrow('Invalid water amount: 0 oz');
      expect(() => buildWaterEntry(-5)).toThrow('Invalid water amount: -5 oz');
      expect(() => buildWaterEntry(NaN)).toThrow('Invalid water amount: NaN oz');
    });
  });

  describe('entriesForDay and totalWaterForDay', () => {
    const today = new Date('2026-08-28T12:00:00');
    const yesterday = new Date('2026-08-27T12:00:00');

    const entries: WaterEntry[] = [
      { id: '1', loggedAt: '2026-08-28T09:00:00', amountOz: 8, label: 'Glass' },
      { id: '2', loggedAt: '2026-08-28T13:00:00', amountOz: 16, label: 'Bottle' },
      { id: '3', loggedAt: '2026-08-28T18:00:00', amountOz: 24, label: 'Tumbler' },
      { id: '4', loggedAt: '2026-08-27T10:00:00', amountOz: 16, label: 'Yesterday bottle' },
    ];

    it('filters entries belonging to target day', () => {
      const dayEntries = entriesForDay(entries, today);
      expect(dayEntries.length).toBe(3);
      expect(dayEntries.map((e) => e.id)).toEqual(['1', '2', '3']);

      const yesterdayEntries = entriesForDay(entries, yesterday);
      expect(yesterdayEntries.length).toBe(1);
      expect(yesterdayEntries[0]?.id).toBe('4');
    });

    it('computes total oz and ml for day', () => {
      const total = totalWaterForDay(entries, today);
      expect(total.oz).toBe(48); // 8 + 16 + 24
      expect(total.ml).toBe(ozToMl(48));

      const emptyTotal = totalWaterForDay([], today);
      expect(emptyTotal.oz).toBe(0);
      expect(emptyTotal.ml).toBe(0);
    });
  });

  describe('waterProgress', () => {
    it('calculates ratio accurately', () => {
      expect(waterProgress(32, 64)).toBe(0.5);
      expect(waterProgress(64, 64)).toBe(1.0);
      expect(waterProgress(80, 64)).toBe(1.25);
      expect(waterProgress(0, 64)).toBe(0);
      expect(waterProgress(32, 0)).toBe(0);
      expect(waterProgress(32, -10)).toBe(0);
      expect(waterProgress(NaN, 64)).toBe(0);
    });
  });

  describe('shouldShowWaterEveningNudge', () => {
    it('returns false before 8 PM (20:00)', () => {
      expect(shouldShowWaterEveningNudge(20, 64, 19)).toBe(false);
      expect(shouldShowWaterEveningNudge(0, 64, 12)).toBe(false);
    });

    it('returns true at or after 8 PM if below 50% target', () => {
      expect(shouldShowWaterEveningNudge(30, 64, 20)).toBe(true);
      expect(shouldShowWaterEveningNudge(10, 64, 21)).toBe(true);
    });

    it('returns false at or after 8 PM if at or above 50% target', () => {
      expect(shouldShowWaterEveningNudge(32, 64, 20)).toBe(false);
      expect(shouldShowWaterEveningNudge(50, 64, 21)).toBe(false);
    });

    it('handles target 0 safely', () => {
      expect(shouldShowWaterEveningNudge(10, 0, 20)).toBe(false);
    });
  });
});
