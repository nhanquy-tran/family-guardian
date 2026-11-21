import { CHROME_WEB_STORE_UPDATE_URL, EXTENSION_ID } from "@fg/shared";

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

export function regString(_value: string): string {
  throw new Error("not implemented");
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
  return lines.join("\r\n") + "\r\n";
}

export function buildSetupReg(): string {
  return build(false);
}

export function buildRemoveReg(): string {
  return build(true);
}
