import {
  calculateActiveLevelAt,
  generateMedicationCurve,
  singleDoseLevel,
  simulateTitration,
  summarizeActiveLevel,
} from './medicationLevel';
import type { Injection } from '../types/domain';

describe('medicationLevel domain', () => {
  describe('singleDoseLevel', () => {
    it('returns 0 for negative time or 0 dose', () => {
      expect(singleDoseLevel(5.0, -10, 120)).toBe(0);
      expect(singleDoseLevel(0, 24, 120)).toBe(0);
    });

    it('models absorption rise and elimination decay properly', () => {
      const dose = 5.0;
      const halfLife = 120; // Tirzepatide (5 days)

      const at1h = singleDoseLevel(dose, 1, halfLife);
      const at24h = singleDoseLevel(dose, 24, halfLife);
      const at36h = singleDoseLevel(dose, 36, halfLife);
      const at120h = singleDoseLevel(dose, 120, halfLife);
      const at240h = singleDoseLevel(dose, 240, halfLife);

      // Level should rise from 1h to peak around 24-36h
      expect(at24h).toBeGreaterThan(at1h);
      // Level should taper down significantly by 120h (1 half-life after peak)
      expect(at120h).toBeLessThan(at24h);
      // Level at 240h should be roughly half of level at 120h
      expect(at240h).toBeLessThan(at120h);
    });
  });

  describe('calculateActiveLevelAt with superposition', () => {
    it('returns 0 when no injections logged', () => {
      expect(calculateActiveLevelAt([], 'ZEPBOUND', new Date())).toBe(0);
    });

    it('sums multiple weekly injections correctly for drug accumulation', () => {
      const now = new Date('2026-08-20T12:00:00Z');
      const week1 = new Date('2026-08-06T12:00:00Z'); // 14 days ago
      const week2 = new Date('2026-08-13T12:00:00Z'); // 7 days ago
      const week3 = new Date('2026-08-20T10:00:00Z'); // 2 hours ago

      const injections: Injection[] = [
        { id: '1', takenAt: week1.toISOString(), zone: 'BELLY_UL', doseMg: 2.5 },
        { id: '2', takenAt: week2.toISOString(), zone: 'BELLY_UR', doseMg: 2.5 },
        { id: '3', takenAt: week3.toISOString(), zone: 'THIGH_L', doseMg: 2.5 },
      ];

      const activeTotal = calculateActiveLevelAt(injections, 'ZEPBOUND', now);
      // Level should be non-zero and higher than just a single fresh shot's 2h level
      const singleShot2h = singleDoseLevel(2.5, 2, 120);
      expect(activeTotal).toBeGreaterThan(singleShot2h);
    });
  });

  describe('summarizeActiveLevel', () => {
    it('handles empty injections gracefully', () => {
      const summary = summarizeActiveLevel([], 'OZEMPIC', new Date());
      expect(summary.phase).toBe('NO_DATA');
      expect(summary.currentActiveMg).toBe(0);
      expect(summary.daysSinceLastShot).toBeNull();
    });

    it('identifies INITIAL_ABSORPTION in first 24h', () => {
      const now = new Date('2026-08-20T18:00:00Z');
      const shot = new Date('2026-08-20T12:00:00Z'); // 6 hours ago
      const injections: Injection[] = [
        { id: '1', takenAt: shot.toISOString(), zone: 'BELLY_UL', doseMg: 5.0 },
      ];

      const summary = summarizeActiveLevel(injections, 'ZEPBOUND', now);
      expect(summary.phase).toBe('INITIAL_ABSORPTION');
      expect(summary.headline).toContain('Absorbing');
    });

    it('identifies PEAK_CONCENTRATION around 24-48h', () => {
      const now = new Date('2026-08-21T12:00:00Z');
      const shot = new Date('2026-08-20T12:00:00Z'); // 24 hours ago
      const injections: Injection[] = [
        { id: '1', takenAt: shot.toISOString(), zone: 'BELLY_UL', doseMg: 5.0 },
      ];

      const summary = summarizeActiveLevel(injections, 'ZEPBOUND', now);
      expect(summary.phase).toBe('PEAK_CONCENTRATION');
      expect(summary.headline).toContain('Peak');
    });

    it('identifies TROUGH_FOOD_NOISE around day 6', () => {
      const now = new Date('2026-08-26T12:00:00Z');
      const shot = new Date('2026-08-20T12:00:00Z'); // 6 days ago (144h)
      const injections: Injection[] = [
        { id: '1', takenAt: shot.toISOString(), zone: 'BELLY_UL', doseMg: 5.0 },
      ];

      const summary = summarizeActiveLevel(injections, 'ZEPBOUND', now);
      expect(summary.phase).toBe('TROUGH_FOOD_NOISE');
      expect(summary.insight).toContain('food noise');
    });

    it('identifies OVERDUE after >8 days', () => {
      const now = new Date('2026-08-30T12:00:00Z');
      const shot = new Date('2026-08-20T12:00:00Z'); // 10 days ago
      const injections: Injection[] = [
        { id: '1', takenAt: shot.toISOString(), zone: 'BELLY_UL', doseMg: 5.0 },
      ];

      const summary = summarizeActiveLevel(injections, 'ZEPBOUND', now);
      expect(summary.phase).toBe('OVERDUE');
      expect(summary.headline).toContain('Overdue');
    });
  });

  describe('generateMedicationCurve', () => {
    it('generates points with activeMg across the timeframe', () => {
      const start = new Date('2026-08-10T00:00:00Z');
      const end = new Date('2026-08-24T00:00:00Z');
      const shot = new Date('2026-08-10T12:00:00Z');
      const injections: Injection[] = [
        { id: '1', takenAt: shot.toISOString(), zone: 'BELLY_UL', doseMg: 2.5 },
      ];

      const curve = generateMedicationCurve(injections, 'WEGOVY', start, end, 12);
      expect(curve.length).toBeGreaterThan(10);
      expect(curve[0]!.activeMg).toBeDefined();
    });
  });

  describe('simulateTitration', () => {
    it('generates comparison curves and steady state projections', () => {
      const now = new Date('2026-08-20T12:00:00Z');
      const injections: Injection[] = [
        { id: '1', takenAt: new Date('2026-08-13T12:00:00Z').toISOString(), zone: 'BELLY_UL', doseMg: 2.5 },
      ];

      const sim = simulateTitration(injections, 'ZEPBOUND', 2.5, 5.0, 4, now);
      expect(sim.currentDoseCurve.length).toBeGreaterThan(0);
      expect(sim.titrationCurve.length).toBeGreaterThan(0);
      expect(sim.steadyStateTitrationMg).toBeGreaterThan(sim.steadyStateCurrentMg);
    });
  });
});
