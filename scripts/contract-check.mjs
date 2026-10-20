// Grading-contract check: fails if a required data-testid, the text core-input,
// the proxy, or the secret-key boundary is broken. Prints one line per failure.
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
const failures = [];

for (const id of TESTIDS) {
  if (!all.includes(`"${id}"`)) failures.push(`missing data-testid "${id}"`);
}

// core-input must be a text field: an <input type="text"> or a <textarea>.
const coreTag = all.match(
  /<(input|textarea)\b[^>]*data-testid="core-input"[^>]*>/s,
);
if (!coreTag) failures.push("core-input is not on an <input> or <textarea>");
else if (coreTag[1] === "input" && !/type="text"/.test(coreTag[0]))
  failures.push('core-input must have type="text"');

for (const { file, text } of sources) {
  if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(text))
    failures.push(`${file}: browser storage is not allowed for user data`);
  if (
    /SUPABASE_SECRET_KEY|service_role|sb_secret_/.test(text) &&
    !file.startsWith(SECRET_ALLOWED_DIR)
  )
    failures.push(
      `${file}: secret key referenced outside ${SECRET_ALLOWED_DIR}`,
    );
  if (
    /process\.env\.NEXT_PUBLIC_(?!SUPABASE_URL\b|SUPABASE_PUBLISHABLE_KEY\b|VAPID_PUBLIC_KEY\b)\w+/.test(
      text,
    )
  )
    failures.push(
      `${file}: only the Supabase URL, publishable key and VAPID public key may be NEXT_PUBLIC`,
    );
}

// Next 16 loads the proxy from src/proxy.ts; a middleware.ts would be ignored or conflict.
if (!existsSync("src/proxy.ts")) failures.push("src/proxy.ts is missing");
else if (
  !/export (async )?function proxy\b/.test(readFileSync("src/proxy.ts", "utf8"))
)
  failures.push("src/proxy.ts must export function proxy");
for (const f of ["middleware.ts", "src/middleware.ts", "proxy.ts"])
  if (existsSync(f)) failures.push(`${f} must not exist (use src/proxy.ts)`);

if (failures.length) {
  console.log(`contract: ${failures.length} problem(s)`);
  for (const f of failures) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`contract: ok (${TESTIDS.length} testids, ${files.length} files)`);
