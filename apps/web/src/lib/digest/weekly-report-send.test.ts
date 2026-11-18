import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReportPeriod } from "./schedule";
import type { DigestFamilyRow } from "./send";
import { handleWeeklyReportSend, type ReportStore } from "./weekly-report-send";
import type { WeeklyReportMessage } from "./weekly-report";

const NOW = new Date("2026-11-16T08:00:00Z"); // Monday, send moment of a family with hour 8 on UTC
const SECRET = "s3cret";
const AUTH = `Bearer ${SECRET}`;
const PERIOD_START = "2026-11-09";

const family = (id: string, over: Partial<DigestFamilyRow> = {}): DigestFamilyRow => ({
  id,
  frequency: "daily",
  hour: 8,
  timezone: "UTC",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

type StoreOpts = {
  /** Every family, with its opt-in flag. */
  families?: { row: DigestFamilyRow; optedIn: boolean }[];
  parents?: Record<string, string[]>;
  listThrows?: boolean;
  claimFalseFor?: string;
  existingClaims?: string[];
};

// A store that behaves like the real one: one claim per (family, frequency, period); listFamilies returns all families.
function fakeStore(opts: StoreOpts = {}) {
  const all = opts.families ?? [{ row: family("fam-1"), optedIn: true }];
  const parents = opts.parents ?? { "fam-1": ["a@x.test", "b@x.test"] };
  const claims = new Set<string>(opts.existingClaims ?? []);
  const key = (f: string, q: string, p: string) => `${f}|${q}|${p}`;

  const listFamilies = vi.fn(async () => all.map((f) => f.row));
  const listReportFamilies = vi.fn(async () => {
    if (opts.listThrows) throw new Error("db down");
    return all.filter((f) => f.optedIn).map((f) => f.row);
  });
  const claimDigest = vi.fn(async (familyId: string, frequency: string, periodStart: string) => {
    if (opts.claimFalseFor === familyId) return false;
    if (claims.has(key(familyId, frequency, periodStart))) return false;
    claims.add(key(familyId, frequency, periodStart));
    return true;
  });
  const releaseDigest = vi.fn(async (familyId: string, frequency: string, periodStart: string) => {
    claims.delete(key(familyId, frequency, periodStart));
  });
  const listParentEmails = vi.fn(async (familyId: string) => parents[familyId] ?? []);
  const store: ReportStore = { listReportFamilies, claimDigest, releaseDigest, listParentEmails };
  return { store: { ...store, listFamilies } as ReportStore, claims, listFamilies, listReportFamilies, claimDigest, releaseDigest, listParentEmails };
}

type Sent = { to: string; subject: string; text: string; html: string };

function fakeMailer(mode: "ok" | "rejectAll" | "rejectFirst" = "ok") {
  let n = 0;
  const messages: Sent[] = [];
  const send = vi.fn(async (m: Sent) => {
    n += 1;
    messages.push(m);
    if (mode === "rejectAll" || (mode === "rejectFirst" && n === 1)) return { ok: false };
    return { ok: true };
  });
  return { mailer: { send }, send, messages };
}

const message = (familyId: string): WeeklyReportMessage => ({
  subject: "Family Guardian: weekly report 2026-11-09 to 2026-11-15",
  text: `Report for ${familyId}: Mia used khanacademy.org`,
  html: `<html lang="en"><body><h1>Report for ${familyId}</h1></body></html>`,
});

type Fakes = {
  store: ReturnType<typeof fakeStore>;
  mail: ReturnType<typeof fakeMailer>;
  build: ReturnType<typeof vi.fn<(f: DigestFamilyRow, p: ReportPeriod) => Promise<WeeklyReportMessage>>>;
};

const fakes = (opts: StoreOpts = {}, mode: "ok" | "rejectAll" | "rejectFirst" = "ok", failBuildFor?: string): Fakes => ({
  store: fakeStore(opts),
  mail: fakeMailer(mode),
  build: vi.fn(async (f: DigestFamilyRow, _p: ReportPeriod) => {
    if (f.id === failBuildFor) throw new Error("build failed");
    return message(f.id);
  }),
});

function run(
  f: Fakes,
  over: {
    authorization?: string | null;
    secret?: string | undefined;
    mailConfigured?: boolean;
    appUrl?: string | undefined;
    now?: Date;
    log?: (c: unknown) => void;
  } = {},
) {
  return handleWeeklyReportSend({
    authorization: "authorization" in over ? (over.authorization ?? null) : AUTH,
    secret: "secret" in over ? over.secret : SECRET,
    mailConfigured: over.mailConfigured ?? true,
    appUrl: "appUrl" in over ? over.appUrl : "https://app.example.test",
    now: over.now ?? NOW,
    store: f.store.store,
    mailer: f.mail.mailer,
    build: f.build,
    log: over.log ?? (() => undefined),
  });
}

const counts = (sent: number, skipped: number, failed: number) => ({ sent, skipped, failed });

function expectUntouched(f: Fakes) {
  const s = f.store;
  for (const fn of [s.listReportFamilies, s.listFamilies, s.claimDigest, s.releaseDigest, s.listParentEmails, f.mail.send, f.build]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleWeeklyReportSend", () => {
  it("Once per week with two parents", async () => {
    const f = fakes();
    const first = await run(f);
    const second = await run(f);

    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(f.mail.messages.map((m) => m.to).sort()).toEqual(["a@x.test", "b@x.test"]);
    for (const m of f.mail.messages) {
      expect({ subject: m.subject, text: m.text, html: m.html }).toEqual(message("fam-1"));
    }
    expect(f.store.claimDigest).toHaveBeenCalledWith("fam-1", "weekly_report", PERIOD_START);
    expect(first).toEqual({ status: 200, body: counts(1, 0, 0) });
    expect(second).toEqual({ status: 200, body: counts(0, 1, 0) });
  });

  it("Opt-in only", async () => {
    const f = fakes({
      families: [
        { row: family("fam-1"), optedIn: true },
        { row: family("fam-2"), optedIn: false },
      ],
      parents: { "fam-1": ["a@x.test"], "fam-2": ["c@x.test"] },
    });
    const res = await run(f);
    expect(f.store.claimDigest).toHaveBeenCalledTimes(1);
    expect(f.store.claimDigest).toHaveBeenCalledWith("fam-1", "weekly_report", PERIOD_START);
    expect(f.mail.messages.map((m) => m.to)).toEqual(["a@x.test"]);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 0) });
  });

  it("Claim key does not collide with the digest", async () => {
    const f = fakes({ existingClaims: [`fam-1|weekly|${PERIOD_START}`] });
    const res = await run(f);
    expect(f.store.claimDigest).toHaveBeenCalledWith("fam-1", "weekly_report", PERIOD_START);
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 0) });
  });

  it("Claim lost or no parents", async () => {
    const f = fakes({
      families: [
        { row: family("fam-1"), optedIn: true },
        { row: family("fam-2"), optedIn: true },
      ],
      parents: { "fam-1": ["a@x.test"], "fam-2": [] },
      claimFalseFor: "fam-1",
    });
    const res = await run(f);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(f.store.releaseDigest).not.toHaveBeenCalled();
    expect(f.store.claims.has(`fam-2|weekly_report|${PERIOD_START}`)).toBe(true);
    expect(res).toEqual({ status: 200, body: counts(0, 2, 0) });
  });

  it("Send and build failures", async () => {
    const all = fakes({}, "rejectAll");
    const failed = await run(all);
    expect(all.mail.send).toHaveBeenCalledTimes(2);
    expect(all.store.releaseDigest).toHaveBeenCalledWith("fam-1", "weekly_report", PERIOD_START);
    expect(all.store.claims.size).toBe(0);
    expect(failed).toEqual({ status: 200, body: counts(0, 0, 1) });

    const one = fakes({}, "rejectFirst");
    const partial = await run(one);
    expect(one.mail.send).toHaveBeenCalledTimes(2);
    expect(one.store.releaseDigest).not.toHaveBeenCalled();
    expect(one.store.claims.size).toBe(1);
    expect(partial).toEqual({ status: 200, body: counts(1, 0, 0) });

    const two = fakes(
      {
        families: [
          { row: family("fam-1"), optedIn: true },
          { row: family("fam-2"), optedIn: true },
        ],
        parents: { "fam-1": ["a@x.test"], "fam-2": ["c@x.test"] },
      },
      "ok",
      "fam-1",
    );
    const res = await run(two);
    expect(two.store.releaseDigest).toHaveBeenCalledWith("fam-1", "weekly_report", PERIOD_START);
    expect(two.store.claims.has(`fam-1|weekly_report|${PERIOD_START}`)).toBe(false);
    expect(two.mail.messages.map((m) => m.to)).toEqual(["c@x.test"]);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 1) });
  });

  it("Listing failure and logs", async () => {
    const down = fakes({ listThrows: true });
    expect(await run(down)).toEqual({ status: 500, body: { error: "server_error" } });
    expect(down.mail.send).not.toHaveBeenCalled();
    expect(down.store.claimDigest).not.toHaveBeenCalled();

    const logged: unknown[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void logged.push(args)),
    );
    await run(fakes({}, "rejectFirst"), { log: (c) => logged.push(c) });
    await run(fakes({}, "ok", "fam-1"), { log: (c) => logged.push(c) });
    await run(fakes({ listThrows: true }), { log: (c) => logged.push(c) });
    spies.forEach((s) => s.mockRestore());

    const text = JSON.stringify(logged);
    for (const secretValue of ["a@x.test", "b@x.test", "Mia", "khanacademy.org", "fam-1", SECRET, "Bearer"]) {
      expect(text, secretValue).not.toContain(secretValue);
    }
  });

  it("Wrong credentials", async () => {
    for (const authorization of [null, "", "s3cret", "Basic s3cret", "Bearer wrong"]) {
      const f = fakes();
      const res = await run(f, { authorization });
      expect(res, String(authorization)).toEqual({ status: 401, body: { error: "unauthorized" } });
      expectUntouched(f);
    }
  });

  it("Secret not configured", async () => {
    for (const secret of [undefined, ""]) {
      for (const authorization of ["Bearer ", "Bearer undefined", AUTH]) {
        const f = fakes();
        const res = await run(f, { secret, authorization });
        expect(res, `${String(secret)} / ${authorization}`).toEqual({ status: 500, body: { error: "server_error" } });
        expect(f.store.claimDigest).not.toHaveBeenCalled();
        expectUntouched(f);
      }
    }
  });

  it("APP_URL missing", async () => {
    const f = fakes();
    expect(await run(f, { appUrl: undefined })).toEqual({ status: 500, body: { error: "server_error" } });
    expect(f.store.claimDigest).not.toHaveBeenCalled();
    expect(f.mail.send).not.toHaveBeenCalled();
  });

  it("Mail not configured", async () => {
    const f = fakes();
    expect(await run(f, { mailConfigured: false })).toEqual({ status: 500, body: { error: "server_error" } });
    expect(f.store.claimDigest).not.toHaveBeenCalled();
    expect(f.mail.send).not.toHaveBeenCalled();
  });
});
