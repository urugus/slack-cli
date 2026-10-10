#!/usr/bin/env bash
set -euo pipefail

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo 'Refusing publication with tracked changes in the checkout.' >&2
  exit 1
fi

branch=codex/download-statistics
backup=$(mktemp)
trap 'rm -f "$backup"' EXIT
mv assets/downloads.png "$backup"

if git ls-remote --exit-code --heads origin "refs/heads/$branch" >/dev/null; then
  git fetch origin "refs/heads/$branch:refs/remotes/origin/$branch"
  git switch -c "$branch" --track "origin/$branch"
else
  status=$?
  if [ "$status" -ne 2 ]; then
    exit "$status"
  fi
  git switch --orphan "$branch"
fi

mkdir -p assets
cp "$backup" assets/downloads.png
git add assets/downloads.png
if git diff --cached --quiet; then
  echo 'Download chart is unchanged.'
  exit 0
fi
git -c user.name='github-actions[bot]' \
  -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
  commit -m 'docs: update monthly download chart'
git push origin "HEAD:refs/heads/$branch"
