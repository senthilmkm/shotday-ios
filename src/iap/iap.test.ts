// jest.setup.ts mocks expo-constants to report `appOwnership: 'expo'`,
// which simulates the Expo Go environment. In that mode the IAP layer
// must:
//   - return mock products from `fetchProducts()` so the paywall UI renders
//   - return failure (not throw) from `purchaseProduct` and `restorePurchases`
//   - never attempt to load react-native-purchases natively
// These tests verify those guarantees.

import {
  fetchProducts,
  isIapAvailable,
  PRODUCT_IDS,
  purchaseProduct,
  restorePurchases,
} from './iap';

describe('isIapAvailable', () => {
  it('reports unavailable in the Expo-Go-shaped test env', () => {
    expect(isIapAvailable()).toBe(false);
  });
});

describe('fetchProducts', () => {
  it('returns at least the 2 mock products when IAP is unavailable', async () => {
    const products = await fetchProducts();
    expect(products.length).toBeGreaterThanOrEqual(2);
    expect(products.find((p) => p.id === PRODUCT_IDS.monthly)).toBeDefined();
    expect(products.find((p) => p.id === PRODUCT_IDS.annual)).toBeDefined();
  });

  it('every product has the required fields', async () => {
    const products = await fetchProducts();
    for (const p of products) {
      expect(p.id).toBeDefined();
      expect(p.title).toBeDefined();
      expect(p.priceString).toBeDefined();
      expect(['MONTH', 'YEAR']).toContain(p.period);
    }
  });
});

describe('purchaseProduct', () => {
  it('returns failure with error="unavailable" in Expo Go', async () => {
    const result = await purchaseProduct(PRODUCT_IDS.monthly);
    expect(result.success).toBe(false);
    expect(result.proUntil).toBeNull();
    expect(result.error).toBe('unavailable');
  });

  it('never throws, always returns a PurchaseResult shape', async () => {
    const result = await purchaseProduct('nonexistent.product.id');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('proUntil');
    expect(result).toHaveProperty('error');
  });
});

describe('restorePurchases', () => {
  it('returns failure with error="unavailable" in Expo Go', async () => {
    const result = await restorePurchases();
    expect(result.success).toBe(false);
    expect(result.proUntil).toBeNull();
    expect(result.error).toBe('unavailable');
  });
});

describe('PRODUCT_IDS', () => {
  it('has stable identifiers matching App Store Connect convention', () => {
    expect(PRODUCT_IDS.monthly).toBe('shotday.monthly');
    expect(PRODUCT_IDS.annual).toBe('shotday.annual');
  });
});
