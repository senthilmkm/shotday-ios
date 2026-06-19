import { EMPTY_DB, type ShotdayDb } from '../types/domain';
import {
  latestWeightEntry,
  weightChangeSummary,
  weightMilestoneSummary,
  weightSeries,
} from './weight';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

describe('weight history helpers', () => {
  it('returns the latest weight entry by loggedAt', () => {
    const out = latestWeightEntry(
      db({
        weightEntries: [
          { id: 'old', loggedAt: '2026-06-01T09:00:00Z', weight: 210, unit: 'LB' },
          { id: 'new', loggedAt: '2026-06-08T09:00:00Z', weight: 205, unit: 'LB' },
        ],
      }),
    );
    expect(out?.id).toBe('new');
  });

  it('builds a bounded series and converts units', () => {
    const out = weightSeries(
      db({
        profile: { ...EMPTY_DB.profile, weightUnit: 'LB' },
        weightEntries: [
          { id: 'outside', loggedAt: '2026-01-01T09:00:00Z', weight: 100, unit: 'KG' },
          { id: 'inside', loggedAt: '2026-06-08T09:00:00Z', weight: 100, unit: 'KG' },
        ],
      }),
      30,
      new Date('2026-06-15T09:00:00Z'),
      'LB',
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.weight).toBe(220.5);
    expect(out[0]?.unit).toBe('LB');
  });

  it('summarizes weight change in the requested unit', () => {
    const out = weightChangeSummary(
      db({
        profile: { ...EMPTY_DB.profile, weightUnit: 'LB' },
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-01T09:00:00Z', weight: 210, unit: 'LB' },
          { id: 'b', loggedAt: '2026-06-15T09:00:00Z', weight: 203.5, unit: 'LB' },
        ],
      }),
      new Date('2026-06-15T12:00:00Z'),
      30,
    );
    expect(out?.change).toBe(-6.5);
  });

  it('returns null change summary with fewer than two points', () => {
    const out = weightChangeSummary(
      db({
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-01T09:00:00Z', weight: 210, unit: 'LB' },
        ],
      }),
      new Date('2026-06-15T12:00:00Z'),
    );
    expect(out).toBeNull();
  });
});

describe('weight milestones', () => {
  it('requires at least two weight entries', () => {
    const out = weightMilestoneSummary(
      db({
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-01T09:00:00', weight: 210, unit: 'LB' },
        ],
      }),
      new Date('2026-06-15T12:00:00'),
    );
    expect(out.status).toBe('INSUFFICIENT_DATA');
    expect(out.totalLost).toBeNull();
  });

  it('does not show active milestones when weight is up or unchanged', () => {
    const out = weightMilestoneSummary(
      db({
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-01T09:00:00', weight: 210, unit: 'LB' },
          { id: 'b', loggedAt: '2026-06-15T09:00:00', weight: 211, unit: 'LB' },
        ],
      }),
      new Date('2026-06-15T12:00:00'),
    );
    expect(out.status).toBe('NO_LOSS');
    expect(out.totalLost).toBe(-1);
  });

  it('calculates lb milestones and remaining amount', () => {
    const out = weightMilestoneSummary(
      db({
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-01T09:00:00', weight: 214, unit: 'LB' },
          { id: 'b', loggedAt: '2026-06-15T09:00:00', weight: 205.3, unit: 'LB' },
        ],
      }),
      new Date('2026-06-15T12:00:00'),
    );
    expect(out.status).toBe('ACTIVE');
    expect(out.totalLost).toBe(8.7);
    expect(out.lastReached).toBe(5);
    expect(out.nextMilestone).toBe(10);
    expect(out.remainingToNext).toBe(1.3);
  });

  it('uses kg milestones when the active unit is metric', () => {
    const out = weightMilestoneSummary(
      db({
        profile: { ...EMPTY_DB.profile, weightUnit: 'KG' },
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-01T09:00:00', weight: 100, unit: 'KG' },
          { id: 'b', loggedAt: '2026-06-15T09:00:00', weight: 94.4, unit: 'KG' },
        ],
      }),
      new Date('2026-06-15T12:00:00'),
    );
    expect(out.status).toBe('ACTIVE');
    expect(out.totalLost).toBe(5.6);
    expect(out.lastReached).toBe(5);
    expect(out.nextMilestone).toBe(7.5);
    expect(out.remainingToNext).toBe(1.9);
  });

  it('ignores future-dated weights', () => {
    const out = weightMilestoneSummary(
      db({
        weightEntries: [
          { id: 'a', loggedAt: '2026-06-01T09:00:00', weight: 214, unit: 'LB' },
          { id: 'future', loggedAt: '2026-07-01T09:00:00', weight: 180, unit: 'LB' },
        ],
      }),
      new Date('2026-06-15T12:00:00'),
    );
    expect(out.status).toBe('INSUFFICIENT_DATA');
  });
});
