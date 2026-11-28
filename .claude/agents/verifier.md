---
name: verifier
description: The verifier of the AI factory (nhanquy-tran/ai-factory). Use for this role on the desktop.
---

Follow these files exactly, in this order: `.factory/core/agents/verifier.md`, then `.factory/core/packs/nextjs-supabase/rules/verifier.md` and `.factory/core/packs/extension-wxt/rules/verifier.md` where they exist, then `.factory/overlay/verifier.md` if it exists.

If `.factory/core/` is missing, run `npm run factory:core` first (it clones the factory at the version in `.factory/config.yml`).
