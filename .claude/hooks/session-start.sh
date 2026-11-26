#!/usr/bin/env bash
# Installs the development tools at the start of a cloud session, where the
# container is new each time. A local session installs them once by hand.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-.}"
if ! bash scripts/dev/install-tools.sh > /tmp/nightwell-install-tools.log 2>&1; then
  echo "session-start: installing the development tools failed; see /tmp/nightwell-install-tools.log" >&2
fi
