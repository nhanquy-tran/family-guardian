-- Digest e-mails (#58, ADR 0016): family digest settings, claim table, incident resolution, cron trigger.

alter table public.families
  add column timezone text not null default 'UTC',
  add column timezone_known boolean not null default false,
  add column digest_frequency text not null default 'daily'
    constraint families_digest_frequency_check check (digest_frequency in ('daily', 'weekly')),
  add column digest_hour smallint not null default 8
    constraint families_digest_hour_check check (digest_hour between 0 and 23);

-- Parents edit these columns of their own family (families_update RLS limits the row).
grant update (timezone, timezone_known, digest_frequency, digest_hour) on public.families to authenticated;

-- One claim per family, frequency and period; service role only.
create table public.digest_runs (
  family_id uuid not null references public.families (id) on delete cascade,
  frequency text not null,
  period_start date not null,
  claimed_at timestamptz not null default now(),
  primary key (family_id, frequency, period_start)
);

alter table public.digest_runs enable row level security;
revoke all on public.digest_runs from anon, authenticated;
grant all on public.digest_runs to service_role;

alter table public.alerts add column resolved_at timestamptz;

create function public.resolve_offline_alerts(p_now timestamptz) returns void
language sql security definer set search_path = ''
as $$
  update public.alerts a
  set resolved_at = p_now
  from public.devices d
  where d.id = a.device_id
    and a.kind = 'offline'
    and a.resolved_at is null
    and d.last_seen_at > a.incident_last_seen_at
$$;

revoke execute on function public.resolve_offline_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.resolve_offline_alerts(timestamptz) to service_role;

create function public.purge_digest_runs() returns void
language sql security definer set search_path = ''
as $$
  delete from public.digest_runs where claimed_at < now() - interval '90 days'
$$;

revoke execute on function public.purge_digest_runs() from public, anon, authenticated;
grant execute on function public.purge_digest_runs() to service_role;

-- Called by pg_cron; reads the app URL and shared secret from Supabase Vault.
create function public.call_send_digests() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'alert_cron_secret';
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning 'call_send_digests: Vault secrets app_url and alert_cron_secret are required';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/digest/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;

revoke execute on function public.call_send_digests() from public, anon, authenticated;

-- pg_cron and pg_net are not available in the PGlite test harness: guard them.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    execute $q$select cron.schedule('send-digests', '*/15 * * * *', 'select public.call_send_digests()')$q$;
    execute $q$select cron.schedule('purge-digest-runs', '29 3 * * *', 'select public.purge_digest_runs()')$q$;
  end if;
end
$$;
