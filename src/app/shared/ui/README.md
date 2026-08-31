# UI kit

The primitives every feature builds on. Import them from the barrel:

```ts
import { YoruButton, YoruDialog, ContextMenuService } from '../../shared/ui';
```

Rules for anything added here:

- Standalone, `ChangeDetectionStrategy.OnPush`, signals only (`input()`,
  `output()`, `model()`, `computed()`), no `@Input`/`@Output` decorators.
- Template and styles in separate files; classes named without a `Component`
  suffix (`YoruButton`, not `YoruButtonComponent`).
- Colours come from `--app-*` / `--color-*` tokens. No hex in a template.
- State is never signalled by colour alone: pair it with an icon or a label.
- Every scrollable surface gets `.neon-scroll`.

Icons are provided globally by `provideYoruIcons()`. Components that render a
fixed icon also declare it in their own `viewProviders` (ng-icons merges the
maps), so the kit works even before the app providers are wired.

---

## yoru-dialog

Modal shell. Escape always cancels; `dismissible` only governs backdrop clicks.
Focus is captured on open and restored on close.

| Input | Type | Default |
| --- | --- | --- |
| `open` | `boolean` | `false` |
| `title` | `string` | `''` |
| `size` | `'sm' \| 'md' \| 'lg' \| 'full'` | `'md'` |
| `tone` | `'default' \| 'danger' \| 'conflict'` | `'default'` |
| `dismissible` | `boolean` | `true` |

Output: `closed: void`. Slots: `[dialog-body]`, `[dialog-actions]`.

```html
<yoru-dialog
  [open]="confirmOpen()"
  title="Delete branch feat/graph"
  tone="danger"
  (closed)="confirmOpen.set(false)"
>
  <p dialog-body>The branch has unmerged commits. This cannot be undone.</p>
  <yoru-button dialog-actions variant="ghost" (click)="confirmOpen.set(false)">
    Cancel
  </yoru-button>
  <yoru-button dialog-actions variant="danger" icon="lucideTrash2" (click)="remove()">
    Delete
  </yoru-button>
</yoru-dialog>
```

## ContextMenuService + yoru-context-menu

One menu at a time, opened imperatively. Resolves with the chosen item id or
`null` when dismissed. Never place `<yoru-context-menu>` in a template.

```ts
private readonly menu = inject(ContextMenuService);

async onContextMenu(event: MouseEvent, branch: BranchInfo): Promise<void> {
  event.preventDefault();
  const choice = await this.menu.open(
    [
      { id: 'checkout', label: 'Checkout', icon: 'lucideGitBranch', tone: 'primary' },
      { id: 'merge', label: `Merge ${branch.name} into ${current()}`, icon: 'lucideGitMerge' },
      {
        id: 'delete',
        label: 'Delete…',
        icon: 'lucideTrash2',
        tone: 'danger',
        separatorBefore: true,
        disabled: branch.is_current,
        disabledReason: 'Cannot delete the current branch',
        children: [
          { id: 'delete-local', label: 'Local only' },
          { id: 'delete-both', label: 'Local and remote', tone: 'danger' },
        ],
      },
    ],
    { x: event.clientX, y: event.clientY },
  );
  if (choice === 'checkout') await this.repo.checkout(branch.name);
}
```

`MenuItem`: `id`, `label`, `icon?`, `shortcut?`, `tone?`, `disabled?`,
`disabledReason?`, `children?` (one level), `separatorBefore?`, `run?`.
The anchor is `{ x, y }` or an `HTMLElement` (the menu opens under it).

Keyboard: `↑ ↓ Home End` move, `Enter`/`Space` activate, `→`/`←` open and close
a submenu, `Esc` closes, `Tab` dismisses, and typing jumps to a label prefix.
The menu also closes on outside click, scroll, resize and window blur.

## yoru-button

`variant`: `primary | secondary | ghost | danger` · `size`: `sm` (28 px) /
`md` (32 px) · `icon?: YoruIconName` · `loading` · `disabled` ·
`type: 'button' | 'submit' | 'reset'`. The label is projected content.

```html
<yoru-button variant="primary" icon="lucideGitCommitHorizontal" [loading]="busy()">
  Commit
</yoru-button>
```

## yoru-empty-state

