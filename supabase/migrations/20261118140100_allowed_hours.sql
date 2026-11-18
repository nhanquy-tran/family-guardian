-- Allowed hours: a per-child daily browsing window (HH:MM, family timezone), both set or both null.
alter table public.children
  add column allowed_start text,
  add column allowed_end text,
  add constraint children_allowed_hours_valid check (
    (allowed_start is null and allowed_end is null)
    or (
      coalesce(allowed_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$', false)
      and coalesce(allowed_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$', false)
      and allowed_start <> allowed_end
    )
  );

grant update (allowed_start, allowed_end) on public.children to authenticated;

-- One bump per save that changes a value (before-trigger on the row itself, no second update).
create function public.bump_rules_version_on_allowed_hours() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.allowed_start is distinct from old.allowed_start or new.allowed_end is distinct from old.allowed_end then
    new.rules_version = old.rules_version + 1;
  end if;
  return new;
end;
$$;

revoke execute on function public.bump_rules_version_on_allowed_hours() from public, anon, authenticated;

create trigger children_allowed_hours_bump_rules_version
  before update of allowed_start, allowed_end on public.children
  for each row execute function public.bump_rules_version_on_allowed_hours();
