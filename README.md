# Shotday

A weekly companion for GLP-1 users. Track injection-site rotation, side effects,
protein intake, dose escalation, and refills — all on-device, no account, no cloud.

## Status

**Phase B (foundation) complete.** See [`SHOTDAY_ROADMAP.md`](./SHOTDAY_ROADMAP.md)
for the sequenced plan from here to App Store launch.

## Stack

- Expo SDK 54 + React Native 0.81 + React 19 + TypeScript 5.9
- AsyncStorage (single-blob JSON; future option to migrate to expo-sqlite)
- React Navigation native-stack
- react-native-svg for the body diagram
- expo-haptics + expo-notifications
- Jest + ts-jest for unit tests on pure-logic modules

## Local development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # Jest unit tests
npm start           # Expo dev server (requires Xcode for iOS sim)
```

## Architecture

```
src/
  types/         Pure data shapes — what gets persisted
  storage/       AsyncStorage adapter + migrations (Jest-tested)
  domain/        Pure logic: dose ladders, protein calc, rotation algo (Jest-tested)
  theme/         Color tokens, typography, light/dark provider
  components/    Reusable primitives (Button, Card, Chip, ProgressDots)
  hooks/         useShotdayDb — single-source-of-truth state + auto-persist
  navigation/    AppNavigator (post-onboarding)
  screens/
    Onboarding/  6-screen first-launch flow
    Home/        Home with 5 priority-ordered cards
    Injection/   Body-diagram + tap-to-log (Feature 1)
    SideEffects/ (Phase C)
    Food/        (Phase C)
    Dose/        (Phase D)
    Refill/      (Phase D)
    Settings/    (Phase E)
    Paywall/     (Phase E)
```

## Privacy

All user data lives in a single JSON blob under one AsyncStorage key on the device.
Nothing leaves the phone. Reset wipes everything in a single keystroke (Settings →
Reset, coming in Phase E).
