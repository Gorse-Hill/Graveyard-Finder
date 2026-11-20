-- Caretaker and publishing tests. Run after migrations 0001 to 0004 on a scratch database.
-- Each check raises an exception on failure. The file rolls back at the end.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/caretaker_family_test.sql

begin;

do $$
declare
  dev uuid := 'd0000000-0000-4000-8000-0000000000b1';
  dev2 uuid := 'd0000000-0000-4000-8000-0000000000b2';
  caretaker uuid := '90000000-0000-4000-8000-0000000000b1';
  other_user uuid := '90000000-0000-4000-8000-0000000000b2';
  cemetery uuid := 'c0000000-0000-4000-8000-0000000000b1';
  grave uuid := 'a0000000-0000-4000-8000-0000000000b1';
  report uuid := '70000000-0000-4000-8000-0000000000b1';
  report2 uuid := '70000000-0000-4000-8000-0000000000b2';
  r jsonb;
  v_status text;
  v_rid uuid;
begin
  insert into public.devices (device_id, token_hash) values (dev, 'h-b1'), (dev2, 'h-b2');
  insert into public.cemeteries (id, name) values (cemetery, 'Test cemetery');
  insert into public.graves (id, cemetery_id, qr_token, name, gps_lat, gps_lng, section, entity_version, created_by_device)
  values (grave, cemetery, 'CARETAKERTEST0000000000000B', 'Test Person', 9.5, 44.0, 'B', 1, dev);

  -- 1. A signed-in user links a device.
  r := public.link_device_caretaker(dev, caretaker);
  if r->>'result' <> 'applied' then
    raise exception 'check 1 failed: %', r;
  end if;

  -- 2. Linking the same device to a different user is refused.
  r := public.link_device_caretaker(dev, other_user);
  if r->>'reason' <> 'already_linked_other_user' then
    raise exception 'check 2 failed: %', r;
  end if;

  -- 3. A device that does not exist is refused.
  r := public.link_device_caretaker('d0000000-0000-4000-8000-0000000000ff', caretaker);
  if r->>'reason' <> 'device_not_found' then
    raise exception 'check 3 failed: %', r;
  end if;

  -- 4. An assignment for section B lets the caretaker report on a grave in section B.
  r := public.create_caretaker_assignment(caretaker, cemetery, 'B');
  if r->>'result' <> 'applied' then
    raise exception 'check 4 failed: %', r;
  end if;
  r := public.sync_push(dev, jsonb_build_array(jsonb_build_object(
    'client_event_id', 'e0000000-0000-4000-8000-0000000000b1',
    'entity', 'condition_reports',
    'entity_id', report,
    'op', 'create',
    'entity_version', 1,
    'payload', jsonb_build_object(
      'client_report_id', report, 'grave_id', grave, 'condition', 'good',
      'note', 'Tidy', 'gps_lat', 9.5, 'gps_lng', 44.0, 'visit_date', '2026-11-20T09:00:00Z')
  )));
  if r->'results'->0->>'result' <> 'applied' then
    raise exception 'check 4 failed: %', r;
  end if;

  -- 5. A report is not visible until it is published.
  -- The server gives the stored report its own id. The phone's id is client_report_id.
  select id, status into v_rid, v_status from public.condition_reports where client_report_id = report;
  if v_status is distinct from 'received' then
    raise exception 'check 5 failed: status = %', v_status;
  end if;
  r := public.publish_condition_report(v_rid);
  if r->>'result' <> 'applied' then
    raise exception 'check 5 failed: %', r;
  end if;
  select status into v_status from public.condition_reports where id = v_rid;
  if v_status is distinct from 'published' then
    raise exception 'check 5 failed: status after publish = %', v_status;
  end if;

  -- 6. Publishing an unknown report is refused.
  r := public.publish_condition_report(report2);
  if r->>'reason' <> 'report_not_found' then
    raise exception 'check 6 failed: %', r;
  end if;

  raise notice 'caretaker and publishing tests passed (6 checks)';
end;
$$;

rollback;
