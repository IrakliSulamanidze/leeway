// Grading-contract check: a list of rules, each returning failure messages.
// Later PRs add their rules to RULES at the bottom. Prints one line per failure.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TESTIDS = [
  "signup-email",
  "signup-password",
  "signup-submit",
  "login-email",
  "login-password",
  "login-submit",
  "logout",
  "core-input",
  "core-submit",
  "core-item",
];
// Secret confinement (tech-plan 5): each secret is read in one server-only file,
// and that file is imported only along the nightly cron route's chain.
const CRON_ROUTE = join("src", "app", "api", "cron", "nightly", "route.ts");
const NIGHTLY = join("src", "lib", "server", "nightly.ts");
const CONFINED = [
  {
    secret: /SUPABASE_SECRET_KEY|service_role|sb_secret_/,
    reader: join("src", "lib", "server", "admin.ts"),
    module: "server/admin",
    importers: [CRON_ROUTE],
  },
  {
    secret: /VAPID_PRIVATE_KEY/,
    reader: join("src", "lib", "server", "push.ts"),
    module: "server/push",
    importers: [NIGHTLY],
  },
  {
    secret: /CRON_SECRET/,
    reader: CRON_ROUTE,
    module: "api/cron/nightly/route",
    importers: [],
  },
  {
    secret: null,
    reader: NIGHTLY,
    module: "server/nightly",
    importers: [CRON_ROUTE],
  },
];
// pdfjs-dist is heavy: it loads only on the syllabus import screen (tech-plan 5).
const PDFJS_ALLOWED_DIR = join(
  "src",
  "app",
  "app",
  "courses",
  "[id]",
  "syllabus",
);
// The Gemini key is read in one server-only module, imported by one route. The
// course and import pages (server components) import only syllabusReadEnabled.
const GEMINI_FILE = join("src", "lib", "server", "gemini.ts");
const GEMINI_PAGES = [
  join("src", "app", "app", "courses", "[id]", "page.tsx"),
  join(PDFJS_ALLOWED_DIR, "page.tsx"),
];
const GEMINI_IMPORTER = join(
  "src",
  "app",
  "api",
  "syllabus",
  "read",
  "route.ts",
);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk("src").filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f));
const sources = files.map((file) => ({
  file,
  text: readFileSync(file, "utf8"),
}));
const all = sources.map((s) => s.text).join("\n");

// Each rule: { name, check() => string[] of failures }.
const perFile = (fn) => () =>
  sources.flatMap(({ file, text }) => fn(file, text));

