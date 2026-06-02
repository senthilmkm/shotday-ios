# In-App Purchase Products — Copy-Paste Reference

Use this doc while filling out **App Store Connect → your app → Monetization → In-App Purchases**.

Both products live inside a single Subscription Group called `Shotday Pro`.

> CRITICAL: Product IDs are permanent on your developer account. Once a product
> is created with a given ID, that ID is reserved forever — even if you delete
> the product. Copy-paste the IDs below exactly. Do not type them.

---

## Subscription Group (create first)

| Field | Value |
|---|---|
| Reference Name | `Shotday Pro` |
| Localizations → Display Name | `Shotday Pro` |
| App Name (in App Store) | `Shotday Pro` |

After creating the group, add both products below to it.

---

## Product 1 — Monthly

| Field | Value |
|---|---|
| Type | Auto-Renewable Subscription |
| Reference Name | `Shotday Pro Monthly` |
| Product ID | `com.senthil.shotday.monthly` |
| Subscription Group | `Shotday Pro` |
| Subscription Duration | 1 Month |
| Price (USD) | $4.99 (Tier 5) |
| Family Sharing | Off |

**Localization → English (U.S.)**

| Field | Value |
|---|---|
| Display Name | `Shotday Pro` |
| Description | `Track every part of your weekly GLP-1 routine. Cancel any time.` |

**Introductory Offer → Free Trial**

| Field | Value |
|---|---|
| Type | Free |
| Duration | 14 days |
| Eligibility | New subscribers only |

---

## Product 2 — Yearly

| Field | Value |
|---|---|
| Type | Auto-Renewable Subscription |
| Reference Name | `Shotday Pro Yearly` |
| Product ID | `com.senthil.shotday.yearly` |
| Subscription Group | `Shotday Pro` |
| Subscription Duration | 1 Year |
| Price (USD) | $29.99 (Tier 30) |
| Family Sharing | Off |

**Localization → English (U.S.)**

| Field | Value |
|---|---|
| Display Name | `Shotday Pro` |
| Description | `Track every part of your weekly GLP-1 routine. Cancel any time. Save 50% vs. monthly.` |

**Introductory Offer → Free Trial**

| Field | Value |
|---|---|
| Type | Free |
| Duration | 14 days |
| Eligibility | New subscribers only |

---

## Copy-paste blocks (single-line, no formatting)

**Monthly Product ID**

```
com.senthil.shotday.monthly
```

**Yearly Product ID**

```
com.senthil.shotday.yearly
```

**Monthly Description**

```
Track every part of your weekly GLP-1 routine. Cancel any time.
```

**Yearly Description**

```
Track every part of your weekly GLP-1 routine. Cancel any time. Save 50% vs. monthly.
```

---

## Per-product Apple requirements

Each product needs all three of these before it can be submitted with the app:

1. **Review Screenshot** — 1290×2796 (or any iPhone 6.7" screen size). Must show the paywall after the product loads. Take this from the iOS simulator or a TestFlight build.
2. **Review Notes** — paste the test instructions from `app-store-listing.md` → "Notes for review" section.
3. **Promotional Image** — 1024×1024. Reuse `assets/icon.png`.

You can fill in the screenshot and review notes after the first EAS build is uploaded. Until then, the product status will show as "Missing Metadata" — that's expected and not an error.

---

## Self-check (after creating both products)

- [ ] Both products show status "Ready to Submit" or "Waiting for Review"
- [ ] Product IDs in App Store Connect match `src/iap/iap.ts` exactly:
  - `com.senthil.shotday.monthly`
  - `com.senthil.shotday.yearly`
- [ ] Both belong to the same `Shotday Pro` subscription group
- [ ] Free trial is 14 days, "Free" type, on both products
- [ ] Yearly description includes the "Save 50% vs. monthly" copy
- [ ] Family Sharing is off on both (you can toggle on later post-launch)

---

## Why these specific values

- **`com.senthil.shotday.*`** — fully-qualified reverse-DNS naming. Apple's recommended convention; survives future product expansion (e.g., `com.senthil.shotday.lifetime`).
- **$4.99 / $29.99** — annual is 50% off effective ($2.50/mo vs $4.99/mo). The "Save 50%" claim in the yearly description requires this exact ratio.
- **14-day trial** — the listing copy ("14-day free trial") and the marketing in `What's New` both promise 14 days. Mismatch = App Store rejection under Guideline 3.1.2 for misleading subscription terms.
- **Family Sharing off** — health data is personal; we shouldn't surface "share with family" for a GLP-1 tracker. Easy to flip on later if users ask.
