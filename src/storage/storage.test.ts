import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_DB,
  type ShotdayDb,
} from '../types/domain';
import {
  STORAGE_KEY,
  clearDb,
  createMemoryStore,
  loadDb,
  saveDb,
} from './storage';

describe('loadDb', () => {
  it('returns EMPTY_DB when nothing is stored', async () => {
    const store = createMemoryStore();
    const db = await loadDb(store);
    expect(db).toEqual(EMPTY_DB);
  });

  it('returns a fresh clone (not the EMPTY_DB constant) so callers can mutate freely', async () => {
    const store = createMemoryStore();
    const db = await loadDb(store);
    db.injections.push({ id: 'x', takenAt: '2026-06-01T00:00:00Z', zone: 'BELLY_UL', doseMg: 0.5 });
    expect(EMPTY_DB.injections).toHaveLength(0); // didn't mutate the constant
  });

  it('round-trips a saved db through the store', async () => {
    const store = createMemoryStore();
    const db: ShotdayDb = {
      ...EMPTY_DB,
      injections: [
        { id: 'a', takenAt: '2026-05-31T09:00:00Z', zone: 'BELLY_UL', doseMg: 0.5 },
      ],
      profile: { ...EMPTY_DB.profile, weight: 175, weightUnit: 'LB' },
    };
    await saveDb(store, db);
    const loaded = await loadDb(store);
    expect(loaded.injections).toHaveLength(1);
    expect(loaded.injections[0]?.zone).toBe('BELLY_UL');
    expect(loaded.profile.weight).toBe(175);
  });

  it('returns EMPTY_DB on corrupt JSON instead of throwing', async () => {
    const store = createMemoryStore({ [STORAGE_KEY]: '{not valid json' });
    const db = await loadDb(store);
    expect(db).toEqual(EMPTY_DB);
  });

  it('returns EMPTY_DB on unknown schema version', async () => {
    const store = createMemoryStore({
      [STORAGE_KEY]: JSON.stringify({ schemaVersion: 99 }),
    });
    const db = await loadDb(store);
    expect(db).toEqual(EMPTY_DB);
  });

  it('back-fills missing arrays so the app never sees undefined collections', async () => {
    const partial = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profile: EMPTY_DB.profile,
      // injections, sideEffects, foods, doseHistory all missing
      refill: null,
    };
    const store = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(partial) });
    const db = await loadDb(store);
    expect(db.injections).toEqual([]);
    expect(db.sideEffects).toEqual([]);
    expect(db.foods).toEqual([]);
    expect(db.doseHistory).toEqual([]);
  });
});

describe('saveDb', () => {
  it('writes the full blob under STORAGE_KEY', async () => {
    const store = createMemoryStore();
    await saveDb(store, EMPTY_DB);
    const raw = await store.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(EMPTY_DB);
  });
});

describe('clearDb', () => {
  it('removes the stored value so subsequent loads start fresh', async () => {
    const store = createMemoryStore();
    await saveDb(store, { ...EMPTY_DB, profile: { ...EMPTY_DB.profile, weight: 999 } });
    await clearDb(store);
    const db = await loadDb(store);
    expect(db).toEqual(EMPTY_DB);
  });
});
