# Design

- **Local usage store**: `limitUsage = { day: "YYYY-MM-DD", seconds: { [category]: number }, domains: { [domain]: category } }` in `chrome.storage.local`. In `alarmNormal`, entries taken from the tracker (`takeCompletedEntries`) are added with `addUsage` before they are queued, so counting does not depend on the heartbeat (offline works). Only entries whose minute falls on today's family-timezone day count. A stored `day` different from today resets the usage.
- **Day key**: `dayKey(ms, timezone)` uses `Intl.DateTimeFormat("en-CA", { timeZone })`; a missing or invalid timezone falls back to `UTC`. Midnight is detected by the 1-minute alarm (up to a minute late).
- **Inputs persisted by `syncRules`**: `rulesLimits`, `rulesTimezone`, `rulesOverrides`, stored with `rulesDomains` and `rulesVersion` only after a successful DNR update. A failed sync stores nothing, so the last limits keep working.
- **Evaluation on every normal alarm** (after counting and any sync): compute `limitBlocked: { [domain]: category }` from stored limits, usage and overrides; if it differs from the stored value, call `applyRules`, then store `limitBlocked`. If `updateDynamicRules` fails, store nothing and retry at the next alarm.
- **Domain set of a category** (`limitBlockDomains`): seed domains (`SEED_CATEGORIES`) and override keys kept only when `categorize(domain, overrides)` equals the category, plus domains seen today in that category (`limitUsage.domains`, domain names only, reset daily). Domains in `rulesDomains` are excluded (manual rule wins); total rules stay within `MAX_RULE_DOMAINS`, manual first.
- **Rules**: manual rules keep ids `1..n` from `buildRules`; limit rules take the following ids (`buildLimitRules`, redirect to `/blocked.html?d=<domain>&c=<category>`). `applyRules` gets an optional third argument (default none) so existing callers and tests are unchanged.
- **Block page**: pure `describeBlock(search)` in `lib/blocked.ts`; `c` is shown only if it is one of `CATEGORIES`, otherwise the generic text. No URL is read.
- **Rules API**: `categoryOverrides` is the merged global+family map already built for `expandBlockRules` (family wins), via the existing `listCategoryOverrides`; capped at `MAX_RULE_DOMAINS` with family rows first. No new store method. Keys are `z.string().max(253)`.
- **Sync keeps limit blocks**: `applyRules` removes every dynamic rule, so `syncRules` also computes the limit rules and stores `limitBlocked` from the same update. The first limit rule id is the count of valid manual rules plus 1. A missing stored `limitBlocked` counts as `{}`.
- **Lag**: enforcement lags up to 2 minutes (the current minute is not counted); accepted.
- **Rejected device (401)**: no evaluation runs, so limit blocks do not reset at midnight until the device recovers.
- **Re-pairing** also removes the new limit keys.
- No ADR: nothing new is sent or stored on the server.
