import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// live-core.js is a plain browser script; load it the way the page does, with a CommonJS-style module object.
const mod = { exports: {} };
new Function("module", readFileSync(new URL("./live-core.js", import.meta.url), "utf8"))(mod);
const { LIVE_MS, liveInterval, visibleRuns, runningText, waitingText, keepPolling } = mod.exports;

const short = (ms) => `${Math.round(ms / 1000)}s`;
const run = (over) => ({ name: "Factory 3: build #87", status: "in_progress", stepName: "Developer agent", stepStart: 0, hidden: false, ...over });
const issue = (labels, state = "open") => ({ state, labels: labels.map((name) => ({ name })) });

describe("liveInterval", () => {
  it("polls every 5 seconds with a token", () => {
    expect(liveInterval(true)).toBe(5000);
    expect(LIVE_MS).toBe(5000);
  });

  it("does not poll without a token, so the 60 calls per hour are not used up", () => {
    expect(liveInterval(false)).toBeNull();
  });
});

describe("visibleRuns", () => {
  it("hides on-demand runs that skip themselves", () => {
    expect(visibleRuns([run({ name: "Claude on demand", hidden: true }), run({})]).map((r) => r.name)).toEqual(["Factory 3: build #87"]);
  });

  it("hides queued runs behind a running run of the same workflow", () => {
    const review = run({ name: "Factory 4: AI review", stepName: "Stage 1: spec compliance" });
    const queued = run({ name: "Factory 4: AI review", status: "queued" });
    expect(visibleRuns([queued, review, queued])).toEqual([review]);
  });

  it("keeps a queued run when nothing of its workflow is running", () => {
    const queued = run({ name: "Factory 4: AI review", status: "queued" });
    expect(visibleRuns([queued])).toEqual([queued]);
  });
});

describe("runningText", () => {
  it("names the workflow, the step and how long it has run", () => {
    expect(runningText([run({ stepStart: 1000 })], 121000, short)).toBe("Factory 3: build #87: Developer agent (120s)");
  });

  it("shows queued runs by status and drops duplicates", () => {
    const queued = run({ name: "Factory 4: AI review", status: "queued" });
    expect(runningText([queued, queued], 0, short)).toBe("Factory 4: AI review: queued");
  });
});

describe("waitingText", () => {
  it("describes the waiting state from the issue's label", () => {
    expect(waitingText(issue(["area:web", "in-review"]))).toBe("Build PR waiting for AI review and the build gate");
  });

  it("prefers needs-human over an earlier state", () => {
    expect(waitingText(issue(["in-progress", "needs-human"]))).toBe("Needs a human: a gate failed or an agent has a question");
  });

  it("says done for a closed issue and handles unknown issues", () => {
    expect(waitingText(issue(["in-review"], "closed"))).toBe("Done");
    expect(waitingText(issue(["bug"]))).toBe("Not in the factory yet");
    expect(waitingText(undefined)).toBe("Not in the factory yet");
  });
});

describe("keepPolling", () => {
  it("keeps polling an open issue", () => {
    expect(keepPolling(issue(["in-review"]), [])).toBe(true);
  });

  it("keeps polling a closed issue while one of its runs is still going", () => {
    expect(keepPolling(issue([], "closed"), [run({})])).toBe(true);
  });

  it("stops once the issue is closed and nothing runs", () => {
    expect(keepPolling(issue([], "closed"), [])).toBe(false);
  });
});
