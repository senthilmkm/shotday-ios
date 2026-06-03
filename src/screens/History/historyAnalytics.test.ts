import { EMPTY_DB, type Injection, type ShotdayDb, type SideEffectEntry, type FoodEntry } from '../../types/domain';
import {
  avgIntervalDays,
  averagePeakSymptom,
  formatAvgInterval,
  mostUsedZone,
  proteinHitRateInfo,
  proteinSeries,
  proteinTakeawayText,
  recentSymptomPeaks,
  symptomTakeawayText,
  zoneCounts,
  zoneTakeawayText,
} from './historyAnalytics';

const baseProfile = { ...EMPTY_DB.profile, weight: 200, weightUnit: 'LB' as const };
const dbWith = (overrides: Partial<ShotdayDb>): ShotdayDb => ({
  ...EMPTY_DB,
  profile: baseProfile,
  ...overrides,
});

function inj(takenAt: string, zone: Injection['zone'] = 'BELLY_UL', doseMg = 0.5, id?: string): Injection {
  return { id: id ?? takenAt, takenAt, zone, doseMg };
}

function se(loggedAt: string, peak: number, id?: string): SideEffectEntry {
  return {
    id: id ?? loggedAt,
    loggedAt,
    dayAfterShot: 1,
    metrics: { NAUSEA: peak, FATIGUE: 1, CONSTIPATION: 1, APPETITE_SUPPRESSION: 1, MOOD: 1, ANXIETY: 1 },
    chips: [],
    customSymptoms: [],
    doseMg: 0.5,
  };
}

function food(loggedAt: string, grams: number, id?: string): FoodEntry {
  return {
    id: id ?? `${loggedAt}-${grams}`,
    loggedAt,
    name: 'Test',
    proteinGrams: grams,
    preset: false,
  };
}

// Anchor "now" mid-day so today is clearly in progress.
const NOW = new Date(2026, 5, 7, 14, 0); // Sun Jun 7, 2026 2pm local

describe('avgIntervalDays', () => {
  it('returns null with empty injections', () => {
    expect(avgIntervalDays(dbWith({ injections: [] }))).toBeNull();
  });

  it('returns null with a single injection', () => {
    expect(
      avgIntervalDays(dbWith({ injections: [inj(new Date(2026, 5, 1).toISOString())] })),
    ).toBeNull();
  });

  it('returns 7 for perfect weekly cadence', () => {
    const injections = [
      inj(new Date(2026, 4, 24, 9).toISOString(), 'BELLY_UL', 0.5, 'a'),
      inj(new Date(2026, 4, 31, 9).toISOString(), 'BELLY_UR', 0.5, 'b'),
      inj(new Date(2026, 5, 7, 9).toISOString(), 'THIGH_L', 0.5, 'c'),
    ];
    expect(avgIntervalDays(dbWith({ injections }))).toBeCloseTo(7, 5);
  });

  it('handles unsorted input', () => {
    const injections = [
      inj(new Date(2026, 5, 7, 9).toISOString(), 'BELLY_UL', 0.5, 'c'),
      inj(new Date(2026, 4, 24, 9).toISOString(), 'BELLY_UR', 0.5, 'a'),
      inj(new Date(2026, 4, 31, 9).toISOString(), 'THIGH_L', 0.5, 'b'),
    ];
    expect(avgIntervalDays(dbWith({ injections }))).toBeCloseTo(7, 5);
  });

  it('averages across uneven gaps', () => {
    // 5-day, 9-day → mean 7
    const injections = [
      inj(new Date(2026, 4, 24, 9).toISOString(), 'BELLY_UL', 0.5, 'a'),
      inj(new Date(2026, 4, 29, 9).toISOString(), 'BELLY_UR', 0.5, 'b'),
      inj(new Date(2026, 5, 7, 9).toISOString(), 'THIGH_L', 0.5, 'c'),
    ];
    expect(avgIntervalDays(dbWith({ injections }))).toBeCloseTo(7, 5);
  });
});

