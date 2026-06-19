import { calendarDaysBetween, dateOnly, dayAfterShot, mostRecentInjection } from './dateMath';
import { daysUntilEligibleToBump, nextRung } from './dose';
import { totalProteinForDay } from './food';
import { proteinTargetGrams } from './protein';
import { refillStatus } from './refill';
import { currentShotWindow } from './weeklyProgress';
import type { ShotdayDb, SmartAlertStorage } from '../types/domain';

export type SmartAlertAction =
  | 'DOSE'
  | 'SHOT'
  | 'WEIGHT'
  | 'SYMPTOMS'
  | 'FOOD'
  | 'REFILL'
  | 'WEEKLY_PROGRESS'
  | 'DOCTOR_REPORT'
  | 'SETTINGS_EXPORT';

export type SmartAlertIcon =
  | 'settings'
  | 'syringe'
  | 'scale'
  | 'heart'
  | 'utensils'
  | 'pill'
  | 'file'
  | 'download';

export interface SmartAlert {
  id: string;
  title: string;
  detail: string;
  why: string;
  priority: number;
  createdAt: string;
  expiresAt: string;
  read: boolean;
  action?: {
    type: SmartAlertAction;
    label: string;
    icon: SmartAlertIcon;
  };
}

const ALERT_TTL_DAYS = 30;
const DOCTOR_REPORT_DAYS = 90;
const PROTEIN_REPORT_DAYS = 14;
const PROTEIN_ALERT_HOUR = 17;

