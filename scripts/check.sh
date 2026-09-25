#!/usr/bin/env bash
# Site checks: valid HTML, and every local file the pages and stylesheet reference exists.
set -euo pipefail
cd "$(dirname "$0")/.."

pages=(index.html 404.html play/index.html)
npx --yes html-validate@9 "${pages[@]}"

missing=0
for page in "${pages[@]}" style.css; do
  dir=$(dirname "$page")
  while read -r ref; do
    case "$ref" in
      http://*|https://*|//*|/*|\#*|mailto:*|data:*|'') continue ;;
    esac
    path="$dir/${ref%%[?#]*}"
    if [ ! -e "$path" ]; then
      echo "$page: missing $ref"
      missing=1
    fi
  done < <(grep -oE '(src|href|poster)="[^"]*"|url\([^)]*\)' "$page" | sed -E 's/^(src|href|poster)="//; s/"$//; s/^url\(//; s/\)$//; s/^["'"'"']//; s/["'"'"']$//')
done
[ "$missing" -eq 0 ] || exit 1

# The trailer is set from script, so check it by name.
[ -e media/trailer.mp4 ] || { echo "missing media/trailer.mp4"; exit 1; }
echo "Site checks: ok"
