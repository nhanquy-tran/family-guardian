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

const DOLLAR_BODY = /(\$[A-Za-z_]*\$)([\s\S]*?)\1/g;

// A DO block runs when the migration applies, so its body (string contents too, for EXECUTE '...') is
// scanned. Other dollar-quoted bodies belong to functions and procedures, which run only when called.
function doBodies(sql) {
  return [...sql.matchAll(/\bdo\s+(\$[A-Za-z_]*\$)([\s\S]*?)\1/gi)].map((m) => m[2]);
}

function stripCommentsAndStrings(sql) {
  return sql
    .replace(DOLLAR_BODY, "''")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:[^']|'')*'/g, "''");
}

const matching = (text) =>
  text
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && PATTERNS.some((p) => p.test(s)));

export function destructiveStatements(sql) {
  const inDo = doBodies(sql).flatMap((body) => matching(body.replace(/--[^\n]*/g, "").replace(/'/g, " ")));
  return [...matching(stripCommentsAndStrings(sql)), ...inDo];
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  for (const file of process.argv.slice(2)) {
    for (const statement of destructiveStatements(readFileSync(file, "utf8"))) {
      console.log(`${file}: ${statement.replace(/\s+/g, " ").slice(0, 160)}`);
    }
  }
}
