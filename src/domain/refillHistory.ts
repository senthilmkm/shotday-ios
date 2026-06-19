import type { RefillHistoryEntry, ShotdayDb } from '../types/domain';

export function refillEventsInRange(
  db: ShotdayDb,
  start: Date,
  end: Date,
): RefillHistoryEntry[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return [...db.refillHistory]
    .filter((entry) => {
      const t = new Date(entry.loggedAt).getTime();
      return t >= startMs && t <= endMs;
    })
    .sort(byLoggedAtAsc);
}

export function latestRefillPickup(db: ShotdayDb): RefillHistoryEntry | null {
  return [...db.refillHistory]
    .filter((entry) => entry.type === 'PICKED_UP')
    .sort(byLoggedAtAsc)
    .at(-1) ?? null;
}

function byLoggedAtAsc(a: RefillHistoryEntry, b: RefillHistoryEntry): number {
  return new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime();
}
