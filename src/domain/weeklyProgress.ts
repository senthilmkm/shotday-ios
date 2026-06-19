import { calendarDaysBetween, dateOnly, DAY_OF_WEEK_INDEX } from './dateMath';
import { totalProteinForDay } from './food';
import { proteinTargetGrams } from './protein';
import { peakMetric } from './sideEffects';
import { weightSeries } from './weight';
import type { DayOfWeek, Injection, ShotdayDb, WeightUnit } from '../types/domain';

export type ShotProgressStatus = 'ON_TIME' | 'LATE' | 'NO_SHOT_YET' | 'NO_HISTORY';
export type ProteinProgressStatus = 'READY' | 'NO_TARGET' | 'NO_LOGS' | 'NO_COMPLETED_DAYS';
export type TrendStatus = 'DOWN' | 'UP' | 'STEADY' | 'NEED_MORE' | 'NO_DATA';

export interface WeeklyProgress {
  currentWindow: ProgressWindow;
  previousWindow: ProgressWindow;
  shot: {
    status: ShotProgressStatus;
    label: string;
    detail: string;
    takenAt: string | null;
    daysLate: number | null;
  };
  protein: {
    status: ProteinProgressStatus;
    label: string;
    detail: string;
    hits: number;
    days: number;
    previousHits: number;
    previousDays: number;
  };
  symptoms: {
    status: TrendStatus;
    label: string;
    detail: string;
    currentAverage: number | null;
    previousAverage: number | null;
    currentCheckIns: number;
    previousCheckIns: number;
  };
  weight: {
    status: TrendStatus;
    label: string;
    detail: string;
    change: number | null;
    unit: WeightUnit;
    points: number;
    hasCurrentCycleEntry: boolean;
    needsCurrentCycleWeight: boolean;
    needsAnotherWeight: boolean;
  };
  takeaway: string;
}

