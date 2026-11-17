// Recomputes the deterministic evidence of a factory PR after a push and writes it into the PR body
// as "## Evidence (latest push)", above the build-time table. Reviewers and the gate read this one.
// Env: GH_TOKEN, GITHUB_REPOSITORY, PR, HEAD_SHA. Runs in a checkout of the PR head with deps installed.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { GITHUB_REPOSITORY: repo, PR: pr, HEAD_SHA: head = "" } = process.env;
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });

const body = sh("gh", ["pr", "view", pr, "--repo", repo, "--json", "body", "-q", ".body"]);
const change = /OpenSpec change: `openspec\/changes\/([^`/]+)`/.exec(body)?.[1];
if (!change) {
  console.log("No OpenSpec change in the PR body; nothing to refresh.");
  process.exit(0);
}

const archived = existsSync("openspec/changes/archive")
  ? readdirSync("openspec/changes/archive").filter((d) => d.endsWith(`-${change}`)).sort().pop()
  : undefined;
const changeRef = existsSync(`openspec/changes/${change}`) ? change : archived ? `archive/${archived}` : null;
const changeDir = changeRef && `openspec/changes/${changeRef}`;

const testsSha = sh("git", ["log", "--format=%H", "-1", `--grep=^test: scenarios for ${change} `]);
const testFiles = testsSha
  ? sh("git", ["show", "--name-only", "--format=", testsSha]).split("\n").filter((f) => /\.test\.tsx?$/.test(f) && !f.startsWith("acceptance/"))
  : [];

const rows = [];
const add = (gate, result) => rows.push(`| ${gate} | ${result} |`);

if (testsSha) {
  const changed = testFiles.filter((f) => run("git", ["diff", "--quiet", testsSha, "HEAD", "--", f]).status !== 0);
  add("Test-writer tests unchanged since its commit", changed.length ? `changed: ${changed.join(", ")} (check the gate or debugger reason)` : "pass");
} else add("Test-writer tests unchanged since its commit", "not found (no test-writer commit)");

if (changeDir && testFiles.length) {
  const cov = run("node", [".github/scripts/factory-eval.mjs", "coverage", changeRef, ...testFiles]);
  const summary = /<summary>(.+?)<\/summary>/.exec(cov.stdout)?.[1] ?? "not run";
  add("Eval: every scenario has a test with its title", `${/(\d+)\/\1 /.test(summary) ? "pass" : "fail"} (${summary})`);
}

if (testFiles.length) {
  const visible = run("npx", ["vitest", "run", ...testFiles]);
  add("Test-writer tests pass", visible.status === 0 ? "pass" : "fail (see the workflow log)");
  if (visible.status !== 0) console.log(visible.stdout.slice(-3000));
}

if (existsSync(`acceptance/${change}`)) {
  const hidden = run("npx", ["vitest", "run", `acceptance/${change}`]);
  const count = /Tests\s+(\d+) passed/.exec(hidden.stdout.replace(/\x1b\[[0-9;]*m/g, ""))?.[1];
  add("Hidden acceptance tests pass", hidden.status === 0 ? `pass (${count ?? "all"})` : "fail (see the workflow log)");
  if (hidden.status !== 0) console.log(hidden.stdout.slice(-3000));
} else add("Hidden acceptance tests pass", "not in the tree");

const verify = changeDir && existsSync(`${changeDir}/VERIFY.md`) ? readFileSync(`${changeDir}/VERIFY.md`, "utf8").split("\n")[0].trim() : "";
add("OpenSpec verify (report from the build, not re-run)", verify || "no report");
add("Archive: delta specs merged into openspec/specs", archived ? `done (\`${archived}\`)` : "not archived");
add("npm run check + build", "see the required CI `check` on this commit");

const section = [
  "<!-- evidence:latest:start -->",
  `## Evidence (latest push, ${head.slice(0, 7)})`,
  "",
  "Recomputed on every push by `factory-evidence.yml`. Prefer this over the build-time table below.",
  "",
  "| Gate | Result |",
  "|---|---|",
  ...rows,
  "<!-- evidence:latest:end -->",
  "",
].join("\n");

const marked = /<!-- evidence:latest:start -->[\s\S]*?<!-- evidence:latest:end -->\n?/;
let next;
if (marked.test(body)) next = body.replace(marked, () => section);
else if (/^## Evidence/m.test(body)) next = body.replace(/^## Evidence/m, () => `${section}\n## Evidence`);
else next = `${body}\n\n${section}`;

const out = join(tmpdir(), "pr-body.md");
writeFileSync(out, next);
console.log(section);
if (process.env.DRY_RUN !== "1") sh("gh", ["pr", "edit", pr, "--repo", repo, "--body-file", out]);
