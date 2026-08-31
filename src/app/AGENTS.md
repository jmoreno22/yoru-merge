# ANGULAR FRONTEND (`src/app/`)

Angular 20 frontend for YoruMerge. Standalone components, Signals for state,
OnPush everywhere, **zoneless** change detection. No NgModules, no router.
(Stack / commands / IPC overview → repo-root `AGENTS.md`.)

## STRUCTURE
```
app.config.ts            # providers: zoneless CD, CSP_NONCE, provideYoruIcons()
app.component.ts         # renders <app-app-shell />
core/
  models/                # TS types mirroring src-tauri/src/models/ (index.ts barrel)
  services/
    current-repo.service.ts   # facade over the active tab: state + actions
    workspace.store.ts        # RepoState per tab, watcher bookkeeping
    tauri-git.service.ts      # one method per Rust command, nothing else
    preferences-schema.ts     # DurablePreferences + sanitize/migrate (pure)
    preferences.service.ts    # typed accessors over the Tauri store
    git-auth-error.ts         # pure matcher: is this backend error an auth failure?
    theme.service.ts · toast.service.ts · drag-payload.service.ts
    ops/                      # domain services the facade delegates to
      repo · history · staging · remote · branch · merge · stash
      sequencer · config · system · ops-runner
  utils/                 # pure helpers, each with a .spec.ts
features/                # one folder per screen or dialog
  about · blame · branch-graph · clone · command-palette · commit-inspector
  commit-list · dialogs · diff-viewer · file-history · merge · remotes
  repo-manager · settings · working-changes
shared/
  components/            # app chrome
    titlebar · workspace-tabs · toolbar · rail · app-shell
    main-content · sidebar · repo-state-banner · status-bar · splitter
    drop-action-menu
                         # main-content/ also holds reflog-view: the one screen
                         # that lives outside features/ (deliberate, see below)
  ui/                    # the yoru-* kit + ContextMenuService,
                         # KeyboardShortcutsService, ClipboardService, tooltip
  icons/                 # curated Lucide set + provideYoruIcons()
  directives/            # drag-drop.directive.ts
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Call a Rust command | `core/services/tauri-git.service.ts` — thin `invoke()` wrapper |
| Read/mutate repo state | `core/services/current-repo.service.ts` — the only entry point features use |
| Add repo behaviour | `core/services/ops/<domain>-ops.ts`, then expose it on the facade |
| Add a screen | new folder under `features/` with `.ts` + `.html` (+ `.css` only if utilities cannot express it). Deliberate exception: the Reflog view is `shared/components/main-content/reflog-view.ts`, kept next to the component that switches rail views |
| Open a dialog | `features/dialogs/dialogs.service.ts` (`confirm`, `prompt`, `openClone`, `openRemotes`, `openMerge`, `openMergeResolver`, `openAbout`); `<app-dialog-host />` renders them |
| Context menu | `shared/ui/context-menu.service.ts` — never a hand-rolled dropdown |
| Keyboard shortcut | `shared/ui/keyboard-shortcuts.service.ts`, registered next to the code it runs |
| A preference | `core/services/preferences-schema.ts` (type + default + sanitizer), then `preferences.service.ts` |
| Theme tokens | `../styles.css` (DESIGN.md is canonical — edit it first) |
| Plans and agent reports | `docs/plans/` at the repo root |

## CONVENTIONS (this layer)
- Component classes carry no `Component` suffix (`AppShell`, `Sidebar`, `Toolbar`); selectors are `app-*`, kit components are `yoru-*`.
- Templates are separate `.html` files, never inline. Styling is Tailwind utilities; a component `.css` file exists only where a geometry contract needs it (commit list columns, diff rows).
- `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- State is Signals (`signal` / `computed` / `effect`), never RxJS subjects. Nothing in `src/app` imports `rxjs`.
- The app is **zoneless**: anything asynchronous (Tauri `listen`, timers, `ResizeObserver`, canvas events) must end in a signal write, or the view will not update.
- Icons are `<ng-icon>` from `shared/icons` — no emoji, no inline SVG.
- DOM/test hooks use `data-testid="..."`.
- Unit tests are pure TypeScript under vitest (`*.spec.ts`, node environment); component contracts are covered by `ng build` with `strictTemplates`, so specs must not import `@angular/core`.

## ANTI-PATTERNS (this layer)
- **Never** let a feature component reach into a sibling — go through `CurrentRepoService` or a service in `features/dialogs`.
- **Never** hand-roll a dialog, dropdown or toast: `yoru-dialog` / `DialogsService`, `ContextMenuService`, `ToastService`.
- **Never** encode state by colour alone; pair it with an icon or a word.
- **Never** use `opacity-*` to dim text, and keep text at 10.5 px or larger.
- **Never** add a scroll container without `.neon-scroll`.
- `::ng-deep` is a last resort for elements the CDK renders from its own template (see `features/commit-list/commit-list.css`), never for reaching into another component.