describe('averagePeakSymptom', () => {
  it('returns null with no entries', () => {
    expect(averagePeakSymptom(dbWith({ sideEffects: [] }), 28, NOW)).toBeNull();
  });

  it('averages peaks of recent entries within window', () => {
    const sideEffects = [
      se(new Date(2026, 5, 1, 9).toISOString(), 5, 'a'),
      se(new Date(2026, 5, 4, 9).toISOString(), 1, 'b'),
      se(new Date(2026, 5, 6, 9).toISOString(), 3, 'c'),
    ];
    // (5 + 1 + 3) / 3 = 3
    expect(averagePeakSymptom(dbWith({ sideEffects }), 28, NOW)).toBe(3);
  });

  it('excludes entries older than the window', () => {
    const sideEffects = [
      se(new Date(2024, 1, 1).toISOString(), 5, 'old'),
      se(new Date(2026, 5, 6, 9).toISOString(), 3, 'recent'),
    ];
    expect(averagePeakSymptom(dbWith({ sideEffects }), 28, NOW)).toBe(3);
  });

  it('returns null when all entries are out of window', () => {
    const sideEffects = [se(new Date(2024, 1, 1).toISOString(), 5, 'old')];
    expect(averagePeakSymptom(dbWith({ sideEffects }), 28, NOW)).toBeNull();
  });
});

describe('proteinHitRateInfo', () => {
  it('returns null when weight is unset', () => {
    const db = dbWith({ profile: { ...baseProfile, weight: 0 } });
    expect(proteinHitRateInfo(db, 14, NOW)).toBeNull();
  });

  it('does NOT include today in the denominator (in-progress day)', () => {
    // 200 lb × 0.7 = 140g target
    // Today: 0g logged. If today were counted, hit rate would be 0/14 even
    // with perfect adherence on past 13 days.
    const yesterday = new Date(2026, 5, 6, 9, 0);
    const sideEffects: SideEffectEntry[] = [];
    const foods: FoodEntry[] = [];
    // Hit target on each of last 14 past days
    for (let i = 1; i <= 14; i++) {
      const d = new Date(2026, 5, 7 - i, 9, 0);
      foods.push(food(d.toISOString(), 200, `f${i}`));
    }
    const info = proteinHitRateInfo(dbWith({ foods, sideEffects }), 14, NOW);
    expect(info).not.toBeNull();
    expect(info!.hits).toBe(14);
    expect(info!.days).toBe(14);
    expect(info!.rate).toBe(1);
    void yesterday;
  });

  it('returns 0 hits when no food logged in past days', () => {
    const info = proteinHitRateInfo(dbWith({ foods: [] }), 14, NOW);
    expect(info!.hits).toBe(0);
    expect(info!.days).toBe(14);
    expect(info!.rate).toBe(0);
  });

  it('counts a past day as hit when total ≥ target', () => {
    // 140g target. Yesterday (Jun 6) gets one 140g entry.
    const foods = [food(new Date(2026, 5, 6, 9).toISOString(), 140)];
    const info = proteinHitRateInfo(dbWith({ foods }), 14, NOW);
    expect(info!.hits).toBe(1);
  });

  it('counts a past day as missed when total < target', () => {
    const foods = [food(new Date(2026, 5, 6, 9).toISOString(), 100)];
    const info = proteinHitRateInfo(dbWith({ foods }), 14, NOW);
    expect(info!.hits).toBe(0);
  });
});

describe('mostUsedZone', () => {
  it('returns null with no injections', () => {
    expect(mostUsedZone(dbWith({ injections: [] }))).toBeNull();
  });

  it('returns the zone with the highest count', () => {
    const injections = [
      inj(new Date(2026, 5, 1).toISOString(), 'THIGH_L', 0.5, 'a'),
      inj(new Date(2026, 5, 2).toISOString(), 'BELLY_UL', 0.5, 'b'),
      inj(new Date(2026, 5, 3).toISOString(), 'BELLY_UL', 0.5, 'c'),
    ];
    expect(mostUsedZone(dbWith({ injections }))).toBe('BELLY_UL');
  });
});

