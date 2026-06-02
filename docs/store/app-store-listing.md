# App Store Listing Copy — Shotday

Paste each field directly into App Store Connect. Character counts are
within Apple's hard limits as of June 2026:

| Field | Limit | Used |
|---|---|---|
| App name | 30 chars | 7 |
| Subtitle | 30 chars | 28 |
| Promotional text | 170 chars | 163 |
| Keywords | 100 chars | 99 |
| Description | 4000 chars | ~2950 |
| What's New | 4000 chars | ~480 |

---

## App Name (30)

```
Shotday
```

## Subtitle (30)

```
Weekly GLP-1 tracker, no cloud
```

## Promotional Text (170)
*(can be edited any time without re-submitting; great for launch / sales / holidays)*

```
14-day free trial. Track injections, side effects, dose, protein, refills — all on device. No accounts, analytics, or ads. For Ozempic, Wegovy, Mounjaro, Zepbound.
```

## Keywords (100, comma-separated, no spaces after commas)

```
glp1,ozempic,wegovy,mounjaro,zepbound,injection,tracker,semaglutide,tirzepatide,refill,protein,dose
```

---

## Description (4000)

```
Shotday is a private, on-device tracker for people on GLP-1 medications like Ozempic, Wegovy, Mounjaro, and Zepbound. It's designed for the five things that actually matter on a weekly shot routine — and nothing else.

▸ ROTATE INJECTION SITES
Tap a stylized body diagram to log where you injected. Shotday automatically suggests next week's site so you don't bruise the same spot twice. The "last week" zone is greyed out. The recommended next zone pulses gently. That's it — no scrolling, no menus.

▸ A 20-SECOND SIDE-EFFECT LOG
On the day after your shot, the home screen replaces the countdown with a one-tap "How are you feeling?" card. Rate nausea, fatigue, constipation, and appetite suppression on a clean 1-5 scale. Tap chips for headaches, heartburn, sulfur burps, dizziness. Add anything else as a custom symptom. Done.

▸ PROTEIN-FIRST FOOD LOG
GLP-1 drugs work by killing your appetite. That's the problem. If you don't eat enough protein you lose muscle along with the fat. Shotday computes a daily target from your weight (0.7g per pound of bodyweight) and gives you tiles for the protein staples — Greek yogurt, eggs, chicken, cottage cheese, whey, salmon, tofu, beef. One tap to log. No calories, no macros, no guilt.

▸ DOSE ESCALATION LADDER
Standard escalation for semaglutide and tirzepatide is built in. The ladder shows where you are, when you'll be eligible to bump (4 weeks per rung, the standard practice), and what the next dose looks like. Bump up, step down, or enter a custom compounded dose — all logged with a timestamp.

▸ REFILL ALARM
Tell Shotday how many doses your pen holds (4 for Ozempic/Wegovy, 1 for Mounjaro/Zepbound vials) and when you last filled. It counts down each time you log a shot and warns you 7 days before you'd run out — early enough to actually call the pharmacy.

————————

▸ PRIVATE BY DESIGN
Shotday has no account system. No email. No cloud. Your data is written to your device's encrypted local storage and never leaves — there is no server to send it to. We don't run analytics. We don't track you. We don't have ads. If you delete the app, your data is gone with it. That's the whole story.

▸ NOTIFICATIONS
Optional local reminders for shot day, the post-shot side-effect prompt, and refill alerts. Quiet hours are honored. You can deny notification permission and the app still works — the home screen always shows what's coming up.

▸ DARK MODE
Full dark and light themes that follow iOS system settings, or pick one manually.

————————

▸ HONEST DISCLAIMER
Shotday is a tracking tool, not medical advice. It's built from publicly available manufacturer guidance and standard nutrition science. Always consult your prescribing physician before starting, stopping, or changing any medication. In an emergency, call your local emergency number.

▸ SHOTDAY PRO
A 14-day free trial unlocks everything. After that, Pro is $4.99/month or $29.99/year (auto-renewable subscription via your Apple ID). Cancel any time in your Apple ID Account Settings. Your data stays on your device whether or not you subscribe.

————————

Privacy: https://www.spinwheelgo.com/shotday/privacy.html
Terms: https://www.spinwheelgo.com/shotday/terms.html
```

---

## What's New (4000) — v1.0.0 launch text

```
First release. Five focused features for your weekly GLP-1 routine:

• Body-diagram injection logging with auto site rotation
• 20-second post-shot side-effect log
• Protein-first food log with one-tap presets
• Dose escalation ladder with eligibility tracking
• Refill alarm based on doses logged

Built private-by-design — no account, no cloud, no analytics. 14-day free trial included. Thanks for being an early user. If you spot anything broken, email senthil930@gmail.com.
```

---

## Support URL

```
https://www.spinwheelgo.com/shotday/
```

## Marketing URL (optional)

```
https://www.spinwheelgo.com/shotday/
```

## Privacy Policy URL (REQUIRED)

```
https://www.spinwheelgo.com/shotday/privacy.html
```

## Copyright

```
© 2026 Senthil
```

---

## Notes for review

**App Review Information → Notes**:

```
Shotday is a private GLP-1 medication tracker for adults. All data is stored locally on the device using AsyncStorage; there is no backend server, no account system, no analytics SDK, and no advertising. The app is not a medical device and does not provide medical advice — this is stated explicitly in the welcome screen, settings, and on every dose-related action.

Test account: not applicable (no account system).

To test the subscription flow:
1. Open the app and complete onboarding (any drug, any dose, any weight, any shot day).
2. The 14-day trial starts automatically.
3. Tap the gear icon (top-right of home) → Subscription → Subscribe to open the paywall.
4. Use a sandbox tester to purchase the monthly or yearly plan.

To preview an expired-trial state without waiting 14 days:
1. Open Settings → scroll to "Dev tools" (only visible in TestFlight builds with __DEV__ flag).
2. Tap "Set trial: expired".
3. Return to Home — the red banner appears and the paywall auto-presents.

The body-diagram screen (Injection logging) and the side-effect log are the two features that may benefit from VoiceOver review — every tappable injection zone has an accessibility label naming the body part.

If anything is unclear, please email senthil930@gmail.com — we monitor the inbox during business hours US Pacific.
```
