# Proposal

Implements GitHub issue #13 ("Devices page: online status and last seen").

## Why

Parents need to see whether each child's laptop is still reporting, give devices a recognisable name, and remove an old laptop so its token stops working. `/dashboard/devices` is only a placeholder (issue #8).

## What Changes

- `/dashboard/devices` lists devices grouped by child. Each row shows the device name (or a default like "Chrome on Windows"), browser, OS, extension version, "last seen" as relative time ("2 min ago") and a status badge: **Online** when last seen less than 3 minutes ago, otherwise **Offline**.
- A parent can rename a device (1 to 40 characters) and remove it. Remove first shows a confirmation naming the device and the child and warning that the device's usage history is deleted, with Cancel and Confirm (server-rendered, no client JS). Confirming deletes the device row, so its token hash is gone and the device token no longer matches any device (the heartbeat route, issue #10, then answers 401).
- New migration adding only `devices.name` (nullable, 1 to 40 characters) with its select grant. Parents may update only `name`, only for their own family's devices; all other device columns stay service-role-only. `devices.extension_version` already exists (and is selectable by parents) from `20261117100000_heartbeat.sql` (#10); this change reads it and does not create it.
- Pure helpers for status and relative time, a data loader and rename/remove functions that take a Supabase client, all unit-tested with fakes. Schema rules tested on PGlite with the existing harness. Uses the existing server client `apps/web/src/lib/supabase/server.ts`; no service-role client (`admin.ts`) is used.

## Capabilities

### New Capabilities

- `device-management`: device list with online status and last seen, rename, remove.

### Modified Capabilities

None (the `database-schema` capability is not archived yet; this change adds its own migration and tests).

## Impact

- New migration `supabase/migrations/20261117120000_devices_name.sql`, building on `20261117000000_initial_schema.sql` (devices table, select grant, delete policy) and `20261117100000_heartbeat.sql` (`extension_version`), plus `supabase/tests/devices.test.ts`.
- New files under `apps/web/src/lib/devices/`, `apps/web/src/components/device-list.tsx`, `apps/web/src/app/dashboard/devices/` (page and server actions).
- `docs/architecture.md` data model: `devices` gains `name` (`extension_version` is already documented by #10).
- No new dependencies. No new data collected from the child: `extensionVersion` is already part of `HeartbeatRequest`; this change only displays the column that #10 already added.
- Depends on #7 (schema, harness), #8 (dashboard shell) and #10 (`extension_version` column) being merged; all are already on `main`.

## Out of scope

- Writing `last_seen_at`, `browser` and `extension_version` from the heartbeat, and returning 401 for unknown tokens (issue #10).
- Pairing a new device (issue #9); the page only links to the Children page.
- Auto-refreshing the page; status is computed when the page loads.
- Offline e-mail alerts (ADR 0010) and the "usual hours" logic.
- Keeping usage history of a removed device (it is deleted with the device).
- Clearing a custom name back to the default; moving a device to another child.
