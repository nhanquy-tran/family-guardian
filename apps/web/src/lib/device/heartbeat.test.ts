import { HeartbeatResponse, MAX_HEARTBEAT_ENTRIES } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { handleHeartbeat, type HeartbeatStore } from "./heartbeat";
import { hashDeviceToken } from "./token";

const NOW = new Date("2026-11-17T10:05:30Z");

type Row = { device_id: string; minute_utc: string; domain: string; seconds: number };

type BlockedRow = { device_id: string; at: string; domain: string };

function fakeStore(
  opts: {
    known?: boolean;
    findThrows?: boolean;
    upsertThrows?: boolean;
    updateThrows?: boolean;
    blockedThrows?: boolean;
    other?: unknown;
    otherThrows?: boolean;
  } = {},
) {
  const known = opts.known ?? true;
  const findDevice = vi.fn(async (hash: string) => {
    if (opts.findThrows) throw new Error("db down");
    return known && hash === hashDeviceToken("tok-1") ? { deviceId: "dev-1", rulesVersion: 3 } : null;
  });
  const upsertUsage = vi.fn(async (_rows: Row[]) => {
    if (opts.upsertThrows) throw new Error("db down");
  });
  const updateDevice = vi.fn(async (_id: string, _patch: { last_seen_at: string; browser: string; extension_version: string }) => {
    if (opts.updateThrows) throw new Error("db down");
  });
  const insertBlocked = vi.fn(async (_rows: BlockedRow[]) => {
    if (opts.blockedThrows) throw new Error("db down");
  });
  const otherUsage = vi.fn(async (_deviceId: string) => {
    if (opts.otherThrows) throw new Error("db down");
    return (opts.other ?? null) as Awaited<ReturnType<HeartbeatStore["otherUsage"]>>;
  });
  const store: HeartbeatStore = { findDevice, upsertUsage, insertBlocked, updateDevice, otherUsage };
  return { store, findDevice, upsertUsage, insertBlocked, updateDevice, otherUsage };
}

type Fake = ReturnType<typeof fakeStore>;

const entry = (minuteUtc: unknown, domain: unknown, seconds: unknown) => ({ minuteUtc, domain, seconds });

function body(over: Record<string, unknown> = {}) {
  return { entries: [], currentDomain: null, browser: "edge", extensionVersion: "0.2.0", ...over };
}

async function call(
  f: Fake,
  opts: { authorization?: string | null; raw?: string; body?: unknown; now?: Date } = {},
) {
  const log = vi.fn();
  const result = await handleHeartbeat({
    authorization: opts.authorization === undefined ? "Bearer tok-1" : opts.authorization,
    rawBody: opts.raw ?? JSON.stringify(opts.body ?? body()),
    now: opts.now ?? NOW,
    store: f.store,
    log,
  });
  return { ...result, log };
}

function nothingWritten(f: Fake) {
  expect(f.upsertUsage).not.toHaveBeenCalled();
  expect(f.insertBlocked).not.toHaveBeenCalled();
  expect(f.updateDevice).not.toHaveBeenCalled();
}

function upserted(f: Fake): Row[] {
  expect(f.upsertUsage).toHaveBeenCalledTimes(1);
  return f.upsertUsage.mock.calls[0]![0];
}

const row = (minute: string, domain: string, seconds: number): Row => ({ device_id: "dev-1", minute_utc: minute, domain, seconds });

