import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests against the local Supabase (db + bot-sim CI job). Keys come from
// `supabase status -o env` at runtime, never from a file.
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
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
