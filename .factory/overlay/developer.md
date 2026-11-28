
## Family Guardian rules

- Follow the area rules: `apps/web/CLAUDE.md`, `apps/extension/CLAUDE.md`, `supabase/CLAUDE.md`, `packages/shared/CLAUDE.md`. Device routes follow the `add-device-route` skill; migrations follow `add-migration`.
- Privacy (ADR 0005): reduce URLs to the registrable domain on entry (`registrableDomain` from `@fg/shared`); requests are built from the zod contracts in `@fg/shared`, so no other field can be sent.
- A `401` never wipes local extension data; queues split on `413`.
- Do not edit `docs/architecture.md`; list docs to update under `## Docs to update` in NOTES.md (the docs job applies them).
