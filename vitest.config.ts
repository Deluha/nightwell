import { defineConfig } from "vitest/config";

// Thresholds: 80% overall; 90% for the engine, model, score and plan modules (ROADMAP.md, Tests).
const strict = { lines: 90, branches: 90 };

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/offline.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "scripts/**/*.ts"],
      reporter: ["text-summary", "lcov"],
      thresholds: {
        lines: 80,
        branches: 80,
        "src/engine/**": strict,
        "src/model/**": strict,
        "src/score/**": strict,
        "src/plan/**": strict,
      },
    },
  },
});
