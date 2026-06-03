// Pure notification planner.
//
// Given a profile + db state + "now", returns a list of `PlannedNotification`
// objects describing what should be scheduled. The actual call into
// expo-notifications lives in `scheduler.ts` (which is just a thin wrapper
// around this plan + Notifications.scheduleNotificationAsync).
//
// Splitting plan-from-schedule lets us:
//   - unit-test scheduling logic on Node without a RN runtime
//   - render the planned schedule in Settings ("Your next reminder is...")
//   - run "what would happen if I changed shotDay to Saturday?" previews

import type { ShotdayDb } from '../types/domain';
import { refillStatus } from './../domain/refill';

/** Channel categories — used as a stable prefix for cancellation lookups. */
export type NotificationCategory =
  | 'SHOT_REMINDER'
  | 'SIDE_EFFECT_PROMPT'
  | 'REFILL_NUDGE';

export interface PlannedNotification {
  /** Stable identifier — `${category}_${weekday}` for weekly, `${category}` otherwise. */
  identifier: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /**
   * For weekly recurrences. 1=Sunday..7=Saturday in expo-notifications convention.
   * Hour: 0–23, Minute: 0–59.
   */
  weekday?: number;
  hour: number;
  minute: number;
  /**
   * For one-shot notifications (e.g., refill nudge tomorrow morning). When set,
   * this overrides the weekly recurrence and fires exactly once at this Date.
   */
  oneShotAt?: Date;
}

/** expo-notifications' weekday convention: 1=Sun..7=Sat. */
export const SUN = 1;
export const MON = 2;
export const TUE = 3;
export const WED = 4;
export const THU = 5;
export const FRI = 6;
export const SAT = 7;

const DAY_TO_NUM: Record<string, number> = {
  SUNDAY: SUN,
  MONDAY: MON,
  TUESDAY: TUE,
  WEDNESDAY: WED,
  THURSDAY: THU,
  FRIDAY: FRI,
  SATURDAY: SAT,
};

/** Adds days to a Date and returns a new Date (does not mutate input). */
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Computes the day-after-shot weekday number, wrapping Sunday→Monday correctly.
 * e.g., shot=SATURDAY (7) → day-after = SUNDAY (1).
 */
export function dayAfterWeekday(shotWeekday: number): number {
  return (shotWeekday % 7) + 1;
}

/**
 * Builds the full notification plan from current state.
 *
 * Plan composition:
 *   1. Weekly shot reminder — fires on shotDay at `shotReminderHour:00`.
 *   2. Weekly side-effect prompt — fires the day after at `sideEffectPromptHour:00`.
 *      Skipped if the user has notification permission for the side-effect channel
 *      explicitly disabled (future Settings toggle).
 *   3. Refill nudge — one-shot at `refillReminderHour:00` tomorrow when status
 *      is URGENT or EMPTY and they haven't yet marked "refill requested".
 *      We fire only one nudge per state transition; the scheduler clears
 *      previous instances before applying the new plan.
 *
 * Quiet hours: planner doesn't enforce quiet hours directly. Instead it
 * skips windows where the requested fire-time falls inside the quiet range,
 * deferring to the next valid slot. Today the user-set hours all default
 * outside quiet hours so this is a no-op; reserved for future Settings.
 */
export function planNotifications(
  db: ShotdayDb,
  now: Date,
): PlannedNotification[] {
  const plan: PlannedNotification[] = [];
  const profile = db.profile;
  if (!profile.onboardingComplete) return plan;
  // The user can flip a single in-app switch to silence ALL scheduled
  // reminders without revoking system permission. Honor that here so
  // a re-grant of the OS permission doesn't quietly bring back
  // notifications they already turned off.
  if (profile.notificationsEnabled === false) return plan;

  const shotWeekday = DAY_TO_NUM[profile.shotDay];
  if (shotWeekday === undefined) return plan;

  // 1. Weekly shot reminder.
  if (!isInQuietHours(profile.shotReminderHour, profile)) {
    plan.push({
      identifier: `SHOT_REMINDER_${shotWeekday}`,
      category: 'SHOT_REMINDER',
      title: 'Time for your shot',
      body: shotReminderBody(profile),
      weekday: shotWeekday,
      hour: profile.shotReminderHour,
      minute: 0,
    });
  }

  // 2. Weekly side-effect prompt (the day after).
  if (!isInQuietHours(profile.sideEffectPromptHour, profile)) {
    plan.push({
      identifier: `SIDE_EFFECT_PROMPT_${dayAfterWeekday(shotWeekday)}`,
      category: 'SIDE_EFFECT_PROMPT',
      title: 'Quick check-in',
      body: 'How are you feeling today?',
      weekday: dayAfterWeekday(shotWeekday),
      hour: profile.sideEffectPromptHour,
      minute: 0,
    });
  }

  // 3. Refill nudge (one-shot).
  const refill = refillStatus(db.refill, db.injections, now);
  if (
    !refill.unconfigured &&
    (refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY') &&
    !refill.refillRequested
  ) {
    const fireAt = nextHour(now, profile.refillReminderHour);
    plan.push({
      identifier: 'REFILL_NUDGE',
      category: 'REFILL_NUDGE',
      title: refill.alertLevel === 'EMPTY' ? 'No doses left' : 'Refill time',
      body:
        refill.alertLevel === 'EMPTY'
          ? 'Pick up your refill before your next shot.'
          : `${refill.dosesRemaining} dose${refill.dosesRemaining === 1 ? '' : 's'} left — request a refill.`,
      hour: profile.refillReminderHour,
      minute: 0,
      oneShotAt: fireAt,
    });
  }

  return plan;
}

/** Body copy for the weekly shot reminder, varies based on whether dose is set. */
function shotReminderBody(profile: ShotdayDb['profile']): string {
  if (profile.currentDoseLabel) {
    return `Tap to log your ${profile.currentDoseLabel} shot and pick a site.`;
  }
  return 'Tap to log your shot and pick a site.';
}

/** Returns the next occurrence of `hour:00` strictly after `now`. */
export function nextHour(now: Date, hour: number): Date {
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/** True when the requested hour falls inside the user's quiet hours. */
export function isInQuietHours(hour: number, profile: ShotdayDb['profile']): boolean {
  const start = profile.quietHoursStart;
  const end = profile.quietHoursEnd;
  if (start === end) return false;
  if (start < end) {
    return hour >= start && hour < end;
  }
  // Wrap across midnight (e.g. 22→7).
  return hour >= start || hour < end;
}

// Re-export addDays for tests + external callers (e.g., Settings preview).
export { addDays };
