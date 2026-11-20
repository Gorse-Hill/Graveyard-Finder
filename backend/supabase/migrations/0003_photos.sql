-- Graveyard Locator sprint 4: grave photos (spec section 6).
-- Photo bytes live in a private Storage bucket. Only Edge Functions (service role)
-- create rows and signed links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('grave-photos', 'grave-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create table if not exists public.grave_photos (
  id uuid primary key,
  grave_id uuid not null references public.graves(id),
  uploaded_by_device uuid not null references public.devices(device_id),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  ready_at timestamptz
);

alter table public.grave_photos enable row level security;

-- A device may photograph a grave if it created the grave, or if it is a caretaker
-- device assigned to the grave's cemetery and section.
create or replace function public.device_can_photograph(p_device uuid, p_grave uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.graves g
    where g.id = p_grave
      and g.created_by_device = p_device
  )
  or exists (
    select 1
    from public.devices d
    join public.graves g on g.id = p_grave
    join public.caretaker_assignments a
      on a.caretaker_user_id = d.caretaker_user_id
     and a.active
     and a.cemetery_id = g.cemetery_id
     and a.section = g.section
    where d.device_id = p_device
  );
$$;

-- Reserves a photo slot. Repeating the same photo_id with the same content returns the same slot.
-- Reusing a photo_id with different content is rejected.
create or replace function public.create_photo_slot(
  p_device uuid,
  p_grave uuid,
  p_photo uuid,
  p_content_type text,
  p_bytes integer,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.grave_photos%rowtype;
  v_path text;
begin
  if not exists (select 1 from public.graves where id = p_grave) then
    return jsonb_build_object('result', 'rejected', 'reason', 'grave_not_found');
  end if;

  if not public.device_can_photograph(p_device, p_grave) then
    return jsonb_build_object('result', 'rejected', 'reason', 'not_allowed');
  end if;

  select * into v_row from public.grave_photos where id = p_photo;
  if found then
    if v_row.uploaded_by_device <> p_device
       or v_row.grave_id <> p_grave
       or v_row.sha256 <> p_sha256
       or v_row.byte_size <> p_bytes then
      return jsonb_build_object('result', 'rejected', 'reason', 'photo_id_conflict');
    end if;
    if v_row.status = 'ready' then
      return jsonb_build_object('result', 'already_ready');
    end if;
    return jsonb_build_object('result', 'ok', 'storage_path', v_row.storage_path, 'status', 'pending');
  end if;

  v_path := 'graves/' || p_grave::text || '/' || p_photo::text
         || case when p_content_type = 'image/png' then '.png' else '.jpg' end;

  insert into public.grave_photos (
    id, grave_id, uploaded_by_device, storage_path, content_type, byte_size, sha256
  ) values (
    p_photo, p_grave, p_device, v_path, p_content_type, p_bytes, p_sha256
  );

  return jsonb_build_object('result', 'ok', 'storage_path', v_path, 'status', 'pending');
end;
$$;

revoke all on function public.device_can_photograph(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_photo_slot(uuid, uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_photo_slot(uuid, uuid, uuid, text, integer, text) to service_role;
