-- Today's seconds per domain on the child's other devices, in the family timezone.
-- One row with a null domain and 0 seconds when there is none, so the day is always known.
create function public.device_other_usage(p_device_id uuid)
returns table (day date, domain text, seconds bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz text;
  v_child uuid;
  start_utc timestamptz;
  v_day date;
begin
  select coalesce(f.timezone, 'UTC'), d.child_id into tz, v_child
  from public.devices d
  join public.children c on c.id = d.child_id
  join public.families f on f.id = c.family_id
  where d.id = p_device_id;

  if v_child is null then
    return;
  end if;

  v_day := (now() at time zone tz)::date;
  start_utc := v_day::timestamp at time zone tz;

  return query
  select v_day, u.domain, u.total
  from (
    select um.domain, sum(um.seconds)::bigint as total
    from public.usage_minutes um
    join public.devices od on od.id = um.device_id
    where od.child_id = v_child
      and od.id <> p_device_id
      and um.minute_utc >= start_utc
      and um.minute_utc < start_utc + interval '1 day'
    group by um.domain
    order by total desc
    limit 1000
  ) u
  union all
  select v_day, null::text, 0::bigint
  where not exists (
    select 1 from public.usage_minutes um
    join public.devices od on od.id = um.device_id
    where od.child_id = v_child
      and od.id <> p_device_id
      and um.minute_utc >= start_utc
      and um.minute_utc < start_utc + interval '1 day'
  );
end;
$$;

revoke execute on function public.device_other_usage(uuid) from public, anon, authenticated;
grant execute on function public.device_other_usage(uuid) to service_role;
