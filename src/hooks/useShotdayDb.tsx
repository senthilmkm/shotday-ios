import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadDb, saveDb, clearDb, type KeyValueStore } from '../storage/storage';
import type { ShotdayDb } from '../types/domain';
import { EMPTY_DB } from '../types/domain';

interface DbContextValue {
  hydrated: boolean;
  db: ShotdayDb;
  /** Replace the DB entirely. Use sparingly. */
  setDb: (db: ShotdayDb) => void;
  /** Apply a partial mutation; auto-merges with previous state. */
  updateDb: (mutator: (prev: ShotdayDb) => ShotdayDb) => void;
  /** Wipes all data (used by Settings → Reset). */
  resetDb: () => Promise<void>;
}

const DbContext = createContext<DbContextValue | null>(null);

const asyncStorageWrapper: KeyValueStore = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

interface ProviderProps {
  store?: KeyValueStore;
  children: React.ReactNode;
}

export function ShotdayDbProvider({ store = asyncStorageWrapper, children }: ProviderProps): React.ReactElement {
  const [hydrated, setHydrated] = useState(false);
  const [db, setDbState] = useState<ShotdayDb>(EMPTY_DB);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadDb(store);
      if (!cancelled) {
        setDbState(loaded);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Debounced persistence — coalesces rapid writes (e.g., onboarding form edits).
  const schedulePersist = useCallback(
    (next: ShotdayDb) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        saveDb(store, next).catch((e) => console.warn('[shotday] saveDb failed', e));
      }, 250);
    },
    [store],
  );

  const setDb = useCallback(
    (next: ShotdayDb) => {
      setDbState(next);
      schedulePersist(next);
    },
    [schedulePersist],
  );

  const updateDb = useCallback(
    (mutator: (prev: ShotdayDb) => ShotdayDb) => {
      setDbState((prev) => {
        const next = mutator(prev);
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const resetDb = useCallback(async () => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    await clearDb(store);
    setDbState(EMPTY_DB);
  }, [store]);

  const value = useMemo<DbContextValue>(
    () => ({ hydrated, db, setDb, updateDb, resetDb }),
    [hydrated, db, setDb, updateDb, resetDb],
  );

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useShotdayDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useShotdayDb must be used inside <ShotdayDbProvider>');
  return ctx;
}
