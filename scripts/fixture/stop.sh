#!/usr/bin/env bash
# Stops the fixture and discards its data.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=lib.sh
. scripts/fixture/lib.sh

cli_cmd
"${CLI[@]}" stop --no-backup --workdir fixture
