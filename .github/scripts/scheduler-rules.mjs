// Pure rules of the factory scheduler, kept apart so they can be tested without gh or git.

// on-hold comes first: an issue on hold is never started, whatever else it is labelled.
export const STATE_LABELS = ["on-hold", "needs-spec", "spec-in-progress", "spec-review", "ready", "build-now", "in-progress", "in-review", "needs-human"];

export function parseRefs(text, key) {
  const line = (text || "").split("\n").find((l) => l.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  if (!line) return [];
  return line.slice(key.length + 1).split(/[,\s]+/).map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== "none");
}

export function stateOf(labelNames) {
  return STATE_LABELS.find((l) => labelNames.includes(l)) || "new";
}

// The approved spec can add dependencies the issue body does not list (#140 depended on #143 only in its proposal).
export function dependsOn(issueBody, proposal) {
  const numbers = [...parseRefs(issueBody, "Depends on"), ...parseRefs(proposal, "Depends on")]
    .map((d) => Number(d.replace("#", "")))
    .filter(Boolean);
  return [...new Set(numbers)].sort((a, b) => a - b);
}
