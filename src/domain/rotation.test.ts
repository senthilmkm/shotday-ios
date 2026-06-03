import type { Injection, InjectionZone } from '../types/domain';
import { hotZones, lastUsedZone, suggestNextZone } from './rotation';

function inj(zone: InjectionZone, takenAt: string, doseMg = 0.5): Injection {
  return { id: `${zone}-${takenAt}`, zone, takenAt, doseMg };
}

describe('suggestNextZone', () => {
  it('returns BELLY_UL when there is no history (deterministic first pick)', () => {
    expect(suggestNextZone([])).toBe('BELLY_UL');
  });

  it('does NOT suggest the most recently used zone', () => {
    const history: Injection[] = [inj('BELLY_UL', '2026-05-31T09:00:00Z')];
    expect(suggestNextZone(history)).not.toBe('BELLY_UL');
  });

  it('prefers a zone never used over zones used once', () => {
    const history: Injection[] = [
      inj('BELLY_UL', '2026-05-24T09:00:00Z'),
      inj('BELLY_UR', '2026-05-31T09:00:00Z'),
    ];
    const next = suggestNextZone(history);
    expect(next).not.toBe('BELLY_UR'); // last used
    expect(['BELLY_LL', 'BELLY_LR', 'THIGH_L', 'THIGH_R', 'ARM_L', 'ARM_R']).toContain(next);
  });

  it('cycles through all 8 anatomical zones over 8 weeks', () => {
    const history: Injection[] = [];
    const zonesPicked = new Set<InjectionZone>();
    let week = 0;
    while (zonesPicked.size < 8 && week < 16) {
      const next = suggestNextZone(history);
      zonesPicked.add(next);
      history.push(inj(next, `2026-${String(1 + week).padStart(2, '0')}-15T09:00:00Z`));
      week++;
    }
    expect(zonesPicked.size).toBe(8);
  });

  it('never suggests OTHER (the manual escape hatch)', () => {
    const history: Injection[] = [];
    for (let i = 0; i < 20; i++) {
      const next = suggestNextZone(history);
      expect(next).not.toBe('OTHER');
      history.push(inj(next, `2026-${String(1 + (i % 12)).padStart(2, '0')}-15T09:00:00Z`));
    }
  });

  it('falls back to all candidates if every zone is in the lookback window', () => {
    // Lookback 8 with 8 zones → recentlyUsed contains every zone → fallback kicks in.
    const history: Injection[] = [
      inj('BELLY_UL', '2026-05-24T09:00:00Z'),
      inj('BELLY_UR', '2026-05-25T09:00:00Z'),
      inj('BELLY_LL', '2026-05-26T09:00:00Z'),
      inj('BELLY_LR', '2026-05-27T09:00:00Z'),
      inj('THIGH_L', '2026-05-28T09:00:00Z'),
      inj('THIGH_R', '2026-05-29T09:00:00Z'),
      inj('ARM_L', '2026-05-30T09:00:00Z'),
      inj('ARM_R', '2026-05-31T09:00:00Z'),
    ];
    // Should still return a valid zone, not throw.
    const next = suggestNextZone(history, 8);
    expect(next).toBeDefined();
    expect(next).not.toBe('OTHER');
  });
});

describe('hotZones', () => {
  it('returns empty when history is shorter than the lookback', () => {
    const history: Injection[] = [
      inj('BELLY_UL', '2026-05-24T09:00:00Z'),
      inj('BELLY_UL', '2026-05-31T09:00:00Z'),
    ];
    // lookback 4, history of 2 → not enough signal to warn yet.
    expect(hotZones(history).size).toBe(0);
  });

  it('flags a zone hit twice in the last 4 injections', () => {
    const history: Injection[] = [
      inj('BELLY_UL', '2026-05-10T09:00:00Z'),
      inj('THIGH_L', '2026-05-17T09:00:00Z'),
      inj('BELLY_UL', '2026-05-24T09:00:00Z'),
      inj('ARM_R', '2026-05-31T09:00:00Z'),
    ];
    const hot = hotZones(history);
    expect(hot.has('BELLY_UL')).toBe(true);
    expect(hot.has('THIGH_L')).toBe(false);
  });

  it('does not flag zones hit only once in the lookback window', () => {
    const history: Injection[] = [
      inj('BELLY_UL', '2026-05-10T09:00:00Z'),
      inj('BELLY_UR', '2026-05-17T09:00:00Z'),
      inj('THIGH_L', '2026-05-24T09:00:00Z'),
      inj('THIGH_R', '2026-05-31T09:00:00Z'),
    ];
    expect(hotZones(history).size).toBe(0);
  });

  it('only considers the most recent N injections, ignoring older repeats', () => {
    const history: Injection[] = [
      // Old repeats — should NOT count as hot now that they're outside lookback 4.
      inj('BELLY_UL', '2026-04-01T09:00:00Z'),
      inj('BELLY_UL', '2026-04-08T09:00:00Z'),
      // Last 4 are all unique zones.
      inj('THIGH_L', '2026-05-10T09:00:00Z'),
      inj('THIGH_R', '2026-05-17T09:00:00Z'),
      inj('ARM_L', '2026-05-24T09:00:00Z'),
      inj('ARM_R', '2026-05-31T09:00:00Z'),
    ];
    expect(hotZones(history).size).toBe(0);
  });
});

describe('lastUsedZone', () => {
  it('returns null on empty history', () => {
    expect(lastUsedZone([])).toBeNull();
  });

  it('returns the most recent zone (newest by takenAt, not array order)', () => {
    const history: Injection[] = [
      inj('BELLY_UL', '2026-05-24T09:00:00Z'),
      inj('THIGH_L', '2026-05-31T09:00:00Z'),
      inj('ARM_R', '2026-05-17T09:00:00Z'),
    ];
    expect(lastUsedZone(history)).toBe('THIGH_L');
  });
});
