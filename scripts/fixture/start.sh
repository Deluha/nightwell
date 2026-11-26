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

# Every container of the fixture must run a pinned image: the database one its own pin, any other one of
# the pins started above.
if [ "$pinned" = 1 ]; then
  pinned_ids=()
  for name in "${names[@]}"; do pinned_ids+=("$(image_id "$name")"); done
  bad=""
  running="$(docker inspect --format '{{.Image}}' supabase_db_cellarbook)"
  [ "$running" = "$(image_id "$db")" ] || bad="supabase_db_cellarbook (the $db pin)"
  while IFS= read -r container; do
    running="$(docker inspect --format '{{.Image}}' "$container")"
    case " ${pinned_ids[*]} " in
      *" $running "*) ;;
      *) bad="$container" ;;
    esac
  done < <(docker ps --filter 'name=^supabase_.*_cellarbook$' --format '{{.Names}}')
  if [ -n "$bad" ]; then
    echo "fixture: $bad does not run a pinned image; stopping" >&2
    "${CLI[@]}" stop --no-backup --workdir fixture
    exit 1
  fi
fi
