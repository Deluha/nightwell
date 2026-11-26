#!/usr/bin/env bash
# The one entry point to the secret scanner, used by the git hooks and by CI.
#   secret-scan.sh staged            the staged changes
#   secret-scan.sh tree              every file in the working tree
#   secret-scan.sh range <base>      the commits and commit messages since <base>
#   secret-scan.sh text <path>       a file or directory of text (messages, pull-request text)
set -euo pipefail
cd "$(dirname "$0")/../.."

scanner=".tools/bin/gitleaks"
if [ ! -x "$scanner" ]; then
  scanner="$(command -v gitleaks || true)"
fi
if [ -z "$scanner" ]; then
  echo "secret-scan: the scanner is not installed; run scripts/dev/install-tools.sh" >&2
  exit 1
fi
scan() { "$scanner" "$@" --config .gitleaks.toml --redact --no-banner --log-level warn; }

case "${1:-}" in
  staged) scan git --staged --pre-commit ;;
  tree) scan dir . ;;
  range)
    scan git --log-opts="$2..HEAD"
    messages="$(mktemp -d)"
    trap 'rm -rf "$messages"' EXIT
    git log --format=%B "$2..HEAD" > "$messages/commit-messages.txt"
    scan dir "$messages"
    ;;
  text) scan dir "$2" ;;
  *)
    echo "usage: secret-scan.sh staged | tree | range <base> | text <path>" >&2
    exit 2
    ;;
esac
