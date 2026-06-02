// Injection-site rotation algorithm.
//
// Goal: prevent lipohypertrophy (lumpy fat tissue from repeat injections in
// the same place). The rule of thumb is to never inject in the same zone
// two weeks in a row, and to rotate across all available zones over time.
//
// We keep this as a pure function so the body-diagram component can render
// the "suggested next" pulsing ring without knowing anything about storage.

import { INJECTION_ZONES, type Injection, type InjectionZone } from '../types/domain';

/**
 * Picks the next injection zone the user should use, given their recent
 * history. Strategy:
 *   1. Exclude zones used in the last `lookbackInjections` history entries
 *      (default 1 — never the same zone two weeks running).
 *   2. From the remaining zones, pick the one used LEAST recently (or never).
 *   3. Stable tiebreaker: order in INJECTION_ZONES (so behavior is deterministic
 *      for tests + the user sees a predictable rotation pattern across weeks).
 *
 * Always returns one of the 8 anatomical zones — never 'OTHER' (Other is
 * a manual escape hatch the user picks themselves; we don't auto-suggest it).
 */
export function suggestNextZone(
  history: Injection[],
  lookbackInjections: number = 1,
): InjectionZone {
  // Anatomical zones only — exclude OTHER from suggestions.
  const candidates: InjectionZone[] = INJECTION_ZONES.filter((z) => z !== 'OTHER');

  // Sort history newest-first.
  const sorted = [...history].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );

  const recentlyUsed = new Set(
    sorted.slice(0, lookbackInjections).map((i) => i.zone),
  );

  // Compute "last used at" for each candidate. Never used = -Infinity (most preferred).
  const lastUsedMs = new Map<InjectionZone, number>();
  for (const inj of sorted) {
    if (!lastUsedMs.has(inj.zone)) {
      lastUsedMs.set(inj.zone, new Date(inj.takenAt).getTime());
    }
  }

  // Filter out recently-used; if that empties the pool (very small history),
  // fall back to all candidates to avoid returning undefined.
  const filtered = candidates.filter((z) => !recentlyUsed.has(z));
  const pool = filtered.length > 0 ? filtered : candidates;

  // Pick the zone used least recently. Stable order via candidates array.
  let best: InjectionZone = pool[0]!;
  let bestMs = lastUsedMs.get(best) ?? Number.NEGATIVE_INFINITY;
  for (const z of pool) {
    const ms = lastUsedMs.get(z) ?? Number.NEGATIVE_INFINITY;
    if (ms < bestMs) {
      best = z;
      bestMs = ms;
    }
  }
  return best;
}

/**
 * Returns the zone used in the most recent injection, or null if none.
 * The body-diagram screen greys this zone out with a "last week" label.
 */
export function lastUsedZone(history: Injection[]): InjectionZone | null {
  if (history.length === 0) return null;
  const sorted = [...history].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );
  return sorted[0]?.zone ?? null;
}
