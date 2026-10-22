import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // No stray logging in app code (repo hygiene, docs/process.md 5.3).
  {
    files: ["src/**"],
    rules: { "no-console": "error", "no-debugger": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // The WhatsApp bot lints with its own config (bot/eslint.config.mjs).
    "bot/**",
  ]),
]);

export default eslintConfig;
