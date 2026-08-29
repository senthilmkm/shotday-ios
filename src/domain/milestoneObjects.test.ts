import {
  getMilestoneObject,
  getNextMilestoneObject,
  MILESTONE_OBJECTS,
  weightMilestoneSummary,
} from './weight';
import { EMPTY_DB, type ShotdayDb, type WeightEntry } from '../types/domain';

function mockDb(entries: Partial<WeightEntry>[]): ShotdayDb {
  return {
    ...EMPTY_DB,
    profile: {
      ...EMPTY_DB.profile,
      drug: 'ZEPBOUND',
      currentDoseMg: 5,
      currentDoseLabel: '5 mg',
      shotDay: 'FRIDAY',
      weightUnit: 'LB',
    },
    weightEntries: entries.map((e, idx) => ({
      id: `w-${idx}`,
      weight: e.weight ?? 200,
      unit: e.unit ?? 'LB',
      loggedAt: e.loggedAt ?? new Date('2026-01-01').toISOString(),
      note: e.note,
    })),
  };
}

describe('Milestone Objects Engine', () => {
  it('returns null for zero or negative weight loss in LB', () => {
    expect(getMilestoneObject(0, 'LB')).toBeNull();
    expect(getMilestoneObject(-5, 'LB')).toBeNull();
  });

  it('returns null for weight loss below first threshold (4.9 lbs)', () => {
    expect(getMilestoneObject(4.9, 'LB')).toBeNull();
  });

  it('correctly returns milestone objects for LB milestones', () => {
    const obj5 = getMilestoneObject(5.0, 'LB');
    expect(obj5?.name).toBe('Bag of Potatoes');
    expect(obj5?.emoji).toBe('🥔');

    const obj25 = getMilestoneObject(26.2, 'LB');
    expect(obj25?.name).toBe('Adult Corgi');
    expect(obj25?.emoji).toBe('🐕');

    const obj100 = getMilestoneObject(105, 'LB');
    expect(obj100?.name).toBe('Heavy Punching Bag');
  });

  it('correctly returns milestone objects for KG milestones', () => {
    expect(getMilestoneObject(2.0, 'KG')).toBeNull();
    const obj2_5 = getMilestoneObject(2.5, 'KG');
    expect(obj2_5?.name).toBe('Bag of Potatoes');

    const obj12 = getMilestoneObject(12.0, 'KG');
    expect(obj12?.name).toBe('Adult Corgi');
  });

  it('correctly computes next milestone object and remaining weight', () => {
    const nextForZero = getNextMilestoneObject(0, 'LB');
    expect(nextForZero?.object.name).toBe('Bag of Potatoes');
    expect(nextForZero?.remaining).toBe(5);

    const nextFor12 = getNextMilestoneObject(12, 'LB');
    expect(nextFor12?.object.name).toBe('Bowling Ball');
    expect(nextFor12?.remaining).toBe(3);
  });

  it('integrates properly into weightMilestoneSummary', () => {
    const now = new Date('2026-03-01T00:00:00.000Z');
    const db = mockDb([
      { weight: 225, unit: 'LB', loggedAt: '2026-01-01T00:00:00.000Z' },
      { weight: 199, unit: 'LB', loggedAt: '2026-02-15T00:00:00.000Z' }, // 26 lbs lost
    ]);

    const summary = weightMilestoneSummary(db, now, 'LB');
    expect(summary.status).toBe('ACTIVE');
    expect(summary.totalLost).toBe(26);
    expect(summary.milestoneObject?.name).toBe('Adult Corgi');
    expect(summary.nextMilestoneObject?.object.name).toBe('Carry-On Luggage');
    expect(summary.nextMilestoneObject?.remaining).toBe(9); // 35 - 26 = 9
  });
});
