"use strict";

// Rules of the live issue refresh and the cost KPIs, kept free of the DOM and the network so they can be unit-tested.
// Loaded as a plain script before app.js (window.LiveCore) and by live-core.test.mjs (module.exports).
(function (root) {
  // With a token the popup polls every 5 s. Without one GitHub allows 60 calls an hour, which one poll
  // every few seconds (5–7 calls) would use up and break the whole dashboard, so it only updates on request.
  const LIVE_MS = 5000;

  const WAITING = {
    "needs-spec": "Waiting for the spec writer to start",
    "spec-in-progress": "Spec writer is starting",
    "spec-review": "Spec PR waiting for AI review and the spec gate",
    ready: "Spec approved, waiting for a build",
    "build-now": "Build requested, waiting for a runner",
    "in-progress": "Build is starting",
    "in-review": "Build PR waiting for AI review and the build gate",
    "needs-human": "Needs a human: a gate failed or an agent has a question",
    "on-hold": "On hold",
  };
  // Later labels win when an issue has several.
  const LABEL_ORDER = ["needs-spec", "spec-in-progress", "spec-review", "ready", "in-progress", "in-review", "needs-human", "build-now", "on-hold"];

  function liveInterval(hasToken) {
    return hasToken ? LIVE_MS : null;
  }

  // Drops the "Claude on demand" runs that every comment starts and that skip themselves, and queued runs
  // waiting behind a running one of the same workflow (concurrency group).
  function visibleRuns(found) {
    const shown = found.filter((r) => !r.hidden);
    const busy = new Set(shown.filter((r) => r.status === "in_progress").map((r) => r.name));
    return shown.filter((r) => r.status === "in_progress" || !busy.has(r.name));
  }

  function runningText(runs, now, short) {
    const parts = runs.map((r) => (r.status === "in_progress"
      ? `${r.name}: ${r.stepName} (${short(now - r.stepStart) || "0s"})`
      : `${r.name}: ${r.status}`));
    return [...new Set(parts)].join(" · ");
  }

  function waitingText(issue) {
    if (!issue) return "Not in the factory yet";
    if (issue.state === "closed") return "Done";
    const names = (issue.labels || []).map((l) => l.name);
    const label = [...LABEL_ORDER].reverse().find((l) => names.includes(l));
    return WAITING[label] || "Not in the factory yet";
  }

  // Nothing changes on a closed issue once its last run has ended.
  function keepPolling(issue, runs) {
    return !issue || issue.state !== "closed" || runs.length > 0;
  }

  // Rework: fix rounds (fixer, debugger) plus every run of a writer step after its first (rebuilds, rewrites).
  // Reviews are not rework: they rerun by design after each push.
  const FIX_STEPS = ["spec-fix", "build-fix"];
  const WRITER_STEPS = ["spec", "tests", "dev", "verify"];
  function reworkCost(acts) {
    const seen = new Set();
    let sum = 0;
    for (const a of [...acts].sort((x, y) => x.start - y.start)) {
      if (FIX_STEPS.includes(a.step)) sum += a.cost || 0;
      else if (WRITER_STEPS.includes(a.step)) {
        if (seen.has(a.step)) sum += a.cost || 0;
        seen.add(a.step);
      }
    }
    return sum;
  }

  // Older metrics comments have no `denied` field; they are left out of the average.
  function deniedPerRun(metrics) {
    const runs = metrics.filter((m) => Array.isArray(m.denied));
    return runs.length ? runs.reduce((s, m) => s + m.denied.length, 0) / runs.length : null;
  }

  const api = { LIVE_MS, liveInterval, visibleRuns, runningText, waitingText, keepPolling, reworkCost, deniedPerRun };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LiveCore = api;
})(typeof window !== "undefined" ? window : globalThis);
