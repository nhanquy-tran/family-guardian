# Decisions (ADR index)

Open an ADR only when your change touches its subject. All accepted unless noted.

| ADR | Decision | Read it when you touch |
|---|---|---|
| [0001](0001-record-decisions.md) | Decisions are recorded as ADRs | anything structural |
| [0002](0002-extension-not-native-agent.md) | Browser extension + policy file, no native agent | install, tamper resistance |
| [0003](0003-stack.md) | Next.js, Supabase, Vercel, npm workspaces | dependencies, tooling |
| [0004](0004-google-sign-in-only.md) | Parents sign in with Google only | auth |
| [0005](0005-privacy-domain-and-time.md) | Collect only domain and time (amended: extension version) | anything the extension collects or sends |
| [0006](0006-ai-factory.md) | Factory: Claude Code Action, OpenSpec, GitHub Actions | factory workflows |
| [0007](0007-factory-auth-and-cost.md) | Factory uses a Console API key with a spend limit; no model gateway | factory cost, auth |
| [0008](0008-public-repo.md) | Public repo; agents run only for the owner | workflow triggers, secrets |
| [0009](0009-windows-first-chrome-web-store.md) | Windows first; Chrome Web Store, unlisted | store, permissions |
| [0010](0010-offline-alerts-pg-cron.md) | Offline detection with pg_cron (e-mail part superseded by 0016) | scheduled jobs |
| [0011](0011-supabase-migrations-ci.md) | Migrations applied by CI on merge | migrations |
| [0012](0012-rate-limit-ip-hmac.md) | Pairing rate limit with a keyed IP hash, 10 minutes | pairing, any IP data |
| [0013](0013-claude-as-delegated-gate.md) | Claude is the delegated spec and build gate | gates, merges |
| [0014](0014-factory-cost-tuning.md) | Sonnet specs, one review per PR, turn caps | factory cost |
| [0015](0015-self-fixing-factory.md) | Arbiter (now debugger), watchdog, platform notes | factory self-repair |
| [0016](0016-digest-emails.md) | Digest e-mails (daily 08:00 / weekly Monday) replace per-incident e-mails | alerts, e-mail, family settings |
| [0017](0017-factory-upgrade-specs-verify-scheduler.md) | Source-of-truth specs, verify gate, scheduler, two-stage review, debugger, hidden acceptance tests, hooks | factory workflows |
| [0018](0018-factory-light-mode.md) | Light mode (`FACTORY_MODE`): no hidden tests, verifier or spec-PR review, one review stage, lower turn caps; `full-mode` label per issue | factory cost, factory workflows |
