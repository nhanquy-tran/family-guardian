-- Today's seconds per domain of the child's other devices, in the family timezone (day and sums share one clock).
create function public.device_other_usage(p_device_id uuid)
returns table (day date, domain text, seconds bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with ctx as (
    select d.child_id,
           coalesce(nullif(f.timezone, ''), 'UTC') as tz,
           (now() at time zone coalesce(nullif(f.timezone, ''), 'UTC'))::date as today
    from public.devices d
    join public.children c on c.id = d.child_id
    join public.families f on f.id = c.family_id
    where d.id = p_device_id
  )
  select ctx.today, u.domain, coalesce(u.seconds, 0)::bigint
  from ctx
  left join lateral (
    select m.domain, sum(m.seconds) as seconds
    from public.usage_minutes m
    where m.device_id in (select o.id from public.devices o where o.child_id = ctx.child_id and o.id <> p_device_id)
      and m.minute_utc >= (ctx.today::timestamp at time zone ctx.tz)
      and m.minute_utc < ((ctx.today + 1)::timestamp at time zone ctx.tz)
    group by m.domain
    order by 2 desc
    limit 1000
  ) u on true
  order by 3 desc;
$$;

revoke execute on function public.device_other_usage(uuid) from public, anon, authenticated;
grant execute on function public.device_other_usage(uuid) to service_role;
