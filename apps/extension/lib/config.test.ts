import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./config";

describe("resolveApiBaseUrl", () => {
  it("accepted URLs", () => {
    expect(resolveApiBaseUrl("https://fg.example/")).toBe("https://fg.example");
    expect(resolveApiBaseUrl("https://fg.example")).toBe("https://fg.example");
    expect(resolveApiBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejected URLs", () => {
    for (const raw of [undefined, "", "not a url", "http://fg.example", "ftp://fg.example"]) {
      expect(() => resolveApiBaseUrl(raw)).toThrow(/WXT_API_BASE_URL/);
    }
  });

  it("variable documented without a value", () => {
    const text = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    expect(text.split(/\r?\n/)).toContain("WXT_API_BASE_URL=");
  });
});
