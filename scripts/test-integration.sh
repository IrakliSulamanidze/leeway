#!/usr/bin/env bash
# Runs tests/integration against the running LOCAL Supabase. Keys (local demo keys)
# are read at runtime from `supabase status` and exported only into this process.
set -euo pipefail
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|SECRET_KEY)=' | sed 's/^/export /')"
if [ -z "${API_URL:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "local Supabase is not running (supabase start)"; exit 1
fi
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export SUPABASE_SECRET_KEY="${SECRET_KEY:-$SERVICE_ROLE_KEY}"
npx vitest run --config vitest.integration.config.ts --reporter=dot "$@"
