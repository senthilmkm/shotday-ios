import {
  SIDE_EFFECT_METRICS,
  type Injection,
  type SideEffectMetric,
} from '../types/domain';
import {
  buildAdHocEntry,
  buildPostShotEntry,
  defaultMetrics,
  isSignificant,
  peakMetric,
} from './sideEffects';

function metrics(values: Partial<Record<SideEffectMetric, number>>): Record<SideEffectMetric, number> {
  return { ...defaultMetrics(), ...values };
}

const inj = (takenAt: string, doseMg = 0.5): Injection => ({
  id: takenAt,
  takenAt,
  zone: 'BELLY_UL',
  doseMg,
});

describe('defaultMetrics', () => {
  it('initializes every metric to 1 (none)', () => {
    const m = defaultMetrics();
    for (const k of SIDE_EFFECT_METRICS) {
      expect(m[k]).toBe(1);
    }
  });
});

describe('buildPostShotEntry', () => {
  it('returns null when there is no injection history', () => {
    const result = buildPostShotEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: [],
      injections: [],
      now: new Date(2026, 5, 2, 8, 0),
    });
    expect(result).toBeNull();
  });

  it('returns null when out of window (day 0 or beyond day 3)', () => {
    const history = [inj('2026-06-01T09:00:00')];
    expect(
      buildPostShotEntry({
        metrics: defaultMetrics(),
        chips: [],
        customSymptoms: [],
        injections: history,
        now: new Date(2026, 5, 1, 21, 0), // day 0
      }),
    ).toBeNull();
    expect(
      buildPostShotEntry({
        metrics: defaultMetrics(),
        chips: [],
        customSymptoms: [],
        injections: history,
        now: new Date(2026, 5, 5, 8, 0), // day 4
      }),
    ).toBeNull();
  });

  it('snapshots the most recent injection dose, not the current profile dose', () => {
    const history = [inj('2026-06-01T09:00:00', 0.25)]; // a 0.25 mg shot
    const entry = buildPostShotEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: [],
      injections: history,
      now: new Date(2026, 5, 2, 8, 0),
    });
    expect(entry?.doseMg).toBe(0.25);
    expect(entry?.dayAfterShot).toBe(1);
  });

  it('trims and drops empty custom symptoms', () => {
    const history = [inj('2026-06-01T09:00:00')];
    const entry = buildPostShotEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: ['  cold sweats  ', '', '   ', 'tinnitus'],
      injections: history,
      now: new Date(2026, 5, 2, 8, 0),
    });
    expect(entry?.customSymptoms).toEqual(['cold sweats', 'tinnitus']);
  });

  it('does not mutate caller-owned arrays/objects', () => {
    const history = [inj('2026-06-01T09:00:00')];
    const m = metrics({ NAUSEA: 4 });
    const chips: ('HEADACHE' | 'HEARTBURN')[] = ['HEADACHE'];
    const customs = ['x'];
    const entry = buildPostShotEntry({
      metrics: m,
      chips,
      customSymptoms: customs,
      injections: history,
      now: new Date(2026, 5, 2, 8, 0),
    });
    entry!.metrics.NAUSEA = 1;
    entry!.chips.push('HEARTBURN');
    expect(m.NAUSEA).toBe(4);
    expect(chips).toEqual(['HEADACHE']);
    expect(customs).toEqual(['x']);
  });
});

describe('buildAdHocEntry', () => {
  it('always returns an entry, defaults dayAfterShot to 1', () => {
    const entry = buildAdHocEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: [],
      doseMg: 0.5,
      now: new Date(2026, 5, 1, 12, 0),
    });
    expect(entry.dayAfterShot).toBe(1);
    expect(entry.doseMg).toBe(0.5);
  });

  it('respects fallbackDayAfterShot override', () => {
    const entry = buildAdHocEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: [],
      doseMg: 1,
      fallbackDayAfterShot: 3,
      now: new Date(2026, 5, 1, 12, 0),
    });
    expect(entry.dayAfterShot).toBe(3);
  });
});

describe('peakMetric', () => {
  it('returns 1 for an all-default entry', () => {
    const entry = buildAdHocEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: [],
      doseMg: 0.5,
      now: new Date(),
    });
    expect(peakMetric(entry)).toBe(1);
  });

  it('returns the highest individual metric', () => {
    const entry = buildAdHocEntry({
      metrics: metrics({ NAUSEA: 5, FATIGUE: 3 }),
      chips: [],
      customSymptoms: [],
      doseMg: 0.5,
      now: new Date(),
    });
    expect(peakMetric(entry)).toBe(5);
  });
});

describe('isSignificant', () => {
  it('false for an all-default entry', () => {
    const entry = buildAdHocEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: [],
      doseMg: 0.5,
      now: new Date(),
    });
    expect(isSignificant(entry)).toBe(false);
  });

  it('true if any metric > 1', () => {
    const entry = buildAdHocEntry({
      metrics: metrics({ FATIGUE: 2 }),
      chips: [],
      customSymptoms: [],
      doseMg: 0.5,
      now: new Date(),
    });
    expect(isSignificant(entry)).toBe(true);
  });

  it('true if any chip is set', () => {
    const entry = buildAdHocEntry({
      metrics: defaultMetrics(),
      chips: ['HEADACHE'],
      customSymptoms: [],
      doseMg: 0.5,
      now: new Date(),
    });
    expect(isSignificant(entry)).toBe(true);
  });

  it('true if any custom symptom is recorded', () => {
    const entry = buildAdHocEntry({
      metrics: defaultMetrics(),
      chips: [],
      customSymptoms: ['cold sweats'],
      doseMg: 0.5,
      now: new Date(),
    });
    expect(isSignificant(entry)).toBe(true);
  });
});
