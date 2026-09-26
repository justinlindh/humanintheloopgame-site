#!/usr/bin/env bash
# The Pages artifact allowlist, shared by deployment and CI.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir _site
cp -r index.html 404.html style.css *.js favicon.png .nojekyll img media play _site/
