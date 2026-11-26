#!/usr/bin/env bash
# Installs the development tools: the locked npm packages (which include the
# pinned Supabase CLI), the pinned secret scanner and workflow linter, and the
# git hooks. Safe to run again. Versions are pinned here and nowhere else.
# The workflow linter needs Go 1.25 or newer.
set -euo pipefail
cd "$(dirname "$0")/../.."

GITLEAKS_MODULE="github.com/zricethezav/gitleaks/v8"
GITLEAKS_VERSION="v8.30.1"
GITLEAKS_SUM="h1:PmEvCfVI7ti9dV3s5aMZUY7sS2GxRvG3yzih7E+cS3w="
ACTIONLINT_MODULE="github.com/rhysd/actionlint"
ACTIONLINT_VERSION="v1.7.12"
ACTIONLINT_SUM="h1:vQ4GeJN86C0QH+gTUQcs8McmK62OLT3kmakPMtEWYnY="

# First, so the hooks fail closed even if a download below fails.
if [ -d .githooks ] && git rev-parse --git-dir >/dev/null 2>&1; then
  git config core.hooksPath .githooks
fi

npm ci --ignore-scripts --no-audit --no-fund

# Builds a Go tool at a pinned version after comparing the module checksum
# with the one recorded above. Go's checksum database is checked as well.
install_go_tool() {
  local module="$1" version="$2" sum="$3" package="$4" name="$5"
  if [ -x ".tools/bin/$name" ] && [ "$(cat ".tools/$name.version" 2>/dev/null)" = "$version" ]; then
    return
  fi
  if ! command -v go >/dev/null; then
    echo "install-tools: Go is not installed; skipping $name (CI still runs it)" >&2
    return
  fi
  # The download reports a failure (an older Go than the module needs, no
  # network) as JSON on standard output with a non-zero status: show it.
  local info actual
  if ! info="$(go mod download -json "$module@$version")"; then
    echo "install-tools: cannot download $module@$version:" >&2
    echo "$info" >&2
    exit 1
  fi
  actual="$(echo "$info" | sed -n 's/.*"Sum": "\(.*\)",*/\1/p')"
  if [ "$actual" != "$sum" ]; then
    echo "install-tools: checksum mismatch for $module@$version" >&2
    exit 1
  fi
  GOBIN="$PWD/.tools/bin" go install "$package@$version"
  echo "$version" > ".tools/$name.version"
}

mkdir -p .tools/bin
install_go_tool "$GITLEAKS_MODULE" "$GITLEAKS_VERSION" "$GITLEAKS_SUM" "$GITLEAKS_MODULE" gitleaks
install_go_tool "$ACTIONLINT_MODULE" "$ACTIONLINT_VERSION" "$ACTIONLINT_SUM" \
  "$ACTIONLINT_MODULE/cmd/actionlint" actionlint
