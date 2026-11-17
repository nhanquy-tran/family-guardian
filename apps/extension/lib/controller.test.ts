import { describe, expect, it, vi } from "vitest";
import { createController, registerSchedule } from "./controller";
import { connectionStatus } from "./pairing";
import {
  always,
  at,
  type Call,
  createPost,
  createStore,
  deferred,
  entries,
  type Reply,
} from "./test-fakes";
import { createTracker, type TrackerEvent } from "./tracker";

const ok: Reply = { status: 200, body: { rulesVersion: 3 } };
const unauthorized: Reply = { status: 401, body: { error: "unauthorized" } };
const paired = { deviceToken: "tok-1" };

function setup(initial: Record<string, unknown>, post: ReturnType<typeof createPost>["post"]) {
  const fake = createStore(initial);
  const log = vi.fn<(message: string) => void>();
  const controller = createController({
    store: fake.store,
    post,
    baseUrl: "https://fg.example",
    extensionVersion: "0.2.0",
    os: "Windows",
    log,
  });
  return { ...fake, controller, log };
}

async function track(
  controller: { handleEvent(e: TrackerEvent): Promise<void> },
  time: string,
  url: string | null,
  extra: { focused?: boolean } = {},
) {
  await controller.handleEvent({ type: "focus", at: at(time), focused: extra.focused ?? true });
  await controller.handleEvent({ type: "idle", at: at(time), state: "active" });
  await controller.handleEvent({ type: "tab", at: at(time), url });
}

const heartbeats = (calls: Call[]) => calls.filter((c) => c.url.endsWith("/api/device/heartbeat"));
const settle = () => new Promise((r) => setTimeout(r, 15));

describe("registerSchedule", () => {
  it("schedule registered", () => {
    const alarms = { create: vi.fn() };
    const idle = { setDetectionInterval: vi.fn() };
    registerSchedule({ alarms, idle });
    expect(alarms.create).toHaveBeenCalledWith("heartbeat", { periodInMinutes: 1 });
    expect(idle.setDetectionInterval).toHaveBeenCalledWith(60);
  });
});

describe("controller while paired", () => {
  it("completed minute is sent", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup(paired, post);
    await track(controller, "10:03:00", "https://www.youtube.com/");
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body["entries"]).toContainEqual({
      minuteUtc: "2026-11-17T10:03:00.000Z",
      domain: "youtube.com",
      seconds: 60,
    });
    expect(calls[0]?.body["currentDomain"]).toBe("youtube.com");
    expect(data.get("queue")).toEqual([]);
  });

  it("current domain null when not active", async () => {
    const { post, calls } = always(ok);
    const { controller } = setup(paired, post);
    await track(controller, "10:03:00", "https://www.youtube.com/");
    await controller.handleEvent({ type: "focus", at: at("10:03:30"), focused: false });
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body["currentDomain"]).toBeNull();
  });

  it("not paired", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup({}, post);
    await track(controller, "10:03:00", "https://www.youtube.com/");
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(0);
    expect(data.size).toBe(0);
  });

  it("offline minutes are queued and sent later in order", async () => {
    let online = false;
    const { post, calls } = createPost(() => (online ? ok : "network"));
    const { controller, data } = setup(paired, post);
    await track(controller, "10:00:00", "https://khanacademy.org/");
    for (const t of ["10:01:05", "10:02:05", "10:03:05"]) await controller.onAlarm(at(t));
    online = true;
    await controller.onAlarm(at("10:04:05"));
    const last = calls[calls.length - 1];
    expect(last?.body["entries"]).toEqual(
      ["10:00", "10:01", "10:02", "10:03"].map((m) => ({
        minuteUtc: `2026-11-17T${m}:00.000Z`,
        domain: "khanacademy.org",
        seconds: 60,
      })),
    );
    expect(data.get("queue")).toEqual([]);
  });

  it("tracker state survives a service-worker restart", async () => {
    const { post, calls } = always(ok);
    const first = setup(paired, post);
    await track(first.controller, "10:03:00", "https://khanacademy.org/");
    const second = createController({
      store: first.store,
      post,
      baseUrl: "https://fg.example",
      extensionVersion: "0.2.0",
      os: "Windows",
      log: vi.fn(),
    });
    await second.onAlarm(at("10:04:05"));
    expect(calls[0]?.body["entries"]).toContainEqual({
      minuteUtc: "2026-11-17T10:03:00.000Z",
      domain: "khanacademy.org",
      seconds: 60,
    });
  });

  it("no URL leaves the device", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup(paired, post);
    await track(controller, "10:03:10", "https://www.youtube.com/watch?v=abc&t=10");
    await controller.onAlarm(at("10:04:05"));
    const bodies = calls.map((c) => c.raw).join("\n");
    const stored = JSON.stringify([...data.entries()]);
    for (const text of [bodies, stored]) {
      for (const forbidden of ["https://", "/watch", "v=abc", "www.youtube.com"]) {
        expect(text).not.toContain(forbidden);
      }
    }
    expect(calls[0]?.body["entries"]).toContainEqual(expect.objectContaining({ domain: "youtube.com" }));
  });
});

