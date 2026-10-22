import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextTs,
  {
    files: ["src/**", "app/**"],
    rules: { "no-console": "error", "no-debugger": "error" },
  },
  globalIgnores([".next/**", "next-env.d.ts"]),
]);
