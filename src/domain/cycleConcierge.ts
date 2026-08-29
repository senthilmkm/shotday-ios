// Cycle-Aware GLP-1 Concierge & Shot Ritual Engine.
//
// Pharmacokinetic 7-day cycle + 4-week titration state machine that turns
// passive raw data into proactive, high-empathy guidance. Eliminates user
// confusion by providing one clear, context-aware ritual for today.

import { dayAfterShotClamped, daysSinceLastShot, daysUntilNext, mostRecentInjection } from './dateMath';
import { daysUntilEligibleToBump, nextRung } from './dose';
import { totalProteinForDay } from './food';
import { refillStatus } from './refill';
import { lastUsedZone, suggestNextZone } from './rotation';
import { totalWaterForDay, waterTargetOz } from './water';
import type { InjectionZone, ShotdayDb } from '../types/domain';

export type ConciergePhase =
  | 'NO_SHOTS_YET'
  | 'SHOT_DAY_PENDING'
  | 'SHOT_DAY_COMPLETED'
  | 'SHOT_OVERDUE'
  | 'PEAK_WINDOW'
  | 'STEADY_STATE'
  | 'TROUGH_APPETITE'
  | 'TITRATION_MILESTONE'
  | 'REFILL_URGENT';

export type ConciergeBadgeType = 'primary' | 'success' | 'warning' | 'info';

export interface ConciergeAction {
  type:
    | 'SHOT'
    | 'WEIGHT'
    | 'SYMPTOMS'
    | 'FOOD'
    | 'DOSE'
    | 'REFILL'
    | 'WEEKLY_PROGRESS'
    | 'DOCTOR_REPORT'
    | 'MEDICATION_LEVELS';
  label: string;
  initialTab?: 'PROTEIN' | 'WATER';
}

export type FoodNoiseLevel = 'SILENT' | 'VERY_LOW' | 'MODERATE' | 'RETURNING';

export interface CycleForecastDay {
  dayNumber: number;
  offsetFromShot: number;
  name: string;
  phaseTitle: string;
  foodNoise: FoodNoiseLevel;
  foodNoiseLabel: string;
  isToday: boolean;
  tip: string;
}

export interface CycleConcierge {
  phase: ConciergePhase;
  badgeLabel: string;
  badgeType: ConciergeBadgeType;
  headline: string;
  insight: string;
  ritualSteps?: string[];
  suggestedZone?: InjectionZone;
  suggestedZoneLabel?: string;
  primaryAction: ConciergeAction;
  secondaryAction?: ConciergeAction;
  forecast: CycleForecastDay[];
}

const ZONE_NAMES: Record<InjectionZone, string> = {
  BELLY_UL: 'Upper-left belly',
  BELLY_UR: 'Upper-right belly',
  BELLY_LL: 'Lower-left belly',
  BELLY_LR: 'Lower-right belly',
  THIGH_L: 'Left thigh',
  THIGH_R: 'Right thigh',
  ARM_L: 'Left arm',
  ARM_R: 'Right arm',
  OTHER: 'Alternative site',
};

export function buildCycleForecast(dayAfterShot: number | null): CycleForecastDay[] {
  const currentOffset = dayAfterShot === null ? 0 : Math.max(0, Math.min(6, dayAfterShot));

  const templates: Omit<CycleForecastDay, 'isToday'>[] = [
    {
      dayNumber: 1,
      offsetFromShot: 0,
      name: 'Shot Day',
      phaseTitle: 'Dose Absorption',
      foodNoise: 'MODERATE',
      foodNoiseLabel: 'Fading Out',
      tip: 'Stay ahead of nausea with extra water & electrolytes.',
    },
    {
      dayNumber: 2,
      offsetFromShot: 1,
      name: 'Day 2',
      phaseTitle: 'Peak Blood Shield',
      foodNoise: 'SILENT',
      foodNoiseLabel: 'Silent (Peak)',
      tip: 'Active concentration peaking. Eat small, dense meals.',
    },
    {
      dayNumber: 3,
      offsetFromShot: 2,
      name: 'Day 3',
      phaseTitle: 'Maximum Satiety',
      foodNoise: 'SILENT',
      foodNoiseLabel: 'Silent',
      tip: 'Appetite quieted. Focus on protein to protect muscle.',
    },
    {
      dayNumber: 4,
      offsetFromShot: 3,
      name: 'Day 4',
      phaseTitle: 'Steady Metabolic State',
      foodNoise: 'VERY_LOW',
      foodNoiseLabel: 'Calm & Steady',
      tip: 'Optimal physical energy. Great day for workouts.',
    },
    {
      dayNumber: 5,
      offsetFromShot: 4,
      name: 'Day 5',
      phaseTitle: 'Steady Balance',
      foodNoise: 'VERY_LOW',
      foodNoiseLabel: 'Controlled',
      tip: 'Keep up your daily water and lean protein routine.',
    },
    {
      dayNumber: 6,
      offsetFromShot: 5,
      name: 'Day 6',
      phaseTitle: 'The Drift Zone',
      foodNoise: 'MODERATE',
      foodNoiseLabel: 'Mild Cravings',
      tip: 'Half-life dipping: gentle appetite return is biological and normal.',
    },
    {
      dayNumber: 7,
      offsetFromShot: 6,
      name: 'Day 7',
      phaseTitle: 'Pre-Shot Preparation',
      foodNoise: 'RETURNING',
      foodNoiseLabel: 'Appetite Returning',
      tip: 'Prepare your next dose and pick your rotation site.',
    },
  ];

  return templates.map((t) => ({
    ...t,
    isToday: t.offsetFromShot === currentOffset,
  }));
}

