-- Name length limit: 160 characters is stored, 161 is refused.
begin;
insert into public.devices (device_id, token_hash) values ('00000000-0000-4000-8000-0000000000a1', repeat('a', 64));

do $$
declare
  v_failed boolean := false;
begin
  insert into public.graves (id, qr_token, name, gps_lat, gps_lng, created_by_device)
  values ('00000000-0000-4000-8000-0000000000b1', 'NAMELEN160AAAAAAAAAAAAAAAA', repeat('a', 160), 9.5, 44.0,
          '00000000-0000-4000-8000-0000000000a1');
  begin
    insert into public.graves (id, qr_token, name, gps_lat, gps_lng, created_by_device)
    values ('00000000-0000-4000-8000-0000000000b2', 'NAMELEN161AAAAAAAAAAAAAAAA', repeat('a', 161), 9.5, 44.0,
            '00000000-0000-4000-8000-0000000000a1');
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'check 1 failed: a 161 character name was stored';
  end if;
  raise notice 'name length check passed';
end $$;
rollback;
