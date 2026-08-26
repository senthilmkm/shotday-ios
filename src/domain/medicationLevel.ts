// Shotday — Pharmacokinetics & Active Medication Level Domain Engine
// Pure-logic calculations modeling drug absorption, half-life elimination,
// multi-dose superposition, and clinical cycle insights.

import type { DrugFamily, Injection } from '../types/domain';

/**
 * Standard elimination half-lives in hours based on clinical pharmacology data:
 * - Tirzepatide (Mounjaro, Zepbound): ~5 days = 120 hours
 * - Semaglutide (Ozempic, Wegovy): ~7 days = 168 hours
 * - Default / Other GLP-1s: ~6 days = 144 hours
 */
export const DRUG_HALF_LIVES_HOURS: Record<DrugFamily, number> = {
  MOUNJARO: 120, // 5 days
  ZEPBOUND: 120, // 5 days
  OZEMPIC: 168,  // 7 days
  WEGOVY: 168,   // 7 days
  OTHER: 144,    // 6 days
};

/**
 * Typical subcutaneous absorption rate constant (ka) in 1/hours.
 * Peak concentration (Tmax) occurs roughly 24 to 36 hours post-injection.
 */
const ABSORPTION_KA_HOURS = 0.08; // Peak around ~24-36h

export interface MedicationPoint {
  timestamp: string; // ISO string
  date: Date;
  activeMg: number;
  isProjected: boolean;
}

export type MedicationPhase =
  | 'INITIAL_ABSORPTION' // 0 - 24h: Absorbing into bloodstream
  | 'PEAK_CONCENTRATION'  // 24 - 48h: Maximum appetite suppression & efficacy
  | 'STEADY_ELIMINATION'  // 48 - 120h: Active sustained metabolic control
  | 'TROUGH_FOOD_NOISE'   // 120h+: Drug levels drop below 50% of peak, mild hunger / food noise may return
  | 'OVERDUE'             // Past scheduled cycle with steep decline
  | 'NO_DATA';

export interface ActiveLevelSummary {
  currentActiveMg: number;
  peakMgInCycle: number;
  troughMgInCycle: number;
  phase: MedicationPhase;
  daysSinceLastShot: number | null;
  percentOfRecentDose: number;
  headline: string;
  insight: string;
  actionRecommendation: string;
}

/**
 * Calculates the active remaining drug from a single dose at time `tHours` after injection.
 * Uses a one-compartment 1st-order absorption and elimination model:
 * C(t) = Dose * (ka / (ka - ke)) * (exp(-ke * t) - exp(-ka * t))
 */
export function singleDoseLevel(
  doseMg: number,
  tHours: number,
  halfLifeHours: number,
): number {
  if (tHours < 0 || doseMg <= 0) return 0;

  const ke = Math.LN2 / halfLifeHours;
  const ka = ABSORPTION_KA_HOURS;

  if (Math.abs(ka - ke) < 0.0001) {
    // Edge case: ka == ke
    return doseMg * ka * tHours * Math.exp(-ke * tHours);
  }

  // Fraction in systemic circulation
  const fraction = (ka / (ka - ke)) * (Math.exp(-ke * tHours) - Math.exp(-ka * tHours));
  return Math.max(0, doseMg * Math.max(0, fraction));
}

/**
 * Computes the total active medication in the body at a specific timestamp
 * by summing the superposition of all prior injections.
 */
export function calculateActiveLevelAt(
  injections: Injection[],
  drug: DrugFamily,
  targetTime: Date,
): number {
  if (injections.length === 0) return 0;

  const halfLife = DRUG_HALF_LIVES_HOURS[drug] ?? 144;
  const targetMs = targetTime.getTime();

  let totalMg = 0;
  for (const inj of injections) {
    const injMs = new Date(inj.takenAt).getTime();
    if (injMs > targetMs) continue; // Future relative to targetTime

    const diffHours = (targetMs - injMs) / (1000 * 60 * 60);
    // Ignore doses older than 6 half-lives (~98.5% cleared) for efficiency
    if (diffHours > halfLife * 6) continue;

    totalMg += singleDoseLevel(inj.doseMg, diffHours, halfLife);
  }

  return Math.round(totalMg * 100) / 100;
}

/**
 * Generates a smooth curve of active medication levels over a date range.
 * Supports past logs as well as future projected decay or upcoming scheduled doses.
 */
export function generateMedicationCurve(
  injections: Injection[],
  drug: DrugFamily,
  startDate: Date,
  endDate: Date,
  stepHours: number = 6,
  futureScheduledDoses: { date: Date; doseMg: number }[] = [],
): MedicationPoint[] {
  const points: MedicationPoint[] = [];
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const stepMs = stepHours * 60 * 60 * 1000;
  const nowMs = Date.now();

  // Combine actual injections and projected future doses
  const allDoses: Injection[] = [
    ...injections,
    ...futureScheduledDoses.map((d, i) => ({
      id: `projected-${i}`,
      takenAt: d.date.toISOString(),
      zone: 'BELLY_UL' as const,
      doseMg: d.doseMg,
    })),
  ];

  for (let t = startMs; t <= endMs; t += stepMs) {
    const currDate = new Date(t);
    const activeMg = calculateActiveLevelAt(allDoses, drug, currDate);
    points.push({
      timestamp: currDate.toISOString(),
      date: currDate,
      activeMg,
      isProjected: t > nowMs,
    });
  }

  return points;
}

/**
 * Analyzes the user's current cycle state, estimated level, and clinical insights.
 */