describe('recentSymptomPeaks', () => {
  it('returns ascending-time entries with peaks', () => {
    const sideEffects = [
      se(new Date(2026, 5, 3, 9).toISOString(), 4, 'b'),
      se(new Date(2026, 5, 1, 9).toISOString(), 2, 'a'),
      se(new Date(2026, 5, 5, 9).toISOString(), 5, 'c'),
    ];
    const out = recentSymptomPeaks(dbWith({ sideEffects }), 12);
    expect(out.map((o) => o.peak)).toEqual([2, 4, 5]);
  });

  it('caps to last n entries', () => {
    const sideEffects = Array.from({ length: 20 }, (_, i) =>
      se(new Date(2026, 5, 1 + i, 9).toISOString(), (i % 5) + 1, `e${i}`),
    );
    const out = recentSymptomPeaks(dbWith({ sideEffects }), 5);
    expect(out).toHaveLength(5);
  });

  it('returns empty array with no entries', () => {
    expect(recentSymptomPeaks(dbWith({ sideEffects: [] }), 5)).toEqual([]);
  });
});

describe('proteinSeries', () => {
  it('returns null when weight is unset', () => {
    const db = dbWith({ profile: { ...baseProfile, weight: 0 } });
    expect(proteinSeries(db, 14, NOW)).toBeNull();
  });

  it('returns empty values when user has weight but no food entries', () => {
    const result = proteinSeries(dbWith({ foods: [] }), 14, NOW);
    expect(result).toEqual({ values: [], inProgressIndex: null, targetG: 140 });
  });

  it('trims series to start from earliest food entry, not stale zeros', () => {
    // First (and only) food entry is 3 days ago (Jun 4).
    const foods = [food(new Date(2026, 5, 4, 12).toISOString(), 50)];
    const result = proteinSeries(dbWith({ foods }), 14, NOW);
    expect(result!.values).toHaveLength(4); // Jun 4, 5, 6, 7
    // Jun 4 had 50g / 140g target ≈ 0.357
    expect(result!.values[0]).toBeCloseTo(50 / 140, 5);
    expect(result!.values[1]).toBe(0);
    expect(result!.values[2]).toBe(0);
    expect(result!.values[3]).toBe(0);
  });

  it('flags rightmost bar as in-progress (today)', () => {
    const foods = [food(new Date(2026, 5, 4, 12).toISOString(), 50)];
    const result = proteinSeries(dbWith({ foods }), 14, NOW);
    expect(result!.inProgressIndex).toBe(result!.values.length - 1);
  });

  it('caps at windowDays even when user has older history', () => {
    // 30 days of food, all 200g.
    const foods = Array.from({ length: 30 }, (_, i) =>
      food(new Date(2026, 4, 8 + i, 12).toISOString(), 200, `f${i}`),
    );
    const result = proteinSeries(dbWith({ foods }), 14, NOW);
    expect(result!.values).toHaveLength(14);
  });

  it('aggregates multiple entries on the same day', () => {
    const foods = [
      food(new Date(2026, 5, 6, 8).toISOString(), 50, 'a'),
      food(new Date(2026, 5, 6, 18).toISOString(), 100, 'b'),
    ];
    const result = proteinSeries(dbWith({ foods }), 14, NOW);
    // Yesterday's bar should be 150/140 = 1.071
    const yesterdayIdx = result!.values.length - 2;
    expect(result!.values[yesterdayIdx]).toBeCloseTo(150 / 140, 5);
  });
});

describe('zoneCounts', () => {
  it('returns 9 entries with zero counts when no injections', () => {
    const out = zoneCounts(dbWith({ injections: [] }));
    expect(out).toHaveLength(9);
    expect(out.every((r) => r.count === 0)).toBe(true);
  });

  it('preserves declaration order across renders', () => {
    const injections = [
      inj(new Date(2026, 5, 1).toISOString(), 'THIGH_L', 0.5, 'a'),
      inj(new Date(2026, 5, 2).toISOString(), 'BELLY_UL', 0.5, 'b'),
    ];
    const out = zoneCounts(dbWith({ injections }));
    expect(out[0]!.zone).toBe('BELLY_UL');
    expect(out[0]!.count).toBe(1);
    expect(out[4]!.zone).toBe('THIGH_L');
    expect(out[4]!.count).toBe(1);
  });
});

