-- Graveyard Locator: the sync write path (spec sections 6 and 7).
--
-- sync_push runs one batch in one database call. Each event runs in its own
-- sub-transaction: its change and its sync_log row commit together, or neither does.
-- A repeated (device_id, client_event_id) returns the stored result and changes nothing.

-- ---------------------------------------------------------------------------
-- Graves: create
-- ---------------------------------------------------------------------------
create or replace function public.apply_grave_create(p_device uuid, p_id uuid, p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.graves where id = p_id) then
    return jsonb_build_object('result', 'conflict', 'reason', 'grave_exists', 'current_version', 1);
  end if;

  if exists (select 1 from public.graves where qr_token = p->>'qr_token') then
    return jsonb_build_object('result', 'rejected', 'reason', 'qr_token_taken');
  end if;

  insert into public.graves (
    id, qr_token, name, gps_lat, gps_lng, gps_accuracy_m,
    entity_version, created_by_device, created_at
  ) values (
    p_id,
    p->>'qr_token',
    p->>'name',
    (p->>'gps_lat')::double precision,
    (p->>'gps_lng')::double precision,
    (p->>'gps_accuracy_m')::double precision,
    1,
    p_device,
    coalesce((p->>'created_at')::timestamptz, now())
  );

  return jsonb_build_object('result', 'applied');
end;
$$;

-- ---------------------------------------------------------------------------
-- Graves: update (section, block, plot). Applies only when the incoming version is newer.
-- ---------------------------------------------------------------------------
create or replace function public.apply_grave_update(p_device uuid, p_id uuid, p_version integer, p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_current integer;
begin
  select entity_version into v_current
  from public.graves
  where id = p_id
  for update;

  if not found then
    return jsonb_build_object('result', 'rejected', 'reason', 'grave_not_found');
  end if;

  if p_version <= v_current then
    return jsonb_build_object('result', 'conflict', 'reason', 'stale_version', 'current_version', v_current);
  end if;

  update public.graves
     set section = coalesce(p->>'section', section),
         block = coalesce(p->>'block', block),
         plot = coalesce(p->>'plot', plot),
         entity_version = p_version,
         updated_at = now()
   where id = p_id;

  return jsonb_build_object('result', 'applied');
end;
$$;

-- ---------------------------------------------------------------------------
-- Condition reports: create. Only a caretaker assigned to the grave's cemetery and section may report.
-- ---------------------------------------------------------------------------
create or replace function public.apply_condition_report(p_device uuid, p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_grave_id uuid := (p->>'grave_id')::uuid;
  v_report_id uuid := (p->>'client_report_id')::uuid;
  v_cemetery uuid;
  v_section text;
  v_user uuid;
begin
  -- A repeated client_report_id is stored once. The second copy counts as applied.
  if exists (select 1 from public.condition_reports where client_report_id = v_report_id) then
    return jsonb_build_object('result', 'applied', 'reason', 'already_stored');
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
    gps_lat, gps_lng, visit_date
  ) values (
    v_report_id,
    v_grave_id,
    p_device,
    p->>'condition',
    p->>'note',
    (p->>'gps_lat')::double precision,
    (p->>'gps_lng')::double precision,
    (p->>'visit_date')::timestamptz
  );

  return jsonb_build_object('result', 'applied');
end;
$$;

-- ---------------------------------------------------------------------------
-- The batch entry point
-- ---------------------------------------------------------------------------
create or replace function public.sync_push(p_device_id uuid, p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ev jsonb;
  v_client_event uuid;
  v_entity text;
  v_entity_id uuid;
  v_op text;
  v_version integer;
  v_payload jsonb;
  v_out jsonb;
  v_result text;
  v_reason text;
  v_prev_result text;
  v_prev_reason text;
  v_log_id bigint;
  v_results jsonb := '[]'::jsonb;
begin
  for ev in select value from jsonb_array_elements(p_events) loop
    v_client_event := (ev->>'client_event_id')::uuid;
    v_entity := ev->>'entity';
    v_entity_id := (ev->>'entity_id')::uuid;
    v_op := ev->>'op';
    v_version := (ev->>'entity_version')::integer;
    v_payload := ev->'payload';

    -- Repeat delivery: return what happened the first time, change nothing.
    select result, reason into v_prev_result, v_prev_reason
    from public.sync_log
    where device_id = p_device_id and client_event_id = v_client_event;

    if found then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'client_event_id', v_client_event,
        'result', 'duplicate',
        'original_result', v_prev_result,
        'reason', v_prev_reason
      ));
      continue;
    end if;

    -- The sub-transaction: a failure here rolls back this event's change only.
    begin
      if v_entity = 'graves' and v_op = 'create' then
        v_out := public.apply_grave_create(p_device_id, v_entity_id, v_payload);
      elsif v_entity = 'graves' and v_op = 'update' then
        v_out := public.apply_grave_update(p_device_id, v_entity_id, v_version, v_payload);
      elsif v_entity = 'condition_reports' and v_op = 'create' then
        v_out := public.apply_condition_report(p_device_id, v_payload);
      else
        v_out := jsonb_build_object('result', 'rejected', 'reason', 'unsupported_entity_op');
      end if;
    exception when others then
      -- The reason is generic on purpose. Details stay in the database logs.
      v_out := jsonb_build_object('result', 'rejected', 'reason', 'invalid_event');
    end;

    v_result := v_out->>'result';
    v_reason := v_out->>'reason';

    insert into public.sync_log (
      device_id, client_event_id, entity, entity_id, op,
      entity_version, result, reason, payload
    ) values (
      p_device_id, v_client_event, v_entity, v_entity_id, v_op,
      v_version, v_result, v_reason, v_payload
    )
    returning id into v_log_id;

    if v_result = 'conflict' then
      insert into public.sync_conflicts (sync_log_id, entity, entity_id, incoming, current_version)
      values (
        v_log_id, v_entity, v_entity_id, v_payload,
        coalesce((v_out->>'current_version')::integer, 0)
      );
    end if;

    if v_result = 'applied' then
      insert into public.audit_log (actor_device_id, action, entity, entity_id, after)
      values (p_device_id, v_op, v_entity, v_entity_id, v_payload);
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'client_event_id', v_client_event,
      'result', v_result,
      'reason', v_reason,
      'server_id', v_entity_id
    ));
  end loop;

  return jsonb_build_object('results', v_results);
end;
$$;

-- Only the service role (the Edge Function) may run the sync path.
revoke all on function public.sync_push(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_push(uuid, jsonb) to service_role;
revoke all on function public.apply_grave_create(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_grave_update(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.apply_condition_report(uuid, jsonb) from public, anon, authenticated;
