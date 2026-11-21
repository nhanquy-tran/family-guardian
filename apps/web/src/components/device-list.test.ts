import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChildDevices, DeviceRow } from "../lib/devices/devices";
import { DeviceList } from "./device-list";

const now = new Date("2026-11-17T10:00:00Z");
const renameAction = async () => {};
let removeCalls = 0;
const removeAction = async () => {
  removeCalls += 1;
};

const device = (over: Partial<DeviceRow> & { id: string }): DeviceRow => ({
  name: null,
  browser: "chrome",
  os: "Windows",
  extension_version: "0.1.0",
  last_seen_at: null,
  created_at: "2026-11-01T00:00:00Z",
  ...over,
});

function render(
  groups: ChildDevices[],
  extra: { confirmRemoveId?: string | null; error?: string } = {},
): string {
  return renderToStaticMarkup(
    createElement(DeviceList, {
      groups,
      now,
      error: extra.error,
      confirmRemoveId: extra.confirmRemoveId ?? null,
      renameAction,
      removeAction,
    }),
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

const twoDevices: ChildDevices[] = [
  {
    id: "c1",
    name: "Lan",
    devices: [
      device({ id: "d1", name: "Old PC", last_seen_at: "2026-11-17T09:50:00Z", browser: "edge" }),
      device({ id: "d2", name: "New PC", last_seen_at: "2026-11-17T09:58:00Z" }),
    ],
  },
];

describe("DeviceList", () => {
  it("Firefox device listed", () => {
    const html = render([
      {
        id: "c1",
        name: "Lan",
        devices: [device({ id: "a", browser: "chrome" }), device({ id: "b", browser: "firefox" })],
      },
    ]);
    expect(html).toContain("Chrome");
    expect(html).toContain("Firefox");
  });

  it("online and offline devices rendered", () => {
    const html = render([
      {
        id: "c1",
        name: "Lan",
        devices: [
          device({ id: "a", last_seen_at: "2026-11-17T09:58:00Z" }),
          device({
            id: "b",
            name: "Old PC",
            browser: "edge",
            extension_version: null,
            last_seen_at: "2026-11-17T09:50:00Z",
          }),
        ],
      },
    ]);
    for (const text of ["Lan", "Chrome on Windows", "0.1.0", "2 min ago", "Old PC", "unknown", "10 min ago"]) {
      expect(html).toContain(text);
    }
    expect(count(html, 'data-status="online"')).toBe(1);
    expect(count(html, 'data-status="offline"')).toBe(1);
    expect(html).toMatch(/data-status="online"[^>]*>\s*Online\s*</);
    expect(html).toMatch(/data-status="offline"[^>]*>\s*Offline\s*</);
  });

  it("rename and remove controls", () => {
    const html = render([{ id: "c1", name: "Lan", devices: [device({ id: "d1" })] }]);
    expect(html).toMatch(/<input[^>]*name="deviceId"[^>]*value="d1"|<input[^>]*value="d1"[^>]*name="deviceId"/);
    expect(html).toMatch(/<input[^>]*type="hidden"/);
    expect(html).toMatch(/<input[^>]*name="name"[^>]*maxLength="40"|<input[^>]*maxLength="40"[^>]*name="name"/);
    expect(html).toMatch(/<button[^>]*>\s*Rename\s*<\/button>/);
    expect(html).toMatch(/<a[^>]*href="\/dashboard\/devices\?remove=d1"[^>]*>\s*Remove\s*<\/a>/);
    expect(html).not.toContain("Yes, remove");
    expect(html).not.toContain("usage history will be deleted");
  });

  it("remove confirmation names device and child", () => {
    const html = render(twoDevices, { confirmRemoveId: "d1" });
    for (const text of ["Old PC", "Lan", "delete the device and its usage history", "cannot be undone"]) {
      expect(html).toContain(text);
    }
    expect(count(html, "cannot be undone")).toBe(1);
    expect(count(html, "Yes, remove")).toBe(1);
    expect(html).toMatch(
      /<form[^>]*>(?:(?!<\/form>)[\s\S])*name="deviceId"[^>]*value="d1"(?:(?!<\/form>)[\s\S])*Yes, remove(?:(?!<\/form>)[\s\S])*<\/form>/,
    );
    expect(html).toMatch(/<a[^>]*href="\/dashboard\/devices"[^>]*>\s*Cancel\s*<\/a>/);
    expect(html).toContain("/dashboard/devices?remove=d2");
  });

  it("confirmation for an unknown device", () => {
    expect(render(twoDevices, { confirmRemoveId: "zzz" })).not.toContain("Yes, remove");
    expect(render(twoDevices, { confirmRemoveId: null })).not.toContain("Yes, remove");
  });

  it("child without devices", () => {
    const html = render([{ id: "c2", name: "Minh", devices: [] }]);
    expect(html).toContain("Minh");
    expect(html).toContain("No devices yet");
    expect(html).toMatch(/<a[^>]*href="\/dashboard\/children"/);
  });

  it("error messages", () => {
    const groups: ChildDevices[] = [];
    expect(render(groups, { error: "invalid-name" })).toContain("Name must be 1 to 40 characters.");
    expect(render(groups, { error: "failed" })).toContain("Something went wrong. Please try again.");
    expect(render(groups, { error: "load" })).toContain("Could not load devices. Please reload the page.");
  });

  it("unknown error code is not echoed", () => {
    const html = render([], { error: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("cancel deletes nothing", () => {
    const html = render(twoDevices, { confirmRemoveId: "d1" });
    const forms = html.match(/<form[\s\S]*?<\/form>/g) ?? [];
    const removeForms = forms.filter((f) => f.includes("Yes, remove"));
    expect(removeForms).toHaveLength(1);
    const cancel = html.match(/<a[^>]*>\s*Cancel\s*<\/a>/);
    expect(cancel).not.toBeNull();
    expect(forms.some((f) => f.includes("Cancel"))).toBe(false);
    expect(html).toMatch(/<a[^>]*href="\/dashboard\/devices"[^>]*>\s*Cancel\s*<\/a>/);
    expect(removeCalls).toBe(0);
    expect(html).not.toContain("onclick");
  });
});
