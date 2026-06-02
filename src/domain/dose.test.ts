import {
  daysUntilEligibleToBump,
  ladderIdForDrug,
  nextRung,
  previousRung,
  rungIndexForMg,
  rungsForDrug,
  rungsForLadder,
  SEMAGLUTIDE_LADDER,
  STANDARD_ESCALATION_INTERVAL_DAYS,
  TIRZEPATIDE_LADDER,
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

describe('rungsForLadder', () => {
  it('returns semaglutide ladder', () => {
    expect(rungsForLadder('SEMAGLUTIDE')).toEqual(SEMAGLUTIDE_LADDER);
  });

  it('returns tirzepatide ladder', () => {
    expect(rungsForLadder('TIRZEPATIDE')).toEqual(TIRZEPATIDE_LADDER);
  });

  it('returns empty array for CUSTOM (UI surfaces numeric input)', () => {
    expect(rungsForLadder('CUSTOM')).toEqual([]);
  });
});

describe('rungsForDrug', () => {
  it('walks drug → ladder → rungs', () => {
    expect(rungsForDrug('OZEMPIC')).toEqual(SEMAGLUTIDE_LADDER);
    expect(rungsForDrug('MOUNJARO')).toEqual(TIRZEPATIDE_LADDER);
    expect(rungsForDrug('OTHER')).toEqual([]);
  });
});

describe('rungIndexForMg', () => {
  it('finds 0-based index on the semaglutide ladder', () => {
    expect(rungIndexForMg('SEMAGLUTIDE', 0.25)).toBe(0);
    expect(rungIndexForMg('SEMAGLUTIDE', 1.0)).toBe(2);
    expect(rungIndexForMg('SEMAGLUTIDE', 2.4)).toBe(4);
  });

  it('returns -1 for off-ladder values', () => {
    expect(rungIndexForMg('SEMAGLUTIDE', 0.3)).toBe(-1);
    expect(rungIndexForMg('TIRZEPATIDE', 0.5)).toBe(-1);
  });

  it('returns -1 for the CUSTOM ladder regardless of input', () => {
    expect(rungIndexForMg('CUSTOM', 1.0)).toBe(-1);
  });
});

describe('nextRung', () => {
  it('returns the next rung when one exists', () => {
    expect(nextRung('SEMAGLUTIDE', 0.25)).toEqual({ label: '0.5 mg', mg: 0.5 });
    expect(nextRung('SEMAGLUTIDE', 1.0)).toEqual({ label: '1.7 mg', mg: 1.7 });
    expect(nextRung('TIRZEPATIDE', 2.5)).toEqual({ label: '5.0 mg', mg: 5.0 });
  });

  it('returns null when already at the top of the ladder', () => {
    expect(nextRung('SEMAGLUTIDE', 2.4)).toBeNull();
    expect(nextRung('TIRZEPATIDE', 15)).toBeNull();
  });

  it('returns null for off-ladder current values', () => {
    expect(nextRung('SEMAGLUTIDE', 0.3)).toBeNull();
  });
});

describe('previousRung', () => {
  it('returns the previous rung when one exists', () => {
    expect(previousRung('SEMAGLUTIDE', 0.5)).toEqual({ label: '0.25 mg', mg: 0.25 });
    expect(previousRung('TIRZEPATIDE', 5.0)).toEqual({ label: '2.5 mg', mg: 2.5 });
  });

  it('returns null when already at the bottom rung', () => {
    expect(previousRung('SEMAGLUTIDE', 0.25)).toBeNull();
    expect(previousRung('TIRZEPATIDE', 2.5)).toBeNull();
  });

  it('returns null for off-ladder current values', () => {
    expect(previousRung('SEMAGLUTIDE', 0.3)).toBeNull();
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
