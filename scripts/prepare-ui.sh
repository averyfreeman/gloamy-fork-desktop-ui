#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE="$REPO_ROOT/ui"
BUILD_UI="$REPO_ROOT/.desktop-build/ui"

if [[ ! -f "$SOURCE/.git" && ! -d "$SOURCE/.git" ]]; then
  echo "the UI submodule is missing; clone with --recurse-submodules or run git submodule update --init" >&2
  exit 1
fi

if [[ ! -d "$SOURCE/node_modules" ]]; then
  pnpm --dir "$SOURCE" install --frozen-lockfile
fi

rm -rf "$BUILD_UI"
mkdir -p "$BUILD_UI"
git -C "$SOURCE" archive HEAD | tar -x -C "$BUILD_UI"
(cd "$BUILD_UI" && patch --batch --silent -p1 -i "$REPO_ROOT/patches/ui-desktop.patch")
mkdir -p "$BUILD_UI/src/lib"
cp "$REPO_ROOT/overlays/desktop.ts" "$BUILD_UI/src/lib/desktop.ts"
mkdir -p "$BUILD_UI/tests/unit"
cp "$REPO_ROOT/overlays/tests/unit/desktop.spec.ts" "$BUILD_UI/tests/unit/desktop.spec.ts"
ln -s "$SOURCE/node_modules" "$BUILD_UI/node_modules"

case "${1:-build}" in
  dev)
    exec pnpm --dir "$BUILD_UI" dev --host 127.0.0.1
    ;;
  build)
    pnpm --dir "$BUILD_UI" build
    ;;
  test)
    exec pnpm --dir "$BUILD_UI" test:unit
    ;;
  *)
    echo "usage: $0 [dev|build|test]" >&2
    exit 2
    ;;
esac
