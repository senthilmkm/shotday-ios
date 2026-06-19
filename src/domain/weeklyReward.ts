import { currentShotWindow, summarizeWeeklyProgress, type WeeklyProgress } from './weeklyProgress';
import type { ShotdayDb } from '../types/domain';

export type RewardItemId = 'SHOT' | 'WEIGHT' | 'SYMPTOMS' | 'PROTEIN';

export interface RewardItem {
  id: RewardItemId;
  label: string;
  complete: boolean;
}

export interface WeeklyRewardSummary {
  progress: WeeklyProgress;
  scoreCompleted: number;
  scoreTotal: number;
  items: RewardItem[];
  winTitle: string;
  winDetail: string;
  comparisonTitle: string;
  comparisonDetail: string;
  comparisonCallout: string;
  focusTitle: string;
  focusDetail: string;
  rhythm: {
    shot: boolean[];
    weight: boolean[];
    symptoms: boolean[];
  };
}

const RHYTHM_WEEKS = 8;

export function buildWeeklyRewardSummary(db: ShotdayDb, now: Date): WeeklyRewardSummary {
  const progress = summarizeWeeklyProgress(db, now);
  const items: RewardItem[] = [
    { id: 'SHOT', label: 'Shot', complete: progress.shot.takenAt !== null },
    { id: 'WEIGHT', label: 'Weight', complete: progress.weight.hasCurrentCycleEntry },
    { id: 'SYMPTOMS', label: 'Symptoms', complete: progress.symptoms.currentCheckIns > 0 },
    { id: 'PROTEIN', label: 'Protein', complete: hasEventInCurrentWindow(db.foods.map((entry) => entry.loggedAt), db, now) },
  ];
  const scoreCompleted = items.filter((item) => item.complete).length;

  return {
    progress,
    scoreCompleted,
    scoreTotal: items.length,
    items,
    ...buildWin(scoreCompleted, items),
    ...buildComparison(progress),
    ...buildFocus(items),
    rhythm: {
      shot: eventRhythm(db.injections.map((entry) => entry.takenAt), db, now),
      weight: eventRhythm(db.weightEntries.map((entry) => entry.loggedAt), db, now),
      symptoms: eventRhythm(db.sideEffects.map((entry) => entry.loggedAt), db, now),
    },
  };
}

function buildWin(
  scoreCompleted: number,
  items: RewardItem[],
): Pick<WeeklyRewardSummary, 'winTitle' | 'winDetail'> {
  if (scoreCompleted === items.length) {
    return {
      winTitle: 'You stayed on track',
      winDetail: 'Shot, weight, symptoms, and protein are visible this cycle. Your weekly picture is complete.',
    };
  }
  if (scoreCompleted >= 3) {
    const missing = items.find((item) => !item.complete);
    return {
      winTitle: 'Strong week in progress',
      winDetail: missing
        ? `You’re ${scoreCompleted}/${items.length}. Add ${missing.label.toLowerCase()} to complete this week’s picture.`
        : 'Your weekly routine is nearly complete.',
    };
  }
  if (scoreCompleted >= 2) {
    return {
      winTitle: 'Your progress picture is building',
      winDetail: 'A couple more quick logs will make this week’s insight more useful.',
    };
  }
  return {
    winTitle: 'Let’s build this week’s picture',
    winDetail: 'Start with the next simple log. Shotday will turn it into progress once the basics are in.',
  };
}

function buildComparison(
  progress: WeeklyProgress,
): Pick<WeeklyRewardSummary, 'comparisonTitle' | 'comparisonDetail' | 'comparisonCallout'> {
  if (
    progress.symptoms.status === 'DOWN' &&
    progress.symptoms.currentAverage !== null &&
    progress.symptoms.previousAverage !== null &&
    progress.symptoms.previousAverage > 0
  ) {
    const pct = Math.round(((progress.symptoms.previousAverage - progress.symptoms.currentAverage) / progress.symptoms.previousAverage) * 100);
    return {
      comparisonTitle: 'Better than last week',
      comparisonDetail: `Symptoms are trending down. This cycle average: ${progress.symptoms.currentAverage}/5. Last cycle: ${progress.symptoms.previousAverage}/5.`,
      comparisonCallout: `${pct}% lower symptom load`,
    };
  }
  if (progress.symptoms.status === 'UP') {
    return {
      comparisonTitle: 'Watch this trend',
      comparisonDetail: progress.symptoms.detail,
      comparisonCallout: 'Consider notes for your doctor',
    };
  }
  if (progress.weight.status === 'DOWN' && progress.weight.change !== null) {
    return {
      comparisonTitle: 'Weight trend visible',
      comparisonDetail: progress.weight.detail,
      comparisonCallout: `${Math.abs(progress.weight.change)} ${progress.weight.unit} down`,
    };
  }
  if (progress.protein.status === 'READY' && progress.protein.previousDays > 0) {
    const diff = progress.protein.hits - progress.protein.previousHits;
    return {
      comparisonTitle: diff >= 0 ? 'Protein routine is holding' : 'Protein focus can help',
      comparisonDetail: progress.protein.detail,
      comparisonCallout: diff >= 0 ? 'At least as consistent as last cycle' : 'Aim for one more protein day',
    };
  }
  return {
    comparisonTitle: 'Keep logging to compare',
    comparisonDetail: 'This card becomes more useful once Shotday has this cycle and last cycle to compare.',
    comparisonCallout: 'Trends unlock with consistency',
  };
}

function buildFocus(items: RewardItem[]): Pick<WeeklyRewardSummary, 'focusTitle' | 'focusDetail'> {
  const next = items.find((item) => !item.complete);
  if (!next) {
    return {
      focusTitle: 'Focus for next week',
      focusDetail: 'Keep the same rhythm: shot, one weight check-in, symptoms, and protein logs.',
    };
  }
  switch (next.id) {
    case 'SHOT':
      return {
        focusTitle: 'Focus for this week',
        focusDetail: 'Log your shot after you take it so adherence and doctor reports stay accurate.',
      };
    case 'WEIGHT':
      return {
        focusTitle: 'Focus for this week',
        focusDetail: 'Add one weight check-in to keep milestones and trends accurate.',
      };
    case 'SYMPTOMS':
      return {
        focusTitle: 'Focus for this week',
        focusDetail: 'Check symptoms once after your shot so you can compare dose tolerance.',
      };
    case 'PROTEIN':
      return {
        focusTitle: 'Focus for this week',
        focusDetail: 'Add at least one protein log so nutrition progress appears in the recap.',
      };
  }
}

function eventRhythm(isoDates: string[], db: ShotdayDb, now: Date): boolean[] {
  const current = currentShotWindow(db.profile.shotDay, now);
  const out: boolean[] = [];
  for (let i = RHYTHM_WEEKS - 1; i >= 0; i--) {
    const start = new Date(current.start);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    out.push(
      isoDates.some((iso) => {
        const t = new Date(iso).getTime();
        return t >= start.getTime() && t < end.getTime();
      }),
    );
  }
  return out;
}

function hasEventInCurrentWindow(isoDates: string[], db: ShotdayDb, now: Date): boolean {
  const current = currentShotWindow(db.profile.shotDay, now);
  return isoDates.some((iso) => {
    const t = new Date(iso).getTime();
    return t >= current.start.getTime() && t < current.end.getTime();
  });
}