describe("controller rejected (401)", () => {
  it("first 401", async () => {
    const { post, calls } = always(unauthorized);
    const { controller, data, store } = setup({ ...paired, queue: entries(1, 2) }, post);
    await controller.onAlarm(at("10:04:05"));
    expect(calls).toHaveLength(1);
    expect(data.get("deviceToken")).toBe("tok-1");
    expect(data.get("queue")).toEqual(entries(1, 2));
    expect(data.get("authState")).toBe("rejected");
    expect(await connectionStatus(store)).toBe("rejected");
  });

  it("rejected device stops tracking", async () => {
    const { post, calls } = always(ok);
    const trackerState = createTracker();
    const { controller, data } = setup({ ...paired, authState: "rejected", trackerState }, post);
    await track(controller, "10:00:30", "https://www.youtube.com/");
    await controller.onAlarm(at("10:01:05"));
    await controller.onAlarm(at("10:02:05"));
    expect(calls).toHaveLength(0);
    expect(data.has("queue") ? data.get("queue") : []).toEqual([]);
    expect(data.get("trackerState")).toEqual(trackerState);
  });

  it("retry every 15 minutes with an empty body", async () => {
    const { post, calls } = always(unauthorized);
    const { controller, data } = setup(
      { ...paired, authState: "rejected", queue: entries(1, 2) },
      post,
    );
    for (const t of ["10:14:05", "10:15:05", "10:16:05", "10:30:05"]) await controller.onAlarm(at(t));
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.body["entries"]).toEqual([]);
      expect(call.body["currentDomain"]).toBeNull();
    }
    expect(data.get("deviceToken")).toBe("tok-1");
    expect(data.get("queue")).toEqual(entries(1, 2));
    expect(data.get("authState")).toBe("rejected");
  });

  it("recovery on 200", async () => {
    const { post, calls } = always(ok);
    const { controller, data } = setup(
      { ...paired, authState: "rejected", queue: entries(1, 2), trackerState: createTracker() },
      post,
    );
    await controller.onAlarm(at("10:15:05"));
    expect(data.has("authState")).toBe(false);
    expect(data.has("trackerState")).toBe(false);
    expect(data.get("deviceToken")).toBe("tok-1");
    await controller.onAlarm(at("10:16:05"));
    expect(calls[calls.length - 1]?.body["entries"]).toEqual(entries(1, 2));
    expect(data.get("queue")).toEqual([]);
  });

  it("pruning continues while rejected", async () => {
    const old = { minuteUtc: "2026-11-10T10:00:00.000Z", domain: "a.com", seconds: 30 };
    const recent = { minuteUtc: "2026-11-17T10:04:00.000Z", domain: "a.com", seconds: 30 };
    const { post } = always(ok);
    const { controller, data } = setup({ ...paired, authState: "rejected", queue: [old, recent] }, post);
    await controller.onAlarm(at("10:01:05"));
    expect(data.get("queue")).toEqual([recent]);
  });

  it("re-pair while rejected", async () => {
    const { post, calls } = createPost((call) =>
      call.url.endsWith("/api/device/pair") ? { status: 200, body: { deviceToken: "tok-2" } } : ok,
    );
    const { controller, data } = setup(
      { deviceToken: "old", authState: "rejected", queue: entries(1, 2) },
      post,
    );
    await controller.pair("AB2CD3", "edge");
    expect(data.get("deviceToken")).toBe("tok-2");
    expect(data.has("authState")).toBe(false);
    expect(data.has("queue")).toBe(false);
    await track(controller, "10:03:00", "https://khanacademy.org/");
    await controller.onAlarm(at("10:04:05"));
    const last = heartbeats(calls).pop();
    expect(last?.headers["Authorization"]).toBe("Bearer tok-2");
    expect(last?.body["entries"]).toContainEqual(expect.objectContaining({ domain: "khanacademy.org" }));
  });
});

