-- Daily time limits per category, and a rules_version bump when the family timezone changes.

create table public.child_category_limits (
  child_id uuid not null references public.children (id) on delete cascade,
  category text not null check (category in (
    'education', 'entertainment', 'social', 'games', 'news', 'shopping', 'communication', 'productivity', 'other'
  )),
  minutes_per_day integer not null check (minutes_per_day between 5 and 1440),
  primary key (child_id, category)
);

alter table public.child_category_limits enable row level security;

create policy child_category_limits_select on public.child_category_limits for select to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy child_category_limits_insert on public.child_category_limits for insert to authenticated
  with check (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy child_category_limits_update on public.child_category_limits for update to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()))
  with check (child_id in (select id from public.children where family_id = public.current_family_id()));
create policy child_category_limits_delete on public.child_category_limits for delete to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()));

grant select, insert, update, delete on public.child_category_limits to authenticated;
grant all on public.child_category_limits to service_role;

create trigger child_category_limits_bump_rules_version
  after insert or update or delete on public.child_category_limits
  for each row execute function public.bump_rules_version();

create function public.bump_family_rules_version_on_timezone() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.timezone is distinct from new.timezone then
    update public.children set rules_version = rules_version + 1 where family_id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function public.bump_family_rules_version_on_timezone()
  from public, anon, authenticated;

create trigger families_timezone_bump_rules_version
  after update of timezone on public.families
  for each row execute function public.bump_family_rules_version_on_timezone();
