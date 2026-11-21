import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDigest, type DigestMessage, type DigestSource } from "./content";
import { handleDigestSend, type DigestFamilyRow, type DigestStore } from "./send";
import type { DuePeriod } from "./schedule";

const NOW = new Date("2026-11-18T08:00:00Z"); // send moment of a daily family with hour 8 on UTC
const SECRET = "s3cret";
const AUTH = `Bearer ${SECRET}`;
const PERIOD_START = "2026-11-17"; // the local day before the send moment

const family = (id: string, over: Partial<DigestFamilyRow> = {}): DigestFamilyRow => ({
  id,
  frequency: "daily",
  hour: 8,
  timezone: "UTC",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

type StoreOpts = {
  families?: DigestFamilyRow[];
  parents?: Record<string, string[]>;
  listThrows?: boolean;
  claimFalseFor?: string;
};

// A store that behaves like the real one: one claim per (family, frequency, period).
function fakeStore(opts: StoreOpts = {}) {
  const families = opts.families ?? [family("fam-1")];
  const parents = opts.parents ?? { "fam-1": ["a@x.test", "b@x.test"] };
  const claims = new Set<string>();
  const key = (f: string, q: string, p: string) => `${f}|${q}|${p}`;

  const listFamilies = vi.fn(async () => {
    if (opts.listThrows) throw new Error("db down");
    return families;
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
  const store: DigestStore = { listFamilies, claimDigest, releaseDigest, listParentEmails };
  return { store, claims, listFamilies, claimDigest, releaseDigest, listParentEmails };
}

function fakeMailer(mode: "ok" | "rejectAll" | "rejectFirst" = "ok") {
  let n = 0;
  const messages: { to: string; subject: string; text: string }[] = [];
  const send = vi.fn(async (m: { to: string; subject: string; text: string }) => {
    n += 1;
    messages.push(m);
    if (mode === "rejectAll" || (mode === "rejectFirst" && n === 1)) return { ok: false };
    return { ok: true };
  });
  return { mailer: { send }, send, messages };
}

const message = (familyId: string): DigestMessage => ({
  subject: `Family Guardian: daily digest ${PERIOD_START}`,
  text: `Digest for ${familyId}: Mia used khanacademy.org`,
});

type Fakes = {
  store: ReturnType<typeof fakeStore>;
  mail: ReturnType<typeof fakeMailer>;
  build: ReturnType<typeof vi.fn<(f: DigestFamilyRow, p: DuePeriod) => Promise<DigestMessage>>>;
};

const fakes = (opts: StoreOpts = {}, mode: "ok" | "rejectAll" | "rejectFirst" = "ok", failBuildFor?: string): Fakes => ({
  store: fakeStore(opts),
  mail: fakeMailer(mode),
  build: vi.fn(async (f: DigestFamilyRow) => {
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
  return handleDigestSend({
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
  for (const fn of [s.listFamilies, s.claimDigest, s.releaseDigest, s.listParentEmails, f.mail.send, f.build]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleDigestSend", () => {
  it("Listing fails", async () => {
    const f = fakes();
    const source: DigestSource = {
      listChildren: async () => [{ id: "c-mia", name: "Mia", homeworkCategories: [], homeworkDomains: [] }],
      listIncidents: async () => [],
      listSiteAccessIncidents: async () => {
        throw new Error("db down");
      },
      readUsage: async () => [],
    };
    f.build.mockImplementation((fam, period) =>
      buildDigest({ familyId: fam.id, timezone: fam.timezone, period, appUrl: "https://app.example.test", source }),
    );
    const res = await run(f);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(f.store.releaseDigest).toHaveBeenCalledWith("fam-1", "daily", PERIOD_START);
    expect(res).toEqual({ status: 200, body: counts(0, 0, 1) });
  });

  it("Once per period with two parents", async () => {
    const f = fakes();
    const first = await run(f);
    const second = await run(f);

    expect(f.mail.send).toHaveBeenCalledTimes(2); // 2 parents x 1 family, the second run finds the claim
    expect(f.mail.messages.map((m) => m.to).sort()).toEqual(["a@x.test", "b@x.test"]);
    for (const m of f.mail.messages) expect({ subject: m.subject, text: m.text }).toEqual(message("fam-1"));
    expect(f.store.claimDigest).toHaveBeenCalledWith("fam-1", "daily", PERIOD_START);
    expect(first).toEqual({ status: 200, body: counts(1, 0, 0) });
    expect(second).toEqual({ status: 200, body: counts(0, 1, 0) });
  });

  it("Missed send is sent at the next run", async () => {
    const f = fakes();
    // 13:00Z is 5 h after the send moment and nothing was sent yet
    const res = await run(f, { now: new Date("2026-11-18T13:00:00Z") });
    expect(f.store.claimDigest).toHaveBeenCalledWith("fam-1", "daily", PERIOD_START);
    expect(f.mail.send).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 0) });
  });

  it("Claim lost or no parents", async () => {
    const f = fakes({
      families: [family("fam-1"), family("fam-2")],
      parents: { "fam-1": ["a@x.test"], "fam-2": [] },
      claimFalseFor: "fam-1",
    });
    const res = await run(f);
    expect(f.mail.send).not.toHaveBeenCalled();
    expect(f.store.releaseDigest).not.toHaveBeenCalled();
    expect(f.store.claims.has(`fam-2|daily|${PERIOD_START}`)).toBe(true);
    expect(res).toEqual({ status: 200, body: counts(0, 2, 0) });
  });

  it("Send failures", async () => {
    const all = fakes({}, "rejectAll");
    const failed = await run(all);
    expect(all.mail.send).toHaveBeenCalledTimes(2);
    expect(all.store.releaseDigest).toHaveBeenCalledWith("fam-1", "daily", PERIOD_START);
    expect(failed).toEqual({ status: 200, body: counts(0, 0, 1) });
    expect(all.store.claims.size).toBe(0);

    // a later run with a working mailer sends
    const retry: Fakes = { ...all, mail: fakeMailer("ok") };
    const again = await run(retry);
    expect(retry.mail.send).toHaveBeenCalledTimes(2);
    expect(again).toEqual({ status: 200, body: counts(1, 0, 0) });

    const one = fakes({}, "rejectFirst");
    const partial = await run(one);
    expect(one.mail.send).toHaveBeenCalledTimes(2);
    expect(one.store.releaseDigest).not.toHaveBeenCalled();
    expect(one.store.claims.size).toBe(1);
    expect(partial).toEqual({ status: 200, body: counts(1, 0, 0) });
  });

  it("Failures are isolated", async () => {
    const f = fakes(
      { families: [family("fam-1"), family("fam-2")], parents: { "fam-1": ["a@x.test"], "fam-2": ["c@x.test"] } },
      "ok",
      "fam-1",
    );
    const res = await run(f);
    expect(f.store.releaseDigest).toHaveBeenCalledWith("fam-1", "daily", PERIOD_START);
    expect(f.store.claims.has(`fam-1|daily|${PERIOD_START}`)).toBe(false);
    expect(f.mail.messages.map((m) => m.to)).toEqual(["c@x.test"]);
    expect(res).toEqual({ status: 200, body: counts(1, 0, 1) });

    const down = fakes({ listThrows: true });
    const listing = await run(down);
    expect(listing).toEqual({ status: 500, body: { error: "server_error" } });
    expect(down.mail.send).not.toHaveBeenCalled();
    expect(down.store.claimDigest).not.toHaveBeenCalled();
  });

  it("Logs carry only counts", async () => {
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

  it("Not configured", async () => {
    // secret unset or empty: nothing is accepted, not even an empty or guessed token
    for (const secret of [undefined, ""]) {
      for (const authorization of ["Bearer ", "Bearer undefined"]) {
        const f = fakes();
        const res = await run(f, { secret, authorization });
        expect(res, `${String(secret)} / ${authorization}`).toEqual({ status: 500, body: { error: "server_error" } });
        expectUntouched(f);
      }
    }

    const noUrl = fakes();
    expect(await run(noUrl, { appUrl: undefined })).toEqual({ status: 500, body: { error: "server_error" } });
    expect(noUrl.store.claimDigest).not.toHaveBeenCalled();
    expect(noUrl.mail.send).not.toHaveBeenCalled();

    const noMail = fakes();
    expect(await run(noMail, { mailConfigured: false })).toEqual({ status: 500, body: { error: "server_error" } });
    expect(noMail.store.claimDigest).not.toHaveBeenCalled();
    expect(noMail.mail.send).not.toHaveBeenCalled();
  });
});
