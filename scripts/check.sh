#!/usr/bin/env bash
# Typecheck + lint + unit tests. Prints at most 40 lines so Claude reads a summary, not a log.
out=$(mktemp); status=0
run() { printf '== %s\n' "$1" >> "$out"; shift; "$@" >> "$out" 2>&1 || { status=1; echo "FAILED" >> "$out"; }; }
run typegen npx next typegen
run typecheck npx tsc --noEmit
run lint npx eslint . --max-warnings 0
run unit npx vitest run --reporter=dot
if [ $status -eq 0 ]; then echo "check: all passed (typecheck, lint, unit)"; else grep -vE '^\s*$' "$out" | tail -40; fi
rm -f "$out"; exit $status
