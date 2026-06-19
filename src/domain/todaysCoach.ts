import { daysSinceLastShot, daysUntilNext } from './dateMath';
import { totalProteinForDay } from './food';
import { buildSmartAlerts, type SmartAlertAction, type SmartAlertIcon } from './smartAlerts';
import { currentShotWindow } from './weeklyProgress';
import type { ShotdayDb } from '../types/domain';

export interface CoachAction {
  type: SmartAlertAction;
  label: string;
  icon: SmartAlertIcon;
}

export interface CoachChecklistItem {
  label: string;
  complete: boolean;
}

export interface TodaysCoach {
  eyebrow: string;
  title: string;
  detail: string;
  checklist: CoachChecklistItem[];
  actions: CoachAction[];
}

export function buildTodaysCoach(db: ShotdayDb, now: Date): TodaysCoach {
  const checklist = buildCoachChecklist(db, now);
  const nextChecklistAction = checklist.find((item) => !item.complete);
  if (nextChecklistAction?.action) {
    return {
      eyebrow: 'TODAY’S GLP-1 COACH',
      title: checklist[0]?.label === 'Medication + dose' && !checklist[0].complete
        ? 'Build your first progress report'
        : 'Complete today’s basics',
      detail: 'Finish the next simple step so Shotday can keep your weekly progress and doctor report accurate.',
      checklist: checklist.map(({ action: _action, ...item }) => item),
      actions: [nextChecklistAction.action],
    };
  }

  const alerts = buildSmartAlerts(db, now);
  const primary =
    findByIdPrefix(alerts, 'refill-') ??
    findByIdPrefix(alerts, 'protein:') ??
    findByIdPrefix(alerts, 'doctor-report-incomplete:') ??
    findByIdPrefix(alerts, 'doctor-report-ready:');

  if (primary?.action) {
    return {
      eyebrow: 'TODAY’S GLP-1 COACH',
      title: coachTitle(primary.id, primary.title),
      detail: primary.detail,
      checklist: checklist.map(({ action: _action, ...item }) => item),
      actions: [primary.action],
    };
  }

  const sinceLast = daysSinceLastShot(db.injections, now);
  if (sinceLast === 0) {
    return {
      eyebrow: 'TODAY’S GLP-1 COACH',
      title: 'Shot logged today',
      detail: 'Nice. Keep an eye on symptoms over the next few days and log anything useful for your report.',
      checklist: checklist.map(({ action: _action, ...item }) => item),
      actions: [{ type: 'WEEKLY_PROGRESS', label: 'View progress', icon: 'file' }],
    };
  }

  const daysUntilShot = daysUntilNext(db.profile.shotDay, now);
  return {
    eyebrow: 'TODAY’S GLP-1 COACH',
    title: daysUntilShot === 1 ? 'Next shot is tomorrow' : `Next shot in ${daysUntilShot} days`,
    detail: 'Stay consistent this week. Shotday will turn your logs into weekly progress and doctor-ready summaries.',
    checklist: checklist.map(({ action: _action, ...item }) => item),
    actions: [{ type: 'WEEKLY_PROGRESS', label: 'View progress', icon: 'file' }],
  };
}

function buildCoachChecklist(
  db: ShotdayDb,
  now: Date,
): Array<CoachChecklistItem & { action?: CoachAction }> {
  const window = currentShotWindow(db.profile.shotDay, now);
  const medicationComplete = db.profile.onboardingComplete && db.profile.currentDoseMg > 0 && Boolean(db.profile.currentDoseLabel);
  const shotComplete = hasEventInWindow(db.injections.map((entry) => entry.takenAt), window.start, window.end);
  const weightComplete = hasEventInWindow(db.weightEntries.map((entry) => entry.loggedAt), window.start, window.end);
  const symptomsComplete = hasEventInWindow(db.sideEffects.map((entry) => entry.loggedAt), window.start, window.end);
  const proteinComplete = totalProteinForDay(db.foods, now) > 0;

  if (!medicationComplete || !shotComplete || !weightComplete || !symptomsComplete) {
    return [
      {
        label: 'Medication + dose',
        complete: medicationComplete,
        action: medicationComplete ? undefined : { type: 'DOSE', label: 'Update dose', icon: 'settings' },
      },
      {
        label: 'Shot logged',
        complete: shotComplete,
        action: shotComplete ? undefined : { type: 'SHOT', label: 'Log shot', icon: 'syringe' },
      },
      {
        label: 'Weight added',
        complete: weightComplete,
        action: weightComplete ? undefined : { type: 'WEIGHT', label: 'Add weight', icon: 'scale' },
      },
      {
        label: 'Symptoms checked',
        complete: symptomsComplete,
        action: symptomsComplete ? undefined : { type: 'SYMPTOMS', label: 'Check symptoms', icon: 'heart' },
      },
    ];
  }

  return [
    { label: 'Shot logged', complete: shotComplete },
    { label: 'Weight added', complete: weightComplete },
    { label: 'Symptoms checked', complete: symptomsComplete },
    {
      label: 'Protein logged',
      complete: proteinComplete,
      action: proteinComplete ? undefined : { type: 'FOOD', label: 'Log protein', icon: 'utensils' },
    },
  ];
}

function hasEventInWindow(isoDates: string[], start: Date, end: Date): boolean {
  return isoDates.some((iso) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
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
