-- Graveyard Finder web admin: resolve an open sync conflict without changing entity data.
create or replace function public.resolve_sync_conflict(p_conflict uuid, p_resolution text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_resolution is null or length(btrim(p_resolution)) = 0 or length(p_resolution) > 500 then
    return jsonb_build_object('result', 'rejected', 'reason', 'invalid_resolution');
  end if;

  select status into v_status
  from public.sync_conflicts
  where id = p_conflict
  for update;

  if not found then
    return jsonb_build_object('result', 'rejected', 'reason', 'conflict_not_found');
  end if;

  if v_status = 'resolved' then
    return jsonb_build_object('result', 'applied', 'reason', 'already_resolved');
  end if;

  update public.sync_conflicts
     set status = 'resolved',
         resolution = btrim(p_resolution),
         resolved_at = now()
   where id = p_conflict;

  insert into public.audit_log (action, entity, entity_id, before, after)
  values ('resolve_conflict', 'sync_conflicts', p_conflict,
          jsonb_build_object('status', v_status),
          jsonb_build_object('status', 'resolved', 'resolution', btrim(p_resolution)));

  return jsonb_build_object('result', 'applied');
end;
$$;

revoke all on function public.resolve_sync_conflict(uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_sync_conflict(uuid, text) to service_role;
