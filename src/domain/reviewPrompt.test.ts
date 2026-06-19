import { shouldShowSoftReviewPrompt } from './reviewPrompt';
import { EMPTY_DB, type ShotdayDb } from '../types/domain';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

const now = new Date('2026-06-19T18:00:00');

function eligibleDb(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return db({
    profile: {
      ...EMPTY_DB.profile,
      onboardingComplete: true,
      currentDoseMg: 0.5,
      currentDoseLabel: '0.5 mg',
      weight: 180,
      shotDay: 'FRIDAY',
      trialStartedAt: '2026-06-01T09:00:00',
    },
    injections: [
      { id: 'shot-1', takenAt: '2026-06-12T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
      { id: 'shot-2', takenAt: '2026-06-19T09:00:00', zone: 'BELLY_UR', doseMg: 0.5 },
    ],
    weightEntries: [
      { id: 'w1', loggedAt: '2026-06-12T10:00:00', weight: 180, unit: 'LB' },
      { id: 'w2', loggedAt: '2026-06-19T10:00:00', weight: 178, unit: 'LB' },
    ],
    sideEffects: [
      {
        id: 'sym',
        loggedAt: '2026-06-19T12:00:00',
        dayAfterShot: 1,
        metrics: {
          NAUSEA: 1,
          FATIGUE: 1,
          CONSTIPATION: 1,
          APPETITE_SUPPRESSION: 1,
          MOOD: 1,
          ANXIETY: 1,
        },
        chips: [],
        customSymptoms: [],
        doseMg: 0.5,
      },
    ],
    foods: [{ id: 'food', loggedAt: '2026-06-19T12:30:00', name: 'Shake', proteinGrams: 30, preset: true }],
    refill: { dosesPerPen: 4, lastFilledAt: '2026-06-19T00:00:00', refillRequested: false },
    refillHistory: [{ id: 'refill', type: 'SETUP', loggedAt: '2026-06-19T08:00:00', dosesPerPen: 4 }],
    reviewPrompt: {
      ...EMPTY_DB.reviewPrompt,
      weeklyProgressViewedAt: '2026-06-19T13:00:00',
    },
    ...over,
  });
}

describe('soft review prompt eligibility', () => {
  it('shows after enough time, data, and a positive moment', () => {
    expect(shouldShowSoftReviewPrompt(eligibleDb(), now)).toBe(true);
  });

  it('does not show before 7 days of use', () => {
    expect(
      shouldShowSoftReviewPrompt(
        eligibleDb({
          profile: {
            ...eligibleDb().profile,
            trialStartedAt: '2026-06-15T09:00:00',
          },
        }),
        now,
      ),
    ).toBe(false);
  });

  it('does not show when core report data is incomplete', () => {
    expect(shouldShowSoftReviewPrompt(eligibleDb({ weightEntries: [] }), now)).toBe(false);
  });

  it('does not show during urgent refill state', () => {
    expect(
      shouldShowSoftReviewPrompt(
        eligibleDb({
          refill: { dosesPerPen: 2, lastFilledAt: '2026-06-01T00:00:00', refillRequested: false },
          injections: [
            { id: 'shot-1', takenAt: '2026-06-01T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 },
            { id: 'shot-2', takenAt: '2026-06-08T09:00:00', zone: 'BELLY_UR', doseMg: 0.5 },
          ],
        }),
        now,
      ),
    ).toBe(false);
  });

  it('does not show again inside cooldown after dismissal', () => {
    expect(
      shouldShowSoftReviewPrompt(
        eligibleDb({
          reviewPrompt: {
            ...eligibleDb().reviewPrompt,
            lastDismissedAt: '2026-06-10T09:00:00',
          },
        }),
        now,
      ),
    ).toBe(false);
  });

  it('does not show after user taps leave review', () => {
    expect(
      shouldShowSoftReviewPrompt(
        eligibleDb({
          reviewPrompt: {
            ...eligibleDb().reviewPrompt,
            reviewedAt: '2026-06-10T09:00:00',
          },
        }),
        now,
      ),
    ).toBe(false);
  });
});
