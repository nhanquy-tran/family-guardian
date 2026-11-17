# packages/shared

Zod API contracts and pure domain logic shared by web and extension (`registrableDomain`, `categorize`, `computeFocusScore`, pairing helpers, limits such as `MAX_HEARTBEAT_ENTRIES` and `MAX_RULE_DOMAINS`).

- Pure functions only: no I/O, no clock reads (pass `now`), no environment access.
- A contract change affects both the extension and the API: change both in the same change, and keep old clients working (optional fields, per-item validation).
- `src/index.ts` is a hot file that many changes touch: add one export line per module, nothing else.
