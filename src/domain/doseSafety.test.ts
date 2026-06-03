import type { Injection } from '../types/domain';
import { checkDoseSafety, TOO_SOON_DAYS_THRESHOLD } from './doseSafety';

function inj(takenAt: string, id = takenAt, doseMg = 0.5): Injection {
  return { id, takenAt, zone: 'BELLY_UL', doseMg };
}

describe('checkDoseSafety', () => {
  const now = new Date(2026, 5, 7, 14, 0); // Sun Jun 7, 2026 2pm local

  it('returns OK with empty history', () => {
    expect(checkDoseSafety([], now)).toEqual({ kind: 'OK' });
  });

  it('returns OK when the last shot was 7 days ago (normal weekly cadence)', () => {
    const last = new Date(2026, 4, 31, 14, 0);
    expect(checkDoseSafety([inj(last.toISOString())], now)).toEqual({ kind: 'OK' });
  });

  it('returns OK when the last shot was exactly 6 days ago', () => {
    const last = new Date(2026, 5, 1, 14, 0);
    expect(checkDoseSafety([inj(last.toISOString())], now)).toEqual({ kind: 'OK' });
  });

  it('returns BLOCK_REPLACE when a shot was already logged earlier today', () => {
    const earlier = new Date(2026, 5, 7, 9, 0);
    const result = checkDoseSafety([inj(earlier.toISOString(), 'a')], now);
    expect(result.kind).toBe('BLOCK_REPLACE');
    if (result.kind === 'BLOCK_REPLACE') {
      expect(result.existing.id).toBe('a');
    }
  });

  it('returns BLOCK_REPLACE for same calendar day even when several minutes apart', () => {
    const earlier = new Date(2026, 5, 7, 13, 59);
    const result = checkDoseSafety([inj(earlier.toISOString())], now);
    expect(result.kind).toBe('BLOCK_REPLACE');
  });

  it('returns WARN_TOO_SOON when last shot was 1 day ago', () => {
    const last = new Date(2026, 5, 6, 14, 0);
    const result = checkDoseSafety([inj(last.toISOString(), 'a', 1)], now);
    expect(result).toEqual({ kind: 'WARN_TOO_SOON', daysAgo: 1, existingDoseMg: 1 });
  });

  it('returns WARN_TOO_SOON across the entire 1..5 missed-dose window', () => {
    for (let d = 1; d <= TOO_SOON_DAYS_THRESHOLD; d += 1) {
      const last = new Date(2026, 5, 7 - d, 14, 0);
      const result = checkDoseSafety([inj(last.toISOString())], now);
      expect(result.kind).toBe('WARN_TOO_SOON');
      if (result.kind === 'WARN_TOO_SOON') {
        expect(result.daysAgo).toBe(d);
      }
    }
  });

  it('uses the most recent injection when history is unsorted', () => {
    const oldShot = new Date(2025, 11, 1, 9, 0).toISOString();
    const recentShot = new Date(2026, 5, 6, 9, 0).toISOString();
    const history = [inj(oldShot, 'old'), inj(recentShot, 'recent')];
    const result = checkDoseSafety(history, now);
    expect(result.kind).toBe('WARN_TOO_SOON');
  });

  // Backdate-aware behavior — the safety check looks at neighbors on
  // BOTH sides of `takenAt`, not just "most recent before now". This
  // matters when the user is recording a shot they took earlier in
  // the week.

  describe('backdating', () => {
    it('OK when backdating to a date 6+ days from any existing shot', () => {
      // Have a shot on Mon May 25; backdate a new one to Mon Jun 1 (7 days later).
      const may25 = new Date(2026, 4, 25, 14, 0);
      const jun1 = new Date(2026, 5, 1, 14, 0);
      const result = checkDoseSafety([inj(may25.toISOString())], jun1);
      expect(result).toEqual({ kind: 'OK' });
    });

    it('BLOCK_REPLACE when backdating to a date that already has an injection', () => {
      // Existing shot Sun Jun 7, user "logs" a backdate to Sun Jun 7 1pm.
      const existing = new Date(2026, 5, 7, 9, 0);
      const backdate = new Date(2026, 5, 7, 13, 0);
      const result = checkDoseSafety([inj(existing.toISOString(), 'a')], backdate);
      expect(result.kind).toBe('BLOCK_REPLACE');
      if (result.kind === 'BLOCK_REPLACE') expect(result.existing.id).toBe('a');
    });

    it('WARN_TOO_SOON when backdating between two existing shots', () => {
      // Shots on Sun Jun 7 and Sun Jun 21. User backdates to Wed Jun 17.
      // Closest neighbor: Jun 21 = 4 days later. Should warn.
      const a = new Date(2026, 5, 7, 9, 0);
      const b = new Date(2026, 5, 21, 9, 0);
      const backdate = new Date(2026, 5, 17, 9, 0);
      const result = checkDoseSafety(
        [inj(a.toISOString(), 'a'), inj(b.toISOString(), 'b')],
        backdate,
      );
      expect(result.kind).toBe('WARN_TOO_SOON');
      if (result.kind === 'WARN_TOO_SOON') expect(result.daysAgo).toBe(4);
    });

    it('picks the CLOSEST neighbor when both sides are within the warn window', () => {
      // Shot on Jun 5 and Jun 11. Backdate to Jun 8 (3 days from each).
      // Either neighbor is acceptable; daysAgo should be 3.
      const a = new Date(2026, 5, 5, 9, 0);
      const b = new Date(2026, 5, 11, 9, 0);
      const backdate = new Date(2026, 5, 8, 9, 0);
      const result = checkDoseSafety(
        [inj(a.toISOString()), inj(b.toISOString())],
        backdate,
      );
      expect(result.kind).toBe('WARN_TOO_SOON');
      if (result.kind === 'WARN_TOO_SOON') expect(result.daysAgo).toBe(3);
    });

    it('OK when the closest neighbor is exactly 6 days away', () => {
      const a = new Date(2026, 5, 1, 9, 0);
      const backdate = new Date(2026, 5, 7, 9, 0);
      const result = checkDoseSafety([inj(a.toISOString())], backdate);
      expect(result.kind).toBe('OK');
    });
  });
});
