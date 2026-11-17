import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Family Guardian",
    description: "Shows parents which websites are used and for how long, and blocks sites they choose. Collects domains and time only.",
    permissions: ["tabs", "idle", "storage", "alarms", "declarativeNetRequest"],
    host_permissions: ["<all_urls>"],
    incognito: "not_allowed",
  },
});
