// Decides whether a spec change is risky enough for the design template and the architect review (ADR 0022).
// Deterministic on purpose: the spec writer cannot talk a change out of review.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Auth, pairing, tokens, stored or collected data, retention and the schema itself.
export const SENSITIVE = ["parent-auth", "device-pairing", "extension-pairing", "device-management", "activity-tracking", "data-retention", "privacy-policy", "database-schema"];
const RISK_LABELS = ["full-mode", "privacy", "security"];

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const dirs = (path) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);

export function riskOf({ root = ".", change, labels = [], addsAdr = false }) {
  const reasons = [];
  const dir = join(root, "openspec", "changes", change);
  const proposal = read(join(dir, "proposal.md"));
  const plan = read(join(dir, "design.md")) + "\n" + read(join(dir, "tasks.md"));
  const touches = (/^Touches:(.*)$/m.exec(proposal)?.[1] ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const existing = new Set(dirs(join(root, "openspec", "specs")));
  const deltaCaps = dirs(join(dir, "specs")).filter((c) => existsSync(join(dir, "specs", c, "spec.md")));

  for (const label of RISK_LABELS) if (labels.includes(label)) reasons.push(`label ${label}`);
  for (const cap of deltaCaps) if (!existing.has(cap)) reasons.push(`new capability ${cap}`);

  const capabilities = new Set([...deltaCaps, ...touches.filter((t) => /^[a-z0-9-]+$/.test(t))]);
  if (capabilities.size >= 3) reasons.push(`touches ${capabilities.size} capabilities`);
  if (touches.some((t) => t.startsWith("supabase/migrations")) || /supabase\/migrations|\bmigrations?\b/i.test(plan)) reasons.push("database migration");
  for (const cap of SENSITIVE) if (capabilities.has(cap)) reasons.push(`sensitive capability ${cap}`);
  const affirmed = plan.replace(/\bno new (npm )?(dependency|dependencies|package|library)\b/gi, "");
  if (/\bnew (npm )?(dependency|package|library)\b|\bnpm (install|i) [a-z@]/i.test(affirmed)) reasons.push("new dependency");
  if (addsAdr) reasons.push("adds an ADR");

  return { risky: reasons.length > 0, reasons };
}
