import { calendarDaysBetween, dateOnly, DAY_OF_WEEK_INDEX } from './dateMath';
import { totalProteinForDay } from './food';
import { proteinTargetGrams } from './protein';
import { refillEventsInRange } from './refillHistory';
import { peakMetric } from './sideEffects';
import { weightChangeSummary, weightMilestoneSummary, weightSeries } from './weight';
import type {
  DayOfWeek,
  Injection,
  RefillHistoryEntry,
  ShotdayDb,
  SideEffectEntry,
  WeightUnit,
} from '../types/domain';

export interface DoctorReport {
  generatedAt: string;
  currentMedication: {
    drug: string;
    doseLabel: string;
    doseMg: number;
  };
  injectionHistory: Injection[];
  missedLateShots: MissedLateShot[];
  sideEffectsByWeek: WeeklySideEffectSummary[];
  weightTrend: {
    unit: WeightUnit;
    points: { loggedAt: string; weight: number }[];
    change: number | null;
  };
  weightMilestone: {
    totalLost: number;
    nextMilestone: number;
    remainingToNext: number;
    unit: WeightUnit;
  } | null;
  proteinTrend: {
    targetG: number | null;
    days: { date: string; proteinG: number; hitTarget: boolean | null }[];
  };
  refillHistory: RefillHistoryEntry[];
  notesForDoctor: string;
}

export interface MissedLateShot {
  expectedOn: string;
  status: 'MISSED' | 'LATE';
  actualTakenAt?: string;
  daysLate?: number;
}

export interface WeeklySideEffectSummary {
  weekStart: string;
  checkIns: number;
  averagePeak: number;
  maxPeak: number;
}

const DEFAULT_REPORT_DAYS = 90;
const DEFAULT_PROTEIN_DAYS = 14;

export function buildDoctorReport(
  db: ShotdayDb,
  now: Date,
  notesForDoctor = '',
  reportDays = DEFAULT_REPORT_DAYS,
): DoctorReport {
  const start = new Date(now);
  start.setDate(now.getDate() - reportDays);

  const injectionHistory = [...db.injections]
    .filter((i) => new Date(i.takenAt).getTime() >= start.getTime())
    .sort(byTakenAtAsc);

  const unit = db.profile.weightUnit;
  const weightPoints = weightSeries(db, reportDays, now, unit);
  const weightChange = weightChangeSummary(db, now, reportDays, unit);
  const milestone = weightMilestoneSummary(db, now, unit);

  return {
    generatedAt: now.toISOString(),
    currentMedication: {
      drug: displayDrug(db),
      doseLabel: db.profile.currentDoseLabel,
      doseMg: db.profile.currentDoseMg,
    },
    injectionHistory,
    missedLateShots: missedLateShots(db.injections, db.profile.shotDay, now, reportDays),
    sideEffectsByWeek: sideEffectsByWeek(db.sideEffects, now, reportDays),
    weightTrend: {
      unit,
      points: weightPoints.map((p) => ({
        loggedAt: p.loggedAt.toISOString(),
        weight: p.weight,
      })),
      change: weightChange?.change ?? null,
    },
    weightMilestone:
      milestone.status === 'ACTIVE' &&
      milestone.totalLost !== null &&
      milestone.nextMilestone !== null &&
      milestone.remainingToNext !== null
        ? {
            totalLost: milestone.totalLost,
            nextMilestone: milestone.nextMilestone,
            remainingToNext: milestone.remainingToNext,
            unit: milestone.unit,
          }
        : null,
    proteinTrend: proteinTrend(db, now, DEFAULT_PROTEIN_DAYS),
    refillHistory: refillEventsInRange(db, start, now),
    notesForDoctor: notesForDoctor.trim(),
  };
}

