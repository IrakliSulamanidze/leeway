#!/usr/bin/env bash
# Runs tests/integration against the running LOCAL Supabase. Keys are read at
# runtime from `supabase status` and live only in this process's environment.
set -euo pipefail
status=$(supabase status -o env 2>/dev/null | tr -d '"')
pick() { printf '%s\n' "$status" | grep -E "^$1=" | head -1 | cut -d= -f2-; }
NEXT_PUBLIC_SUPABASE_URL=$(pick API_URL)
SUPABASE_SECRET_KEY=$(pick SECRET_KEY)
[ -n "$SUPABASE_SECRET_KEY" ] || SUPABASE_SECRET_KEY=$(pick SERVICE_ROLE_KEY)
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SECRET_KEY" ]; then
  echo "local Supabase is not running (supabase start)"; exit 1
fi
export NEXT_PUBLIC_SUPABASE_URL SUPABASE_SECRET_KEY
INTEGRATION=1 npx vitest run --reporter=dot "$@"
