import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { captureFamilyTimezone, saveDigestSettings } from "./settings";

type Row = Record<string, unknown>;

/**
 * Fake client for `families`. update(values) applies to the rows that pass the eq() filters added after it
 * (RLS stands in for the caller's family filter), and select() returns the changed rows.
 * `fail` makes the update return an error, `noRows` makes it change nothing.
 */
function fakeClient(rows: Row[], opts: { fail?: boolean; noRows?: boolean } = {}) {
  const updates: Row[] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("families");
    return {
      update(values: Row) {
        updates.push(values);
        const filters: [string, unknown][] = [];
        const builder = {
          eq(col: string, value: unknown) {
            filters.push([col, value]);
            return builder;
          },
          select() {
            return builder;
          },
          then(resolve: (v: unknown) => void) {
            if (opts.fail) return resolve({ data: null, error: { message: "db error" } });
            const hit = opts.noRows ? [] : rows.filter((r) => filters.every(([c, v]) => r[c] === v));
            for (const r of hit) Object.assign(r, values);
            resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
          },
        };
        return builder;
      },
    };
  });
  return { client: { from } as unknown as SupabaseClient, rows, updates, from };
}

const defaults = (): Row => ({ id: "fam-1", timezone: "UTC", timezone_known: false, digest_frequency: "daily", digest_hour: 8 });

describe("saveDigestSettings", () => {
  it("Valid save", async () => {
    const f = fakeClient([defaults()]);
    const result = await saveDigestSettings(f.client, { frequency: "weekly", hour: 6, timezone: "Europe/Zurich" });
    expect(result).toEqual({ ok: true });
    expect(f.updates).toEqual([
      { digest_frequency: "weekly", digest_hour: 6, timezone: "Europe/Zurich", timezone_known: true },
    ]);
  });

  it("Invalid input or failed update", async () => {
    const valid = { frequency: "daily", hour: 8, timezone: "UTC" };
    const invalid = [
      { ...valid, frequency: "monthly" },
      { ...valid, hour: 24 },
      { ...valid, hour: -1 },
      { ...valid, hour: 8.5 },
      { ...valid, hour: "8" },
      { ...valid, timezone: "Not/AZone" },
    ];
    for (const input of invalid) {
      const f = fakeClient([defaults()]);
      expect(await saveDigestSettings(f.client, input), JSON.stringify(input)).toEqual({ ok: false, error: "invalid" });
      expect(f.updates, JSON.stringify(input)).toEqual([]);
    }

    // boundaries that are valid
    for (const hour of [0, 23]) {
      const f = fakeClient([defaults()]);
      expect(await saveDigestSettings(f.client, { ...valid, hour })).toEqual({ ok: true });
    }

    const erroring = fakeClient([defaults()], { fail: true });
    expect(await saveDigestSettings(erroring.client, valid)).toEqual({ ok: false, error: "failed" });
    const noRows = fakeClient([defaults()], { noRows: true });
    expect(await saveDigestSettings(noRows.client, valid)).toEqual({ ok: false, error: "failed" });
  });
});

describe("captureFamilyTimezone", () => {
  it("First visit captures the timezone once", async () => {
    const fresh = fakeClient([defaults()]);
    await captureFamilyTimezone(fresh.client, "Europe/Zurich");
    expect(fresh.rows[0]).toMatchObject({ timezone: "Europe/Zurich", timezone_known: true });

    const known = fakeClient([{ ...defaults(), timezone: "Asia/Tokyo", timezone_known: true }]);
    await captureFamilyTimezone(known.client, "Europe/Zurich");
    expect(known.rows[0]).toMatchObject({ timezone: "Asia/Tokyo", timezone_known: true });
  });
});
