import { HeartbeatEnvelope, HeartbeatRequest } from "@fg/shared";
import { describe, expect, it, vi } from "vitest";
import { flushQueue } from "../../apps/extension/lib/sender";
import { always, createStore, entries, NOW } from "../../apps/extension/lib/test-fakes";
import { siteAccessLostLines } from "../../apps/web/src/lib/alerts/site-access-banner";
import { buildDigest, type DigestSource } from "../../apps/web/src/lib/digest/content";
import { handleHeartbeat, type HeartbeatStore } from "../../apps/web/src/lib/device/heartbeat";
import { hashDeviceToken } from "../../apps/web/src/lib/device/token";
import { attempt, createDb, createUser } from "../../supabase/tests/harness";

const base = { entries: [], currentDomain: null, browser: "chrome", extensionVersion: "0.4.0" };

describe("acceptance: heartbeat contract", () => {
  it("acceptance: siteAccess must be a real boolean next to other optional fields", () => {
    const blocked = [{ at: "2026-11-17T10:00:00Z", domain: "tiktok.com" }];
    for (const schema of [HeartbeatRequest, HeartbeatEnvelope]) {
      expect(schema.safeParse({ ...base, blocked, siteAccess: false }).success).toBe(true);
      for (const bad of ["true", 1, [], {}]) {
        expect(schema.safeParse({ ...base, blocked, siteAccess: bad }).success, JSON.stringify(bad)).toBe(false);
      }
    }
  });
});

describe("acceptance: server stores the flag", () => {
  it("acceptance: only a present flag reaches the device update", async () => {
    const updateDevice = vi.fn(async (_id: string, _patch: Record<string, unknown>) => undefined);
    const store: HeartbeatStore = {
      findDevice: async (hash) => (hash === hashDeviceToken("tok-2") ? { deviceId: "dev-2", rulesVersion: 1 } : null),
      upsertUsage: async () => undefined,
      insertBlocked: async () => undefined,
      updateDevice,
      otherUsage: async () => null,
    };
    const send = (body: unknown) =>
      handleHeartbeat({
        authorization: "Bearer tok-2",
        rawBody: JSON.stringify(body),
        now: new Date("2026-11-18T08:00:00Z"),
        store,
        log: () => undefined,
      });
    for (const body of [{ ...base, siteAccess: false }, { ...base, siteAccess: false }, { ...base, siteAccess: true }, base]) {
      expect((await send(body)).status).toBe(200);
    }
    const patches = updateDevice.mock.calls.map((c) => c[1]);
    expect(patches.map((p) => p["site_access"])).toEqual([false, false, true, undefined]);
    expect(Object.keys(patches[0] ?? {}).sort()).toEqual(["browser", "extension_version", "last_seen_at", "site_access"]);
    expect(Object.keys(patches[3] ?? {}).sort()).toEqual(["browser", "extension_version", "last_seen_at"]);
  });
});

describe("acceptance: extension sender", () => {
  it("acceptance: every chunk of one flush carries the same answer", async () => {
    const { post, calls } = always({ status: 200, body: { rulesVersion: 1 } });
    const fake = createStore({ queue: entries(1, 3000) });
    await flushQueue({
      now: NOW,
      token: "tok-1",
      baseUrl: "https://fg.example",
      browser: "firefox",
      extensionVersion: "0.4.0",
      currentDomain: null,
      keepAliveOnly: false,
      siteAccess: false,
      store: fake.store,
      post,
    });
    expect(calls.length).toBeGreaterThan(1);
    for (const c of calls) {
      expect(c.body["siteAccess"]).toBe(false);
      expect(() => HeartbeatRequest.parse(c.body)).not.toThrow();
    }
  });
});

describe("acceptance: incidents in the database", () => {
  it("acceptance: devices are independent, every loss makes its own incident, purge keeps 90 days", async () => {
    const db = await createDb();
    const { familyId } = await createUser(db, "Parent");
    const child = (
      await db.query<{ id: string }>("insert into children (family_id, name) values ($1, 'Zed') returning id", [familyId])
    ).rows[0]!.id;
    const device = async (n: number) =>
      (
        await db.query<{ id: string }>(
          "insert into devices (child_id, token_hash, browser, os) values ($1, $2, 'chrome', 'Windows') returning id",
          [child, `acc-site-access-${n}`],
        )
      ).rows[0]!.id;
    const [x, y] = [await device(1), await device(2)];

    for (const value of [false, true, false, true, false, true]) {
      await db.query("update devices set site_access = $2 where id = $1", [x, value]);
    }
    const count = async (id: string) =>
      Number((await db.query<{ n: number }>("select count(*)::int n from site_access_incidents where device_id = $1", [id])).rows[0]!.n);
    expect(await count(x)).toBe(3);
    expect(await count(y)).toBe(0);
    expect(
      Number((await db.query<{ n: number }>("select count(*)::int n from site_access_incidents where resolved_at is null")).rows[0]!.n),
    ).toBe(0);

    // unrelated device updates never create or close incidents
    await db.query("update devices set site_access = false where id = $1", [y]);
    await db.query("update devices set browser = 'edge' where id = $1", [y]);
    expect(await count(y)).toBe(1);

    await db.query("delete from site_access_incidents where device_id = $1", [x]);
    const insert = (startedHours: number, resolvedHours: number) =>
      db.query(
        "insert into site_access_incidents (device_id, started_at, resolved_at) values ($1, now() - make_interval(hours => $2), now() - make_interval(hours => $3))",
        [x, startedHours, resolvedHours],
      );
    await insert(90 * 24 + 5, 90 * 24 + 1); // resolved 90 days 1 hour ago: purged
    await insert(90 * 24 - 1, 90 * 24 - 2); // resolved 89 days 22 hours ago: kept
    expect((await attempt(db, "service", "select public.purge_site_access_incidents()")).ok).toBe(true);
    expect(await count(x)).toBe(1);
    expect(await count(y)).toBe(1); // open and young
  });
});

describe("acceptance: digest and banner", () => {
  it("acceptance: weekly digest lists the incident in the family timezone, only for the child that has one", async () => {
    const source: DigestSource = {
      listChildren: async () => [
        { id: "c1", name: "Ann", homeworkCategories: [], homeworkDomains: [] },
        { id: "c2", name: "Bao", homeworkCategories: [], homeworkDomains: [] },
      ],
      listIncidents: async () => [],
      listSiteAccessIncidents: async () => [
        { childId: "c2", browser: "Chrome", os: "Windows", startedAt: "2026-11-12T20:00:00.000Z", resolvedAt: null },
      ],
      readUsage: async () => [],
    };
    const { text } = await buildDigest({
      familyId: "fam",
      timezone: "Asia/Ho_Chi_Minh", // UTC+7: 20:00Z is 03:00 the next day
      period: { frequency: "weekly", periodStart: "2026-11-09", start: "2026-11-09T00:00:00.000Z", end: "2026-11-16T00:00:00.000Z" },
      appUrl: "https://app.example.test",
      source,
    });
    expect(text.match(/Site access off:/g)).toHaveLength(1);
    expect(text.indexOf("Site access off:")).toBeGreaterThan(text.indexOf("Bao"));
    expect(text).toContain("Chrome on Windows");
    expect(text).toContain("03:00");
    expect(text).toContain("still off");
    expect(text).not.toContain("20:00");
  });

  it("acceptance: a blank device name falls back to the browser label", () => {
    const lines = siteAccessLostLines([{ name: "   ", browser: "edge", os: "Windows", children: { name: "Kim" } }]);
    expect(lines).toEqual(["Blocking is off on Kim's Edge on Windows: site access was turned off"]);
  });
});
