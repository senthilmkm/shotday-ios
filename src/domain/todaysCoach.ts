import { daysSinceLastShot, daysUntilNext } from './dateMath';
import { buildSmartAlerts, type SmartAlertAction, type SmartAlertIcon } from './smartAlerts';
import type { ShotdayDb } from '../types/domain';

export interface CoachAction {
  type: SmartAlertAction;
  label: string;
  icon: SmartAlertIcon;
}

export interface TodaysCoach {
  eyebrow: string;
  title: string;
  detail: string;
  actions: CoachAction[];
}

export function buildTodaysCoach(db: ShotdayDb, now: Date): TodaysCoach {
  const alerts = buildSmartAlerts(db, now);
  const primary =
    findByIdPrefix(alerts, 'medication-dose:') ??
    findByIdPrefix(alerts, 'shot:') ??
    findByIdPrefix(alerts, 'symptoms:') ??
    findByIdPrefix(alerts, 'weight:') ??
    findByIdPrefix(alerts, 'refill-') ??
    findByIdPrefix(alerts, 'protein:') ??
    findByIdPrefix(alerts, 'doctor-report-incomplete:') ??
    findByIdPrefix(alerts, 'doctor-report-ready:');

  const secondary = alerts.find(
    (alert) =>
      alert.action &&
      alert.id !== primary?.id &&
      ['symptoms:', 'weight:', 'protein:', 'refill-'].some((prefix) => alert.id.startsWith(prefix)),
  );

  if (primary?.action) {
    return {
      eyebrow: 'TODAY’S GLP-1 COACH',
      title: coachTitle(primary.id, primary.title),
      detail: primary.detail,
      actions: [primary.action, secondary?.action].filter(Boolean).slice(0, 2) as CoachAction[],
    };
  }

  const sinceLast = daysSinceLastShot(db.injections, now);
  if (sinceLast === 0) {
    return {
      eyebrow: 'TODAY’S GLP-1 COACH',
      title: 'Shot logged today',
      detail: 'Nice. Keep an eye on symptoms over the next few days and log anything useful for your report.',
      actions: [{ type: 'WEEKLY_PROGRESS', label: 'View progress', icon: 'file' }],
    };
  }

  const daysUntilShot = daysUntilNext(db.profile.shotDay, now);
  return {
    eyebrow: 'TODAY’S GLP-1 COACH',
    title: daysUntilShot === 1 ? 'Next shot is tomorrow' : `Next shot in ${daysUntilShot} days`,
    detail: 'Stay consistent this week. Shotday will turn your logs into weekly progress and doctor-ready summaries.',
    actions: [{ type: 'WEEKLY_PROGRESS', label: 'View progress', icon: 'file' }],
  };
}

function findByIdPrefix(alerts: ReturnType<typeof buildSmartAlerts>, prefix: string) {
  return alerts.find((alert) => alert.id.startsWith(prefix));
}

function coachTitle(id: string, fallback: string): string {
  if (id.startsWith('medication-dose:')) return 'Set your current dose';
  if (id.startsWith('shot:')) return 'Log this week’s shot';
  if (id.startsWith('symptoms:')) return 'Check symptoms after your shot';
  if (id.startsWith('weight:')) return 'Add this week’s weight';
  if (id.startsWith('refill-picked-up:')) return 'Confirm refill pickup';
  if (id.startsWith('refill-risk:')) return 'Review your refill';
  if (id.startsWith('refill-setup:')) return 'Set up refill tracking';
  if (id.startsWith('protein:')) return 'Log protein today';
  if (id.startsWith('doctor-report-incomplete:')) return 'Complete your doctor report data';
  if (id.startsWith('doctor-report-ready:')) return 'Doctor report is ready';
  return fallback;
}
