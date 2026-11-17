-- Aggregate usage in SQL (PostgREST caps responses at 1000 rows). security invoker: RLS applies.

create function public.usage_by_day(child_id uuid, tz text, days int)
returns table (day date, domain text, seconds bigint)
language plpgsql stable security invoker set search_path = ''
as $$
declare
  first_day date;
  last_day date;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = tz) then
    raise exception 'invalid_timezone';
  end if;
  if days is null or days < 1 or days > 31 then
    raise exception 'days must be between 1 and 31';
  end if;
  last_day := (pg_catalog.now() at time zone tz)::date;
  first_day := last_day - (days - 1);
  return query
    select (u.minute_utc at time zone tz)::date as day, u.domain, sum(u.seconds)::bigint as seconds
    from public.usage_minutes u
    join public.devices d on d.id = u.device_id
    where d.child_id = usage_by_day.child_id
      and u.minute_utc >= (first_day::timestamp at time zone tz)
      and u.minute_utc < ((last_day + 1)::timestamp at time zone tz)
    group by 1, 2
    order by 1, 2;
end;
$$;

create function public.usage_timeline(child_id uuid, tz text, day date)
returns table (minute_of_day int, domains text[], seconds int[])
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = tz) then
    raise exception 'invalid_timezone';
  end if;
  return query
    select (extract(hour from u.minute_utc at time zone tz) * 60
              + extract(minute from u.minute_utc at time zone tz))::int as minute_of_day,
           pg_catalog.array_agg(u.domain order by u.domain),
           pg_catalog.array_agg(u.seconds order by u.domain)
    from public.usage_minutes u
    join public.devices d on d.id = u.device_id
    where d.child_id = usage_timeline.child_id
      and u.minute_utc >= (usage_timeline.day::timestamp at time zone tz)
      and u.minute_utc < ((usage_timeline.day + 1)::timestamp at time zone tz)
    group by 1
    order by 1;
end;
$$;

revoke execute on function public.usage_by_day(uuid, text, int) from public, anon;
revoke execute on function public.usage_timeline(uuid, text, date) from public, anon;
grant execute on function public.usage_by_day(uuid, text, int) to authenticated;
grant execute on function public.usage_timeline(uuid, text, date) to authenticated;
