import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["acceptance/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "apps/*/src/**/*.test.tsx", "apps/extension/lib/**/*.test.ts", "supabase/tests/**/*.test.ts", ".github/scripts/**/*.test.mjs", "tools/**/*.test.mjs", "e2e/**/*.test.ts"],
    // Database tests load a migrated PGlite snapshot built once here (see supabase/tests/harness.ts).
    globalSetup: ["supabase/tests/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
