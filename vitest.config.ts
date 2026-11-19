import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["acceptance/**/*.test.ts", "packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "apps/*/src/**/*.test.tsx", "apps/extension/lib/**/*.test.ts", "supabase/tests/**/*.test.ts", ".github/scripts/**/*.test.mjs", "tools/**/*.test.mjs", "e2e/**/*.test.ts"],
    // Database tests load a migrated PGlite snapshot built once here (see supabase/tests/harness.ts).
    globalSetup: ["supabase/tests/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // `npm run coverage` (CI and the factory gate) fails when an area drops below its threshold, and raises
    // a threshold to the new whole percentage when coverage grows, so commit the updated numbers (ADR 0023).
    coverage: {
      provider: "v8",
      include: ["packages/shared/src/**/*.{ts,tsx}", "apps/web/src/**/*.{ts,tsx}", "apps/extension/{lib,entrypoints}/**/*.ts"],
      exclude: ["**/*.test.*", "**/*.d.ts"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        autoUpdate: (value: number) => Math.floor(value),
        lines: 79,
        branches: 73,
        "packages/shared/src/**": { lines: 99, branches: 89 },
        "apps/web/src/lib/**": { lines: 89, branches: 80 },
        "apps/web/src/components/**": { lines: 95, branches: 91 },
        "apps/web/src/app/**": { lines: 30, branches: 13 },
        "apps/extension/**": { lines: 83, branches: 80 },
      },
    },
  },
});
