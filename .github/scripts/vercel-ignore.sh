#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 builds.
# Production: main, when the web app, shared code, dependencies or this script change.
# Previews (Vercel Pro): factory/* branches only, for the build gate's UI check. Previews use the
# production database (platform-notes.md), so the gate only reads there and never creates test data.
REF="${VERCEL_GIT_COMMIT_REF:-main}"
case "$REF" in
  main) ;;
  factory/*) echo "build: preview for $REF"; exit 1 ;;
  *) echo "skip: preview for $REF"; exit 0 ;;
esac
cd "$(git rev-parse --show-toplevel)" || exit 1
git rev-parse -q --verify HEAD^ >/dev/null || exit 1
if git diff --quiet HEAD^ HEAD -- apps/web packages package.json package-lock.json .github/scripts/vercel-ignore.sh; then
  echo "skip: no changes in apps/web, packages, dependencies or the ignore script"; exit 0
fi
exit 1
