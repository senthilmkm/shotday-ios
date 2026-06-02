import { DEFAULT_PROFILE, type UserProfile } from '../types/domain';
import {
  computeEntitlement,
  hasAccess,
  shouldShowTrialBanner,
  TRIAL_DAYS,
  TRIAL_WARNING_DAYS,
  trialDaysRemaining,
} from './entitlement';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  ...DEFAULT_PROFILE,
  onboardingComplete: true,
  ...overrides,
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────
// computeEntitlement
// ─────────────────────────────────────────────────────────────────

describe('computeEntitlement — NEW_USER', () => {
  it('returns NEW_USER when trialStartedAt is null and no PRO', () => {
    expect(computeEntitlement(profile({ trialStartedAt: null }), new Date())).toBe('NEW_USER');
  });

  it('returns NEW_USER on bogus trialStartedAt', () => {
    expect(
      computeEntitlement(profile({ trialStartedAt: 'not-a-date' }), new Date()),
    ).toBe('NEW_USER');
  });
});

describe('computeEntitlement — TRIAL', () => {
  it('returns TRIAL on day 0', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    expect(computeEntitlement(p, start)).toBe('TRIAL');
  });

  it('returns TRIAL on day 13 (still within window)', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    const day13 = new Date(start.getTime() + 13 * ONE_DAY_MS);
    expect(computeEntitlement(p, day13)).toBe('TRIAL');
  });
});

describe('computeEntitlement — EXPIRED', () => {
  it('returns EXPIRED at exactly day 14', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    const day14 = new Date(start.getTime() + TRIAL_DAYS * ONE_DAY_MS);
    expect(computeEntitlement(p, day14)).toBe('EXPIRED');
  });

  it('returns EXPIRED far past trial end', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    const future = new Date(start.getTime() + 365 * ONE_DAY_MS);
    expect(computeEntitlement(p, future)).toBe('EXPIRED');
  });
});

describe('computeEntitlement — PRO', () => {
  it('returns PRO when proUntil is in the future', () => {
    const now = new Date(2026, 5, 1);
    const future = new Date(now.getTime() + 30 * ONE_DAY_MS);
    const p = profile({ proUntil: future.toISOString() });
    expect(computeEntitlement(p, now)).toBe('PRO');
  });

  it('returns EXPIRED (not PRO) when proUntil has passed and trial also expired', () => {
    const now = new Date(2026, 6, 1);
    const past = new Date(now.getTime() - 30 * ONE_DAY_MS);
    const p = profile({
      proUntil: past.toISOString(),
      trialStartedAt: new Date(now.getTime() - 60 * ONE_DAY_MS).toISOString(),
    });
    expect(computeEntitlement(p, now)).toBe('EXPIRED');
  });

  it('devProOverride beats every other input', () => {
    const now = new Date(2026, 5, 1);
    const ancientStart = new Date(now.getTime() - 365 * ONE_DAY_MS);
    const p = profile({
      devProOverride: true,
      trialStartedAt: ancientStart.toISOString(),
      proUntil: null,
    });
    expect(computeEntitlement(p, now)).toBe('PRO');
  });

  it('PRO via subscription beats EXPIRED trial', () => {
    const now = new Date(2026, 6, 1);
    const ancientStart = new Date(now.getTime() - 60 * ONE_DAY_MS);
    const future = new Date(now.getTime() + 30 * ONE_DAY_MS);
    const p = profile({
      proUntil: future.toISOString(),
      trialStartedAt: ancientStart.toISOString(),
    });
    expect(computeEntitlement(p, now)).toBe('PRO');
  });
});

// ─────────────────────────────────────────────────────────────────
// trialDaysRemaining
// ─────────────────────────────────────────────────────────────────

describe('trialDaysRemaining', () => {
  it('returns null when trial not started', () => {
    expect(trialDaysRemaining(profile({ trialStartedAt: null }), new Date())).toBeNull();
  });

  it('returns 14 on day 0', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    expect(trialDaysRemaining(p, start)).toBe(TRIAL_DAYS);
  });

  it('counts down by whole days (ceiling) so partial days still appear positive', () => {
    const start = new Date(2026, 5, 1, 9, 0);
    const p = profile({ trialStartedAt: start.toISOString() });
    const day12_5 = new Date(start.getTime() + 12.5 * ONE_DAY_MS);
    expect(trialDaysRemaining(p, day12_5)).toBe(2); // 1.5 days left → ceil to 2
  });

  it('returns 0 once trial has expired', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    const day20 = new Date(start.getTime() + 20 * ONE_DAY_MS);
    expect(trialDaysRemaining(p, day20)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// hasAccess
// ─────────────────────────────────────────────────────────────────

describe('hasAccess', () => {
  it('grants for TRIAL and PRO', () => {
    expect(hasAccess('TRIAL')).toBe(true);
    expect(hasAccess('PRO')).toBe(true);
  });

  it('blocks NEW_USER and EXPIRED', () => {
    expect(hasAccess('NEW_USER')).toBe(false);
    expect(hasAccess('EXPIRED')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// shouldShowTrialBanner
// ─────────────────────────────────────────────────────────────────

describe('shouldShowTrialBanner', () => {
  it('does not show on day 0 (10+ days remaining)', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    expect(shouldShowTrialBanner(p, start)).toBe(false);
  });

  it('shows once we hit the warning window', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    const day12 = new Date(start.getTime() + 12 * ONE_DAY_MS); // 2 days remaining
    expect(TRIAL_WARNING_DAYS).toBe(3);
    expect(shouldShowTrialBanner(p, day12)).toBe(true);
  });

  it('does not show after expiry (paywall takes over instead)', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({ trialStartedAt: start.toISOString() });
    const day20 = new Date(start.getTime() + 20 * ONE_DAY_MS);
    expect(shouldShowTrialBanner(p, day20)).toBe(false);
  });

  it('does not show for PRO users', () => {
    const start = new Date(2026, 5, 1);
    const p = profile({
      trialStartedAt: start.toISOString(),
      devProOverride: true,
    });
    const day13 = new Date(start.getTime() + 13 * ONE_DAY_MS);
    expect(shouldShowTrialBanner(p, day13)).toBe(false);
  });
});
