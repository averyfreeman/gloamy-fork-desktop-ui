# Gloamy Desktop

Gloamy Desktop is a Tauri 2 application for macOS Apple Silicon and Linux. It
uses the browser UI in the pinned [`ui`](ui) submodule and manages a bundled
Gloamy daemon built and released by the
[backend repository](https://github.com/averyfreeman/gloamy-app-server-oauth2).

The desktop app and browser UI are separate projects. The desktop repository
pins an exact web UI commit, so updating the desktop frontend is an explicit
submodule change.

## Prerequisites

- Rust 1.96 or newer.
- Node.js 24 and pnpm 12.18.
- On Linux, the Tauri WebKitGTK 4.1 development libraries and desktop bundler
  dependencies listed in the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/).
- The public Gloamy backend `v0.2.2` release, which provides native daemon
  binaries for the supported targets.

## Checkout and build

```bash
git clone --recurse-submodules https://github.com/averyfreeman/gloamy-fork-desktop-ui.git
cd gloamy-fork-desktop-ui
pnpm install --frozen-lockfile
pnpm --dir ui install --frozen-lockfile
pnpm tauri:dev
```

The build copies the pinned UI submodule into an ignored working directory and
applies the desktop-owned `patches/ui-desktop.patch` overlay there. It leaves
the submodule checkout clean. The build script downloads the host-matching
daemon binary from backend release `v0.2.2`, verifies it against `SHA256SUMS`,
and stages it as a Tauri resource. For local development against a locally built daemon, set
`GLOAMY_SIDECAR_PATH=/absolute/path/to/gloamy`.

To produce a native bundle:

```bash
pnpm tauri:build
```

Desktop bridge and browser UI unit tests:

```bash
./scripts/prepare-ui.sh test
```

## Daemon and pairing

On launch, the desktop app attaches to a healthy local Gloamy daemon or starts
its bundled daemon when none is available. It uses a same-user Unix control
socket for status, one-time pairing-code recovery, and graceful shutdown. The
app never stops a daemon it does not own. The **Keep daemon running after
closing** preference is off by default.

The About menu identifies the desktop build as **v0.1.1** and displays the
gateway version reported by the running daemon. Older daemons without that
field display **Not reported**.

## Validation

The CI matrix builds the app natively for:

- `aarch64-apple-darwin`
- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`

See the [desktop guides](docs/i18n/README.md) for operational and recovery
details in the supported locales.
