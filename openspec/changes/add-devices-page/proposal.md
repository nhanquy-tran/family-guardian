# Proposal

Implements GitHub issue #13 ("Devices page: online status and last seen").

## Why

Parents need to see whether each child's laptop is still reporting, give devices a recognisable name, and remove an old laptop so its token stops working. `/dashboard/devices` is only a placeholder (issue #8).

## What Changes

- `/dashboard/devices` lists devices grouped by child. Each row shows the device name (or a default like "Chrome on Windows"), browser, OS, extension version, "last seen" as relative time ("2 min ago") and a status badge: **Online** when last seen less than 3 minutes ago, otherwise **Offline**.
- A parent can rename a device (1 to 40 characters) and remove it. Removing deletes the device row, so its token hash is gone and the device token no longer matches any device (the heartbeat route, issue #10, then answers 401).
- New migration adding `devices.name` and `devices.extension_version` (both nullable). Parents may update only `name`, only for their own family's devices; all other device columns stay service-role-only.
- Pure helpers for status and relative time, a data loader and rename/remove functions that take a Supabase client, all unit-tested with fakes. Schema rules tested on PGlite with the existing harness.

## Capabilities

### New Capabilities

- `device-management`: device list with online status and last seen, rename, remove.

### Modified Capabilities

None (the `database-schema` capability is not archived yet; this change adds its own migration and tests).

## Impact

- New migration `supabase/migrations/20261117120000_devices_name_and_version.sql` and `supabase/tests/devices.test.ts`.
- New files under `apps/web/src/lib/devices/`, `apps/web/src/components/device-list.tsx`, `apps/web/src/app/dashboard/devices/` (page and server actions).
- `docs/architecture.md` data model: `devices` gains `name`, `extension_version`.
- No new dependencies. No new data collected from the child: `extensionVersion` is already part of `HeartbeatRequest`; this change only adds a place to store it (see design.md).
- Depends on #7 (schema, harness) and #8 (dashboard shell, Supabase server client) being merged first.

## Out of scope

- Writing `last_seen_at`, `browser` and `extension_version` from the heartbeat, and returning 401 for unknown tokens (issue #10).
- Pairing a new device (issue #9); the page only links to the Children page.
- Auto-refreshing the page; status is computed when the page loads.
- Offline e-mail alerts (ADR 0010) and the "usual hours" logic.
- Keeping usage history of a removed device (it is deleted with the device).
- Clearing a custom name back to the default; moving a device to another child.
