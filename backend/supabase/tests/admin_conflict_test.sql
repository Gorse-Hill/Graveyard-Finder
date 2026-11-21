begin;

insert into public.devices (device_id, token_hash)
values ('d0000000-0000-4000-8000-000000000099', repeat('a', 64));
insert into public.sync_log (device_id, client_event_id, entity, entity_id, op, entity_version, result, payload)
values ('d0000000-0000-4000-8000-000000000099', 'e0000000-0000-4000-8000-000000000099', 'graves', 'a0000000-0000-4000-8000-000000000099', 'update', 1, 'conflict', '{}');
insert into public.sync_conflicts (id, sync_log_id, entity, entity_id, incoming, current_version)
select 'f0000000-0000-4000-8000-000000000099', id, 'graves', 'a0000000-0000-4000-8000-000000000099', '{}', 2
from public.sync_log
where client_event_id = 'e0000000-0000-4000-8000-000000000099';

do $$
declare
  r jsonb;
begin
  r := public.resolve_sync_conflict('f0000000-0000-4000-8000-000000000099', '  Kept the newer server record.  ');
  if r->>'result' <> 'applied' then raise exception 'conflict resolution did not apply: %', r; end if;
  if not exists (select 1 from public.sync_conflicts where id = 'f0000000-0000-4000-8000-000000000099' and status = 'resolved' and resolution = 'Kept the newer server record.' and resolved_at is not null) then
    raise exception 'conflict was not marked resolved';
  end if;
  if not exists (select 1 from public.audit_log where action = 'resolve_conflict' and entity_id = 'f0000000-0000-4000-8000-000000000099') then
    raise exception 'conflict resolution was not audited';
  end if;
  r := public.resolve_sync_conflict('f0000000-0000-4000-8000-000000000099', 'Repeated request');
  if r->>'reason' <> 'already_resolved' then raise exception 'repeat resolution was not idempotent: %', r; end if;
  r := public.resolve_sync_conflict('f0000000-0000-4000-8000-000000000099', '   ');
  if r->>'reason' <> 'invalid_resolution' then raise exception 'blank resolution accepted: %', r; end if;
end $$;

rollback;
