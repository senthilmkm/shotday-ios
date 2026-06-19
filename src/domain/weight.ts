import type { ShotdayDb, WeightEntry, WeightUnit } from '../types/domain';

export interface WeightSeriesPoint {
  loggedAt: Date;
  weight: number;
  unit: WeightUnit;
  original: WeightEntry;
}

export interface WeightChangeSummary {
  start: WeightSeriesPoint;
  latest: WeightSeriesPoint;
  change: number;
  unit: WeightUnit;
}

export type WeightMilestoneStatus = 'INSUFFICIENT_DATA' | 'NO_LOSS' | 'ACTIVE';

export interface WeightMilestoneSummary {
  status: WeightMilestoneStatus;
  unit: WeightUnit;
  startWeight: number | null;
  currentWeight: number | null;
  totalLost: number | null;
  lastReached: number | null;
  nextMilestone: number | null;
  remainingToNext: number | null;
  label: string;
  detail: string;
}

const LB_PER_KG = 2.2046226218;

export function latestWeightEntry(db: ShotdayDb): WeightEntry | null {
  if (db.weightEntries.length === 0) return null;
  return [...db.weightEntries].sort(byLoggedAtAsc).at(-1) ?? null;
}

export function weightSeries(
  db: ShotdayDb,
  windowDays: number,
  now: Date,
  unit: WeightUnit = db.profile.weightUnit,
): WeightSeriesPoint[] {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return [...db.weightEntries]
    .filter((entry) => new Date(entry.loggedAt).getTime() >= cutoff)
    .sort(byLoggedAtAsc)
    .map((entry) => ({
      loggedAt: new Date(entry.loggedAt),
      weight: roundWeight(convertWeight(entry.weight, entry.unit, unit)),
      unit,
      original: entry,
    }));
}

export function weightChangeSummary(
  db: ShotdayDb,
  now: Date,
  windowDays = 180,
  unit: WeightUnit = db.profile.weightUnit,
): WeightChangeSummary | null {
  const series = weightSeries(db, windowDays, now, unit);
  if (series.length < 2) return null;
  const start = series[0]!;
  const latest = series[series.length - 1]!;
  return {
    start,
    latest,
    change: roundWeight(latest.weight - start.weight),
    unit,
  };
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'KG' ? value * LB_PER_KG : value / LB_PER_KG;
}

export function weightMilestoneSummary(
  db: ShotdayDb,
  now: Date,
  unit: WeightUnit = db.profile.weightUnit,
): WeightMilestoneSummary {
  const points = [...db.weightEntries]
    .filter((entry) => new Date(entry.loggedAt).getTime() <= now.getTime())
    .sort(byLoggedAtAsc)
    .map((entry) => roundWeight(convertWeight(entry.weight, entry.unit, unit)));

  if (points.length < 2) {
    return {
      status: 'INSUFFICIENT_DATA',
      unit,
      startWeight: points[0] ?? null,
      currentWeight: points[0] ?? null,
      totalLost: null,
      lastReached: null,
      nextMilestone: null,
      remainingToNext: null,
      label: 'Add at least two weights to see milestones',
      detail: 'Log weight once per shot cycle so progress stays accurate.',
    };
  }

  const startWeight = points[0]!;
  const currentWeight = points[points.length - 1]!;
  const totalLost = roundWeight(startWeight - currentWeight);

  if (totalLost <= 0) {
    return {
      status: 'NO_LOSS',
      unit,
      startWeight,
      currentWeight,
      totalLost,
      lastReached: null,
      nextMilestone: firstMilestone(unit),
      remainingToNext: firstMilestone(unit),
      label: 'Milestones start after weight loss begins',
      detail: `Starting weight ${startWeight} ${unit}; latest ${currentWeight} ${unit}.`,
    };
  }

  const lastReached = milestoneAtOrBelow(totalLost, unit);
  const nextMilestone = nextMilestoneAbove(totalLost, unit);
  const remainingToNext = roundWeight(nextMilestone - totalLost);
  return {
    status: 'ACTIVE',
    unit,
    startWeight,
    currentWeight,
    totalLost,
    lastReached,
    nextMilestone,
    remainingToNext,
    label:
      lastReached === null
        ? `Down ${totalLost} ${unit} since starting`
        : `Milestone reached: ${formatMilestone(lastReached)} ${unit} lost`,
    detail:
      remainingToNext <= 0
        ? `You’re down ${totalLost} ${unit} since starting.`
        : `${remainingToNext} ${unit} to ${formatMilestone(nextMilestone)} ${unit} lost.`,
  };
}

function firstMilestone(unit: WeightUnit): number {
  return unit === 'LB' ? 5 : 2;
}

function milestoneAtOrBelow(loss: number, unit: WeightUnit): number | null {
  const first = firstMilestone(unit);
  if (loss < first) return null;
  let current = first;
  while (nextMilestoneAfterReached(current, unit) <= loss) {
    current = nextMilestoneAfterReached(current, unit);
  }
  return current;
}

function nextMilestoneAbove(loss: number, unit: WeightUnit): number {
  let current = firstMilestone(unit);
  while (current <= loss) current = nextMilestoneAfterReached(current, unit);
  return current;
}

function nextMilestoneAfterReached(current: number, unit: WeightUnit): number {
  if (unit === 'LB') {
    if (current < 20) return current + 5;
    return current + 10;
  }
  if (current < 5) return 5;
  if (current < 7.5) return 7.5;
  if (current < 10) return 10;
  return current + 5;
}

function formatMilestone(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}

function byLoggedAtAsc(a: WeightEntry, b: WeightEntry): number {
  return new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime();
}
