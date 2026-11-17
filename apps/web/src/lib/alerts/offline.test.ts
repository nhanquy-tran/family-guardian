import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOfflineAlerts, type OfflineAlertStore, type OfflineDevice } from "./offline";

const NOW = new Date("2026-11-17T12:00:00Z");
const NOW_ISO = "2026-11-17T12:00:00.000Z";
const SECRET = "s3cret";
const AUTH = `Bearer ${SECRET}`;
const LAST_SEEN = "2026-11-17T11:40:00.000Z";

const dev = (over: Partial<OfflineDevice> = {}): OfflineDevice => ({
  deviceId: "dev-1",
  familyId: "fam-1",
  childName: "Mia",
  browser: "Edge",
  os: "Windows",
  lastSeenAt: LAST_SEEN,
  ...over,
});

type Claim = { deviceId: string; lastSeenAt: string; emailedAt: null };

type StoreOpts = { devices?: OfflineDevice[]; findThrows?: boolean; claimResult?: boolean };

// A store that behaves like the real one: claims are unique per (device, incident) and claimed pairs are not found again.
function fakeStore(opts: StoreOpts = {}) {
  const devices = opts.devices ?? [dev()];
  const claims: Claim[] = [];
  const same = (c: Claim, deviceId: string, lastSeenAt: string) =>
    c.deviceId === deviceId && Date.parse(c.lastSeenAt) === Date.parse(lastSeenAt);

  const findOfflineDevices = vi.fn(async (_now: string) => {
    if (opts.findThrows) throw new Error("db down");
    return devices.filter((d) => !claims.some((c) => same(c, d.deviceId, d.lastSeenAt)));
  });
  const claimAlert = vi.fn(async (deviceId: string, lastSeenAt: string, emailedAt: null) => {
    if (opts.claimResult === false) return false;
    if (claims.some((c) => same(c, deviceId, lastSeenAt))) return false;
    claims.push({ deviceId, lastSeenAt, emailedAt });
    return true;
  });
  const resolveReturned = vi.fn(async (_now: string) => undefined);
  const store: OfflineAlertStore = { findOfflineDevices, claimAlert, resolveReturned };
  return { store, claims, findOfflineDevices, claimAlert, resolveReturned };
}

// The handler no longer takes a mailer; the fake is passed anyway to prove nothing is mailed.
function fakeMailer() {
  const send = vi.fn(async () => ({ ok: true }));
  return { send };
}

type Fakes = { store: ReturnType<typeof fakeStore>; mailer: ReturnType<typeof fakeMailer> };

function run(
  f: Fakes,
  over: { authorization?: string | null; secret?: string | undefined; log?: (c: unknown) => void } = {},
) {
  const input = {
    authorization: "authorization" in over ? (over.authorization ?? null) : AUTH,
    secret: "secret" in over ? over.secret : SECRET,
    now: NOW,
    store: f.store.store,
    mailer: f.mailer,
    log: over.log ?? (() => undefined),
  };
  return handleOfflineAlerts(input);
}

const fakes = (opts: StoreOpts = {}): Fakes => ({ store: fakeStore(opts), mailer: fakeMailer() });

const counts = (recorded: number, skipped: number) => ({ recorded, skipped });

function expectUntouched(f: Fakes) {
  const s = f.store;
  for (const fn of [s.findOfflineDevices, s.claimAlert, s.resolveReturned, f.mailer.send]) {
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

  it("Incident recorded, nothing mailed", async () => {
    const f = fakes();
    const first = await run(f);
    const second = await run(f);

    expect(f.store.claimAlert).toHaveBeenCalledTimes(1); // the second run finds no unclaimed incident
    expect(f.store.claimAlert).toHaveBeenCalledWith("dev-1", LAST_SEEN, null);
    expect(f.mailer.send).not.toHaveBeenCalled();
    expect(first).toEqual({ status: 200, body: counts(1, 0) });
    expect(second).toEqual({ status: 200, body: counts(0, 0) });
    // incidents of devices that reported again are resolved on every run, with the run's time
    expect(f.store.resolveReturned).toHaveBeenCalledTimes(2);
    expect(f.store.resolveReturned).toHaveBeenCalledWith(NOW_ISO);
  });

  it("Incident already recorded by a concurrent run", async () => {
    const f = fakes({ claimResult: false });
    const res = await run(f);
    expect(f.mailer.send).not.toHaveBeenCalled();
    expect(res).toEqual({ status: 200, body: counts(0, 1) });
  });

  it("Store failure and unconfigured secret", async () => {
    const down = fakes({ findThrows: true });
    expect(await run(down)).toEqual({ status: 500, body: { error: "server_error" } });
    expect(down.mailer.send).not.toHaveBeenCalled();

    for (const secret of [undefined, ""]) {
      for (const authorization of ["Bearer ", "Bearer undefined"]) {
        const f = fakes();
        const res = await run(f, { secret, authorization });
        expect(res, `${String(secret)} / ${authorization}`).toEqual({ status: 500, body: { error: "server_error" } });
        expectUntouched(f);
      }
    }
  });

  it("Logs carry only counts", async () => {
    const logged: unknown[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void logged.push(args)),
    );
    await run(fakes(), { log: (c) => logged.push(c) });
    await run(fakes({ findThrows: true }), { log: (c) => logged.push(c) });
    spies.forEach((s) => s.mockRestore());

    const text = JSON.stringify(logged);
    for (const secretValue of ["Mia", "dev-1", "fam-1", SECRET, "Bearer"]) {
      expect(text, secretValue).not.toContain(secretValue);
    }
  });
});
