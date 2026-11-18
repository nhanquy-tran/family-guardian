import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { teardown } from "../fixtures/store.ts";
import { supabaseStore } from "../fixtures/supabase-store.ts";
import { localSupabase } from "../local-supabase.ts";
import { SCREENSHOT_DIR } from "./stage.ts";

function pngs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pngs(path);
    return name.endsWith(".png") ? [path] : [];
  });
}

/** A contact sheet of every screenshot, grouped by stage and viewport. */
function writeIndex(): void {
  const files = pngs(SCREENSHOT_DIR).map((p) => relative(SCREENSHOT_DIR, p).replaceAll("\\", "/")).sort();
  if (files.length === 0) return;
  const groups = new Map<string, string[]>();
  for (const f of files) {
    const group = f.split("/").slice(0, -1).join(" / ");
    groups.set(group, [...(groups.get(group) ?? []), f]);
  }
  const sections = [...groups]
    .map(([group, list]) => `<h2>${group}</h2><div class="grid">${list
      .map((f) => `<figure><a href="${f}"><img src="${f}" loading="lazy" alt="${f}"></a><figcaption>${f.split("/").pop()}</figcaption></figure>`)
      .join("")}</div>`)
    .join("");
  writeFileSync(
    join(SCREENSHOT_DIR, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Family Guardian screenshots</title><style>
body{font:14px system-ui;margin:24px;background:#f6f7f9}h2{margin-top:32px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
figure{margin:0;background:#fff;border-radius:8px;padding:8px;box-shadow:0 1px 3px #0002}
img{width:100%;height:320px;object-fit:cover;object-position:top;border-radius:4px}</style>
<h1>Family Guardian screenshots</h1>${sections}`,
  );
}

/** Reverts the database: every run ends with no e2e accounts or families left. Set E2E_KEEP=1 to inspect the data. */
export default async function globalTeardown(): Promise<void> {
  writeIndex();
  if (process.env.E2E_KEEP === "1") return;
  await teardown(supabaseStore(localSupabase()));
}
