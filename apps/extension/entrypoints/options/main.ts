import { detectBrowser } from "../../lib/browser-info";
import { resolveApiBaseUrl } from "../../lib/config";
import { connectionStatus, PAIR_MESSAGES, type PairResult, STATUS_TEXT } from "../../lib/pairing";
import { browserStore } from "../../lib/storage";

const status = document.querySelector<HTMLParagraphElement>("#status");
const error = document.querySelector<HTMLParagraphElement>("#error");
const form = document.querySelector<HTMLFormElement>("#pair-form");
const input = document.querySelector<HTMLInputElement>("#code");
const button = document.querySelector<HTMLButtonElement>("#connect");

async function refreshStatus(): Promise<void> {
  const current = await connectionStatus(browserStore(browser.storage.local));
  if (status) status.textContent = STATUS_TEXT[current];
}

function showError(text: string): void {
  if (error) error.textContent = text;
}

interface BraveNavigator extends Navigator {
  brave?: { isBrave?: () => Promise<boolean> };
  userAgentData?: { brands: { brand: string }[] };
}

async function currentBrowser() {
  const nav: BraveNavigator = navigator;
  return detectBrowser({
    brands: nav.userAgentData?.brands.map((b) => b.brand) ?? [],
    userAgent: nav.userAgent,
    isBrave: typeof nav.brave?.isBrave === "function",
  });
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    showError("");
    try {
      resolveApiBaseUrl(import.meta.env.WXT_API_BASE_URL);
    } catch {
      showError(PAIR_MESSAGES.misconfigured);
      return;
    }
    if (button) button.disabled = true;
    try {
      const result = (await browser.runtime.sendMessage({
        type: "pair",
        code: input?.value ?? "",
        browser: await currentBrowser(),
      })) as PairResult | { ok: false; reason: "misconfigured" } | undefined;
      if (result?.ok) {
        if (input) input.value = "";
      } else {
        showError(PAIR_MESSAGES[result?.reason ?? "failed"]);
      }
    } catch {
      showError(PAIR_MESSAGES.failed);
    } finally {
      if (button) button.disabled = false;
      await refreshStatus();
    }
  })();
});

void refreshStatus();
