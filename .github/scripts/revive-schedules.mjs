// Starts time-based factory workflows whose cron slot GitHub skipped. GitHub's `schedule` event is best effort
// and may be delayed or dropped, so the scheduler and the watchdog both run this: if either runs, the others revive.
// Reads each workflow's own cron line, so the slots stay in one place.
// Usage: node revive-schedules.mjs <calling workflow file>. Env: GH_TOKEN (github.token with actions: write),
// GITHUB_REPOSITORY, DRY_RUN=1 to only print.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const repo = process.env.GITHUB_REPOSITORY;
const self = process.argv[2] || "";
const dryRun = process.env.DRY_RUN === "1";
const GRACE_MIN = 30;

// `queue` keeps the nightly build apart from builds started for one issue (`Factory 3: build #12`).
const JOBS = [
  { file: "factory-scheduler.yml" },
  { file: "factory-watchdog.yml" },
  { file: "factory-build.yml", title: /queue$/ },
  { file: "factory-docs.yml" },
  { file: "factory-architecture.yml" },
];

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" }).trim();

// Supports the shapes we use: "M1,M2 * * * *" (every hour at those minutes), "M H * * *" (daily) and "M H * * D" (weekly).
export function parseCron(yaml) {
  const m = /cron:\s*"([^"]+)"/.exec(yaml);
  if (!m) return null;
  const [min, hour, dom, mon, dow] = m[1].trim().split(/\s+/);
  if (dom !== "*" || mon !== "*") return null;
  const day = dow === "*" ? null : Number(dow);
  if (day !== null && !(Number.isInteger(day) && day >= 0 && day <= 6)) return null;
  const minutes = min.split(",").map(Number);
  if (minutes.some((x) => !Number.isInteger(x))) return null;
  if (hour === "*") return day === null ? { minutes, hours: null } : null;
  const h = Number(hour);
  if (!Number.isInteger(h)) return null;
  return day === null ? { minutes, hours: [h] } : { minutes, hours: [h], days: [day] };
}

// The most recent slot that should have started by now, allowing GitHub some delay.
export function lastSlot(cron, now) {
  const limit = now - GRACE_MIN * 60000;
  for (let back = 0; back < 8 * 24 * 60; back++) {
    const t = new Date(limit - back * 60000);
    if (cron.minutes.includes(t.getUTCMinutes()) && (!cron.hours || cron.hours.includes(t.getUTCHours())) && (!cron.days || cron.days.includes(t.getUTCDay()))) {
      t.setUTCSeconds(0, 0);
      return t.getTime();
    }
  }
  return null;
}

function main() {
  const now = Date.now();
  const lines = [];
  for (const job of JOBS) {
    if (job.file === self) continue;
    const cron = parseCron(readFileSync(`.github/workflows/${job.file}`, "utf8"));
    if (!cron) { lines.push(`- ${job.file}: cron not understood, skipped`); continue; }
    const slot = lastSlot(cron, now);
    const runs = JSON.parse(gh("api", `repos/${repo}/actions/workflows/${job.file}/runs?per_page=100`)).workflow_runs
      .filter((r) => r.conclusion !== "skipped" && (!job.title || job.title.test(r.display_title || "")));
    const last = runs.length ? Date.parse(runs[0].created_at) : 0;
    if (last >= slot) { lines.push(`- ${job.file}: ok (last run ${runs[0].created_at})`); continue; }
    lines.push(`- ${job.file}: missed the ${new Date(slot).toISOString()} slot, ${dryRun ? "would start" : "starting"} it`);
    if (!dryRun) gh("workflow", "run", job.file, "--repo", repo, "--ref", "main");
  }
  console.log(["## Missed schedules", ...lines].join("\n"));
}

if (process.argv[1]?.endsWith("revive-schedules.mjs")) main();
