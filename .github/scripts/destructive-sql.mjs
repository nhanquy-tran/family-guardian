#!/usr/bin/env node
// Finds migration statements that lose data or break the running app, so they wait for the owner
// (pstack "always pause for irreversible writes"). Recreatable objects (policies, functions, indexes,
// triggers, views, constraints) are not flagged.
//   node destructive-sql.mjs <file.sql>...   prints one line per finding, exits 0
import { readFileSync } from "node:fs";

const PATTERNS = [
  /\bdrop\s+(table|schema)\b/i,
  /\bdrop\s+column\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/i,
  /\brename\s+(column\s+\S+\s+)?to\b/i,
];

// Function bodies ($$ ... $$ or $tag$ ... $tag$) run when called, not when the migration applies.
function stripCommentsAndStrings(sql) {
  return sql
    .replace(/(\$[A-Za-z_]*\$)[\s\S]*?\1/g, "''")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^']|'')*'/g, "''");
}

export function destructiveStatements(sql) {
  return stripCommentsAndStrings(sql)
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && PATTERNS.some((p) => p.test(s)));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  for (const file of process.argv.slice(2)) {
    for (const statement of destructiveStatements(readFileSync(file, "utf8"))) {
      console.log(`${file}: ${statement.replace(/\s+/g, " ").slice(0, 160)}`);
    }
  }
}
