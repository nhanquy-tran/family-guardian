-- Offline alerts (#18, ADR 0010): incident columns, detection function, cron trigger.

alter table public.alerts
  add column incident_last_seen_at timestamptz,
  add column emailed_at timestamptz;

update public.alerts a
set incident_last_seen_at = coalesce((select d.last_seen_at from public.devices d where d.id = a.device_id), a.sent_at),
    emailed_at = a.sent_at;

alter table public.alerts alter column incident_last_seen_at set not null;
alter table public.alerts
  add constraint alerts_device_incident_key unique (device_id, incident_last_seen_at);

-- Alerts are written by the service role only; parents may read their family's rows (alerts_select).
revoke all on public.alerts from anon, authenticated;
grant select on public.alerts to authenticated;

create function public.find_offline_devices(p_now timestamptz)
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
$$;

revoke execute on function public.find_offline_devices(timestamptz) from public, anon, authenticated;
grant execute on function public.find_offline_devices(timestamptz) to service_role;

-- Called by pg_cron; reads the app URL and shared secret from Supabase Vault.
create function public.call_offline_alerts() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'alert_cron_secret';
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning 'call_offline_alerts: Vault secrets app_url and alert_cron_secret are required';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/alerts/offline',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke execute on function public.call_offline_alerts() from public, anon, authenticated;

-- pg_cron and pg_net are not available in the PGlite test harness: guard them.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    execute $q$select cron.schedule('offline-alerts', '*/5 * * * *', 'select public.call_offline_alerts()')$q$;
    execute $q$select cron.schedule('purge-pair-attempts', '17 3 * * *', 'select public.purge_pair_attempts()')$q$;
  end if;
end
$$;
