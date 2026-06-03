// Pure analytics helpers for the History → Charts view. Extracted from
// HistoryCharts.tsx so the math is independently testable. Anything in
// this file MUST be deterministic given (db, now) — no Date.now(),
// no random, no Math.random.

import type { InjectionZone, ShotdayDb } from '../../types/domain';
import { INJECTION_ZONES } from '../../types/domain';
import { peakMetric } from '../../domain/sideEffects';
import { totalProteinForDay } from '../../domain/food';
import { proteinTargetGrams } from '../../domain/protein';
import { startOfDay } from './timeline';

/**
 * Average days between consecutive shots. Returns null when fewer than
 * 2 shots are logged. Math is straightforward — sort by takenAt, sum
 * pairwise gaps, divide by N-1.
 */
export function avgIntervalDays(db: ShotdayDb): number | null {
  const dates = db.injections
    .map((i) => new Date(i.takenAt))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < 2) return null;
  let total = 0;
  for (let i = 1; i < dates.length; i++) {
    total += (dates[i]!.getTime() - dates[i - 1]!.getTime()) / (1000 * 60 * 60 * 24);
  }
  return total / (dates.length - 1);
}

/**
 * Mean peak symptom intensity over check-ins logged in the last
 * `windowDays` days. Returns null when there are no qualifying entries.
 *
 * Window is "rolling N days from `now`" by milliseconds — fine for a
 * stat that's meant to capture "your typical recent severity".
 */
export function averagePeakSymptom(
  db: ShotdayDb,
  windowDays: number,
  now: Date,
): number | null {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const recent = db.sideEffects.filter((s) => new Date(s.loggedAt).getTime() >= cutoff);
  if (recent.length === 0) return null;
  let total = 0;
  for (const s of recent) total += peakMetric(s);
  return total / recent.length;
}

/**
 * Result of `proteinHitRateInfo`. We deliberately return both numerator
 * and denominator so the UI can show "3 of 7 past days" instead of an
 * opaque "43%".
 */
export interface ProteinHitRateInfo {
  /** Days that hit target. */
  hits: number;
  /** Past completed days considered. Always <= windowDays. */
  days: number;
  /** Convenience: hits / days, or null if days = 0. */
  rate: number | null;
}

/**
 * Fraction of past completed days where the user hit their daily
 * protein target. Today is **excluded** because it's an in-progress
 * day — counting an unfinished day would unfairly drag the rate down.
 *
 * Returns null only when no protein target is computable (no weight).
 * Otherwise always returns a sensible object — `days = 0` when the user
 * has no past food entries at all, in which case `rate` is null and the
 * UI can show "—" or a friendly empty state.
 *
 * Bug fix: previously included today as one of N days, making fresh
 * installs read as 0% even when the user had perfect adherence.
 */
export function proteinHitRateInfo(
  db: ShotdayDb,
  windowDays: number,
  now: Date,
): ProteinHitRateInfo | null {
  if (db.profile.weight <= 0) return null;
  let target: number;
  try {
    target = proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
  } catch {
    return null;
  }
  if (target <= 0) return null;

  // Count only days from "yesterday" back to "windowDays days ago".
  // Today is in progress and excluded from both numerator and denominator.
  let hits = 0;
  for (let i = 1; i <= windowDays; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (totalProteinForDay(db.foods, d) >= target) hits++;
  }
  return {
    hits,
    days: windowDays,
    rate: windowDays > 0 ? hits / windowDays : null,
  };
}

/** Most-frequent injection zone all-time. Null with no shots. */
export function mostUsedZone(db: ShotdayDb): InjectionZone | null {
  if (db.injections.length === 0) return null;
  const counts = new Map<InjectionZone, number>();
  for (const inj of db.injections) {
    counts.set(inj.zone, (counts.get(inj.zone) ?? 0) + 1);
  }
  let top: InjectionZone | null = null;
  let topN = 0;
  for (const [zone, n] of counts) {
    if (n > topN) {
      top = zone;
      topN = n;
    }
  }
  return top;
}

/**
 * Last `n` symptom check-ins (chronological), each with its peak metric.
 * Sorts by `loggedAt` ascending so the line chart reads left-to-right
 * = past-to-present.
 */
export function recentSymptomPeaks(
  db: ShotdayDb,
  n: number,
): { date: Date; peak: number }[] {
  return [...db.sideEffects]
    .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())
    .slice(-n)
    .map((s) => ({ date: new Date(s.loggedAt), peak: peakMetric(s) }));
}

/**
 * Result of `proteinSeries`. The UI renders one bar per element of
 * `values`. `inProgressIndex` flags the rightmost bar as today (still
 * incomplete) so the chart can color it differently.
 *
 * If the user has no food history at all, returns `null` (caller shows
 * empty-state copy instead of a wall of zeros).
 */
export interface ProteinSeries {
  /** Fractions of target per day, oldest → newest. 0..N (no upper cap). */
  values: number[];
  /** Index of the today bar in `values`, or null when today is excluded. */
  inProgressIndex: number | null;
  /** Daily target in grams (snapshot of current settings). */
  targetG: number;
}

