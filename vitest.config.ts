import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["acceptance/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "apps/*/src/**/*.test.tsx", "apps/extension/lib/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    // The PGlite database tests replay every migration per suite; that grows with each migration.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
