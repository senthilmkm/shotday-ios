// In-app purchases — RevenueCat wrapper with Expo Go safety net.
//
// The native `react-native-purchases` module is NOT in Expo Go's bundled
// native modules. Importing it statically in Expo Go would crash on first
// call. We solve this with two layers:
//
//   1. `isIapAvailable()` — environment probe. Expo Go reports
//      `Constants.appOwnership === 'expo'`. In that case we never load
//      the native module and the rest of the surface area no-ops.
//
//   2. Runtime require + try/catch around every native call. Even when
//      we DO load the module, individual calls may throw on simulators
//      without StoreKit configuration; we degrade gracefully.
//
// The shape exported here is the public IAP surface. The Settings +
// Paywall screens program against this; they don't know whether they're
// talking to a real RC instance, a no-op stub, or a dev-mode stand-in.

import Constants from 'expo-constants';

export interface SubscriptionProduct {
  id: string;
  title: string;
  /** Pre-formatted price string like "$4.99". */
  priceString: string;
  /** Period in App Store terms: "MONTH" or "YEAR". */
  period: 'MONTH' | 'YEAR';
}

export interface PurchaseResult {
  /** True when the purchase completed and pro entitlement is active. */
  success: boolean;
  /** ISO timestamp until which the entitlement is valid; null on failure. */
  proUntil: string | null;
  /** Reason on failure ("user_cancelled", "network", etc.). null on success. */
  error: string | null;
}

/** App Store product identifiers. Configured in App Store Connect (Phase F). */
export const PRODUCT_IDS = {
  monthly: 'shotday.monthly',
  annual: 'shotday.annual',
} as const;

/** Returns true when we're running in an environment with native IAP support. */
export function isIapAvailable(): boolean {
  // Expo Go uses 'expo' for appOwnership. Bare/dev-client/standalone is null/undefined.
  return Constants.appOwnership !== 'expo';
}

/**
 * Lazy-loads the native module. Returns null when unavailable.
 * Cached so we only attempt the require once per session.
 */
let cachedModule: unknown = null;
let triedModule = false;
function loadPurchasesModule(): unknown {
  if (triedModule) return cachedModule;
  triedModule = true;
  if (!isIapAvailable()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases');
    cachedModule = mod?.default ?? mod;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

interface PurchasesLike {
  configure?: (cfg: { apiKey: string }) => Promise<void> | void;
  getOfferings?: () => Promise<unknown>;
  purchasePackage?: (pkg: unknown) => Promise<unknown>;
  restorePurchases?: () => Promise<unknown>;
  getCustomerInfo?: () => Promise<unknown>;
}

function asPurchases(): PurchasesLike | null {
  const mod = loadPurchasesModule();
  return (mod as PurchasesLike) ?? null;
}

/** One-time RevenueCat configuration call. Safe to invoke when unavailable. */
export async function configureIap(apiKey: string): Promise<void> {
  const p = asPurchases();
  if (!p?.configure) return;
  try {
    await p.configure({ apiKey });
  } catch (e) {
    console.warn('[shotday] configureIap failed', e);
  }
}

/**
 * Returns the available products (monthly + annual). When IAP is
 * unavailable (Expo Go, simulator without StoreKit) we return mock
 * products so the paywall UI still renders. Mock prices are placeholders
 * — the real numbers are configured in App Store Connect.
 */
export async function fetchProducts(): Promise<SubscriptionProduct[]> {
  const mock: SubscriptionProduct[] = [
    { id: PRODUCT_IDS.monthly, title: 'Monthly', priceString: '$4.99', period: 'MONTH' },
    { id: PRODUCT_IDS.annual, title: 'Annual', priceString: '$29.99', period: 'YEAR' },
  ];
  if (!isIapAvailable()) return mock;

  const p = asPurchases();
  if (!p?.getOfferings) return mock;
  try {
    const offerings = (await p.getOfferings()) as { current?: { availablePackages?: Array<{ identifier?: string; product?: { title?: string; priceString?: string; subscriptionPeriod?: string } }> } };
    const pkgs = offerings?.current?.availablePackages ?? [];
    if (pkgs.length === 0) return mock;
    return pkgs.map((pkg) => ({
      id: pkg.identifier ?? PRODUCT_IDS.monthly,
      title: pkg.product?.title ?? 'Subscription',
      priceString: pkg.product?.priceString ?? '$4.99',
      period: (pkg.product?.subscriptionPeriod ?? 'P1M').includes('Y') ? 'YEAR' : 'MONTH',
    }));
  } catch (e) {
    console.warn('[shotday] fetchProducts failed', e);
    return mock;
  }
}

/**
 * Attempts a purchase. In Expo Go / simulator this is a no-op that returns
 * `{ success: false, error: 'unavailable' }` so the UI shows the right
 * empty-state. Real purchases route through RevenueCat.
 */
export async function purchaseProduct(productId: string): Promise<PurchaseResult> {
  if (!isIapAvailable()) {
    return { success: false, proUntil: null, error: 'unavailable' };
  }
  const p = asPurchases();
  if (!p?.getOfferings || !p?.purchasePackage) {
    return { success: false, proUntil: null, error: 'unavailable' };
  }
  try {
    const offerings = (await p.getOfferings()) as { current?: { availablePackages?: Array<{ identifier?: string }> } };
    const pkg = offerings?.current?.availablePackages?.find((pkg) => pkg.identifier === productId);
    if (!pkg) return { success: false, proUntil: null, error: 'product_not_found' };
    const result = (await p.purchasePackage(pkg)) as { customerInfo?: { entitlements?: { active?: Record<string, { expirationDate?: string }> } } };
    const proEntitlement = result?.customerInfo?.entitlements?.active?.pro;
    if (proEntitlement?.expirationDate) {
      return { success: true, proUntil: proEntitlement.expirationDate, error: null };
    }
    return { success: false, proUntil: null, error: 'no_entitlement' };
  } catch (e: unknown) {
    const code = (e as { userCancelled?: boolean })?.userCancelled
      ? 'user_cancelled'
      : (e as { message?: string })?.message ?? 'unknown';
    if (code !== 'user_cancelled') {
      console.warn('[shotday] purchaseProduct failed', e);
    }
    return { success: false, proUntil: null, error: code };
  }
}

/** Re-checks active entitlements with the App Store. Apple-required button on Paywall. */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isIapAvailable()) {
    return { success: false, proUntil: null, error: 'unavailable' };
  }
  const p = asPurchases();
  if (!p?.restorePurchases) {
    return { success: false, proUntil: null, error: 'unavailable' };
  }
  try {
    const info = (await p.restorePurchases()) as { entitlements?: { active?: Record<string, { expirationDate?: string }> } };
    const proEntitlement = info?.entitlements?.active?.pro;
    if (proEntitlement?.expirationDate) {
      return { success: true, proUntil: proEntitlement.expirationDate, error: null };
    }
    return { success: false, proUntil: null, error: 'no_entitlement' };
  } catch (e: unknown) {
    console.warn('[shotday] restorePurchases failed', e);
    return { success: false, proUntil: null, error: (e as { message?: string })?.message ?? 'unknown' };
  }
}
