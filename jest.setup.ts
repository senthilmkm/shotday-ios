// Test environment shims.
//
// The `iap` layer touches expo-constants and (lazily) react-native-purchases
// — both of which require native modules. In the Node-only Jest environment
// we replace them with minimal stubs that exercise the no-op fallbacks.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    // Behaves like Expo Go would so the IAP layer takes its safe path.
    appOwnership: 'expo',
    expoConfig: { name: 'Shotday' },
  },
}));
