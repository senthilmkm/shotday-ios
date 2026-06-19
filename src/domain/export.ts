// Data export.
//
// Pure functions that turn a ShotdayDb into a CSV or JSON string. The
// UI layer is responsible for handing those strings off to the share
// sheet (React Native's built-in `Share.share`).
//
// Why both formats?
//   - JSON  is the lossless backup. Round-trippable into a future
//     "Restore from file" flow (post-1.0).
//   - CSV   is what humans (and clinicians) actually want. One row per
//     event, columns chosen for spreadsheet review.
//
// We deliberately do NOT include the `profile` block in CSV output
// (single-row config doesn't fit a long-form spreadsheet) — that's
// what JSON is for.

import type {
  DoseHistoryEntry,
  FoodEntry,
  Injection,
  RefillHistoryEntry,
  ShotdayDb,
  SideEffectEntry,
  WeightEntry,
} from '../types/domain';

/** Build a single CSV string covering all event tables. */
export function buildCsv(db: ShotdayDb): string {
  const out: string[] = [];
  out.push('# Shotday data export');
  out.push(`# Generated: ${new Date().toISOString()}`);
  out.push('');

  out.push('## Injections');
  out.push(['date', 'time', 'zone', 'zone_note', 'dose_mg', 'id'].join(','));
  for (const i of [...db.injections].sort(byDateAsc((x) => x.takenAt))) {
    const d = new Date(i.takenAt);
    out.push(
      [
        csvField(localDate(d)),
        csvField(localTime(d)),
        csvField(i.zone),
        csvField(i.zoneNote ?? ''),
        csvField(String(i.doseMg)),
        csvField(i.id),
      ].join(','),
    );
  }

  out.push('');
  out.push('## Side-effect check-ins');
  out.push(
    [
      'date',
      'time',
      'day_after_shot',
      'dose_mg',
      'nausea',
      'fatigue',
      'constipation',
      'appetite_suppression',
      'mood',
      'anxiety',
      'chips',
      'custom_symptoms',
      'id',
    ].join(','),
  );
  for (const s of [...db.sideEffects].sort(byDateAsc((x) => x.loggedAt))) {
    const d = new Date(s.loggedAt);
    out.push(
      [
        csvField(localDate(d)),
        csvField(localTime(d)),
        csvField(String(s.dayAfterShot)),
        csvField(String(s.doseMg)),
        csvField(metric(s, 'NAUSEA')),
        csvField(metric(s, 'FATIGUE')),
        csvField(metric(s, 'CONSTIPATION')),
        csvField(metric(s, 'APPETITE_SUPPRESSION')),
        csvField(metric(s, 'MOOD')),
        csvField(metric(s, 'ANXIETY')),
        csvField(s.chips.join('|')),
        csvField(s.customSymptoms.join('|')),
        csvField(s.id),
      ].join(','),
    );
  }

  out.push('');
  out.push('## Food / protein log');
  out.push(['date', 'time', 'name', 'protein_g', 'preset', 'id'].join(','));
  for (const f of [...db.foods].sort(byDateAsc((x) => x.loggedAt))) {
    const d = new Date(f.loggedAt);
    out.push(
      [
        csvField(localDate(d)),
        csvField(localTime(d)),
        csvField(f.name),
        csvField(String(f.proteinGrams)),
        csvField(String(f.preset)),
        csvField(f.id),
      ].join(','),
    );
  }

  out.push('');
  out.push('## Weight history');
  out.push(['date', 'time', 'weight', 'unit', 'note', 'id'].join(','));
  for (const w of [...db.weightEntries].sort(byDateAsc((x) => x.loggedAt))) {
    const d = new Date(w.loggedAt);
    out.push(
      [
        csvField(localDate(d)),
        csvField(localTime(d)),
        csvField(String(w.weight)),
        csvField(w.unit),
        csvField(w.note ?? ''),
        csvField(w.id),
      ].join(','),
    );
  }

  out.push('');
  out.push('## Dose history');
  out.push(['started_on', 'label', 'mg', 'id'].join(','));
  for (const h of [...db.doseHistory].sort(byDateAsc((x) => x.startedAt))) {
    const d = new Date(h.startedAt);
    out.push(
      [
        csvField(localDate(d)),
        csvField(h.label),
        csvField(String(h.mg)),
        csvField(h.id),
      ].join(','),
    );
  }

  out.push('');
  out.push('## Refill history');
  out.push(['date', 'time', 'type', 'doses_per_pen', 'last_filled_at', 'note', 'id'].join(','));
  for (const r of [...db.refillHistory].sort(byDateAsc((x) => x.loggedAt))) {
    const d = new Date(r.loggedAt);
    out.push(
      [
        csvField(localDate(d)),
        csvField(localTime(d)),
        csvField(r.type),
        csvField(r.dosesPerPen == null ? '' : String(r.dosesPerPen)),
        csvField(r.lastFilledAt ?? ''),
        csvField(r.note ?? ''),
        csvField(r.id),
      ].join(','),
    );
  }

  return out.join('\n');
}

/**
 * Lossless backup. Strips internal-only fields (`devProOverride`) so
 * the file is safe to share with a clinician.
 */
export function buildJson(db: ShotdayDb): string {
  const safeProfile = { ...db.profile };
  // devProOverride is only meaningful in __DEV__ builds; never export it.
  delete (safeProfile as Partial<typeof safeProfile>).devProOverride;
  const safe: ShotdayDb = { ...db, profile: safeProfile };
  return JSON.stringify(safe, null, 2);
}

function metric(s: SideEffectEntry, key: keyof SideEffectEntry['metrics']): string {
  const v = s.metrics[key];
  return typeof v === 'number' ? String(v) : '1';
}

/**
 * RFC 4180 CSV escaping — wrap fields containing comma / quote /
 * newline in double quotes and double the inner quotes. Keeps Excel,
 * Numbers and Google Sheets happy.
 */
function csvField(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localTime(d: Date): string {
  const h = `${d.getHours()}`.padStart(2, '0');
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

function byDateAsc<T>(getter: (t: T) => string): (a: T, b: T) => number {
  return (a, b) => new Date(getter(a)).getTime() - new Date(getter(b)).getTime();
}

// Re-exports satisfy isolated module tests.
export type { DoseHistoryEntry, FoodEntry, Injection, RefillHistoryEntry, WeightEntry };
