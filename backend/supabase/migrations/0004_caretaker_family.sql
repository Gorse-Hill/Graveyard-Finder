-- Graveyard Locator sprint 5: caretaker linking, caretaker assignments, and report publishing.
-- Family view reads go through the Edge Function with the service role, so no public policies are added.

-- Links a signed-in caretaker (Supabase Auth user) to the device that is calling.
-- A device already linked to a different user is refused. Unlinking is an admin action (later sprint).
create or replace function public.link_device_caretaker(p_device uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid;
begin
  select caretaker_user_id into v_current
  from public.devices
  where device_id = p_device
  for update;

  if not found then
    return jsonb_build_object('result', 'rejected', 'reason', 'device_not_found');
  end if;

  if v_current is not null and v_current <> p_user then
    return jsonb_build_object('result', 'rejected', 'reason', 'already_linked_other_user');
  end if;

  update public.devices
     set caretaker_user_id = p_user
   where device_id = p_device;

  insert into public.audit_log (actor_device_id, actor_user_id, action, entity, entity_id, after)
  values (p_device, p_user, 'link_caretaker', 'devices', p_device,
          jsonb_build_object('caretaker_user_id', p_user));

  return jsonb_build_object('result', 'applied');
end;
$$;

-- Admin action: give a caretaker a section of a cemetery.
create or replace function public.create_caretaker_assignment(p_user uuid, p_cemetery uuid, p_section text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.cemeteries where id = p_cemetery) then
    return jsonb_build_object('result', 'rejected', 'reason', 'cemetery_not_found');
  end if;

  insert into public.caretaker_assignments (caretaker_user_id, cemetery_id, section)
  values (p_user, p_cemetery, p_section)
  returning id into v_id;

  insert into public.audit_log (actor_user_id, action, entity, entity_id, after)
  values (null, 'assign_caretaker', 'caretaker_assignments', v_id,
          jsonb_build_object('caretaker_user_id', p_user, 'cemetery_id', p_cemetery, 'section', p_section));

  return jsonb_build_object('result', 'applied', 'assignment_id', v_id);
end;
$$;

-- Admin action: publish a condition report so the family view shows it.
create or replace function public.publish_condition_report(p_report uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.condition_reports
  where id = p_report
  for update;

  if not found then
    return jsonb_build_object('result', 'rejected', 'reason', 'report_not_found');
  end if;

  if v_status = 'published' then
    return jsonb_build_object('result', 'applied', 'reason', 'already_published');
  end if;

  update public.condition_reports
     set status = 'published'
   where id = p_report;

  insert into public.audit_log (action, entity, entity_id, before, after)
  values ('publish_report', 'condition_reports', p_report,
          jsonb_build_object('status', v_status),
          jsonb_build_object('status', 'published'));

  return jsonb_build_object('result', 'applied');
end;
$$;

revoke all on function public.link_device_caretaker(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_caretaker_assignment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.publish_condition_report(uuid) from public, anon, authenticated;
grant execute on function public.link_device_caretaker(uuid, uuid) to service_role;
grant execute on function public.create_caretaker_assignment(uuid, uuid, text) to service_role;
grant execute on function public.publish_condition_report(uuid) to service_role;
