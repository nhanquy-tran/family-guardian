#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 builds.
# Skips spec branches and commits that do not touch the web app or shared code (Hobby build-rate limit).
case "${VERCEL_GIT_COMMIT_REF:-}" in spec/*) echo "skip: spec branch"; exit 0 ;; esac
cd "$(git rev-parse --show-toplevel)" || exit 1
git rev-parse -q --verify HEAD^ >/dev/null || exit 1
if git diff --quiet HEAD^ HEAD -- apps/web packages package.json package-lock.json; then
  echo "skip: no changes in apps/web, packages or dependencies"; exit 0
fi
exit 1
