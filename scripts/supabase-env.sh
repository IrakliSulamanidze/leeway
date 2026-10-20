#!/usr/bin/env bash
# Prints the two public env vars of the running LOCAL Supabase (never the service key).
# Local: eval "$(bash scripts/supabase-env.sh)"   CI: bash scripts/supabase-env.sh >> "$GITHUB_ENV"
set -euo pipefail
supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 2>/dev/null |
  grep -E '^NEXT_PUBLIC_SUPABASE_(URL|PUBLISHABLE_KEY)=' | tr -d '"' |
  if [ -n "${GITHUB_ENV:-}" ]; then cat; else sed 's/^/export /'; fi
