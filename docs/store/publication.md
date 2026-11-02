# Publication checklist

What each store asks, and the answers for Nixo.

## Both stores

- **Age:** tobacco references and the app is meant for adults. App Store: answer "Infrequent/Mild" to *Alcohol, Tobacco, or Drug Use or References* and set the age to 17+ (or 18+ where offered). Google Play (IARC questionnaire): mention tobacco references; no violence, no gambling, user interaction yes (duo and witnesses), no location sharing.
- **Category:** Health & Fitness.
- **Privacy policy URL:** host `docs/legal/confidentialite.md` and `privacy.md` on a public page (for example nixo.ch/confidentialite) and set `EXPO_PUBLIC_LEGAL_URL` so Settings links to it.
- **Account deletion:** in the app, Settings → Delete my account. Google Play also asks for a web page explaining it: the privacy policy section "Your rights" covers it.
- **Review note for Apple and Google:** "No login needed. The duo and witness features need two phones: enter the invite code shown on the Duo tab of one phone into the other. Purchases can be tested with sandbox accounts."

## App Store · App Privacy

Data collected, all **linked to the user** (anonymous id), **not used for tracking**:

| Apple category | What | Purpose |
| --- | --- | --- |
| Identifiers · User ID | anonymous Supabase id, RevenueCat app user id | App functionality |
| Contact info · Name | first name shown to the duo and witnesses | App functionality |
| User content · Other user content | companion name, reports, encouragements | App functionality |
| Usage data · Other usage data | streak, companion health and form | App functionality |
| Purchases · Purchase history | via RevenueCat | App functionality |

Not collected: health records, location, contacts, email, phone number, browsing, diagnostics, advertising data.

Encryption: the app only uses standard HTTPS, so `ITSAppUsesNonExemptEncryption` is set to false in `app.json`.

## Google Play · Data safety

- Data is encrypted in transit: yes.
- Users can request deletion: yes, in the app.
- Collected and shared: none shared with third parties for their own use.
- Collected: Personal info → Name (optional); App activity → Other user-generated content, Other actions; App info → none; Device or other IDs → yes (push token, anonymous id); Financial info → Purchase history.
- Purpose for all: App functionality. None for advertising or analytics.

## In-app products (create in App Store Connect, Google Play and RevenueCat)

| Product id | Type | Suggested price |
| --- | --- | --- |
| `nixo_revive` | Consumable | CHF 2.00 |
| `nixo_freeze_pack_3` | Consumable | CHF 1.50 |
| `nixo_species_moss` | Non-consumable | CHF 4.00 |
| `nixo_species_mist` | Non-consumable | CHF 4.00 |
| `nixo_species_ochre` | Non-consumable | CHF 4.00 |

## Screenshots

`docs/store/screenshots/` holds FR and EN sets, generated with `node scripts/store-screenshots.mjs` from the web build:

- `ios-6.9/` 1320×2868 (iPhone 6.9", accepted for all iPhones)
- `ios-ipad-13/` 2064×2752 (iPad 13", needed because the app supports tablets)
- `android-phone/` 1080×1920

## Build and submit

```sh
npm i -g eas-cli
eas login
eas init                      # links the project, writes the projectId into app.json
eas credentials               # Apple push key, Android FCM (google-services.json)
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
```

Store builds hide the clock lab. Set `EXPO_PUBLIC_SHOW_LAB=1` in a `preview` build to keep it for testers.
