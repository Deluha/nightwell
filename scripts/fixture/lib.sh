#!/usr/bin/env bash
# Sourced by the fixture scripts: reads fixture/versions.env and pulls pinned images by digest.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSIONS="$ROOT/fixture/versions.env"

# ref NAME: the pinned reference (repo:tag@sha256:digest) of NAME.
ref() {
  local value
  value="$(grep -E "^$1=" "$VERSIONS" | head -n 1 | cut -d= -f2-)"
  [ -n "$value" ] || { echo "fixture: no pin named $1 in fixture/versions.env" >&2; return 1; }
  printf '%s\n' "$value"
}

# repo_tag NAME: the local name, repo:tag.
repo_tag() { local r; r="$(ref "$1")"; printf '%s\n' "${r%%@*}"; }

# pulled_ref NAME: the name the image is pulled by, registry/repo@sha256:digest.
pulled_ref() {
  local r repo digest
  r="$(ref "$1")"
  repo="${r%%:*}"
  digest="${r##*@}"
  case "$repo" in
    supabase/*) printf 'ghcr.io/%s@%s\n' "$repo" "$digest" ;;
    *) printf 'docker.io/library/%s@%s\n' "$repo" "$digest" ;;
  esac
}

# digest_present NAME: does the local image carry the pinned digest under the pulled name?
digest_present() {
  local pulled
  pulled="$(pulled_ref "$1")"
  docker image inspect --format '{{json .RepoDigests}}' "$pulled" 2>/dev/null | grep -qF "\"$pulled\""
}

# pull_pinned NAME: pull by digest, re-tag under the names the CLI looks up, verify the digest.
pull_pinned() {
  local name="$1" pulled local_name attempt
  pulled="$(pulled_ref "$name")"
  local_name="$(repo_tag "$name")"
  if ! digest_present "$name"; then
    for attempt in 1 2 3; do
      docker pull --quiet "$pulled" >/dev/null && break
      [ "$attempt" -lt 3 ] || { echo "fixture: could not pull $pulled" >&2; return 1; }
      sleep $((attempt * 5))
    done
  fi
  digest_present "$name" || { echo "fixture: $pulled does not carry its pinned digest" >&2; return 1; }
  docker tag "$pulled" "$local_name"
  case "$local_name" in
    supabase/*) docker tag "$pulled" "public.ecr.aws/$local_name" ;;
  esac
}

# image_id NAME: the id of the image behind the local tag of NAME.
image_id() { docker image inspect --format '{{.Id}}' "$(repo_tag "$1")"; }

# cli_cmd: sets CLI to the locked CLI, or to the newest one under NIGHTWELL_FIXTURE_LATEST=1.
cli_cmd() {
  if [ "${NIGHTWELL_FIXTURE_LATEST:-}" = "1" ]; then
    echo "fixture: unpinned run: using the newest CLI and image versions" >&2
    CLI=(npm exec --yes supabase@latest --)
  else
    CLI=("$ROOT/node_modules/.bin/supabase")
  fi
}

# parse_pg ARGS...: sets PG (17 or 15) and POOLER_ON from the arguments.
parse_pg() {
  PG=17
  POOLER_ON=0
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --pg) PG="${2:-}"; shift 2 ;;
      --with-pooler) POOLER_ON=1; shift ;;
      *) echo "usage: [--pg 17|15] [--with-pooler]" >&2; return 2 ;;
    esac
  done
  case "$PG" in 17 | 15) ;; *) echo "fixture: --pg takes 17 or 15" >&2; return 2 ;; esac
}
