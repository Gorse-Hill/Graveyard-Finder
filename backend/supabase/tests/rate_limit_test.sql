begin;

do $$
begin
  if not public.check_rate_limit('test:device-register:127.0.0.1', 2, 60) then
    raise exception 'first rate-limit request was refused';
  end if;
  if not public.check_rate_limit('test:device-register:127.0.0.1', 2, 60) then
    raise exception 'second rate-limit request was refused';
  end if;
  if public.check_rate_limit('test:device-register:127.0.0.1', 2, 60) then
    raise exception 'request over the limit was allowed';
  end if;
  if not public.check_rate_limit('test:device-register:127.0.0.2', 2, 60) then
    raise exception 'a different caller shared the same bucket';
  end if;
end $$;

rollback;
