// Side-effect domain helpers — building, validating and reading entries.

import {
  SIDE_EFFECT_METRICS,
  type Injection,
  type SideEffectChip,
  type SideEffectEntry,
  type SideEffectMetric,
} from '../types/domain';
import { dayAfterShot, mostRecentInjection } from './dateMath';

/** Default metrics object — all metrics at 1 (none). */
export function defaultMetrics(): Record<SideEffectMetric, number> {
  const out = {} as Record<SideEffectMetric, number>;
  for (const m of SIDE_EFFECT_METRICS) {
    out[m] = 1;
  }
  return out;
}

interface BuildArgs {
  metrics: Record<SideEffectMetric, number>;
  chips: SideEffectChip[];
  customSymptoms: string[];
  injections: Injection[];
  now: Date;
}

/**
 * Builds a SideEffectEntry from form state.
 * Snapshots the most recent injection's dose so the entry is meaningful even
 * after the user later changes their current dose.
 *
 * Returns null when there's no recent injection (we still allow logging
 * "ad hoc" feelings, in which case dayAfterShot defaults to 1 and doseMg
 * snapshots from the user's current profile dose — see buildAdHoc below).
 */
export function buildPostShotEntry({
  metrics,
  chips,
  customSymptoms,
  injections,
  now,
}: BuildArgs): SideEffectEntry | null {
  const last = mostRecentInjection(injections);
  const day = dayAfterShot(injections, now);
  if (!last || day === null) return null;
  return {
    id: `se-${now.getTime()}`,
    loggedAt: now.toISOString(),
    dayAfterShot: day,
    metrics: { ...metrics },
    chips: [...chips],
    customSymptoms: customSymptoms.map((s) => s.trim()).filter(Boolean),
    doseMg: last.doseMg,
  };
}

interface BuildAdHocArgs {
  metrics: Record<SideEffectMetric, number>;
  chips: SideEffectChip[];
  customSymptoms: string[];
  /**
   * Day-after-shot to stamp on the entry. Callers should pass the
   * REAL day (use `dayAfterShotClamped`) — not 1. Earlier versions
   * defaulted to 1 even on day 5 reports, which silently corrupted
   * the symptom timeline.
   */
  dayAfterShot?: number;
  /** Dose to snapshot. Pull from profile.currentDoseMg. */
  doseMg: number;
  now: Date;
}

/**
 * Builds an entry "out of window" or with no injection history.
 *
 * `dayAfterShot` defaults to 1 ONLY as an absolute fallback when the
 * caller cannot compute it (no shot history at all). Callers with
 * shot history should pass `dayAfterShotClamped(injections, now)`.
 */
export function buildAdHocEntry({
  metrics,
  chips,
  customSymptoms,
  dayAfterShot = 1,
  doseMg,
  now,
}: BuildAdHocArgs): SideEffectEntry {
  return {
    id: `se-${now.getTime()}`,
    loggedAt: now.toISOString(),
    dayAfterShot,
    metrics: { ...metrics },
    chips: [...chips],
    customSymptoms: customSymptoms.map((s) => s.trim()).filter(Boolean),
    doseMg,
  };
}

/** Returns the highest metric value across all 4 metrics — used for the "intensity" badge. */
export function peakMetric(entry: SideEffectEntry): number {
  let max = 0;
  for (const m of SIDE_EFFECT_METRICS) {
    const v = entry.metrics[m] ?? 1;
    if (v > max) max = v;
  }
  return max;
}

/** True when the entry recorded any non-default symptoms. */
export function isSignificant(entry: SideEffectEntry): boolean {
  if (peakMetric(entry) > 1) return true;
  if (entry.chips.length > 0) return true;
  if (entry.customSymptoms.length > 0) return true;
  return false;
}
