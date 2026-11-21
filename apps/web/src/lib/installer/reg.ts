import { CHROME_WEB_STORE_UPDATE_URL, EXTENSION_ID, FIREFOX_ADDON_ID, FIREFOX_INSTALL_URL } from "@fg/shared";

export const POLICY_TARGETS = [
  {
    browser: "Chrome",
    key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome",
    privateModeValue: "IncognitoModeAvailability",
  },
  {
    browser: "Edge",
    key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Edge",
    privateModeValue: "InPrivateModeAvailability",
  },
  {
    browser: "Brave",
    key: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\BraveSoftware\\Brave",
    privateModeValue: "IncognitoModeAvailability",
  },
] as const;

const FIREFOX_POLICY_KEY = "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Mozilla\\Firefox";

export function regString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const HEADER = "Windows Registry Editor Version 5.00";

function build(remove: boolean): string {
  const lines: string[] = [HEADER, ""];
  for (const t of POLICY_TARGETS) {
    lines.push(
      `[${t.key}]`,
      remove ? `"${t.privateModeValue}"=-` : `"${t.privateModeValue}"=dword:00000001`,
      remove ? `"BrowserGuestModeEnabled"=-` : `"BrowserGuestModeEnabled"=dword:00000000`,
      "",
      `[${t.key}\\ExtensionInstallForcelist]`,
      remove ? `"1"=-` : `"1"="${EXTENSION_ID};${CHROME_WEB_STORE_UPDATE_URL}"`,
      "",
    );
  }
  const firefoxSettings = JSON.stringify({
    [FIREFOX_ADDON_ID]: { installation_mode: "force_installed", install_url: FIREFOX_INSTALL_URL },
  });
  lines.push(
    `[${FIREFOX_POLICY_KEY}]`,
    remove ? `"ExtensionSettings"=-` : `"ExtensionSettings"="${regString(firefoxSettings)}"`,
    remove ? `"DisablePrivateBrowsing"=-` : `"DisablePrivateBrowsing"=dword:00000001`,
    remove ? `"DisableSafeMode"=-` : `"DisableSafeMode"=dword:00000001`,
    "",
  );
  return lines.join("\r\n") + "\r\n";
}

export function buildSetupReg(): string {
  return build(false);
}

export function buildRemoveReg(): string {
  return build(true);
}
