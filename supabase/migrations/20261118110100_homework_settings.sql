-- Homework settings: parent-editable extra homework domains and a default category.

-- CHECK constraints cannot contain subqueries, so the per-entry validation lives in an immutable function.
create function public.homework_domains_valid(domains text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(domains), 0) <= 50
    and not exists (
      select 1 from unnest(domains) as d
      where d is null or d !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' or length(d) > 253
    );
$$;

alter table public.children
  add column homework_domains text[] not null default '{}'
    check (public.homework_domains_valid(homework_domains));

grant insert (homework_domains), update (homework_domains) on public.children to authenticated;

alter table public.children alter column homework_categories set default '{education}';
update public.children set homework_categories = '{education}' where homework_categories = '{}';
