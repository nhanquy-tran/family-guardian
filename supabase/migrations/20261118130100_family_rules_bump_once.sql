-- An update inside one family bumped rules_version twice (old and new family); bump once.
create or replace function public.bump_family_rules_version() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.family_id is not null then
    update public.children set rules_version = rules_version + 1 where family_id = old.family_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.family_id is not null
     and (tg_op = 'INSERT' or new.family_id is distinct from old.family_id) then
    update public.children set rules_version = rules_version + 1 where family_id = new.family_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.bump_family_rules_version() from public, anon, authenticated;
