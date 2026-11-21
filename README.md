# Graveyard Finder

An offline-first, installable web app for recording graves, printing Family Cards, reopening family memorials, and queuing caretaker condition reports. The implementation continues the supplied Sprint 6 data model and backend, using the brief’s responsive web/PWA variant.

## What works without a server

- Save a grave name, photo, GPS coordinates and accuracy, and optional section/block/plot in one IndexedDB transaction.
- Resize JPEG or PNG photos to a 1600 px long edge, calculate SHA-256, and enforce the 5 MB processed-file limit.
- Generate a 26-character random base32 Family Card token on the device.
- Display, copy, share, and print a Family Card containing `https://gl.app/g/{token}`.
- Reopen locally saved memorials and photos while offline, including after a full app reload.
- Enter a Family Card link manually when a camera is unavailable.
- Save and inspect queued graves and condition reports.

Without Supabase configuration, records remain in this browser only. There is no cross-device sync, remote family lookup, real phone OTP, or live admin connection, and the interface says so rather than simulating those services.

## Routes

The static preview uses hash URLs so every route works without server rewrites:

- `#/` — home and locally saved records
- `#/save` — Save a Grave
- `#/card/:id` — Family Card
- `#/find` — scanner and manual Family Card entry
- `#/g/:token` — family memorial
- `#/queue` — outbox and retry states
- `#/caretaker/sign-in` — phone OTP
- `#/caretaker/report` — condition report
- `#/admin` — assignments, report publishing, and conflict resolution

The QR value itself remains the required clean URL, `https://gl.app/g/{token}`. Production hosting for `gl.app` must redirect `/g/{token}` to `/#/g/{token}` (or provide equivalent routing) so the printed link opens this hash-routed build.

## Local development

Requirements: Node.js 24 is recommended because the installed ZXing release declares Node 24 or newer. Node 20 also built and passed the automated checks in this workspace, with an engine warning.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Camera and location APIs require localhost or HTTPS and browser permission. For a production-style check:

```bash
npm run build
npm run preview
```

## Configuration

Copy `.env.example` to `.env.local` and fill in the public values:

```dotenv
VITE_SYNC_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SYNC_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Only the public anon key belongs in the app build. Never put the service-role key or admin secret in a `VITE_` variable. Rebuild after changing environment values.

## Supabase deployment

The backend is in `backend/`. Apply migrations in filename order, deploy all seven Edge Functions, set the server secrets, and enable phone Auth with an SMS provider that supports the pilot’s Somali numbers. See `backend/README.md` for function-specific commands and tests.

The database enables RLS on application tables with no public policies. Edge Functions use the service role. Photos use the private `grave-photos` bucket and one-hour signed read links.

## Checks

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev

npx -y deno check backend/supabase/functions/*/index.ts
npx -y deno test backend/supabase/functions/_shared/*.test.ts
```

SQL integration tests require a scratch Postgres 16 database, not a production database:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/graveyard_test
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ci/supabase_stubs.sql
for file in backend/supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
done
for file in backend/supabase/tests/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
done
```

The stub file supplies only the roles and `storage.buckets` table used by migrations on plain Postgres. Supabase provides these itself; do not run the stubs on a real Supabase project. Every SQL test rolls back its own data.

GitHub Actions runs the frontend checks, Deno checks/tests, and the full migration and SQL test suite on Postgres 16. Flutter/Android APK CI is not included because this delivery implements the web/PWA variant.

## Browser and install notes

- Chromium desktop and a 375 px mobile viewport were exercised for local save, Family Card actions, offline reload, manual QR entry, queue states, caretaker report save, and unconfigured service states.
- The service worker uses network-first pages with an offline app-shell fallback, precached application assets, cached images, and Background Sync where supported. Other browsers retry when the app is open or online state returns.
- Use the browser’s **Install app** or **Add to Home Screen** command to install the PWA. Publishing and HTTPS hosting are required for installation outside localhost.
- Real-device rear-camera scanning, GPS accuracy, iOS installation, SMS delivery, and Background Sync behavior still need pilot-device validation.

See `ASSUMPTIONS.md` for product boundaries, operational requirements, and open decisions.