describe('symptomTakeawayText', () => {
  it('returns null with empty series', () => {
    expect(symptomTakeawayText([])).toBeNull();
  });

  it('returns null with a single entry', () => {
    expect(symptomTakeawayText([{ peak: 3 }])).toBeNull();
  });

  it('detects downward trend with median split', () => {
    const series = [{ peak: 5 }, { peak: 4 }, { peak: 5 }, { peak: 1 }, { peak: 2 }, { peak: 1 }];
    expect(symptomTakeawayText(series)).toBe('Trending down — symptoms easing.');
  });

  it('detects upward trend with median split', () => {
    const series = [{ peak: 1 }, { peak: 2 }, { peak: 1 }, { peak: 4 }, { peak: 5 }, { peak: 4 }];
    expect(symptomTakeawayText(series)?.startsWith('Trending up')).toBe(true);
  });

  it('reports steady when middle is flat regardless of bookend spikes', () => {
    // First-vs-last would say "steady" (5→5). Median split also says steady because
    // both halves' medians are equal (both ~5/1 mixes).
    const series = [{ peak: 1 }, { peak: 1 }, { peak: 1 }, { peak: 1 }, { peak: 1 }, { peak: 1 }];
    expect(symptomTakeawayText(series)?.startsWith('Roughly steady')).toBe(true);
  });

  it('falls back to first-vs-last for tiny samples', () => {
    expect(symptomTakeawayText([{ peak: 5 }, { peak: 1 }])).toBe('Trending down — symptoms easing.');
    expect(
      symptomTakeawayText([{ peak: 1 }, { peak: 5 }])?.startsWith('Trending up'),
    ).toBe(true);
  });
});

describe('proteinTakeawayText', () => {
  it('returns null when no series', () => {
    expect(proteinTakeawayText(null)).toBeNull();
  });

  it('returns null when series is empty', () => {
    expect(proteinTakeawayText({ values: [], inProgressIndex: null, targetG: 140 })).toBeNull();
  });

  it('excludes today from "X of Y past days" wording', () => {
    // 4-day series: 3 past days, 1 today (in progress).
    const result = proteinTakeawayText({
      values: [1.0, 0.5, 1.2, 0.0],
      inProgressIndex: 3,
      targetG: 140,
    });
    expect(result).toBe('2 of 3 past days hit the target.');
  });

  it('omits today from numerator even when today is "hit"', () => {
    // Today shows as "hit" (1.5×) but should be excluded from the count.
    const result = proteinTakeawayText({
      values: [0.5, 0.4, 1.5],
      inProgressIndex: 2,
      targetG: 140,
    });
    expect(result).toBe('No completed days at target yet — small wins still count.');
  });

  it('handles series with no in-progress index', () => {
    const result = proteinTakeawayText({
      values: [1.0, 1.0, 1.0],
      inProgressIndex: null,
      targetG: 140,
    });
    expect(result).toBe('3 of 3 past days hit the target.');
  });
});

describe('zoneTakeawayText', () => {
  it('returns null when no zones used', () => {
    const rows = zoneCounts(dbWith({ injections: [] }));
    expect(zoneTakeawayText(rows)).toBeNull();
  });

  it('praises strong rotation at 6+ zones', () => {
    const rows = [
      { zone: 'BELLY_UL', count: 1 },
      { zone: 'BELLY_UR', count: 1 },
      { zone: 'BELLY_LL', count: 1 },
      { zone: 'BELLY_LR', count: 1 },
      { zone: 'THIGH_L', count: 1 },
      { zone: 'THIGH_R', count: 1 },
    ] as const;
    expect(zoneTakeawayText([...rows])?.startsWith('Strong rotation')).toBe(true);
  });

  it('encourages more variety with 1-2 zones', () => {
    const rows = [
      { zone: 'BELLY_UL', count: 5 },
      { zone: 'BELLY_UR', count: 0 },
    ] as const;
    expect(zoneTakeawayText([...rows])?.startsWith('Try to spread')).toBe(true);
  });
});

describe('formatAvgInterval', () => {
  it('returns "—" for null', () => {
    expect(formatAvgInterval(null)).toBe('—');
  });

  it('drops trailing .0 for clean integers', () => {
    expect(formatAvgInterval(7)).toBe('7');
    expect(formatAvgInterval(7.0)).toBe('7');
  });

  it('keeps one decimal place for non-integer values', () => {
    expect(formatAvgInterval(6.84)).toBe('6.8');
    expect(formatAvgInterval(7.45)).toBe('7.5');
  });
});
