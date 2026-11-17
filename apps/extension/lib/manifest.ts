export interface ManifestParts {
  permissions: string[];
  host_permissions: string[];
  web_accessible_resources: { resources: string[]; matches: string[] }[];
  incognito: "not_allowed";
}

export function buildManifest(_apiOrigin: string): ManifestParts {
  throw new Error("not implemented");
}
