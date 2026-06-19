// Single-file persistence layer.
//
// All Shotday data lives under one AsyncStorage key as a JSON blob. Reads
// hydrate once at app launch into in-memory state; writes serialize the
// whole blob and persist atomically. With expected lifetime data (~50 KB
// after years of use) this is dramatically simpler than per-collection
// keys and avoids partial-write inconsistencies.
//
// We DO NOT import @react-native-async-storage/async-storage directly —
// instead callers inject a tiny `KeyValueStore` interface. This makes the
// storage layer fully testable in Node (Jest) without a RN runtime, and
// keeps the door open for swapping in expo-sqlite later if the JSON blob
// gets too large.

import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_DB,
  type ShotdayDb,
} from '../types/domain';

export const STORAGE_KEY = '@shotday/db/v1';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Reads the persisted DB and returns it. Returns a fresh EMPTY_DB clone
 * when nothing is stored or the stored value is corrupt — never throws.
 * Corrupt-detection log is intentional; callers can surface it in a debug
 * toast in development builds.
 */
export async function loadDb(store: KeyValueStore): Promise<ShotdayDb> {
  try {
    const raw = await store.getItem(STORAGE_KEY);
    if (!raw) return cloneEmpty();
    const parsed = JSON.parse(raw) as ShotdayDb;
    return migrate(parsed);
  } catch (e) {
    console.warn('[shotday] loadDb failed, returning empty db', e);
    return cloneEmpty();
  }
}

/** Persists the DB. Always writes the full blob — see file header. */
export async function saveDb(store: KeyValueStore, db: ShotdayDb): Promise<void> {
  await store.setItem(STORAGE_KEY, JSON.stringify(db));
}

/** Wipes all Shotday data. Used by the "Reset app" button in Settings. */
export async function clearDb(store: KeyValueStore): Promise<void> {
  await store.removeItem(STORAGE_KEY);
}

function cloneEmpty(): ShotdayDb {
  return JSON.parse(JSON.stringify(EMPTY_DB)) as ShotdayDb;
}

/**
 * Schema migration. v1 is current; once the shape changes we'll add
 * v1→v2 here and bump CURRENT_SCHEMA_VERSION. Older versions that we
 * can't upgrade get reset to EMPTY_DB rather than crashing the app.
 */
function migrate(db: ShotdayDb): ShotdayDb {
  if (!db || typeof db !== 'object') return cloneEmpty();
  if (db.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    console.warn('[shotday] unknown schema version, resetting:', db.schemaVersion);
    return cloneEmpty();
  }
  // Defensive: ensure required arrays + new profile fields exist on the
  // loaded blob in case a future build adds a field that an older blob
  // lacks. The profile spread is structured so EMPTY_DB defaults are
  // applied first, then the persisted profile overrides them — so old
  // blobs without `trialStartedAt` or `proUntil` get safe nulls instead
  // of `undefined`, while existing user data is preserved.
  const empty = cloneEmpty();
  const profile = { ...empty.profile, ...(db.profile ?? {}) };
  const rawWeightEntries = Array.isArray(db.weightEntries) ? db.weightEntries : [];
  const rawRefillHistory = Array.isArray(db.refillHistory) ? db.refillHistory : [];
  const refill = db.refill ?? null;
  const weightEntries =
    rawWeightEntries.length === 0 && profile.weight > 0
      ? [
          {
            id: 'weight-migrated-current',
            loggedAt: profile.weightUpdatedAt ?? '1970-01-01T00:00:00.000Z',
            weight: profile.weight,
            unit: profile.weightUnit,
            note: 'Migrated current weight',
          },
        ]
      : rawWeightEntries;
  const refillHistory =
    rawRefillHistory.length === 0 && refill
      ? [
          {
            id: 'refill-migrated-current',
            type: 'SETUP' as const,
            loggedAt: refill.lastFilledAt,
            dosesPerPen: refill.dosesPerPen,
            lastFilledAt: refill.lastFilledAt,
            note: 'Migrated current refill setup',
          },
        ]
      : rawRefillHistory;
  return {
    ...empty,
    ...db,
    profile,
    injections: Array.isArray(db.injections) ? db.injections : [],
    sideEffects: Array.isArray(db.sideEffects) ? db.sideEffects : [],
    foods: Array.isArray(db.foods) ? db.foods : [],
    weightEntries,
    doseHistory: Array.isArray(db.doseHistory) ? db.doseHistory : [],
    refill,
    refillHistory,
    smartAlerts:
      db.smartAlerts && typeof db.smartAlerts === 'object' && db.smartAlerts.byId
        ? { byId: db.smartAlerts.byId }
        : empty.smartAlerts,
  };
}

// ────────────────────────────────────────────────────────────────────
// Test-only in-memory store
// ────────────────────────────────────────────────────────────────────

/** A simple in-memory implementation of KeyValueStore for tests + previews. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    async getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}
