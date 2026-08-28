import { buildCycleConcierge } from './cycleConcierge';
import { EMPTY_DB, type ShotdayDb } from '../types/domain';

function makeDb(overrides: Partial<ShotdayDb> = {}): ShotdayDb {
  return {
    ...EMPTY_DB,
    profile: {
      ...EMPTY_DB.profile,
      drug: 'OZEMPIC',
      currentDoseMg: 0.5,
      currentDoseLabel: '0.5 mg',
      weight: 180,
      weightUnit: 'LB',
      shotDay: 'SUNDAY',
      onboardingComplete: true,
    },
    ...overrides,
  };
}

describe('buildCycleConcierge', () => {
  it('returns NO_SHOTS_YET when user has 0 injections', () => {
    const db = makeDb({ injections: [] });
    const concierge = buildCycleConcierge(db, new Date('2026-08-28T12:00:00Z'));

    expect(concierge.phase).toBe('NO_SHOTS_YET');
    expect(concierge.badgeLabel).toBe('✨ GETTING STARTED');
    expect(concierge.primaryAction.type).toBe('SHOT');
  });

  it('returns SHOT_DAY_PENDING on Sunday morning with 3-step ritual before injection is logged', () => {
    // Last shot was last Sunday
    const db = makeDb({
      injections: [
        {
          id: 'inj-last-week',
          takenAt: '2026-08-16T09:00:00Z', // Previous Sunday
          zone: 'BELLY_UL',
          doseMg: 0.5,
        },
      ],
    });
    // Today is Sunday Aug 23, 2026
    const sundayMorning = new Date('2026-08-23T08:30:00Z');
    const concierge = buildCycleConcierge(db, sundayMorning);

    expect(concierge.phase).toBe('SHOT_DAY_PENDING');
    expect(concierge.badgeLabel).toBe('🎯 SHOT DAY RITUAL');
    expect(concierge.ritualSteps).toBeDefined();
    expect(concierge.ritualSteps?.length).toBe(3);
    expect(concierge.primaryAction.label).toBe('Start Shot Routine');
  });

  it('returns SHOT_DAY_COMPLETED right after logging shot today', () => {
    const today = new Date('2026-08-23T10:00:00Z');
    const db = makeDb({
      injections: [
        {
          id: 'inj-today',
          takenAt: '2026-08-23T09:00:00Z',
          zone: 'THIGH_L',
          doseMg: 0.5,
        },
      ],
    });
    const concierge = buildCycleConcierge(db, today);

    expect(concierge.phase).toBe('SHOT_DAY_COMPLETED');
    expect(concierge.badgeLabel).toBe('✅ SHOT DAY COMPLETE');
    expect(concierge.primaryAction.initialTab).toBe('WATER');
  });

  it('returns PEAK_WINDOW on Day 1 and Day 2 post-shot', () => {
    const shotTime = '2026-08-23T09:00:00Z'; // Sunday
    const db = makeDb({
      injections: [{ id: 'inj-1', takenAt: shotTime, zone: 'BELLY_UR', doseMg: 0.5 }],
    });

    // Monday (Day 1)
    const monday = new Date('2026-08-24T12:00:00Z');
    const mondayConcierge = buildCycleConcierge(db, monday);
    expect(mondayConcierge.phase).toBe('PEAK_WINDOW');
    expect(mondayConcierge.badgeLabel).toContain('DAY 1/7');
    expect(mondayConcierge.primaryAction.type).toBe('SYMPTOMS');

    // Tuesday (Day 2)
    const tuesday = new Date('2026-08-25T14:00:00Z');
    const tuesdayConcierge = buildCycleConcierge(db, tuesday);
    expect(tuesdayConcierge.phase).toBe('PEAK_WINDOW');
    expect(tuesdayConcierge.badgeLabel).toContain('DAY 2/7');
  });

  it('returns STEADY_STATE on Day 3 and Day 4 post-shot', () => {
    const shotTime = '2026-08-23T09:00:00Z'; // Sunday
    const db = makeDb({
      injections: [{ id: 'inj-1', takenAt: shotTime, zone: 'BELLY_UR', doseMg: 0.5 }],
    });

    // Wednesday (Day 3)
    const wednesday = new Date('2026-08-26T12:00:00Z');
    const wedConcierge = buildCycleConcierge(db, wednesday);
    expect(wedConcierge.phase).toBe('STEADY_STATE');
    expect(wedConcierge.badgeLabel).toContain('DAY 3/7');
    expect(wedConcierge.primaryAction.type).toBe('FOOD');

    // Thursday (Day 4)
    const thursday = new Date('2026-08-27T12:00:00Z');
    const thuConcierge = buildCycleConcierge(db, thursday);
    expect(thuConcierge.phase).toBe('STEADY_STATE');
  });

  it('returns TROUGH_APPETITE on Day 5 and Day 6 post-shot normalizing food noise', () => {
    const shotTime = '2026-08-23T09:00:00Z'; // Sunday
    const db = makeDb({
      injections: [{ id: 'inj-1', takenAt: shotTime, zone: 'BELLY_UR', doseMg: 0.5 }],
    });

    // Friday (Day 5)
    const friday = new Date('2026-08-28T12:00:00Z');
    const friConcierge = buildCycleConcierge(db, friday);
    expect(friConcierge.phase).toBe('TROUGH_APPETITE');
    expect(friConcierge.badgeLabel).toContain('APPETITE WINDOW');
    expect(friConcierge.insight).toContain('food noise is 100% normal');

    // Saturday (Day 6)
    const saturday = new Date('2026-08-29T12:00:00Z');
    const satConcierge = buildCycleConcierge(db, saturday);
    expect(satConcierge.phase).toBe('TROUGH_APPETITE');
  });

  it('returns SHOT_OVERDUE when past shot day without logging', () => {
    // Shot was 9 days ago (Tuesday when shotDay is Sunday)
    const db = makeDb({
      injections: [{ id: 'inj-old', takenAt: '2026-08-14T09:00:00Z', zone: 'BELLY_UR', doseMg: 0.5 }],
    });
    const tuesday = new Date('2026-08-25T12:00:00Z'); // 11 days later
    const concierge = buildCycleConcierge(db, tuesday);

    expect(concierge.phase).toBe('SHOT_OVERDUE');
    expect(concierge.badgeType).toBe('warning');
    expect(concierge.primaryAction.type).toBe('SHOT');
  });

  it('returns TITRATION_MILESTONE when user reaches 4 weeks on dose', () => {
    const fourWeeksAgo = new Date('2026-07-29T09:00:00Z');
    const wednesday = new Date('2026-08-26T14:00:00Z'); // Exactly 28 days later (Wednesday post-shot)

    const db = makeDb({
      doseHistory: [
        { id: 'dh-1', startedAt: fourWeeksAgo.toISOString(), label: '0.5 mg', mg: 0.5 },
      ],
      injections: [
        { id: 'inj-1', takenAt: '2026-08-23T09:00:00Z', zone: 'BELLY_UR', doseMg: 0.5 },
      ],
    });

    const concierge = buildCycleConcierge(db, wednesday);
    expect(concierge.phase).toBe('TITRATION_MILESTONE');
    expect(concierge.badgeLabel).toContain('4-WEEK DOSE MILESTONE');
    expect(concierge.primaryAction.type).toBe('DOSE');
  });

  it('returns REFILL_URGENT when only 1 dose remains in pen', () => {
    const db = makeDb({
      refill: {
        dosesPerPen: 4,
        lastFilledAt: '2026-08-01T00:00:00Z',
        refillRequested: false,
      },
      injections: [
        { id: 'inj-1', takenAt: '2026-08-02T09:00:00Z', zone: 'BELLY_UL', doseMg: 0.5 },
        { id: 'inj-2', takenAt: '2026-08-09T09:00:00Z', zone: 'BELLY_UR', doseMg: 0.5 },
        { id: 'inj-3', takenAt: '2026-08-16T09:00:00Z', zone: 'BELLY_LL', doseMg: 0.5 },
        // 3 of 4 doses taken => 1 dose left
      ],
    });

    // Wednesday post-shot
    const wednesday = new Date('2026-08-19T12:00:00Z');
    const concierge = buildCycleConcierge(db, wednesday);

    expect(concierge.phase).toBe('REFILL_URGENT');
    expect(concierge.badgeType).toBe('warning');
    expect(concierge.primaryAction.type).toBe('REFILL');
  });
});
