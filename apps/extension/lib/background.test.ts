import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

type Listener = (...args: unknown[]) => unknown;

function event() {
  const listeners: Listener[] = [];
  return { listeners, addListener: vi.fn((l: Listener) => void listeners.push(l)) };
}

describe("background entrypoint", () => {
  it("Background wiring", async () => {
    vi.stubEnv("WXT_API_BASE_URL", "https://fg.example");
    const contains = vi.fn(async (_query: { origins: string[] }) => true);
    const onAlarm = event();
    const alarms = { create: vi.fn(), onAlarm };
    const data: Record<string, unknown> = { deviceToken: "tok-1", rulesVersion: 1 };
    const fake = {
      permissions: { contains },
      alarms,
      runtime: {
        getPlatformInfo: async () => ({ os: "win" }),
        getManifest: () => ({ version: "0.3.0" }),
        openOptionsPage: vi.fn(),
        onInstalled: event(),
        onStartup: event(),
        onMessage: event(),
      },
      storage: {
        local: {
          get: async (key: string) => (key in data ? { [key]: data[key] } : {}),
          set: async (items: Record<string, unknown>) => void Object.assign(data, items),
          remove: async (keys: string[]) => void keys.forEach((k) => delete data[k]),
        },
      },
      declarativeNetRequest: { getDynamicRules: async () => [], updateDynamicRules: async () => undefined },
      tabs: { onActivated: event(), onUpdated: event(), get: async () => ({}), query: async () => [] },
      windows: { onFocusChanged: event(), WINDOW_ID_NONE: -1 },
      idle: { onStateChanged: event(), setDetectionInterval: vi.fn() },
      action: { setBadgeText: async () => undefined, setBadgeBackgroundColor: async () => undefined },
    };
    let captured: { main(): void } | undefined;
    vi.stubGlobal("defineBackground", (options: { main(): void }) => {
      captured = options;
      return options;
    });
    vi.stubGlobal("browser", fake);
    vi.stubGlobal("fetch", async () => ({ status: 200, json: async () => ({ rulesVersion: 1 }) }));

    await import("../entrypoints/background");
    captured?.main();
    expect(onAlarm.listeners).toHaveLength(1);
    expect(onAlarm.addListener).toHaveBeenCalledTimes(1);
    expect(alarms.create).not.toHaveBeenCalled();

    onAlarm.listeners[0]?.({ name: "heartbeat" });
    await vi.waitFor(() => {
      const origins = contains.mock.calls.map(([q]) => q.origins[0]);
      expect(origins).toContain("<all_urls>");
      expect(origins).toContain("https://fg.example/*");
    });
    expect(contains).toHaveBeenCalledWith({ origins: ["<all_urls>"] });
    expect(contains).toHaveBeenCalledWith({ origins: ["https://fg.example/*"] });
    expect(onAlarm.addListener).toHaveBeenCalledTimes(1);
    expect(alarms.create).not.toHaveBeenCalled();
  });
});
