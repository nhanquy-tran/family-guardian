-- Device pairing: single-use code redemption and per-IP rate limit storage (ADR 0012).

-- ip_hash is a keyed HMAC-SHA256 of the caller IP, never the IP itself. Service role only.
create table public.pair_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  at timestamptz not null default now()
);

create index pair_attempts_ip_hash_at_idx on public.pair_attempts (ip_hash, at);

alter table public.pair_attempts enable row level security;

create function public.purge_pair_attempts() returns void
language sql security definer set search_path = ''
as $$
  delete from public.pair_attempts where at < now() - interval '10 minutes';
$$;

create function public.register_pair_attempt(p_ip_hash text) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  attempts int;
begin
  perform public.purge_pair_attempts();
  insert into public.pair_attempts (ip_hash) values (p_ip_hash);
  select count(*)::int into attempts from public.pair_attempts
    where ip_hash = p_ip_hash and at >= now() - interval '10 minutes';
  return attempts;
end;
$$;

-- One call is one transaction: the row lock on delete lets only one caller consume a code.
create function public.redeem_pairing_code(p_code text, p_token_hash text, p_browser text, p_os text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_child_id uuid;
  v_device_id uuid;
begin
  delete from public.pairing_codes
    where code = p_code and expires_at > now()
    returning child_id into v_child_id;
  if v_child_id is null then
    return null;
  end if;
  insert into public.devices (child_id, token_hash, browser, os)
    values (v_child_id, p_token_hash, p_browser, p_os)
    returning id into v_device_id;
  return v_device_id;
end;
$$;

revoke execute on function
  public.purge_pair_attempts(),
  public.register_pair_attempt(text),
  public.redeem_pairing_code(text, text, text, text)
  from public, anon, authenticated;
grant execute on function
  public.purge_pair_attempts(),
  public.register_pair_attempt(text),
  public.redeem_pairing_code(text, text, text, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-pair-attempts', '17 3 * * *', 'select public.purge_pair_attempts()');
  end if;
end;
$$;
