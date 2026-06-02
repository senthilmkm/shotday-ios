# RevenueCat Setup — Copy-Paste Reference

RevenueCat is the IAP middleware Shotday uses. It handles:

- Server-side receipt validation (so you don't have to build a backend)
- Cross-device entitlement restoration (one Apple ID → same Pro on iPad if you ever ship one)
- Subscription lifecycle webhooks (renewals, churn, refunds)
- A clean iOS SDK with much less boilerplate than raw StoreKit

Free tier covers up to **$10,000 / month tracked revenue**, which is plenty for a solo-dev launch.

---

## 0. Prerequisites

Before you start, both of these must be done:

- [x] App Store Connect → Subscriptions → both products created (`com.senthil.shotday.monthly`, `com.senthil.shotday.yearly`)
- [x] App Store Connect → Business → Paid Apps Agreement is **In Progress** or **Active**

---

## 1. Sign up

1. Go to **https://www.revenuecat.com/** → **Sign up**.
2. Create the account using your developer email (`senthil930@gmail.com` is fine).
3. Verify the email link they send.
4. When asked "What are you building?", pick **iOS** + **subscriptions**.

---

## 2. Get the App Store Connect Shared Secret (do this BEFORE filling RevenueCat)

RevenueCat needs an "App-Specific Shared Secret" from Apple to validate receipts on Apple's servers.

1. Go to **https://appstoreconnect.apple.com/** → **Apps** → **Shotday** → top-left of the page → **App Information**.
2. Scroll down until you find **App-Specific Shared Secret** → click **Manage**.
3. Click **Generate** (you only see the value once — copy it immediately).
4. Save it temporarily somewhere safe (like a password manager). It's a 32-char hex string starting with letters/numbers.

Note: this is **App-Specific** (per-app), not the older "Master Shared Secret" — RevenueCat docs call for the app-specific one.

---

## 3. Create the RevenueCat project + app

In RevenueCat dashboard:

1. **Project Name**: `Shotday`
2. After project creation, go to **Project Settings → Apps → + Add App**.
3. Pick **App Store**.
4. Fill in:

| Field | Value |
|---|---|
| App Name | `Shotday` |
| Bundle ID | `com.senthil.shotday` |
| App-Specific Shared Secret | *(paste the value from §2)* |

5. Save. Status should turn green ("Connected").

---

## 4. Create the Entitlement

An entitlement in RevenueCat is the *thing the user has access to* (vs. the products they bought to get it). Both monthly and yearly subscriptions grant the same entitlement.

The code in `src/iap/iap.ts` checks for an entitlement named **`pro`** (lowercase). It must match exactly.

1. Project → **Entitlements** → **+ New Entitlement**.
2. **Identifier**: `pro`
3. **Display Name**: `Pro`
4. Save.

---

## 5. Add Products + Attach to Entitlement

1. Project → **Products** → **+ New Product**.
2. Pick **App Store**.
3. **Identifier** must match App Store Connect exactly:

   ```
   com.senthil.shotday.monthly
   ```

4. **Type**: Auto-Renewable Subscription
5. Save → in the product detail page, find **Entitlements** → **Attach Entitlement** → select **`pro`**.

Repeat for the yearly product:

```
com.senthil.shotday.yearly
```

Both products attached to `pro`.

---

## 6. Create an Offering (the paywall config)

Offerings let you change which products show on the paywall without an app update. We'll start with one default offering containing both products.

1. Project → **Offerings** → **+ New Offering**.
2. **Identifier**: `default`
3. **Display Name**: `Default`
4. Add a **Package** for monthly:
   - Identifier: `$rc_monthly` (RevenueCat's reserved monthly slot)
   - Product: select `com.senthil.shotday.monthly`
5. Add a **Package** for yearly:
   - Identifier: `$rc_annual` (RevenueCat's reserved yearly slot — they call it "annual" internally; this is fine)
   - Product: select `com.senthil.shotday.yearly`
6. Mark this offering as **Current** (toggle in the offering page).

---

## 7. Get the Public API Key

1. Project → **API Keys** → **App API Keys**.
2. Find the row labeled **App Store** / **iOS**.
3. The key starts with `appl_` followed by a long alphanumeric string.
4. Copy it.

> This is a **public** key designed to ship inside your iOS app. It's safe to commit if you really wanted to (RevenueCat documents this). We still keep it in `.env.local` out of habit.

---

## 8. Drop the key into the project

Tell the agent the key. They'll:

- Add `.env` (or `.env.local`) with `EXPO_PUBLIC_REVENUECAT_IOS_KEY=<key>`
- Install `react-native-purchases` and `react-native-purchases-ui` (if needed)
- Wire `configureIap()` into `App.tsx` so it runs on app start
- Add the env var to `eas.json` build profiles so EAS picks it up at build time

Don't paste the key into chat. Save it to a temp file like the GitHub token flow:

```
C:\Users\senth\Desktop\rc-key.txt
```

Then tell the agent "saved" and they'll read it, write the env files, and delete it.

---

## 9. Self-check

After §3 through §7 are done, your RevenueCat dashboard should show:

- [ ] Project named `Shotday`
- [ ] One App Store app with bundle id `com.senthil.shotday`, App-Specific Shared Secret connected (green)
- [ ] Entitlement `pro` exists
- [ ] Two products: `com.senthil.shotday.monthly` and `com.senthil.shotday.yearly`, both attached to `pro`
- [ ] One offering called `default` with both products as packages, marked Current
- [ ] An iOS API key starting with `appl_` is visible in API Keys

---

## What RevenueCat does NOT need

A common pitfall — these are App Store Connect concerns, not RevenueCat's:

- ❌ Bank account / tax forms — those stay in App Store Connect → Business
- ❌ Subscription pricing — pricing is set in App Store Connect, RevenueCat just reads the prices via Apple's API
- ❌ Free trial config — the 14-day intro offer is configured on the App Store Connect product, not in RevenueCat

So if you're on a RevenueCat page looking for where to set the price or trial, you're in the wrong place. Go back to App Store Connect.

---

## Common errors you'll see during testing

| Error | What it means | Fix |
|---|---|---|
| `Configuration error: No products were found.` | Product IDs in code don't match App Store Connect | Compare `PRODUCT_IDS` in `iap.ts` against the App Store Connect product IDs character-by-character |
| `The App Store Receipt is not valid` | Shared Secret is wrong or expired | Regenerate the App-Specific Shared Secret and re-paste in RevenueCat |
| Purchase succeeds in RC dashboard but `pro` entitlement is empty | Products not attached to entitlement | RevenueCat → Products → click product → Attach Entitlement → `pro` |
| Sandbox account can't purchase | TestFlight build not signed with the right team | EAS credentials → re-run `npx eas credentials` |