const RULES = [
  {
    name: "testids",
    check: () =>
      TESTIDS.filter((id) => !all.includes(`"${id}"`)).map(
        (id) => `missing data-testid "${id}"`,
      ),
  },
  {
    // core-input must be a text field: an <input type="text"> or a <textarea>.
    name: "core-input is text",
    check: () => {
      const tag = all.match(
        /<(input|textarea)\b[^>]*data-testid="core-input"[^>]*>/s,
      );
      if (!tag) return ["core-input is not on an <input> or <textarea>"];
      if (tag[1] === "input" && !/type="text"/.test(tag[0]))
        return ['core-input must have type="text"'];
      return [];
    },
  },
  {
    name: "no browser storage",
    check: perFile((file, text) =>
      /\b(localStorage|sessionStorage|indexedDB)\b/.test(text)
        ? [`${file}: browser storage is not allowed for user data`]
        : [],
    ),
  },
  {
    name: "secret confinement",
    check: perFile((file, text) => {
      if (/\.test\.tsx?$/.test(file)) return [];
      const out = [];
      for (const c of CONFINED) {
        if (c.secret?.test(text) && file !== c.reader)
          out.push(`${file}: secret referenced outside ${c.reader}`);
        const imports = new RegExp(
          `(from\\s+|import\\s*\\(\\s*)["'][^"']*${c.module}["']`,
        );
        if (imports.test(text) && !c.importers.includes(file))
          out.push(`${file}: may not import ${c.module}`);
      }
      return out;
    }),
  },
  {
    // Server-only modules must say so, so a client import fails the build.
    name: "server-only marker",
    check: () =>
      CONFINED.map((c) => c.reader)
        .filter((f) => f !== CRON_ROUTE)
        .filter((f) => !/^import "server-only";/m.test(readFileSync(f, "utf8")))
        .map((f) => `${f}: must import "server-only"`),
  },
  {
    name: "public env allowlist",
    check: perFile((file, text) =>
      /process\.env\.NEXT_PUBLIC_(?!SUPABASE_URL\b|SUPABASE_PUBLISHABLE_KEY\b|VAPID_PUBLIC_KEY\b)\w+/.test(
        text,
      )
        ? [
            `${file}: only the Supabase URL, publishable key and VAPID public key may be NEXT_PUBLIC`,
          ]
        : [],
    ),
  },
  {
    name: "pdfjs location",
    check: perFile((file, text) =>
      /["']pdfjs-dist(\/[^"']*)?["']/.test(text) &&
      !file.startsWith(PDFJS_ALLOWED_DIR)
        ? [`${file}: import pdfjs-dist only from ${PDFJS_ALLOWED_DIR}`]
        : [],
    ),
  },
  {
    name: "gemini key confinement",
    check: () => [
      ...sources
        .filter(
          ({ file, text }) =>
            /GEMINI_API_KEY/.test(text) && file !== GEMINI_FILE,
        )
        .map(
          ({ file }) =>
            `${file}: GEMINI_API_KEY is read only in ${GEMINI_FILE}`,
        ),
      ...sources
        .filter(
          ({ file, text }) =>
            /["']@\/lib\/server\/gemini["']/.test(text) &&
            file !== GEMINI_IMPORTER &&
            !(
              GEMINI_PAGES.includes(file) &&
              /import \{ syllabusReadEnabled \} from "@\/lib\/server\/gemini"/.test(
                text,
              )
            ),
        )
        .map(({ file }) => `${file}: only ${GEMINI_IMPORTER} imports gemini`),
      ...(existsSync(GEMINI_FILE) &&
      !/^import ["']server-only["'];/m.test(readFileSync(GEMINI_FILE, "utf8"))
        ? [`${GEMINI_FILE} must import "server-only"`]
        : []),
    ],
  },
  {
    name: "src never imports e2e helpers",
    check: perFile((file, text) =>
      /(from\s+|import\s*\(\s*|require\s*\(\s*)["'][^"']*e2e\//.test(text)
        ? [`${file}: src/ must not import from e2e/`]
        : [],
    ),
  },
  {
    // The feed link is a secret: no client-side or route query may read it.
    // Exception: the nightly cron's admin path, which has no logged-in user for
    // feed_url_for_sync and runs only behind CRON_SECRET.
    name: "calendar_feeds url never selected",
    check: perFile((file, text) =>
      file !== join("src", "lib", "server", "nightly.ts") &&
      /from\(\s*["']calendar_feeds["']\s*\)[\s\S]{0,200}?\.select\(\s*["'`][^"'`]*(\*|\burl\b)/.test(
        text,
      )
        ? [`${file}: calendar_feeds select of * or url (use feed_url_for_sync)`]
        : [],
    ),
  },
  {
    // Logs carry fixed text and error codes only, never an error object, URL or header.
    name: "errors logged as codes only",
    check: perFile((file, text) =>
      [...text.matchAll(/console\.(error|warn|info)\(([^;]*)\)/g)]
        .filter(
          ([, , args]) =>
            !/^`\[calendar\] \$\{where\}: \$\{code \?\? "unknown"\}`$/.test(
              args.trim(),
            ),
        )
        .map(() => `${file}: log through logCode(where, error.code) only`),
    ),
  },
  {
    // Tests inject their fetcher through syncFeed's parameter; nothing test-only ships.
    name: "no test hooks in src",
    check: perFile((file, text) =>
      !/\.test\.tsx?$/.test(file) &&
      /process\.env\.(NODE_ENV\s*===?\s*["']test|VITEST|TEST_|E2E_)/.test(text)
        ? [`${file}: test-only env switch in src/`]
        : [],
    ),
  },
  {
    // Next 16 loads the proxy from src/proxy.ts; a middleware.ts would be ignored or conflict.
    name: "proxy location",
    check: () => {
      const out = [];
      if (!existsSync("src/proxy.ts")) out.push("src/proxy.ts is missing");
      else if (
        !/export (async )?function proxy\b/.test(
          readFileSync("src/proxy.ts", "utf8"),
        )
      )
        out.push("src/proxy.ts must export function proxy");
      for (const f of ["middleware.ts", "src/middleware.ts", "proxy.ts"])
        if (existsSync(f)) out.push(`${f} must not exist (use src/proxy.ts)`);
      return out;
    },
  },
];

const failures = RULES.flatMap((rule) =>
  rule.check().map((msg) => `[${rule.name}] ${msg}`),
);
if (failures.length) {
  console.log(`contract: ${failures.length} problem(s)`);
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log(
  `contract: ok (${RULES.length} rules, ${TESTIDS.length} testids, ${files.length} files)`,
);
