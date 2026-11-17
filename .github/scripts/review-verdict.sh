#!/usr/bin/env bash
# Mirrors the reviewer's latest verdict comment on a PR as the `factory/review` commit status and the
# `review-changes-needed` label, so the verdict is visible where the human merges.
# Usage: review-verdict.sh <pr-number>   Env: GH_TOKEN, GITHUB_REPOSITORY, RUN_URL, HEAD_SHA (optional)
set -uo pipefail

PR="$1"
REPO="$GITHUB_REPOSITORY"
BODY=$(gh api "repos/${REPO}/issues/${PR}/comments?per_page=100" \
  --jq '[.[] | select(.user.login == "github-actions[bot]" and (.body | test("Verdict:|factory-review")))] | last | .body // ""')

JSON=$(grep -o '<!-- factory-review {[^}]*} -->' <<< "$BODY" | tail -1 | sed 's/^<!-- factory-review //; s/ -->$//')
COUNTS=""
if [ -n "$JSON" ] && VERDICT=$(jq -er '.verdict' <<< "$JSON" 2>/dev/null); then
  COUNTS=$(jq -r '"\(.high // 0) high, \(.medium // 0) medium, \(.low // 0) low"' <<< "$JSON")
elif grep -qiE 'verdict:[* ]*changes needed' <<< "$BODY"; then VERDICT="changes-needed"
elif grep -qiE 'verdict:[* ]*looks good' <<< "$BODY"; then VERDICT="looks-good"
else VERDICT="unknown"; fi

case "$VERDICT" in
  looks-good) STATE=success; DESC="AI review: looks good" ;;
  changes-needed) STATE=failure; DESC="AI review: changes needed${COUNTS:+ ($COUNTS)}" ;;
  *) STATE=error; DESC="AI review: no verdict found" ;;
esac

SHA="${HEAD_SHA:-$(gh pr view "$PR" --repo "$REPO" --json headRefOid -q .headRefOid)}"
gh api "repos/${REPO}/statuses/${SHA}" -f state="$STATE" -f context="factory/review" \
  -f description="$DESC" -f target_url="${RUN_URL:-}" > /dev/null || echo "Could not set the status"

gh label create review-changes-needed --repo "$REPO" --color D93F0B \
  --description "AI reviewer asked for changes on the latest commit" > /dev/null 2>&1 || true
if [ "$VERDICT" = "changes-needed" ]; then
  gh pr edit "$PR" --repo "$REPO" --add-label review-changes-needed > /dev/null || true
else
  gh pr edit "$PR" --repo "$REPO" --remove-label review-changes-needed > /dev/null 2>&1 || true
fi

echo "$DESC" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
