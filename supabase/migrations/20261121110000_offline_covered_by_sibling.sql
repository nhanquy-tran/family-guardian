-- A silent device is not an incident while another device of the same child reports.
-- "Covered" = sibling seen after this device's last_seen_at and within 15 minutes of p_now.

create or replace function public.find_offline_devices(p_now timestamptz)
returns table (device_id uuid, family_id uuid, child_name text, browser text, os text, last_seen_at timestamptz)
language sql stable set search_path = ''
as $$
  select d.id, c.family_id, c.name, d.browser, d.os, d.last_seen_at
  from public.devices d
  join public.children c on c.id = d.child_id
  where d.last_seen_at <= p_now - interval '15 minutes'
    and d.last_seen_at >= p_now - interval '24 hours'
    and not exists (
      select 1 from public.alerts a
      where a.device_id = d.id and a.kind = 'offline' and a.incident_last_seen_at = d.last_seen_at
    )
    and not exists (
      select 1 from public.devices s
      where s.child_id = d.child_id
        and s.id <> d.id
        and s.last_seen_at > d.last_seen_at
        and s.last_seen_at > p_now - interval '15 minutes'
    )
$$;

revoke execute on function public.find_offline_devices(timestamptz) from public, anon, authenticated;
grant execute on function public.find_offline_devices(timestamptz) to service_role;

create or replace function public.resolve_offline_alerts(p_now timestamptz) returns void
language sql security definer set search_path = ''
as $$
  update public.alerts a
  set resolved_at = p_now
  from public.devices d
  where d.id = a.device_id
    and a.kind = 'offline'
    and a.resolved_at is null
    and (
      d.last_seen_at > a.incident_last_seen_at
      or exists (
        select 1 from public.devices s
        where s.child_id = d.child_id
          and s.id <> d.id
          and s.last_seen_at > a.incident_last_seen_at
          and s.last_seen_at > p_now - interval '15 minutes'
      )
    )
$$;

revoke execute on function public.resolve_offline_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_offline_alerts(timestamptz) to service_role;
