# Shotday — Roadmap

A sequenced plan from "Phase B foundation built" → "Live on the App Store."

Order is optimized so:
1. **Risk first.** Anything that could become an App Store blocker is surfaced before we sink time into polish.
2. **Validate the daily rhythm early.** Features 2 + 3 (highest-frequency interactions) come right after Phase B so we can feel the app in our hand before building 4 + 5.
3. **One coherent loop per session.** Each phase is a single sitting (~2–3 hrs) ending in a working build you can use.

---

## ✅ Phase B — Foundation (DONE)

Built today. What's in the repo:

- TypeScript + Expo SDK 54 + RN 0.81 scaffold (matches FormatFlex)
- Domain types (Drug, Dose, Injection, SideEffect, FoodEntry, Refill, Profile)
- Pure-function logic: dose ladders (semaglutide + tirzepatide), protein-target calc, site-rotation algorithm
- AsyncStorage persistence layer with schema-version migration + corruption recovery
- Light + dark theme system with system-follow + explicit toggle
- Reusable primitives: `Button`, `Card`, `Chip`, `ProgressDots`, `ScreenContainer`
- 6-screen onboarding flow (Welcome → Drug → Dose → Weight → Shot Day → Notifications) with manual-entry fallbacks at every step
- Home screen with 5 priority-ordered cards (top card flips between "Shot day," "How are you feeling?," and "Next shot in N days" based on context)
- **Feature 1: Body diagram** — front-facing human SVG with 8 tappable zones, suggested-next pulsing ring, last-week greying, AsyncStorage persistence
- Jest unit tests on domain + storage logic (target: 90 %+ branch coverage on `src/domain/**` and `src/storage/**`)

What works end-to-end:
- Open app → onboarding → home → "It's shot day" card → tap site → log injection → dot appears in heatmap card
- Re-launch → state persists
- Toggle iOS to Dark mode → app follows automatically

What does NOT work yet (intentionally — see Phase C):
- Side-effect log
- Food / protein log (gauge shows 0 always)
- Dose ladder full screen (mini card on home only)
- Refill alarms (mini card placeholder)
- Local notifications scheduling
- Settings screen

---

## ✅ Phase C — Daily-rhythm features (DONE)

**Built:** the two highest-frequency features. Shotday is now a 7-day-a-week habit, not a 1-day reminder.

### C1. Side-Effect Log ✅
- `src/screens/SideEffects/SideEffectLogScreen.tsx` — modal slide-up
- 4 intensity rows (1–5 dot selectors): Nausea / Fatigue / Constipation / Appetite-suppression
- 5 chip toggles: Headache / Heartburn / Sulfur burps / Dizziness / Diarrhea
- Free-text "Other" → multi-add via Enter or Add button; tap pill to remove
- Auto-snapshots most recent injection's `doseMg` so changing dose later doesn't rewrite history
- Auto-tags `dayAfterShot` from injection date math; falls back to ad-hoc entry when out of window
- New domain: `src/domain/sideEffects.ts` + 18 unit tests

### C2. Protein-First Food Log ✅
- `src/screens/Food/FoodLogScreen.tsx` — modal slide-up
- 8-preset grid: Chicken / Yogurt / Eggs / Shake / Cottage cheese / Tuna / Edamame / Steak — each shows `+Ng`
- 9th "+" tile → custom-entry modal (name + grams)
- Today's entries list with long-press-to-remove
- Live gauge updates with each tap; success state at 100 %
- New domain: `src/domain/food.ts` (presets + aggregation) + 12 unit tests

### C3. Home top-card priority logic ✅
- New priority order: `POST_SHOT` (1–3 days after shot) > `SHOT_DAY` (today is shotDay & no recent shot) > `COUNTDOWN` (default)
- Top card routes to side-effect log when in post-shot window, body diagram otherwise
- Protein gauge card now routes to food log
- New domain: `src/domain/dateMath.ts` (calendarDaysBetween, dayAfterShot, daysSinceLastShot, daysUntilNext) + 17 unit tests

