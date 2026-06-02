// Shotday — domain types
// Pure-data shapes persisted to AsyncStorage. NEVER add functions to these
// types — keep them serializable end-to-end.

// ────────────────────────────────────────────────────────────────────
// Drug + dose
// ────────────────────────────────────────────────────────────────────

export type DrugFamily = 'OZEMPIC' | 'WEGOVY' | 'MOUNJARO' | 'ZEPBOUND' | 'OTHER';

/**
 * Ozempic + Wegovy share one ladder (semaglutide).
 * Mounjaro + Zepbound share another (tirzepatide).
 * OTHER means user typed a custom drug name; ladder is unknown so we
 * surface a flat one-rung "Custom" placeholder in the UI.
 */
export type LadderId = 'SEMAGLUTIDE' | 'TIRZEPATIDE' | 'CUSTOM';

export interface DoseRung {
  /** Display value, e.g. "0.25 mg", "2.5 mg". */
  label: string;
  /** Numeric value in mg for sorting/comparison. */
  mg: number;
}

// ────────────────────────────────────────────────────────────────────
// Injection log
// ────────────────────────────────────────────────────────────────────

export const INJECTION_ZONES = [
  'BELLY_UL',
  'BELLY_UR',
  'BELLY_LL',
  'BELLY_LR',
  'THIGH_L',
  'THIGH_R',
  'ARM_L',
  'ARM_R',
  'OTHER',
] as const;

export type InjectionZone = typeof INJECTION_ZONES[number];

export interface Injection {
  id: string;
  /** ISO-8601 timestamp the user logged. */
  takenAt: string;
  zone: InjectionZone;
  /** Free-text note when zone === 'OTHER'. */
  zoneNote?: string;
  /** Dose taken at this injection (mg). Snapshotted so changing current dose later doesn't rewrite history. */
  doseMg: number;
}

// ────────────────────────────────────────────────────────────────────
// Side-effect log
// ────────────────────────────────────────────────────────────────────

export const SIDE_EFFECT_METRICS = [
  'NAUSEA',
  'FATIGUE',
  'CONSTIPATION',
  'APPETITE_SUPPRESSION',
] as const;

export type SideEffectMetric = typeof SIDE_EFFECT_METRICS[number];

export const SIDE_EFFECT_CHIPS = [
  'HEADACHE',
  'HEARTBURN',
  'SULFUR_BURPS',
  'DIZZINESS',
  'DIARRHEA',
] as const;

export type SideEffectChip = typeof SIDE_EFFECT_CHIPS[number];

export interface SideEffectEntry {
  id: string;
  /** ISO-8601 timestamp. */
  loggedAt: string;
  /** Day after the most recent injection: 1, 2, or 3. */
  dayAfterShot: 1 | 2 | 3;
  /** 1–5 sliders. Defaults to 1 ("none") if not set. */
  metrics: Record<SideEffectMetric, number>;
  /** Multi-select chips that were toggled on. */
  chips: SideEffectChip[];
  /** Free-text custom symptoms entered via "Other". */
  customSymptoms: string[];
  /** Snapshot of dose at the time so we can correlate later. */
  doseMg: number;
}

// ────────────────────────────────────────────────────────────────────
// Food / protein log
// ────────────────────────────────────────────────────────────────────

