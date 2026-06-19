import { EMPTY_DB, type ShotdayDb } from '../types/domain';
import { buildProgressChecklist } from './progressChecklist';
import { defaultMetrics } from './sideEffects';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('buildProgressChecklist', () => {
  it('guides a new/low-data user to medication setup first', () => {
    const out = buildProgressChecklist(db(), new Date('2026-06-19T09:00:00'));
    expect(out.complete).toBe(false);
    expect(out.completedCount).toBe(0);
    expect(out.nextAction).toBe('DOSE');
    expect(out.items.map((item) => item.completed)).toEqual([false, false, false, false]);
  });

  it('uses the current shot cycle for shot, weight, and symptoms', () => {
    const out = buildProgressChecklist(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          shotDay: 'MONDAY',
        },
        injections: [
          { id: 'i1', takenAt: '2026-06-15T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
        ],
        weightEntries: [
          { id: 'old', loggedAt: '2026-06-10T08:00:00', weight: 205, unit: 'LB' },
        ],
      }),
      new Date('2026-06-19T09:00:00'),
    );
    expect(out.completedCount).toBe(2);
    expect(out.nextAction).toBe('WEIGHT');
    expect(out.items.map((item) => [item.id, item.completed])).toEqual([
      ['MEDICATION', true],
      ['SHOT', true],
      ['WEIGHT', false],
      ['SYMPTOMS', false],
    ]);
  });

  it('points to symptoms after medication, shot, and weight are complete', () => {
    const out = buildProgressChecklist(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          shotDay: 'MONDAY',
        },
        injections: [
          { id: 'i1', takenAt: '2026-06-15T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
        ],
        weightEntries: [
          { id: 'w1', loggedAt: '2026-06-16T08:00:00', weight: 205, unit: 'LB' },
        ],
      }),
      new Date('2026-06-19T09:00:00'),
    );
    expect(out.completedCount).toBe(3);
    expect(out.nextAction).toBe('SYMPTOMS');
  });

  it('marks complete when all current-cycle basics exist', () => {
    const out = buildProgressChecklist(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0.5,
          currentDoseLabel: '0.5 mg',
          shotDay: 'MONDAY',
        },
        injections: [
          { id: 'i1', takenAt: '2026-06-15T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
        ],
        weightEntries: [
          { id: 'w1', loggedAt: '2026-06-16T08:00:00', weight: 205, unit: 'LB' },
        ],
        sideEffects: [
          {
            id: 's1',
            loggedAt: '2026-06-17T20:00:00',
            dayAfterShot: 2,
            metrics: defaultMetrics(),
            chips: [],
            customSymptoms: [],
            doseMg: 0.5,
          },
        ],
      }),
      new Date('2026-06-19T09:00:00'),
    );
    expect(out.complete).toBe(true);
    expect(out.nextAction).toBe('DONE');
    expect(out.headline).toBe('Weekly progress is ready');
  });
});
