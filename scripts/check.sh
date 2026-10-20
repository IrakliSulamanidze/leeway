#!/usr/bin/env bash
# Format, typecheck, lint, unit, contract and hygiene checks. Prints at most 40 lines
# so Claude reads a summary, not a log.
out=$(mktemp); status=0
run() { printf '== %s\n' "$1" >> "$out"; shift; "$@" >> "$out" 2>&1 || { status=1; echo "FAILED" >> "$out"; }; }
run format npx prettier --check .
run typegen npx next typegen
run typecheck npx tsc --noEmit
run lint npx eslint . --max-warnings 0
run unit npx vitest run --reporter=dot
run contract node scripts/contract-check.mjs
run hygiene node scripts/hygiene-check.mjs
if [ $status -eq 0 ]; then echo "check: all passed (format, typecheck, lint, unit, contract, hygiene)"; else grep -vE '^\s*$' "$out" | tail -40; fi
rm -f "$out"; exit $status
