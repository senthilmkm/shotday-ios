import {
  daysUntilEligibleToBump,
  isOffLadder,
  ladderIdForDrug,
  nextRung,
  OZEMPIC_LADDER,
  previousRung,
  rungIndexForMg,
  rungsForDrug,
  STANDARD_ESCALATION_INTERVAL_DAYS,
  TIRZEPATIDE_LADDER,
  WEGOVY_LADDER,
} from './dose';

describe('ladderIdForDrug', () => {
  it('maps Ozempic + Wegovy to semaglutide', () => {
    expect(ladderIdForDrug('OZEMPIC')).toBe('SEMAGLUTIDE');
    expect(ladderIdForDrug('WEGOVY')).toBe('SEMAGLUTIDE');
  });

  it('maps Mounjaro + Zepbound to tirzepatide', () => {
    expect(ladderIdForDrug('MOUNJARO')).toBe('TIRZEPATIDE');
    expect(ladderIdForDrug('ZEPBOUND')).toBe('TIRZEPATIDE');
  });

  it('maps OTHER to custom', () => {
    expect(ladderIdForDrug('OTHER')).toBe('CUSTOM');
  });
});

describe('rungsForDrug — per-drug ladder', () => {
  it('Ozempic uses the diabetes ladder ending at 2.0 mg, NOT 2.4 mg', () => {
    const rungs = rungsForDrug('OZEMPIC');
    expect(rungs).toEqual(OZEMPIC_LADDER);
    const top = rungs[rungs.length - 1];
    expect(top?.mg).toBe(2.0);
    expect(rungs.find((r) => r.mg === 1.7)).toBeUndefined();
    expect(rungs.find((r) => r.mg === 2.4)).toBeUndefined();
  });

  it('Wegovy uses the obesity ladder ending at 2.4 mg', () => {
    const rungs = rungsForDrug('WEGOVY');
    expect(rungs).toEqual(WEGOVY_LADDER);
    const top = rungs[rungs.length - 1];
    expect(top?.mg).toBe(2.4);
    expect(rungs.find((r) => r.mg === 1.7)).toBeDefined();
  });

  it('Mounjaro and Zepbound share the tirzepatide ladder', () => {
    expect(rungsForDrug('MOUNJARO')).toEqual(TIRZEPATIDE_LADDER);
    expect(rungsForDrug('ZEPBOUND')).toEqual(TIRZEPATIDE_LADDER);
  });

  it('OTHER returns an empty array (UI surfaces a numeric input)', () => {
    expect(rungsForDrug('OTHER')).toEqual([]);
  });
});

describe('rungIndexForMg', () => {
  it('finds 0-based index on the Wegovy ladder', () => {
    expect(rungIndexForMg('WEGOVY', 0.25)).toBe(0);
    expect(rungIndexForMg('WEGOVY', 1.0)).toBe(2);
    expect(rungIndexForMg('WEGOVY', 2.4)).toBe(4);
  });

  it('finds 0-based index on the Ozempic ladder', () => {
    expect(rungIndexForMg('OZEMPIC', 0.25)).toBe(0);
    expect(rungIndexForMg('OZEMPIC', 1.0)).toBe(2);
    expect(rungIndexForMg('OZEMPIC', 2.0)).toBe(3);
  });

  it('returns -1 for Wegovy-only doses on Ozempic', () => {
    expect(rungIndexForMg('OZEMPIC', 1.7)).toBe(-1);
    expect(rungIndexForMg('OZEMPIC', 2.4)).toBe(-1);
  });

  it('returns -1 for Ozempic-only doses on Wegovy', () => {
    expect(rungIndexForMg('WEGOVY', 2.0)).toBe(-1);
  });

  it('returns -1 for off-ladder values', () => {
    expect(rungIndexForMg('OZEMPIC', 0.3)).toBe(-1);
    expect(rungIndexForMg('MOUNJARO', 0.5)).toBe(-1);
  });

  it('returns -1 for OTHER drug regardless of input', () => {
    expect(rungIndexForMg('OTHER', 1.0)).toBe(-1);
  });
});

