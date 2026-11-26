#!/usr/bin/env bash
# Builds and packs the package, installs the tarball into an empty directory
# with install scripts off, and runs the binary and the library entry point.
set -euo pipefail
cd "$(dirname "$0")/../.."
root="$PWD"

npm run --silent build
tarball="$root/$(npm pack --silent --ignore-scripts | tail -n 1)"
work="$(mktemp -d)"
trap 'rm -rf "$work" "$tarball"' EXIT

cd "$work"
npm init --yes > /dev/null
npm install --ignore-scripts --no-audit --no-fund "$tarball" > /dev/null

expected="$(node -p "require('$root/package.json').version" 2>/dev/null || node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1])).version)" "$root/package.json")"
actual="$(npx --no-install nightwell --version)"
if [ "$actual" != "$expected" ]; then
  echo "package-smoke: binary printed '$actual', expected '$expected'" >&2
  exit 1
fi
npx --no-install nightwell --help > /dev/null
node --input-type=module -e 'await import("nightwell")'
echo "package-smoke: ok ($actual)"