export function buildSmartAlerts(
  db: ShotdayDb,
  now: Date,
  state: SmartAlertStorage = db.smartAlerts,
): SmartAlert[] {
  const raw = buildRawAlerts(db, now);
  return raw
    .filter((alert) => new Date(alert.expiresAt).getTime() >= now.getTime())
    .map((alert) => ({
      ...alert,
      read: Boolean(state.byId[alert.id]?.readAt),
    }))
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

export function unreadSmartAlertCount(alerts: SmartAlert[]): number {
  return alerts.filter((alert) => !alert.read).length;
}

export function markSmartAlertsSeen(
  state: SmartAlertStorage,
  alerts: SmartAlert[],
  now: Date,
): SmartAlertStorage {
  const nowIso = now.toISOString();
  const byId = { ...state.byId };
  for (const alert of alerts) {
    byId[alert.id] = {
      firstSeenAt: byId[alert.id]?.firstSeenAt ?? alert.createdAt,
      readAt: byId[alert.id]?.readAt ?? nowIso,
    };
  }
  return { byId: pruneOldAlertState(byId, now) };
}

function buildRawAlerts(db: ShotdayDb, now: Date): Omit<SmartAlert, 'read'>[] {
  const alerts: Omit<SmartAlert, 'read'>[] = [];
  const window = currentShotWindow(db.profile.shotDay, now);
  const cycleKey = dateKey(window.start);
  const todayKey = dateKey(now);

  if (!db.profile.onboardingComplete || db.profile.currentDoseMg <= 0 || !db.profile.currentDoseLabel) {
    alerts.push(alert({
      id: `medication-dose:${cycleKey}`,
      title: 'Set current medication + dose',
      detail: 'Shotday needs your current drug and dose before it can create an accurate doctor report.',
      why: 'Used for current medication, dose history, shot logs, and doctor visit summaries.',
      priority: 10,
      createdAt: window.start,
      action: { type: 'DOSE', label: 'Update dose', icon: 'settings' },
    }));
  }

  const shotLogged = db.injections.some((injection) => inRange(injection.takenAt, window.start, window.end));
  if (!shotLogged) {
    alerts.push(alert({
      id: `shot:${cycleKey}`,
      title: "Log this week's shot",
      detail: 'No injection is logged for this shot cycle yet.',
      why: 'Needed for adherence, missed/late shots, weekly progress, and doctor report accuracy.',
      priority: 20,
      createdAt: window.start,
      action: { type: 'SHOT', label: 'Log shot', icon: 'syringe' },
    }));
  }

  const weightLogged = db.weightEntries.some((entry) => inRange(entry.loggedAt, window.start, window.end));
  if (!weightLogged) {
    alerts.push(alert({
      id: `weight:${cycleKey}`,
      title: "Add this week's weight",
      detail: 'One weekly weight keeps trends useful without asking you to weigh in every day.',
      why: 'Needed for weight trend, milestones, protein target accuracy, weekly progress, and doctor reports.',
      priority: 30,
      createdAt: window.start,
      action: { type: 'WEIGHT', label: 'Add weight', icon: 'scale' },
    }));
  }

  const lastShot = mostRecentInjection(db.injections);
  const postShotDay = dayAfterShot(db.injections, now);
  if (
    lastShot &&
    postShotDay !== null &&
    !db.sideEffects.some((entry) => new Date(entry.loggedAt).getTime() >= new Date(lastShot.takenAt).getTime())
  ) {
    alerts.push(alert({
      id: `symptoms:${dateKey(new Date(lastShot.takenAt))}`,
      title: 'Check symptoms after shot',
      detail: `It is day ${postShotDay} after your last shot. A quick check-in helps spot dose tolerance patterns.`,
      why: 'Needed for side effects by week, symptom trends, and doctor visit summaries.',
      priority: 40,
      createdAt: dateOnly(new Date(lastShot.takenAt)),
      action: { type: 'SYMPTOMS', label: 'Check symptoms', icon: 'heart' },
    }));
  }

  if (now.getHours() >= PROTEIN_ALERT_HOUR && db.profile.weight > 0 && totalProteinForDay(db.foods, now) === 0) {
    alerts.push(alert({
      id: `protein:${todayKey}`,
      title: 'Log protein today',
      detail: `Your daily protein target is ${safeProteinTarget(db)} g. No protein is logged today yet.`,
      why: 'Needed for protein trend, weekly progress, and doctor report context.',
      priority: 50,
      createdAt: dateOnly(now),
      action: { type: 'FOOD', label: 'Log protein', icon: 'utensils' },
    }));
  }

  if (!db.refill) {
    alerts.push(alert({
      id: `refill-setup:${cycleKey}`,
      title: 'Set refill tracking',
      detail: 'Refill tracking is not configured yet.',
      why: 'Needed for refill risk, refill history, and doctor report completeness.',
      priority: 60,
      createdAt: window.start,
      action: { type: 'REFILL', label: 'Set refill', icon: 'pill' },
    }));
  } else {
    const refill = refillStatus(db.refill, db.injections, now);
    if (refill.refillRequested) {
      alerts.push(alert({
        id: `refill-picked-up:${cycleKey}`,
        title: 'Mark refill picked up',
        detail: 'Your refill is marked requested. Update Shotday when you pick it up.',
        why: 'Prevents refill status from staying urgent or empty after your medication is restocked.',
        priority: 62,
        createdAt: window.start,
        action: { type: 'REFILL', label: 'Mark picked up', icon: 'pill' },
      }));
    } else if (refill.alertLevel === 'INFO' || refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY') {
      alerts.push(alert({
        id: `refill-risk:${cycleKey}`,
        title: refill.alertLevel === 'EMPTY' ? 'Refill may be out' : 'Refill coming up',
        detail:
          refill.alertLevel === 'EMPTY'
            ? 'Your logged doses suggest no doses remain in the current pen or vial.'
            : `${refill.dosesRemaining} of ${refill.dosesPerPen} doses may remain.`,
        why: 'Helps prevent medication supply gaps and keeps refill history accurate.',
        priority: 61,
        createdAt: window.start,
        action: { type: 'REFILL', label: 'Review refill', icon: 'pill' },
      }));
    }
  }

  const lastDoseChange = db.doseHistory[db.doseHistory.length - 1];
  const upcomingDose = nextRung(db.profile.drug, db.profile.currentDoseMg);
  if (
    db.profile.currentDoseMg > 0 &&
    upcomingDose &&
    lastDoseChange &&
    daysUntilEligibleToBump(new Date(lastDoseChange.startedAt), now) === 0
  ) {
    alerts.push(alert({
      id: `dose-review:${cycleKey}`,
      title: 'Confirm dose change',
      detail: `You may be eligible to review ${upcomingDose.label}. Only update this if your clinician changed your dose.`,
      why: 'Keeps future shot logs and doctor reports aligned with the dose you are actually taking.',
      priority: 70,
      createdAt: window.start,
      action: { type: 'DOSE', label: 'Review dose', icon: 'settings' },
    }));
  }

  const missingReportSections = doctorReportMissingSections(db, now);
  if (missingReportSections.length > 0) {
    const firstAction = missingReportSections[0]!.action;
    alerts.push(alert({
      id: `doctor-report-incomplete:${cycleKey}`,
      title: 'Doctor report data incomplete',
      detail: `Missing: ${missingReportSections.map((section) => section.label).join(', ')}.`,
      why: 'Complete these basics so the doctor report is useful instead of sparse.',
      priority: 80,
      createdAt: window.start,
      action: firstAction,
    }));
  } else {
    alerts.push(alert({
      id: `doctor-report-ready:${cycleKey}`,
      title: 'Doctor report ready',
      detail: 'You have enough recent data to create a useful doctor visit summary.',
      why: 'Helpful before appointments or when messaging your clinician.',
      priority: 85,
      createdAt: window.start,
      action: { type: 'DOCTOR_REPORT', label: 'Create report', icon: 'file' },
    }));
  }

  alerts.push(alert({
    id: `export-backup:${backupPeriodKey(now)}`,
    title: 'Export / backup reminder',
    detail: 'Share a JSON or CSV copy with yourself if you want a personal backup.',
    why: 'Keeps your health log portable and gives you a record outside the app.',
    priority: 90,
    createdAt: backupPeriodStart(now),
    action: { type: 'SETTINGS_EXPORT', label: 'Export data', icon: 'download' },
  }));

  return alerts;
}

function alert(input: {
  id: string;
  title: string;
  detail: string;
  why: string;
  priority: number;
  createdAt: Date;
  action?: SmartAlert['action'];
}): Omit<SmartAlert, 'read'> {
  const expiresAt = new Date(input.createdAt);
  expiresAt.setDate(expiresAt.getDate() + ALERT_TTL_DAYS);
  return {
    ...input,
    createdAt: input.createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function safeProteinTarget(db: ShotdayDb): number {
  try {
    return proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
  } catch {
    return 0;
  }
}

function doctorReportMissingSections(db: ShotdayDb, now: Date): { label: string; action: NonNullable<SmartAlert['action']> }[] {
  const missing: { label: string; action: NonNullable<SmartAlert['action']> }[] = [];
  const reportStart = new Date(now);
  reportStart.setDate(reportStart.getDate() - DOCTOR_REPORT_DAYS);
  const proteinStart = new Date(now);
  proteinStart.setDate(proteinStart.getDate() - PROTEIN_REPORT_DAYS);

  if (db.profile.currentDoseMg <= 0 || !db.profile.currentDoseLabel) {
    missing.push({ label: 'current dose', action: { type: 'DOSE', label: 'Update dose', icon: 'settings' } });
  }
  if (!db.injections.some((entry) => inRange(entry.takenAt, reportStart, now))) {
    missing.push({ label: 'recent injection history', action: { type: 'SHOT', label: 'Log shot', icon: 'syringe' } });
  }
  if (db.weightEntries.filter((entry) => inRange(entry.loggedAt, reportStart, now)).length < 2) {
    missing.push({ label: 'recent weight trend', action: { type: 'WEIGHT', label: 'Add weight', icon: 'scale' } });
  }
  if (!db.sideEffects.some((entry) => inRange(entry.loggedAt, reportStart, now))) {
    missing.push({ label: 'recent symptom history', action: { type: 'SYMPTOMS', label: 'Check symptoms', icon: 'heart' } });
  }
  if (!db.foods.some((entry) => inRange(entry.loggedAt, proteinStart, now))) {
    missing.push({ label: 'recent protein trend', action: { type: 'FOOD', label: 'Log protein', icon: 'utensils' } });
  }
  if (!db.refill && !db.refillHistory.some((entry) => inRange(entry.loggedAt, reportStart, now))) {
    missing.push({ label: 'recent refill history', action: { type: 'REFILL', label: 'Set refill', icon: 'pill' } });
  }
  return missing;
}

function pruneOldAlertState(
  byId: SmartAlertStorage['byId'],
  now: Date,
): SmartAlertStorage['byId'] {
  const out: SmartAlertStorage['byId'] = {};
  for (const [id, meta] of Object.entries(byId)) {
    if (calendarDaysBetween(new Date(meta.firstSeenAt), now) <= ALERT_TTL_DAYS + 7) {
      out[id] = meta;
    }
  }
  return out;
}

function dateKey(date: Date): string {
  const d = dateOnly(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function backupPeriodKey(now: Date): string {
  return backupPeriodStart(now).toISOString().slice(0, 10);
}

function backupPeriodStart(now: Date): Date {
  const start = dateOnly(now);
  const bucket = Math.floor(start.getTime() / (ALERT_TTL_DAYS * 24 * 60 * 60 * 1000));
  return new Date(bucket * ALERT_TTL_DAYS * 24 * 60 * 60 * 1000);
}
