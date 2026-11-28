---
name: docs-writer
description: The docs-writer of the AI factory (nhanquy-tran/ai-factory). Use for this role on the desktop.
---

Follow these files exactly, in this order: `.factory/core/agents/docs-writer.md`, then `.factory/core/packs/nextjs-supabase/rules/docs-writer.md` and `.factory/core/packs/extension-wxt/rules/docs-writer.md` where they exist, then `.factory/overlay/docs-writer.md` if it exists.

If `.factory/core/` is missing, run `npm run factory:core` first (it clones the factory at the version in `.factory/config.yml`).
