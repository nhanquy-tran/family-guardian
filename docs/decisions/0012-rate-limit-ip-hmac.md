# 0012. Rate limit device pairing with a keyed IP hash

Date: 2026-11-17. Status: accepted.

## Context
`POST /api/device/pair` trades a 6-character code for a device token. Without a limit, codes can be guessed by brute force. The limit has to be per client IP, so the server must remember something about the caller IP for a short time. ADR 0005 limits what the extension sends; this data is not sent by the extension but derived by the server from the request, so it needs a decision of its own. Raised in the review of the spec for #9.

## Decision
- **Purpose:** only to limit pairing attempts to 10 per IP per 10 minutes. Never used for analytics, location or any other feature.
- **Stored:** table `pair_attempts(ip_hash, at)`. `ip_hash` is `HMAC-SHA256(ip, PAIR_RATE_LIMIT_SECRET)` as 64 hex characters. The raw IP, user agent, code and token are never stored or logged. The secret is a server-only env var (`apps/web/.env.example` lists its name). If it is missing, the route returns `500 server_error` and never falls back to a plain hash. A keyed hash cannot be reversed by trying all IPv4 addresses without the secret.
- **Retention:** `register_pair_attempt` deletes rows older than 10 minutes on every call. A daily `pg_cron` job (`purge_pair_attempts()`) deletes them even when nobody pairs. Maximum age of a row: 10 minutes plus 24 hours in the idle case, 10 minutes while the endpoint is used. RLS is on with no policies; only the service role can touch the table.
- **Why a `pg_cron` purge:** ADR 0010 already uses `pg_cron` in the same database, so it adds no service or dependency. It is a single `delete` statement; extending the alert endpoint instead would couple unrelated features.
- **Why not in memory:** Vercel runs many short-lived instances, so counters would not be shared and the limit would be bypassed.
- **Why not a new service (Upstash, Vercel KV):** new infrastructure and a new data processor for a 20-family MVP; Postgres is already there.
- **No forwarding headers:** the IP is taken from `x-forwarded-for` (Vercel overwrites it), then `x-real-ip`. If neither exists, the server logs a warning without any IP and rate-limits under one shared `unknown` bucket. Accepted because only Vercel deployment is supported.

## Consequences
- One new secret to set in Vercel and in local `.env`; rotating it resets all counters, which is harmless.
- Pupils behind one school NAT share the limit.
- Approved by the owner on the review of the spec for #9.
