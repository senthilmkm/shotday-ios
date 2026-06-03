import type { Injection, RefillSchedule } from '../types/domain';
import {
  defaultDosesPerPen,
  refillStatus,
  thresholdsForPen,
} from './refill';

const inj = (takenAt: string, doseMg = 0.5): Injection => ({
  id: takenAt,
  takenAt,
  zone: 'BELLY_UL',
  doseMg,
});

const refill = (overrides: Partial<RefillSchedule> = {}): RefillSchedule => ({
  dosesPerPen: 4,
  lastFilledAt: '2026-06-01T00:00:00Z',
  refillRequested: false,
  ...overrides,
});

describe('refillStatus — unconfigured', () => {
  it('flags unconfigured when refill is null', () => {
    const s = refillStatus(null, [], new Date());
    expect(s.unconfigured).toBe(true);
    expect(s.alertLevel).toBe('NONE');
    expect(s.dosesRemaining).toBe(0);
  });
});

describe('refillStatus — counting doses since last fill', () => {
  it('returns dosesPerPen when no injections logged since fill', () => {
    const s = refillStatus(refill(), [], new Date());
    expect(s.dosesRemaining).toBe(4);
    expect(s.alertLevel).toBe('NONE');
  });

  it('decrements per injection logged after lastFilledAt', () => {
    const injections = [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
    ];
    const s = refillStatus(refill(), injections, new Date());
    expect(s.dosesRemaining).toBe(2);
    expect(s.alertLevel).toBe('INFO'); // 2 ≤ INFO threshold for a 4-dose pen
  });

  it('ignores injections logged BEFORE lastFilledAt', () => {
    const injections = [
      inj('2026-05-01T09:00:00Z'),
      inj('2026-06-08T09:00:00Z'),
    ];
    const s = refillStatus(refill(), injections, new Date());
    expect(s.dosesRemaining).toBe(3);
  });

  it('clamps to 0 when more injections logged than pen holds', () => {
    const injections = [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
      inj('2026-06-29T09:00:00Z'),
      inj('2026-07-06T09:00:00Z'),
    ];
    const s = refillStatus(refill(), injections, new Date());
    expect(s.dosesRemaining).toBe(0);
    expect(s.alertLevel).toBe('EMPTY');
  });
});

describe('refillStatus — alert levels (4-dose pen, default)', () => {
  it('NONE when comfortably above thresholds (3 of 4 left)', () => {
    const s = refillStatus(refill({ dosesPerPen: 4 }), [
      inj('2026-06-08T09:00:00Z'),
    ], new Date());
    expect(s.dosesRemaining).toBe(3);
    expect(s.alertLevel).toBe('NONE');
  });

  it('INFO at 2 doses left', () => {
    const s = refillStatus(refill({ dosesPerPen: 4 }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
    ], new Date());
    expect(s.alertLevel).toBe('INFO');
  });

  it('URGENT at 1 dose left when refill not yet requested', () => {
    const s = refillStatus(refill({ dosesPerPen: 4 }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
    ], new Date());
    expect(s.alertLevel).toBe('URGENT');
  });

  it('downgrades URGENT to INFO once refill is requested', () => {
    const s = refillStatus(refill({ dosesPerPen: 4, refillRequested: true }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
    ], new Date());
    expect(s.alertLevel).toBe('INFO');
  });
});

