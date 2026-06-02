// Subscription disclosure copy.
//
// Apple's App Review Guidelines (3.1.2) require every paywall to clearly
// surface:
//   - Title of the publication or service
//   - Length of subscription (period + content/services per period)
//   - Price of subscription (with currency)
//   - Functional links to BOTH Terms of Use (EULA) AND Privacy Policy
//   - Auto-renew language with cancellation grace period (>= 24 hrs)
//   - "Manage subscription" pointer to App Store account settings
//
// We export each disclosure piece as a constant so the same wording flows
// through Paywall + Settings + App Store listing without drift.

/** Apple's required Terms of Use (EULA) URL. Replace with hosted version. */
export const TERMS_URL = 'https://www.spinwheelgo.com/shotday/terms.html';

/** Privacy Policy URL. Replace with hosted version before submission. */
export const PRIVACY_URL = 'https://www.spinwheelgo.com/shotday/privacy.html';

/** Apple's "manage subscriptions" deep-link. Always works on iOS. */
export const MANAGE_SUBSCRIPTIONS_URL =
  'https://apps.apple.com/account/subscriptions';

/** Display title for the subscription product. Required by 3.1.2(a). */
export const SUBSCRIPTION_TITLE = 'Shotday Pro';

/** Trial duration in human-readable form. */
export const FREE_TRIAL_LABEL = '14-day free trial';

/**
 * Full Apple-compliant disclosure block. Renders verbatim under the plan
 * picker on the paywall. Length and exact word choice match Apple's
 * sample text from "Offering Auto-Renewable Subscriptions in Your App".
 */
export const SUBSCRIPTION_DISCLOSURE = [
  'Shotday Pro is an auto-renewable subscription.',
  'Payment will be charged to your Apple ID account at confirmation of purchase.',
  'Your subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.',
  'Your account will be charged for renewal within 24 hours prior to the end of the current period at the same price unless you change your selection in Account Settings.',
  'You can manage and cancel your subscription by going to your Apple ID Account Settings after purchase.',
  'If you have a free trial, any unused portion is forfeited when you purchase a subscription.',
].join(' ');

/** Short one-liner for narrow contexts (e.g. Settings subscription card). */
export const SUBSCRIPTION_DISCLOSURE_SHORT =
  'Auto-renewable subscription. Cancel any time in your Apple ID Account Settings.';
