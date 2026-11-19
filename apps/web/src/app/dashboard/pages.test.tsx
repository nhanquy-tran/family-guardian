import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { byTable, DB_ERROR, fakeSupabase, type FakeResult } from "../../lib/testing/fake-supabase";
import { NotFoundSignal } from "../../lib/testing/navigation";

const state = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof fakeSupabase>,
  loadUsage: vi.fn(),
  loadFocusOverview: vi.fn(),
}));

vi.mock("next/navigation", async () => ({
  ...(await import("../../lib/testing/navigation")).navigation,
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => state.fake.client }));
vi.mock("../../lib/usage", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadUsage: state.loadUsage,
}));
vi.mock("../../lib/focus-overview", () => ({ loadFocusOverview: state.loadFocusOverview }));

import OverviewPage from "./page";
import CategoriesPage from "./categories/page";
import ChildrenPage from "./children/page";
import HomeworkPage from "./children/[childId]/homework/page";
import RulesPage from "./children/[childId]/rules/page";
import DevicesPage from "./devices/page";
import SettingsPage from "./settings/page";
import UsagePage from "./usage/[childId]/page";

type Query = Record<string, string | string[] | undefined>;
const html = (element: ReactElement) => renderToStaticMarkup(element);
const query = (q: Query = {}) => Promise.resolve(q);
const child = (childId = "child-1") => Promise.resolve({ childId });
const use = (results: Record<string, FakeResult | FakeResult[]>) => {
  state.fake = fakeSupabase(byTable(results));
};

beforeEach(() => {
  use({});
  state.loadUsage.mockReset();
  state.loadFocusOverview.mockReset();
});

