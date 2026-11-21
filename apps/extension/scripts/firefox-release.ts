import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseFirefox } from "../lib/firefox-release.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run firefox:release -w extension -- <signed.xpi>");
  process.exit(1);
}

const idSource = readFileSync(join(root, "packages", "shared", "src", "extension.ts"), "utf8");
const addonId = /FIREFOX_ADDON_ID\s*=\s*"([^"]+)"/.exec(idSource)?.[1];
if (!addonId) {
  console.error("FIREFOX_ADDON_ID not found in packages/shared/src/extension.ts");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as { version: string };
const outDir = process.env.FIREFOX_RELEASE_DIR ?? join(root, "apps", "web", "public", "firefox");

try {
  await releaseFirefox({ file: resolve(file), outDir, addonId, buildVersion: pkg.version });
  console.log(`Released ${pkg.version} to ${outDir}`);
} catch (err) {
  console.error(`Release failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
