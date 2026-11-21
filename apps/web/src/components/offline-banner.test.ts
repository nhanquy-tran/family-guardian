import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfflineBannerView } from "./offline-banner";

const render = (siteAccessLost: string[]) =>
  renderToStaticMarkup(createElement(OfflineBannerView, { offline: [], siteAccessLost }));

describe("OfflineBannerView", () => {
  it("Banner renders and disappears", () => {
    const line = "Blocking is off on School laptop: site access was turned off";
    const html = render([line]);
    const alert = html.match(/<[a-z]+[^>]*role="alert"[^>]*>[\s\S]*<\/[a-z]+>/);
    expect(alert).not.toBeNull();
    expect(alert![0]).toContain("Blocking is off on");
    expect(alert![0]).toContain("School laptop");

    expect(render([])).toBe("");
  });
});