### C4. Integration test suite ✅
- `src/__tests__/integration.test.ts` — 21 end-to-end scenarios driven through the data layer (no UI rendering needed → runs on Windows)
- Coverage: full onboarding (3 paths), shot-day rotation, side-effect window edges (day 0 / 1 / 2 / 3 / 4+), food daily aggregation + cross-day isolation, 3-week journey simulation, persistence round-trip, home priority routing
- **118/118 Jest tests passing** across 8 suites; `npx tsc --noEmit` clean.

---

## ✅ Phase D — Maintenance features (DONE)

**Built:** all 5 features functional. App now survives a full week without manual intervention.

### D1. Dose-Escalation Ladder ✅
- `src/screens/Dose/DoseLadderScreen.tsx` — modal slide-up
- Visual ladder of every rung; current rung filled with primary color, next rung outlined, future rungs dimmed
- Tap a rung → confirmation alert before committing (with extra "Bump anyway" override when not yet eligible)
- Tap a past rung → step-back flow (doctor-prescribed reduction or side-effect-driven drop)
- Eligibility banner shows "ELIGIBLE TO BUMP" or "X days to go" based on `daysUntilEligibleToBump` (28-day default)
- "Custom dose" modal for compounded / off-ladder values
- History list of last 6 dose changes with dates

### D2. Refill Alarm ✅
- `src/screens/Refill/RefillScreen.tsx` — modal slide-up
- Smart defaults: 4 doses/pen for Ozempic + Wegovy, 1 dose/vial for Mounjaro + Zepbound (auto-pre-fills based on `db.profile.drug`)
- Doses-per-pen quick chips (1 / 2 / 4) plus free-text input
- Last-filled date with −1 wk / +1 wk steppers + "Today" reset
- Live status card: STOCKED / HEADS UP / REFILL NEEDED / NO DOSES LEFT — color-coded border
- "Refill requested" toggle silences URGENT alert
- "I picked up my refill" button resets the count cleanly
- "Disable refill tracking" tear-down option
- New domain: `src/domain/refill.ts` (`refillStatus`, `defaultDosesPerPen`, alert thresholds) + 13 unit tests

### D3. Local-Notification Scheduling ✅
- New module: `src/notifications/schedule.ts` — pure planner: `(db, now) → PlannedNotification[]`
- New module: `src/notifications/scheduler.ts` — thin expo-notifications wrapper (clear-then-apply, identifier-prefixed scoping)
- New hook: `src/notifications/useNotificationSync.ts` — wired into `App.tsx`. Recomputes plan + reschedules whenever scheduling-relevant state changes (shot day, reminder hours, quiet hours, injection count, refill status). Cheap JSON-key memoization avoids redundant work on side-effect/food edits.
- Channels:
  - **Weekly shot reminder** — fires on `shotDay` at `shotReminderHour:00`
  - **Weekly side-effect prompt** — fires the day after at `sideEffectPromptHour:00`, wrapping Sat→Sun correctly
  - **One-shot refill nudge** — fires at `refillReminderHour:00` next morning when status is URGENT or EMPTY and not yet requested
- Honors quiet hours (defaults 22→7); falls outside the requested fire-time → channel is skipped from the plan
- 22 unit tests covering `dayAfterWeekday`, `isInQuietHours` (incl. wrap-around), `nextHour`, plan gating, weekly schedule + identifier stability, refill-nudge edges
- Note: evening protein nudge deferred to Phase G — needs a background task (BGTaskScheduler), out of scope for v1

### D4. Home wire-up ✅
- Dose-ladder card → tappable → `DoseLadderScreen`
- Refill card → tappable → `RefillScreen`; border accents red on URGENT/EMPTY, subtitle changes based on alert level + refillRequested flag

### D5. Integration suite ✅
- 11 new end-to-end scenarios appended to `src/__tests__/integration.test.ts`:
  - 4-month full semaglutide ladder walk + drop-back-down + eligibility-resets-after-bump
  - Full refill journey (unconfigured → stocked → URGENT → INFO-after-request → reset-after-pickup)
  - Mounjaro EMPTY-after-each-shot edge case
  - Disable-tracking tear-down
  - Notification plan generation: post-onboarding (2 weekly), URGENT-triggers-nudge, request-drops-nudge, shot-day-change-updates-weekday, dose-history+refill round-trip through storage
