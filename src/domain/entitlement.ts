// Entitlement state machine.
//
// Three independent inputs map to one of four states:
//
//   devProOverride                    → PRO    (highest priority)
//   proUntil > now                    → PRO
//   trialStartedAt + 14d > now        → TRIAL
//   trialStartedAt + 14d <= now       → EXPIRED
//   trialStartedAt === null           → NEW_USER
//
// PRO grants full access regardless of trial status. EXPIRED locks the
// experience behind the paywall (modal-on-launch in App.tsx). TRIAL is
// the happy path with a "Trial ends in N days" banner once we're inside
// the warning window.

import type { UserProfile } from '../types/domain';

export type EntitlementState = 'NEW_USER' | 'TRIAL' | 'EXPIRED' | 'PRO';

/** Length of the free trial in days. App Store-friendly default. */
export const TRIAL_DAYS = 14;

/** Days-remaining threshold below which we surface the trial-ending banner. */
export const TRIAL_WARNING_DAYS = 3;

/**
 * Computes the current entitlement state. Pure: same inputs → same output.
 * `now` is injected for deterministic testing.
 */
export function computeEntitlement(profile: UserProfile, now: Date): EntitlementState {
  if (profile.devProOverride) return 'PRO';

  if (profile.proUntil) {
    const proUntil = new Date(profile.proUntil).getTime();
    if (Number.isFinite(proUntil) && proUntil > now.getTime()) {
      return 'PRO';
    }
  }

  if (!profile.trialStartedAt) return 'NEW_USER';
  const start = new Date(profile.trialStartedAt).getTime();
  if (!Number.isFinite(start)) return 'NEW_USER';
  const expiry = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;

  return now.getTime() < expiry ? 'TRIAL' : 'EXPIRED';
}

/**
 * Days remaining in the trial. Returns 0 once expired (never negative).
 * Returns null when there's no trial (NEW_USER or PRO without trial start).
 */
export function trialDaysRemaining(profile: UserProfile, now: Date): number | null {
  if (!profile.trialStartedAt) return null;
  const start = new Date(profile.trialStartedAt).getTime();
  if (!Number.isFinite(start)) return null;
  const expiry = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const msLeft = expiry - now.getTime();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
}

/** Convenience: true when the user has full access (PRO or in trial). */
export function hasAccess(state: EntitlementState): boolean {
  return state === 'PRO' || state === 'TRIAL';
}

/** True when the trial-ending banner should appear on home. */
export function shouldShowTrialBanner(profile: UserProfile, now: Date): boolean {
  if (computeEntitlement(profile, now) !== 'TRIAL') return false;
  const days = trialDaysRemaining(profile, now);
  return days !== null && days <= TRIAL_WARNING_DAYS;
}
