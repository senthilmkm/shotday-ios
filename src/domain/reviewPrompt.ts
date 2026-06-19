import { calendarDaysBetween } from './dateMath';
import { refillStatus } from './refill';
import { buildSmartAlerts } from './smartAlerts';
import type { ShotdayDb } from '../types/domain';

export const APP_STORE_REVIEW_URL = 'itms-apps://itunes.apple.com/app/id6775780888?action=write-review';
export const APP_STORE_REVIEW_WEB_URL = 'https://apps.apple.com/app/id6775780888?action=write-review';

const MIN_DAYS_SINCE_START = 7;
const MIN_SHOTS = 2;
const MIN_WEIGHTS = 2;
const PROMPT_COOLDOWN_DAYS = 45;

export function shouldShowSoftReviewPrompt(db: ShotdayDb, now: Date): boolean {
  if (!db.profile.onboardingComplete) return false;
  if (db.reviewPrompt.reviewedAt) return false;
  if (!hasCooldownPassed(db.reviewPrompt.lastShownAt, now)) return false;
  if (!hasCooldownPassed(db.reviewPrompt.lastDismissedAt, now)) return false;
  if (!hasEnoughTime(db, now)) return false;
  if (db.injections.length < MIN_SHOTS) return false;
  if (db.weightEntries.length < MIN_WEIGHTS) return false;
  if (!db.reviewPrompt.weeklyProgressViewedAt && !db.reviewPrompt.doctorReportViewedAt) return false;
  if (hasUrgentRefill(db, now)) return false;
  if (hasCoreDataGap(db, now)) return false;
  return true;
}

function hasEnoughTime(db: ShotdayDb, now: Date): boolean {
  const startIso =
    db.profile.trialStartedAt ??
    db.injections
      .map((entry) => entry.takenAt)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ??
    null;
  if (!startIso) return false;
  return calendarDaysBetween(new Date(startIso), now) >= MIN_DAYS_SINCE_START;
}

function hasCooldownPassed(iso: string | null, now: Date): boolean {
  if (!iso) return true;
  return calendarDaysBetween(new Date(iso), now) >= PROMPT_COOLDOWN_DAYS;
}

function hasUrgentRefill(db: ShotdayDb, now: Date): boolean {
  const refill = refillStatus(db.refill, db.injections, now);
  return refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY';
}

function hasCoreDataGap(db: ShotdayDb, now: Date): boolean {
  return buildSmartAlerts(db, now).some(
    (alert) =>
      alert.id.startsWith('medication-dose:') ||
      alert.id.startsWith('shot:') ||
      alert.id.startsWith('weight:') ||
      alert.id.startsWith('symptoms:') ||
      alert.id.startsWith('doctor-report-incomplete:'),
  );
}
