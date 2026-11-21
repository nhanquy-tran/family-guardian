import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";
import { beforeEach, describe, expect, it } from "vitest";
import { releaseFirefox } from "./firefox-release.ts";

const ID = "guardian@family-guardian.co";
const ROOT = join(__dirname, "..", "..", "..");
const EXT = join(__dirname, "..");
const EMPTY = JSON.stringify({ addons: { [ID]: { updates: [] } } });

interface ZipEntry {
  name: string;
  data: string | Buffer;
  deflate?: boolean;
}

// Builds a zip with a local header and a central directory entry per file (stored, or deflate when asked).
function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const raw = Buffer.from(e.data);
    const body = e.deflate ? deflateRawSync(raw) : raw;
    const method = e.deflate ? 8 : 0;
    const name = Buffer.from(e.name);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

function manifest(version: string, id = ID): string {
  return JSON.stringify({ manifest_version: 2, version, browser_specific_settings: { gecko: { id } } });
}

function xpi(version: string, opts: { id?: string; signed?: boolean; deflate?: boolean; extra?: string } = {}): Buffer {
  const entries: ZipEntry[] = [
    { name: "manifest.json", data: manifest(version, opts.id), deflate: opts.deflate },
    { name: "background.js", data: `// ${opts.extra ?? version}`, deflate: opts.deflate },
  ];
  if (opts.signed !== false) entries.push({ name: "META-INF/mozilla.rsa", data: "signature" });
  return zip(entries);
}

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).sort()) out[f] = readFileSync(join(dir, f)).toString("hex");
  return out;
}

function sha(buf: Buffer): string {
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

function listed(dir: string): { version: string; update_link: string; update_hash: string }[] {
  return JSON.parse(readFileSync(join(dir, "updates.json"), "utf8")).addons[ID].updates;
}

let dir: string;
let input: string;

function put(buf: Buffer | string): string {
  writeFileSync(input, buf);
  return input;
}

function run(buildVersion: string, file: string, write?: (p: string, d: Uint8Array) => void) {
  return Promise.resolve().then(() => releaseFirefox({ file, outDir: dir, addonId: ID, buildVersion, write }));
}

function realWrite(p: string, d: Uint8Array): void {
  writeFileSync(p, d);
}

async function release(version: string, extra?: string): Promise<Buffer> {
  const bytes = xpi(version, { extra });
  await run(version, put(bytes));
  return bytes;
}

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), "fg-release-"));
  dir = join(base, "out");
  mkdirSync(dir);
  writeFileSync(join(dir, "updates.json"), EMPTY);
  input = join(base, "signed.xpi");
});

