/**
 * Single source of truth for what stays free vs what Shotday Pro unlocks.
 *
 * Free forever (no subscription required after trial):
 *   Shot, Food, Symptoms, dose, refill, weight, history, local reminders, export,
 *   Trough Day (named cycle day + ring + text share — no mg).
 *
 * Pro only (TRIAL or paid PRO):
 *   Cycle Concierge (coach), smart alerts, weekly milestones, doctor reports,
 *   and medication-level curves (coach insight).
 *
 * Screens must gate Pro destinations with ProtectedFeature and/or
 * requireProAccess(). Do not show full Pro data on free surfaces.
 */

export const FREE_SHOT_LIMIT = 3;

/**
 * Checks if a user has reached or exceeded the free shot limit.
 * Free users can log up to 3 shots; logging a 4th shot requires Pro.
 */
export function isFreeShotLimitReached(injectionsCount: number, hasProAccess: boolean): boolean {
  if (hasProAccess) return false;
  return injectionsCount >= FREE_SHOT_LIMIT;
}

export const FREE_FOREVER_FEATURES = [
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
] as const;

export const PRO_ONLY_FEATURES = [
  'coach',
  'alerts',
  'milestones',
  'reports',
  'levels',
] as const;

export type FreeForeverFeature = (typeof FREE_FOREVER_FEATURES)[number];
export type ProOnlyFeature = (typeof PRO_ONLY_FEATURES)[number];

export const PRO_PAYWALL_BENEFITS = [
  {
    title: 'Unlimited shot logging',
    body: 'Log beyond the 3 free shots with unlimited dose history and tracking.',
  },
  {
    title: 'Smart GLP-1 coach',
    body: 'Cycle Concierge tells you what to log next. Estimated medication levels and peak/trough timing sit here too.',
  },
  {
    title: 'Smart alerts',
    body: 'In-app reminders when a shot, symptom check-in, protein log, or refill needs attention.',
  },
  {
    title: 'Weekly milestones',
    body: 'Progress score, 8-week rhythm, and weight-loss milestones that make consistency visible.',
  },
  {
    title: 'Doctor-ready report',
    body: 'Share shots, missed/late doses, symptoms, weight, protein, refills, and notes in one summary.',
  },
] as const;

