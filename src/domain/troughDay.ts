/**
 * Trough Day — the named hungry-day in a weekly GLP-1 cycle.
 *
 * Free forever: phase name, ring fill, share text. Never exposes mg.
 * Pro still owns the numeric level curves (medicationLevel / concierge).
 */

import { daysSinceLastShot, daysUntilNext } from './dateMath';
import type { Injection, ShotdayDb } from '../types/domain';

export type TroughPhase =
  | 'NO_DATA'
  | 'SHOT_DAY'
  | 'PEAK'
  | 'STEADY'
  | 'TROUGH'
  | 'PRE_SHOT'
  | 'OVERDUE';

export interface TroughDayState {
  phase: TroughPhase;
  /** 0–1 ring fill. Shot day ≈ 1, trough ≈ low. */
  ringFill: number;
  /** Short badge, e.g. "TROUGH DAY". */
  badge: string;
  /** Hero line for Home. */
  headline: string;
  /** One sentence under the ring. */
  insight: string;
  /** Weekday label when known, e.g. "Thursday". */
  weekdayLabel: string | null;
  /** True when phase is TROUGH (viral share moment). */
  isTroughDay: boolean;
  daysSinceLastShot: number | null;
  daysUntilNextShot: number;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Maps calendar days since last shot → named cycle phase.
 * Aligned with cycleConcierge day windows (0 = shot day, 5–6 = trough).
 */
export function troughPhaseFromDaysSince(daysSince: number | null): TroughPhase {
  if (daysSince === null) return 'NO_DATA';
  if (daysSince === 0) return 'SHOT_DAY';
  if (daysSince >= 1 && daysSince <= 2) return 'PEAK';
  if (daysSince >= 3 && daysSince <= 4) return 'STEADY';
  if (daysSince >= 5 && daysSince <= 6) return 'TROUGH';
  if (daysSince === 7) return 'PRE_SHOT';
  return 'OVERDUE';
}

/** Ring fullness for the free Home visual (no mg). */
export function troughRingFill(phase: TroughPhase): number {
  switch (phase) {
    case 'SHOT_DAY':
      return 1;
    case 'PEAK':
      return 0.92;
    case 'STEADY':
      return 0.7;
    case 'TROUGH':
      return 0.32;
    case 'PRE_SHOT':
      return 0.22;
    case 'OVERDUE':
      return 0.12;
    case 'NO_DATA':
    default:
      return 0;
  }
}

function copyForPhase(
  phase: TroughPhase,
  weekdayLabel: string | null,
): Pick<TroughDayState, 'badge' | 'headline' | 'insight'> {
  const dayName = weekdayLabel ?? 'today';

  switch (phase) {
    case 'NO_DATA':
      return {
        badge: 'GET STARTED',
        headline: 'Log your first shot',
        insight: 'After you log, Shotday names the hungry days in your week so food noise feels like a curve — not failure.',
      };
    case 'SHOT_DAY':
      return {
        badge: 'SHOT DAY',
        headline: 'Shot day — ring is full',
        insight: 'Dose is landing. Stay ahead on water and protein.',
      };
    case 'PEAK':
      return {
        badge: 'PEAK SATIETY',
        headline: 'Peak satiety window',
        insight: 'Appetite is usually quietest here. Small, protein-forward meals still win.',
      };
    case 'STEADY':
      return {
        badge: 'STEADY',
        headline: 'Steady mid-cycle',
        insight: 'Levels are tapering gently. Keep the protein target honest.',
      };
    case 'TROUGH':
      return {
        badge: 'TROUGH DAY',
        headline: `Trough Day · ${dayName}`,
        insight: 'Food noise is the curve, not failure. Prioritize protein and fiber until your next shot.',
      };
    case 'PRE_SHOT':
      return {
        badge: 'ALMOST THERE',
        headline: 'Almost shot day',
        insight: 'Hunger can feel louder right before the next dose. Prep the pen and site.',
      };
    case 'OVERDUE':
      return {
        badge: 'SHOT OVERDUE',
        headline: 'Weekly shot is overdue',
        insight: 'Log when you take it so the Trough Day rhythm can reset.',
      };
  }
}

export function buildTroughDayState(db: ShotdayDb, now: Date = new Date()): TroughDayState {
  const since = daysSinceLastShot(db.injections, now);
  const daysUntil = daysUntilNext(db.profile.shotDay, now);
  const phase = troughPhaseFromDaysSince(since);
  const weekdayLabel = WEEKDAY_NAMES[now.getDay()] ?? null;
  const copy = copyForPhase(phase, weekdayLabel);

  return {
    phase,
    ringFill: troughRingFill(phase),
    badge: copy.badge,
    headline: copy.headline,
    insight: copy.insight,
    weekdayLabel,
    isTroughDay: phase === 'TROUGH',
    daysSinceLastShot: since,
    daysUntilNextShot: daysUntil,
  };
}

/**
 * Plain-text share body. Free forever — no mg, no weight, no Pro stats.
 */
export function buildTroughDayShareText(state: TroughDayState): string {
  if (state.phase === 'NO_DATA') {
    return [
      'Shotday names the hungry days in a GLP-1 week.',
      'Food noise is the curve, not failure.',
      '',
      'On this iPhone. Nowhere else.',
      'https://apps.apple.com/us/app/shotday/id6775780888',
    ].join('\n');
  }

  if (state.isTroughDay) {
    const day = state.weekdayLabel ?? 'today';
    return [
      `It’s Trough Day · ${day}.`,
      'Hunger today is pharmacology, not personality.',
      '',
      'Tracked on-device with Shotday.',
      'On this iPhone. Nowhere else.',
      'https://apps.apple.com/us/app/shotday/id6775780888',
    ].join('\n');
  }

  return [
    state.headline,
    state.insight,
    '',
    'Tracked on-device with Shotday.',
    'On this iPhone. Nowhere else.',
    'https://apps.apple.com/us/app/shotday/id6775780888',
  ].join('\n');
}

/** Test helper: phase from a synthetic injection list. */
export function troughPhaseFromInjections(
  injections: Injection[],
  now: Date,
): TroughPhase {
  return troughPhaseFromDaysSince(daysSinceLastShot(injections, now));
}
