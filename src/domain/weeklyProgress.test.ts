import { EMPTY_DB, type ShotdayDb } from '../types/domain';
import { currentShotWindow, summarizeWeeklyProgress } from './weeklyProgress';
import { defaultMetrics } from './sideEffects';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('currentShotWindow', () => {
  it('starts on the most recent scheduled shot day', () => {
    const window = currentShotWindow('MONDAY', new Date('2026-06-19T12:00:00'));
    expect(localDate(window.start)).toBe('2026-06-15');
    expect(localDate(window.end)).toBe('2026-06-22');
  });
});

describe('summarizeWeeklyProgress', () => {
  it('shows friendly low-data messages for a new user', () => {
    const out = summarizeWeeklyProgress(
      db({ profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY' } }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.shot.status).toBe('NO_HISTORY');
    expect(out.protein.status).toBe('NO_TARGET');
    expect(out.symptoms.status).toBe('NO_DATA');
    expect(out.weight.status).toBe('NO_DATA');
    expect(out.takeaway).toContain('first shot');
  });

  it('marks a shot as on time when logged on the scheduled day', () => {
    const out = summarizeWeeklyProgress(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY' },
        injections: [
          { id: 'i1', takenAt: '2026-06-15T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.shot.status).toBe('ON_TIME');
    expect(out.shot.daysLate).toBe(0);
  });

  it('marks a shot as late when logged after the scheduled day', () => {
    const out = summarizeWeeklyProgress(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY' },
        injections: [
          { id: 'i1', takenAt: '2026-06-17T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.shot.status).toBe('LATE');
    expect(out.shot.daysLate).toBe(2);
  });

  it('counts protein hits only for completed current-cycle days', () => {
    const out = summarizeWeeklyProgress(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY', weight: 200, weightUnit: 'LB' },
        foods: [
          { id: 'mon', loggedAt: '2026-06-16T12:00:00', name: 'Chicken', proteinGrams: 140, preset: true },
          { id: 'wed', loggedAt: '2026-06-18T12:00:00', name: 'Shake', proteinGrams: 140, preset: true },
          { id: 'today', loggedAt: '2026-06-19T12:00:00', name: 'Yogurt', proteinGrams: 140, preset: true },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.protein.status).toBe('READY');
    expect(out.protein.days).toBe(4);
    expect(out.protein.hits).toBe(2);
  });

  it('compares symptom averages against the previous shot cycle', () => {
    const low = { ...defaultMetrics(), NAUSEA: 2 };
    const high = { ...defaultMetrics(), NAUSEA: 4 };
    const out = summarizeWeeklyProgress(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY' },
        sideEffects: [
          {
            id: 'prev',
            loggedAt: '2026-06-10T20:00:00',
            dayAfterShot: 1,
            metrics: high,
            chips: [],
            customSymptoms: [],
            doseMg: 0.5,
          },
          {
            id: 'cur',
            loggedAt: '2026-06-17T20:00:00',
            dayAfterShot: 1,
            metrics: low,
            chips: [],
            customSymptoms: [],
            doseMg: 0.5,
          },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.symptoms.status).toBe('DOWN');
    expect(out.symptoms.currentAverage).toBe(2);
    expect(out.symptoms.previousAverage).toBe(4);
  });

  it('shows weight change from recent weight entries', () => {
    const out = summarizeWeeklyProgress(
      db({
        profile: { ...EMPTY_DB.profile, weightUnit: 'LB' },
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-10T08:00:00', weight: 205, unit: 'LB' },
          { id: 'b', loggedAt: '2026-06-19T08:00:00', weight: 201.5, unit: 'LB' },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.weight.status).toBe('DOWN');
    expect(out.weight.change).toBe(-3.5);
    expect(out.weight.label).toBe('Weight down 3.5 LB');
    expect(out.weight.hasCurrentCycleEntry).toBe(true);
    expect(out.weight.needsCurrentCycleWeight).toBe(false);
    expect(out.weight.needsAnotherWeight).toBe(false);
  });

  it('asks for a weight when no entry exists in the current shot cycle', () => {
    const out = summarizeWeeklyProgress(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY', weightUnit: 'LB' },
        weightEntries: [
          { id: 'old', loggedAt: '2026-06-10T08:00:00', weight: 205, unit: 'LB' },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.weight.hasCurrentCycleEntry).toBe(false);
    expect(out.weight.needsCurrentCycleWeight).toBe(true);
    expect(out.weight.needsAnotherWeight).toBe(true);
  });

  it('still offers add weight when one current-cycle entry is not enough for a trend', () => {
    const out = summarizeWeeklyProgress(
      db({
        profile: { ...EMPTY_DB.profile, shotDay: 'MONDAY', weightUnit: 'LB' },
        weightEntries: [
          { id: 'current', loggedAt: '2026-06-16T08:00:00', weight: 205, unit: 'LB' },
        ],
      }),
      new Date('2026-06-19T12:00:00'),
    );

    expect(out.weight.hasCurrentCycleEntry).toBe(true);
    expect(out.weight.needsCurrentCycleWeight).toBe(false);
    expect(out.weight.needsAnotherWeight).toBe(true);
  });
});

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}
