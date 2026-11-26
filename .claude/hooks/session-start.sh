#!/usr/bin/env bash
# Installs the development tools at the start of a cloud session, where the
# container is new each time. A local session installs them once by hand.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-.}"
if ! bash scripts/dev/install-tools.sh > /tmp/nightwell-install-tools.log 2>&1; then
  # Standard output of this hook reaches the session; standard error does not.
  echo "session-start: installing the development tools FAILED; see /tmp/nightwell-install-tools.log."
  echo "The secret scanner or the locked packages may be missing: tell the owner before committing."
fi
