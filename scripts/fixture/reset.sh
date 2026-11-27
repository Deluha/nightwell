#!/usr/bin/env bash
# Rebuilds the running fixture database from its migrations and seed.
#   reset.sh [--pg 17|15]
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=lib.sh
. scripts/fixture/lib.sh

parse_pg "$@"
cli_cmd
export SUPABASE_DB_MAJOR_VERSION="$PG"
"${CLI[@]}" db reset --workdir fixture
