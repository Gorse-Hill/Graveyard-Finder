# Graveyard Finder backend

Supabase Postgres, Auth, private Storage, and Deno Edge Functions for Graveyard Finder. The app can save locally without this backend; these services add synchronization, remote family views, caretaker OTP/device linking, and admin operations.

## Migrations

Apply every file in `supabase/migrations/` in filename order.

| Migration | Purpose |
|---|---|
| `0001_core_tables.sql` | Devices, cemeteries, graves, assignments, reports, outbox log, conflicts, append-only audit log, and RLS. |
| `0002_sync_push.sql` | Batch sync and per-entity apply functions. Each event runs in its own sub-transaction. |
| `0003_photos.sql` | Private `grave-photos` bucket, photo metadata, and idempotent slot reservation. |
| `0004_caretaker_family.sql` | Caretaker device links, section assignments, and report publishing. |
| `0005_report_by_token.sql` | Allows a report to identify its grave by scanned QR token. |
| `0006_admin_conflicts.sql` | Audited, idempotent conflict resolution. |
| `0007_report_accuracy.sql` | Stores report GPS accuracy and preserves the client report ID as the server report ID. |
| `0008_rate_limits.sql` | Atomic fixed-window rate limits using SHA-256 caller-key hashes. |

Application tables enable RLS with no public policies. Functions that require backend access are revoked from public/anon/authenticated roles and granted to `service_role` where applicable. Security-definer functions pin `search_path` to `public`.

## Edge Functions

Deploy all seven functions:

- `device-register` — issues a 32-byte device token once; stores only its SHA-256 hash. Limit: 10 requests/hour/IP.
- `sync-batch` — authenticates the device, validates at most 50 events and a 1 MB body, and calls `sync_push`. Limit: 120 requests/minute/device.
- `photo-upload-url` — reserves a private photo slot and returns a signed upload URL.
- `photo-confirm` — verifies stored byte size and SHA-256 before marking a photo ready.
- `family-grave` — returns public memorial fields, ready photos with one-hour signed links, and published reports only. Limit: 60 requests/minute/IP.
- `device-link` — verifies the caretaker’s Supabase Auth JWT and links that user to the authenticated device.
- `admin-actions` — lists cemeteries/reports/conflicts, assigns caretakers, publishes reports, and resolves conflicts. Requires `x-admin-secret` with constant-time comparison.

Shared validators cover UUIDs, QR tokens, entity/operation pairs, versions, note length, JPEG/PNG content types, the 5 MB limit, SHA-256 format, and admin action payloads. Server errors use stable codes and plain messages; internal details stay in server logs.

## Secrets

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Set a separate strong admin secret:

```bash
supabase secrets set ADMIN_SECRET='REPLACE_WITH_A_LONG_RANDOM_SECRET'
```

The service-role key and admin secret must never appear in the web build, source control, client logs, or `VITE_` variables. Only the public anon key goes into the app.

## Deployment

From this `backend/` directory, using the Supabase CLI and your own project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

for function in device-register sync-batch photo-upload-url photo-confirm family-grave device-link admin-actions; do
  supabase functions deploy "$function"
done
```

Enable phone Auth and configure an SMS provider that supports the pilot’s numbers. Confirm that the `grave-photos` bucket remains private. Apply migrations before deploying functions that depend on them, especially `0008_rate_limits.sql`.

## Deno checks

From the repository root:

```bash
npx -y deno check backend/supabase/functions/*/index.ts
npx -y deno test backend/supabase/functions/_shared/*.test.ts
```

The validator suite contains 24 tests across sync, photo, caretaker, family-token, and admin validation.

## Postgres 16 integration tests

Use a disposable database. The test files roll back their changes, but migrations do not.

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/graveyard_test
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../ci/supabase_stubs.sql
for file in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
done
for file in supabase/tests/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
done
```

`../ci/supabase_stubs.sql` creates only the roles and `storage.buckets` table needed on plain Postgres. Do not apply it to Supabase itself.

| SQL suite | Coverage |
|---|---|
| `sync_push_test.sql` | Create, duplicate event, newer version, stale conflict, unknown entity, QR collision, and audit immutability. |
| `photo_slot_test.sql` | Pending slot, idempotent repeat, content conflict, unauthorized device, and unknown grave. |
| `caretaker_family_test.sql` | Device linking, reassignment refusal, missing device, section assignment, report accuracy/privacy, and publishing. |
| `report_by_token_test.sql` | Report by scanned token and unknown token. |
| `admin_conflict_test.sql` | Resolution, trimming, audit, repeat behavior, and blank-resolution refusal. |
| `rate_limit_test.sql` | Allowed requests, over-limit refusal, and separate caller buckets. |

The full suite has been run against PostgreSQL 16.4 in this workspace. Live Supabase Auth, Storage signing, Edge Function HTTP integration, and SMS delivery still require a deployed-project check.
