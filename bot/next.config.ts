import path from "node:path";
import type { NextConfig } from "next";

// The bot compiles the web app's pure rule modules from ../src, so file
// tracing starts at the repository root. Builds use webpack (see package.json):
// Turbopack with a repository-wide root also bundles the web app's src/proxy.ts.
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(import.meta.dirname, ".."),
  poweredByHeader: false,
};

export default nextConfig;
