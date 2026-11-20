-- Photo slot tests. Run after migrations 0001 to 0003 on a scratch database.
-- Each check raises an exception on failure. The file rolls back at the end.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/photo_slot_test.sql

begin;

do $$
declare
  dev uuid := 'd0000000-0000-4000-8000-0000000000a1';
  other uuid := 'd0000000-0000-4000-8000-0000000000a2';
  grave uuid := 'a0000000-0000-4000-8000-0000000000a1';
  photo uuid := 'f0000000-0000-4000-8000-0000000000a1';
  photo_other uuid := 'f0000000-0000-4000-8000-0000000000a2';
  r jsonb;
begin
  insert into public.devices (device_id, token_hash)
  values (dev, 'hash-creator'), (other, 'hash-stranger');

  insert into public.graves (id, qr_token, name, gps_lat, gps_lng, entity_version, created_by_device)
  values (grave, 'PHOTOTEST00000000000000000A', 'Test Person', 9.5, 44.0, 1, dev);

  -- 1. The creator device reserves a pending slot.
  r := public.create_photo_slot(dev, grave, photo, 'image/jpeg', 1000, repeat('a', 64));
  if r->>'result' <> 'ok' or r->>'status' <> 'pending' then
    raise exception 'check 1 failed: %', r;
  end if;

  -- 2. The same request again returns the same slot.
  r := public.create_photo_slot(dev, grave, photo, 'image/jpeg', 1000, repeat('a', 64));
  if r->>'result' <> 'ok' then
    raise exception 'check 2 failed: %', r;
  end if;

  -- 3. The same photo_id with different content is rejected.
  r := public.create_photo_slot(dev, grave, photo, 'image/jpeg', 1000, repeat('b', 64));
  if r->>'reason' <> 'photo_id_conflict' then
    raise exception 'check 3 failed: %', r;
  end if;

  -- 4. A device with no link to the grave is refused.
  r := public.create_photo_slot(other, grave, photo_other, 'image/jpeg', 1000, repeat('c', 64));
  if r->>'reason' <> 'not_allowed' then
    raise exception 'check 4 failed: %', r;
  end if;

  -- 5. An unknown grave is refused.
  r := public.create_photo_slot(dev, 'a0000000-0000-4000-8000-0000000000ff', photo_other, 'image/png', 1000, repeat('d', 64));
  if r->>'reason' <> 'grave_not_found' then
    raise exception 'check 5 failed: %', r;
  end if;

  raise notice 'photo slot tests passed (5 checks)';
end;
$$;

rollback;
