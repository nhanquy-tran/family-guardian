#!/usr/bin/env node
// Deterministic facts for the weekly architecture check (ADR 0022), so the agent spends its time judging, not counting.
// Usage: node arch-facts.mjs [days]   Prints markdown.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ADR = /^(\d{4})-.+\.md$/;

export function duplicateAdrNumbers(files) {
  const byNumber = new Map();
  for (const f of files) {
    const m = ADR.exec(f);
    if (m) byNumber.set(m[1], [...(byNumber.get(m[1]) ?? []), f]);
  }
  return [...byNumber].filter(([, list]) => list.length > 1).map(([number, list]) => ({ number, files: list.sort() }));
}

export function unindexedAdrs(files, readme) {
  return files.filter((f) => ADR.test(f) && !readme.includes(`(${f})`));
}

const NOISE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml)$|^openspec\/changes\/archive\/|^docs\/reports\//;

// `log` is `git log --name-only --format=` output: file lists separated by blank lines, one block per commit.
export function hotFiles(log, n) {
  const counts = new Map();
  for (const path of log.split("\n").map((l) => l.trim()).filter((l) => l && !NOISE.test(l))) {
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return [...counts].map(([path, commits]) => ({ path, commits }))
    .sort((a, b) => b.commits - a.commits || a.path.localeCompare(b.path))
    .slice(0, n);
}

export function largeFiles(entries, limit) {
  return entries.filter((e) => /\.(ts|tsx|js|mjs)$/.test(e.path) && !/\.test\.|\.spec\./.test(e.path) && e.lines > limit)
    .sort((a, b) => b.lines - a.lines);
}

function main() {
  const days = Number(process.argv[2] || 7);
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const adrFiles = readdirSync("docs/decisions");
  const readme = readFileSync("docs/decisions/README.md", "utf8");
  const sources = git("ls-files", "apps", "packages", "supabase/functions").split("\n").filter(Boolean);
  const sizes = sources.filter(existsSync).map((path) => ({ path, lines: readFileSync(path, "utf8").split("\n").length }));
  const open = existsSync("openspec/changes") ? readdirSync("openspec/changes").filter((c) => c !== "archive" && existsSync(join("openspec/changes", c, "proposal.md"))) : [];
  const merged = git("log", `--since=${days}.days`, "--first-parent", "--format=- %s", "origin/main").trim();

  const out = [`## Facts (last ${days} days)`, "", "### Merged to main", merged || "- none", "", "### Most changed product files"];
  out.push(...hotFiles(git("log", `--since=${days}.days`, "--name-only", "--format=", "origin/main", "--", "apps", "packages", "supabase", "openspec/specs"), 15).map((f) => `- ${f.path}: ${f.commits} commits`));
  const large = largeFiles(sizes, 400).map((f) => `- ${f.path}: ${f.lines}`);
  out.push("", "### Source files over 400 lines", ...(large.length ? large : ["- none"]));
  out.push("", "### Open OpenSpec changes on main", ...(open.length ? open.map((c) => `- ${c}`) : ["- none"]));
  const dups = duplicateAdrNumbers(adrFiles);
  const missing = unindexedAdrs(adrFiles, readme);
  out.push("", "### ADR index", dups.length ? dups.map((d) => `- duplicate number ${d.number}: ${d.files.join(", ")}`).join("\n") : "- numbers unique",
    missing.length ? `- not in README: ${missing.join(", ")}` : "- all indexed");
  console.log(out.join("\n"));
}

if (process.argv[1]?.endsWith("arch-facts.mjs")) main();