- **166/166 Jest tests passing** across 10 suites; `npx tsc --noEmit` clean.

---

## ✅ Phase E — Settings + paywall (DONE)

**Built:** monetization + control. Trial → paywall → subscription loop is wired end-to-end with a graceful Expo Go fallback so the UI is testable today even though native IAP needs a dev-client build.

### E1. Entitlement state machine ✅
- New module: `src/domain/entitlement.ts` — pure function `(profile, now) → 'NEW_USER' | 'TRIAL' | 'EXPIRED' | 'PRO'`
- 14-day trial; 3-day warning window for the home banner
- Priority: `devProOverride > proUntil > trialStartedAt`
- `trialDaysRemaining`, `hasAccess`, `shouldShowTrialBanner` helpers
- 18 unit tests covering every state transition

### E2. IAP layer with Expo Go safety ✅
- New module: `src/iap/iap.ts` — public surface: `fetchProducts`, `purchaseProduct`, `restorePurchases`, `configureIap`, `isIapAvailable`
- Detects Expo Go via `Constants.appOwnership === 'expo'` and skips the native require entirely (no crash)
- Lazy `require('react-native-purchases')` so Metro never resolves the native module in Expo Go
- Returns mock products in unavailable mode so the paywall UI still renders
- Apple-required `restorePurchases` exposed and wired
- 7 unit tests verifying the no-op fallback shape (jest.setup.ts mocks expo-constants)

### E3. PaywallScreen ✅
- `src/screens/Paywall/PaywallScreen.tsx` — modal slide-up
- Headline adapts to entitlement: "14-day trial included" → "N days left" → "Trial ends today" → "Trial ended"
- 3 benefit cards (rotation, side-effect timeline, protein-first)
- Plan picker: monthly + annual; annual shows "save ~50%" badge; defaults to annual
- Big "Subscribe" CTA with loading spinner, haptic feedback on success
- "Restore purchases" link (Apple-required)
- "Manage subscription" link to Apple ID page when already PRO
- Auto-renew + Terms/Privacy disclosure copy
- "Continue without subscribing" dismiss button hidden when EXPIRED (modal becomes blocking)

### E4. SettingsScreen ✅
- `src/screens/Settings/SettingsScreen.tsx` — modal slide-up with 9 sections
- Subscription card linking to Paywall (state-aware label: Pro / Trial — N days / Trial ended / Free trial)
- Drug + dose link to dose-ladder
- Weight + live protein-target preview
- Shot day chip row
- Reminder times: shot, side-effect, refill — each with `−1h / +1h` rocker buttons
- Quiet hours: start + end pickers side-by-side
- Theme: Auto / Light / Dark chips (live)
- Refill quick-link
- Notifications → opens iOS Settings.app via `Linking.openSettings()`
- About section (version, platform, "not medical advice" disclaimer)
- **Dev tools (only in `__DEV__`)**: Force Pro toggle, "Set trial → 1 day left", "Expire trial now" — for fast paywall testing in Expo Go
- Reset all data (destructive confirm)

### E5. Trial init + nav wiring ✅
- `NotificationPermissionScreen.completeOnboarding` sets `trialStartedAt` on first run (idempotent — preserves existing value if onboarding is re-run)
- `AppNavigator` registers `Settings` + `Paywall` as modal screens
- `HomeScreen` adds:
  - ⚙ settings gear button in the header (top-right)
  - Yellow trial-ending banner inside the warning window (≤3 days left)
  - Red "Trial ended" banner when EXPIRED
  - Auto-opens the Paywall once per session when EXPIRED (50ms after mount so navigator is ready)
- `storage.migrate` defensively merges new profile fields so existing users don't see undefined `trialStartedAt`/`proUntil`

