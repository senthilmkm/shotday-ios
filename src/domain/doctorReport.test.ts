import { EMPTY_DB, type ShotdayDb } from '../types/domain';
import {
  buildDoctorReport,
  buildDoctorReportText,
  missedLateShots,
  sideEffectsByWeek,
} from './doctorReport';
import { defaultMetrics } from './sideEffects';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('missedLateShots', () => {
  it('detects late and missed weekly shots from existing injection history', () => {
    const out = missedLateShots(
      [
        { id: 'a', takenAt: '2026-06-01T09:00:00Z', zone: 'BELLY_UL', doseMg: 0.5 },
        { id: 'b', takenAt: '2026-06-10T09:00:00Z', zone: 'BELLY_UR', doseMg: 0.5 },
      ],
      'MONDAY',
      new Date('2026-06-20T09:00:00Z'),
      30,
    );
    expect(out.map((x) => x.status)).toEqual(['LATE', 'MISSED']);
    expect(out[0]?.daysLate).toBe(2);
  });

  it('does not invent missed shots before the first logged injection', () => {
    const out = missedLateShots(
      [{ id: 'a', takenAt: '2026-06-15T09:00:00Z', zone: 'BELLY_UL', doseMg: 0.5 }],
      'MONDAY',
      new Date('2026-06-20T09:00:00Z'),
      90,
    );
    expect(out).toEqual([]);
  });
});

describe('sideEffectsByWeek', () => {
  it('groups side-effect peaks by week', () => {
    const metrics = { ...defaultMetrics(), NAUSEA: 4, ANXIETY: 2 };
    const out = sideEffectsByWeek(
      [
        {
          id: 's1',
          loggedAt: '2026-06-10T20:00:00Z',
          dayAfterShot: 2,
          metrics,
          chips: [],
          customSymptoms: [],
          doseMg: 0.5,
        },
      ],
      new Date('2026-06-20T09:00:00Z'),
      30,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.checkIns).toBe(1);
    expect(out[0]?.averagePeak).toBe(4);
    expect(out[0]?.maxPeak).toBe(4);
  });
});

describe('buildDoctorReport', () => {
  it('includes all doctor-report sections and notes', () => {
    const report = buildDoctorReport(
      db({
        profile: {
          ...EMPTY_DB.profile,
          drug: 'WEGOVY',
          currentDoseMg: 1,
          currentDoseLabel: '1.0 mg',
          weight: 200,
          weightUnit: 'LB',
          shotDay: 'MONDAY',
        },
        injections: [
          { id: 'inj1', takenAt: '2026-06-01T09:00:00Z', zone: 'BELLY_UL', doseMg: 1 },
        ],
        foods: [
          { id: 'food1', loggedAt: '2026-06-19T12:00:00Z', name: 'Chicken', proteinGrams: 140, preset: true },
        ],
        weightEntries: [
          { id: 'w1', loggedAt: '2026-06-01T08:00:00Z', weight: 205, unit: 'LB' },
          { id: 'w2', loggedAt: '2026-06-15T08:00:00Z', weight: 200, unit: 'LB' },
        ],
        refillHistory: [
          { id: 'r1', type: 'PICKED_UP', loggedAt: '2026-06-02T10:00:00Z', dosesPerPen: 4 },
        ],
      }),
      new Date('2026-06-20T09:00:00Z'),
      'Ask about nausea and dose increase.',
      30,
    );

    expect(report.currentMedication).toEqual({
      drug: 'WEGOVY',
      doseLabel: '1.0 mg',
      doseMg: 1,
    });
    expect(report.injectionHistory).toHaveLength(1);
    expect(report.missedLateShots.length).toBeGreaterThan(0);
    expect(report.sideEffectsByWeek).toEqual([]);
    expect(report.weightTrend.change).toBe(-5);
    expect(report.weightMilestone).toEqual({
      totalLost: 5,
      nextMilestone: 10,
      remainingToNext: 5,
      unit: 'LB',
    });
    expect(report.proteinTrend.targetG).toBe(140);
    expect(report.refillHistory).toHaveLength(1);
    expect(report.notesForDoctor).toBe('Ask about nausea and dose increase.');
  });

  it('handles missing optional data gracefully', () => {
    const report = buildDoctorReport(db(), new Date('2026-06-20T09:00:00Z'));
    expect(report.currentMedication.doseLabel).toBe('');
    expect(report.injectionHistory).toEqual([]);
    expect(report.missedLateShots).toEqual([]);
    expect(report.weightTrend.points).toEqual([]);
    expect(report.weightTrend.change).toBeNull();
    expect(report.weightMilestone).toBeNull();
    expect(report.proteinTrend.targetG).toBeNull();
    expect(report.refillHistory).toEqual([]);
    expect(report.notesForDoctor).toBe('');
  });
});

describe('buildDoctorReportText', () => {
  it('formats a shareable report with all major sections', () => {
    const report = buildDoctorReport(
      db({
        profile: {
          ...EMPTY_DB.profile,
          drug: 'OZEMPIC',
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          weight: 200,
          weightUnit: 'LB',
          shotDay: 'MONDAY',
        },
        injections: [
          { id: 'inj1', takenAt: '2026-06-01T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
        ],
        foods: [
          { id: 'food1', loggedAt: '2026-06-19T12:00:00', name: 'Chicken', proteinGrams: 140, preset: true },
        ],
        weightEntries: [
          { id: 'w1', loggedAt: '2026-06-01T08:00:00', weight: 205, unit: 'LB' },
          { id: 'w2', loggedAt: '2026-06-15T08:00:00', weight: 200, unit: 'LB' },
        ],
        refillHistory: [
          { id: 'r1', type: 'PICKED_UP', loggedAt: '2026-06-02T10:00:00', dosesPerPen: 4 },
        ],
      }),
      new Date('2026-06-20T09:00:00'),
      'Should I increase dose next month?',
      30,
    );

    const text = buildDoctorReportText(report);
    expect(text).toContain('Shotday Doctor Visit Report');
    expect(text).toContain('Current medication');
    expect(text).toContain('Injection history');
    expect(text).toContain('Missed / late shots');
    expect(text).toContain('Side effects by week');
    expect(text).toContain('Weight trend');
    expect(text).toContain('Protein trend');
    expect(text).toContain('Refill history');
    expect(text).toContain('Notes for doctor visit');
    expect(text).toContain('Should I increase dose next month?');
    expect(text).toContain('Change: -5 LB');
    expect(text).toContain('Milestone: down 5 LB since starting; 5 LB to 10 LB lost.');
  });

  it('uses friendly empty-state lines when sections have no data', () => {
    const text = buildDoctorReportText(buildDoctorReport(db(), new Date('2026-06-20T09:00:00')));
    expect(text).toContain('No injections logged in this report window.');
    expect(text).toContain('No weight history logged yet.');
    expect(text).toContain('No refill events logged in this report window.');
    expect(text).toContain('No notes entered.');
  });
});