describe('nextRung', () => {
  it('Ozempic 1.0 mg bumps to 2.0 mg, NOT 1.7 mg', () => {
    expect(nextRung('OZEMPIC', 1.0)).toEqual({ label: '2.0 mg', mg: 2.0 });
  });

  it('Wegovy 1.0 mg bumps to 1.7 mg (Wegovy-only intermediate)', () => {
    expect(nextRung('WEGOVY', 1.0)).toEqual({ label: '1.7 mg', mg: 1.7 });
  });

  it('returns the next rung when one exists (general)', () => {
    expect(nextRung('OZEMPIC', 0.25)).toEqual({ label: '0.5 mg', mg: 0.5 });
    expect(nextRung('WEGOVY', 0.25)).toEqual({ label: '0.5 mg', mg: 0.5 });
    expect(nextRung('MOUNJARO', 2.5)).toEqual({ label: '5.0 mg', mg: 5.0 });
  });

  it('returns null when already at the top of the ladder', () => {
    expect(nextRung('OZEMPIC', 2.0)).toBeNull();
    expect(nextRung('WEGOVY', 2.4)).toBeNull();
    expect(nextRung('MOUNJARO', 15)).toBeNull();
  });

  it('returns null for off-ladder current values', () => {
    expect(nextRung('OZEMPIC', 0.3)).toBeNull();
    // 1.7 is on Wegovy but NOT Ozempic — an Ozempic user stranded on
    // 1.7 cannot navigate the ladder.
    expect(nextRung('OZEMPIC', 1.7)).toBeNull();
  });
});

describe('previousRung', () => {
  it('returns the previous rung when one exists', () => {
    expect(previousRung('OZEMPIC', 0.5)).toEqual({ label: '0.25 mg', mg: 0.25 });
    expect(previousRung('OZEMPIC', 2.0)).toEqual({ label: '1.0 mg', mg: 1.0 });
    expect(previousRung('WEGOVY', 0.5)).toEqual({ label: '0.25 mg', mg: 0.25 });
    expect(previousRung('MOUNJARO', 5.0)).toEqual({ label: '2.5 mg', mg: 2.5 });
  });

  it('returns null when already at the bottom rung', () => {
    expect(previousRung('OZEMPIC', 0.25)).toBeNull();
    expect(previousRung('WEGOVY', 0.25)).toBeNull();
    expect(previousRung('MOUNJARO', 2.5)).toBeNull();
  });

  it('returns null for off-ladder current values', () => {
    expect(previousRung('OZEMPIC', 0.3)).toBeNull();
  });
});

describe('isOffLadder', () => {
  it('returns false for an unset (0 or negative) dose', () => {
    expect(isOffLadder('OZEMPIC', 0)).toBe(false);
    expect(isOffLadder('OZEMPIC', -1)).toBe(false);
  });

  it('returns false when the dose is on the drug ladder', () => {
    expect(isOffLadder('OZEMPIC', 1.0)).toBe(false);
    expect(isOffLadder('WEGOVY', 1.7)).toBe(false);
    expect(isOffLadder('MOUNJARO', 7.5)).toBe(false);
  });

  it('returns true when the dose is NOT on the drug ladder', () => {
    expect(isOffLadder('OZEMPIC', 1.7)).toBe(true); // Wegovy-only
    expect(isOffLadder('OZEMPIC', 2.4)).toBe(true); // Wegovy-only
    expect(isOffLadder('WEGOVY', 2.0)).toBe(true);  // Ozempic-only
    expect(isOffLadder('MOUNJARO', 1.0)).toBe(true); // semaglutide dose
  });

  it('returns false for OTHER (custom) — any dose is valid', () => {
    expect(isOffLadder('OTHER', 0.25)).toBe(false);
    expect(isOffLadder('OTHER', 17.3)).toBe(false);
  });
});

describe('daysUntilEligibleToBump', () => {
  it('returns the full interval immediately after starting a new dose', () => {
    const startedAt = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-06-01T00:00:00Z');
    expect(daysUntilEligibleToBump(startedAt, now)).toBe(STANDARD_ESCALATION_INTERVAL_DAYS);
  });

  it('counts down day by day', () => {
    const startedAt = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-06-15T00:00:00Z');
    expect(daysUntilEligibleToBump(startedAt, now)).toBe(28 - 14);
  });

  it('returns 0 the day the interval is up', () => {
    const startedAt = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-06-29T00:00:00Z');
    expect(daysUntilEligibleToBump(startedAt, now)).toBe(0);
  });

  it('returns 0 (not negative) once the interval has already passed', () => {
    const startedAt = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-08-01T00:00:00Z');
    expect(daysUntilEligibleToBump(startedAt, now)).toBe(0);
  });

  it('handles negative deltas (clock skew / unset dates) by returning the full interval', () => {
    const startedAt = new Date('2026-06-15T00:00:00Z');
    const now = new Date('2026-06-01T00:00:00Z');
    expect(daysUntilEligibleToBump(startedAt, now)).toBe(STANDARD_ESCALATION_INTERVAL_DAYS);
  });

  it('respects a custom interval override', () => {
    const startedAt = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-06-08T00:00:00Z');
    expect(daysUntilEligibleToBump(startedAt, now, 14)).toBe(7);
  });
});
