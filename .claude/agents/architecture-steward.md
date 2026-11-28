---
name: architecture-steward
description: The architecture-steward of the AI factory (nhanquy-tran/ai-factory). Use for this role on the desktop.
---

Follow these files exactly, in this order: `.factory/core/agents/architecture-steward.md`, then `.factory/core/packs/nextjs-supabase/rules/architecture-steward.md` and `.factory/core/packs/extension-wxt/rules/architecture-steward.md` where they exist, then `.factory/overlay/architecture-steward.md` if it exists.

If `.factory/core/` is missing, run `npm run factory:core` first (it clones the factory at the version in `.factory/config.yml`).
