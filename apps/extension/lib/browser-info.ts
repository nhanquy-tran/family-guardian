export type BrowserName = "chrome" | "edge" | "brave" | "other";

export function detectBrowser(_input: {
  brands: readonly string[];
  userAgent: string;
  isBrave: boolean;
}): BrowserName {
  throw new Error("not implemented");
}

export function osName(_platformOs: string): string {
  throw new Error("not implemented");
}
