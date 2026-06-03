// Thin expo-notifications wrapper.
//
// Responsibilities:
//   1. Set the global notification handler so notifications appear while
//      the app is foregrounded.
//   2. Apply a `PlannedNotification[]` (computed by `planNotifications`)
//      to the OS scheduler — clear-then-apply so the OS state is always
//      a function of the plan, never accumulating ghosts.
//
// Permission state is read here but NOT requested — onboarding handles
// the prompt. If permission was denied, scheduling silently no-ops; the
// plan itself is still computed (so Settings can preview it) but never
// reaches the OS.

import * as Notifications from 'expo-notifications';
import { navigateFromNotification } from '../navigation/navigationRef';
import type { PlannedNotification } from './schedule';

let handlerInstalled = false;
let responseSubscription: Notifications.EventSubscription | null = null;

/** Idempotent. Call once on app boot. */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  // Tap-to-route. The identifier is `${CATEGORY}_${weekday}` for the
  // recurring notifications and just `REFILL_NUDGE` for the one-shot.
  // Either way we pluck the category off the front and let the nav
  // helper figure out where to land. Safe to register multiple times
  // (the `handlerInstalled` guard prevents duplicates) but we still
  // remove any prior subscription out of paranoia.
  responseSubscription?.remove();
  responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const id = response.notification.request.identifier ?? '';
    const category = id.split('_').slice(0, -1).join('_') || id;
    navigateFromNotification(category);
  });

  // Also handle a notification that LAUNCHED the app from a cold
  // start. iOS calls this `getLastNotificationResponse` and it fires
  // once with the response that triggered launch — we route the same
  // way as a foreground tap.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      const id = response.notification.request.identifier ?? '';
      const category = id.split('_').slice(0, -1).join('_') || id;
      navigateFromNotification(category);
    })
    .catch(() => {});
}

/** True when notifications are allowed by the OS. */
export async function hasPermission(): Promise<boolean> {
  const status = await Notifications.getPermissionsAsync();
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/**
 * Cancels every Shotday-managed notification. We use identifier prefixes
 * to scope cancellation — third-party notifications (none today) wouldn't
 * be touched.
 */
export async function cancelAllShotdayNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const id = n.identifier;
    if (
      id.startsWith('SHOT_REMINDER') ||
      id.startsWith('SIDE_EFFECT_PROMPT') ||
      id.startsWith('REFILL_NUDGE')
    ) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  }
}

/** Applies a notification plan to the OS scheduler. Clears prior Shotday plans first. */
export async function applyPlan(plan: PlannedNotification[]): Promise<void> {
  if (!(await hasPermission())) return;
  await cancelAllShotdayNotifications();

  for (const item of plan) {
    try {
      if (item.oneShotAt) {
        await Notifications.scheduleNotificationAsync({
          identifier: item.identifier,
          content: { title: item.title, body: item.body, sound: false },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.oneShotAt,
          },
        });
      } else if (item.weekday !== undefined) {
        await Notifications.scheduleNotificationAsync({
          identifier: item.identifier,
          content: { title: item.title, body: item.body, sound: false },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: item.weekday,
            hour: item.hour,
            minute: item.minute,
          },
        });
      }
    } catch (e) {
      console.warn('[shotday] failed to schedule notification', item.identifier, e);
    }
  }
}
