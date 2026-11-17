#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 builds.
# Skips spec branches and commits that do not touch the web app or shared code (Hobby build-rate limit).
# Only main deploys: previews share the production database anyway, and Hobby limits deployments per day.
[ "${VERCEL_GIT_COMMIT_REF:-main}" != "main" ] && { echo "skip: preview for ${VERCEL_GIT_COMMIT_REF}"; exit 0; }
cd "$(git rev-parse --show-toplevel)" || exit 1
git rev-parse -q --verify HEAD^ >/dev/null || exit 1
if git diff --quiet HEAD^ HEAD -- apps/web packages package.json package-lock.json; then
  echo "skip: no changes in apps/web, packages or dependencies"; exit 0
fi
exit 1