### E6. Integration suite ✅
- 8 new end-to-end scenarios appended to `src/__tests__/integration.test.ts`:
  - NEW_USER → TRIAL on onboarding completion
  - Idempotent trial init (re-running onboarding doesn't reset clock)
  - Banner appears only inside warning window
  - TRIAL → EXPIRED at exactly day 14
  - EXPIRED → PRO via successful purchase, then EXPIRED again after subscription lapses
  - Dev override beats every other input
  - Reset wipes trial; new onboarding starts fresh trial
  - PRO subscription overrides EXPIRED trial without losing trial history
  - trialStartedAt + proUntil round-trip through storage
- **202/202 Jest tests passing** across 12 suites; `npx tsc --noEmit` clean; lint clean.

**Deliverable:** trial → paywall → subscription wired. Real purchases require a dev-client build (Phase F territory) but the UX flow is testable end-to-end in Expo Go via the dev-tools toggles.

---

## ✅ Phase F — App Store readiness (mostly DONE — independent batches)

**Goal:** clear every blocker that would cause a rejection. Independent
items completed by the assistant; user-side items remain (App Store
Connect dashboard work + EAS credentials + hosting the policies).

### F1. Code/content batch ✅

- **Health disclaimer** — centralised in `src/copy/disclaimers.ts` and rendered in:
  - Welcome onboarding screen (full paragraph above "Get started")
  - Side-Effect Log (footer caption)
  - Dose Ladder (footer caption beneath custom-dose button)
  - Settings → About (short-form line)
- **Apple-required subscription disclosure** — `src/copy/subscription.ts` exports the verbatim disclosure block, plus tappable Terms + Privacy links rendered on:
  - Paywall (full disclosure paragraph + link row)
  - Settings → Subscription card (short-form line) + Settings → About (link row)
- **Empty + error states** —
  - Global `<ErrorBoundary>` at app root with friendly recovery UI ("Try again" + "Reset all data") — replaces blank-screen crashes
  - Home screen protein card → "Add your weight to set a target" empty state
  - Home screen dose-ladder card → "Tap to set your starting dose" empty state
  - FoodLog → no-target callout when weight isn't set
  - SideEffectLog → already had subtitle for missing injection; left as-is
  - DoseLadder → already had "Set a starting dose first." banner
  - Refill → already had unconfigured/configured branches
- **Accessibility audit** — every interactive element now has a sensible VoiceOver label, role, and (where useful) hint:
  - `Button`, `Chip`, `IntensityRow` already had role/state from earlier phases
  - `Card` now accepts and forwards `accessibilityLabel` + `accessibilityHint` when pressable
  - Home settings gear, trial banners, expired banner, all 4 cards
  - BodyDiagramSvg — every zone Rect has a body-part label + suggested-site qualifier
  - FoodLog preset tiles, custom tile, entry rows, modal inputs, modal backdrop
  - SideEffectLog custom-pill remove buttons + custom-symptom input
  - DoseLadder rung Pressables (current/next/past/future), modal backdrop, custom-mg input
  - Refill chips (selected state), date adjusters, "Today" reset, custom-doses input, refill-requested Switch
  - Settings rows (drug+dose, refill, system notifications), force-Pro Switch, hour-picker buttons
  - Onboarding inputs (drug name, custom dose, weight)
  - ProgressDots → role=progressbar with min/max/now value
- **app.json permission audit** — added Android `POST_NOTIFICATIONS` + `SCHEDULE_EXACT_ALARM`, expanded `NSUserNotificationsUsageDescription` to mention "All scheduling happens on your device", added `LSApplicationCategoryType: healthcare-fitness`, configured `expo-notifications` plugin with brand color.

### F2. Visual batch ✅

- **App icon** — `assets/icon.png` (1024×1024) + `assets/adaptive-icon.png` (1024×1024) + `assets/favicon.png` (96×96). Brand teal gradient with 3 concentric white rings + center dot — matches the body-diagram suggested-site visual language.
- **Splash screen** — `assets/splash-icon.png` (1242×1242) on white background.
- **Generator script** — `scripts/generate-icons.ps1` regenerates all four assets deterministically. Run any time the design changes; outputs are pixel-perfect squares (the AI image generator returns 1536×1024, which is wrong for app icons).

### F3. Doc batch ✅

- **Privacy policy** — `docs/legal/privacy.html` (ready-to-host static page with light/dark CSS, table of contents, RevenueCat disclosure section, contact email).
- **Terms of Use** — `docs/legal/terms.html` (Apple-EULA reference, subscription terms verbatim, governing law California).
- **App Store listing copy** — `docs/store/app-store-listing.md` (name, subtitle, promo text, keywords, full description, what's-new, review notes — all within Apple's character limits).
- **App Store Connect setup guide** — `docs/store/app-store-connect-setup.md` (12-section walkthrough: app record, Privacy Nutrition Labels, age rating, IAP product setup, RevenueCat config, EAS credentials, TestFlight, screenshots, pre-submission checklist, common rejection reasons).

### F4. Requires user (pending)

- [ ] Enroll / verify Apple Developer Program membership
- [ ] Create `Shotday` app record in App Store Connect with bundle id `com.senthil.shotday`
- [ ] Host `privacy.html` and `terms.html` at the URLs hard-coded in `src/copy/subscription.ts` (`https://www.spinwheelgo.com/shotday/{privacy,terms}.html`)
- [ ] Configure IAP products in App Store Connect (`com.senthil.shotday.monthly`, `com.senthil.shotday.yearly`) with 14-day intro offer
- [ ] Configure RevenueCat project + paste public iOS API key into `.env.local`
- [ ] Submit Privacy Nutrition Labels (answer "No" to data collection)
- [ ] Submit Age Rating questionnaire (Medical/Treatment + Drug Use → 17+)
- [ ] Run `npx eas build --platform ios --profile production` then `npx eas submit`

**Deliverable so far:** all rejection-bait that lives in the codebase or
in markdown is fixed. Final verification: 202/202 Jest, `npx tsc --noEmit`
clean, lint clean.

---

## Phase G — Polish + E2E tests (~2 hrs)

**Goal:** the difference between "functional" and "delightful."

- Maestro E2E suite (`maestro/`):
  - `onboarding-happy-path.yaml`
  - `log-injection-suggested-site.yaml`
  - `log-side-effects-day-after.yaml`
  - `log-protein-tile-then-custom.yaml`
  - `bump-dose-rung.yaml`
  - `refill-flow-2-doses-left.yaml`
- Pulse animation on suggested-next zone (`react-native-reanimated`)
- Subtle scale-on-press across cards
- iPad layout decision: lock to portrait phone-only for v1 (`supportsTablet: false` already set)
- Minimum iOS version: lock at iOS 15.1 (Expo SDK 54 default)

**Deliverable:** feels native, not like a hybrid app.

---

## Phase H — Submission (~2–3 hrs, plus Apple review wait)

**Goal:** in front of users.

1. Capture App Store screenshots (5 sizes: 6.9", 6.7", 6.5", 5.5", iPad-pro fallback if applicable)
2. Write App Store listing copy (title, subtitle, keywords, description, what's new)
3. Configure App Store Connect: pricing, in-app purchases, regions, category (Health & Fitness)
4. EAS Build production binary, EAS Submit to App Store Connect
5. TestFlight: internal testing (you), then external if comfortable
6. Submit for review
7. Reply to Apple's questions within 24 hrs

**Deliverable:** "Shotday is live on the App Store."

---

## Total estimate

| Phase | Time | Cumulative |
|---|---|---|
| B (DONE) | — | foundation |
| C (DONE) | 3 hrs | 3 hrs |
| D (DONE) | 2.5 hrs | 5.5 hrs |
| E (DONE) | 2 hrs | 7.5 hrs |
| F | 3 hrs | 10.5 hrs |
| G | 2 hrs | 12.5 hrs |
| H | 2.5 hrs | 15 hrs |

**~15 hours of focused work + Apple review (1–7 days).**

Add a 50% buffer for the inevitable surprises → **22 hours = 6–8 weekend sessions** to "live on the App Store."

That's the realistic plan. Match against your calendar before committing.