describe("controller serialization", () => {
  it("no overlapping runs", async () => {
    const gate = deferred<Reply>();
    const { post, calls } = createPost((_call, index) => (index === 0 ? gate.promise : ok));
    const { controller } = setup({ ...paired, queue: entries(1, 2) }, post);
    const first = controller.onAlarm(at("10:04:05"));
    const second = controller.onAlarm(at("10:05:05"));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    gate.resolve(ok);
    await Promise.all([first, second]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.body["entries"]).toEqual(entries(1, 2));
    expect(calls[1]?.body["entries"]).toEqual([]);
  });

  it("stored browser is sent", async () => {
    const browsers: unknown[] = [];
    for (const stored of [{ browser: "brave" }, {}, { browser: "netscape" }]) {
      const { post, calls } = always(ok);
      const { controller } = setup({ ...paired, ...stored }, post);
      await controller.onAlarm(at("10:04:05"));
      browsers.push(calls[0]?.body["browser"]);
    }
    expect(browsers).toEqual(["brave", "other", "other"]);
  });

  it("pairing is serialized with a flush", async () => {
    const gate = deferred<Reply>();
    const { post, calls } = createPost((call) =>
      call.url.endsWith("/api/device/pair") ? { status: 200, body: { deviceToken: "tok-2" } } : gate.promise,
    );
    const { controller, data } = setup({ deviceToken: "old", queue: entries(1, 2) }, post);
    const alarm = controller.onAlarm(at("10:04:05"));
    const pairing = controller.pair("AB2CD3", "edge");
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await settle();
    expect(calls).toHaveLength(1);
    gate.resolve(ok);
    await Promise.all([alarm, pairing]);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toBe("https://fg.example/api/device/pair");
    expect(data.get("deviceToken")).toBe("tok-2");
    expect(data.has("queue")).toBe(false);
  });

  it("storage failure does not crash", async () => {
    const { post, calls } = always(ok);
    const fake = createStore(paired, { failGet: true });
    const log = vi.fn<(message: string) => void>();
    const controller = createController({
      store: fake.store,
      post,
      baseUrl: "https://fg.example",
      extensionVersion: "0.2.0",
      os: "Windows",
      log,
    });
    await expect(
      controller.handleEvent({ type: "tab", at: at("10:03:00"), url: "https://www.youtube.com/" }),
    ).resolves.toBeUndefined();
    await expect(controller.onAlarm(at("10:04:05"))).resolves.toBeUndefined();
    expect(calls).toHaveLength(0);
    for (const [message] of log.mock.calls) {
      expect(message).not.toMatch(/youtube|tok-1|https?:/);
    }
  });
});
