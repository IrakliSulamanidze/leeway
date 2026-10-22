import path from "node:path";
import type { NextConfig } from "next";

// The bot builds from bot/ but compiles the web app's pure rule modules in
// ../src, so both roots point at the repository root.
const root = path.resolve(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
};

export default nextConfig;
