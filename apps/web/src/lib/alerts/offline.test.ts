import { afterEach, describe, expect, it, vi } from "vitest";
import { activeOfflineAlerts, type BannerAlert } from "./banner";
import {
  handleOfflineAlerts,
  type Mailer,
  type OfflineAlertStore,
  type OfflineDevice,
  type OfflineMessage,
} from "./offline";

const NOW = new Date("2026-11-17T12:00:00Z");
const NOW_ISO = "2026-11-17T12:00:00.000Z";
const SINCE_ISO = "2026-11-16T12:00:00.000Z"; // now - 24 h
const SECRET = "s3cret";
const AUTH = `Bearer ${SECRET}`;
const NORMAL_TEXT = "This is normal if the laptop was switched off. If it should be on, check the browser.";

const dev = (over: Partial<OfflineDevice> = {}): OfflineDevice => ({
  deviceId: "dev-1",
  familyId: "fam-1",
  childName: "Mia",
  browser: "Edge",
  os: "Windows",
  lastSeenAt: "2026-11-17T11:40:00.000Z",
  ...over,
});

type Claim = { deviceId: string; lastSeenAt: string; emailedAt: string | null };

type StoreOpts = {
  devices?: OfflineDevice[];
  parents?: Record<string, string[]>;
  claims?: Claim[];
  findThrows?: boolean;
  claimResult?: boolean;
  parentsThrowFor?: string;
};

// A store that behaves like the real one: claims are unique per (device, incident) and claimed pairs are not found again.
function fakeStore(opts: StoreOpts = {}) {
  const devices = opts.devices ?? [dev()];
  const parents = opts.parents ?? { "fam-1": ["a@x.test", "b@x.test"] };
  const claims: Claim[] = [...(opts.claims ?? [])];
  const same = (c: Claim, deviceId: string, lastSeenAt: string) =>
    c.deviceId === deviceId && Date.parse(c.lastSeenAt) === Date.parse(lastSeenAt);

  const findOfflineDevices = vi.fn(async (_now: string) => {
    if (opts.findThrows) throw new Error("db down");
    return devices.filter((d) => !claims.some((c) => same(c, d.deviceId, d.lastSeenAt)));
  });
  const hasRecentEmail = vi.fn(async (deviceId: string, since: string) =>
    claims.some((c) => c.deviceId === deviceId && c.emailedAt !== null && Date.parse(c.emailedAt) > Date.parse(since)),
  );
  const claimAlert = vi.fn(async (deviceId: string, lastSeenAt: string, emailedAt: string | null) => {
    if (opts.claimResult === false) return false;
    if (claims.some((c) => same(c, deviceId, lastSeenAt))) return false;
    claims.push({ deviceId, lastSeenAt, emailedAt });
    return true;
  });
  const releaseAlert = vi.fn(async (deviceId: string, lastSeenAt: string) => {
    const i = claims.findIndex((c) => same(c, deviceId, lastSeenAt));
    if (i >= 0) claims.splice(i, 1);
  });
  const listParentEmails = vi.fn(async (familyId: string) => {
    if (opts.parentsThrowFor === familyId) throw new Error("auth down");
    return parents[familyId] ?? [];
  });
  const store: OfflineAlertStore = { findOfflineDevices, hasRecentEmail, claimAlert, releaseAlert, listParentEmails };
  return { store, claims, findOfflineDevices, hasRecentEmail, claimAlert, releaseAlert, listParentEmails };
}

function fakeMailer(rejectFirst = false, rejectAll = false) {
  let n = 0;
  const messages: OfflineMessage[] = [];
  const send = vi.fn(async (m: OfflineMessage) => {
    n += 1;
    messages.push(m);
    if (rejectAll || (rejectFirst && n === 1)) return { ok: false };
    return { ok: true };
  });
  const mailer: Mailer = { send };
  return { mailer, send, messages };
}

type Fakes = { store: ReturnType<typeof fakeStore>; mail: ReturnType<typeof fakeMailer> };

