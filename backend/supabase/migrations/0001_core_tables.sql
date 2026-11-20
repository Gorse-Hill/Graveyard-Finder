-- Graveyard Locator: core tables needed by sync (spec section 6).
-- Row level security is on with no policies, so anon and authenticated roles see nothing.
-- Only the service role (Edge Functions) reads and writes these tables until sprint 4 adds policies.

create extension if not exists pgcrypto;

create table if not exists public.cemeteries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  municipality text,
  location_lat double precision,
  location_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per installed app that has registered. Record creators have no user account.
-- caretaker_user_id is set when a caretaker signs in on that device (not built yet).
create table if not exists public.devices (
  device_id uuid primary key,
  token_hash text not null,
  caretaker_user_id uuid,
  created_at timestamptz not null default now()
);

-- Cemetery is nullable here. Spec section 6 says a grave belongs to a cemetery.
-- A record creator saves a grave before a municipality assigns it, so the field stays nullable.
-- The mobile README lists this as an open rule.
create table if not exists public.graves (
  id uuid primary key,
  cemetery_id uuid references public.cemeteries(id),
  qr_token text not null unique,
  name text not null check (length(btrim(name)) > 0),
  gps_lat double precision not null check (gps_lat between -90 and 90),
  gps_lng double precision not null check (gps_lng between -180 and 180),
  gps_accuracy_m double precision,
  section text,
  block text,
  plot text,
  status text not null default 'active' check (status in ('active', 'archived')),
  entity_version integer not null default 1 check (entity_version >= 1),
  created_by_device uuid references public.devices(device_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.caretaker_assignments (
  id uuid primary key default gen_random_uuid(),
  caretaker_user_id uuid not null,
  cemetery_id uuid not null references public.cemeteries(id),
  section text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.condition_reports (
  id uuid primary key default gen_random_uuid(),
  client_report_id uuid not null unique,
  grave_id uuid not null references public.graves(id),
  device_id uuid not null references public.devices(device_id),
  condition text not null check (condition in ('good', 'needs_attention', 'serious_damage')),
  note text check (note is null or length(note) <= 300),
  gps_lat double precision check (gps_lat is null or gps_lat between -90 and 90),
  gps_lng double precision check (gps_lng is null or gps_lng between -180 and 180),
  visit_date timestamptz not null,
  -- Photo upload is sprint 4. Reports are stored now and the photo path is filled in later.
  photo_storage_path text,
  status text not null default 'received' check (status in ('received', 'flagged', 'published')),
  created_at timestamptz not null default now()
);

-- Every incoming sync event and its result. The unique key makes repeats idempotent.
create table if not exists public.sync_log (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(device_id),
  client_event_id uuid not null,
  entity text not null,
  entity_id uuid not null,
  op text not null,
  entity_version integer not null,
  result text not null,
  reason text,
  received_at timestamptz not null default now(),
  unique (device_id, client_event_id)
);

-- Append-only audit of every change the sync function applies.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  device_id uuid,
  entity text not null,
  entity_id uuid not null,
  op text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.cemeteries enable row level security;
alter table public.devices enable row level security;
alter table public.graves enable row level security;
alter table public.caretaker_assignments enable row level security;
alter table public.condition_reports enable row level security;
alter table public.sync_log enable row level security;
alter table public.audit_log enable row level security;

-- The audit log is append-only. The trigger blocks updates and deletes.
create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update
before update or delete on public.audit_log
for each row execute function public.audit_log_append_only();

revoke all on public.audit_log from public, anon, authenticated;
