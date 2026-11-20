# Graveyard Locator backend

Supabase project: Postgres, Auth, Storage, and Edge Functions. This folder holds the sync path (sprint 3).

## Files

| Path | What it does |
|---|---|
| `supabase/migrations/0001_core_tables.sql` | Core tables, the audit log, and the append-only trigger. Row level security is on with no policies. |
| `supabase/migrations/0002_sync_push.sql` | `sync_push` and the per-entity apply functions. Each event runs in its own sub-transaction. |
| `supabase/tests/sync_push_test.sql` | Seven database checks: create, duplicate, newer update, stale conflict, unknown entity, duplicate QR token, audit log. |
| `supabase/functions/device-register/index.ts` | Issues a 32-byte device token once. Stores only its SHA-256 hash. |
| `supabase/functions/sync-batch/index.ts` | Checks the device token, validates the batch, and calls `sync_push` with the service role key. |
| `supabase/functions/_shared/validate.ts` | Batch validation: at most 50 events, a 1 MB body limit, UUID checks, allowed entity and operation pairs, note length. |
| `supabase/functions/_shared/validate.test.ts` | Ten unit tests for validation. |
| `supabase/migrations/0003_photos.sql` | Photo table, the private `grave-photos` bucket, and `create_photo_slot`. Only the caretaker or creator device of the grave may reserve a slot. |
| `supabase/tests/photo_slot_test.sql` | Five database checks: pending slot, repeat request, conflicting content, stranger device, unknown grave. |
| `supabase/functions/photo-upload-url/index.ts` | Reserves a slot and returns a signed upload link. 409 means the grave is not synced yet. |
| `supabase/functions/photo-confirm/index.ts` | Downloads the uploaded bytes, checks the declared size and SHA-256, then marks the photo ready. |
| `supabase/functions/_shared/device_auth.ts` | Shared helpers: service client, JSON responses, device token check. |
| `supabase/functions/_shared/photo_validate.ts` | Photo request validation: content type limited to JPEG and PNG, size up to 5 MB, SHA-256 format. |
| `supabase/functions/_shared/photo_validate.test.ts` | Six unit tests for photo validation. |
| `supabase/migrations/0004_caretaker_family.sql` | `link_device_caretaker`, `create_caretaker_assignment`, and `publish_condition_report`. |
| `supabase/tests/caretaker_family_test.sql` | Six database checks: linking, refusing a second user, assignment, report visibility, publish. |
| `supabase/functions/device-link/index.ts` | Links a signed-in caretaker (Supabase Auth JWT in Authorization) to a device that holds a device token. |
| `supabase/functions/admin-actions/index.ts` | Admin actions: assign a caretaker to a section, publish a report. Needs `ADMIN_SECRET`. Replaced by the web console later. |
| `supabase/functions/family-grave/index.ts` | Public read by QR token: name, location in words, ready photos as one-hour links, published reports only. |
| `supabase/functions/_shared/caretaker_validate.ts` | Validation for device link, family token, and admin actions. |
| `supabase/functions/_shared/caretaker_validate.test.ts` | Six unit tests for those validators. |
| `supabase/functions/_shared/admin_auth.ts` | Constant-time secret comparison for admin calls. |

| `supabase/migrations/0005_report_by_token.sql` | Condition reports may name the grave by `grave_qr_token`. |
| `supabase/tests/report_by_token_test.sql` | Two database checks: report by token, unknown token. |

Extra environment variable for admin calls: `ADMIN_SECRET`. Set it with `supabase secrets set ADMIN_SECRET=...`.

## Running the checks

Database checks, against a scratch Postgres database:

    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_core_tables.sql
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_sync_push.sql
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/sync_push_test.sql

The test file rolls back at the end, so the scratch database stays clean.

Validation tests, with Node 18 or later:

    npx tsc --target es2022 --module nodenext --moduleResolution nodenext --strict --rewriteRelativeImportExtensions supabase/functions/_shared/validate.ts supabase/functions/_shared/validate.test.ts
    node --test supabase/functions/_shared/validate.test.js

These are the test steps for the sync path. The Deno test runner runs the same file with `deno test`.

## Environment variables for the functions

| Name | Where it comes from |
|---|---|
| `SUPABASE_URL` | Project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings. Stays on the server and never goes in the app. |

## Notes on what this run covers

The SQL and the validation code were checked by running the validation tests and by reading the SQL. The SQL checks were not run against a Postgres server in this build. Edge Functions were not run under Deno. The mobile sync client and its tests are in `mobile/`.

## Running everything on GitHub

`.github/workflows/ci.yml` at the repo root runs three jobs on every push: Flutter (`pub get`, `analyze`, `test`), SQL (all migrations and all SQL checks on a Postgres 16 service, with `ci/supabase_stubs.sql` standing in for Supabase roles and the storage table), and Deno (`deno check` on every function and `deno test` on the shared validators). Push the contents of this folder as the root of a repository and open the Actions tab.
