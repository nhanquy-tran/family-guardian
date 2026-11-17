import { CHROME_WEB_STORE_UPDATE_URL, EXTENSION_ID } from "@fg/shared";
import { describe, expect, it } from "vitest";
import { POLICY_TARGETS, buildRemoveReg, buildSetupReg } from "./reg";

const CRLF = "\r\n";
const FORCE_VALUE = `"1"="mohnkinbpagpelmlfmgkgaplfikdjjcb;https://clients2.google.com/service/update2/crx"`;

const TARGETS = [
  { browser: "Chrome", key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome", privateModeValue: "IncognitoModeAvailability" },
  { browser: "Edge", key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Edge", privateModeValue: "InPrivateModeAvailability" },
  { browser: "Brave", key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\BraveSoftware\\Brave", privateModeValue: "IncognitoModeAvailability" },
];

function lines(text: string): string[] {
  return text.split(CRLF);
}

/** Lines of the section that starts at `[key]` up to the next blank line. */
function section(text: string, key: string): string[] {
  const all = lines(text);
  const start = all.indexOf(`[${key}]`);
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < all.length && all[i] !== ""; i++) out.push(all[i]);
  return out;
}

function expectedFile(mode: "setup" | "remove"): string {
  let text = `Windows Registry Editor Version 5.00${CRLF}${CRLF}`;
  for (const t of TARGETS) {
    text += `[${t.key}]${CRLF}`;
    text += mode === "setup" ? `"${t.privateModeValue}"=dword:00000001${CRLF}` : `"${t.privateModeValue}"=-${CRLF}`;
    text += mode === "setup" ? `"BrowserGuestModeEnabled"=dword:00000000${CRLF}` : `"BrowserGuestModeEnabled"=-${CRLF}`;
    text += CRLF;
    text += `[${t.key}\\ExtensionInstallForcelist]${CRLF}`;
    text += mode === "setup" ? `${FORCE_VALUE}${CRLF}` : `"1"=-${CRLF}`;
    text += CRLF;
  }
  return text;
}

describe("reg installer", () => {
  it("Targets are fixed", () => {
    expect(POLICY_TARGETS).toEqual(TARGETS);
  });

  it("Header and line endings", () => {
    for (const text of [buildSetupReg(), buildRemoveReg()]) {
      expect(text.startsWith(`Windows Registry Editor Version 5.00${CRLF}${CRLF}`)).toBe(true);
      expect(text.endsWith(CRLF)).toBe(true);
      const stripped = text.split(CRLF).join("");
      expect(stripped).not.toContain("\r");
      expect(stripped).not.toContain("\n");
      for (let i = 0; i < text.length; i++) expect(text.charCodeAt(i)).toBeLessThan(128);
    }
  });

  it("Force-install entry for each browser", () => {
    expect(FORCE_VALUE).toBe(`"1"="${EXTENSION_ID};${CHROME_WEB_STORE_UPDATE_URL}"`);
    const all = lines(buildSetupReg());
    for (const t of TARGETS) {
      const idx = all.indexOf(`[${t.key}\\ExtensionInstallForcelist]`);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(all[idx + 1]).toBe(`"1"="${EXTENSION_ID};${CHROME_WEB_STORE_UPDATE_URL}"`);
      expect(all[idx + 1]).toBe(FORCE_VALUE);
    }
  });

  it("Private mode disabled for each browser", () => {
    const text = buildSetupReg();
    expect(text).toContain(`[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome]${CRLF}"IncognitoModeAvailability"=dword:00000001`);
    expect(text).toContain(`[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Edge]${CRLF}"InPrivateModeAvailability"=dword:00000001`);
    expect(text).toContain(`[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\BraveSoftware\\Brave]${CRLF}"IncognitoModeAvailability"=dword:00000001`);
  });

  it("Guest mode disabled for each browser", () => {
    const text = buildSetupReg();
    for (const t of TARGETS) {
      expect(section(text, t.key)).toContain(`"BrowserGuestModeEnabled"=dword:00000000`);
    }
  });

  it("Nothing else is set", () => {
    const all = lines(buildSetupReg());
    const keyLines = all.filter((l) => l.startsWith("["));
    const valueLines = all.filter((l) => l.startsWith('"'));
    expect(keyLines).toHaveLength(6);
    for (const k of keyLines) expect(k.startsWith("[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\")).toBe(true);
    expect(valueLines).toHaveLength(9);
  });

  it("Full expected setup file", () => {
    expect(buildSetupReg()).toBe(expectedFile("setup"));
  });

  it("Deletes the values set by setup", () => {
    const setup = lines(buildSetupReg());
    const remove = lines(buildRemoveReg());
    expect(remove.filter((l) => l.startsWith("["))).toEqual(setup.filter((l) => l.startsWith("[")));

    const valuesByKey = (all: string[]): Map<string, string[]> => {
      const map = new Map<string, string[]>();
      let current = "";
      for (const l of all) {
        if (l.startsWith("[")) {
          current = l;
          map.set(current, []);
        } else if (l.startsWith('"')) {
          map.get(current)?.push(l);
        }
      }
      return map;
    };
    const setupValues = valuesByKey(setup);
    const removeValues = valuesByKey(remove);
    expect([...removeValues.keys()]).toEqual([...setupValues.keys()]);
    for (const [key, vals] of setupValues) {
      const names = vals.map((v) => v.slice(0, v.indexOf("=")));
      expect(removeValues.get(key)).toEqual(names.map((n) => `${n}=-`));
    }
  });

  it("Guest mode value is removed", () => {
    const text = buildRemoveReg();
    expect(text.split(`"BrowserGuestModeEnabled"=-`).length - 1).toBe(3);
    for (const t of TARGETS) {
      expect(section(text, t.key)).toContain(`"BrowserGuestModeEnabled"=-`);
    }
  });

  it("Full expected remove file", () => {
    expect(buildRemoveReg()).toBe(expectedFile("remove"));
  });

  it("No key is deleted", () => {
    for (const l of lines(buildRemoveReg())) expect(l.startsWith("[-")).toBe(false);
  });
});