function run(
  f: Fakes,
  over: { authorization?: string | null; secret?: string | undefined; mailConfigured?: boolean; log?: (c: unknown) => void } = {},
) {
  return handleOfflineAlerts({
    authorization: "authorization" in over ? (over.authorization ?? null) : AUTH,
    secret: "secret" in over ? over.secret : SECRET,
    mailConfigured: over.mailConfigured ?? true,
    now: NOW,
    store: f.store.store,
    mailer: f.mail.mailer,
    log: over.log ?? (() => undefined),
  });
}

const fakes = (opts: StoreOpts = {}, mail = fakeMailer()): Fakes => ({ store: fakeStore(opts), mail });

const counts = (sent: number, skipped: number, failed: number, throttled: number) => ({ sent, skipped, failed, throttled });

function expectUntouched(f: Fakes) {
  const s = f.store;
  for (const fn of [s.findOfflineDevices, s.hasRecentEmail, s.claimAlert, s.releaseAlert, s.listParentEmails, f.mail.send]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleOfflineAlerts", () => {
  it("Wrong or missing credentials", async () => {
    for (const authorization of [null, "", "s3cret", "Basic s3cret", "Bearer wrong"]) {
      const f = fakes();
      const res = await run(f, { authorization });
      expect(res, String(authorization)).toEqual({ status: 401, body: { error: "unauthorized" } });
      expectUntouched(f);
    }
  });

  it("Secret not configured", async () => {
    for (const secret of [undefined, ""]) {
      for (const authorization of ["Bearer ", "Bearer undefined"]) {
        const f = fakes();
        const res = await run(f, { secret, authorization });
        expect(res, `${String(secret)} / ${authorization}`).toEqual({ status: 500, body: { error: "server_error" } });
        expect(f.store.findOfflineDevices).not.toHaveBeenCalled();
        expect(f.store.claimAlert).not.toHaveBeenCalled();
        expectUntouched(f);
      }
    }
  });

  it("Mail not configured", async () => {
    const f = fakes();
    const res = await run(f, { mailConfigured: false });
    expect(res.status).toBe(500);
    expect(f.store.claimAlert).not.toHaveBeenCalled();
    expect(f.mail.send).not.toHaveBeenCalled();
    // authentication still comes first
    const bad = await run(fakes(), { mailConfigured: false, authorization: "Bearer wrong" });
    expect(bad.status).toBe(401);
  });

  it("Two parents are alerted once", async () => {
    const f = fakes();
    const first = await run(f);
    const second = await run(f);

    expect(f.mail.send).toHaveBeenCalledTimes(2); // 2 parents x 1 incident, second run finds nothing
    expect(f.mail.messages.map((m) => m.to).sort()).toEqual(["a@x.test", "b@x.test"]);
    for (const m of f.mail.messages) {
      for (const part of ["Mia", "Edge", "Windows", "2026-11-17 11:40 UTC", NORMAL_TEXT]) {
        expect(m.text, part).toContain(part);
      }
    }
    expect(first).toEqual({ status: 200, body: counts(1, 0, 0, 0) });
    expect(second).toEqual({ status: 200, body: counts(0, 0, 0, 0) });
  });

  it("Claim lost to a concurrent run", async () => {
    const f = fakes({ claimResult: false });
    const res = await run(f);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(res).toEqual({ status: 200, body: counts(0, 1, 0, 0) });
  });

  it("No parents", async () => {
    const f = fakes({ parents: { "fam-1": [] } });
    const res = await run(f);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(f.store.claims).toHaveLength(1);
    expect(f.store.releaseAlert).not.toHaveBeenCalled();
    expect(res).toEqual({ status: 200, body: counts(0, 1, 0, 0) });
  });

  it("Second incident within 24 hours", async () => {
    const earlier: Claim = { deviceId: "dev-1", lastSeenAt: "2026-11-17T07:30:00.000Z", emailedAt: "2026-11-17T08:00:00.000Z" }; // 12:00 - 08:00 = 4 h
    const f = fakes({ claims: [earlier] });
    const res = await run(f);

    expect(f.store.claimAlert).toHaveBeenCalledWith("dev-1", "2026-11-17T11:40:00.000Z", null);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(res).toEqual({ status: 200, body: counts(0, 0, 0, 1) });

    const recorded = f.store.claims.find((c) => c.lastSeenAt === "2026-11-17T11:40:00.000Z");
    expect(recorded).toBeDefined();
    const banner: BannerAlert = {
      id: "alert-2",
      sent_at: NOW_ISO,
      incident_last_seen_at: recorded!.lastSeenAt,
      devices: { last_seen_at: "2026-11-17T11:40:00.000Z", browser: "Edge", os: "Windows", children: { name: "Mia" } },
    };
    expect(activeOfflineAlerts([banner]).map((a) => a.id)).toEqual(["alert-2"]);
  });

  it("Incident after 24 hours", async () => {
    // 2026-11-16T11:59:59Z is 24 h 1 s before now
    const old: Claim = { deviceId: "dev-1", lastSeenAt: "2026-11-16T11:30:00.000Z", emailedAt: "2026-11-16T11:59:59.000Z" };
    const f = fakes({ claims: [old] });
    const res = await run(f);

    expect(f.store.claimAlert).toHaveBeenCalledWith("dev-1", "2026-11-17T11:40:00.000Z", NOW_ISO);
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 0, 0) });
  });

  it("Throttle boundary", async () => {
    // emailed exactly 24 h before now: 12:00 on 2026-11-16
    const edge: Claim = { deviceId: "dev-1", lastSeenAt: "2026-11-16T11:30:00.000Z", emailedAt: SINCE_ISO };
    const f = fakes({ claims: [edge] });
    const res = await run(f);

    expect(f.store.hasRecentEmail).toHaveBeenCalledWith("dev-1", SINCE_ISO);
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 0, 0) });
  });

  it("All sends fail", async () => {
    const f = fakes({}, fakeMailer(false, true));
    const res = await run(f);
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(f.store.releaseAlert).toHaveBeenCalledWith("dev-1", "2026-11-17T11:40:00.000Z");
    expect(res).toEqual({ status: 200, body: counts(0, 0, 1, 0) });

    // the released claim left no emailed_at, so a later run with a working mailer sends
    expect(f.store.claims).toHaveLength(0);
    const retry: Fakes = { store: f.store, mail: fakeMailer() };
    const again = await run(retry);
    expect(retry.mail.send).toHaveBeenCalledTimes(2);
    expect(again).toEqual({ status: 200, body: counts(1, 0, 0, 0) });
  });

  it("One send fails", async () => {
    const f = fakes({}, fakeMailer(true));
    const res = await run(f);
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(f.store.releaseAlert).not.toHaveBeenCalled();
    expect(res).toEqual({ status: 200, body: counts(1, 0, 0, 0) });
  });

  it("Store failure", async () => {
    const f = fakes({ findThrows: true });
    const res = await run(f);
    expect(res).toEqual({ status: 500, body: { error: "server_error" } });
    expect(f.mail.send).not.toHaveBeenCalled();
  });

  it("One device fails, others continue", async () => {
    const first = dev({ deviceId: "dev-1", familyId: "fam-1" });
    const second = dev({ deviceId: "dev-2", familyId: "fam-2", childName: "Leo" });
    const f = fakes({
      devices: [first, second],
      parents: { "fam-1": ["a@x.test"], "fam-2": ["c@x.test"] },
      parentsThrowFor: "fam-1",
    });
    const res = await run(f);

    expect(f.store.releaseAlert).toHaveBeenCalledWith("dev-1", first.lastSeenAt);
    expect(f.mail.messages.map((m) => m.to)).toEqual(["c@x.test"]);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 1, 0) });
  });

  it("Logs carry only counts", async () => {
    const logged: unknown[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void logged.push(args)),
    );
    const f = fakes({}, fakeMailer(true));
    await run(f, { log: (c) => logged.push(c) });
    // also a failing run, which tends to log errors
    await run(fakes({ findThrows: true }), { log: (c) => logged.push(c) });
    spies.forEach((s) => s.mockRestore());

    const text = JSON.stringify(logged);
    for (const secretValue of ["a@x.test", "b@x.test", "Mia", "dev-1", "fam-1", SECRET, "Bearer"]) {
      expect(text, secretValue).not.toContain(secretValue);
    }
  });
});
