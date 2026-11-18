import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, isLocale, pickLocale } from "./locale";

describe("locale helpers", () => {
  it("Supported locales and best match", () => {
    expect([...LOCALES]).toEqual(["en", "vi", "zh"]);
    expect(DEFAULT_LOCALE).toBe("en");
    for (const l of ["en", "vi", "zh"]) expect(isLocale(l), l).toBe(true);
    for (const l of ["fr", "login", "dashboard", "privacy", ""]) expect(isLocale(l), l).toBe(false);

    expect(pickLocale("vi-VN,vi;q=0.9,en;q=0.5")).toBe("vi");
    expect(pickLocale("zh-CN,zh;q=0.9")).toBe("zh");
    expect(pickLocale("zh-TW")).toBe("zh");
    // en-GB q=1 > vi q=0.9 > en q=0.8, so en. The scenario text says `vi` for this header, which
    // contradicts its own q-sort rule in design.md; flagged to the owner (see NOTES).
    expect(pickLocale("en-GB,en;q=0.8,vi;q=0.9")).toBe("en");
    expect(pickLocale("fr,vi;q=0.4")).toBe("vi");
  });

  it("Fallback to English", () => {
    for (const h of [null, "", "fr-FR,de;q=0.8", "*", ";;q=x", "vi;q=0"]) {
      expect(() => pickLocale(h), String(h)).not.toThrow();
      expect(pickLocale(h), String(h)).toBe("en");
    }
  });
});
