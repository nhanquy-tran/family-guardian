export type BrowserName = "chrome" | "edge" | "brave" | "other";

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
  return "other";
}

export function resolveBadgeApi<T extends object>(_browser: { action?: T; browserAction?: T }): T | undefined {
  throw new Error("not implemented");
}

export function parseBrowserName(_value: unknown): BrowserName {
  throw new Error("not implemented");
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
