-- Parents can name their devices and nothing else on the row.
alter table public.devices add column name text check (char_length(name) between 1 and 40);

grant select (name) on public.devices to authenticated;

revoke update on public.devices from authenticated, anon;
grant update (name) on public.devices to authenticated;

create policy devices_update_own on public.devices for update to authenticated
  using (child_id in (select id from public.children where family_id = public.current_family_id()))
  with check (child_id in (select id from public.children where family_id = public.current_family_id()));
