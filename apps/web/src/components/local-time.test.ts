import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildrenList } from "./children-list";
import { clientTimeZone, LocalTime, serverTimeZone, subscribeTimeZone } from "./local-time";
import { OfflineBannerView } from "./offline-banner";

const noop = async () => {};

afterEach(() => vi.restoreAllMocks());

describe("LocalTime", () => {
  it("renders a labelled UTC time on the server", () => {
    const html = renderToStaticMarkup(createElement(LocalTime, { iso: "2026-11-21T10:40:00.000Z" }));
    expect(html).toBe('<time dateTime="2026-11-21T10:40:00.000Z">21 Nov, 10:40 UTC</time>');
    expect(serverTimeZone()).toBe("UTC");
  });

  it("uses the browser timezone on the client", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Asia/Ho_Chi_Minh",
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(clientTimeZone()).toBe("Asia/Ho_Chi_Minh");
    const unsubscribe = subscribeTimeZone();
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });
});

describe("dashboard times use LocalTime", () => {
  it("offline banner and pairing code expiry", () => {
    const banner = renderToStaticMarkup(
      createElement(OfflineBannerView, {
        offline: [
          {
            id: "a1",
            sent_at: "2026-11-21T10:45:00.000Z",
            incident_last_seen_at: "2026-11-21T10:40:00.000Z",
            resolved_at: null,
            devices: { last_seen_at: "2026-11-21T10:40:00.000Z", browser: "Chrome", os: "Windows", children: { name: "Mia" } },
          },
        ],
        siteAccessLost: [],
      }),
    );
    expect(banner).toContain('since <time dateTime="2026-11-21T10:40:00.000Z">');
    expect(banner).not.toContain("T10:40:00.000Z<");

    const list = renderToStaticMarkup(
      createElement(ChildrenList, {
        items: [{ id: "c1", name: "Mia" }],
        activeCodes: { c1: { code: "AB2CD3", expiresAt: "2026-11-17T11:00:00.000Z" } },
        error: null,
        pairError: null,
        confirmDelete: null,
        actions: { addChildAction: noop, renameChildAction: noop, deleteChildAction: noop, createCodeAction: noop },
      }),
    );
    expect(list).toContain('Valid until <time dateTime="2026-11-17T11:00:00.000Z">');
    expect(list).not.toContain("T11:00:00.000Z<");
  });
});
