import { defineConfig } from "wxt";
import { buildManifest } from "./lib/manifest";

const apiOrigin = (process.env.WXT_API_BASE_URL ?? "https://family-guardian.co").replace(/\/$/, "");

export default defineConfig({
  manifest: {
    name: "Family Guardian",
    description: "Shows parents which websites are used and for how long. Collects website domains and time only.",
    ...buildManifest(apiOrigin),
  },
});
