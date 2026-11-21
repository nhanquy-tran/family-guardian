# apps/web

Next.js App Router + Tailwind (wired through Turbopack in `next.config.ts`), deployed on Vercel (main only).

- This Next.js version may differ from your training data: check `node_modules/next/dist/docs/` before using an API you are unsure of. `proxy.ts` replaces middleware.
- Pages and route handlers stay thin; logic lives in `src/lib/**` modules that take their dependencies (Supabase client, clock, mailer) as parameters, so unit tests pass fakes.
- Parent data: `src/lib/supabase/server.ts` (session client, RLS). Device and cron routes: `src/lib/supabase/admin.ts` (service role, `server-only`). Device tokens: `hashDeviceToken` in `src/lib/device/token.ts`.
- Never read raw usage rows to aggregate in TypeScript: use the SQL functions (`usage_by_day`, `usage_timeline`) and page with `.range()` (PostgREST returns at most 1000 rows).
- Shared UI classes live in `src/components/ui.ts`. Tests render with `react-dom/server`; do not assert on the inline form-replay `<script>` React adds.
- Timezone comes from the browser (`?tz=`) or the family's stored timezone; never assume UTC for display.
- Absolute times on the dashboard use `LocalTime` (`src/components/local-time.tsx`, browser timezone); never print ISO or UTC strings. Server-action forms use `ActionForm` so the loading overlay shows.
- Route handlers fail closed: missing env or store errors give `500 { error: "server_error" }` with no detail.
- Public pages take their messages as props; `NEXT_PUBLIC_SUPPORT_EMAIL` is read only in `help/page.tsx`.
- `src/styles/tokens.css` is a copy of `docs/design/tokens.css` (a test asserts they are equal; update both together). Components never use `dark:`; colours come from token classes in `src/components/ui.ts`.
