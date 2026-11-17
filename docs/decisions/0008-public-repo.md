# 0008. Public GitHub repository

Date: 2026-11-17. Status: accepted.

## Decision
The repo `nhanquy-tran/family-guardian` is public.

## Consequences
- Unlimited free GitHub Actions minutes for the factory.
- No secrets, personal data or real usage data may ever be committed. gitleaks runs in CI.
- Workflows that run Claude only trigger for the repo owner (`github.actor` check) so strangers cannot spend the API budget via issues or comments.