export function buildDoctorReportText(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push('Shotday Doctor Visit Report');
  lines.push(`Generated: ${formatDateTime(report.generatedAt)}`);
  lines.push('');

  lines.push('Current medication');
  lines.push(`- Drug: ${report.currentMedication.drug || 'Not set'}`);
  lines.push(`- Current dose: ${report.currentMedication.doseLabel || 'Not set'}`);
  lines.push('');

  lines.push('Injection history');
  if (report.injectionHistory.length === 0) {
    lines.push('- No injections logged in this report window.');
  } else {
    for (const injection of report.injectionHistory) {
      lines.push(
        `- ${formatDateTime(injection.takenAt)}: ${injection.doseMg} mg, ${humanZone(injection.zone)}`,
      );
    }
  }
  lines.push('');

  lines.push('Missed / late shots');
  if (report.missedLateShots.length === 0) {
    lines.push('- No missed or late shots detected.');
  } else {
    for (const item of report.missedLateShots) {
      if (item.status === 'MISSED') {
        lines.push(`- Missed expected shot on ${formatDate(item.expectedOn)}`);
      } else {
        lines.push(
          `- Late shot: expected ${formatDate(item.expectedOn)}, taken ${formatDateTime(item.actualTakenAt ?? '')} (${item.daysLate ?? 0} days late)`,
        );
      }
    }
  }
  lines.push('');

  lines.push('Side effects by week');
  if (report.sideEffectsByWeek.length === 0) {
    lines.push('- No side-effect check-ins logged in this report window.');
  } else {
    for (const week of report.sideEffectsByWeek) {
      lines.push(
        `- Week of ${formatDate(week.weekStart)}: ${week.checkIns} check-in${week.checkIns === 1 ? '' : 's'}, average peak ${week.averagePeak}/5, max ${week.maxPeak}/5`,
      );
    }
  }
  lines.push('');

  lines.push('Weight trend');
  if (report.weightTrend.points.length === 0) {
    lines.push('- No weight history logged yet.');
  } else {
    const first = report.weightTrend.points[0]!;
    const latest = report.weightTrend.points[report.weightTrend.points.length - 1]!;
    lines.push(`- Start: ${first.weight} ${report.weightTrend.unit} on ${formatDate(first.loggedAt)}`);
    lines.push(`- Latest: ${latest.weight} ${report.weightTrend.unit} on ${formatDate(latest.loggedAt)}`);
    if (report.weightTrend.change !== null) {
      lines.push(`- Change: ${signed(report.weightTrend.change)} ${report.weightTrend.unit}`);
    }
    if (report.weightMilestone) {
      lines.push(
        `- Milestone: down ${report.weightMilestone.totalLost} ${report.weightMilestone.unit} since starting; ${report.weightMilestone.remainingToNext} ${report.weightMilestone.unit} to ${report.weightMilestone.nextMilestone} ${report.weightMilestone.unit} lost.`,
      );
    }
  }
  lines.push('');

  lines.push('Protein trend');
  if (report.proteinTrend.targetG === null) {
    lines.push('- No protein target because weight is not set.');
  } else {
    const hits = report.proteinTrend.days.filter((d) => d.hitTarget === true).length;
    lines.push(`- Target: ${report.proteinTrend.targetG} g/day`);
    lines.push(`- Hit target: ${hits} of ${report.proteinTrend.days.length} days`);
    const recent = report.proteinTrend.days.slice(-7);
    lines.push('- Recent days:');
    for (const day of recent) {
      lines.push(`  - ${formatDate(day.date)}: ${day.proteinG} g${day.hitTarget ? ' (hit)' : ''}`);
    }
  }
  lines.push('');

  lines.push('Refill history');
  if (report.refillHistory.length === 0) {
    lines.push('- No refill events logged in this report window.');
  } else {
    for (const event of report.refillHistory) {
      lines.push(`- ${formatDateTime(event.loggedAt)}: ${humanRefillEvent(event.type)}`);
    }
  }
  lines.push('');

  lines.push('Notes for doctor visit');
  lines.push(report.notesForDoctor || 'No notes entered.');
  lines.push('');
  lines.push('Disclaimer: Shotday is a tracking tool, not medical advice. Always consult your prescribing physician before starting, stopping, or changing medication.');

  return lines.join('\n');
}

