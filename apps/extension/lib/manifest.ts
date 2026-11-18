export interface ManifestParts {
  permissions: string[];
  host_permissions: string[];
  web_accessible_resources: { resources: string[]; matches: string[] }[];
  incognito: "not_allowed";
  action: { default_title: string };
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
