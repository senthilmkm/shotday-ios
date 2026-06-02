// React hook that keeps OS-level scheduled notifications in sync with the
// current ShotdayDb. Strategy:
//   1. On mount: install the global handler.
//   2. After hydration + on every change to scheduling-relevant state,
//      recompute the plan and ship it to the OS via `applyPlan`.
//
// We deliberately key the effect off a small set of "scheduling-relevant"
// fields (not the entire db) so adding a side-effect entry doesn't trigger
// a reschedule. Side-effect logging has no notification implications.

import { useEffect, useRef } from 'react';
import { useShotdayDb } from '../hooks/useShotdayDb';
import {
  applyPlan,
  installNotificationHandler,
} from './scheduler';
import { planNotifications } from './schedule';

export function useNotificationSync(): void {
  const { db, hydrated } = useShotdayDb();
  const lastSyncKey = useRef<string | null>(null);

  useEffect(() => {
    installNotificationHandler();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!db.profile.onboardingComplete) return;

    // Cheap key to avoid duplicate work — only the fields that affect the
    // plan participate. JSON.stringify is fine here (plan dependencies are
    // small flat values).
    const key = JSON.stringify({
      shotDay: db.profile.shotDay,
      shotReminderHour: db.profile.shotReminderHour,
      sideEffectPromptHour: db.profile.sideEffectPromptHour,
      refillReminderHour: db.profile.refillReminderHour,
      quietHoursStart: db.profile.quietHoursStart,
      quietHoursEnd: db.profile.quietHoursEnd,
      currentDoseLabel: db.profile.currentDoseLabel,
      onboardingComplete: db.profile.onboardingComplete,
      // Refill nudge depends on injection count + lastFilledAt + requested flag.
      injectionCount: db.injections.length,
      lastInjectionAt: db.injections[0]?.takenAt ?? null,
      refill: db.refill,
    });
    if (key === lastSyncKey.current) return;
    lastSyncKey.current = key;

    const plan = planNotifications(db, new Date());
    applyPlan(plan).catch((e) => {
      console.warn('[shotday] notification sync failed', e);
    });
  }, [hydrated, db]);
}