describe("device authentication", () => {
  it("Missing or malformed header", async () => {
    for (const authorization of [null, "", "tok-1", "Basic tok-1", "Bearer ", "Bearer a b"]) {
      const f = fakeStore();
      const res = await call(f, { authorization });
      expect(res.status, String(authorization)).toBe(401);
      expect(res.body).toEqual({ error: "unauthorized" });
      expect(f.findDevice).not.toHaveBeenCalled();
      nothingWritten(f);
    }
  });

  it("Scheme is case-insensitive", async () => {
    for (const authorization of ["bearer tok-1", "BEARER tok-1"]) {
      const f = fakeStore();
      const res = await call(f, { authorization });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rulesVersion: 3 });
      expect(f.findDevice).toHaveBeenCalledWith(hashDeviceToken("tok-1"));
    }
  });

  it("Unknown or revoked token", async () => {
    const f = fakeStore({ known: false });
    const res = await call(f, { authorization: "Bearer tok-x" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
    expect(f.findDevice).toHaveBeenCalledWith(hashDeviceToken("tok-x"));
    nothingWritten(f);
  });

  it("Auth checked before body", async () => {
    const f = fakeStore();
    const res = await call(f, { authorization: null, raw: "not json" });
    expect(res.status).toBe(401);
  });

  it("Device lookup fails", async () => {
    const f = fakeStore({ findThrows: true });
    const res = await call(f);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "server_error" });
    nothingWritten(f);
  });
});

