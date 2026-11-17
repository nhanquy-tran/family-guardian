#!/usr/bin/env bash
# Fails if a PR adds a migration whose version is not newer than every migration on main,
# or if two migrations share a version (Supabase rejects both on push).
set -euo pipefail
git fetch -q origin main
DUP=$(ls supabase/migrations/ | cut -d_ -f1 | sort | uniq -d)
[ -n "$DUP" ] && { echo "::error::Duplicate migration version(s): $DUP"; exit 1; }
LATEST_MAIN=$(git ls-tree --name-only origin/main supabase/migrations/ | xargs -n1 basename | cut -d_ -f1 | sort | tail -1)
NEW=$(git diff --name-only --diff-filter=A origin/main...HEAD -- supabase/migrations/ | xargs -r -n1 basename | cut -d_ -f1)
for v in $NEW; do
  if [ "$v" \< "$LATEST_MAIN" ] || [ "$v" = "$LATEST_MAIN" ]; then
    echo "::error::Migration $v is not newer than the latest on main ($LATEST_MAIN). Rename it with: date -u +%Y%m%d%H%M%S"; exit 1
  fi
done
echo "Migrations OK (latest on main: ${LATEST_MAIN:-none}; new: ${NEW:-none})"
