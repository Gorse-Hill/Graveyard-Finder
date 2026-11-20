-- Condition report by QR token. Run after migrations 0001 to 0005 on a scratch database.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/report_by_token_test.sql

begin;

do $$
declare
  dev uuid := 'd0000000-0000-4000-8000-0000000000c1';
  caretaker uuid := '90000000-0000-4000-8000-0000000000c1';
  cemetery uuid := 'c0000000-0000-4000-8000-0000000000c1';
  grave uuid := 'a0000000-0000-4000-8000-0000000000c1';
  r jsonb;
  v_count integer;
begin
  insert into public.devices (device_id, token_hash, caretaker_user_id) values (dev, 'h-c1', caretaker);
  insert into public.cemeteries (id, name) values (cemetery, 'Test cemetery');
  insert into public.graves (id, cemetery_id, qr_token, name, gps_lat, gps_lng, section, entity_version)
  values (grave, cemetery, 'TOKENREPORTTEST00000000000C', 'Test Person', 9.5, 44.0, 'C', 1);
  insert into public.caretaker_assignments (caretaker_user_id, cemetery_id, section) values (caretaker, cemetery, 'C');

  -- 1. A report that names the grave by QR token applies.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', 'e0000000-0000-4000-8000-0000000000c1', 'entity', 'condition_reports',
    'entity_id', '70000000-0000-4000-8000-0000000000c1', 'op', 'create', 'entity_version', 1,
    'payload', jsonb_build_object('client_report_id', '70000000-0000-4000-8000-0000000000c1',
      'grave_qr_token', 'TOKENREPORTTEST00000000000C', 'condition', 'good',
      'visit_date', '2026-11-20T09:00:00Z')
  )));
  if r->'results'->0->>'result' <> 'applied' then
    raise exception 'check 1 failed: %', r;
  end if;
  select count(*) into v_count from public.condition_reports where grave_id = grave;
  if v_count <> 1 then
    raise exception 'check 1 failed: reports = %', v_count;
  end if;

  -- 2. An unknown QR token is rejected.
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', 'e0000000-0000-4000-8000-0000000000c2', 'entity', 'condition_reports',
    'entity_id', '70000000-0000-4000-8000-0000000000c2', 'op', 'create', 'entity_version', 1,
    'payload', jsonb_build_object('client_report_id', '70000000-0000-4000-8000-0000000000c2',
      'grave_qr_token', 'NOSUCHTOKEN00000000000000A', 'condition', 'good',
      'visit_date', '2026-11-20T09:00:00Z')
  )));
  if r->'results'->0->>'reason' <> 'grave_not_found' then
    raise exception 'check 2 failed: %', r;
  end if;

  raise notice 'report by token tests passed (2 checks)';
end;
$$;

rollback;
