// Prints per-area coverage (from `npm run coverage`) against the thresholds in vitest.config.ts, as a markdown table.
// Usage: node .github/scripts/coverage-table.mjs [coverage/coverage-summary.json]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function parseThresholds(configText) {
  const block = /thresholds:\s*\{([\s\S]*?)\n\s*\},/.exec(configText)?.[1] ?? "";
  const lines = Number(/^\s*lines:\s*(\d+)/m.exec(block)?.[1] ?? 0);
  const branches = Number(/^\s*branches:\s*(\d+)/m.exec(block)?.[1] ?? 0);
  const areas = [...block.matchAll(/"([^"]+)":\s*\{\s*lines:\s*(\d+),\s*branches:\s*(\d+)\s*\}/g)].map((m) => ({
    area: m[1],
    lines: Number(m[2]),
    branches: Number(m[3]),
  }));
  return [{ area: "all", lines, branches }, ...areas];
}

const slash = (p) => p.split("\\").join("/");
const pct = (covered, total) => (total ? Math.round((10_000 * covered) / total) / 100 : 100);

export function areaRows(summary, thresholds, root = process.cwd()) {
  const base = `${slash(root).replace(/\/$/, "")}/`;
  const files = Object.entries(summary)
    .filter(([key]) => key !== "total")
    .map(([key, m]) => [slash(key).replace(base, ""), m]);
  return thresholds.map((t) => {
    let l = [0, 0];
    let b = [0, 0];
    if (t.area === "all") {
      l = [summary.total.lines.covered, summary.total.lines.total];
      b = [summary.total.branches.covered, summary.total.branches.total];
    } else {
      const prefix = t.area.replace(/\*\*$/, "");
      for (const [path, m] of files) {
        if (!path.startsWith(prefix)) continue;
        l = [l[0] + m.lines.covered, l[1] + m.lines.total];
        b = [b[0] + m.branches.covered, b[1] + m.branches.total];
      }
    }
    const lines = pct(...l);
    const branches = pct(...b);
    return { area: t.area, lines, branches, min: `${t.lines} / ${t.branches}`, ok: lines >= t.lines && branches >= t.branches };
  });
}

export function toMarkdown(rows) {
  const name = (a) => (a === "all" ? a : `\`${a}\``);
  return [
    "| Area | Lines % | Branches % | Minimum (lines / branches) | |",
    "|---|---:|---:|---|---|",
    ...rows.map((r) => `| ${name(r.area)} | ${r.lines.toFixed(1)} | ${r.branches.toFixed(1)} | ${r.min} | ${r.ok ? "pass" : "**below**"} |`),
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const summary = JSON.parse(readFileSync(process.argv[2] ?? "coverage/coverage-summary.json", "utf8"));
  const thresholds = parseThresholds(readFileSync("vitest.config.ts", "utf8"));
  console.log(toMarkdown(areaRows(summary, thresholds)));
}
