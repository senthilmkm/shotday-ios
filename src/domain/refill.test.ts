import type { Injection, RefillSchedule } from '../types/domain';
import {
  defaultDosesPerPen,
  INFO_THRESHOLD,
  refillStatus,
  URGENT_THRESHOLD,
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
    expect(s.alertLevel).toBe('INFO'); // 2 ≤ INFO_THRESHOLD
  });

  it('ignores injections logged BEFORE lastFilledAt', () => {
    const injections = [
      inj('2026-05-01T09:00:00Z'), // before fill date 2026-06-01
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

describe('refillStatus — alert levels', () => {
  it('INFO at 2 doses left (default thresholds)', () => {
    const s = refillStatus(refill({ dosesPerPen: 4 }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
    ], new Date());
    expect(INFO_THRESHOLD).toBe(2);
    expect(s.alertLevel).toBe('INFO');
  });

  it('URGENT at 1 dose left when refill not yet requested', () => {
    const s = refillStatus(refill({ dosesPerPen: 4 }), [
      inj('2026-06-08T09:00:00Z'),
      inj('2026-06-15T09:00:00Z'),
      inj('2026-06-22T09:00:00Z'),
    ], new Date());
    expect(URGENT_THRESHOLD).toBe(1);
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

  it('EMPTY remains EMPTY even when refill is requested', () => {
    const s = refillStatus(refill({ dosesPerPen: 1, refillRequested: true }), [
      inj('2026-06-08T09:00:00Z'),
    ], new Date());
    expect(s.alertLevel).toBe('EMPTY');
  });

  it('NONE when comfortably above thresholds', () => {
    const s = refillStatus(refill({ dosesPerPen: 4 }), [
      inj('2026-06-08T09:00:00Z'),
    ], new Date());
    expect(s.dosesRemaining).toBe(3);
    expect(s.alertLevel).toBe('NONE');
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