export interface ProgressWindow {
  start: Date;
  end: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TREND_THRESHOLD = 0.3;

export function summarizeWeeklyProgress(db: ShotdayDb, now: Date): WeeklyProgress {
  const currentWindow = currentShotWindow(db.profile.shotDay, now);
  const previousWindow = {
    start: new Date(currentWindow.start.getTime() - 7 * MS_PER_DAY),
    end: currentWindow.start,
  };

  const shot = summarizeShot(db.injections, currentWindow, now);
  const protein = summarizeProtein(db, currentWindow, previousWindow, now);
  const symptoms = summarizeSymptoms(db, currentWindow, previousWindow, now);
  const weight = summarizeWeight(db, currentWindow, now);

  return {
    currentWindow,
    previousWindow,
    shot,
    protein,
    symptoms,
    weight,
    takeaway: buildTakeaway(shot, protein, symptoms, weight),
  };
}

export function currentShotWindow(shotDay: DayOfWeek, now: Date): ProgressWindow {
  const targetIdx = DAY_OF_WEEK_INDEX[shotDay] ?? now.getDay();
  const start = dateOnly(now);
  const deltaBack = (start.getDay() - targetIdx + 7) % 7;
  start.setDate(start.getDate() - deltaBack);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function summarizeShot(
  injections: Injection[],
  window: ProgressWindow,
  now: Date,
): WeeklyProgress['shot'] {
  if (injections.length === 0) {
    return {
      status: 'NO_HISTORY',
      label: 'Log your first shot to start weekly insights',
      detail: 'Shotday will track whether each weekly shot is on time.',
      takenAt: null,
      daysLate: null,
    };
  }

  const current = injectionsInWindow(injections, window).sort(byTakenAtAsc);
  if (current.length === 0) {
    const daysSinceExpected = Math.max(0, calendarDaysBetween(window.start, now));
    return {
      status: 'NO_SHOT_YET',
      label:
        daysSinceExpected === 0
          ? 'Shot day is today'
          : 'No shot logged this cycle yet',
      detail:
        daysSinceExpected === 0
          ? 'Log your injection after you take it.'
          : 'If you already took it, log it from the Shot tab so your report stays accurate.',
      takenAt: null,
      daysLate: null,
    };
  }

  const first = current[0]!;
  const daysLate = Math.max(0, calendarDaysBetween(window.start, new Date(first.takenAt)));
  if (daysLate === 0) {
    return {
      status: 'ON_TIME',
      label: 'Shot logged on time',
      detail: `Logged on ${formatShortDate(first.takenAt)}.`,
      takenAt: first.takenAt,
      daysLate: 0,
    };
  }

  return {
    status: 'LATE',
    label: `Shot logged ${daysLate} day${daysLate === 1 ? '' : 's'} late`,
    detail: `Expected ${formatShortDate(window.start.toISOString())}; logged ${formatShortDate(first.takenAt)}.`,
    takenAt: first.takenAt,
    daysLate,
  };
}

function summarizeProtein(
  db: ShotdayDb,
  currentWindow: ProgressWindow,
  previousWindow: ProgressWindow,
  now: Date,
): WeeklyProgress['protein'] {
  let target: number;
  try {
    target = proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
  } catch {
    return {
      status: 'NO_TARGET',
      label: 'Add weight to calculate protein target',
      detail: 'Protein consistency appears here after your target is set.',
      hits: 0,
      days: 0,
      previousHits: 0,
      previousDays: 0,
    };
  }

  if (db.foods.length === 0) {
    return {
      status: 'NO_LOGS',
      label: 'Log protein to see weekly consistency',
      detail: `Your current target is ${target} g/day.`,
      hits: 0,
      days: 0,
      previousHits: 0,
      previousDays: 0,
    };
  }

  const current = proteinHitsInWindow(db, currentWindow, now, target, false);
  const previous = proteinHitsInWindow(db, previousWindow, now, target, true);

  if (current.days === 0) {
    return {
      status: 'NO_COMPLETED_DAYS',
      label: 'Protein week starts today',
      detail: 'Tomorrow, this will show whether you hit today’s target.',
      hits: 0,
      days: 0,
      previousHits: previous.hits,
      previousDays: previous.days,
    };
  }

  return {
    status: 'READY',
    label: `Protein target hit ${current.hits} of ${current.days} day${current.days === 1 ? '' : 's'}`,
    detail:
      previous.days > 0
        ? `Last cycle: ${previous.hits} of ${previous.days} days.`
        : `Target: ${target} g/day.`,
    hits: current.hits,
    days: current.days,
    previousHits: previous.hits,
    previousDays: previous.days,
  };
}

function summarizeSymptoms(
  db: ShotdayDb,
  currentWindow: ProgressWindow,
  previousWindow: ProgressWindow,
  now: Date,
): WeeklyProgress['symptoms'] {
  const current = averagePeakInWindow(db, currentWindow, now);
  const previous = averagePeakInWindow(db, previousWindow, now);

  if (current.count === 0 && previous.count === 0) {
    return {
      status: 'NO_DATA',
      label: 'Check in after your shot to see symptom trends',
      detail: 'A few 20-second symptom logs are enough to show direction.',
      currentAverage: null,
      previousAverage: null,
      currentCheckIns: 0,
      previousCheckIns: 0,
    };
  }

  if (current.count === 0 || previous.count === 0) {
    const count = current.count + previous.count;
    return {
      status: 'NEED_MORE',
      label: `${count} symptom check-in${count === 1 ? '' : 's'} logged`,
      detail: 'Log this cycle and next cycle to compare symptom direction.',
      currentAverage: current.average,
      previousAverage: previous.average,
      currentCheckIns: current.count,
      previousCheckIns: previous.count,
    };
  }

  const diff = current.average! - previous.average!;
  const status: TrendStatus =
    diff < -TREND_THRESHOLD ? 'DOWN' : diff > TREND_THRESHOLD ? 'UP' : 'STEADY';
  return {
    status,
    label:
      status === 'DOWN'
        ? 'Symptoms trending down'
        : status === 'UP'
          ? 'Symptoms trending up'
          : 'Symptoms roughly steady',
    detail: `This cycle average ${current.average}/5; last cycle ${previous.average}/5.`,
    currentAverage: current.average,
    previousAverage: previous.average,
    currentCheckIns: current.count,
    previousCheckIns: previous.count,
  };
}

function summarizeWeight(
  db: ShotdayDb,
  currentWindow: ProgressWindow,
  now: Date,
): WeeklyProgress['weight'] {
  const unit = db.profile.weightUnit;
  const hasCurrentCycleEntry = db.weightEntries.some((entry) => {
    const t = new Date(entry.loggedAt).getTime();
    return t >= currentWindow.start.getTime() && t < currentWindow.end.getTime();
  });
  const series = weightSeries(db, 14, now, unit);
  if (series.length === 0) {
    return {
      status: 'NO_DATA',
      label: 'Add weight to see progress',
      detail: 'Weekly weight change appears after you log weight.',
      change: null,
      unit,
      points: 0,
      hasCurrentCycleEntry,
      needsCurrentCycleWeight: true,
      needsAnotherWeight: true,
    };
  }
  if (series.length === 1) {
    return {
      status: 'NEED_MORE',
      label: 'Add one more weight to show trend',
      detail: `Latest: ${series[0]!.weight} ${unit}.`,
      change: null,
      unit,
      points: 1,
      hasCurrentCycleEntry,
      needsCurrentCycleWeight: !hasCurrentCycleEntry,
      needsAnotherWeight: true,
    };
  }

  const first = series[0]!;
  const latest = series[series.length - 1]!;
  const change = Math.round((latest.weight - first.weight) * 10) / 10;
  const status: TrendStatus =
    change < -0.1 ? 'DOWN' : change > 0.1 ? 'UP' : 'STEADY';

  return {
    status,
    label:
      status === 'DOWN'
        ? `Weight down ${Math.abs(change)} ${unit}`
        : status === 'UP'
          ? `Weight up ${change} ${unit}`
          : 'Weight steady',
    detail: `From ${first.weight} ${unit} to ${latest.weight} ${unit} over your last ${series.length} entries.`,
    change,
    unit,
    points: series.length,
    hasCurrentCycleEntry,
    needsCurrentCycleWeight: !hasCurrentCycleEntry,
    needsAnotherWeight: !hasCurrentCycleEntry,
  };
}

function proteinHitsInWindow(
  db: ShotdayDb,
  window: ProgressWindow,
  now: Date,
  target: number,
  includeToday: boolean,
): { hits: number; days: number } {
  let hits = 0;
  let days = 0;
  const today = dateOnly(now).getTime();
  for (const day of daysInWindow(window)) {
    const dayMs = day.getTime();
    if (!includeToday && dayMs >= today) continue;
    if (dayMs > today) continue;
    days++;
    if (totalProteinForDay(db.foods, day) >= target) hits++;
  }
  return { hits, days };
}

function averagePeakInWindow(
  db: ShotdayDb,
  window: ProgressWindow,
  now: Date,
): { average: number | null; count: number } {
  const nowMs = now.getTime();
  const peaks = db.sideEffects
    .filter((entry) => {
      const t = new Date(entry.loggedAt).getTime();
      return t >= window.start.getTime() && t < window.end.getTime() && t <= nowMs;
    })
    .map(peakMetric);
  if (peaks.length === 0) return { average: null, count: 0 };
  const average = peaks.reduce((sum, peak) => sum + peak, 0) / peaks.length;
  return { average: Math.round(average * 10) / 10, count: peaks.length };
}

function injectionsInWindow(injections: Injection[], window: ProgressWindow): Injection[] {
  return injections.filter((injection) => {
    const t = new Date(injection.takenAt).getTime();
    return t >= window.start.getTime() && t < window.end.getTime();
  });
}

function daysInWindow(window: ProgressWindow): Date[] {
  const out: Date[] = [];
  for (const d = new Date(window.start); d.getTime() < window.end.getTime(); d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

function buildTakeaway(
  shot: WeeklyProgress['shot'],
  protein: WeeklyProgress['protein'],
  symptoms: WeeklyProgress['symptoms'],
  weight: WeeklyProgress['weight'],
): string {
  if (shot.status === 'NO_HISTORY') {
    return 'Start by logging your first shot. Weekly insights will build from there.';
  }
  if (
    protein.status !== 'READY' &&
    (symptoms.status === 'NO_DATA' || symptoms.status === 'NEED_MORE') &&
    (weight.status === 'NO_DATA' || weight.status === 'NEED_MORE')
  ) {
    return 'Keep logging this week. Shotday will turn your entries into trends as data builds.';
  }
  if (symptoms.status === 'DOWN' && protein.status === 'READY') {
    return 'Good trend: symptoms are easing while your protein routine is visible.';
  }
  if (symptoms.status === 'UP') {
    return 'Symptoms are trending up. Consider adding notes and sharing a doctor report.';
  }
  if (shot.status === 'LATE' || shot.status === 'NO_SHOT_YET') {
    return 'Your shot timing needs attention this cycle. Keep the report accurate by logging the shot when taken.';
  }
  return 'Your weekly routine is taking shape. Keep logging to make the trend more useful.';
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function byTakenAtAsc(a: Injection, b: Injection): number {
  return new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime();
}
