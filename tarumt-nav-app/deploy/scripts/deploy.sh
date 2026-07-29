#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s <ssh-host> [remote-root]\n' "$0" >&2
  printf 'Example: %s hy@100.87.31.93 /opt/campus-navigator\n' "$0" >&2
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 2
fi

remote_host=$1
remote_root=${2:-/opt/campus-navigator}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repository_root=$(cd "$script_dir/../.." && pwd)

cd "$repository_root"

if [[ -n $(git status --porcelain) ]]; then
  printf '%s\n' "Refusing to deploy a dirty worktree. Commit or stash all changes first." >&2
  exit 1
fi

release_id=$(git rev-parse --verify HEAD)
archive=$(mktemp "${TMPDIR:-/tmp}/campus-navigator.XXXXXX.tar.gz")
remote_archive="/tmp/campus-navigator-${release_id}.tar.gz"
trap 'rm -f "$archive"' EXIT

git archive --format=tar.gz --output="$archive" "$release_id"
scp "$archive" "${remote_host}:${remote_archive}"

ssh "$remote_host" bash -s -- "$release_id" "$remote_root" "$remote_archive" <<'REMOTE'
set -euo pipefail

release_id=$1
remote_root=$2
remote_archive=$3
release_dir="${remote_root}/releases/${release_id}"
environment_file="${remote_root}/shared/production.env"
compose_file="${release_dir}/deploy/compose.production.yaml"

if [[ ! -f "$environment_file" ]]; then
  printf 'Missing %s\n' "$environment_file" >&2
  printf '%s\n' "Create it from deploy/.env.production.example before the first deployment." >&2
  exit 1
fi

sudo install -d -m 0755 "${remote_root}/releases" "${remote_root}/shared"
sudo install -d -m 0755 "$release_dir"
sudo tar -xzf "$remote_archive" -C "$release_dir"
rm -f "$remote_archive"

sudo docker compose \
  --project-name campus-navigator \
  --env-file "$environment_file" \
  --file "$compose_file" \
  config --quiet

sudo docker compose \
  --project-name campus-navigator \
  --env-file "$environment_file" \
  --file "$compose_file" \
  up --detach --build --remove-orphans --wait

"${release_dir}/deploy/scripts/smoke-test.sh" "$compose_file" "$environment_file"
sudo ln -sfn "$release_dir" "${remote_root}/current"

printf 'Deployed release %s\n' "$release_id"
REMOTE