`icon?`, `title` (required), `hint?`, `kanji?` (watermark at 6 % opacity).

```html
<yoru-empty-state
  icon="lucideGitCommitHorizontal"
  title="No commits yet"
  hint="Make your first commit to see history here."
  kanji="夜"
/>
```

## yoru-toast-host

Renders `ToastService.toasts()` bottom-right. Mount once, in the app shell.
No inputs. Errors get `role="alert"`, everything else `role="status"`. A toast
carrying an `action` renders its button; pressing it dismisses the toast.

```html
<yoru-toast-host />
```

```ts
toasts.show({
  kind: 'error',
  message: 'Push rejected: the remote has commits you do not have.',
  key: 'push-rejected',
  action: { label: 'Pull and retry', run: () => this.pullThenPush() },
});
```

## yoru-badge

Ref pill. `type`: `branch | remote | tag | head` · `label` (required) ·
`solid` (reserved for HEAD — the only pill allowed to glow).

```html
<yoru-badge type="head" label="HEAD" [solid]="true" />
<yoru-badge type="remote" label="origin/main" />
```

## yoru-avatar

`name?`, `seed?` (use the email — it is the stable identity in a history),
`size`: `16 | 20 | 28`. Initials and gradient are derived deterministically.

```html
<yoru-avatar [name]="commit.author_name" [seed]="commit.author_email" [size]="20" />
```

## yoru-section-header

34 px panel header. `label` (required), `count?`, plus an `[actions]` slot.

```html
<yoru-section-header label="Staged" [count]="staged().length">
  <yoru-button actions size="sm" variant="ghost">Unstage all</yoru-button>
</yoru-section-header>
```

## yoru-field

Label + projected control + hint/error. `label` (required), `hint?`, `error?`.

```html
<yoru-field label="Author email" hint="Applies to this repository only">
  <input [value]="email()" (input)="onEmail($event)" />
</yoru-field>
```

## yoru-switch

`role="switch"` toggle. `checked` is a `model()`; `label?`, `hint?`, `disabled?`.

```html
<yoru-switch [(checked)]="signOff" label="Add Signed-off-by" />
```

## yoru-segmented

Single choice. `options: SegmentedOption[]` (`{ value, label, icon? }`),
`value` is a `model()`, `ariaLabel?`. Arrow keys move the selection.

```html
<yoru-segmented [options]="diffModes" [(value)]="diffMode" ariaLabel="Diff layout" />
```

## yoru-kbd

`combo` (required) — the same string the shortcut is registered with.

```html
<yoru-kbd combo="mod+enter" />
```

## yoru-spinner / yoru-skeleton

`yoru-spinner`: `size` (px, default 14), `label` (default `Loading`).
`yoru-skeleton`: `width`, `height`, `radius` — CSS length strings.

```html
<yoru-spinner [size]="16" label="Fetching" />
<yoru-skeleton width="60%" height="12px" />
```

## yoruTooltip

Directive. Delayed, positioned, announced through `aria-describedby`. Not a
substitute for an accessible name — an icon-only button still needs
`aria-label`.

```html
<button aria-label="Fetch all remotes" [yoruTooltip]="'Fetch all remotes'">…</button>
```

## ClipboardService

```ts
await inject(ClipboardService).writeText(commit.sha);
```

Uses the Tauri clipboard plugin and falls back to `navigator.clipboard`.

## KeyboardShortcutsService

```ts
const off = inject(KeyboardShortcutsService).register({
  id: 'commit',
  combo: 'mod+enter',
  label: 'Commit staged changes',
  allowInInputs: true,
  when: () => this.canCommit(),
  run: () => this.commit(),
});
```

`register` returns the unregister function. `shortcuts()` is a signal of
everything registered, for the command palette and the Keyboard settings page.
`mod` is Ctrl on Windows and Linux. Modifier matching is exact, so `mod+k` does
not fire while Shift is held.

## Pure helpers

`combo.ts` (`parseCombo`, `matchesCombo`, `formatCombo`, `normalizeEventKey`),
`menu-position.ts` (`clampMenuPosition`, `clampSubmenuPosition`) and `avatar.ts`
(`initialsFrom`, `avatarGradient`) hold the logic that is worth testing without
a DOM. Their specs run under `pnpm test`.
