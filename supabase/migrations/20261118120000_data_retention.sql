-- Data retention (#19): delete usage and block history older than 13 months.

create index usage_minutes_minute_utc_idx on public.usage_minutes (minute_utc);
create index block_events_at_idx on public.block_events (at);

create function public.purge_old_data(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_usage bigint;
  v_blocks bigint;
begin
  delete from public.usage_minutes where minute_utc < p_now - interval '13 months';
  get diagnostics v_usage = row_count;
  delete from public.block_events where at < p_now - interval '13 months';
  get diagnostics v_blocks = row_count;
  return jsonb_build_object('usage_minutes', v_usage, 'block_events', v_blocks);
end
$$;

revoke execute on function public.purge_old_data(timestamptz) from public, anon, authenticated;
grant execute on function public.purge_old_data(timestamptz) to service_role;

-- pg_cron is not available in the PGlite test harness: guard it. Same job name replaces the schedule.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    execute $q$select cron.schedule('purge-old-data', '23 3 * * *', 'select public.purge_old_data(now())')$q$;
  end if;
end
$$;
