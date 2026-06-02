// Centralised disclaimer copy.
//
// Every health-adjacent surface in the app references one of these
// strings so the wording is consistent and a single edit propagates
// everywhere. Apple App Review specifically scrutinises medical-adjacent
// apps for clear "not medical advice" language; tweak with care.

/**
 * One-line tag used as a footer on screens where the user is making a
 * decision that influences their treatment (dose ladder, side-effect
 * log, refill setup, paywall, settings about). Short, low-friction.
 */
export const NOT_MEDICAL_ADVICE_SHORT =
  'Shotday is a tracking tool, not medical advice. Talk to your doctor before changing your dose.';

/** Slightly longer paragraph used in onboarding welcome + privacy/terms. */
export const NOT_MEDICAL_ADVICE_LONG =
  'Shotday helps you track your GLP-1 medication routine. It does not provide medical advice, diagnosis, or treatment. Always consult your prescribing physician before starting, stopping, or changing your dose. In an emergency, call your local emergency number.';

/** Tag that appears next to dose-change confirmations. */
export const DOSE_CHANGE_DISCLAIMER =
  'Logging a dose change here only updates your tracker. Confirm any actual dose change with your prescriber.';

/** Tag that appears next to side-effect logging. */
export const SIDE_EFFECT_DISCLAIMER =
  'Severe side effects? Stop logging and call your doctor or emergency services.';
