import {
  FREE_FOREVER_FEATURES,
  FREE_SHOT_LIMIT,
  isFreeShotLimitReached,
  PRO_ONLY_FEATURES,
  PRO_PAYWALL_BENEFITS,
} from './proGating';

describe('pro gating contract', () => {
  it('keeps core logging free forever', () => {
    expect(FREE_FOREVER_FEATURES).toEqual([
      'shot_log',
      'food_log',
      'symptom_log',
      'dose_ladder',
      'refill',
      'weight',
      'history',
      'local_reminders',
      'export',
      'trough_day',
    ]);
  });

  it('charges Pro only for coach, alerts, milestones, reports, and level curves', () => {
    expect(PRO_ONLY_FEATURES).toEqual([
      'coach',
      'alerts',
      'milestones',
      'reports',
      'levels',
    ]);
  });

  it('does not put logging features in the Pro list', () => {
    const overlap = FREE_FOREVER_FEATURES.filter((feature) =>
      (PRO_ONLY_FEATURES as readonly string[]).includes(feature),
    );
    expect(overlap).toEqual([]);
  });

  it('correctly calculates free shot limit reach status', () => {
    expect(FREE_SHOT_LIMIT).toBe(3);
    expect(isFreeShotLimitReached(0, false)).toBe(false);
    expect(isFreeShotLimitReached(2, false)).toBe(false);
    expect(isFreeShotLimitReached(3, false)).toBe(true);
    expect(isFreeShotLimitReached(4, false)).toBe(true);

    // Pro users are never limited
    expect(isFreeShotLimitReached(3, true)).toBe(false);
    expect(isFreeShotLimitReached(10, true)).toBe(false);
  });

  it('paywall benefits include unlimited shot logging and Pro promises', () => {
    expect(PRO_PAYWALL_BENEFITS.map((item) => item.title)).toEqual([
      'Unlimited shot logging',
      'Smart GLP-1 coach',
      'Smart alerts',
      'Weekly milestones',
      'Doctor-ready report',
    ]);
  });
});

