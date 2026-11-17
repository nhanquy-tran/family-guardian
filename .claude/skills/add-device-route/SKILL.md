---
name: add-device-route
description: Add or change an API route called by the browser extension (device token auth, contracts, fail-closed errors). Use for anything under apps/web/src/app/api/device/.
---

1. **Contract first**: request and response zod schemas in `packages/shared/src/contracts.ts` (or a sibling module); the extension builds requests from them. Validate the envelope as a whole and list items one by one (skip invalid items, never fail a whole batch for one item); cap sizes and answer `413` above the cap.
2. **Handler** in `apps/web/src/lib/device/<name>.ts` as a pure function taking `{ authorization, rawBody/now, store }`; the route in `apps/web/src/app/api/device/<name>/route.ts` only wires the request, `createAdminClient()` and the store.
3. **Auth before body**: `Bearer <token>` (scheme case-insensitive, exactly one token) → `hashDeviceToken` → lookup; unknown or malformed → `401 { error: "unauthorized" }`.
4. **Fail closed**: store errors, thrown errors and missing env → `500 { error: "server_error" }` with no detail; wrap `createAdminClient()` in the try.
5. **Privacy**: store only what ADR 0005 allows; logs carry counts only (no domains, tokens, IPs).
6. **Tests**: handler tests with a fake store for every scenario (401, 400, 413, 500, success, idempotent resend); export only the HTTP methods the spec names (others give 405).
7. Update `apps/extension` callers in the same change if the contract changes.
