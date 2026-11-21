import { BROWSER_NAMES } from "@fg/shared";

export type BrowserName = (typeof BROWSER_NAMES)[number];

export function detectBrowser(input: {
  brands: readonly string[];
  userAgent: string;
  isBrave: boolean;
}): BrowserName {
  const { brands, userAgent } = input;
  if (input.isBrave) return "brave";
  if (brands.includes("Microsoft Edge") || userAgent.includes("Edg/")) return "edge";
  if (userAgent.includes("OPR/")) return "other";
  if (brands.includes("Google Chrome") || userAgent.includes("Chrome/")) return "chrome";
  if (userAgent.includes("Firefox/")) return "firefox";
  return "other";
}

export function resolveBadgeApi<T extends object>(api: { action?: T; browserAction?: T }): T | undefined {
  return api.action ?? api.browserAction ?? undefined;
}

export function parseBrowserName(value: unknown): BrowserName {
  return BROWSER_NAMES.find((name) => name === value) ?? "other";
}

const OS_NAMES: Record<string, string> = {
  win: "Windows",
  mac: "macOS",
  linux: "Linux",
  cros: "ChromeOS",
};

export function osName(platformOs: string): string {
  return OS_NAMES[platformOs] ?? "other";
}