/**
 * Builds the current CycleConcierge state based on the patient's GLP-1
 * injection history, current day of the week, active titration stage,
 * and refill status.
 */
export function buildCycleConcierge(db: ShotdayDb, now: Date = new Date()): CycleConcierge {
  const lastShot = mostRecentInjection(db.injections);
  const sinceLast = daysSinceLastShot(db.injections, now);
  const daysUntilShot = daysUntilNext(db.profile.shotDay, now);
  const isShotDay = daysUntilShot === 0;

  const suggestedZone = suggestNextZone(db.injections);
  const suggestedZoneLabel = ZONE_NAMES[suggestedZone];
  const day = dayAfterShotClamped(db.injections, now) ?? (sinceLast !== null ? Math.min(6, sinceLast) : null);
  const forecast = buildCycleForecast(day);

  // 1. Fresh onboarding / No shots logged yet
  if (!lastShot || sinceLast === null) {
    return {
      phase: 'NO_SHOTS_YET',
      badgeLabel: '✨ GETTING STARTED',
      badgeType: 'primary',
      headline: 'Ready for your first injection',
      insight: `Welcome to Shotday. Log your starting dose (${db.profile.currentDoseLabel || 'starter dose'}) and pick your first injection site to activate active level tracking.`,
      suggestedZone,
      suggestedZoneLabel,
      primaryAction: { type: 'SHOT', label: 'Log first shot' },
      secondaryAction: { type: 'DOSE', label: 'Check dose' },
      forecast,
    };
  }

  // 2. Shot Day Ritual (Today is the designated shot day and no shot has been logged today)
  if (isShotDay && sinceLast > 0) {
    const doseLabel = db.profile.currentDoseLabel || `${db.profile.currentDoseMg} mg`;
    return {
      phase: 'SHOT_DAY_PENDING',
      badgeLabel: '🎯 SHOT DAY RITUAL',
      badgeType: 'primary',
      headline: 'Today is your shot day',
      insight: `Fasted morning routine is optimal: record your weight before eating, confirm your ${doseLabel} dose, and rotate to ${suggestedZoneLabel}.`,
      ritualSteps: [
        '1. Step on scale (fasted weight)',
        `2. Confirm dose (${doseLabel})`,
        `3. Inject & rotate (${suggestedZoneLabel})`,
      ],
      suggestedZone,
      suggestedZoneLabel,
      primaryAction: { type: 'SHOT', label: 'Start Shot Routine' },
      secondaryAction: { type: 'WEIGHT', label: 'Log weight' },
      forecast,
    };
  }

  // 3. Shot Overdue (Passed shot day by 1 or more days)
  if (sinceLast >= 7 && !isShotDay) {
    const daysOverdue = sinceLast - 7;
    return {
      phase: 'SHOT_OVERDUE',
      badgeLabel: daysOverdue > 0 ? `⚠️ SHOT OVERDUE (+${daysOverdue}D)` : '⚠️ SHOT OVERDUE',
      badgeType: 'warning',
      headline: 'Weekly shot is overdue',
      insight:
        sinceLast <= 11
          ? 'Consistency keeps blood levels stable. If less than 5 days late, take your dose today and stay on schedule.'
          : 'It has been over 10 days since your last dose. Check with your doctor if you experience increased GI sensitivity upon taking this shot.',
      suggestedZone,
      suggestedZoneLabel,
      primaryAction: { type: 'SHOT', label: 'Log missed shot' },
      secondaryAction: { type: 'MEDICATION_LEVELS', label: 'View active level' },
      forecast,
    };
  }

  // 4. Shot Completed Today
  if (sinceLast === 0) {
    const zoneName = lastShot.zone ? ZONE_NAMES[lastShot.zone] : 'logged zone';
    return {
      phase: 'SHOT_DAY_COMPLETED',
      badgeLabel: '✅ SHOT DAY COMPLETE',
      badgeType: 'success',
      headline: 'This week’s dose is active',
      insight: `Great job! Logged at ${zoneName}. Medication concentration will peak over the next 24–48 hours. Drink extra water today to stay ahead of nausea.`,
      primaryAction: { type: 'FOOD', label: 'Log water & hydration', initialTab: 'WATER' },
      secondaryAction: { type: 'MEDICATION_LEVELS', label: 'View curve forecast' },
      forecast,
    };
  }

  // Check 4-week Titration Milestone (if user completed 4 weeks on current dose)
  const lastDoseChange = db.doseHistory[db.doseHistory.length - 1];
  const daysToBump = lastDoseChange ? daysUntilEligibleToBump(new Date(lastDoseChange.startedAt), now) : null;
  const upcomingDose = nextRung(db.profile.drug, db.profile.currentDoseMg);

  if (daysToBump === 0 && upcomingDose) {
    return {
      phase: 'TITRATION_MILESTONE',
      badgeLabel: '🪜 4-WEEK DOSE MILESTONE',
      badgeType: 'info',
      headline: `4 weeks completed on ${db.profile.currentDoseLabel}`,
      insight: `You've finished 4 weeks at this dose. Standard clinical escalation protocols suggest evaluating with your prescriber whether to step up to ${upcomingDose.label}.`,
      primaryAction: { type: 'DOSE', label: 'View dose ladder' },
      secondaryAction: { type: 'DOCTOR_REPORT', label: 'Generate doctor report' },
      forecast,
    };
  }

  // Check Refill Urgency
  const refill = refillStatus(db.refill, db.injections, now);
  if (!refill.unconfigured && (refill.alertLevel === 'URGENT' || refill.alertLevel === 'EMPTY')) {
    return {
      phase: 'REFILL_URGENT',
      badgeLabel: '📦 REFILL REMINDER',
      badgeType: 'warning',
      headline: refill.dosesRemaining === 0 ? 'No doses remaining in pen' : 'Only 1 dose remaining',
      insight: 'Request your pharmacy refill now to prevent missed shot days or therapy interruptions.',
      primaryAction: { type: 'REFILL', label: 'Manage refill' },
      secondaryAction: { type: 'DOCTOR_REPORT', label: 'Doctor report' },
      forecast,
    };
  }

  // 5. Day 1–2 Post-Shot: Peak Blood Concentration Window ⚡
  if (day !== null && day >= 1 && day <= 2) {
    return {
      phase: 'PEAK_WINDOW',
      badgeLabel: `⚡ PEAK CONCENTRATION (DAY ${day}/7)`,
      badgeType: 'primary',
      headline: 'Medication levels are peaking',
      insight:
        'Blood concentration is at its weekly maximum. Mild fatigue or nausea is normal as your body adjusts. Take 30 seconds to check in on symptoms and stay hydrated.',
      primaryAction: { type: 'SYMPTOMS', label: '30s Symptom Check-in' },
      secondaryAction: { type: 'FOOD', label: 'Log hydration', initialTab: 'WATER' },
      forecast,
    };
  }

  // 6. Day 3–4 Post-Shot: Steady State & Satiety Window 🛡️
  if (day !== null && day >= 3 && day <= 4) {
    const proteinTarget = db.profile.weight > 0 ? Math.round(db.profile.weight * (db.profile.weightUnit === 'LB' ? 0.7 : 1.54)) : 80;
    return {
      phase: 'STEADY_STATE',
      badgeLabel: `🛡️ STEADY STATE (DAY ${day}/7)`,
      badgeType: 'info',
      headline: 'Optimal satiety window',
      insight: `Blood levels are stable and appetite suppression is high. Prioritize hitting your ${proteinTarget}g protein target today to protect lean muscle mass.`,
      primaryAction: { type: 'FOOD', label: 'Log protein & water', initialTab: 'PROTEIN' },
      secondaryAction: { type: 'MEDICATION_LEVELS', label: 'View active curve' },
      forecast,
    };
  }

  // 7. Day 5–6 Post-Shot: Trough & Food Noise Window 🍽️
  return {
    phase: 'TROUGH_APPETITE',
    badgeLabel: `🍽️ APPETITE WINDOW (DAY ${day ?? 5}/7)`,
    badgeType: 'info',
    headline: 'Medication is in weekly trough',
    insight:
      'Mild appetite return or food noise is 100% normal towards the end of your weekly cycle—your medicine is still working! Prioritize high-satiety protein and fiber.',
    primaryAction: { type: 'FOOD', label: 'Log daily fuel', initialTab: 'PROTEIN' },
    secondaryAction: { type: 'WEEKLY_PROGRESS', label: 'View weekly progress' },
    forecast,
  };
}