describe('refillStatus — 1-dose vial (Mounjaro / Zepbound) regression', () => {
  // Bug we're guarding against: previously `URGENT_THRESHOLD = 1`
  // tripped URGENT the moment a 1-dose vial was filled, scheduling a
  // refill notification on day 1. The new thresholds suppress URGENT
  // and INFO entirely for 1-dose vials — they're either ready (NONE)
  // or used (EMPTY).

  it('NONE on a freshly filled 1-dose vial', () => {
    const s = refillStatus(refill({ dosesPerPen: 1 }), [], new Date());
    expect(s.dosesRemaining).toBe(1);
    expect(s.alertLevel).toBe('NONE');
  });

  it('EMPTY after the single dose is used', () => {
    const s = refillStatus(refill({ dosesPerPen: 1 }), [
      inj('2026-06-02T09:00:00Z'),
    ], new Date());
    expect(s.dosesRemaining).toBe(0);
    expect(s.alertLevel).toBe('EMPTY');
  });

  it('does NOT trip URGENT when refill is not yet requested', () => {
    const s = refillStatus(
      refill({ dosesPerPen: 1, refillRequested: false }),
      [],
      new Date(),
    );
    expect(s.alertLevel).not.toBe('URGENT');
  });

  it('EMPTY remains EMPTY even when refill is requested', () => {
    const s = refillStatus(refill({ dosesPerPen: 1, refillRequested: true }), [
      inj('2026-06-02T09:00:00Z'),
    ], new Date());
    expect(s.alertLevel).toBe('EMPTY');
  });
});

describe('refillStatus — 2-dose pen', () => {
  it('NONE when full', () => {
    const s = refillStatus(refill({ dosesPerPen: 2 }), [], new Date());
    expect(s.alertLevel).toBe('NONE');
  });

  it('URGENT when 1 of 2 remains (no INFO band)', () => {
    const s = refillStatus(refill({ dosesPerPen: 2 }), [
      inj('2026-06-08T09:00:00Z'),
    ], new Date());
    expect(s.alertLevel).toBe('URGENT');
  });
});

describe('refillStatus — 5+ dose pen scales thresholds proportionally', () => {
  it('URGENT around 25% remaining on an 8-dose pen', () => {
    // 8-dose pen: urgent at ceil(2.0) = 2, info at ceil(4.0) = 4.
    const filledTwoUsed = refillStatus(refill({ dosesPerPen: 8 }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
    ], new Date());
    expect(filledTwoUsed.dosesRemaining).toBe(6);
    expect(filledTwoUsed.alertLevel).toBe('NONE');

    const fourUsed = refillStatus(refill({ dosesPerPen: 8 }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
      inj('2026-06-29T09:00:00Z'),
    ], new Date());
    expect(fourUsed.dosesRemaining).toBe(4);
    expect(fourUsed.alertLevel).toBe('INFO');

    const sixUsed = refillStatus(refill({ dosesPerPen: 8 }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
      inj('2026-06-29T09:00:00Z'),
      inj('2026-07-06T09:00:00Z'),
      inj('2026-07-13T09:00:00Z'),
    ], new Date());
    expect(sixUsed.dosesRemaining).toBe(2);
    expect(sixUsed.alertLevel).toBe('URGENT');
  });
});

describe('thresholdsForPen', () => {
  it('returns 0/0 for 1-dose vials (no URGENT band)', () => {
    expect(thresholdsForPen(1)).toEqual({ urgent: 0, info: 0 });
  });

  it('returns 1/1 for 2-dose pens', () => {
    expect(thresholdsForPen(2)).toEqual({ urgent: 1, info: 1 });
  });

  it('returns 1/2 for 4-dose pens (semaglutide default)', () => {
    expect(thresholdsForPen(4)).toEqual({ urgent: 1, info: 2 });
  });

  it('scales proportionally for larger pens', () => {
    expect(thresholdsForPen(8)).toEqual({ urgent: 2, info: 4 });
    expect(thresholdsForPen(12)).toEqual({ urgent: 3, info: 6 });
  });
});

describe('defaultDosesPerPen', () => {
  it('returns 4 for semaglutide pens (Ozempic / Wegovy)', () => {
    expect(defaultDosesPerPen('OZEMPIC')).toBe(4);
    expect(defaultDosesPerPen('WEGOVY')).toBe(4);
  });

  it('returns 1 for tirzepatide vials (Mounjaro / Zepbound)', () => {
    expect(defaultDosesPerPen('MOUNJARO')).toBe(1);
    expect(defaultDosesPerPen('ZEPBOUND')).toBe(1);
  });

  it('falls back to 4 for OTHER / unknown', () => {
    expect(defaultDosesPerPen('OTHER')).toBe(4);
    expect(defaultDosesPerPen('SOMETHING_ELSE')).toBe(4);
  });
});
