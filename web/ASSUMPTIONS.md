# Assumptions and open items

## Delivery scope

- The brief offered implementation variants. This delivery continues Sprint 6 as a responsive, installable web/PWA application rather than adding a separate Flutter application. Flutter/Android APK CI is therefore outside this delivery.
- English is the initial interface language. All interface copy is centralized in `src/lib/strings.ts` so a Somali locale can be added without rewriting page logic. The locale switch itself is not built.
- Static hosting uses hash routes. The Family Card QR still contains exactly `https://gl.app/g/{token}`. The production domain must redirect that path to the deployed app’s `/#/g/{token}` route.
- The supplied charity mark and the exact requested Ahmed Gorse credit are used on the home screen.

## Offline and synchronization

- A grave save is complete when its grave, resized photo, photo-upload item, and sync event have committed locally in one IndexedDB transaction. It does not depend on a server response.
- A condition report and its sync event likewise commit together. Caretaker linking is a local indication of completed server authentication; the server independently checks the caretaker’s active cemetery-section assignment for every report.
- The outbox sends at most 50 due events per batch and retries after 1, 2, 4, 8, then 15 minutes. Idempotency is based on `(device_id, client_event_id)`. Entity versions produce conflicts rather than silently overwriting newer records.
- QR-token collisions cause the affected device to generate a fresh token and retry. Photo upload uses reserve, signed PUT, then byte-size/SHA-256 confirmation.
- Browser Background Sync is used where available. Otherwise sync runs when requested, when the app returns online, or when the app is open. A closed browser cannot guarantee timed background retries on every platform.
- Local browser storage is not a cross-device backup. Clearing site data, using private browsing, or losing the device can remove unsynced records. A pilot needs a backup/sync operating procedure.

## Privacy and security

- Only the deceased person’s name, grave location, plot details, photos, and condition information are stored. Caretaker phone numbers remain in Supabase Auth.
- Device registration creates 32 random bytes. The token is returned once and only its SHA-256 hash is stored server-side.
- Application tables have RLS enabled and no public read/write policies. The service role performs database access in Edge Functions.
- The photo bucket is private. Family responses contain public memorial fields, ready-photo signed URLs valid for one hour, and published reports only.
- The service-role key and `ADMIN_SECRET` are server secrets. Only the public anon key is included in the app bundle. Admin secrets are held in component state for the current request and are not persisted by the app.
- Admin-secret comparison is constant-time. Public entry-point rate limits use fixed windows and SHA-256 caller-key hashes.
- No advertising, analytics tracking, or social photo-sharing integration is included. Web Share shares the Family Card link, not photo bytes.

## Intentionally deferred V2 items

Somali locale switching, offline map tiles, name search, steward claims, biographies, contributions, OCR, push notifications, universal links, proximity checks, cache-size limits, and a report camera step are not implemented.

Directions open the external maps provider and require connectivity for map content. The memorial itself and cached photos can reopen offline.

## Live services and operational decisions still required

1. Select the pilot cemetery and its owner; load its cemetery ID and section naming.
2. Confirm ownership and hosting for `gl.app`, including the `/g/{token}` redirect to the app.
3. Choose an SMS provider and verify Supabase phone OTP delivery to Somali numbers.
4. Choose the Supabase region and account owner, then configure Auth, private Storage, Edge Function secrets, monitoring, backups, and retention.
5. Confirm legal and family-consent rules for storing and publishing deceased people’s names, photographs, and condition reports in the pilot jurisdiction.
6. Decide which mobile platforms and browser versions are in the pilot; test camera, GPS, installation, storage eviction, and background sync on those physical devices.
7. Set a strong `ADMIN_SECRET`, define who may administer assignments/publication/conflicts, and establish an audit-review process.
8. Test the complete live flow against the deployed Supabase project: registration, batch sync, signed photo upload/confirmation, remote family lookup, OTP/device link, assignment enforcement, publishing, and conflict resolution.
9. Replace the development-only admin-secret approach if the operating model requires named admin accounts and per-user authorization.

## Verification boundary

Automated frontend tests, Deno type/validator tests, a production build, production dependency audit, all SQL migrations/tests on Postgres 16, and Chromium desktop/mobile local workflows have been run. Live Supabase behavior, SMS delivery, external map opening on a phone, physical camera/GPS behavior, and cross-browser installation remain deployment checks rather than claims of completed field validation.
