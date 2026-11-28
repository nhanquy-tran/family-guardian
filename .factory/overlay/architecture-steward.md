
## Family Guardian rules

- Drift to check first: privacy (ADR 0005), RLS on every table limited to the parent's family, hashed device tokens, contracts in `packages/shared`.
- Cross-feature state to check: pause, limits, allowed hours, offline devices, several browsers per child.
- This is an MVP for 20 families: no new services, libraries or frameworks unless a finding needs one.
