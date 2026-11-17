#!/usr/bin/env bash
# Commits remaining work, pushes the factory branch and opens or updates the PR with the gate evidence.
# Env: ISSUE CHANGE STARTED TESTS_SHA GUARD GATE MODEL RUN_URL
set -euo pipefail

git add -A
git diff --cached --quiet || git commit -m "feat: ${CHANGE} (#${ISSUE})"
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
  echo "| npm run check + build | ${GATE:-not run} |"
  echo "| Model / wall time | ${MODEL} / ${MINUTES} min |"
  echo "| Run | ${RUN_URL} |"
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
if [ "${GUARD:-}" != "pass" ] || [ "${GATE:-}" != "pass" ]; then LABELS="factory,needs-human"; fi

if gh pr view "factory/${ISSUE}" > /dev/null 2>&1; then
  gh pr edit "factory/${ISSUE}" --body-file /tmp/pr-body.md --add-label "$LABELS"
else
  gh pr create --title "feat: ${TITLE} (#${ISSUE})" --body-file /tmp/pr-body.md \
    --label "$LABELS" --base main --head "factory/${ISSUE}"
fi

gh issue edit "$ISSUE" --remove-label in-progress --add-label in-review
echo "| #${ISSUE} | ${CHANGE} | guard: ${GUARD:-n/a} | gate: ${GATE:-n/a} | ${MINUTES} min |" >> "$GITHUB_STEP_SUMMARY"
