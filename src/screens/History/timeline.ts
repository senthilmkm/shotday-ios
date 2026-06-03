// Shared types + helpers for the History screen sub-views (List, Calendar,
// Charts). Keeping these in one place means the three sub-views stay
// presentational and only render data — they never re-derive timeline
// shape themselves.

import type {
  DoseHistoryEntry,
  FoodEntry,
  Injection,
  InjectionZone,
  ShotdayDb,
  SideEffectChip,
  SideEffectEntry,
  SideEffectMetric,
} from '../../types/domain';

/**
 * One row on the unified timeline. The `kind` discriminator lets sub-
 * views switch on type without repeated `instanceof`/shape checks.
 */
export type TimelineEntry =
  | { kind: 'injection'; date: Date; data: Injection }
  | { kind: 'side-effect'; date: Date; data: SideEffectEntry }
  | { kind: 'food'; date: Date; data: FoodEntry }
  | { kind: 'dose-change'; date: Date; data: DoseHistoryEntry };

export const ZONE_LABEL: Record<InjectionZone, string> = {
  BELLY_UL: 'Upper-left belly',
  BELLY_UR: 'Upper-right belly',
  BELLY_LL: 'Lower-left belly',
  BELLY_LR: 'Lower-right belly',
  THIGH_L: 'Left thigh',
  THIGH_R: 'Right thigh',
  ARM_L: 'Left arm',
  ARM_R: 'Right arm',
  OTHER: 'Other site',
};

export const ZONE_SHORT_LABEL: Record<InjectionZone, string> = {
  BELLY_UL: 'Belly UL',
  BELLY_UR: 'Belly UR',
  BELLY_LL: 'Belly LL',
  BELLY_LR: 'Belly LR',
  THIGH_L: 'L thigh',
  THIGH_R: 'R thigh',
  ARM_L: 'L arm',
  ARM_R: 'R arm',
  OTHER: 'Other',
};

export const METRIC_LABEL: Record<SideEffectMetric, string> = {
  NAUSEA: 'Nausea',
  FATIGUE: 'Fatigue',
  CONSTIPATION: 'Constipation',
  APPETITE_SUPPRESSION: 'Appetite suppressed',
  MOOD: 'Low mood',
  ANXIETY: 'Anxiety',
};

export const CHIP_LABEL: Record<SideEffectChip, string> = {
  HEADACHE: 'Headache',
  HEARTBURN: 'Heartburn',
  SULFUR_BURPS: 'Sulfur burps',
  DIZZINESS: 'Dizziness',
  DIARRHEA: 'Diarrhea',
};

/** Returns the unified timeline (newest first). */
export function buildTimeline(db: ShotdayDb): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const inj of db.injections) {
    out.push({ kind: 'injection', date: new Date(inj.takenAt), data: inj });
  }
  for (const se of db.sideEffects) {
    out.push({ kind: 'side-effect', date: new Date(se.loggedAt), data: se });
  }
  for (const f of db.foods) {
    out.push({ kind: 'food', date: new Date(f.loggedAt), data: f });
  }
  for (const dc of db.doseHistory) {
    out.push({ kind: 'dose-change', date: new Date(dc.startedAt), data: dc });
  }
  out.sort((a, b) => b.date.getTime() - a.date.getTime());
  return out;
}

/** Returns midnight (local time) of the given date. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local-day key, e.g. "2026-06-02". Stable across timezones for the same wall clock. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Bucket entries by local-day key. */
export function bucketByDay(timeline: TimelineEntry[]): Map<string, TimelineEntry[]> {
  const out = new Map<string, TimelineEntry[]>();
  for (const e of timeline) {
    const key = dayKey(e.date);
    const list = out.get(key);
    if (list) list.push(e);
    else out.set(key, [e]);
  }
  return out;
}

/** Friendly label: "Today", "Yesterday", or "Wed, Jun 5". */
export function friendlyDateLabel(date: Date, now: Date = new Date()): string {
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return target.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Returns a copy of `db` with the given timeline entry removed from the
 * appropriate collection. Pure — caller persists via `updateDb`.
 */
export function removeTimelineEntry(db: ShotdayDb, entry: TimelineEntry): ShotdayDb {
  switch (entry.kind) {
    case 'injection':
      return { ...db, injections: db.injections.filter((i) => i.id !== entry.data.id) };
    case 'side-effect':
      return { ...db, sideEffects: db.sideEffects.filter((s) => s.id !== entry.data.id) };
    case 'food':
      return { ...db, foods: db.foods.filter((f) => f.id !== entry.data.id) };
    case 'dose-change':
      return { ...db, doseHistory: db.doseHistory.filter((d) => d.id !== entry.data.id) };
  }
}

/** Short, user-facing label of an entry kind for confirm dialogs. */
export function entryKindLabel(kind: TimelineEntry['kind']): string {
  switch (kind) {
    case 'injection':
      return 'shot';
    case 'side-effect':
      return 'check-in';
    case 'food':
      return 'food entry';
    case 'dose-change':
      return 'dose change';
  }
}

/**
 * Update an injection's `takenAt`. Used by the History "Edit time"
 * action so a user who logged a shot at the wrong time can fix the
 * record without losing the zone, dose, or row position. Pure —
 * caller persists via `updateDb`.
 */
export function updateInjectionTakenAt(
  db: ShotdayDb,
  injectionId: string,
  newTakenAt: Date,
): ShotdayDb {
  return {
    ...db,
    injections: db.injections.map((i) =>
      i.id === injectionId ? { ...i, takenAt: newTakenAt.toISOString() } : i,
    ),
  };
}
