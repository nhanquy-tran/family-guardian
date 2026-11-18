import { beforeEach, describe, expect, it } from "vitest";
import { createDb, createUser, type Db } from "../../supabase/tests/harness.ts";
import { pgliteStore } from "./pglite-store.ts";
import { generate, LEO, STAGES } from "./scenario.ts";
import { seed, teardown } from "./store.ts";

const NOW = new Date("2026-11-18T09:30:00Z");
const FAMILY_TABLES = ["children", "devices", "usage_minutes", "block_rules", "block_events", "child_category_limits", "domain_categories", "alerts"];

async function count(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params);
  return res.rows[0]?.n ?? 0;
}

async function totals(db: Db): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of [...FAMILY_TABLES, "families", "parents", "auth.users"]) out[t] = await count(db, t.includes(".") ? t : `public.${t}`);
  return out;
}

describe("seed and teardown", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createDb();
  });

  it.each(STAGES)("stage %s inserts every row of the fixture", async (stage) => {
    const f = generate(stage, NOW);
    const { familyId } = await seed(pgliteStore(db), f);
    expect(await count(db, "public.families where id = $1 and name = $2 and timezone = $3", [familyId, f.family.name, f.family.timezone])).toBe(1);
    expect(await count(db, "public.children where family_id = $1", [familyId])).toBe(f.children.length);
    expect(await count(db, "public.devices")).toBe(f.devices.length);
    expect(await count(db, "public.usage_minutes")).toBe(f.usage.length);
    expect(await count(db, "public.block_rules")).toBe(f.blockRules.length);
    expect(await count(db, "public.block_events")).toBe(f.blockEvents.length);
    expect(await count(db, "public.child_category_limits")).toBe(f.categoryLimits.length);
    expect(await count(db, "public.domain_categories where family_id = $1", [familyId])).toBe(f.categoryOverrides.length);
    expect(await count(db, "public.alerts")).toBe(f.alerts.length);
  });

  it("teardown restores the database to its state before the seed", async () => {
    await createUser(db, "Real parent");
    const before = await totals(db);
    await seed(pgliteStore(db), generate("alerts", NOW));
    expect((await totals(db))["usage_minutes"]).toBeGreaterThan(0);
    await teardown(pgliteStore(db));
    expect(await totals(db)).toEqual(before);
  });

  it("seeding twice replaces the first seed instead of failing or duplicating", async () => {
    const store = pgliteStore(db);
    await seed(store, generate("alerts", NOW));
    const first = await totals(db);
    await seed(store, generate("alerts", NOW));
    expect(await totals(db)).toEqual(first);
  });

  it("switching stages leaves only the new stage's rows", async () => {
    const store = pgliteStore(db);
    await seed(store, generate("alerts", NOW));
    await seed(store, generate("onboarded", NOW));
    expect(await count(db, "public.usage_minutes")).toBe(0);
    expect(await count(db, "public.block_rules where child_id = $1", [LEO])).toBe(0);
    expect(await count(db, "public.alerts")).toBe(0);
  });

  it("teardown never touches another family or the global category list", async () => {
    const other = await createUser(db, "Other parent");
    await db.query("insert into public.children (family_id, name) values ($1, 'Other child')", [other.familyId]);
    const globals = await count(db, "public.domain_categories where family_id is null");
    await seed(pgliteStore(db), generate("alerts", NOW));
    await teardown(pgliteStore(db));
    expect(await count(db, "public.children where family_id = $1", [other.familyId])).toBe(1);
    expect(await count(db, "public.parents where family_id = $1", [other.familyId])).toBe(1);
    expect(await count(db, "public.domain_categories where family_id is null")).toBe(globals);
  });
});
