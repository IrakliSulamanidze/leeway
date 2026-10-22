// Import and secret boundaries for the bot (docs/adr/0001). Prints one line per
// problem and exits non-zero on any. Run from bot/.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const BOT = resolve(import.meta.dirname, "..");
const REPO = resolve(BOT, "..");
const WEB_SRC = join(REPO, "src");

// The only web modules the bot may reach, directly or through their own imports.
// All are pure: no database, no network, no secrets.
const SHARED = [/^src\/lib\/rules\/[a-z-]+\.ts$/, /^src\/lib\/config\.ts$/];
const SKIP_DIRS = new Set(["node_modules", ".next"]);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isCode = (f) => /\.(ts|tsx|mts|js|mjs)$/.test(f);
const specifiers = (code) =>
  [...code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
    (m) => m[1],
  );

function resolveLocal(spec, fromFile) {
  const base = spec.startsWith("@/")
    ? join(WEB_SRC, spec.slice(2))
    : resolve(dirname(fromFile), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")])
    if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const rel = (f) => relative(REPO, f);
const problems = [];
const botFiles = walk(BOT).filter(isCode);

// 1. Shared web code: only the allowed pure modules, checked transitively.
const seen = new Set();
function visitShared(file, via) {
  const r = rel(file);
  if (seen.has(r)) return;
  seen.add(r);
  if (!SHARED.some((re) => re.test(r)) || r.endsWith(".test.ts")) {
    problems.push(`${via} reaches ${r}, which the bot may not use`);
    return;
  }
  for (const spec of specifiers(readFileSync(file, "utf8"))) {
    if (spec.startsWith("node:") || !/^[.@]/.test(spec)) {
      problems.push(`${r} imports "${spec}"; shared modules must stay pure`);
      continue;
    }
    const target = resolveLocal(spec, file);
    if (target) visitShared(target, r);
  }
}

for (const file of botFiles) {
  const code = readFileSync(file, "utf8");
  const r = rel(file);
  for (const spec of specifiers(code)) {
    if (spec.startsWith("@/")) {
      const target = resolveLocal(spec, file);
      if (!target) problems.push(`${r}: cannot resolve "${spec}"`);
      else visitShared(target, r);
    }
    // 2. The core is pure: no adapters, no Node built-ins, no framework.
    if (r.startsWith("bot/src/core/")) {
      if (/\/adapters\//.test(spec) && !r.endsWith(".test.ts"))
        problems.push(
          `${r} imports an adapter; the core gets them through ports`,
        );
      if (
        spec.startsWith("node:") ||
        spec === "next" ||
        spec.startsWith("next/")
      )
        problems.push(`${r} imports "${spec}"; the core must stay pure`);
    }
  }
  // 3. Configuration and secrets are read only in adapters.
  if (
    /process\.env/.test(code) &&
    !r.startsWith("bot/src/adapters/") &&
    !r.startsWith("bot/scripts/")
  )
    problems.push(`${r} reads process.env; only bot/src/adapters/ may`);
}

// 4. The web app never imports the bot.
for (const file of walk(WEB_SRC).filter(isCode)) {
  for (const spec of specifiers(readFileSync(file, "utf8")))
    if (/(^|\/)bot\//.test(spec))
      problems.push(`${rel(file)} imports the bot ("${spec}")`);
}

if (problems.length) {
  console.log(`boundaries: ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 30)) console.log(`- ${p}`);
  process.exit(1);
}
console.log(
  `boundaries: ok (${botFiles.length} bot files, ${seen.size} shared modules)`,
);
