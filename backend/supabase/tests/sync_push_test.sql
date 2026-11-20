-- Sync push tests. Run against a scratch database after migrations 0001 and 0002.
-- Each check raises an exception on failure, so a clean run exits with no error.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/sync_push_test.sql
-- The whole file runs in one transaction and rolls back at the end, so the scratch database stays clean.

begin;

do $$
declare
  dev uuid := 'd0000000-0000-4000-8000-000000000001';
  grave uuid := 'a0000000-0000-4000-8000-000000000001';
  ev_create uuid := 'e0000000-0000-4000-8000-000000000001';
  ev_update_new uuid := 'e0000000-0000-4000-8000-000000000002';
  ev_update_stale uuid := 'e0000000-0000-4000-8000-000000000003';
  ev_bad_entity uuid := 'e0000000-0000-4000-8000-000000000004';
  r jsonb;
  v_count integer;
  v_version integer;
  v_status text;
begin
  insert into public.devices (device_id, token_hash) values (dev, 'test-hash');

  -- 1. A new grave applies once.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', ev_create, 'entity', 'graves', 'entity_id', grave, 'op', 'create',
    'entity_version', 1,
    'payload', jsonb_build_object('qr_token', 'TESTTOKEN0000000000000000A', 'name', 'Test Person',
      'gps_lat', 9.56, 'gps_lng', 44.06, 'gps_accuracy_m', 5)
  )));
  if r->'results'->0->>'result' <> 'applied' then
    raise exception 'check 1 failed: %', r;
  end if;

  -- 2. Sending the same event again returns duplicate and adds no rows.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', ev_create, 'entity', 'graves', 'entity_id', grave, 'op', 'create',
    'entity_version', 1,
    'payload', jsonb_build_object('qr_token', 'TESTTOKEN0000000000000000A', 'name', 'Test Person',
      'gps_lat', 9.56, 'gps_lng', 44.06)
  )));
  if r->'results'->0->>'result' <> 'duplicate' then
    raise exception 'check 2 failed: %', r;
  end if;
  select count(*) into v_count from public.sync_log where client_event_id = ev_create;
  if v_count <> 1 then
    raise exception 'check 2 failed: sync_log rows = %', v_count;
  end if;

  -- 3. A newer version applies.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', ev_update_new, 'entity', 'graves', 'entity_id', grave, 'op', 'update',
    'entity_version', 2,
    'payload', jsonb_build_object('section', 'B', 'block', '2', 'plot', '14')
  )));
  if r->'results'->0->>'result' <> 'applied' then
    raise exception 'check 3 failed: %', r;
  end if;
  select entity_version into v_version from public.graves where id = grave;
  if v_version <> 2 then
    raise exception 'check 3 failed: version = %', v_version;
  end if;

  -- 4. A stale version does not apply and creates a conflict row.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', ev_update_stale, 'entity', 'graves', 'entity_id', grave, 'op', 'update',
    'entity_version', 2,
    'payload', jsonb_build_object('section', 'C')
  )));
  if r->'results'->0->>'result' <> 'conflict' then
    raise exception 'check 4 failed: %', r;
  end if;
  select section into v_status from public.graves where id = grave;
  if v_status <> 'B' then
    raise exception 'check 4 failed: section changed to %', v_status;
  end if;
  select count(*) into v_count from public.sync_conflicts where entity_id = grave and status = 'open';
  if v_count <> 1 then
    raise exception 'check 4 failed: open conflicts = %', v_count;
  end if;

  -- 5. An unknown entity is rejected and leaves the database alone.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', ev_bad_entity, 'entity', 'unknown_table', 'entity_id', grave, 'op', 'create',
    'entity_version', 1, 'payload', '{}'::jsonb
  )));
  if r->'results'->0->>'result' <> 'rejected' then
    raise exception 'check 5 failed: %', r;
  end if;

  -- 6. A second grave with the same QR token is rejected.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', 'e0000000-0000-4000-8000-000000000005', 'entity', 'graves',
    'entity_id', 'a0000000-0000-4000-8000-000000000002', 'op', 'create', 'entity_version', 1,
    'payload', jsonb_build_object('qr_token', 'TESTTOKEN0000000000000000A', 'name', 'Other',
      'gps_lat', 9.5, 'gps_lng', 44.0)
  )));
  if r->'results'->0->>'reason' <> 'qr_token_taken' then
    raise exception 'check 6 failed: %', r;
  end if;

  -- 7. The audit log has rows for the applied events and rejects changes.
  select count(*) into v_count from public.audit_log where entity_id = grave;
  if v_count <> 2 then
    raise exception 'check 7 failed: audit rows = %', v_count;
  end if;
  begin
    update public.audit_log set action = 'tampered';
    raise exception 'check 7 failed: audit_log accepted an update';
  exception when others then
    if sqlerrm = 'check 7 failed: audit_log accepted an update' then raise; end if;
  end;

  raise notice 'sync_push tests passed (7 checks)';
end;
$$;

rollback;
