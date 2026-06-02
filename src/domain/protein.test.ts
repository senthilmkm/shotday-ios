import {
  PROTEIN_G_PER_KG,
  PROTEIN_G_PER_LB,
  proteinProgress,
  proteinTargetGrams,
  shouldShowEveningNudge,
} from './protein';

describe('proteinTargetGrams', () => {
  it('uses 0.7 g/lb for imperial weight', () => {
    expect(proteinTargetGrams(200, 'LB')).toBe(Math.round(200 * PROTEIN_G_PER_LB));
    expect(proteinTargetGrams(150, 'LB')).toBe(Math.round(150 * PROTEIN_G_PER_LB));
  });

  it('uses 1.54 g/kg for metric weight', () => {
    expect(proteinTargetGrams(70, 'KG')).toBe(Math.round(70 * PROTEIN_G_PER_KG));
    expect(proteinTargetGrams(90, 'KG')).toBe(Math.round(90 * PROTEIN_G_PER_KG));
  });

  it('rounds to the nearest whole gram', () => {
    // 173 lb * 0.7 = 121.1 → 121
    expect(proteinTargetGrams(173, 'LB')).toBe(121);
  });

  it('throws on zero or negative weight', () => {
    expect(() => proteinTargetGrams(0, 'LB')).toThrow();
    expect(() => proteinTargetGrams(-50, 'LB')).toThrow();
  });

  it('throws on NaN / Infinity', () => {
    expect(() => proteinTargetGrams(Number.NaN, 'LB')).toThrow();
    expect(() => proteinTargetGrams(Number.POSITIVE_INFINITY, 'LB')).toThrow();
  });
});

describe('proteinProgress', () => {
  it('returns the consumed/target ratio', () => {
    expect(proteinProgress(70, 140)).toBe(0.5);
    expect(proteinProgress(140, 140)).toBe(1);
  });

  it('returns 0 when target is 0 (avoids divide-by-zero)', () => {
    expect(proteinProgress(50, 0)).toBe(0);
  });

  it('allows >1 (overshoot is not an error)', () => {
    expect(proteinProgress(180, 140)).toBeCloseTo(1.286, 3);
  });
});

describe('shouldShowEveningNudge', () => {
  it('does not nudge before 8 PM regardless of progress', () => {
    expect(shouldShowEveningNudge(20, 140, 14)).toBe(false);
    expect(shouldShowEveningNudge(20, 140, 19)).toBe(false);
  });

  it('nudges at 8 PM when below 50% of target', () => {
    expect(shouldShowEveningNudge(60, 140, 20)).toBe(true);
  });

  it('does NOT nudge at 8 PM when at or above 50%', () => {
    expect(shouldShowEveningNudge(70, 140, 20)).toBe(false);
    expect(shouldShowEveningNudge(120, 140, 20)).toBe(false);
  });

  it('does not nudge when target is 0 (no profile yet)', () => {
    expect(shouldShowEveningNudge(0, 0, 22)).toBe(false);
  });
});
