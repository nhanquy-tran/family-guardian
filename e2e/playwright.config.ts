import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./local-supabase.ts";

const PORT = 3100;
const supabase = localSupabase();

export default defineConfig({
  testDir: "tests",
  // Every stage reseeds the one shared e2e family, so files run one after another.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "Asia/Ho_Chi_Minh",
    locale: "en-US",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build -w web && npm run start -w web -- -p ${PORT}`,
    cwd: "..",
    url: `http://localhost:${PORT}/en`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
      APP_URL: `http://localhost:${PORT}`,
    },
  },
});
