#!/usr/bin/env bash
# Comments one agent step's cost, turns and duration on the issue or PR, with a hidden
# `<!-- factory-metrics {...} -->` line that the factory dashboard parses.
# Usage: post-metrics.sh <agent> <issue-or-pr-number> <execution_file>
# Never fails the job: metrics are evidence, not a gate.
set -uo pipefail

AGENT="$1"
NUMBER="$2"
FILE="${3:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then echo "No execution file for ${AGENT}, skipping metrics"; exit 0; fi

# The execution file is a JSON array of Claude Code messages (or JSON lines); the last `result` message has the totals.
RESULT=$(jq -cs '[.[] | (if type == "array" then .[] else . end) | select(type == "object" and .type == "result")] | last // empty' "$FILE")
if [ -z "$RESULT" ]; then echo "No result message in ${FILE}"; exit 0; fi

METRICS=$(jq -c \
  --arg agent "$AGENT" --arg number "$NUMBER" --arg workflow "$GITHUB_WORKFLOW" \
  --arg run "$GITHUB_RUN_ID" --arg attempt "$GITHUB_RUN_ATTEMPT" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{agent: $agent, number: ($number | tonumber), workflow: $workflow, run_id: ($run | tonumber),
    run_attempt: ($attempt | tonumber), at: $at, cost_usd: (.total_cost_usd // 0), turns: (.num_turns // 0),
    duration_ms: (.duration_ms // 0), is_error: (.is_error // false)}' <<< "$RESULT")

SUMMARY=$(jq -r '"Factory metrics: **\(.agent)** · $\(.cost_usd * 100 | round / 100) · \(.turns) turns · \(.duration_ms / 60000 * 10 | round / 10) min"' <<< "$METRICS")
RUN_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
printf '%s · [run](%s)\n\n<!-- factory-metrics %s -->\n' "$SUMMARY" "$RUN_URL" "$METRICS" > /tmp/metrics-comment.md

echo "$SUMMARY" >> "$GITHUB_STEP_SUMMARY"
gh issue comment "$NUMBER" --repo "$GITHUB_REPOSITORY" --body-file /tmp/metrics-comment.md || echo "Could not post metrics comment"
