import { createHash } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

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

interface UpdateEntry {
  version: string;
  update_link: string;
  update_hash: string;
}

interface UpdateManifest {
  addons: Record<string, { updates: UpdateEntry[] }>;
}

const BASE_URL = "https://family-guardian.co/firefox/";

function readZip(buf: Buffer): Map<string, Buffer> {
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(end + 10);
  let pos = buf.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error("corrupt zip directory");
    const method = buf.readUInt16LE(pos + 10);
    const size = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const name = buf.toString("utf8", pos + 46, pos + 46 + nameLen);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error("corrupt zip entry");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    if (method === 0) files.set(name, body);
    else if (method === 8) files.set(name, inflateRawSync(body));
    else throw new Error(`unsupported zip method ${method}`);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function readOrNull(path: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

function compareVersions(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function validate(bytes: Buffer, addonId: string, buildVersion: string): void {
  if (!/^\d+(\.\d+)*$/.test(buildVersion)) throw new Error(`invalid build version ${buildVersion}`);
  const files = readZip(bytes);
  const raw = files.get("manifest.json");
  if (!raw) throw new Error("manifest.json missing");
  const manifest = JSON.parse(raw.toString("utf8")) as {
    version?: string;
    browser_specific_settings?: { gecko?: { id?: string } };
  };
  if (manifest.browser_specific_settings?.gecko?.id !== addonId) throw new Error("add-on id does not match");
  if (manifest.version !== buildVersion) throw new Error("manifest version does not match the build version");
  if (!files.has("META-INF/mozilla.rsa")) throw new Error("file is not signed by AMO");
}

export async function releaseFirefox(options: ReleaseOptions): Promise<void> {
  const { file, outDir, addonId, buildVersion } = options;
  const write = options.write ?? ((p: string, d: Uint8Array) => writeFileSync(p, d));
  const bytes = readFileSync(file);
  validate(bytes, addonId, buildVersion);

  const manifestPath = join(outDir, "updates.json");
  const latestPath = join(outDir, "latest.xpi");
  const versionedPath = join(outDir, `family-guardian-${buildVersion}.xpi`);
  const oldManifest = readFileSync(manifestPath);
  const manifest = JSON.parse(oldManifest.toString("utf8")) as UpdateManifest;
  const updates = manifest.addons[addonId]?.updates ?? [];
  const newest = updates[updates.length - 1];
  if (newest && compareVersions(buildVersion, newest.version) <= 0) {
    throw new Error(`version ${buildVersion} is not newer than ${newest.version}`);
  }
  if (readOrNull(versionedPath)) throw new Error(`${versionedPath} already exists`);

  const entry: UpdateEntry = {
    version: buildVersion,
    update_link: `${BASE_URL}family-guardian-${buildVersion}.xpi`,
    update_hash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
  const next: UpdateManifest = { ...manifest, addons: { ...manifest.addons, [addonId]: { updates: [...updates, entry] } } };
  const oldLatest = readOrNull(latestPath);

  const temps: string[] = [];
  const put = async (target: string, data: Uint8Array) => {
    const tmp = `${target}.tmp`;
    temps.push(tmp);
    await write(tmp, data);
    renameSync(tmp, target);
  };

  try {
    await put(versionedPath, bytes);
    await put(latestPath, bytes);
    await put(manifestPath, Buffer.from(`${JSON.stringify(next, null, 2)}\n`));
  } catch (err) {
    for (const t of temps) rmSync(t, { force: true });
    rmSync(versionedPath, { force: true });
    if (oldLatest) writeFileSync(latestPath, oldLatest);
    else rmSync(latestPath, { force: true });
    writeFileSync(manifestPath, oldManifest);
    throw err;
  }
}