export interface FoodEntry {
  id: string;
  loggedAt: string;
  /** Display name, e.g. "Greek yogurt", "Custom (32g)". */
  name: string;
  proteinGrams: number;
  /** True for the 8 default tiles, false for user-added custom entries. */
  preset: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Dose history (escalation ladder events)
// ────────────────────────────────────────────────────────────────────

export interface DoseHistoryEntry {
  id: string;
  /** ISO-8601 date the user moved TO this dose. */
  startedAt: string;
  /** Display value of the dose. */
  label: string;
  /** mg value for ordering / comparison. */
  mg: number;
}

// ────────────────────────────────────────────────────────────────────
// Refill schedule
// ────────────────────────────────────────────────────────────────────

export interface RefillSchedule {
  /** Doses contained in one pen/vial. e.g. Ozempic = 4. */
  dosesPerPen: number;
  /** Date the user last filled a prescription. */
  lastFilledAt: string;
  /** True after user marks the next refill as "requested" but not yet picked up. */
  refillRequested: boolean;
}

// ────────────────────────────────────────────────────────────────────
// User profile (set during onboarding, editable in settings)
// ────────────────────────────────────────────────────────────────────

export type WeightUnit = 'LB' | 'KG';
export type ThemePreference = 'AUTO' | 'LIGHT' | 'DARK';
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface UserProfile {
  /** Set true after the user completes the 6-step onboarding flow. */
  onboardingComplete: boolean;
  /** Drug they're on. OTHER triggers customDrugName. */
  drug: DrugFamily;
  /** Free-text custom drug name when drug === 'OTHER'. */
  customDrugName?: string;
  /** Current dose in mg. 0 means "I don't know yet" (skip during onboarding). */
  currentDoseMg: number;
  /** Display label for the current dose, e.g. "0.5 mg". */
  currentDoseLabel: string;
  /** Body weight, used to compute protein target only. */
  weight: number;
  weightUnit: WeightUnit;
  /** The day of the week the user takes their shot. */
  shotDay: DayOfWeek;
  /** Theme preference. AUTO = follow iOS system. */
  themePreference: ThemePreference;
  /** Hour-of-day for the morning shot reminder. Default 9 (9 AM). */
  shotReminderHour: number;
  /** Hour-of-day for the evening side-effect prompt. Default 20 (8 PM). */
  sideEffectPromptHour: number;
  /** Hour-of-day for refill reminders. Default 9 (9 AM). */
  refillReminderHour: number;
  /** Quiet-hours start, default 22 (10 PM). */
  quietHoursStart: number;
  /** Quiet-hours end, default 7 (7 AM). */
  quietHoursEnd: number;
  /**
   * ISO timestamp when the 14-day free trial started. Set automatically
   * when onboardingComplete flips true. null = trial never started.
   */
  trialStartedAt: string | null;
  /**
   * ISO timestamp until which the user has an active subscription. Set
   * by the IAP layer after a successful purchase or restore. null = no
   * active subscription. Cached locally so paywall logic still works
   * offline; canonical state lives in App Store / RevenueCat.
   */
  proUntil: string | null;
  /**
   * Dev-only override that grants PRO entitlement without going through
   * the App Store. Hidden behind __DEV__ in the Settings screen. Useful
   * when testing the paywall flow in Expo Go where IAP can't run.
   */
  devProOverride: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Storage envelope
// ────────────────────────────────────────────────────────────────────

/** Top-level shape persisted under a single AsyncStorage key. */
export interface ShotdayDb {
  /** Bumped when storage shape evolves; used for migrations. */
  schemaVersion: number;
  profile: UserProfile;
  injections: Injection[];
  sideEffects: SideEffectEntry[];
  foods: FoodEntry[];
  doseHistory: DoseHistoryEntry[];
  refill: RefillSchedule | null;
}

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_PROFILE: UserProfile = {
  onboardingComplete: false,
  drug: 'OZEMPIC',
  currentDoseMg: 0,
  currentDoseLabel: '',
  weight: 200,
  weightUnit: 'LB',
  shotDay: 'SUNDAY',
  themePreference: 'AUTO',
  shotReminderHour: 9,
  sideEffectPromptHour: 20,
  refillReminderHour: 9,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  trialStartedAt: null,
  proUntil: null,
  devProOverride: false,
};

export const EMPTY_DB: ShotdayDb = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  profile: DEFAULT_PROFILE,
  injections: [],
  sideEffects: [],
  foods: [],
  doseHistory: [],
  refill: null,
};
