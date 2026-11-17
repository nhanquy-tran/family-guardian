-- Heartbeat API: extension version on devices, rules version on children (bumped only by triggers).

alter table public.devices
  add column extension_version text check (char_length(extension_version) <= 32);

grant select (extension_version) on public.devices to authenticated;

alter table public.children
  add column rules_version integer not null default 0;

-- rules_version is written only by the triggers below, never by parents.
revoke insert, update on public.children from authenticated;
grant insert (family_id, name, homework_categories), update (family_id, name, homework_categories)
  on public.children to authenticated;

create function public.bump_rules_version() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.children set rules_version = rules_version + 1 where id = old.child_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.children set rules_version = rules_version + 1 where id = new.child_id;
  end if;
  return null;
end;
$$;

-- Category rules depend on the family's overrides; global rows (family_id null) do not bump.
create function public.bump_family_rules_version() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.family_id is not null then
    update public.children set rules_version = rules_version + 1 where family_id = old.family_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.family_id is not null then
    update public.children set rules_version = rules_version + 1 where family_id = new.family_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.bump_rules_version(), public.bump_family_rules_version()
  from public, anon, authenticated;

create trigger block_rules_bump_rules_version
  after insert or update or delete on public.block_rules
  for each row execute function public.bump_rules_version();

create trigger domain_categories_bump_rules_version
  after insert or update or delete on public.domain_categories
  for each row execute function public.bump_family_rules_version();
