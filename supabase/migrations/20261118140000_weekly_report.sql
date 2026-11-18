-- Weekly usage report (#90): opt-in flag and per-child totals. Claims reuse digest_runs (frequency 'weekly_report').

alter table public.families add column weekly_report_enabled boolean not null default false;

-- Parents edit this column of their own family (families_update RLS limits the row).
grant update (weekly_report_enabled) on public.families to authenticated;

create function public.usage_total_seconds(p_child_ids uuid[], p_start timestamptz, p_end timestamptz)
returns table (child_id uuid, seconds bigint)
language sql security definer set search_path = ''
as $$
  select d.child_id, sum(u.seconds)::bigint
  from public.usage_minutes u
  join public.devices d on d.id = u.device_id
  where d.child_id = any (p_child_ids)
    and u.minute_utc >= p_start
    and u.minute_utc < p_end
  group by d.child_id
$$;

revoke execute on function public.usage_total_seconds(uuid[], timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.usage_total_seconds(uuid[], timestamptz, timestamptz) to service_role;
