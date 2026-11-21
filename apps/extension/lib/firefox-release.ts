export interface ReleaseOptions {
  /** Path of the AMO-signed .xpi to publish. */
  file: string;
  /** Directory holding updates.json, latest.xpi and the versioned files. */
  outDir: string;
  addonId: string;
  /** `version` of apps/extension/package.json. */
  buildVersion: string;
  /** Writes one file (a temp path or the target path); tests inject failures. */
  write?: (path: string, data: Uint8Array) => void | Promise<void>;
}

export async function releaseFirefox(_options: ReleaseOptions): Promise<void> {
  throw new Error("not implemented");
}