describe("envelope validation", () => {
  it("Envelope check order", async () => {
    const f = fakeStore();
    const entries = Array.from({ length: 1441 }, () => entry("2026-11-17T10:03:00Z", "youtube.com", 10));
    const res = await call(f, { body: body({ entries, browser: "firefox" }) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
  });

  it("Invalid JSON", async () => {
    const f = fakeStore();
    const res = await call(f, { raw: '{"entries":' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
    nothingWritten(f);
  });

  it("Envelope failure", async () => {
    const { extensionVersion: _v, ...noVersion } = body();
    const { currentDomain: _c, ...noCurrent } = body();
    const cases = [
      body({ browser: "firefox" }),
      noVersion,
      body({ extensionVersion: "x".repeat(33) }),
      body({ entries: "nope" }),
      noCurrent,
    ];
    for (const b of cases) {
      const f = fakeStore();
      const res = await call(f, { body: b });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "invalid_request" });
      nothingWritten(f);
    }
  });
});

describe("batch size cap", () => {
  it("Exactly the cap", async () => {
    const f = fakeStore();
    const start = Date.parse("2026-11-16T10:00:00Z");
    const entries = Array.from({ length: MAX_HEARTBEAT_ENTRIES }, (_, i) =>
      entry(new Date(start + i * 60_000).toISOString(), "youtube.com", 10),
    );
    const res = await call(f, { body: body({ entries }) });
    expect(res.status).toBe(200);
    expect(upserted(f)).toHaveLength(1440);
  });

  it("Above the cap", async () => {
    const f = fakeStore();
    const entries = Array.from({ length: 1441 }, () => entry("2026-11-17T10:03:00Z", "youtube.com", 10));
    const res = await call(f, { body: body({ entries }) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "too_many_entries" });
    nothingWritten(f);
  });
});

describe("request log with counts only", () => {
  it("Logger receives counts only", async () => {
    const f = fakeStore();
    const res = await call(f, {
      body: body({
        entries: [
          entry("2026-11-17T10:03:00Z", "youtube.com", 10),
          entry("2026-11-17T10:04:00Z", "khanacademy.org", 20),
          entry("2026-11-17T10:04:00Z", "youtube.com", 61),
        ],
      }),
    });
    expect(res.log).toHaveBeenCalledTimes(1);
    expect(res.log).toHaveBeenCalledWith({ accepted: 2, skipped: 1 });
    const logged = JSON.stringify(res.log.mock.calls);
    for (const secret of ["youtube.com", "khanacademy.org", "tok-1", "dev-1", "127.0.0.1"]) {
      expect(logged.includes(secret), secret).toBe(false);
    }
  });

  it("No log for rejected requests", async () => {
    const unauthorized = await call(fakeStore(), { authorization: null });
    const badJson = await call(fakeStore(), { raw: "nope" });
    const tooMany = await call(fakeStore(), {
      body: body({ entries: Array.from({ length: 1441 }, () => entry("2026-11-17T10:03:00Z", "youtube.com", 10)) }),
    });
    expect([unauthorized.status, badJson.status, tooMany.status]).toEqual([401, 400, 413]);
    for (const r of [unauthorized, badJson, tooMany]) expect(r.log).not.toHaveBeenCalled();
  });
});

describe("idempotent usage storage", () => {
  it("Entries stored for the device", async () => {
    const f = fakeStore();
    const res = await call(f, {
      body: body({
        entries: [entry("2026-11-17T10:03:00Z", "youtube.com", 40), entry("2026-11-17T10:04:00Z", "khanacademy.org", 60)],
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
    const rows = upserted(f);
    expect(rows).toEqual([
      row("2026-11-17T10:03:00.000Z", "youtube.com", 40),
      row("2026-11-17T10:04:00.000Z", "khanacademy.org", 60),
    ]);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(["device_id", "domain", "minute_utc", "seconds"]);
  });

  it("Duplicate entries in one request", async () => {
    const f = fakeStore();
    await call(f, {
      body: body({ entries: [entry("2026-11-17T10:03:00Z", "youtube.com", 20), entry("2026-11-17T10:03:00Z", "youtube.com", 35)] }),
    });
    expect(upserted(f)).toEqual([row("2026-11-17T10:03:00.000Z", "youtube.com", 35)]);
  });

  it("No entries", async () => {
    const f = fakeStore();
    const res = await call(f);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
    expect(f.upsertUsage).not.toHaveBeenCalled();
  });
});

describe("invalid, stale, future and malformed entries are skipped", () => {
  const good = entry("2026-11-17T10:04:00Z", "khanacademy.org", 60);
  const goodRow = row("2026-11-17T10:04:00.000Z", "khanacademy.org", 60);

  it("One invalid entry among valid ones", async () => {
    const f = fakeStore();
    const res = await call(f, {
      body: body({
        entries: [
          entry("2026-11-17T10:03:00Z", "youtube.com", 40),
          entry("2026-11-17T10:03:00Z", "khanacademy.org", 61),
          good,
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
    expect(upserted(f)).toEqual([row("2026-11-17T10:03:00.000Z", "youtube.com", 40), goodRow]);
  });

  it("Seconds out of range", async () => {
    const f = fakeStore();
    const m = "2026-11-17T10:03:00Z";
    const res = await call(f, {
      body: body({
        entries: [entry(m, "youtube.com", 0), entry(m, "youtube.com", 61), entry(m, "youtube.com", -5), entry(m, "youtube.com", 1.5), entry(m, "youtube.com", 60)],
      }),
    });
    expect(res.status).toBe(200);
    expect(upserted(f)).toEqual([row("2026-11-17T10:03:00.000Z", "youtube.com", 60)]);
  });

  it("Non-ISO minute", async () => {
    const f = fakeStore();
    const res = await call(f, {
      body: body({
        entries: [entry("yesterday", "youtube.com", 10), entry("2026-11-17 10:03", "youtube.com", 10), entry(1763373780, "youtube.com", 10), good],
      }),
    });
    expect(res.status).toBe(200);
    expect(upserted(f)).toEqual([goodRow]);
  });

  it("Entry that is not an object", async () => {
    const f = fakeStore();
    const res = await call(f, { body: body({ entries: [null, "x", 5, good] }) });
    expect(res.status).toBe(200);
    expect(upserted(f)).toEqual([goodRow]);
  });

  it("Age and clock skew limits", async () => {
    const f = fakeStore();
    const minutes = [
      "2026-11-10T10:05:00Z",
      "2026-11-10T10:04:00Z",
      "2026-11-17T10:05:00Z",
      "2026-11-17T10:10:00Z",
      "2026-11-17T10:11:00Z",
      "2026-11-18T00:00:00Z",
    ];
    const res = await call(f, { body: body({ entries: minutes.map((m) => entry(m, "youtube.com", 10)) }) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
    expect(upserted(f).map((r) => r.minute_utc)).toEqual([
      "2026-11-10T10:05:00.000Z",
      "2026-11-17T10:05:00.000Z",
      "2026-11-17T10:10:00.000Z",
    ]);
  });

  it("Not a whole minute", async () => {
    const f = fakeStore();
    await call(f, { body: body({ entries: [entry("2026-11-17T10:03:30Z", "youtube.com", 10), entry("2026-11-17T10:04:00Z", "youtube.com", 10)] }) });
    expect(upserted(f)).toEqual([row("2026-11-17T10:04:00.000Z", "youtube.com", 10)]);
  });

  it("Domain the database would reject", async () => {
    const f = fakeStore();
    const m = "2026-11-17T10:03:00Z";
    const res = await call(f, {
      body: body({ entries: ["localhost", "YouTube.com", "youtube.com/watch", "youtube.com"].map((d) => entry(m, d, 10)) }),
    });
    expect(res.status).toBe(200);
    expect(upserted(f)).toEqual([row("2026-11-17T10:03:00.000Z", "youtube.com", 10)]);
  });

  it("All entries skipped", async () => {
    const f = fakeStore();
    const res = await call(f, { body: body({ entries: [entry("2026-11-17T10:11:00Z", "youtube.com", 10)] }) });
    expect(res.status).toBe(200);
    expect(f.upsertUsage).not.toHaveBeenCalled();
    expect(f.updateDevice).toHaveBeenCalledTimes(1);
  });
});

describe("device status update", () => {
  it("Device updated", async () => {
    const f = fakeStore();
    await call(f, { body: body({ currentDomain: "youtube.com", entries: [entry("2026-11-17T10:03:00Z", "khanacademy.org", 10)] }) });
    expect(f.updateDevice).toHaveBeenCalledTimes(1);
    expect(f.updateDevice).toHaveBeenCalledWith("dev-1", {
      last_seen_at: "2026-11-17T10:05:30.000Z",
      browser: "edge",
      extension_version: "0.2.0",
    });
    const args = JSON.stringify([f.findDevice.mock.calls, f.upsertUsage.mock.calls, f.updateDevice.mock.calls]);
    expect(args.includes("youtube.com")).toBe(false);
  });

  it("Store failure", async () => {
    for (const opts of [{ upsertThrows: true }, { updateThrows: true }]) {
      const f = fakeStore(opts);
      const res = await call(f, { body: body({ entries: [entry("2026-11-17T10:03:00Z", "youtube.com", 10)] }) });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "server_error" });
    }
  });
});

describe("blocked attempts are stored from heartbeats", () => {
  const MIN = 60_000;
  const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
  const valid = { at: iso(-MIN), domain: "tiktok.com" };
  const validRow: BlockedRow = { device_id: "dev-1", at: valid.at, domain: "tiktok.com" };

  it("Valid blocked attempt stored", async () => {
    const f = fakeStore();
    const res = await call(f, {
      body: body({ entries: [entry("2026-11-17T10:03:00Z", "khanacademy.org", 10)], blocked: [valid] }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
    expect(f.insertBlocked).toHaveBeenCalledTimes(1);
    expect(f.insertBlocked).toHaveBeenCalledWith([validRow]);
    const usageOrder = f.upsertUsage.mock.invocationCallOrder[0]!;
    const blockedOrder = f.insertBlocked.mock.invocationCallOrder[0]!;
    const updateOrder = f.updateDevice.mock.invocationCallOrder[0]!;
    expect(usageOrder).toBeLessThan(blockedOrder);
    expect(blockedOrder).toBeLessThan(updateOrder);
  });

  it("Invalid attempts skipped, valid ones kept", async () => {
    const f = fakeStore();
    const res = await call(f, {
      body: body({
        blocked: [
          { at: iso(-8 * 24 * 60 * MIN), domain: "tiktok.com" },
          { at: iso(10 * MIN), domain: "tiktok.com" },
          { at: iso(-MIN), domain: "tiktok.com/@x" },
          "not an object",
          valid,
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(f.insertBlocked).toHaveBeenCalledTimes(1);
    expect(f.insertBlocked).toHaveBeenCalledWith([validRow]);
    expect(res.log).toHaveBeenCalledTimes(1);
    expect(res.log.mock.calls[0]![0].skipped).toBe(4);

    const none = fakeStore();
    const noneRes = await call(none, { body: body({ blocked: [{ at: iso(10 * MIN), domain: "tiktok.com" }] }) });
    expect(noneRes.status).toBe(200);
    expect(none.insertBlocked).not.toHaveBeenCalled();
  });

  it("Request without blocked unchanged", async () => {
    const f = fakeStore();
    const res = await call(f, { body: body({ entries: [entry("2026-11-17T10:03:00Z", "khanacademy.org", 10)] }) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
    expect(f.upsertUsage).toHaveBeenCalledTimes(1);
    expect(f.updateDevice).toHaveBeenCalledTimes(1);
    expect(f.insertBlocked).not.toHaveBeenCalled();
  });

  it("Blocked insert failure", async () => {
    const f = fakeStore({ blockedThrows: true });
    const res = await call(f, { body: body({ blocked: [valid] }) });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "server_error" });
  });
});

describe("blocked attempts are bounded and idempotent", () => {
  const start = Date.parse("2026-11-17T09:00:00Z");
  const attempts = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ at: new Date(start + i * 1000).toISOString(), domain: "tiktok.com" }));

  it("Too many blocked attempts", async () => {
    const f = fakeStore();
    const res = await call(f, { body: body({ blocked: attempts(1001) }) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "too_many_entries" });
    nothingWritten(f);

    const ok = fakeStore();
    const okRes = await call(ok, { body: body({ blocked: attempts(1000) }) });
    expect(okRes.status).toBe(200);
    expect(ok.insertBlocked).toHaveBeenCalledTimes(1);
    expect(ok.insertBlocked.mock.calls[0]![0]).toHaveLength(1000);
  });

  it("Duplicate attempts in one request stored once", async () => {
    const f = fakeStore();
    const dup = { at: "2026-11-17T10:04:00Z", domain: "tiktok.com" };
    await call(f, { body: body({ blocked: [dup, dup] }) });
    expect(f.insertBlocked).toHaveBeenCalledTimes(1);
    expect(f.insertBlocked.mock.calls[0]![0]).toHaveLength(1);
  });
});

describe("rules version in the response", () => {
  it("Response shape", async () => {
    const res = await call(fakeStore());
    expect(res.status).toBe(200);
    expect(HeartbeatResponse.parse(res.body)).toEqual({ rulesVersion: 3 });
  });
});

describe("heartbeat other usage", () => {
  const other = { day: "2026-11-17", seconds: { games: 600 } };

  it("Other device seconds by category", async () => {
    const f = fakeStore({ other });
    const res = await call(f);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3, otherUsage: other });
    expect(f.otherUsage).toHaveBeenCalledWith("dev-1");
    expect(JSON.stringify(res.body)).not.toMatch(/\.com/);
  });

  it("Computation fails", async () => {
    const f = fakeStore({ otherThrows: true });
    const res = await call(f, { body: body({ entries: [entry("2026-11-17T10:04:00.000Z", "youtube.com", 30)] }) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
    expect(upserted(f)).toEqual([row("2026-11-17T10:04:00.000Z", "youtube.com", 30)]);
  });

  it("Invalid value is omitted", async () => {
    const f = fakeStore({ other: { day: "x", seconds: { games: -1 } } });
    const res = await call(f);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rulesVersion: 3 });
  });
});
