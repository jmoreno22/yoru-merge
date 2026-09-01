# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **AI commit messages** — a button (and `Ctrl+Shift+Enter`) in the commit
  composer drafts a message from the staged diff, then fills the composer's
  fields so it can be edited like anything typed by hand.

  YoruMerge talks to no AI service of its own. It runs the CLI already
  installed and signed in on the machine — Claude Code, Codex, Gemini, Copilot,
  Cursor, a local Ollama model or anything else that reads a prompt and prints
  an answer — on the user's own subscription. A provider is a command string in
  Settings › AI, in the same spirit as the editor and terminal commands: there
  is no API key to enter and none is stored.

  What is sent, only when the button is pressed: the staged diff (capped, whole
  files dropped rather than half a hunk), the current branch, and the last ten
  commit subjects, which is what makes a drafted message match the repository's
  own style and language. Conventional Commits are detected from that history
  rather than configured. A repository can refuse the whole thing with
  `git config yoru.ai false`, enforced in the backend and not just hidden in
  the UI.

  The prompt has two layers. Ours carries the format rules the composer has to
  read back, and is not editable. Yours — **House rules** in Settings — is
  appended after it and takes precedence, so "write in Spanish", "never use a
  scope" or a ticket convention work without being able to break the format.
  **Show the prompt** displays the exact text that would be sent for what is
  staged right now.

  The diff itself is fenced and announced as content, because a staged diff can
  carry anyone's text — a vendored dependency, a patch off a pull request — and
  a line in it that reads like an instruction is not one.

  The answer is never trusted either: ANSI, code fences, preambles and any
  co-author or "generated with" trailer are stripped, and the subject and body
  are capped, before it reaches the composer.

  Presets ship for Claude Code, Codex, Gemini, Qwen Code, GitHub Copilot,
  Cursor, Kiro (Amazon), opencode, a local Ollama model and `llm` — each with
  the flags its own documentation specifies for one-shot use, with agent tools
  off where the CLI allows it. Aider and Goose are deliberately absent: both act
  on the repository by default, and a preset that might commit while writing a
  commit message is not one to ship.

  Setup is meant to take one choice: picking a provider fills in a working
  command *and* a starting set of house rules — English by default, read the
  whole diff before choosing a type, lead with the change that carries the most
  weight, and never invent a motive the diff does not show. Where the vendor
  publishes names that will outlive the next release there are **Model** and
  **Thinking** pickers — both of which simply edit that command, so the field
  stays the one place the truth lives. They appear only where they are known to
  work: `copilot --effort` is refused by Copilot's own default model, and opencode
  only lists the providers each user has logged into, so neither gets a picker.

  The composer's button is there even before anything is configured; pressing
  it then opens Settings › AI, since a feature that ships turned off is a
  feature nobody finds. A repository that opted out hides it outright.

### Changed

- The commit composer prints the header it is about to write — `feat(ai)!: …` —
  under the fields. The type chips and the scope field sit above the subject
  input and their effect appeared nowhere; now the line git will store is
  visible while it is being typed.

- The refs panel no longer prints a local branch's tracking branch beside its
  name. It duplicated the Remotes section and cost the branch name the room it
  needs to be read; the branch name now takes the full width, and the upstream
  is still in the row's tooltip.

### Fixed

- `pnpm lint` failed on every source file on a Windows checkout. Biome formats
  with LF and the repository had no `.gitattributes`, so `core.autocrlf` handed
  it CRLF; line endings are now normalised in the working tree as well as in
  the repository.

## [1.0.2] - 2026-09-01

### Added

- **Appearance** — deep customization from Settings: UI and code type scales,
  accent colours, colour and graph palettes, code tab width and ligatures, an
  animations toggle, inspector placement, sidebar side, and visibility of the
  toolbar, status bar and graph. Every density-coupled surface (virtual lists,
  the branch graph, panel chrome) follows the chosen scale through shared
  tokens.
- **Zen mode** (`Ctrl+Shift+Z`) — hides the window chrome for a bare
  history+diff view, and always announces the way back out, including when a
  session starts in zen.

- The application has a logo — the neon merge "Y" over the night city. Master
  artwork in `docs/logo.png`; the whole platform icon set (window, taskbar,
  installers) is generated from it, and the webview gets a favicon.
- README installation guide per platform, with CI/release badges.

### Fixed

- AppImage only: pushing (or any operation reaching the system
  `git-remote-https`) failed with a libcurl/nghttp2 symbol lookup error. The
  AppImage's bundled library paths leaked into child processes through
  `LD_LIBRARY_PATH`; they are now stripped before spawning git, editors,
  terminals and URL handlers.
- "Check for updates" in Settings/About only reported that a new version
  exists; it now opens the update dialog so the update can actually be
  accepted or declined.
- Field captions no longer press against the first control of their group.

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
