# Graveyard Locator

Mobile-first app for recording and sharing grave locations in Somaliland (and beyond). Offline-first, with a Family Card QR system and caretaker condition reports.

**Current status:** First implementation slice (Save a Grave, Family Card QR, basic caretaker flow, offline sync queue). Not yet a full MVP. Code has not been compiled or run in the environment where it was generated — build and test locally.

## What the MVP will include (from the blueprint)

1. Save a grave without an account: one photo, a name, automatic GPS, offline-first save.
2. Family Card with a QR code that opens the grave’s memorial.
3. Steward claim by phone number and one-time code, with approval from the record creator’s device.
4. Caretaker sign-in, assigned sections, and condition reports (Good / Needs Attention / Serious Damage) with offline queue.
5. Family view of the memorial and its condition reports.
6. Acts of Remembrance: paid services (Zaad, e-Dahab, Premier Bank transfer, card, PayPal) with partner proof flow.
7. Web admin for caretaker approval, flagged reports, and orders.

## What is in this repository now

- **mobile/** — Flutter app (first slice)
  - Save a Grave (photo + name + GPS, offline SQLite)
  - Family Card / QR generation and scanning
  - Basic caretaker sign-in and condition report flow
  - Offline sync queue with retry/backoff
  - English + prepared Somali strings
- **backend/** — Supabase project
  - Migrations for core tables, sync, photos, caretaker/family, reports by token
  - Edge Functions: sync-batch, device-register, photo-upload-url, photo-confirm, device-link, admin-actions, family-grave
  - Shared validators + unit tests
  - SQL tests
- **ci/** — Supabase stubs for local/CI Postgres
- **.github/workflows/ci.yml** — Flutter analyze/test, SQL migrations + checks on Postgres 16, Deno check + tests

## Stack

- Mobile: Flutter + sqflite
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- Planned: React + TypeScript web admin, Firebase Cloud Messaging, Google Maps / Apple Maps, Sentry

## Getting started

### Mobile

```bash
cd mobile
flutter create --platforms=android,ios --project-name graveyard_locator .
flutter pub get
flutter analyze
flutter test
flutter run
```

Add camera and location permissions to `AndroidManifest.xml` and `Info.plist` (see `mobile/README.md`).

### Backend / CI

The GitHub Actions workflow runs on every push and pull request. Locally you can apply migrations and tests against a Postgres instance using the files in `backend/supabase/` and `ci/`.

## Logo

Brand mark is in `mobile/assets/logo.png`.

## Next steps

- Generate Flutter platform folders and verify the app builds.
- Complete steward claim, memorials, Acts of Remembrance payments, and web admin (per blueprint).
- Move from the current slice to the full repository layout described in the developer blueprint.

---

*This repository follows the Graveyard Locator App Blueprint for Developers (Nov 2026).*
