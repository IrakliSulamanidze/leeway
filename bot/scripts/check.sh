#!/usr/bin/env bash
# Formatting, types, lint, unit tests and boundaries for the bot. CI checks
# formatting from the repository root, which covers bot/. Prints at most 40
# lines so a run costs a summary, not a log. Run from anywhere.
cd "$(dirname "$0")/.." || exit 1
out=$(mktemp); status=0
run() { printf '== %s\n' "$1" >> "$out"; shift; "$@" >> "$out" 2>&1 || { status=1; echo "FAILED" >> "$out"; }; }
# Formatting uses the repository's own Prettier when it is installed.
if [ -x ../node_modules/.bin/prettier ]; then
  run format ../node_modules/.bin/prettier --check --ignore-path ../.prettierignore .
fi
run typecheck npx tsc --noEmit
run lint npx eslint . --max-warnings 0
run unit npx vitest run --reporter=dot
run boundaries node scripts/boundaries.mjs
if [ $status -eq 0 ]; then echo "bot check: all passed (format, typecheck, lint, unit, boundaries)"; else grep -vE '^\s*$' "$out" | tail -40; fi
rm -f "$out"; exit $status
