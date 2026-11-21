import { FIREFOX_ADDON_ID, FIREFOX_UPDATE_URL } from "@fg/shared";

export interface ManifestParts {
  permissions: string[];
  host_permissions: string[];
  web_accessible_resources: { resources: string[]; matches: string[] }[];
  incognito: "not_allowed";
  action: { default_title: string };
}

// MV2: Firefox MV3 makes host permissions optional, so a user could revoke site access and stop blocking.
export const FIREFOX_MANIFEST_VERSION: number = 2;

export function buildFirefoxManifest(apiOrigin: string): Record<string, unknown> {
  return {
    ...buildManifest(apiOrigin),
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_ADDON_ID,
        update_url: FIREFOX_UPDATE_URL,
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["browsingActivity"] },
      },
    },
  };
}

export function buildManifest(apiOrigin: string): ManifestParts {
  return {
    permissions: ["tabs", "idle", "storage", "alarms", "declarativeNetRequest"],
    host_permissions: [`${apiOrigin}/*`, "<all_urls>"],
    web_accessible_resources: [{ resources: ["blocked.html"], matches: ["<all_urls>"] }],
    incognito: "not_allowed",
    action: { default_title: "Family Guardian" },
  };
}
