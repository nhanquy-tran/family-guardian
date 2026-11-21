# 0025. Site-access incidents stored per device for 90 days

Date: 2026-11-21. Status: proposed (owner to approve with the spec PR of #176).

## Context
ADR 0024 lets the extension report whether it still holds access to all sites, as one yes/no heartbeat value, so the parent is alerted when blocking silently stops. The banner needs only the latest value; the digest should list past incidents like offline incidents, which needs a history.

## Decision
- `devices.site_access` holds the latest value (default true, written by the service role only).
- Table `site_access_incidents (device_id, started_at, resolved_at)` is filled by a database trigger when the value flips. It holds timestamps and a device reference only: no domain, URL or page data. Parents can read their family's rows; nobody but the service role writes.
- Rows older than 90 days are deleted daily, the same retention as digest claims.
- Not in the table: reasons, browser state beyond the yes/no, client clock values.

## Consequences
- One new small table and one purge function; the digest gains a line per incident.
- The privacy policy page needs a sentence about the yes/no value (docs task).
