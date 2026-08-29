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

export interface MilestoneObject {
  thresholdLb: number;
  thresholdKg: number;
  emoji: string;
  name: string;
  comparison: string;
}

export const MILESTONE_OBJECTS: readonly MilestoneObject[] = [
  { thresholdLb: 5, thresholdKg: 2.3, emoji: '🥔', name: 'Bag of Potatoes', comparison: 'a 5 lb bag of russet potatoes' },
  { thresholdLb: 10, thresholdKg: 4.5, emoji: '🐈', name: 'Domestic Cat', comparison: 'an average domestic housecat' },
  { thresholdLb: 15, thresholdKg: 7.0, emoji: '🎳', name: 'Bowling Ball', comparison: 'a standard tenpin bowling ball' },
  { thresholdLb: 20, thresholdKg: 9.0, emoji: '🚗', name: 'Car Tire', comparison: 'a standard passenger car tire' },
  { thresholdLb: 25, thresholdKg: 11.5, emoji: '🐕', name: 'Adult Corgi', comparison: 'a full-grown Pembroke Welsh Corgi' },
  { thresholdLb: 35, thresholdKg: 16.0, emoji: '🧳', name: 'Carry-On Luggage', comparison: 'a fully packed airline carry-on suitcase' },
  { thresholdLb: 45, thresholdKg: 20.5, emoji: '📦', name: 'Microwave Oven', comparison: 'a countertop kitchen microwave' },
  { thresholdLb: 50, thresholdKg: 23.0, emoji: '🦮', name: 'Golden Retriever', comparison: 'a young adult golden retriever' },
  { thresholdLb: 65, thresholdKg: 29.5, emoji: '🎸', name: 'Bass Amp & Cab', comparison: 'a heavy studio bass amplifier' },
  { thresholdLb: 75, thresholdKg: 34.0, emoji: '🛋️', name: 'Living Room Armchair', comparison: 'a cushioned reading armchair' },
  { thresholdLb: 100, thresholdKg: 45.5, emoji: '🦹', name: 'Heavy Punching Bag', comparison: 'a 100 lb boxing heavy bag' },
  { thresholdLb: 125, thresholdKg: 57.0, emoji: '🐼', name: 'Giant Panda Cub', comparison: 'a 1-year-old giant panda' },
  { thresholdLb: 150, thresholdKg: 68.0, emoji: '🛵', name: 'Vintage Moped', comparison: 'a lightweight classic scooter' },
];

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
  milestoneObject: MilestoneObject | null;
  nextMilestoneObject: { object: MilestoneObject; remaining: number } | null;
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
      milestoneObject: null,
      nextMilestoneObject: null,
    };
  }

  const startWeight = points[0]!;
  const currentWeight = points[points.length - 1]!;
  const totalLost = roundWeight(startWeight - currentWeight);

  if (totalLost <= 0) {
    const nextObj = getNextMilestoneObject(0, unit);
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
      milestoneObject: null,
      nextMilestoneObject: nextObj,
    };
  }

  const lastReached = milestoneAtOrBelow(totalLost, unit);
  const nextMilestone = nextMilestoneAbove(totalLost, unit);
  const remainingToNext = roundWeight(nextMilestone - totalLost);
  const currentObj = getMilestoneObject(totalLost, unit);
  const nextObj = getNextMilestoneObject(totalLost, unit);

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
    milestoneObject: currentObj,
    nextMilestoneObject: nextObj,
  };
}

export function getMilestoneObject(loss: number, unit: WeightUnit): MilestoneObject | null {
  if (loss <= 0) return null;
  const isLb = unit === 'LB';
  let matched: MilestoneObject | null = null;
  for (const obj of MILESTONE_OBJECTS) {
    const threshold = isLb ? obj.thresholdLb : obj.thresholdKg;
    if (loss >= threshold) {
      matched = obj;
    } else {
      break;
    }
  }
  return matched;
}

export function getNextMilestoneObject(
  loss: number,
  unit: WeightUnit,
): { object: MilestoneObject; remaining: number } | null {
  const isLb = unit === 'LB';
  const effectiveLoss = Math.max(0, loss);
  for (const obj of MILESTONE_OBJECTS) {
    const threshold = isLb ? obj.thresholdLb : obj.thresholdKg;
    if (threshold > effectiveLoss) {
      return {
        object: obj,
        remaining: roundWeight(threshold - effectiveLoss),
      };
    }
  }
  return null;
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
