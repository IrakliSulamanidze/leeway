#!/usr/bin/env bash
# Production deploy to Vercel. Claude must ask before running this.
set -euo pipefail
bash scripts/check.sh
npx vercel --prod
