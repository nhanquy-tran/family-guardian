import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadWeeklyReportSetting: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: { digest_frequency: "daily", digest_hour: 8, timezone: "UTC" }, error: null }) }),
    }),
  }),
}));
vi.mock("../../../lib/digest/settings", () => ({ loadWeeklyReportSetting: mocks.loadWeeklyReportSetting }));
vi.mock("./actions", () => ({ saveDigestSettingsAction: vi.fn(), saveWeeklyReportAction: vi.fn() }));

async function render(): Promise<string> {
  const { default: Page } = await import("./page");
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => mocks.loadWeeklyReportSetting.mockReset());

describe("settings page", () => {
  it("Settings read failure is not shown as defaults", async () => {
    mocks.loadWeeklyReportSetting.mockResolvedValue({ ok: false });
    const html = await render();
    expect(html).toContain("Could not load the weekly report setting");
    expect(html).not.toMatch(/<input[^>]*name="weekly_report"/);
    expect(html).not.toMatch(/<input(?=[^>]*type="checkbox")[^>]*>/);
  });

  it("shows the checkbox when the setting loads", async () => {
    mocks.loadWeeklyReportSetting.mockResolvedValue({ ok: true, enabled: true });
    const html = await render();
    expect(html).toMatch(/<input(?=[^>]*type="checkbox")(?=[^>]*name="weekly_report")[^>]*>/);
    expect(html).not.toContain("Could not load the weekly report setting");
  });
});
