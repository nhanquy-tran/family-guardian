-- Site blocking: validate rule values and make blocked attempts idempotent.
alter table public.block_rules add constraint block_rules_value_check check (
  (kind = 'domain' and value ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and char_length(value) <= 253)
  or (kind = 'category' and value in (
    'education', 'entertainment', 'social', 'games', 'news', 'shopping', 'communication', 'productivity', 'other'
  ))
);

alter table public.block_events add constraint block_events_device_at_domain_key unique (device_id, at, domain);
