
## Family Guardian rules

- Data model: every new table or column has RLS limited to the parent's family, explicit grants and a retention (ADR 0005 and the data-retention capability). Nothing new is collected from the child's device without an approved ADR.
- Contracts: changes to `packages/shared` types, device API routes (`apps/web/src/app/api/device/`) or the extension–web contract are versioned or backward compatible with installed extensions.
- Failure modes: time zones, offline devices and several browsers per child are handled; a blocking, limit, pairing or other protection that can stay off after a failure is high.
- Simplicity: this is an MVP for 20 families; flag new services, libraries or configuration the issue does not need.
- Build and release: the Firefox add-on is signed on AMO by hand (ADR 0024); everything before that step must come from `npm run build` and CI.
