#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"
RESOURCE_DIR="$REPO_ROOT/src-tauri/resources"
DESTINATION="$RESOURCE_DIR/gloamy"
BACKEND_REPOSITORY="averyfreeman/gloamy-app-server-oauth2"
BACKEND_VERSION="$(tr -d '[:space:]' < "$REPO_ROOT/backend-version.txt")"
TARGET="$(rustc --print host-tuple)"

case "$TARGET" in
  aarch64-apple-darwin|x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu) ;;
  *)
    echo "unsupported desktop host target: $TARGET" >&2
    exit 1
    ;;
esac

mkdir -p "$RESOURCE_DIR"

if [[ -n "${GLOAMY_SIDECAR_PATH:-}" ]]; then
  if [[ ! -x "$GLOAMY_SIDECAR_PATH" ]]; then
    echo "GLOAMY_SIDECAR_PATH is not an executable file" >&2
    exit 1
  fi
  install -m 0755 "$GLOAMY_SIDECAR_PATH" "$DESTINATION"
else
  WORK_DIR="$(mktemp -d)"
  trap 'rm -rf "$WORK_DIR"' EXIT
  ASSET="gloamy-$TARGET.tar.gz"
  RELEASE_URL="https://github.com/$BACKEND_REPOSITORY/releases/download/v$BACKEND_VERSION"

  curl --fail --location --silent --show-error "$RELEASE_URL/$ASSET" -o "$WORK_DIR/$ASSET"
  curl --fail --location --silent --show-error "$RELEASE_URL/SHA256SUMS" -o "$WORK_DIR/SHA256SUMS"

  CHECKSUM_LINE="$(awk -v asset="$ASSET" '$2 == asset { print; exit }' "$WORK_DIR/SHA256SUMS")"
  if [[ -z "$CHECKSUM_LINE" ]]; then
    echo "release checksums do not contain $ASSET" >&2
    exit 1
  fi
  printf '%s\n' "$CHECKSUM_LINE" > "$WORK_DIR/asset.sha256"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$WORK_DIR" && sha256sum -c asset.sha256)
  else
    (cd "$WORK_DIR" && shasum -a 256 -c asset.sha256)
  fi

  mkdir "$WORK_DIR/unpacked"
  tar -xzf "$WORK_DIR/$ASSET" -C "$WORK_DIR/unpacked"
  if [[ ! -x "$WORK_DIR/unpacked/gloamy" ]]; then
    echo "release asset does not contain an executable gloamy binary" >&2
    exit 1
  fi
  install -m 0755 "$WORK_DIR/unpacked/gloamy" "$DESTINATION"
fi

VERSION_OUTPUT="$("$DESTINATION" --version)"
if [[ "$VERSION_OUTPUT" != *"$BACKEND_VERSION"* ]]; then
  echo "sidecar version does not match pinned backend version $BACKEND_VERSION" >&2
  exit 1
fi
