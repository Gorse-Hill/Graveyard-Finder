-- Fixed-window rate limits. Only a SHA-256 hash of the caller key is stored.
create table if not exists public.rate_limit_buckets (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null default now(),
  hits integer not null default 1 check (hits >= 0)
);
alter table public.rate_limit_buckets enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit configuration';
  end if;

  insert into public.rate_limit_buckets (key_hash, window_start, hits)
  values (v_hash, now(), 1)
  on conflict (key_hash) do update
    set window_start = case
          when public.rate_limit_buckets.window_start <= now() - make_interval(secs => p_window_seconds)
          then now() else public.rate_limit_buckets.window_start end,
        hits = case
          when public.rate_limit_buckets.window_start <= now() - make_interval(secs => p_window_seconds)
          then 1 else public.rate_limit_buckets.hits + 1 end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
