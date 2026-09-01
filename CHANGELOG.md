# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- "Check for updates" in Settings/About only reported that a new version
  exists; it now opens the update dialog so the update can actually be
  accepted or declined.

## [1.0.1] - 2026-09-01

### Fixed

- The window close button (and every other close path) did nothing: the
  preferences close hook reroutes closing through `destroy()`, which was
  missing its capability. Preferences are now also flushed to disk before the
  window is destroyed instead of racing process exit.

## [1.0.0] - 2026-08-31

First release. YoruMerge is a Git GUI for Windows and Linux built on Tauri 2,
Angular 20 and Rust.

### Added

- **Repositories** — open, clone (with depth and branch options and streaming
  progress) and initialise; several repositories open as tabs, each with its own
  file-system watcher; recent repositories with remove and reveal.
- **History** — virtualised commit list over repositories of any size, a canvas
  branch graph with an edge index, ref pills, author avatars, dimming for
  commits the current branch cannot reach, multi-select, and a commit search
  that leaves the graph aligned.
- **Commit inspector** — full message, parents, signature, per-file diff, rename
  detection and "open on remote" for recognised hosts.
- **Working tree** — staging by file, hunk or line selection; discard, ignore
  and assume-unchanged; a commit composer with conventional-commit chips, the
  50/72 ruler, amend, sign-off, skip-hooks, and a split button for commit,
  commit & push, commit & tag and `fixup!`.
- **Refs panel** — local and remote branches grouped into collapsible prefix
  folders, tags and stashes, a fuzzy filter, full context menus, and
  drag-and-drop with a context-aware drop menu (merge, rebase, cherry-pick,
  reset).
- **Remotes** — fetch, fetch all with prune, pull (merge / rebase /
  fast-forward-only, with autostash), push including set-upstream, tags and
  `--force-with-lease`, with progress in the status bar and actionable toasts.
- **Rewriting history** — merge, rebase, interactive rebase (reorder, reword,
  squash, fixup, drop, edit), cherry-pick, revert and reset, each with continue,
  skip and abort surfaced by a repository-state banner.
- **Conflicts** — a resolver with per-file and per-block counters, take
  ours/theirs/both, keyboard navigation, and mark-resolved.
- **Diff** — unified and split layouts, whitespace and context controls, word
  wrap, syntax highlighting, collapsing for very large hunks, and a guard for
  files over 1.5 MB; plus blame and file history.
- **Reflog** view, with reset to a previous state.
- **Command palette** — commands, branches, files, commits and settings, with
  fuzzy matching and the real key bindings shown next to each entry.
- **Settings** — interface density, theme, external editor and terminal, and
  global and per-repository git configuration.
- **Design system** — two deliberate themes (Yoru Night and Moonlit Workbench),
  self-hosted fonts, a Lucide icon set, and a shared `yoru-*` UI kit.
- **Diff extras** — side-by-side image preview (old/new, lazy-loaded), a
  "Git LFS pointer" badge, and a submodule badge in the changes list.
- **Blame at a revision** — blaming a file from the commit inspector blames it
  as of that commit; the viewer names the revision it shows.
- **Commit search by path** — a `path:` token filters results to commits
  touching a path, alongside message, author and SHA.
- **Reflog actions** — checkout (detached) and create-branch from any entry,
  next to reset.
- **Remote management** — edit a remote's URL in place, fetch including tags,
  and the remote cluster disables itself when no remotes are configured.
- **Stash with options** — include-untracked and keep-index from the stash
  menu; clones can be cancelled mid-transfer.
- **Sequencer** — skip is available for conflicted cherry-picks and reverts,
  not only rebases.
- The commit composer warns before amending a commit that is already on the
  upstream branch.
- **Auto-update** — the app checks GitHub Releases on launch and every six
  hours; an "Update available" pill in the toolbar opens a dialog with the
  release notes, downloads with progress and restarts on confirmation. Update
  packages are signed and verified against the bundled public key.

### Security

- Every git invocation goes through a builder that validates the repository
  path and never spawns a shell.
- Content-Security-Policy without `unsafe-eval`; Angular's component styles are
  matched to the nonce Tauri injects.
- Clone and remote URLs are restricted to an allowlist of schemes, rejecting
  `ext::` and other transport helpers outright.
- Hardened CSP (`object-src 'none'`, `base-uri 'self'`,
  `frame-ancestors 'none'`) and the clipboard-read permission was dropped —
  the app only ever writes to the clipboard.
