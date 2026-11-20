# Graveyard Locator, mobile first slice

This slice covers Save a Grave (photo, name, GPS, offline save), the Grave Saved screen, and the Family Card QR code.

**Status: not compiled or run.** Flutter is not installed in the environment where this code was written, and package installs were blocked. Build and test it on your machine before you rely on it.

## Set up

1. Install Flutter (stable channel) and an Android emulator or phone.
2. From this `mobile` folder, generate the platform folders without overwriting `lib`:
   `flutter create --platforms=android,ios --project-name graveyard_locator .`
3. Run `flutter pub get`.
4. Add the permissions below.
5. Run `flutter analyze`, then `flutter test`, then `flutter run`.

### Android: `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### iOS: `ios/Runner/Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>The camera takes a photo of the grave.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Location records where the grave is.</string>
```

## What is in this slice

| Path | Purpose |
| --- | --- |
| lib/main.dart | App entry point |
| lib/core/theme.dart | Brand colours from the logo sheet, large type, 64dp buttons |
| lib/core/strings.dart | English strings in use, and the approved Somali strings for later |
| lib/domain/grave_token.dart | 26-character random token for the QR link |
| lib/data/local_db.dart | SQLite tables: graves, sync_queue, settings |
| lib/data/grave_repository.dart | Save writes the grave and its queue entry in one transaction |
| lib/data/sync_client.dart | Sends queued events in batches of 50, then uploads queued photos. Retry and backoff run from 1, 2, 4, 8, then 15 minutes |
| lib/domain/photo_rules.dart | Content type for a photo file |
| test/sync_client_test.dart | Backoff, result mapping, and event shape tests |
| test/photo_rules_test.dart | Content type tests |
| lib/features/home | Home screen with the waiting-for-connection count |
| lib/features/grave_save | Save a Grave and Grave Saved screens |
| lib/features/family_card | Family Card with the QR code |
| test/grave_token_test.dart | Token format tests |

## Known gaps

1. **Sync has no device-side test of the network or database path.** The pure parts (backoff, result mapping, event shape) are unit tested. Registration and batch sending run only on a device.
2. **The device token is lost if its storage is cleared.** The app keeps the token in settings. If the server already has the device and the token is gone, registration returns 409 and the device stays unsynced. A reinstall gives a new device ID, which avoids this.
2a. **The token is made on the device.** Spec section 8 says the server makes it. Offline saving needs the device to make it, and the token is still 130 random bits. Update the spec wording.
3. **Find Family Memorial is disabled.** It belongs to sprint 4.
4. **Somali is not wired.** The approved strings sit in `SomaliApproved`. The locale switch comes later.
5. **Permission denial shows one note.** The save stays blocked until location is on. The message does not say how to turn it on.
6. **The QR link uses gl.app.** The domain is not yet confirmed as available.
7. **Photo upload is built, but the signed upload step is unverified on a live project.** The app sends the bytes with PUT to the signed link from Supabase. Check this on a test project before a pilot.
8. **The camera content type is assumed to be JPEG.** Any path that does not end in .png is sent as image/jpeg. Confirm on a device.
9. **Photos that never upload stay pending on the server.** The server keeps a row and no file. A cleanup job is not built.
10. **The family screen opens from a QR scan.** Find Family Memorial on Home opens the scanner, then the family view. Camera permission is already declared. A deep link from a phone's own camera app is not built.
11. **Caretaker sign-in is in the app.** Caretaker visit on Home asks for a phone number, then the SMS code, then links the account to the device. The SMS provider is not set up: enable phone sign-in in the Supabase project and connect a provider that reaches Somali numbers before a pilot.
12. **The report form is built.** After scanning a grave, the caretaker picks a condition, adds a note, and saves. The report names the grave by QR token, which migration 0005 resolves on the server. The report records the caretaker's GPS position when location is on, and saves without it when location is off. There is no camera step in the report yet: the blueprint lists Camera in the same sprint, and photos on reports are not built.
13. **Publishing a report needs the admin secret.** The admin-actions function is the stand-in until the web console is built.
14. **The family view shows a map link.** The ef61de2b spec says the app opens Google Maps or Apple Maps for directions, and the bb4852f6 spec puts a map pin on the memorial view. The family view returns coordinates for that link and no GPS accuracy. The link uses a Google Maps web URL, which opens the native app where installed. Test it on iOS.
15. **Photos are cached on the phone by photo ID, as files.** The first open downloads each photo to the app's documents folder, and later opens read the file. A photo never opened while online shows "needs a connection" offline. Files are named `.jpg` whatever their real type, because the family response does not carry the content type. Image display reads the bytes, so PNG files still show. The cache has no size limit and no cleanup yet.
16. **Native-camera scans need hosting on gl.app.** The in-app scanner reads the link directly. When a family scans the card with the phone's own camera, the link opens in the browser unless `https://gl.app/.well-known/assetlinks.json` (Android) and `https://gl.app/.well-known/apple-app-site-association` (iOS) are hosted and the app declares the domain. This is deployment work, and it depends on owning gl.app.
17. **Server-side GPS proximity is not checked.** The server stores the report position and its accuracy, and does not compare them with the grave's position yet. When it does, a distance limit of about 10 metres plus the report's own accuracy absorbs normal GPS noise under trees and near buildings. The bb4852f6 spec describes a proximity check of about 10 metres, with low-confidence reports flagged for admin review.
