#!/usr/bin/env bash
# Runs tests/integration against the running LOCAL Supabase. Its keys (a local demo
# service key included) are read at runtime and exported only into this process.
set -euo pipefail
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=' | sed 's/^/export /')"
npx vitest run --config vitest.integration.config.ts --reporter=dot "$@"