describe("rules page", () => {
  const childRow = (start: string | null, end: string | null) => ({
    data: { name: "Mia", allowed_start: start, allowed_end: end },
    error: null,
  });

  it("loads the child's rules, limits and hours scoped to the child", async () => {
    use({
      children: childRow("07:00", "21:00"),
      block_rules: { data: [{ id: "r1", kind: "domain", value: "youtube.com" }], error: null },
      child_category_limits: { data: [{ category: "games", minutes_per_day: 60 }], error: null },
    });
    const out = html(await RulesPage({ params: child(), searchParams: query() }));
    expect(out).toContain("Mia");
    expect(out).toContain("youtube.com");
    expect(out).toContain('value="60"');
    expect(out).toContain('value="07:00"');
    for (const table of ["children", "block_rules", "child_category_limits"]) {
      const call = state.fake.calls.find((c) => c.table === table);
      expect(call?.ops.some(([m, args]) => m === "eq" && args[1] === "child-1"), table).toBe(true);
    }
  });

  it("is not found for a child the parent cannot see", async () => {
    await expect(RulesPage({ params: child(), searchParams: query() })).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("shows the errors from the query", async () => {
    use({ children: childRow(null, null), block_rules: { data: [], error: null }, child_category_limits: { data: [], error: null } });
    const out = html(
      await RulesPage({
        params: child(),
        searchParams: query({ error: ["duplicate", "x"], limitsError: "invalid_minutes", hoursError: ["invalid_hours"] }),
      }),
    );
    expect(out).toContain("That site or category is already blocked");
    expect(out).toContain("Enter whole minutes between 5 and 1440");
    expect(out).toContain("Enter a start and an end time that are different");
  });

  it("shows load failures instead of empty lists", async () => {
    use({ children: childRow(null, null), block_rules: { data: null, error: DB_ERROR }, child_category_limits: { data: null, error: DB_ERROR } });
    const out = html(await RulesPage({ params: child(), searchParams: query({ error: "duplicate", limitsError: "invalid_minutes" }) }));
    expect(out).toContain("Rules could not be loaded or saved");
    expect(out).toContain("Limits could not be loaded or saved");
    expect(out).not.toContain("No sites blocked");
  });
});

describe("homework page", () => {
  it("shows the child's homework settings", async () => {
    use({ children: { data: { name: "Mia", homework_categories: ["education"], homework_domains: ["khan.org"] }, error: null } });
    const out = html(await HomeworkPage({ params: child(), searchParams: query() }));
    expect(out).toContain("Mia");
    expect(out).toContain("khan.org");
    expect(state.fake.calls[0]?.ops).toContainEqual(["eq", ["id", "child-1"]]);
  });

  it("is not found for a child the parent cannot see", async () => {
    await expect(HomeworkPage({ params: child(), searchParams: query() })).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("shows known query errors and ignores unknown ones", async () => {
    use({ children: { data: { name: "Mia", homework_categories: null, homework_domains: null }, error: null } });
    expect(html(await HomeworkPage({ params: child(), searchParams: query({ error: ["too_many"] }) }))).toContain(
      "You can add at most 50 sites",
    );
    expect(html(await HomeworkPage({ params: child(), searchParams: query({ error: "<b>" }) }))).not.toContain('role="alert"');
  });

  it("shows a load failure", async () => {
    use({ children: { data: null, error: DB_ERROR } });
    expect(html(await HomeworkPage({ params: child(), searchParams: query() }))).toContain("Settings could not be loaded or saved");
  });
});

describe("children page", () => {
  it("lists children with their active codes", async () => {
    use({
      children: { data: [{ id: "c1", name: "Mia", created_at: "2026-11-01T00:00:00Z" }], error: null },
      pairing_codes: { data: [{ code: "ABC234", child_id: "c1", expires_at: "2099-01-01T00:00:00Z" }], error: null },
    });
    const out = html(await ChildrenPage({ searchParams: query() }));
    expect(out).toContain("Mia");
    expect(out).toContain("ABC234");
    const codes = state.fake.calls.find((c) => c.table === "pairing_codes");
    expect(codes?.ops.some(([m]) => m === "gt")).toBe(true);
  });

  it("shows the add error and a pairing error for a known reason only", async () => {
    use({ children: { data: [{ id: "c1", name: "Mia", created_at: "2026-11-01T00:00:00Z" }], error: null } });
    const withReason = html(await ChildrenPage({ searchParams: query({ error: ["Name too long"], pairError: "c1", reason: "in-use" }) }));
    expect(withReason).toContain("Name too long");
    expect(withReason).toContain("This code is already in use");
    const unknown = html(await ChildrenPage({ searchParams: query({ pairError: "c1", reason: "boom" }) }));
    expect(unknown).not.toContain("already in use");
  });

  it("shows the delete confirmation", async () => {
    use({ children: { data: [{ id: "c1", name: "Mia", created_at: "2026-11-01T00:00:00Z" }], error: null } });
    expect(html(await ChildrenPage({ searchParams: query({ confirmDelete: "c1" }) }))).toContain("Confirm delete");
  });
});

describe("categories page", () => {
  it("lists the family's overrides and pre-fills a valid domain", async () => {
    use({ domain_categories: { data: [{ id: "o1", domain: "roblox.com", category: "games" }], error: null } });
    const out = html(await CategoriesPage({ searchParams: query({ domain: ["https://www.Minecraft.net/x"] }) }));
    expect(out).toContain("roblox.com");
    expect(out).toContain('value="minecraft.net"');
  });

  it("shows query errors, load failures and ignores an invalid domain", async () => {
    use({ domain_categories: { data: [], error: null } });
    const out = html(await CategoriesPage({ searchParams: query({ error: "not_found", domain: "not a domain" }) }));
    expect(out).toContain("That override no longer exists");
    expect(out).not.toContain("not a domain");
    use({ domain_categories: { data: null, error: DB_ERROR } });
    expect(html(await CategoriesPage({ searchParams: query() }))).toContain("Overrides could not be loaded or saved");
  });
});

describe("devices page", () => {
  const groups = {
    data: [
      {
        id: "c1",
        name: "Mia",
        devices: [
          { id: "d1", name: "Laptop", browser: "edge", os: "Windows", extension_version: "1.0.0", last_seen_at: null, created_at: "2026-11-01T00:00:00Z" },
        ],
      },
    ],
    error: null,
  };

  it("lists devices per child with a remove confirmation", async () => {
    use({ children: groups });
    const out = html(await DevicesPage({ searchParams: query({ remove: ["d1"] }) }));
    expect(out).toContain("Laptop");
    expect(out).toContain("Mia");
  });

  it("shows the query error and a load failure", async () => {
    use({ children: groups });
    expect(html(await DevicesPage({ searchParams: query({ error: "invalid-name" }) }))).toContain("Name must be 1 to 40 characters.");
    use({ children: { data: null, error: DB_ERROR } });
    expect(html(await DevicesPage({ searchParams: query() }))).toContain("Could not load devices");
  });
});

describe("overview page", () => {
  it("links to each child's usage", async () => {
    state.loadFocusOverview.mockResolvedValue({
      status: "ok",
      children: [{ id: "c 1", name: "Mia", categories: ["education"], extraDomains: [], result: { error: true } }],
    });
    const out = html(await OverviewPage({ searchParams: query({ tz: ["Europe/Zurich"] }) }));
    expect(out).toContain('href="/dashboard/usage/c%201"');
    expect(out).toContain("View usage for Mia");
    expect(state.loadFocusOverview.mock.calls[0]?.[1]).toBe("Europe/Zurich");
  });

  it("shows a load failure", async () => {
    state.loadFocusOverview.mockResolvedValue({ status: "error" });
    expect(html(await OverviewPage({ searchParams: query() }))).toContain("Could not load");
  });
});

describe("usage page", () => {
  it("loads the requested view in the browser timezone", async () => {
    state.loadUsage.mockResolvedValue({ status: "error" });
    const out = html(await UsagePage({ params: child(), searchParams: query({ view: ["week"], tz: "Asia/Ho_Chi_Minh" }) }));
    expect(state.loadUsage.mock.calls[0]?.[1]).toMatchObject({ childId: "child-1", tz: "Asia/Ho_Chi_Minh", view: "week" });
    expect(out).toMatch(/<a[^>]*aria-current="page"[^>]*>Week<\/a>/);
    expect(out).toContain("Could not load usage");
  });

  it("defaults to today", async () => {
    state.loadUsage.mockResolvedValue({ status: "error" });
    const out = html(await UsagePage({ params: child(), searchParams: query({ view: "month" }) }));
    expect(state.loadUsage.mock.calls[0]?.[1]).toMatchObject({ view: "today" });
    expect(out).toMatch(/<a[^>]*aria-current="page"[^>]*>Today<\/a>/);
  });

  it("is not found for a child the parent cannot see", async () => {
    state.loadUsage.mockResolvedValue({ status: "not-found" });
    await expect(UsagePage({ params: child(), searchParams: query() })).rejects.toBeInstanceOf(NotFoundSignal);
  });
});

describe("settings page", () => {
  it("shows the saved digest settings and status messages", async () => {
    use({
      families: [
        { data: { digest_frequency: "weekly", digest_hour: 6, timezone: "Europe/Zurich" }, error: null },
        { data: { weekly_report_enabled: true }, error: null },
      ],
    });
    const out = html(await SettingsPage({ searchParams: query({ saved: ["1"], error: "invalid" }) }));
    expect(out).toMatch(/<input(?=[^>]*value="weekly")[^>]*checked=""/);
    expect(out).toMatch(/<option[^>]*value="6"[^>]*selected=""/);
    expect(out).toContain("Saved");
    expect(out).toContain("Please check the values");
  });

  it("falls back to defaults when the family row is missing and reports a save failure", async () => {
    use({ families: { data: null, error: null } });
    const out = html(await SettingsPage({ searchParams: query({ error: "failed" }) }));
    expect(out).toMatch(/<input(?=[^>]*value="daily")[^>]*checked=""/);
    expect(out).toMatch(/<option[^>]*value="8"[^>]*selected=""/);
    expect(out).toContain("Could not save");
  });
});
