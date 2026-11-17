-- Initial MVP schema: tables, privacy constraints, RLS per family, first sign-in trigger.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.parents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  homework_categories text[] not null default '{}'
    check (homework_categories <@ array['education','entertainment','social','games','news','shopping','communication','productivity','other']::text[]),
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  token_hash text not null unique,
  browser text not null check (browser in ('chrome','edge','brave','other')),
  os text not null check (char_length(os) <= 32),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.pairing_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  child_id uuid not null references public.children (id) on delete cascade,
  expires_at timestamptz not null
);

create table public.usage_minutes (
  device_id uuid not null references public.devices (id) on delete cascade,
  minute_utc timestamptz not null check (minute_utc = date_trunc('minute', minute_utc)),
  domain text not null check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length(domain) <= 253),
  seconds int not null check (seconds between 1 and 60),
  primary key (device_id, minute_utc, domain)
);

create table public.block_rules (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  kind text not null check (kind in ('domain','category')),
  value text not null,
  created_at timestamptz not null default now(),
  unique (child_id, kind, value)
);

create table public.domain_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade,
  domain text not null check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length(domain) <= 253),
  category text not null
    check (category in ('education','entertainment','social','games','news','shopping','communication','productivity','other')),
  unique nulls not distinct (family_id, domain)
);

create table public.block_events (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  at timestamptz not null default now(),
  domain text not null check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length(domain) <= 253)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  kind text not null check (kind in ('offline')),
  sent_at timestamptz not null default now()
);

create index children_family_id_idx on public.children (family_id);
create index devices_child_id_idx on public.devices (child_id);
create index pairing_codes_child_id_idx on public.pairing_codes (child_id);
create index block_rules_child_id_idx on public.block_rules (child_id);
create index block_events_device_at_idx on public.block_events (device_id, at);
create index alerts_device_id_idx on public.alerts (device_id);
create index parents_family_id_idx on public.parents (family_id);

-- Family lookup (security definer avoids RLS recursion on parents).
create function public.current_family_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select family_id from public.parents where user_id = auth.uid() $$;

revoke execute on function public.current_family_id() from public, anon;
grant execute on function public.current_family_id() to authenticated, service_role;

alter table public.families enable row level security;
alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.devices enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.usage_minutes enable row level security;
alter table public.block_rules enable row level security;
alter table public.domain_categories enable row level security;
alter table public.block_events enable row level security;
alter table public.alerts enable row level security;

create policy families_select on public.families for select to authenticated
  using (id = public.current_family_id());
create policy families_update on public.families for update to authenticated
  using (id = public.current_family_id()) with check (id = public.current_family_id());

create policy parents_select on public.parents for select to authenticated
  using (family_id = public.current_family_id());

create policy children_select on public.children for select to authenticated
  using (family_id = public.current_family_id());
create policy children_insert on public.children for insert to authenticated
  with check (family_id = public.current_family_id());
create policy children_update on public.children for update to authenticated
  using (family_id = public.current_family_id()) with check (family_id = public.current_family_id());
create policy children_delete on public.children for delete to authenticated
  using (family_id = public.current_family_id());

create policy block_rules_select on public.block_rules for select to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy block_rules_insert on public.block_rules for insert to authenticated
  with check (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy block_rules_update on public.block_rules for update to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()))
  with check (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy block_rules_delete on public.block_rules for delete to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));

create policy pairing_codes_select on public.pairing_codes for select to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy pairing_codes_insert on public.pairing_codes for insert to authenticated
  with check (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy pairing_codes_update on public.pairing_codes for update to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()))
  with check (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy pairing_codes_delete on public.pairing_codes for delete to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));

create policy devices_select on public.devices for select to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy devices_delete on public.devices for delete to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));

create policy usage_minutes_select on public.usage_minutes for select to authenticated
  using (device_id in (
    select d.id from public.devices d
    where d.child_id in (select id from public.children where family_id = public.current_family_id())));
create policy block_events_select on public.block_events for select to authenticated
  using (device_id in (
    select d.id from public.devices d
    where d.child_id in (select id from public.children where family_id = public.current_family_id())));
create policy alerts_select on public.alerts for select to authenticated
  using (device_id in (
    select d.id from public.devices d
    where d.child_id in (select id from public.children where family_id = public.current_family_id())));

create policy domain_categories_select on public.domain_categories for select to authenticated
  using (family_id is null or family_id = public.current_family_id());
create policy domain_categories_insert on public.domain_categories for insert to authenticated
  with check (family_id = public.current_family_id());
create policy domain_categories_update on public.domain_categories for update to authenticated
  using (family_id = public.current_family_id()) with check (family_id = public.current_family_id());
create policy domain_categories_delete on public.domain_categories for delete to authenticated
  using (family_id = public.current_family_id());

-- token_hash stays server-only.
revoke select on public.devices from authenticated, anon;
grant select (id, child_id, browser, os, last_seen_at, created_at) on public.devices to authenticated;

-- Expired pairing codes must not block a value; only the exact same expired code is removed.
create function public.purge_expired_pairing_code() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.pairing_codes where code = new.code and expires_at < now();
  return new;
end;
$$;

revoke execute on function public.purge_expired_pairing_code() from public, anon, authenticated;

create trigger pairing_codes_purge_expired
  before insert or update of code on public.pairing_codes
  for each row execute function public.purge_expired_pairing_code();

-- First sign-in creates a family and links the parent.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  if not exists (select 1 from public.parents where user_id = new.id) then
    insert into public.families (name)
    values (coalesce(new.raw_user_meta_data ->> 'full_name', 'My family'))
    returning id into new_family_id;
    insert into public.parents (user_id, family_id) values (new.id, new_family_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
