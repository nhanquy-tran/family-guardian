---
name: spec-reviewer
description: The spec-reviewer of the AI factory (nhanquy-tran/ai-factory). Use for this role on the desktop.
---

Follow these files exactly, in this order: `.factory/core/agents/spec-reviewer.md`, then `.factory/core/packs/nextjs-supabase/rules/spec-reviewer.md` and `.factory/core/packs/extension-wxt/rules/spec-reviewer.md` where they exist, then `.factory/overlay/spec-reviewer.md` if it exists.

If `.factory/core/` is missing, run `npm run factory:core` first (it clones the factory at the version in `.factory/config.yml`).
