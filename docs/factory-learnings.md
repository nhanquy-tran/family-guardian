# Factory learnings

The factory's learn loop (Zühlke AI Factory: "every accepted result improves agents and knowledge"). Each entry records what went wrong or was caught late, and the rule it became. Agents read this file; rules that matter for every change are also copied into the agent role files in `.claude/agents/`.

Add an entry whenever a human gate or a reviewer catches something an earlier step should have caught.

| Date | What happened | Caught by | Rule added (where) |
|---|---|---|---|
| 2026-11-17 | Build for #7 picked #8's change because #8's proposal mentions "#7" as a dependency. All gates passed on the wrong code. | Human (file list) | Build finds the change by its spec commit (`factory-build.yml`). Reviewer checks the PR implements the linked issue's change (`reviewer.md`). |
| 2026-11-17 | Rebuild reused a closed PR for the same branch instead of opening a new one. | Human | Only reuse an open PR (`open-factory-pr.sh`). |
| 2026-11-17 | Reviewer could not post: file writes and heredoc/pipe shell commands were denied. | Dashboard "no verdict" | Reviewer posts with a single `gh pr comment --body` (`reviewer.md`). |
| 2026-11-17 | Spec #9 stored a hash of the caller IP without an ADR (ADR 0005 requires one for any new stored data); plain SHA-256 of an IPv4 address is reversible. | Reviewer + human | Spec writer: any new stored or logged data needs a proposed ADR; hash identifiers with a keyed HMAC, never plain hashes (`spec-writer.md`). |
| 2026-11-17 | Spec #9 had no scenario for a failing rate-limit store, so it could fail open. | Reviewer | Spec writer: every external dependency call gets a failure scenario; security controls fail closed (`spec-writer.md`). |
| 2026-11-17 | Spec #9 left earlier pairing codes valid when a new one was created. | Human | Spec writer: creating a new secret/code/token revokes the ones it supersedes (`spec-writer.md`). |
| 2026-11-17 | Spec #9 deleted a child (cascading devices and history) with one click. | Reviewer + human | Spec writer: destructive actions need a confirmation step that names what is deleted (`spec-writer.md`). |
| 2026-11-17 | First real migration did not apply: the Supabase CLI asks for confirmation and CI has no terminal; the job failed but nothing changed. The fix did not re-run because the workflow only triggered on `supabase/**`. | Human (merge) + CI | `db push --yes`; the workflow also triggers on its own file (`supabase-migrate.yml`). Test infra workflows with a real change before relying on them. |
| 2026-11-17 | Build #8 passed every gate but its push was rejected: main changed a workflow file during the build, so the stale branch looked like a workflow edit, which `FACTORY_TOKEN` may not make. The work was lost and had to be rebuilt. | CI | Rebase the factory branch onto the latest main before pushing; on conflict, label `needs-human` (`open-factory-pr.sh`). |
