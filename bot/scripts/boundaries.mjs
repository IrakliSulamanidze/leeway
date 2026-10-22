// Import and secret boundaries for the bot (docs/adr/0001). Prints one line per
// problem and exits non-zero on any. Run from bot/.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const BOT = resolve(import.meta.dirname, "..");
const REPO = resolve(BOT, "..");
const WEB_SRC = join(REPO, "src");

// The only web modules the bot may reach, directly or through their own imports.
// All are pure: no database, no network, no secrets, no packages.
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
const rel = (f) => relative(REPO, f).split(sep).join("/");

// Every static import, export-from, require("x") and import("x") with a literal.
const specifiers = (code) =>
  ts.preProcessFile(code, true, true).importedFiles.map((f) => f.fileName);

// Dynamic forms the preprocessor cannot see, and ways to reach the environment.
const DYNAMIC = [
  [
    /\brequire\s*\(\s*(?!["'][^"'`]+["']\s*\))/,
    "a require() without a plain string",
  ],
  [
    /\bimport\s*\(\s*(?!["'][^"'`]+["']\s*\))/,
    "an import() without a plain string",
  ],
];
const ENV = /process\s*(\.\s*env\b|\[)|["'](node:)?process["']/;

function resolveLocal(spec, fromFile) {
  const base = spec.startsWith("@/")
    ? join(WEB_SRC, spec.slice(2))
    : resolve(dirname(fromFile), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")])
    if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const isLocal = (spec) => spec.startsWith("@/") || spec.startsWith(".");
const insideBot = (file) => !relative(BOT, file).startsWith("..");

const problems = [];
const botFiles = walk(BOT).filter(isCode);

// Shared web code: only the allowed pure modules, followed transitively.
const seen = new Set();
function visitShared(file, via) {
  const r = rel(file);
  if (seen.has(r)) return;
  seen.add(r);
  if (!SHARED.some((re) => re.test(r)) || r.endsWith(".test.ts")) {
    problems.push(`${via} reaches ${r}, which the bot may not use`);
    return;
  }
  const code = readFileSync(file, "utf8");
  for (const [re, what] of DYNAMIC)
    if (re.test(code)) problems.push(`${r} uses ${what}`);
  for (const spec of specifiers(code)) {
    const target = isLocal(spec) ? resolveLocal(spec, file) : null;
    if (!target)
      problems.push(
        `${r} imports "${spec}"; shared modules may import only other shared modules`,
      );
    else visitShared(target, r);
  }
}

for (const file of botFiles) {
  const code = readFileSync(file, "utf8");
  const r = rel(file);
  const inCore = r.startsWith("bot/src/core/");
  const isTest = r.endsWith(".test.ts");
  // Dev scripts and config files run on a developer's machine, not in the bot.
  const shipped = r.startsWith("bot/src/") || r.startsWith("bot/app/");

  if (shipped)
    for (const [re, what] of DYNAMIC)
      if (re.test(code)) problems.push(`${r} uses ${what}`);

  for (const spec of specifiers(code)) {
    if (isLocal(spec)) {
      const target = resolveLocal(spec, file);
      if (!target) problems.push(`${r}: cannot resolve "${spec}"`);
      else if (!insideBot(target)) visitShared(target, r);
      else if (inCore && !isTest && rel(target).startsWith("bot/src/adapters/"))
        problems.push(
          `${r} imports an adapter; the core gets them through ports`,
        );
    } else if (inCore && !(isTest && spec === "vitest")) {
      // The core is pure: relative and shared imports only, no packages or Node.
      problems.push(
        `${r} imports "${spec}"; the core may import only relative and @/ modules`,
      );
    }
  }

  // Configuration and secrets are read only in adapters.
  if (shipped && ENV.test(code) && !r.startsWith("bot/src/adapters/"))
    problems.push(
      `${r} reaches process or its environment; only bot/src/adapters/ may`,
    );
}

// The web app never imports the bot.
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
