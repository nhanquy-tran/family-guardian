alter table public.devices drop constraint devices_browser_check;
alter table public.devices add constraint devices_browser_check
  check (browser in ('chrome','edge','brave','firefox','other'));
