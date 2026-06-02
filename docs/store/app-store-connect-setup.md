# App Store Connect — Setup Guide

A step-by-step checklist of everything that must be done in App Store
Connect (and adjacent dashboards) before Shotday's first TestFlight or
public release. Each section is ordered so blockers come before
nice-to-haves.

> Apple's review timeline: typically 24-48 hours for a first submission, 1-12 hours for updates.

---

## 0. Prerequisites

You should already have:

- [ ] Apple Developer Program membership ($99/year, individual or organization).
- [ ] An iPhone signed into the same Apple ID that owns the Developer account (for TestFlight install).
- [ ] An EAS Expo account on the same login as your CLI session.

---

## 1. Create the App record

App Store Connect → **My Apps** → **+** → **New App**.

| Field | Value |
|---|---|
| Platforms | iOS |
| Name | `Shotday` |
| Primary Language | English (U.S.) |
| Bundle ID | Select `com.senthil.shotday` (you'll register it in Xcode/EAS first — see §6) |
| SKU | `shotday-ios-001` (anything unique, never user-visible) |
| User Access | Full Access |

After creation, paste in the App Information fields from
`docs/store/app-store-listing.md`.

---

## 2. Privacy Nutrition Labels

App Store Connect → your app → **App Privacy**.

Click **Get Started** then answer:

> Do you or your third-party partners collect data from this app?

Answer: **No**.

The reason: every section is genuinely "no" for Shotday v1:

- We don't use analytics SDKs.
- We don't use ad SDKs.
- RevenueCat is the only third-party network call. It receives an anonymous installation ID and the App Store transaction receipt — no health data, no email, no name. RevenueCat itself does not "collect data" within Apple's nutrition-label definition (it is a billing receipt validator); they document this on their developer portal. The transaction receipt itself is between the user and Apple.
- We don't use HealthKit.
- We don't use location, contacts, photos, microphone, camera, calendar, or motion.

If Apple's reviewer pushes back asking specifically about RevenueCat:

- Disclose **"Purchases" → "Other purchase history"** under **Linked to identity → No**, **Used for tracking → No**.
- Purpose: **App functionality** (specifically: "verifying subscription entitlement").

That single optional disclosure is enough; nothing else is required.

---

## 3. Age Rating

App Store Connect → **App Information** → **Age Rating** → **Edit**.

Answer "None" / "Infrequent/Mild" honestly to every question. The
following answers produce a **17+** rating which is what Apple expects
for any app referencing prescription medication:

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use or References | **Frequent / Intense** |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Gambling | None |
| Medical/Treatment Information | **Frequent / Intense** |

> Note: Apple's review team treats prescription-drug tracking as
> "Medical/Treatment Information — Frequent". Selecting **None** here
> is the most common reason apps in this category get rejected and
> need a metadata-only re-submission. Don't try to dodge this.

Result: **17+**.

---

## 4. In-App Purchase products

App Store Connect → your app → **Monetization → In-App Purchases**.

Create two **Auto-Renewable Subscription** products inside a single
Subscription Group (`Shotday Pro`). The product IDs MUST match the ones
in `src/iap/iap.ts`:

```ts
// src/iap/iap.ts
export const PRODUCT_IDS = {
  monthly: 'shotday_pro_monthly',
  yearly: 'shotday_pro_yearly',
};
```

| Field | Monthly | Yearly |
|---|---|---|
| Reference Name | `Shotday Pro Monthly` | `Shotday Pro Yearly` |
| Product ID | `shotday_pro_monthly` | `shotday_pro_yearly` |
| Subscription Group | `Shotday Pro` | `Shotday Pro` |
| Subscription Duration | 1 Month | 1 Year |
| Price (USD) | $4.99 | $39.99 |
| Localizations → Display Name | `Shotday Pro` | `Shotday Pro` |
| Localizations → Description | `Track every part of your weekly GLP-1 routine. Cancel any time.` | `Track every part of your weekly GLP-1 routine. Cancel any time. Save 33% vs. monthly.` |
| Free Trial | 14 days (Introductory Offer → Free) | 14 days (Introductory Offer → Free) |
| Family Sharing | OFF (you can flip this on later if you want) |

Apple requires each subscription to have:

- A **Review Screenshot** (1290×2796 or any iPhone 6.7" screen) showing the paywall. Take one in the simulator after the next EAS build.
- **Review Notes**: paste the test instructions from `app-store-listing.md` → "Notes for review" section.
- **Promotional Image** (1024×1024) — reuse `assets/icon.png`.

---

## 5. RevenueCat configuration

> If you decide to skip RevenueCat and use raw `expo-iap` / StoreKit,
> ignore this section.

1. Sign up at [revenuecat.com](https://www.revenuecat.com/).
2. Create a project named `Shotday`.
3. Add the iOS app: bundle id `com.senthil.shotday`.
4. Upload the **App Store Connect Shared Secret** (Connect → Apps → Shotday → App-Specific Shared Secret → generate).
5. Create one **Entitlement** named exactly `pro` (lowercase). This is what `iap.ts` checks against.
6. Create two **Products** matching the App Store IDs and attach both to the `pro` entitlement.
7. Copy the **Public Apple API key** from RevenueCat → Project → API Keys.
8. Add to a `.env.local` file (gitignored) at the project root:

   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_XXXXXXXXXXXXXX
   ```

9. Update `src/iap/iap.ts` `configureIap()` to read from `process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY` if it isn't already.

---

## 6. EAS Build credentials (iOS)

```
# from project root
npx eas login
npx eas build:configure
npx eas credentials
```

When prompted:

- **Platform** → iOS
- **Provisioning profile** → Let EAS manage it (recommended)
- **Distribution certificate** → Let EAS manage it
- **Push notification key** → Skip (we don't use push notifications; only local)
- **Bundle identifier** → `com.senthil.shotday` (creates the App ID in Apple Developer if missing)

Then build for TestFlight:

```
npx eas build --platform ios --profile production
```

When the build finishes, EAS prints a URL. Open it, click **Submit to App Store** (or run `npx eas submit --platform ios`).

---

## 7. TestFlight setup

App Store Connect → your app → **TestFlight**.

1. Wait for the just-uploaded build to finish processing (~10-30 min).
2. Add **Test Information**:
   - Beta App Description: copy from `app-store-listing.md` → Description, trimmed to one paragraph.
   - Email: `senthil930@gmail.com`.
   - Privacy Policy URL: `https://www.spinwheelgo.com/shotday/privacy.html`.
3. Add yourself as an **Internal Tester** (no review required for internal).
4. Install the TestFlight app on your iPhone, sign in with the Apple ID, accept the invite, and run.

---

## 8. App Review submission

App Store Connect → your app → **Distribution → App Store** → **+ Version**.

| Field | Value |
|---|---|
| Version Number | `1.0.0` |
| Build | Select the EAS build that just finished |
| Screenshots | Upload 6.7" iPhone screenshots (3-10 of them; see §9) |
| Promotional Text | from listing doc |
| Description | from listing doc |
| Keywords | from listing doc |
| Support URL | `https://www.spinwheelgo.com/shotday/` |
| Marketing URL | optional, same as support |
| Copyright | `© 2026 Senthil` |
| Sign-in required | **No** |
| Contact information | your real name, email, phone |
| Notes | from listing doc → "Notes for review" |
| Attachment | Optional: a short screen recording of the paywall flow |

Click **Add for Review** → **Submit to App Review**.

---

## 9. Screenshots (6.7" iPhone — REQUIRED)

Apple requires at least 3 screenshots at 1290×2796 (iPhone 16 Pro Max) or 1242×2688 (iPhone 14 Plus).

Recommended set (capture in the simulator on a Mac, OR on the real device after TestFlight install):

1. **Home screen** — top priority card showing "It's shot day".
2. **Body diagram** — pulsing suggested zone visible.
3. **Side-effect log** — intensity rows + chips.
4. **Protein gauge** + preset tiles.
5. **Dose ladder** — current rung highlighted.
6. **Refill alarm** — status pill.

Skip the paywall screenshot; Apple is sensitive about subscription screens
in marketing imagery and using one raises the review bar.

If you don't have a Mac, EAS can build a "preview" QR-installable build
which TestFlight can run on the iPhone — then you can capture screenshots
directly with iOS's screenshot gesture (Vol Up + Side button).

---

## 10. Pre-submission self-check

- [ ] App icon is a perfect 1024×1024 PNG with no alpha (✅ — verified by `scripts/generate-icons.ps1`)
- [ ] Privacy Policy hosted and reachable
- [ ] Terms of Use hosted and reachable
- [ ] Both URLs linked from the Paywall and Settings (✅ — wired in code)
- [ ] Subscription disclosure copy matches Apple's required language word-for-word (✅ — see `src/copy/subscription.ts`)
- [ ] Free trial language present on the paywall (✅)
- [ ] "Manage subscription" deep-link present (✅)
- [ ] Health disclaimer present at onboarding, settings, paywall, dose ladder, side-effect log (✅)
- [ ] Age rating set to 17+ with Medical/Treatment + Drug Use checked (manual)
- [ ] Privacy Nutrition Labels submitted with "No data collected" (manual)
- [ ] Test instructions written in App Review Notes (✅ — see listing doc)
- [ ] Demo / sandbox account NOT required (✅ — local-only app)
- [ ] At least 3 6.7" screenshots uploaded (manual)

---

## 11. After approval

- App goes live within ~1 hour of approval.
- Update `docs/legal/privacy.html` and `terms.html` with the actual App Store ID once Apple assigns it.
- Save the App Store URL for marketing.
- Bookmark App Store Connect → **Sales and Trends** for daily install + revenue tracking.
- Bookmark App Store Connect → **Reviews** to respond to user reviews (Apple lets you reply once per review).

---

## 12. Common rejection reasons (and how we've already handled each)

| Reason | Our defense |
|---|---|
| Guideline 5.1.1 — Privacy: missing privacy policy URL | Hosted at `/shotday/privacy.html` and linked in app |
| Guideline 3.1.2 — Subscriptions: missing required disclosure | `SUBSCRIPTION_DISCLOSURE` in `src/copy/subscription.ts` matches Apple's sample language verbatim |
| Guideline 3.1.2 — Subscriptions: missing functional Terms link | Tappable `Terms of Use` button on Paywall opens hosted page |
| Guideline 1.4.1 — Medical: misleading medical claims | Health disclaimer present on every health-adjacent surface; description explicitly says "not medical advice" |
| Guideline 4.0 — Design: app fails to load | ErrorBoundary at app root with friendly recovery UI |
| Metadata: Age rating doesn't match content | 17+ with Medical/Treatment + Drug Use selected |
| Metadata: Screenshots show device frames or marketing chrome | Use clean simulator screenshots, no device frames |
