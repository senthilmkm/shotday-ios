import { buildWeeklyRewardSummary } from './weeklyReward';
import { defaultMetrics } from './sideEffects';
import { EMPTY_DB, type ShotdayDb } from '../types/domain';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('weekly reward summary', () => {
  it('scores completed weekly basics without giving false credit', () => {
    const out = buildWeeklyRewardSummary(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY', weight: 200, weightUnit: 'LB' },
        injections: [{ id: 'shot', takenAt: '2026-06-16T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
        weightEntries: [{ id: 'w', loggedAt: '2026-06-16T10:00:00', weight: 200, unit: 'LB' }],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.scoreCompleted).toBe(2);
    expect(out.items).toEqual([
      { id: 'SHOT', label: 'Shot', complete: true },
      { id: 'WEIGHT', label: 'Weight', complete: true },
      { id: 'SYMPTOMS', label: 'Symptoms', complete: false },
      { id: 'PROTEIN', label: 'Protein', complete: false },
    ]);
    expect(out.focusDetail).toContain('symptoms');
  });

  it('shows better-than-last-week when symptoms improve', () => {
    const high = { ...defaultMetrics(), NAUSEA: 4 };
    const low = { ...defaultMetrics(), NAUSEA: 2 };
    const out = buildWeeklyRewardSummary(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY', weight: 200, weightUnit: 'LB' },
        sideEffects: [
          { id: 'prev', loggedAt: '2026-06-10T18:00:00', dayAfterShot: 1, metrics: high, chips: [], customSymptoms: [], doseMg: 0.5 },
          { id: 'cur', loggedAt: '2026-06-17T18:00:00', dayAfterShot: 1, metrics: low, chips: [], customSymptoms: [], doseMg: 0.5 },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.comparisonTitle).toBe('Better than last week');
    expect(out.comparisonCallout).toBe('50% lower symptom load');
  });

  it('builds 8-week rhythm rows for shot, weight, and symptoms', () => {
    const out = buildWeeklyRewardSummary(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY', weight: 200, weightUnit: 'LB' },
        injections: [
          { id: 'old', takenAt: '2026-06-09T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
          { id: 'cur', takenAt: '2026-06-16T09:00:00', zone: 'BELLY_UR', doseMg: 0.5 },
        ],
        weightEntries: [{ id: 'w', loggedAt: '2026-06-16T10:00:00', weight: 200, unit: 'LB' }],
        sideEffects: [{ id: 's', loggedAt: '2026-06-17T18:00:00', dayAfterShot: 1, metrics: defaultMetrics(), chips: [], customSymptoms: [], doseMg: 0.5 }],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.rhythm.shot).toHaveLength(8);
    expect(out.rhythm.weight).toHaveLength(8);
    expect(out.rhythm.symptoms).toHaveLength(8);
    expect(out.rhythm.shot.at(-1)).toBe(true);
    expect(out.rhythm.weight.at(-1)).toBe(true);
    expect(out.rhythm.symptoms.at(-1)).toBe(true);
  });

  it('counts protein score when a current-cycle protein log exists today', () => {
    const out = buildWeeklyRewardSummary(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'FRIDAY', weight: 200, weightUnit: 'LB' },
        injections: [{ id: 'shot', takenAt: '2026-06-19T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
        weightEntries: [{ id: 'w', loggedAt: '2026-06-19T10:00:00', weight: 200, unit: 'LB' }],
        sideEffects: [{ id: 's', loggedAt: '2026-06-19T12:00:00', dayAfterShot: 1, metrics: defaultMetrics(), chips: [], customSymptoms: [], doseMg: 0.5 }],
        foods: [{ id: 'food', loggedAt: '2026-06-19T13:00:00', name: 'Shake', proteinGrams: 25, preset: true }],
      }),
      new Date('2026-06-19T14:00:00'),
    );

    expect(out.items.find((item) => item.id === 'PROTEIN')?.complete).toBe(true);
    expect(out.scoreCompleted).toBe(4);
  });

  it('uses matching current shot-cycle windows across all rhythm rows', () => {
    const out = buildWeeklyRewardSummary(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'FRIDAY', weight: 200, weightUnit: 'LB' },
        injections: [{ id: 'shot', takenAt: '2026-06-19T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
        weightEntries: [{ id: 'w', loggedAt: '2026-06-19T10:00:00', weight: 200, unit: 'LB' }],
        sideEffects: [{ id: 's', loggedAt: '2026-06-19T12:00:00', dayAfterShot: 1, metrics: defaultMetrics(), chips: [], customSymptoms: [], doseMg: 0.5 }],
      }),
      new Date('2026-06-19T14:00:00'),
    );

    expect(out.rhythm.shot.at(-1)).toBe(true);
    expect(out.rhythm.weight.at(-1)).toBe(true);
    expect(out.rhythm.symptoms.at(-1)).toBe(true);
  });
});
