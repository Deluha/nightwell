#!/usr/bin/env bash
# Starts the fixture database (and with --with-pooler, its pooler) on pinned images.
#   start.sh [--pg 17|15] [--with-pooler]
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=lib.sh
. scripts/fixture/lib.sh

parse_pg "$@"
db="PG${PG}_DB"
cli_cmd
pinned=1
[ "${NIGHTWELL_FIXTURE_LATEST:-}" = "1" ] && pinned=0

if [ "$pinned" = 1 ]; then
  names=("$db" AUTH REALTIME STORAGE)
  [ "$POOLER_ON" = 1 ] && names+=(POOLER)
  for name in "${names[@]}"; do pull_pinned "$name"; done
fi

export SUPABASE_DB_MAJOR_VERSION="$PG"
if [ "$POOLER_ON" = 1 ]; then
  "${CLI[@]}" start --workdir fixture \
    -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector
else
  "${CLI[@]}" db start --workdir fixture
fi

if [ "$pinned" = 1 ]; then
  running="$(docker inspect --format '{{.Image}}' supabase_db_cellarbook)"
  if [ "$running" != "$(image_id "$db")" ]; then
    echo "fixture: supabase_db_cellarbook does not run the pinned $db image; stopping" >&2
    "${CLI[@]}" stop --no-backup --workdir fixture
    exit 1
  fi
fi
