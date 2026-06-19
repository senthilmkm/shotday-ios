import { buildTodaysCoach } from './todaysCoach';
import { EMPTY_DB, type ShotdayDb } from '../types/domain';

function db(over: Partial<ShotdayDb> = {}): ShotdayDb {
  return JSON.parse(JSON.stringify({ ...EMPTY_DB, ...over })) as ShotdayDb;
}

function readyProfile() {
  return {
    ...EMPTY_DB.profile,
    onboardingComplete: true,
    currentDoseMg: 0.5,
    currentDoseLabel: '0.5 mg',
    weight: 180,
    shotDay: 'FRIDAY' as const,
  };
}

describe('today’s coach', () => {
  it('guides a first-time user through setup sequence', () => {
    const coach = buildTodaysCoach(
      db({
        profile: {
          ...EMPTY_DB.profile,
          onboardingComplete: true,
          currentDoseMg: 0,
          currentDoseLabel: '',
          weight: 0,
          shotDay: 'FRIDAY',
        },
      }),
      new Date('2026-06-19T09:00:00'),
    );

    expect(coach.title).toBe('Build your first progress report');
    expect(coach.checklist).toEqual([
      { label: 'Medication + dose', complete: false },
      { label: 'Shot logged', complete: false },
      { label: 'Weight added', complete: false },
      { label: 'Symptoms checked', complete: false },
    ]);
    expect(coach.actions).toEqual([{ type: 'DOSE', label: 'Update dose', icon: 'settings' }]);
  });

  it('prioritizes logging the current cycle shot', () => {
    const coach = buildTodaysCoach(
      db({ profile: readyProfile() }),
      new Date('2026-06-19T09:00:00'),
    );

    expect(coach.title).toBe('Complete today’s basics');
    expect(coach.actions[0]?.type).toBe('SHOT');
    expect(coach.checklist.find((item) => item.label === 'Shot logged')?.complete).toBe(false);
  });

  it('continues the checklist sequence after a recent shot', () => {
    const coach = buildTodaysCoach(
      db({
        profile: { ...readyProfile(), shotDay: 'WEDNESDAY' },
        injections: [{ id: 'shot', takenAt: '2026-06-17T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
      }),
      new Date('2026-06-19T09:00:00'),
    );

    expect(coach.title).toBe('Complete today’s basics');
    expect(coach.actions[0]?.type).toBe('WEIGHT');
    expect(coach.checklist.find((item) => item.label === 'Shot logged')?.complete).toBe(true);
  });

  it('asks for weekly weight after shot and symptoms are present', () => {
    const coach = buildTodaysCoach(
      db({
        profile: readyProfile(),
        injections: [{ id: 'shot', takenAt: '2026-06-19T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
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
      }),
      new Date('2026-06-19T18:00:00'),
    );

    expect(coach.title).toBe('Complete today’s basics');
    expect(coach.actions[0]?.type).toBe('WEIGHT');
  });

  it('falls back to progress when no urgent coaching action is needed', () => {
    const coach = buildTodaysCoach(
      db({
        profile: readyProfile(),
        injections: [{ id: 'shot', takenAt: '2026-06-19T09:00:00', zone: 'BELLY_UL', doseMg: 0.5 }],
        weightEntries: [
          { id: 'w1', loggedAt: '2026-06-12T09:00:00', weight: 181, unit: 'LB' },
          { id: 'w2', loggedAt: '2026-06-19T09:30:00', weight: 180, unit: 'LB' },
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
      }),
      new Date('2026-06-19T18:00:00'),
    );

    expect(coach.title).toBe('Doctor report is ready');
    expect(coach.actions[0]?.type).toBe('DOCTOR_REPORT');
    expect(coach.checklist).toEqual([
      { label: 'Shot logged', complete: true },
      { label: 'Weight added', complete: true },
      { label: 'Symptoms checked', complete: true },
      { label: 'Protein logged', complete: true },
    ]);
  });
});