describe("firefox release script", () => {
  it("Test zips", async () => {
    const bytes = xpi("0.3.0", { deflate: true });
    expect(bytes.subarray(0, 4).readUInt32LE(0)).toBe(0x04034b50);
    await run("0.3.0", put(bytes));
    expect(readFileSync(join(dir, "family-guardian-0.3.0.xpi")).equals(bytes)).toBe(true);
    const stored = xpi("0.3.1");
    await run("0.3.1", put(stored));
    expect(readFileSync(join(dir, "latest.xpi")).equals(stored)).toBe(true);
  });

  it("First release", async () => {
    const bytes = xpi("0.3.0");
    await run("0.3.0", put(bytes));
    expect(readFileSync(join(dir, "family-guardian-0.3.0.xpi")).equals(bytes)).toBe(true);
    expect(readFileSync(join(dir, "latest.xpi")).equals(bytes)).toBe(true);
    // one entry: version 0.3.0, link from the version, hash is the SHA-256 of the input file
    expect(listed(dir)).toEqual([
      { version: "0.3.0", update_link: "https://family-guardian.co/firefox/family-guardian-0.3.0.xpi", update_hash: sha(bytes) },
    ]);
    expect(readdirSync(dir).sort()).toEqual(["family-guardian-0.3.0.xpi", "latest.xpi", "updates.json"]);
  });

  it("Next release keeps the older one", async () => {
    const first = await release("0.3.0");
    const second = await release("0.3.1");
    expect(readFileSync(join(dir, "family-guardian-0.3.0.xpi")).equals(first)).toBe(true);
    expect(readFileSync(join(dir, "family-guardian-0.3.1.xpi")).equals(second)).toBe(true);
    expect(listed(dir).map((e) => e.version)).toEqual(["0.3.0", "0.3.1"]);
    expect(readFileSync(join(dir, "latest.xpi")).equals(second)).toBe(true);
  });

  it("Wrong add-on ID", async () => {
    const before = snapshot(dir);
    await expect(run("0.3.0", put(xpi("0.3.0", { id: "other@example.com" })))).rejects.toThrow();
    expect(snapshot(dir)).toEqual(before);
  });

  it("Wrong version", async () => {
    const before = snapshot(dir);
    await expect(run("0.3.0", put(xpi("0.3.1")))).rejects.toThrow();
    expect(snapshot(dir)).toEqual(before);
  });

  it("Unsigned file", async () => {
    const before = snapshot(dir);
    await expect(run("0.3.0", put(xpi("0.3.0", { signed: false })))).rejects.toThrow();
    expect(snapshot(dir)).toEqual(before);
  });

  it("Not a zip or no manifest", async () => {
    const before = snapshot(dir);
    await expect(run("0.3.0", put("this is just text"))).rejects.toThrow();
    const noManifest = zip([{ name: "background.js", data: "x" }, { name: "META-INF/mozilla.rsa", data: "s" }]);
    await expect(run("0.3.0", put(noManifest))).rejects.toThrow();
    expect(snapshot(dir)).toEqual(before);
  });

  it("Same or older version", async () => {
    await release("0.3.1");
    const before = snapshot(dir);
    await expect(run("0.3.1", put(xpi("0.3.1", { extra: "rebuilt" })))).rejects.toThrow();
    await expect(run("0.3.0", put(xpi("0.3.0")))).rejects.toThrow();
    expect(snapshot(dir)).toEqual(before);
  });

  it("Numeric version order", async () => {
    await release("0.9.0");
    await release("0.10.0");
    expect(listed(dir).map((e) => e.version)).toEqual(["0.9.0", "0.10.0"]);
    expect(readdirSync(dir)).toContain("family-guardian-0.10.0.xpi");
  });

  it("Write failure rolls back", async () => {
    await release("0.3.0");
    const before = snapshot(dir);
    const next = put(xpi("0.3.1"));
    for (const target of ["family-guardian-0.3.1.xpi", "latest.xpi", "updates.json"]) {
      const failing = (p: string, d: Uint8Array) => {
        if (p.includes(target)) throw new Error(`disk full at ${target}`);
        realWrite(p, d);
      };
      await expect(run("0.3.1", next, failing), target).rejects.toThrow();
      expect(snapshot(dir), target).toEqual(before);
    }
  });

  it("Rerun after a failure", async () => {
    await release("0.3.0");
    const bytes = xpi("0.3.1");
    const file = put(bytes);
    const failing = (p: string, d: Uint8Array) => {
      if (p.includes("updates.json")) throw new Error("disk full");
      realWrite(p, d);
    };
    await expect(run("0.3.1", file, failing)).rejects.toThrow();
    await run("0.3.1", file, realWrite);
    expect(listed(dir)).toHaveLength(2);
    expect(listed(dir)[1]).toEqual({
      version: "0.3.1",
      update_link: "https://family-guardian.co/firefox/family-guardian-0.3.1.xpi",
      update_hash: sha(bytes),
    });
    expect(readFileSync(join(dir, "latest.xpi")).equals(bytes)).toBe(true);
  });

  it("Rejects an invalid build version", async () => {
    const before = snapshot(dir);
    await expect(run("0.3.x", put(xpi("0.3.x")))).rejects.toThrow("invalid build version");
    expect(snapshot(dir)).toEqual(before);
  });

  it("Rejects an unsupported compression method", async () => {
    const bytes = xpi("0.3.0");
    bytes.writeUInt16LE(99, bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 10);
    const before = snapshot(dir);
    await expect(run("0.3.0", put(bytes))).rejects.toThrow("unsupported zip method");
    expect(snapshot(dir)).toEqual(before);
  });

  it("Rejects a corrupt zip directory or entry", async () => {
    const before = snapshot(dir);
    const badDir = xpi("0.3.0");
    badDir.writeUInt32LE(0, badDir.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])));
    await expect(run("0.3.0", put(badDir))).rejects.toThrow("corrupt zip directory");
    const badEntry = xpi("0.3.0");
    badEntry.writeUInt32LE(0, 0);
    await expect(run("0.3.0", put(badEntry))).rejects.toThrow("corrupt zip entry");
    expect(snapshot(dir)).toEqual(before);
  });

  it("Rejects when the versioned file already exists", async () => {
    writeFileSync(join(dir, "family-guardian-0.3.0.xpi"), "old");
    const before = snapshot(dir);
    await expect(run("0.3.0", put(xpi("0.3.0")))).rejects.toThrow("already exists");
    expect(snapshot(dir)).toEqual(before);
  });

  it("Write failure on a first release leaves no latest.xpi", async () => {
    const before = snapshot(dir);
    const failing = (p: string, d: Uint8Array) => {
      if (p.includes("updates.json")) throw new Error("disk full");
      realWrite(p, d);
    };
    await expect(run("0.3.0", put(xpi("0.3.0")), failing)).rejects.toThrow("disk full");
    expect(snapshot(dir)).toEqual(before);
  });

  it("Command-line wiring", () => {
    const ext = JSON.parse(readFileSync(join(EXT, "package.json"), "utf8"));
    const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(ext.scripts["firefox:release"]).toBe("node scripts/firefox-release.ts");
    expect(root.engines.node).toBe(">=22.18");
  });

  it("CLI runs as a child process", () => {
    // The CLI takes the output directory from FIREFOX_RELEASE_DIR (default apps/web/public/firefox) and the build version from package.json.
    const version = JSON.parse(readFileSync(join(EXT, "package.json"), "utf8")).version as string;
    const bytes = xpi(version);
    const runCli = (file: string) =>
      spawnSync("node", ["scripts/firefox-release.ts", file], { cwd: EXT, env: { ...process.env, FIREFOX_RELEASE_DIR: dir }, encoding: "utf8" });

    const bad = runCli(put("not a zip"));
    expect(bad.status).not.toBe(0);
    expect(snapshot(dir)).toEqual({ "updates.json": Buffer.from(EMPTY).toString("hex") });

    const ok = runCli(put(bytes));
    expect(ok.status, ok.stderr).toBe(0);
    expect(readFileSync(join(dir, `family-guardian-${version}.xpi`)).equals(bytes)).toBe(true);
    expect(readFileSync(join(dir, "latest.xpi")).equals(bytes)).toBe(true);
    expect(listed(dir).map((e) => e.version)).toEqual([version]);
  });
});
