-- Site access alert (#176, ADR 0024/0025): latest yes/no value per device and its incidents.

alter table public.devices add column site_access boolean not null default true;
grant select (site_access) on public.devices to authenticated;

create table public.site_access_incidents (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index site_access_incidents_one_open_idx
  on public.site_access_incidents (device_id) where resolved_at is null;

alter table public.site_access_incidents enable row level security;
revoke all on public.site_access_incidents from anon, authenticated;
grant select on public.site_access_incidents to authenticated;

create policy site_access_incidents_select on public.site_access_incidents for select to authenticated
  using (device_id in (
    select d.id from public.devices d
    where d.child_id in (select id from public.children where family_id = public.current_family_id())));

create function public.record_site_access_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.site_access = false and old.site_access = true then
    insert into public.site_access_incidents (device_id) values (new.id);
  elsif new.site_access = true and old.site_access = false then
    update public.site_access_incidents set resolved_at = now()
    where device_id = new.id and resolved_at is null;
  end if;
  return new;
end
$$;

revoke execute on function public.record_site_access_change() from public, anon, authenticated;

create trigger devices_site_access_change
  after update of site_access on public.devices
  for each row execute function public.record_site_access_change();

create function public.purge_site_access_incidents() returns void
language sql security definer set search_path = ''
as $$
  delete from public.site_access_incidents
  where coalesce(resolved_at, started_at) < now() - interval '90 days';
$$;

revoke execute on function public.purge_site_access_incidents() from public, anon, authenticated;
grant execute on function public.purge_site_access_incidents() to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    execute $q$select cron.schedule('purge-site-access-incidents', '37 3 * * *', 'select public.purge_site_access_incidents()')$q$;
  end if;
end
$$;
