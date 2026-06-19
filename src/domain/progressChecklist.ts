import type { ShotdayDb } from '../types/domain';
import { currentShotWindow } from './weeklyProgress';

export type ProgressChecklistItemId = 'MEDICATION' | 'SHOT' | 'WEIGHT' | 'SYMPTOMS';
export type ProgressChecklistNextAction = 'DOSE' | 'SHOT' | 'WEIGHT' | 'SYMPTOMS' | 'DONE';

export interface ProgressChecklistItem {
  id: ProgressChecklistItemId;
  label: string;
  completed: boolean;
}

export interface ProgressChecklist {
  items: ProgressChecklistItem[];
  completedCount: number;
  totalCount: number;
  complete: boolean;
  nextAction: ProgressChecklistNextAction;
  headline: string;
  body: string;
}

export function buildProgressChecklist(db: ShotdayDb, now: Date): ProgressChecklist {
  const window = currentShotWindow(db.profile.shotDay, now);
  const medicationComplete = db.profile.onboardingComplete && db.profile.currentDoseMg > 0;
  const shotComplete = db.injections.some((injection) => {
    const t = new Date(injection.takenAt).getTime();
    return t >= window.start.getTime() && t < window.end.getTime();
  });
  const weightComplete = db.weightEntries.some((entry) => {
    const t = new Date(entry.loggedAt).getTime();
    return t >= window.start.getTime() && t < window.end.getTime();
  });
  const symptomsComplete = db.sideEffects.some((entry) => {
    const t = new Date(entry.loggedAt).getTime();
    return t >= window.start.getTime() && t < window.end.getTime();
  });

  const items: ProgressChecklistItem[] = [
    { id: 'MEDICATION', label: 'Set up medication + dose', completed: medicationComplete },
    { id: 'SHOT', label: 'Log your shot this cycle', completed: shotComplete },
    { id: 'WEIGHT', label: 'Add this week’s weight', completed: weightComplete },
    { id: 'SYMPTOMS', label: 'Check symptoms after your shot', completed: symptomsComplete },
  ];
  const completedCount = items.filter((item) => item.completed).length;
  const next = items.find((item) => !item.completed);

  return {
    items,
    completedCount,
    totalCount: items.length,
    complete: completedCount === items.length,
    nextAction: next ? actionForItem(next.id) : 'DONE',
    headline:
      completedCount === items.length
        ? 'Weekly progress is ready'
        : 'Build your first progress report',
    body:
      completedCount === items.length
        ? 'You’ve logged enough to see weekly progress and create a doctor report.'
        : 'Complete these basics once this shot cycle so Shotday can turn your logs into useful insights.',
  };
}

function actionForItem(id: ProgressChecklistItemId): ProgressChecklistNextAction {
  switch (id) {
    case 'MEDICATION':
      return 'DOSE';
    case 'SHOT':
      return 'SHOT';
    case 'WEIGHT':
      return 'WEIGHT';
    case 'SYMPTOMS':
      return 'SYMPTOMS';
  }
}
