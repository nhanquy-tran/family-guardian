#!/usr/bin/env bash
# Factory watchdog: restarts stalled agent runs and unblocks conflicting factory/spec PRs.
# Env: GH_TOKEN (FACTORY_TOKEN: pushes and comments that trigger workflows), RUN_TOKEN (GITHUB_TOKEN: Actions API). Runs in a checkout with full history.
set -uo pipefail

MAX_RUN_MIN=${MAX_RUN_MIN:-60}     # a run older than this is checked for progress
STALL_MIN=${STALL_MIN:-30}         # no step finished for this long = stalled
MAX_RESTARTS=${MAX_RESTARTS:-2}
NOW=$(date -u +%s)
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/stdout}
echo "## Factory watchdog $(date -u +%FT%TZ)" >> "$SUMMARY"

age_min() { echo $(( (NOW - $(date -u -d "$1" +%s)) / 60 )); }

restart_count() {  # number of earlier watchdog restarts noted on an issue
  gh issue view "$1" --json comments -q '[.comments[].body | select(test("<!-- watchdog-restart -->"))] | length' 2>/dev/null || echo 0
}

# 1. Stalled agent runs: cancel and re-dispatch (bounded), else hand to a human.
for WF in factory-spec.yml factory-build.yml; do
  GH_TOKEN=$RUN_TOKEN gh run list --workflow "$WF" --status in_progress --limit 20 \
    --json databaseId,createdAt,displayTitle -q '.[] | "\(.databaseId)\t\(.createdAt)\t\(.displayTitle)"' |
  while IFS=$'\t' read -r RUN CREATED TITLE; do
    [ "$(age_min "$CREATED")" -lt "$MAX_RUN_MIN" ] && continue
    LAST=$(GH_TOKEN=$RUN_TOKEN gh run view "$RUN" --json jobs -q '[.jobs[].steps[] | (.completedAt // .startedAt) | select(. != null and . != "0001-01-01T00:00:00Z")] | max // empty')
    [ -n "$LAST" ] && [ "$(age_min "$LAST")" -lt "$STALL_MIN" ] && { echo "- run $RUN ($TITLE) is long but progressing" >> "$SUMMARY"; continue; }
    ISSUE=$(grep -oE '#[0-9]+' <<< "$TITLE" | head -1 | tr -d '#')
    GH_TOKEN=$RUN_TOKEN gh run cancel "$RUN" >/dev/null 2>&1
    echo "- cancelled stalled run $RUN ($TITLE)" >> "$SUMMARY"
    [ -z "$ISSUE" ] && continue
    if [ "$(restart_count "$ISSUE")" -ge "$MAX_RESTARTS" ]; then
      gh issue edit "$ISSUE" --remove-label in-progress --remove-label spec-in-progress --add-label needs-human >/dev/null
      gh issue comment "$ISSUE" --body "Factory watchdog: run $RUN stalled again after $MAX_RESTARTS restarts. Needs a human. <!-- watchdog-giveup -->" >/dev/null
    else
      gh issue comment "$ISSUE" --body "Factory watchdog: run $RUN made no progress for ${STALL_MIN}+ minutes; cancelled and restarted. <!-- watchdog-restart -->" >/dev/null
      sleep 20
      GH_TOKEN=$RUN_TOKEN gh workflow run "$WF" --ref main -f issue="$ISSUE" >/dev/null && echo "  restarted $WF for #$ISSUE" >> "$SUMMARY"
    fi
  done
done

# 2. Conflicting factory/spec PRs: GitHub runs no PR workflows on them, so they stall silently.
git config user.name "family-guardian-factory"
git config user.email "factory@users.noreply.github.com"
gh pr list --state open --limit 50 --json number,headRefName,mergeable \
  -q '.[] | select((.headRefName|test("^(factory|spec)/")) and .mergeable=="CONFLICTING") | "\(.number)\t\(.headRefName)"' |
while IFS=$'\t' read -r PR BRANCH; do
  git fetch -q origin "$BRANCH" main
  git checkout -q -B "wd-$PR" "origin/$BRANCH"
  if git merge -q --no-edit origin/main >/dev/null 2>&1; then
    git push -q origin "HEAD:$BRANCH" && echo "- PR #$PR: merged main cleanly and pushed" >> "$SUMMARY"
  else
    git merge --abort
    ASKED=$(gh pr view "$PR" --json comments -q '[.comments[].body | select(test("<!-- watchdog-conflict -->"))] | length')
    if [ "$ASKED" -eq 0 ]; then
      gh pr comment "$PR" --body "@claude This PR conflicts with main, so no checks run. Merge \`origin/main\` into this branch, resolve the conflicts keeping both sides' intent (main's merged changes win for files this PR did not mean to change), run \`npm run check\` and \`npm run build\`, and push. <!-- watchdog-conflict -->" >/dev/null
      echo "- PR #$PR: conflict, asked @claude to resolve" >> "$SUMMARY"
    else
      echo "- PR #$PR: conflict still open after a resolve request (human check)" >> "$SUMMARY"
    fi
  fi
done
