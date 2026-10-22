// Repo hygiene: Conventional Commit subjects (and PR title), no emoji, and no
// console.log / debugger / TODO left in src/ and the bot's source. Compares against BASE_REF (default origin/main).
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SUBJECT =
  /^(feat|fix|chore|docs|test|ci|refactor|perf|build|style|revert)(\([a-z0-9-]+\))?!?: \S.*$/;
// The PR title becomes the squash-merge subject on main, so it gets the strict
// 72; branch commit subjects may run to 80.
const MAX = { "PR title": 72, commit: 80 };
const EMOJI = /\p{Extended_Pictographic}/u;
const failures = [];

function checkTitle(kind, text) {
  if (!SUBJECT.test(text))
    failures.push(`${kind} not Conventional (type(scope): subject): "${text}"`);
  else if (text.length > MAX[kind])
    failures.push(`${kind} longer than ${MAX[kind]} chars: "${text}"`);
  if (EMOJI.test(text)) failures.push(`${kind} has an emoji: "${text}"`);
  if (/\.$/.test(text)) failures.push(`${kind} ends with a period: "${text}"`);
}

const base = process.env.BASE_REF ?? "origin/main";
let subjects = [];
try {
  subjects = execSync(`git log --no-merges --format=%s ${base}..HEAD`, {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
} catch {
  console.log(`hygiene: note: ${base} not found, commit subjects not checked`);
}
for (const s of subjects) checkTitle("commit", s);
if (process.env.PR_TITLE) checkTitle("PR title", process.env.PR_TITLE);
if (
  process.env.PR_BODY &&
  EMOJI.test(process.env.PR_BODY.replace(/🤖 Generated with.*$/m, ""))
)
  failures.push("PR body has an emoji");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const SOURCE_DIRS = ["src", "bot/src", "bot/app"].filter((d) => existsSync(d));
for (const file of SOURCE_DIRS.flatMap(walk).filter((f) =>
  /\.(ts|tsx|js|jsx|mjs|css)$/.test(f),
)) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/\bconsole\.log\b|\bdebugger\b|\bTODO\b|\bFIXME\b/.test(line))
        failures.push(`${file}:${i + 1}: leftover console.log/debugger/TODO`);
      if (EMOJI.test(line)) failures.push(`${file}:${i + 1}: emoji in source`);
    });
}

if (failures.length) {
  console.log(`hygiene: ${failures.length} problem(s)`);
  for (const f of failures.slice(0, 30)) console.log(`- ${f}`);
  process.exit(1);
}
console.log(`hygiene: ok (${subjects.length} commits checked)`);