/**
 * Last `windowDays` of protein-hit ratios, oldest → newest.
 *
 * Bug fix: previously this returned a fixed-length series even for
 * users who'd only logged for a few days, padding the head with zero
 * bars that LOOKED like missed days. Now we trim to start at the user's
 * earliest food log (clipped to `windowDays`), so a 3-day-old user sees
 * 3 bars, not 14.
 *
 * Returns:
 *   - null     → no protein target computable (no weight)
 *   - { values: [], ... }  → user has weight but no food entries yet
 *   - else     → 1..windowDays bars
 */
export function proteinSeries(
  db: ShotdayDb,
  windowDays: number,
  now: Date,
): ProteinSeries | null {
  if (db.profile.weight <= 0) return null;
  let target: number;
  try {
    target = proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
  } catch {
    return null;
  }
  if (target <= 0) return null;

  // No food at all → empty values, caller shows empty state.
  if (db.foods.length === 0) {
    return { values: [], inProgressIndex: null, targetG: target };
  }

  // Earliest food entry's local-day. We won't show bars before this day.
  const earliest = db.foods
    .map((f) => new Date(f.loggedAt).getTime())
    .reduce((a, b) => Math.min(a, b), Infinity);
  const earliestDay = startOfDay(new Date(earliest));
  const today = startOfDay(now);

  // Compute the leftmost day to plot: max(today - windowDays + 1, earliestDay).
  const leftBound = new Date(today);
  leftBound.setDate(today.getDate() - (windowDays - 1));
  const start = leftBound.getTime() > earliestDay.getTime() ? leftBound : earliestDay;

  const days: number[] = [];
  const probe = new Date(start);
  while (probe.getTime() <= today.getTime()) {
    days.push(totalProteinForDay(db.foods, probe) / target);
    probe.setDate(probe.getDate() + 1);
  }

  return {
    values: days,
    inProgressIndex: days.length > 0 ? days.length - 1 : null,
    targetG: target,
  };
}

/**
 * Count of injections per zone, in declaration order so charts are
 * stable across renders. Always returns one row per zone, even when
 * count is 0 — the chart filters them at render time.
 */
export function zoneCounts(db: ShotdayDb): { zone: InjectionZone; count: number }[] {
  const counts = new Map<InjectionZone, number>();
  for (const z of INJECTION_ZONES) counts.set(z, 0);
  for (const inj of db.injections) {
    counts.set(inj.zone, (counts.get(inj.zone) ?? 0) + 1);
  }
  return INJECTION_ZONES.map((z) => ({ zone: z, count: counts.get(z) ?? 0 }));
}

// ───────────────────────────────────────────────────────────
// One-line takeaways shown under each chart
// ───────────────────────────────────────────────────────────

/**
 * Symptom trend takeaway. Compares the median of the first half against
 * the median of the second half so a single spike doesn't flip the
 * direction. Falls back to "steady" wording when there's not enough
 * signal.
 *
 * Bug fix: previously compared only first vs last point — `5,1,1,1,1,5`
 * read as "steady" despite a clear bookend spike pattern. Median split
 * is robust to that.
 */
export function symptomTakeawayText(series: { peak: number }[]): string | null {
  if (series.length < 4) {
    if (series.length < 2) return null;
    // Tiny samples — fall back to first vs last.
    const first = series[0]!.peak;
    const last = series[series.length - 1]!.peak;
    if (last < first - 0.5) return 'Trending down — symptoms easing.';
    if (last > first + 0.5) return 'Trending up — talk to your prescriber if it persists.';
    return 'Roughly steady over your last few check-ins.';
  }
  const half = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, half).map((s) => s.peak);
  const secondHalf = series.slice(series.length - half).map((s) => s.peak);
  const m1 = median(firstHalf);
  const m2 = median(secondHalf);
  if (m2 < m1 - 0.5) return 'Trending down — symptoms easing.';
  if (m2 > m1 + 0.5) return 'Trending up — talk to your prescriber if it persists.';
  return 'Roughly steady across your recent check-ins.';
}

export function proteinTakeawayText(info: ProteinSeries | null): string | null {
  if (!info || info.values.length === 0) return null;
  // Exclude today (in-progress) from the takeaway so we don't say
  // "0 of 14 days hit target" mid-morning.
  const completed =
    info.inProgressIndex !== null
      ? info.values.slice(0, info.inProgressIndex)
      : info.values;
  if (completed.length === 0) return null;
  const hit = completed.filter((v) => v >= 1).length;
  if (hit === 0) return 'No completed days at target yet — small wins still count.';
  return `${hit} of ${completed.length} past day${completed.length === 1 ? '' : 's'} hit the target.`;
}

export function zoneTakeawayText(
  rows: { zone: InjectionZone; count: number }[],
): string | null {
  const used = rows.filter((r) => r.count > 0);
  if (used.length === 0) return null;
  if (used.length >= 6) return "Strong rotation — you're using most of your sites.";
  if (used.length >= 3) return 'Decent rotation — try to vary across more zones.';
  return 'Try to spread shots across more zones to avoid skin issues.';
}

/**
 * Format avg-days-between-shots as a short user-facing string.
 *   7.0 → "7"
 *   6.84 → "6.8"
 *   12.5 → "12.5"
 * Trims a trailing ".0" so perfect weekly cadence reads as a clean integer.
 */
export function formatAvgInterval(days: number | null): string {
  if (days === null) return '—';
  const rounded = Math.round(days * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// ───────────────────────────────────────────────────────────
// Internals
// ───────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}
