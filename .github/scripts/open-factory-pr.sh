#!/usr/bin/env bash
# Commits remaining work, pushes the factory branch and opens or updates the PR with the gate evidence.
# Env: ISSUE CHANGE STARTED TESTS_SHA GUARD GATE RED GREEN COVERAGE MODEL RUN_URL
set -euo pipefail

git add -A
git diff --cached --quiet || git commit -m "feat: ${CHANGE} (#${ISSUE})"
# Rebase onto the latest main so the branch never carries an older copy of files changed on main
# meanwhile (GitHub rejects pushes that appear to edit workflow files without the workflow scope).
git fetch -q origin main
if ! git rebase -q origin/main; then
  git rebase --abort
  gh issue comment "$ISSUE" --body "Factory: the build could not be rebased onto main (conflict). Needs a human."
  gh issue edit "$ISSUE" --remove-label in-progress --add-label needs-human
  exit 1
fi
git push -u origin "factory/${ISSUE}" --force-with-lease

MINUTES=$(( ( $(date +%s) - STARTED ) / 60 ))
TITLE=$(gh issue view "$ISSUE" --json title -q .title)
NOTES_FILE="openspec/changes/${CHANGE}/NOTES.md"

{
  echo "Closes #${ISSUE}"
  echo
  echo "OpenSpec change: \`openspec/changes/${CHANGE}\`"
  echo
  echo "## Evidence"
  echo "| Gate | Result |"
  echo "|---|---|"
  echo "| Tests written first by a separate agent | commit ${TESTS_SHA:-none} |"
  echo "| Tests not weakened by the developer | ${GUARD:-not run} |"
  echo "| Eval: tests fail before implementation | ${RED:-not run} |"
  echo "| Eval: every scenario has a test with its title | ${COVERAGE:-not run} |"
  echo "| Eval: same tests pass after implementation | ${GREEN:-not run} |"
  echo "| npm run check + build | ${GATE:-not run} |"
  echo "| Model / wall time | ${MODEL} / ${MINUTES} min |"
  echo "| Run | ${RUN_URL} |"
  echo
  cat /tmp/evals.md 2>/dev/null || true
  echo
  echo "## Developer notes"
  if [ -f "$NOTES_FILE" ]; then cat "$NOTES_FILE"; else echo "_No notes written._"; fi
  echo
  echo "<details><summary>Gate output (last lines)</summary>"
  echo
  echo '```'
  cat /tmp/gate-tail.txt 2>/dev/null || echo "no output"
  echo '```'
  echo "</details>"
} > /tmp/pr-body.md

LABELS="factory"
for RESULT in "${GUARD:-}" "${GATE:-}" "${RED:-}" "${GREEN:-}" "${COVERAGE:-}"; do
  case "$RESULT" in pass*) ;; *) LABELS="factory,needs-human" ;; esac
done

OPEN_PR=$(gh pr list --head "factory/${ISSUE}" --state open --json number -q '.[0].number')
if [ -n "$OPEN_PR" ]; then
  gh pr edit "$OPEN_PR" --body-file /tmp/pr-body.md --add-label "$LABELS"
else
  gh pr create --title "feat: ${TITLE} (#${ISSUE})" --body-file /tmp/pr-body.md \
    --label "$LABELS" --base main --head "factory/${ISSUE}"
fi

gh issue edit "$ISSUE" --remove-label in-progress --add-label in-review
echo "| #${ISSUE} | ${CHANGE} | guard: ${GUARD:-n/a} | gate: ${GATE:-n/a} | ${MINUTES} min |" >> "$GITHUB_STEP_SUMMARY"