export function missedLateShots(
  injections: Injection[],
  shotDay: DayOfWeek,
  now: Date,
  reportDays = DEFAULT_REPORT_DAYS,
): MissedLateShot[] {
  const targetIdx = DAY_OF_WEEK_INDEX[shotDay];
  if (targetIdx === undefined) return [];

  const sorted = [...injections].sort(byTakenAtAsc);
  if (sorted.length === 0) return [];
  const start = dateOnly(new Date(now));
  start.setDate(start.getDate() - reportDays);
  const firstShotDay = dateOnly(new Date(sorted[0]!.takenAt));
  const firstExpected = nextDateForWeekday(
    firstShotDay.getTime() > start.getTime() ? firstShotDay : start,
    targetIdx,
  );
  const today = dateOnly(now);
  const out: MissedLateShot[] = [];

  for (const expected = firstExpected; expected.getTime() <= today.getTime(); expected.setDate(expected.getDate() + 7)) {
    const actual = firstInjectionInWindow(sorted, expected);
    if (!actual) {
      if (expected.getTime() >= today.getTime()) continue;
      out.push({
        expectedOn: expected.toISOString(),
        status: 'MISSED',
      });
      continue;
    }
    const daysLate = calendarDaysBetween(expected, new Date(actual.takenAt));
    if (daysLate > 1) {
      out.push({
        expectedOn: expected.toISOString(),
        status: 'LATE',
        actualTakenAt: actual.takenAt,
        daysLate,
      });
    }
  }

  return out;
}

export function sideEffectsByWeek(
  sideEffects: SideEffectEntry[],
  now: Date,
  reportDays = DEFAULT_REPORT_DAYS,
): WeeklySideEffectSummary[] {
  const start = new Date(now);
  start.setDate(now.getDate() - reportDays);
  const groups = new Map<string, number[]>();

  for (const entry of sideEffects) {
    const loggedAt = new Date(entry.loggedAt);
    if (loggedAt.getTime() < start.getTime() || loggedAt.getTime() > now.getTime()) continue;
    const key = localDate(weekStart(loggedAt));
    const peaks = groups.get(key) ?? [];
    peaks.push(peakMetric(entry));
    groups.set(key, peaks);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, peaks]) => ({
      weekStart: week,
      checkIns: peaks.length,
      averagePeak: round1(peaks.reduce((sum, p) => sum + p, 0) / peaks.length),
      maxPeak: Math.max(...peaks),
    }));
}

function proteinTrend(
  db: ShotdayDb,
  now: Date,
  days: number,
): DoctorReport['proteinTrend'] {
  let targetG: number | null = null;
  if (db.profile.weight > 0) {
    try {
      targetG = proteinTargetGrams(db.profile.weight, db.profile.weightUnit);
    } catch {
      targetG = null;
    }
  }

  const out: DoctorReport['proteinTrend']['days'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const proteinG = totalProteinForDay(db.foods, day);
    out.push({
      date: localDate(day),
      proteinG,
      hitTarget: targetG === null ? null : proteinG >= targetG,
    });
  }
  return { targetG, days: out };
}

function displayDrug(db: ShotdayDb): string {
  return db.profile.drug === 'OTHER'
    ? db.profile.customDrugName?.trim() || 'Custom medication'
    : db.profile.drug;
}

function firstInjectionInWindow(injections: Injection[], expected: Date): Injection | null {
  const start = dateOnly(expected).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return injections.find((injection) => {
    const t = new Date(injection.takenAt).getTime();
    return t >= start && t < end;
  }) ?? null;
}

function nextDateForWeekday(start: Date, targetIdx: number): Date {
  const out = dateOnly(start);
  const delta = (targetIdx - out.getDay() + 7) % 7;
  out.setDate(out.getDate() + delta);
  return out;
}

function weekStart(d: Date): Date {
  const out = dateOnly(d);
  const delta = (out.getDay() + 6) % 7; // Monday start.
  out.setDate(out.getDate() - delta);
  return out;
}

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  if (!iso) return 'unknown date';
  return new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return 'unknown date';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function humanZone(zone: string): string {
  return zone
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function humanRefillEvent(type: RefillHistoryEntry['type']): string {
  switch (type) {
    case 'SETUP':
      return 'Refill tracking set up';
    case 'REQUESTED':
      return 'Refill requested';
    case 'PICKED_UP':
      return 'Refill picked up';
    case 'LAST_FILLED_CHANGED':
      return 'Last-filled date changed';
    case 'CONFIG_CHANGED':
      return 'Refill configuration changed';
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function byTakenAtAsc(a: Injection, b: Injection): number {
  return new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime();
}
