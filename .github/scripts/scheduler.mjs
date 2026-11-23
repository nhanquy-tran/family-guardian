// Factory scheduler (ADR 0017): starts specs and builds for `autopilot` issues in dependency order,
// never runs two changes that touch the same area, keeps at most FACTORY_MAX_PARALLEL agent jobs,
// and writes the "Factory state" issue that every new session reads first.
// Env: GH_TOKEN (owner PAT so label events trigger the router), GITHUB_REPOSITORY, MAX_PARALLEL, DRY_RUN.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { coveredBy, dependsOn, parseRefs, stateOf } from "./scheduler-rules.mjs";

const repo = process.env.GITHUB_REPOSITORY;
const maxParallel = Number(process.env.MAX_PARALLEL || 3);
const dryRun = process.env.DRY_RUN === "1";

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" }).trim();
const ghJson = (...args) => JSON.parse(gh(...args) || "null");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function changeFolderFor(issue) {
  try {
    const out = git("log", "-E", `--grep=^spec: .*\\(#${issue}\\)( \\(#[0-9]+\\))?$`, "--format=", "--name-only", "--", "openspec/changes");
    const counts = new Map();
    for (const path of out.split("\n")) {
      const m = path.match(/^openspec\/changes\/([^/]+)\//);
      if (m && m[1] !== "archive") counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  } catch {
    return null;
  }
}

function proposalFor(issue) {
  const change = changeFolderFor(issue);
  const proposal = change && `openspec/changes/${change}/proposal.md`;
  return proposal && existsSync(proposal) ? readFileSync(proposal, "utf8") : null;
}

const touchesFor = (issue) => parseRefs(proposalFor(issue), "Touches");

function activeAgentRuns() {
  let n = 0;
  for (const wf of ["factory-spec.yml", "factory-build.yml"]) {
    for (const status of ["in_progress", "queued"]) {
      n += ghJson("run", "list", "--repo", repo, "--workflow", wf, "--status", status, "--limit", "20", "--json", "databaseId").length;
    }
  }
  return n;
}

function addLabel(issue, label, reason, log) {
  log.push(`#${issue}: ${label} (${reason})`);
  if (!dryRun) gh("issue", "edit", String(issue), "--repo", repo, "--add-label", label);
}

const issues = ghJson("issue", "list", "--repo", repo, "--state", "all", "--limit", "200", "--json", "number,title,state,labels,body");
const byNumber = new Map(issues.map((i) => [i.number, { ...i, labelNames: i.labels.map((l) => l.name) }]));
const autopilot = [...byNumber.values()].filter((i) => i.state === "OPEN" && i.labelNames.includes("autopilot"));

const isDone = (n) => byNumber.get(n)?.state === "CLOSED";
const specApproved = (n) => isDone(n) || ["ready", "build-now", "in-progress", "in-review"].some((l) => byNumber.get(n)?.labelNames.includes(l));

// Hand-made PRs (open or merged) that close an autopilot issue: the factory leaves those issues alone.
const prs = ghJson("pr", "list", "--repo", repo, "--state", "all", "--limit", "100", "--json", "number,headRefName,state,body");

let active = activeAgentRuns();
// Areas of builds that run or have an unmerged PR: a second build there would conflict on rebase (#89).
const busyTouches = new Set(
  [...byNumber.values()].filter((i) => i.state === "OPEN" && (i.labelNames.includes("in-progress") || i.labelNames.includes("in-review"))).flatMap((i) => touchesFor(i.number)),
);
const actions = [];
const rows = [];

for (const issue of autopilot.sort((a, b) => a.number - b.number)) {
  const deps = dependsOn(issue.body, proposalFor(issue.number));
  const state = stateOf(issue.labelNames);
  let note = "";
  const covering = ["new", "ready"].includes(state) ? coveredBy(issue.number, prs) : null;

  if (covering) note = `covered by PR #${covering}: no factory work started`;
  else if (state === "new") {
    const waiting = deps.filter((d) => !specApproved(d));
    if (waiting.length) note = `waits for specs of ${waiting.map((d) => `#${d}`).join(", ")}`;
    else if (active >= maxParallel) note = "queued: parallel limit";
    else { addLabel(issue.number, "needs-spec", "dependencies specified", actions); active++; note = "spec started"; }
  } else if (state === "ready") {
    const waiting = deps.filter((d) => !isDone(d));
    const touches = touchesFor(issue.number);
    const clash = touches.filter((t) => busyTouches.has(t));
    if (waiting.length) note = `waits for ${waiting.map((d) => `#${d}`).join(", ")} to be merged`;
    else if (clash.length) note = `waits: ${clash.join(", ")} is being changed by another build`;
    else if (active >= maxParallel) note = "queued: parallel limit";
    else {
      addLabel(issue.number, "build-now", "dependencies merged, no overlap", actions);
      touches.forEach((t) => busyTouches.add(t));
      active++;
      note = "build started";
    }
  } else if (state === "spec-review" || state === "in-review") note = "waiting for the gate (Claude or owner)";
  else if (state === "needs-human") note = "needs the owner";
  else if (state === "on-hold") note = "on hold: nothing is started";
  rows.push(`| #${issue.number} | ${issue.title.replace(/\|/g, "/").slice(0, 70)} | ${state} | ${deps.map((d) => `#${d}${isDone(d) ? " ✓" : ""}`).join(", ") || "none"} | ${note} |`);
}

const body = [
  "Factory state, written by the scheduler (`factory-scheduler.yml`). Read this first in every new session.",
  "",
  `Updated: ${new Date().toISOString()} · active agent jobs: ${active} of ${maxParallel}`,
  "",
  "| Issue | Title | State | Depends on | Scheduler note |",
  "|---|---|---|---|---|",
  ...(rows.length ? rows : ["| - | no open `autopilot` issues | | | |"]),
  "",
  "## Actions this run",
  ...(actions.length ? actions.map((a) => `- ${a}`) : ["- none"]),
].join("\n");

console.log(body);
if (!dryRun) {
  const existing = ghJson("issue", "list", "--repo", repo, "--label", "factory-state", "--state", "open", "--json", "number");
  if (existing.length) gh("issue", "edit", String(existing[0].number), "--repo", repo, "--body", body);
  else gh("issue", "create", "--repo", repo, "--title", "Factory state", "--label", "factory-state", "--body", body);
}
