import {
  buildTroughDayShareText,
  buildTroughDayState,
  troughPhaseFromDaysSince,
  troughRingFill,
} from './troughDay';
import { DEFAULT_PROFILE, EMPTY_DB, type ShotdayDb } from '../types/domain';

function dbWithShot(takenAt: Date): ShotdayDb {
  return {
    ...EMPTY_DB,
    profile: {
      ...DEFAULT_PROFILE,
      onboardingComplete: true,
      drug: 'ZEPBOUND',
      currentDoseMg: 5,
      currentDoseLabel: '5 mg',
      shotDay: 'SUNDAY',
    },
    injections: [
      { id: '1', takenAt: takenAt.toISOString(), zone: 'BELLY_UL', doseMg: 5 },
    ],
  };
}

describe('troughDay domain', () => {
  it('maps days-since-shot to named phases', () => {
    expect(troughPhaseFromDaysSince(null)).toBe('NO_DATA');
    expect(troughPhaseFromDaysSince(0)).toBe('SHOT_DAY');
    expect(troughPhaseFromDaysSince(1)).toBe('PEAK');
    expect(troughPhaseFromDaysSince(2)).toBe('PEAK');
    expect(troughPhaseFromDaysSince(3)).toBe('STEADY');
    expect(troughPhaseFromDaysSince(4)).toBe('STEADY');
    expect(troughPhaseFromDaysSince(5)).toBe('TROUGH');
    expect(troughPhaseFromDaysSince(6)).toBe('TROUGH');
    expect(troughPhaseFromDaysSince(7)).toBe('PRE_SHOT');
    expect(troughPhaseFromDaysSince(9)).toBe('OVERDUE');
  });

  it('keeps trough ring thinner than peak', () => {
    expect(troughRingFill('TROUGH')).toBeLessThan(troughRingFill('PEAK'));
    expect(troughRingFill('SHOT_DAY')).toBe(1);
    expect(troughRingFill('NO_DATA')).toBe(0);
  });

  it('names the weekday on Trough Day five days after shot', () => {
    const shotAt = new Date(2026, 8, 13, 8, 0, 0); // Sun Sep 13 2026
    const friday = new Date(2026, 8, 18, 10, 0, 0); // +5 days → Friday
    const state = buildTroughDayState(dbWithShot(shotAt), friday);
    expect(state.phase).toBe('TROUGH');
    expect(state.isTroughDay).toBe(true);
    expect(state.badge).toBe('TROUGH DAY');
    expect(state.headline).toContain('Friday');
    expect(state.insight.toLowerCase()).toContain('food noise');
  });

  it('share text never includes mg numbers', () => {
    const shotAt = new Date(2026, 8, 13, 8, 0, 0);
    const friday = new Date(2026, 8, 18, 10, 0, 0);
    const db = {
      ...dbWithShot(shotAt),
      injections: [
        { id: '1', takenAt: shotAt.toISOString(), zone: 'BELLY_UL' as const, doseMg: 12.5 },
      ],
    };
    const text = buildTroughDayShareText(buildTroughDayState(db, friday));
    expect(text).toMatch(/Trough Day/);
    expect(text).not.toMatch(/\d+(\.\d+)?\s*mg/i);
    expect(text).toContain('On this iPhone. Nowhere else.');
  });

  it('shot-day state after logging today', () => {
    const now = new Date(2026, 8, 16, 9, 0, 0);
    const state = buildTroughDayState(dbWithShot(now), now);
    expect(state.phase).toBe('SHOT_DAY');
    expect(state.isTroughDay).toBe(false);
    expect(state.ringFill).toBe(1);
  });
});
