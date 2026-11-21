import { describe, expect, it } from "vitest";
import {
  CHROME_WEB_STORE_UPDATE_URL,
  EXTENSION_ID,
  FIREFOX_ADDON_ID,
  FIREFOX_INSTALL_URL,
  FIREFOX_UPDATE_URL,
} from "./extension";

describe("extension constants", () => {
  it("Gecko identity and data declaration", () => {
    expect(FIREFOX_ADDON_ID).toBe("guardian@family-guardian.co");
    expect(FIREFOX_UPDATE_URL).toBe("https://family-guardian.co/firefox/updates.json");
    expect(EXTENSION_ID).toBe("mohnkinbpagpelmlfmgkgaplfikdjjcb");
    expect(CHROME_WEB_STORE_UPDATE_URL).toBe("https://clients2.google.com/service/update2/crx");
  });

  it("Install URL constant", () => {
    expect(FIREFOX_INSTALL_URL).toBe("https://family-guardian.co/firefox/latest.xpi");
  });
});
