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
// Only the nightly cron route may read the secret key (docs/process.md 5.5).
const SECRET_ALLOWED_DIR = join("src", "app", "api", "cron");
// pdfjs-dist is heavy and needs its worker set up once; it lives in one module.
const PDFJS_ALLOWED_DIR = join("src", "lib", "pdf");

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
    check: perFile((file, text) =>
      /SUPABASE_SECRET_KEY|service_role|sb_secret_/.test(text) &&
      !file.startsWith(SECRET_ALLOWED_DIR)
        ? [`${file}: secret key referenced outside ${SECRET_ALLOWED_DIR}`]
        : [],
    ),
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
    name: "src never imports e2e helpers",
    check: perFile((file, text) =>
      /(from\s+|import\s*\(\s*|require\s*\(\s*)["'][^"']*e2e\//.test(text)
        ? [`${file}: src/ must not import from e2e/`]
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