export function summarizeActiveLevel(
  injections: Injection[],
  drug: DrugFamily,
  now: Date = new Date(),
): ActiveLevelSummary {
  if (injections.length === 0) {
    return {
      currentActiveMg: 0,
      peakMgInCycle: 0,
      troughMgInCycle: 0,
      phase: 'NO_DATA',
      daysSinceLastShot: null,
      percentOfRecentDose: 0,
      headline: 'No shots logged yet',
      insight: 'Log your first injection to see your active blood level and half-life curve.',
      actionRecommendation: 'Log your shot on your scheduled day.',
    };
  }

  // Sort injections descending
  const sorted = [...injections].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );
  const lastShot = sorted[0]!;
  const lastShotDate = new Date(lastShot.takenAt);
  const diffHours = (now.getTime() - lastShotDate.getTime()) / (1000 * 60 * 60);
  const daysSince = Math.max(0, Math.floor(diffHours / 24));

  const currentActiveMg = calculateActiveLevelAt(injections, drug, now);
  const halfLife = DRUG_HALF_LIVES_HOURS[drug] ?? 144;
  const cycleDays = Math.round(halfLife / 24);

  // Peak and trough over the current 7-day cycle
  const cycleStart = lastShotDate;
  const cycleEnd = new Date(cycleStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const cycleCurve = generateMedicationCurve(injections, drug, cycleStart, cycleEnd, 6);
  const peakMgInCycle = Math.max(...cycleCurve.map((p) => p.activeMg), currentActiveMg);
  const troughMgInCycle = Math.min(...cycleCurve.map((p) => p.activeMg), currentActiveMg);

  const percentOfRecentDose = lastShot.doseMg > 0
    ? Math.round((currentActiveMg / lastShot.doseMg) * 100)
    : 0;

  let phase: MedicationPhase = 'STEADY_ELIMINATION';
  let headline = '';
  let insight = '';
  let actionRecommendation = '';

  if (diffHours < 24) {
    phase = 'INITIAL_ABSORPTION';
    headline = 'Medication Absorbing';
    insight = `Shot taken ${Math.round(diffHours)}h ago. The active level is ramping up toward peak concentration over the next 24 hours.`;
    actionRecommendation = 'Stay hydrated and prioritize protein to minimize early nausea.';
  } else if (diffHours < 48) {
    phase = 'PEAK_CONCENTRATION';
    headline = 'Peak Concentration';
    insight = 'Medication is at its highest active level in your bloodstream. Maximum appetite suppression and glucose regulation.';
    actionRecommendation = 'Great time to eat nutrient-dense meals in smaller, frequent portions.';
  } else if (diffHours < 120) {
    phase = 'STEADY_ELIMINATION';
    headline = 'Steady State';
    insight = `Day ${daysSince + 1}: Drug level is gradually tapering at a normal ~${cycleDays}-day half-life rate. Full metabolic support remains active.`;
    actionRecommendation = 'Keep hitting your daily protein target and log any mild symptoms.';
  } else if (diffHours <= 192) {
    phase = 'TROUGH_FOOD_NOISE';
    headline = 'Trough / Appetite Return';
    insight = `Day ${daysSince + 1}: Concentration has tapered by ~50%. It is clinically normal for hunger or food noise to feel slightly higher today.`;
    actionRecommendation = 'Normal physiological response before your next scheduled shot.';
  } else {
    phase = 'OVERDUE';
    headline = 'Shot Window Overdue';
    insight = `It has been ${daysSince} days since your last injection. Active level is significantly diminished.`;
    actionRecommendation = 'Take your scheduled dose or check with your prescriber if resuming.';
  }

  return {
    currentActiveMg,
    peakMgInCycle,
    troughMgInCycle,
    phase,
    daysSinceLastShot: daysSince,
    percentOfRecentDose,
    headline,
    insight,
    actionRecommendation,
  };
}

/**
 * Simulates active blood levels over the next 4 weeks if the user titrates
 * to a new dose vs keeping their current dose.
 */
export function simulateTitration(
  injections: Injection[],
  drug: DrugFamily,
  currentDoseMg: number,
  targetDoseMg: number,
  weeksAhead: number = 4,
  now: Date = new Date(),
): {
  currentDoseCurve: MedicationPoint[];
  titrationCurve: MedicationPoint[];
  steadyStateCurrentMg: number;
  steadyStateTitrationMg: number;
} {
  const startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 2 weeks back
  const endDate = new Date(now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

  // Future weekly doses for current dose plan
  const futureCurrent: { date: Date; doseMg: number }[] = [];
  const futureTitrated: { date: Date; doseMg: number }[] = [];

  for (let w = 1; w <= weeksAhead; w++) {
    const doseDate = new Date(now.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    futureCurrent.push({ date: doseDate, doseMg: currentDoseMg });
    futureTitrated.push({ date: doseDate, doseMg: targetDoseMg });
  }

  const currentDoseCurve = generateMedicationCurve(
    injections,
    drug,
    startDate,
    endDate,
    12,
    futureCurrent,
  );

  const titrationCurve = generateMedicationCurve(
    injections,
    drug,
    startDate,
    endDate,
    12,
    futureTitrated,
  );

  // Calculate theoretical steady-state accumulation factor: 1 / (1 - exp(-ke * tau)) where tau = 7 days
  const halfLife = DRUG_HALF_LIVES_HOURS[drug] ?? 144;
  const ke = Math.LN2 / halfLife;
  const tauHours = 7 * 24;
  const accumulationFactor = 1 / (1 - Math.exp(-ke * tauHours));

  const steadyStateCurrentMg = Math.round(currentDoseMg * accumulationFactor * 100) / 100;
  const steadyStateTitrationMg = Math.round(targetDoseMg * accumulationFactor * 100) / 100;

  return {
    currentDoseCurve,
    titrationCurve,
    steadyStateCurrentMg,
    steadyStateTitrationMg,
  };
}
