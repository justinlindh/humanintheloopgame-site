#!/usr/bin/env bash
# Validate HTML and the files referenced by the exact Pages artifact.
set -euo pipefail
cd "$(dirname "$0")/.."

npm test
npx --no-install html-validate index.html 404.html play/index.html
rm -rf _site
scripts/stage-site.sh
node scripts/check-site.mjs _site
echo "Site checks: ok"
