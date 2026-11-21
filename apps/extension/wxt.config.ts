import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "wxt";
import { buildFirefoxManifest, buildManifest, FIREFOX_MANIFEST_VERSION } from "./lib/manifest";

const apiOrigin = (process.env.WXT_API_BASE_URL ?? "https://family-guardian.co").replace(/\/$/, "");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function manifestFor(target: { browser: string; apiOrigin: string }): Record<string, unknown> {
  return {
    name: "Family Guardian",
    description: "Shows parents which websites are used and for how long. Collects website domains and time only.",
    ...(target.browser === "firefox" ? buildFirefoxManifest(target.apiOrigin) : buildManifest(target.apiOrigin)),
  };
}

// WXT loads the config without an environment argument, so fall back to the CLI flag.
function browserFromArgv(): string {
  const i = process.argv.findIndex((a) => a === "-b" || a === "--browser");
  return process.argv[i + 1] ?? "chrome";
}

// defineConfig's type accepts only an object, but WXT also calls a function; the tests resolve it per target.
const config = (env?: { browser?: string }) => {
  const browser = env?.browser ?? browserFromArgv();
  const firefox = browser === "firefox";
  return {
    manifest: manifestFor({ browser, apiOrigin }),
    ...(firefox
      ? {
          manifestVersion: FIREFOX_MANIFEST_VERSION as 2 | 3,
          zip: {
            sourcesRoot: repoRoot,
            includeSources: ["apps/extension/**", "packages/shared/**", "package.json", "package-lock.json"],
            excludeSources: ["**/.env*", "**/node_modules/**", "apps/web/**"],
          },
        }
      : {}),
  };
};

export default config as unknown as UserConfig;
