import { type BrowserName, osName } from "../lib/browser-info";
import { resolveApiBaseUrl } from "../lib/config";
import { type Controller, createController, registerSchedule } from "../lib/controller";
import { parseBlockedMessage } from "../lib/blocked";
import { browserStore, fetchGet, fetchPost } from "../lib/storage";

const BROWSERS: readonly string[] = ["chrome", "edge", "brave", "other"];

export default defineBackground(() => {
  let baseUrl: string | null = null;
  try {
    baseUrl = resolveApiBaseUrl(import.meta.env.WXT_API_BASE_URL);
  } catch {
    console.error("Family Guardian: WXT_API_BASE_URL is missing or invalid");
  }

  const controllerPromise: Promise<Controller | null> =
    baseUrl === null
      ? Promise.resolve(null)
      : browser.runtime.getPlatformInfo().then(({ os }) =>
          createController({
            store: browserStore(browser.storage.local),
            post: fetchPost,
            get: fetchGet,
            dnr: browser.declarativeNetRequest,
            badge: browser.action,
            baseUrl: baseUrl as string,
            extensionVersion: browser.runtime.getManifest().version,
            os: osName(os),
            log: (message) => console.error(message),
          }),
        );

  async function withController(run: (controller: Controller) => Promise<unknown>): Promise<void> {
    const controller = await controllerPromise;
    if (controller !== null) await run(controller);
  }

  browser.runtime.onInstalled.addListener(({ reason }) => {
    registerSchedule(browser);
    if (reason === "install") browser.runtime.openOptionsPage();
  });
  browser.runtime.onStartup.addListener(() => registerSchedule(browser));

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs
      .get(tabId)
      .then((tab) =>
        withController((c) => c.handleEvent({ type: "tab", at: Date.now(), url: tab.url ?? null })),
      );
  });
  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url !== undefined && tab.active) {
      void withController((c) => c.handleEvent({ type: "tab", at: Date.now(), url: changeInfo.url ?? null }));
    }
  });
  browser.windows.onFocusChanged.addListener((windowId) => {
    const focused = windowId !== browser.windows.WINDOW_ID_NONE;
    void withController((c) => c.handleEvent({ type: "focus", at: Date.now(), focused }));
    if (focused) {
      void browser.tabs.query({ active: true, windowId }).then(([tab]) =>
        withController((c) => c.handleEvent({ type: "tab", at: Date.now(), url: tab?.url ?? null })),
      );
    }
  });
  browser.idle.onStateChanged.addListener((state) => {
    void withController((c) => c.handleEvent({ type: "idle", at: Date.now(), state }));
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "heartbeat") void withController((c) => c.onAlarm(Date.now()));
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const blocked = parseBlockedMessage(message);
    if (blocked !== null) {
      void withController((c) => c.recordBlocked(blocked.domain, Date.now()));
      return undefined;
    }
    const m = message as { type?: unknown; code?: unknown; browser?: unknown } | null;
    if (m?.type !== "pair" || typeof m.code !== "string") return undefined;
    const code = m.code;
    const name: BrowserName =
      typeof m.browser === "string" && BROWSERS.includes(m.browser) ? (m.browser as BrowserName) : "other";
    void controllerPromise.then(async (controller) => {
      sendResponse(controller === null ? { ok: false, reason: "misconfigured" } : await controller.pair(code, name));
    });
    return true;
  });
});
