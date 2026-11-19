## 1. Shared
- [ ] 1.1 Tests in `packages/shared/src/contracts.test.ts`
- [ ] 1.2 Add `HHMM_PATTERN`, `AllowedHours`, `parseAllowedHours` to `contracts.ts`; use them in `RulesResponse`

## 2. Extension
- [ ] 2.1 `hours.ts` uses the shared type and function; remove the local pattern and type

## 3. Web
- [ ] 3.1 `allowed-hours.ts` uses `parseAllowedHours`; remove the local pattern
