-- The app limits a name to 160 characters. The database repeats the limit so no client can exceed it.
-- A longer name arrives in sync_push as a rejected event with the constraint reason.
alter table public.graves
  drop constraint if exists graves_name_max_length;
alter table public.graves
  add constraint graves_name_max_length check (length(name) <= 160) not valid;
