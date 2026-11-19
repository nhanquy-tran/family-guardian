#!/usr/bin/env node
// Deterministic eval gates for the factory (the checker is not the producer).
//   node factory-eval.mjs spec <change>                 structure of an OpenSpec change
//   node factory-eval.mjs coverage <change> <tests...>  every scenario has a test with its title
// Prints a markdown details block and writes `result` and `summary` to $GITHUB_OUTPUT when set.
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { lintChange } from "./spec-lint.mjs";
import { riskOf } from "./risk-tier.mjs";

const [mode, change, ...rest] = process.argv.slice(2);
if (!mode || !change) {
  console.error("usage: factory-eval.mjs spec|coverage <change> [test files...]");
  process.exit(2);
}
const dir = join("openspec", "changes", change);

function specFiles() {
  const specsDir = join(dir, "specs");
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(specsDir, d.name, "spec.md")))
    .map((d) => join(specsDir, d.name, "spec.md"));
}

// Splits spec.md into requirements, each with its scenarios and their step lines.
function parseSpec(md) {
  const reqs = [];
  let req = null;
  let scenario = null;
  for (const line of md.split("\n")) {
    const r = /^###\s+Requirement:\s*(.+)$/.exec(line);
    const s = /^####\s+Scenario:\s*(.+)$/.exec(line);
    if (r) { req = { title: r[1].trim(), scenarios: [] }; reqs.push(req); scenario = null; }
    else if (s && req) { scenario = { title: s[1].trim(), steps: "" }; req.scenarios.push(scenario); }
    else if (/^#{1,3}\s/.test(line)) scenario = null;
    else if (scenario) scenario.steps += line + "\n";
  }
  return reqs;
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function finish(ok, summary, details) {
  console.log(`<details><summary>${summary}</summary>\n\n${details.join("\n")}\n</details>`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `result=${ok ? "pass" : "fail"} (${summary})\n`);
  }
}

function evalSpec() {
  const problems = [];
  const details = [];
  for (const f of ["proposal.md", "design.md", "tasks.md"]) {
    if (!existsSync(join(dir, f))) problems.push(`missing ${f}`);
  }
  const files = specFiles();
  if (!files.length) problems.push("no specs/<capability>/spec.md");

  let reqCount = 0;
  let scenCount = 0;
  let noGiven = 0;
  for (const file of files) {
    for (const req of parseSpec(readFileSync(file, "utf8"))) {
      reqCount++;
      if (!req.scenarios.length) problems.push(`requirement "${req.title}" has no scenario`);
      for (const sc of req.scenarios) {
        scenCount++;
        const missing = ["WHEN", "THEN"].filter((k) => !new RegExp(`\\b${k}\\b`).test(sc.steps));
        if (missing.length) problems.push(`scenario "${sc.title}" lacks ${missing.join("/")}`);
        if (!/\bGIVEN\b/.test(sc.steps)) noGiven++;
      }
    }
  }
  if (noGiven) details.push(`- note: ${noGiven} scenarios have no GIVEN`);

  const tasks = existsSync(join(dir, "tasks.md")) ? readFileSync(join(dir, "tasks.md"), "utf8") : "";
  if (!/\.(test|spec)\.tsx?\b/.test(tasks)) problems.push("tasks.md names no test file");

  try {
    execFileSync("npx", ["openspec", "validate", change, "--strict", "--no-interactive"], { stdio: "pipe", shell: process.platform === "win32" });
    details.unshift("- `openspec validate --strict`: valid");
  } catch (e) {
    problems.push("openspec validate --strict failed");
    details.unshift("```", String(e.stdout || "") + String(e.stderr || ""), "```");
  }
  if (existsSync(join(dir, "QUESTIONS.md"))) details.push("- note: QUESTIONS.md present");

  // ISSUE_LABELS and ADDS_ADR come from the spec workflow; without them only the change folder decides.
  const labels = (process.env.ISSUE_LABELS || "").split(/[,\n]/).map((l) => l.trim()).filter(Boolean);
  const risk = riskOf({ change, labels, addsAdr: process.env.ADDS_ADR === "1" });
  details.push(risk.risky ? `- risk: high (${risk.reasons.join("; ")}): design template and architect review required` : "- risk: normal");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `risk=${risk.risky ? "high" : "normal"}\n`);

  const lint = lintChange({ change, light: process.env.MODE === "light", risky: risk.risky });
  problems.push(...lint.problems);
  details.push(...lint.warnings.map((w) => `- warning: ${w}`));

  const ok = problems.length === 0;
  const summary = `${reqCount} requirements, ${scenCount} scenarios${ok ? "" : `, ${problems.length} problems`}`;
  finish(ok, summary, [...problems.map((p) => `- problem: ${p}`), ...details]);
}

function evalCoverage(testFiles) {
  const scenarios = specFiles().flatMap((f) => parseSpec(readFileSync(f, "utf8")).flatMap((r) => r.scenarios.map((s) => s.title)));
  const names = [];
  for (const f of testFiles.filter((t) => existsSync(t))) {
    // Also matches chained modifiers with arguments: it.skipIf(cond)("title"), test.each(rows)("title").
    const title = /\b(?:it|test)(?:\.\w+(?:\((?:[^()]|\([^()]*\))*\))?)*\(\s*(["'`])(.+?)\1/g;
    for (const m of readFileSync(f, "utf8").matchAll(title)) names.push(normalize(m[2]));
  }
  const covered = (title) => {
    const t = normalize(title);
    return names.some((n) => n === t || n.includes(t) || (n.split(" ").length >= 3 && t.includes(n)));
  };
  const missing = scenarios.filter((s) => !covered(s));
  const ok = scenarios.length > 0 && missing.length === 0;
  const summary = `${scenarios.length - missing.length}/${scenarios.length} scenarios have a test with their title`;
  finish(ok, summary, missing.length ? missing.map((s) => `- missing: ${s}`) : ["- all scenarios covered"]);
}

if (mode === "spec") evalSpec();
else if (mode === "coverage") evalCoverage(rest);
else { console.error(`unknown mode ${mode}`); process.exit(2); }
