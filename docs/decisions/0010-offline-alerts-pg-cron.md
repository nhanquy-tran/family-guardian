# 0010. Offline alerts with Supabase pg_cron

Date: 2026-11-17. Status: accepted.

## Context
Vercel Hobby cron jobs run at most once a day.

## Decision
A `pg_cron` job in Supabase runs every 5 minutes, finds devices silent for 15+ minutes that were active in the last 24 hours, and calls the web app's alert endpoint via `pg_net` with a shared secret. The endpoint sends one e-mail per incident via Resend.
