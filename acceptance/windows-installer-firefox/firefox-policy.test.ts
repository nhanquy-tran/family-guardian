import { FIREFOX_ADDON_ID, FIREFOX_INSTALL_URL } from "@fg/shared";
import { describe, expect, it } from "vitest";
import { buildRemoveReg, buildSetupReg, POLICY_TARGETS, regString } from "../../apps/web/src/lib/installer/reg";

const FIREFOX_HEADER = "[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Mozilla\\Firefox]";
const split = (t: string): string[] => t.split("\r\n");

function firefoxValues(text: string): string[] {
  const all = split(text);
  const start = all.indexOf(FIREFOX_HEADER);
  const out: string[] = [];
  for (let i = start + 1; i < all.length && all[i] !== ""; i++) out.push(all[i] ?? "");
  return out;
}

describe("acceptance: Firefox policy in the setup file", () => {
  it("acceptance: Firefox section is last and has exactly three values in order", () => {
    const text = buildSetupReg();
    const keys = split(text).filter((l) => l.startsWith("["));
    expect(keys[keys.length - 1]).toBe(FIREFOX_HEADER);
    expect(keys.filter((k) => k.includes("Mozilla"))).toHaveLength(1);
    const names = firefoxValues(text).map((l) => l.slice(0, l.indexOf("=")));
    expect(names).toEqual(['"ExtensionSettings"', '"DisablePrivateBrowsing"', '"DisableSafeMode"']);
    expect(text.endsWith("\r\n\r\n")).toBe(true);
  });

  it("acceptance: ExtensionSettings is built from the shared constants", () => {
    const line = firefoxValues(buildSetupReg())[0] ?? "";
    const json = JSON.stringify({
      [FIREFOX_ADDON_ID]: { installation_mode: "force_installed", install_url: FIREFOX_INSTALL_URL },
    });
    expect(line).toBe(`"ExtensionSettings"="${regString(json)}"`);
    expect(FIREFOX_INSTALL_URL.startsWith("https://")).toBe(true);
    expect(FIREFOX_INSTALL_URL.endsWith(".xpi")).toBe(true);
  });

  it("acceptance: regString escapes backslashes before quotes", () => {
    // \" (backslash, quote) -> \\ then \" = \\\"
    expect(regString('\\"')).toBe('\\\\\\"');
    expect(regString("\\\\")).toBe("\\\\\\\\");
    expect(regString('""')).toBe('\\"\\"');
    expect(regString("")).toBe("");
    expect(regString("C:\\a b")).toBe("C:\\\\a b");
  });

  it("acceptance: remove file mirrors every setup value and deletes no key", () => {
    const setup = split(buildSetupReg());
    const remove = split(buildRemoveReg());
    expect(remove).toHaveLength(setup.length);
    setup.forEach((l, i) => {
      const r = remove[i] ?? "";
      if (l.startsWith('"')) expect(r).toBe(`${l.slice(0, l.indexOf("="))}=-`);
      else expect(r).toBe(l);
    });
    expect(buildRemoveReg()).not.toMatch(/^\[-/m);
    expect(firefoxValues(buildRemoveReg())).toEqual(['"ExtensionSettings"=-', '"DisablePrivateBrowsing"=-', '"DisableSafeMode"=-']);
  });

  it("acceptance: Chromium sections keep their policy targets and Firefox is not one", () => {
    expect(POLICY_TARGETS.map((t) => t.browser)).toEqual(["Chrome", "Edge", "Brave"]);
    const text = buildSetupReg();
    const before = text.slice(0, text.indexOf(FIREFOX_HEADER));
    expect(before.match(/^\[/gm)).toHaveLength(6);
    expect(before).not.toContain("Mozilla");
    expect(before.match(/"BrowserGuestModeEnabled"=dword:00000000/g)).toHaveLength(3);
    expect(text.split("ExtensionInstallForcelist]").length - 1).toBe(3);
  });

  it("acceptance: setup file stays ASCII with CRLF only", () => {
    for (const t of [buildSetupReg(), buildRemoveReg()]) {
      expect(/^[\x00-\x7f]*$/.test(t)).toBe(true);
      expect(t.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    }
  });
});
