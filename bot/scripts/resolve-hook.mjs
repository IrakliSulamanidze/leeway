import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../../src/", import.meta.url);

function withExtension(url) {
  const path = fileURLToPath(url);
  for (const candidate of [path, `${path}.ts`, `${path}/index.ts`])
    if (existsSync(candidate) && !candidate.endsWith("/"))
      return pathToFileURL(candidate).href;
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const found = withExtension(new URL(specifier.slice(2), SRC));
    if (found) return { url: found, shortCircuit: true };
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL
  ) {
    const found = withExtension(new URL(specifier, context.parentURL));
    if (found) return { url: found, shortCircuit: true };
  }
  return next(specifier, context);
}
