import { defineConfig } from "vitest/config";
import path from "node:path";

// INTEGRATION=1 runs tests/integration (needs local Supabase); else the unit tests.
const integration = process.env.INTEGRATION === "1";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next swaps this marker for an empty module on the server; so do the tests.
      "server-only": path.resolve(
        __dirname,
        "node_modules/next/dist/compiled/server-only/empty.js",
      ),
    },
  },
  test: integration
    ? { include: ["tests/integration/**/*.test.ts"], fileParallelism: false }
    : { include: ["src/**/*.test.ts"] },
});
