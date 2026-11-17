# Design

## Context

Change `add-database-schema` (#7) creates `devices(id, child_id, token_hash, browser, os, last_seen_at, created_at)`, lets parents `select` (all columns except `token_hash`) and `delete` their own family's devices, and gives no update policy. Supabase's default privileges still grant `update` on the table to `authenticated`; only the missing policy blocks parent updates today. Change `add-parent-google-sign-in` (#8) adds `src/lib/supabase/server.ts` (`createClient()`), the dashboard shell and a placeholder `app/dashboard/devices/page.tsx`. Both follow "thin pages, logic in `.ts` modules that take a Supabase client", tested with fakes. Issue #10 (heartbeat) will write `last_seen_at`, `browser` and the extension version. Requirements are in `specs/device-management/spec.md`.

## Goals / Non-Goals

**Goals:** devices page with status and last seen; rename; remove that revokes the token; database enforces that parents can change only the name.

**Non-Goals:** heartbeat writes, pairing, auto-refresh, alerts (see proposal).

## Decisions

1. **New migration** `supabase/migrations/20261117120000_devices_name_and_version.sql` (never edit #7's file):
   - `alter table public.devices add column name text check (char_length(name) between 1 and 40), add column extension_version text check (char_length(extension_version) <= 32);` Both nullable: existing and newly paired devices have no name until renamed, and no version until the first heartbeat. 32 matches `HeartbeatRequest.extensionVersion`.
   - `grant select (name, extension_version) on public.devices to authenticated;` (the #7 migration uses a column list, so new columns are not visible otherwise).
   - `revoke update on public.devices from authenticated, anon; grant update (name) on public.devices to authenticated;` so a parent can never change `token_hash`, `child_id`, `last_seen_at`, `browser`, `os` or `extension_version`, even with a policy in place.
   - Policy `devices_update_own` for `authenticated`, `using` and `with check` = `child_id in (select id from public.children where family_id = public.current_family_id())`, same pattern as #7.
   - Trimming happens in the app; the check only bounds length. Alternative: a `security definer` `rename_device()` function; rejected, column privilege + RLS is less code and the same pattern #7 uses for `token_hash`.

2. **Remove = delete the row.** #7 already allows parents to delete own-family devices and cascades `usage_minutes`, `block_events`, `alerts`. Deleting removes `token_hash`, so any later lookup by the hash finds nothing; that is the revocation. Alternative: a `revoked_at` column that keeps history; rejected for MVP because every device query and the heartbeat would need to filter it, and the issue asks only for revocation. The confirm text says usage history from that device is deleted too.

3. **Pure helpers** in `apps/web/src/lib/devices/status.ts`:
   - `ONLINE_THRESHOLD_MS = 180_000`. `deviceStatus(lastSeenAt: string | null, now: Date): "online" | "offline"`: online iff not null and `now - lastSeenAt < 180_000` (a future timestamp from clock skew counts as online). Heartbeats come every minute, so 3 minutes tolerates two lost posts.
   - `formatLastSeen(lastSeenAt, now)`: `null` → `"Never"`; diff < 60 s (or negative) → `"just now"`; < 60 min → `"<m> min ago"`; < 24 h → `"<h> h ago"`; else `"<d> d ago"` (floored).
   - `browserLabel(browser)`: `chrome` → `Chrome`, `edge` → `Edge`, `brave` → `Brave`, other → `Other browser`. `deviceLabel(device)` → trimmed `name`, else `"<browserLabel> on <os>"`.

4. **Data and mutations** in `apps/web/src/lib/devices/devices.ts` (client passed in, typed with `SupabaseClient`):
   - `listDevicesByChild(client)`: `from("children").select("id, name, devices(id, name, browser, os, extension_version, last_seen_at, created_at)").order("name")`; devices sorted by `created_at` ascending in code. Returns `ChildDevices[]`, or `null` on error. Never selects `token_hash`.
   - `renameDevice(client, id, rawName)`: trims; length outside 1..40 → `{ ok: false, error: "invalid-name" }` without calling the client; else `update({ name }).eq("id", id).select("id")`; error or zero rows → `{ ok: false, error: "failed" }`; else `{ ok: true }`.
   - `removeDevice(client, id)`: `delete().eq("id", id).select("id")`; error or zero rows → `{ ok: false, error: "failed" }`.
   RLS limits all three to the parent's family, so the app does no extra family check.

5. **Page and actions.** `app/dashboard/devices/actions.ts` (`"use server"`): `renameDeviceAction(formData)` and `removeDeviceAction(formData)` read `deviceId` (and `name`), call the lib with `createClient()`, then `revalidatePath("/dashboard/devices")` and `redirect` to `/dashboard/devices` or `/dashboard/devices?error=<code>`. The page (Server Component, `searchParams` is a Promise in this Next.js version; check `node_modules/next/dist/docs/`) loads data, takes `now = new Date()` and renders `<DeviceList>`. No client component.

6. **`DeviceList` component** (`src/components/device-list.tsx`): props `{ groups, now, error, renameAction, removeAction }`. Per child: heading, then a row per device with label, browser, OS, version (`"unknown"` if null), last seen, and a status badge with `data-status="online|offline"` and text Online/Offline. Rename: form with hidden `deviceId`, `<input name="name" maxlength="40" required>` and a "Rename" button. Remove: `<details><summary>Remove</summary>` with the warning "This device will stop reporting and its usage history will be deleted." and a form with hidden `deviceId` and a "Yes, remove" button. A child with no devices shows "No devices yet" and a link to `/dashboard/children`. Error codes map to: `invalid-name` → "Name must be 1 to 40 characters.", `failed` → "Something went wrong. Please try again.", `load` → "Could not load devices. Please reload the page." Tests render with `renderToStaticMarkup` and pass stub async functions as actions.

## Risks / Trade-offs

- [Extension version is not in ADR 0005's explicit list] → It is already in the accepted `HeartbeatRequest` contract, describes our software, not the child's activity, and is capped at 32 characters. The reviewer/human should confirm no new ADR is wanted.
- [Removing deletes usage history] → Stated in the confirm text; a soft revoke can come later if parents ask.
- [Status computed at page load goes stale] → Parent reloads; acceptable for MVP.
- [#7 / #8 not merged yet] → This change must be implemented after both; the tests reuse the #7 harness and #8 shell.
