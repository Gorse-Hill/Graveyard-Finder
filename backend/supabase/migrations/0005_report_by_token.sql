-- Sprint 6 entry points: a caretaker scans a QR code, so the phone knows the grave's QR token.
-- The phone may not hold the grave's server ID, so a condition report may name the grave by grave_id or by grave_qr_token.

alter table public.condition_reports add column if not exists gps_accuracy_m double precision;

create or replace function public.apply_condition_report(p_device uuid, p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_grave_id uuid;
  v_report_id uuid := (p->>'client_report_id')::uuid;
  v_cemetery uuid;
  v_section text;
  v_user uuid;
begin
  if exists (select 1 from public.condition_reports where client_report_id = v_report_id) then
    return jsonb_build_object('result', 'applied', 'reason', 'already_stored');
  end if;

  if p ? 'grave_id' and p->>'grave_id' is not null then
    v_grave_id := (p->>'grave_id')::uuid;
  else
    select id into v_grave_id from public.graves where qr_token = p->>'grave_qr_token';
  end if;

  if v_grave_id is null then
    return jsonb_build_object('result', 'rejected', 'reason', 'grave_not_found');
  end if;

  select cemetery_id, section into v_cemetery, v_section
  from public.graves
  where id = v_grave_id;

  if not found then
    return jsonb_build_object('result', 'rejected', 'reason', 'grave_not_found');
  end if;

  select caretaker_user_id into v_user
  from public.devices
  where device_id = p_device;

  if v_user is null then
    return jsonb_build_object('result', 'rejected', 'reason', 'device_not_caretaker');
  end if;

  if v_cemetery is null or not exists (
    select 1
    from public.caretaker_assignments a
    where a.caretaker_user_id = v_user
      and a.active
      and a.cemetery_id = v_cemetery
      and a.section = v_section
  ) then
    return jsonb_build_object('result', 'rejected', 'reason', 'outside_assignment');
  end if;

  insert into public.condition_reports (
    client_report_id, grave_id, device_id, condition, note,
    gps_lat, gps_lng, gps_accuracy_m, visit_date
  ) values (
    v_report_id,
    v_grave_id,
    p_device,
    p->>'condition',
    p->>'note',
    (p->>'gps_lat')::double precision,
    (p->>'gps_lng')::double precision,
    (p->>'gps_accuracy_m')::double precision,
    (p->>'visit_date')::timestamptz
  );

  return jsonb_build_object('result', 'applied');
end;
$$;

revoke all on function public.apply_condition_report(uuid, jsonb) from public, anon, authenticated;
