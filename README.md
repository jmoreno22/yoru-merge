<p align="center">
  <img src="docs/logo.png" width="140" alt="YoruMerge logo" />
</p>

<h1 align="center">YoruMerge</h1>

<p align="center">
  A fast, keyboard-friendly Git GUI for Windows and Linux —<br />
  Fork's daily workflow with the atmosphere of Tokyo after midnight.
</p>

<p align="center">
  <a href="https://github.com/jmoreno22/yoru-merge/actions/workflows/ci.yml"><img src="https://github.com/jmoreno22/yoru-merge/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/jmoreno22/yoru-merge/releases/latest"><img src="https://img.shields.io/github/v/release/jmoreno22/yoru-merge?label=release&color=22d3ee" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/jmoreno22/yoru-merge?color=ff4fb8" alt="License" /></a>
</p>

![History view, Yoru Night theme](docs/screenshots/history-dark.png)

<details>
<summary>More screenshots</summary>

![Working tree and commit composer, Moonlit Workbench theme](docs/screenshots/changes-light.png)

![A merge in progress, with the repository-state banner](docs/screenshots/conflict-banner.png)

</details>

## Install

Grab the installer for your platform from the
[latest release](https://github.com/jmoreno22/yoru-merge/releases/latest).

### Windows

Download **`YoruMerge_<version>_x64-setup.exe`** (recommended) or the `.msi`
and run it. The binaries are not code-signed yet, so SmartScreen warns on first
run — choose **More info → Run anyway**.

### Ubuntu / Debian

```bash
sudo apt install ./YoruMerge_<version>_amd64.deb
```

### Fedora / openSUSE

```bash
sudo dnf install ./YoruMerge-<version>-1.x86_64.rpm
```

### Any Linux distribution — AppImage

```bash
chmod +x YoruMerge_<version>_amd64.AppImage
./YoruMerge_<version>_amd64.AppImage
```

AppImages need FUSE; on Ubuntu 22.04+ run `sudo apt install libfuse2` once.

### Auto-updates

The app checks GitHub Releases on launch and every six hours, shows the release
notes in-app, and updates itself on confirmation. That covers the Windows
installs and the Linux AppImage; `.deb` / `.rpm` installs still get notified,
but install the new version through the package file from Releases.

### macOS

Not built or tested yet.

## What it does

- **History** — commit list with a canvas branch graph, ref pills, author
  avatars, infinite scroll over large repositories, and a commit inspector with
  the full message, file list and per-file diff.
- **Working tree** — stage and unstage by file, hunk or line selection, discard,
  ignore, assume-unchanged, and a commit composer with conventional-commit
  chips, amend, sign-off and GPG signing.
- **Branches and refs** — create, rename, delete, checkout (including a dirty
  tree), set upstream, compare, plus tags, stashes and remote branches in one
  filterable panel.
- **Remotes** — fetch, pull (merge / rebase / fast-forward-only), push with
  `--force-with-lease`, streaming progress, and clear authentication errors.
- **Rewriting history** — merge, rebase, interactive rebase, cherry-pick,
  revert, reset, squash — each with continue / skip / abort when it stops.
- **Conflicts** — a three-pane resolver, take-ours / take-theirs, and a state
  banner that tells you exactly which operation is in progress.
- **Inspection** — diff viewer with syntax highlighting, split and unified
  layouts, whitespace and context controls, blame, file history, and reflog.
- **Multi-repo** — several repositories open as tabs, each with its own file
  watcher.
- **Two themes** — Yoru Night (dark) and Moonlit Workbench (light), both
  deliberate. See [DESIGN.md](DESIGN.md).

## Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 |
| Frontend | Angular 20, Signals, standalone components |
| Styling | Tailwind CSS 4, Lucide icons via `@ng-icons` |
| Backend | Rust, driving the `git` CLI |
| Tooling | pnpm, Biome, Vitest |

## Development

### Prerequisites

- **Node.js ≥ 22**
- **pnpm 11** — `corepack enable` picks up the version pinned in
  `package.json` (`packageManager`)
- **Rust stable** — via [rustup](https://rustup.rs)
- **Linux only** — system packages for WebKitGTK:

  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
    librsvg2-dev patchelf libgtk-3-dev libssl-dev build-essential
  ```

### Run

```bash
cd yoru-merge
pnpm install
pnpm tauri dev
```

### Scripts

All run from the repository root:

| Command | What it does |
| --- | --- |
| `pnpm tauri dev` | run the desktop app with hot reload |
| `pnpm tauri build` | build the installers for the current platform |
| `pnpm start` | Angular dev server only, on port 1420 |
| `pnpm build` | frontend production build (enforces the bundle budgets) |
| `pnpm lint` | Biome check over `src` |
| `pnpm format` | Biome format `src` in place |
| `pnpm test` | Vitest unit tests |

Rust, from `src-tauri/`:

```bash
cargo clippy --all-targets -- -D warnings
cargo test --all-features
```

## Keyboard

`Ctrl` is `Cmd` on macOS builds. Every binding is registered in one place and
the command palette shows the real combo, so this table cannot drift silently.

| Keys | Action |
| --- | --- |
| `Ctrl+K` | command palette (`>` branches, `@` files, `#` commits, `:` settings) |
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Changes / History / Reflog |
| `Ctrl+B` | show or hide the refs panel |
| `Ctrl+O` | open a repository |
| `F5` | refresh the repository |
| `Ctrl+W` | close the current tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | next / previous tab |
| `Ctrl+Shift+F` / `Ctrl+Shift+D` / `Ctrl+Shift+U` | fetch / pull / push |
| `Ctrl+F` | search commits |
| `Ctrl+Enter` | commit |
| `Ctrl+,` | settings |
| `Ctrl+Shift+T` | switch theme |
| `n` / `p` | next / previous hunk in the diff viewer |

Lists (refs, commits, changed files) are fully keyboard-navigable with the
arrow keys, `Home`/`End`, `Enter` and `Space`.

## Troubleshooting

**Windows: paths longer than 260 characters.** Git itself fails on them, and
YoruMerge surfaces that failure rather than working around it — checkout, clone
and staging can all report a "Filename too long" error. Enable long paths on
both sides:

```powershell
git config --global core.longpaths true
# and, once, as an administrator:
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' `
  -Name LongPathsEnabled -Value 1
```

The registry change needs a sign-out (or reboot) to take effect.

## Documentation

| File | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | the three layers and how they talk |
| [DESIGN.md](DESIGN.md) | the design system — read before touching UI |
| [CONTRIBUTING.md](CONTRIBUTING.md) | conventions and the pre-PR checklist |
| `src/app/shared/ui/README.md` | the UI kit API |
| `src/app/shared/icons/README.md` | Git concept → icon map |

## License

MIT © 2026 jhoan
