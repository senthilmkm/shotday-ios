import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeEntitlement, hasAccess, type EntitlementState } from '../domain/entitlement';
import { useShotdayDb } from './useShotdayDb';

interface ProAccess {
  entitlement: EntitlementState;
  hasProAccess: boolean;
  openPaywall: () => void;
  requireProAccess: () => boolean;
}

export function useProAccess(now?: Date): ProAccess {
  const navigation = useNavigation<any>();
  const { db } = useShotdayDb();
  const [fallbackNow, setFallbackNow] = useState(() => new Date());
  const effectiveNow = now ?? fallbackNow;

  useEffect(() => {
    if (now) return;
    const timer = setInterval(() => setFallbackNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, [now]);

  const entitlement = useMemo(
    () => computeEntitlement(db.profile, effectiveNow),
    [db.profile, effectiveNow],
  );
  const hasProAccess = hasAccess(entitlement);

  const openPaywall = useCallback((): void => {
    const parent = typeof navigation.getParent === 'function' ? navigation.getParent() : undefined;
    const target = parent ?? navigation;
    target.navigate('Paywall');
  }, [navigation]);

  const requireProAccess = useCallback((): boolean => {
    if (hasProAccess) return true;
    openPaywall();
    return false;
  }, [hasProAccess, openPaywall]);

  return {
    entitlement,
    hasProAccess,
    openPaywall,
    requireProAccess,
  };
}
