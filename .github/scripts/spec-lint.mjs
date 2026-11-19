// Spec checks the gate used to make by hand (factory audit v5, R2). Used by factory-eval.mjs spec.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const key = (name) => name.trim().toLowerCase();
const dirs = (path) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);

// Requirement names per delta section (ADDED, MODIFIED, REMOVED, RENAMED) plus scenario count and Purpose.
export function parseDelta(md) {
  const sections = { ADDED: [], MODIFIED: [], REMOVED: [], RENAMED: [] };
  let section = null;
  let scenarios = 0;
  for (const line of md.split("\n")) {
    const s = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/i.exec(line);
    if (s) { section = s[1].toUpperCase(); continue; }
    if (/^##\s/.test(line)) { section = null; continue; }
    const r = /^###\s+Requirement:\s*(.+)$/.exec(line);
    if (r && section) sections[section].push(r[1].trim());
    if (/^####\s+Scenario:/.test(line)) scenarios++;
  }
  return { sections, scenarios, hasPurpose: /^##\s+Purpose\b/m.test(md) };
}

function mainRequirements(root, capability) {
  const file = join(root, "openspec", "specs", capability, "spec.md");
  if (!existsSync(file)) return null;
  const names = [...readFileSync(file, "utf8").matchAll(/^###\s+Requirement:\s*(.+)$/gm)].map((m) => key(m[1]));
  return new Set(names);
}

function changedRequirements(root, change) {
  const out = [];
  for (const cap of dirs(join(root, "openspec", "changes", change, "specs"))) {
    const file = join(root, "openspec", "changes", change, "specs", cap, "spec.md");
    if (!existsSync(file)) continue;
    const { sections } = parseDelta(readFileSync(file, "utf8"));
    for (const name of [...sections.MODIFIED, ...sections.REMOVED]) out.push({ cap, name });
  }
  return out;
}

// Sections a risky change's design.md must have (ADR 0022); "None." is a valid answer.
export const DESIGN_SECTIONS = ["Data model", "Contracts", "Failure modes", "Alternatives", "ADR impact"];

export function lintChange({ root = ".", change, light = false, risky = false }) {
  const problems = [];
  const warnings = [];
  const dir = join(root, "openspec", "changes", change);
  const proposal = existsSync(join(dir, "proposal.md")) ? readFileSync(join(dir, "proposal.md"), "utf8") : "";
  if (!/^Depends on:/m.test(proposal)) problems.push("proposal.md has no `Depends on:` line");
  const touchesLine = /^Touches:(.*)$/m.exec(proposal);
  if (!touchesLine) problems.push("proposal.md has no `Touches:` line");
  const touches = (touchesLine?.[1] ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  const capabilities = dirs(join(dir, "specs")).filter((c) => existsSync(join(dir, "specs", c, "spec.md")));
  const existing = new Set(dirs(join(root, "openspec", "specs")));
  let scenarios = 0;

  for (const cap of capabilities) {
    const delta = parseDelta(readFileSync(join(dir, "specs", cap, "spec.md"), "utf8"));
    scenarios += delta.scenarios;
    const main = mainRequirements(root, cap);
    if (!main) {
      if (!delta.hasPurpose) problems.push(`${cap}: new capability needs a \`## Purpose\` section`);
    } else {
      for (const name of delta.sections.ADDED) if (main.has(key(name))) problems.push(`${cap}: "${name}" already exists; use MODIFIED`);
      for (const kind of ["MODIFIED", "REMOVED"]) {
        for (const name of delta.sections[kind]) if (!main.has(key(name))) problems.push(`${cap}: ${kind} "${name}" does not exist in openspec/specs`);
      }
    }
    if (touchesLine && !touches.includes(cap)) problems.push(`Touches does not list ${cap}`);
  }

  // Capabilities are bare kebab-case names; paths and file names are hot files, not checked here.
  for (const t of touches) {
    if (/^[a-z0-9-]+$/.test(t) && !existing.has(t) && !capabilities.includes(t)) {
      problems.push(`Touches names "${t}", which is not a capability in openspec/specs or this change`);
    }
  }

  if (risky) {
    const design = existsSync(join(dir, "design.md")) ? readFileSync(join(dir, "design.md"), "utf8") : "";
    for (const section of DESIGN_SECTIONS) {
      if (!new RegExp(`^##\\s+${section}\\b`, "im").test(design)) problems.push(`design.md lacks \`## ${section}\` (required for risky changes)`);
    }
  }

  const limit = light ? 20 : 30;
  if (scenarios > limit) problems.push(`${scenarios} scenarios; the ${light ? "light-mode" : "full-mode"} limit is ${limit} (split the issue)`);

  const mine = changedRequirements(root, change);
  for (const other of dirs(join(root, "openspec", "changes")).filter((c) => c !== change && c !== "archive")) {
    for (const theirs of changedRequirements(root, other)) {
      const clash = mine.find((m) => m.cap === theirs.cap && key(m.name) === key(theirs.name));
      if (clash) warnings.push(`${clash.cap}: "${clash.name}" is also changed by open change ${other}; state the order in Depends on`);
    }
  }

  return { problems, warnings, scenarios };
}
