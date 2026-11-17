# Design

## Context

Migrations already on `main`: `20261117000000_initial_schema.sql` (#7) and `20261117100000_heartbeat.sql` (#10). #7 creates `devices(id, child_id, token_hash, browser, os, last_seen_at, created_at)`, lets parents `select` (all columns except `token_hash`) and `delete` their own family's devices, and gives no update policy. Supabase's default privileges still grant `update` on the table to `authenticated`; only the missing policy blocks parent updates today. #10 adds `devices.extension_version` (check `<= 32`) and `grant select (extension_version)` to `authenticated`. Change `add-parent-google-sign-in` (#8) added `src/lib/supabase/server.ts` (`createClient()`), the dashboard shell and a placeholder `app/dashboard/devices/page.tsx`. Both follow "thin pages, logic in `.ts` modules that take a Supabase client", tested with fakes. The heartbeat (#10) writes `last_seen_at`, `browser` and `extension_version`. Requirements are in `specs/device-management/spec.md`.

## Goals / Non-Goals

**Goals:** devices page with status and last seen; rename; remove that revokes the token; database enforces that parents can change only the name.

**Non-Goals:** heartbeat writes, pairing, auto-refresh, alerts (see proposal).

## Decisions

1. **New migration** `supabase/migrations/20261117120000_devices_name.sql`, building on `20261117000000_initial_schema.sql` and `20261117100000_heartbeat.sql` (never edit applied migrations). It adds only `name`; it does not touch `extension_version`:
   - `alter table public.devices add column name text check (char_length(name) between 1 and 40);` Nullable: existing and newly paired devices have no name until renamed.
   - `grant select (name) on public.devices to authenticated;` (the initial migration uses a column list, so a new column is not visible otherwise).
   - `revoke update on public.devices from authenticated, anon; grant update (name) on public.devices to authenticated;` so a parent can never change `token_hash`, `child_id`, `last_seen_at`, `browser`, `os` or `extension_version`, even with a policy in place.
   - Policy `devices_update_own` for `authenticated`, `using` and `with check` = `child_id in (select id from public.children where family_id = public.current_family_id())`, same pattern as #7.
   - Trimming happens in the app; the check only bounds length. Alternative: a `security definer` `rename_device()` function; rejected, column privilege + RLS is less code and the same pattern #7 uses for `token_hash`.

2. **Remove = delete the row.** #7 already allows parents to delete own-family devices and cascades `usage_minutes`, `block_events`, `alerts`. Deleting removes `token_hash`, so any later lookup by the hash finds nothing; that is the revocation. Alternative: a `revoked_at` column that keeps history; rejected for MVP because every device query and the heartbeat would need to filter it, and the issue asks only for revocation. Because the delete is irreversible, the page asks for confirmation first (decision 5).

3. **Pure helpers** in `apps/web/src/lib/devices/status.ts`:
   - `ONLINE_THRESHOLD_MS = 180_000`. `deviceStatus(lastSeenAt: string | null, now: Date): "online" | "offline"`: online iff not null and `now - lastSeenAt < 180_000` (a future timestamp from clock skew counts as online). Heartbeats come every minute, so 3 minutes tolerates two lost posts.
   - `formatLastSeen(lastSeenAt, now)`: `null` → `"Never"`; diff < 60 s (or negative) → `"just now"`; < 60 min → `"<m> min ago"`; < 24 h → `"<h> h ago"`; else `"<d> d ago"` (floored).
   - `browserLabel(browser)`: `chrome` → `Chrome`, `edge` → `Edge`, `brave` → `Brave`, other → `Other browser`. `deviceLabel(device)` → trimmed `name`, else `"<browserLabel> on <os>"`.

4. **Data and mutations** in `apps/web/src/lib/devices/devices.ts` (client passed in, typed with `SupabaseClient`):
   - `listDevicesByChild(client)`: `from("children").select("id, name, devices(id, name, browser, os, extension_version, last_seen_at, created_at)").order("name")`; devices sorted by `created_at` ascending in code. Returns `ChildDevices[]`, or `null` on error. Never selects `token_hash`.
   - `renameDevice(client, id, rawName)`: trims; length outside 1..40 → `{ ok: false, error: "invalid-name" }` without calling the client; else `update({ name }).eq("id", id).select("id")`; error or zero rows → `{ ok: false, error: "failed" }`; else `{ ok: true }`.
   - `removeDevice(client, id)`: `delete().eq("id", id).select("id")`; error or zero rows → `{ ok: false, error: "failed" }`.
   RLS limits all three to the parent's family, so the app does no extra family check.

5. **Page and actions.** The page uses the existing `createClient()` from `src/lib/supabase/server.ts`; this change adds no service-role client and never imports `admin.ts`. `app/dashboard/devices/actions.ts` (`"use server"`): `renameDeviceAction(formData)` and `removeDeviceAction(formData)` read `deviceId` (and `name`), call the lib, then `revalidatePath("/dashboard/devices")` and `redirect` to `/dashboard/devices` or `/dashboard/devices?error=<code>`. The page (Server Component, `searchParams` is a Promise in this Next.js version; check `node_modules/next/dist/docs/`) reads `error` and `remove`, loads data, takes `now = new Date()` and renders `<DeviceList>`. If the load returns `null` the page renders the `load` error and no groups. No client component. `deviceErrorMessage(code)` in `lib/devices/devices.ts` maps a known code to its message and anything else (unknown, tampered or missing) to `null`, so the page never echoes the URL value.

   **Confirm step for Remove (no client JS):** the Remove control is a plain link to `/dashboard/devices?remove=<deviceId>`. When `remove` matches a listed device the page shows a confirmation panel for that device (`confirmRemoveId` prop) naming the device label and the child's name, warning "This will delete the device and its usage history. This cannot be undone.", with a "Cancel" link back to `/dashboard/devices` and a form (hidden `deviceId`, "Yes, remove" button) posting `removeDeviceAction`. A `remove` value that matches no listed device shows no panel. Nothing is deleted until the form is submitted. The action itself only deletes the posted id under RLS, so a forged post can delete only the parent's own family's devices, which is the same as the page allows.

6. **`DeviceList` component** (`src/components/device-list.tsx`): props `{ groups, now, error, confirmRemoveId, renameAction, removeAction }`. Per child: heading, then a row per device with label, browser, OS, version (`"unknown"` if null), last seen, and a status badge with `data-status="online|offline"` and text Online/Offline. Rename: form with hidden `deviceId`, `<input name="name" maxlength="40" required>` and a "Rename" button. Remove: a link "Remove" as described above. A child with no devices shows "No devices yet" and a link to `/dashboard/children`. Error codes map to: `invalid-name` → "Name must be 1 to 40 characters.", `failed` → "Something went wrong. Please try again.", `load` → "Could not load devices. Please reload the page." Tests render with `renderToStaticMarkup` and pass stub async functions as actions.

## Risks / Trade-offs

- [Extension version is not in ADR 0005's explicit list] → This change stores nothing new about the child: the column and its collection come from #10; this change only displays it. It is part of the accepted `HeartbeatRequest` contract and capped at 32 characters.
- [Removing deletes usage history] → A confirmation step names the device and child and states the deletion; a soft revoke can come later if parents ask.
- [Status computed at page load goes stale] → Parent reloads; acceptable for MVP.
- [Preview deployments use the production database] → The `name` column exists in a preview only after the migration is applied on merge; check rename on production right after merge (see `docs/factory-learnings.md`).
- [Client call failures] → Each Supabase call has a failure scenario: list error → `null` and the `load` message; rename and remove error or zero rows → `failed` message.
