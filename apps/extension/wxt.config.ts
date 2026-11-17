import { defineConfig } from "wxt";

// Host access only to our own API (the background script calls it). Blocking (#15) adds
// declarativeNetRequest and broader host access when it ships; unused permissions slow store review.
const apiOrigin = (process.env.WXT_API_BASE_URL ?? "https://family-guardian-one.vercel.app").replace(/\/$/, "");

export default defineConfig({
  manifest: {
    name: "Family Guardian",
    description: "Shows parents which websites are used and for how long. Collects website domains and time only.",
    permissions: ["tabs", "idle", "storage", "alarms"],
    host_permissions: [`${apiOrigin}/*`],
    incognito: "not_allowed",
  },
});
