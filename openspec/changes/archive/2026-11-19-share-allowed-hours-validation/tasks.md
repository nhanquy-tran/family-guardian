## 1. Shared
- [x] 1.1 Tests in `packages/shared/src/contracts.test.ts`
- [x] 1.2 Add `HHMM_PATTERN`, `AllowedHours`, `parseAllowedHours` to `contracts.ts`; use them in `RulesResponse`

## 2. Extension
- [x] 2.1 `hours.ts` uses the shared type and function; remove the local pattern and type

## 3. Web
- [x] 3.1 `allowed-hours.ts` uses `parseAllowedHours`; remove the local pattern
