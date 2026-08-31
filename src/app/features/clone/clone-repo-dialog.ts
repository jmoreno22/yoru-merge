import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { FetchProgress } from '../../core/models';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { ToastService } from '../../core/services/toast.service';
import { YoruButton, YoruDialog, YoruField, YoruSwitch } from '../../shared/ui';
import { folderNameFromUrl, isValidCloneUrl, joinPath } from './clone-url';

/**
 * The single clone dialog: used by the repository manager, the toolbar and the
 * command palette. `cloned` carries the destination path; the repository is
 * already open by then — `cloneRepoAction` opens it.
 */
@Component({
  selector: 'app-clone-repo-dialog',
  imports: [YoruDialog, YoruButton, YoruField, YoruSwitch],
  templateUrl: './clone-repo-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'clone-dialog-host' },
})
export class CloneRepoDialog {
  private readonly currentRepo = inject(CurrentRepoService);
  private readonly toast = inject(ToastService);

  readonly open = input<boolean>(false);

  readonly closed = output<void>();
  /** Destination path of the repository that was just cloned and opened. */
  readonly cloned = output<string>();

  protected readonly url = signal('');
  protected readonly parent = signal('');
  protected readonly folder = signal('');
  /** True once the user edits the folder, so the URL stops overwriting it. */
  private folderTouched = false;

  protected readonly showOptions = signal(false);
  protected readonly depth = signal('');
  protected readonly branch = signal('');
  protected readonly recursive = signal(false);

  protected readonly cloning = signal(false);
  protected readonly progress = signal<FetchProgress | null>(null);
  protected readonly canceling = signal(false);
  /** Handle the backend keys the running clone by; minted per attempt. */
  private cloneId: string | null = null;

  protected readonly urlValid = computed(
    () => this.url().trim().length === 0 || isValidCloneUrl(this.url()),
  );

  protected readonly destination = computed(() => {
    const folder = this.folder().trim();
    const parent = this.parent().trim();
    if (folder.length === 0) return parent;
    return joinPath(parent, folder);
  });

  protected readonly canClone = computed(
    () =>
      isValidCloneUrl(this.url()) &&
      this.parent().trim().length > 0 &&
      this.folder().trim().length > 0 &&
      !this.cloning(),
  );

  /** `null` while the phase carries no counters — the bar goes indeterminate. */
  protected readonly percent = computed(() => {
    const progress = this.progress();
    if (!progress?.total || progress.total <= 0) return null;
    return Math.min(100, Math.round(((progress.current ?? 0) / progress.total) * 100));
  });

  protected readonly phaseLabel = computed(() => {
    const progress = this.progress();
    if (!progress) return 'Starting…';
    if (progress.message) return progress.message;
    switch (progress.phase) {
      case 'counting':
        return 'Counting objects';
      case 'receiving':
        return 'Receiving objects';
      case 'resolving':
        return 'Resolving deltas';
      case 'done':
        return 'Finishing up';
      case 'info':
        return 'Working';
    }
  });

  constructor() {
    effect(() => {
      if (this.open()) return;
      // Reset on close so a cancelled clone never pre-fills the next one.
      this.url.set('');
      this.parent.set('');
      this.folder.set('');
      this.folderTouched = false;
      this.showOptions.set(false);
      this.depth.set('');
      this.branch.set('');
      this.recursive.set(false);
      this.progress.set(null);
      this.canceling.set(false);
    });
  }

  protected onUrlInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.url.set(value);
    if (this.folderTouched) return;
    this.folder.set(folderNameFromUrl(value));
  }

  protected onFolderInput(event: Event): void {
    this.folderTouched = true;
    this.folder.set((event.target as HTMLInputElement).value);
  }

  protected onParentInput(event: Event): void {
    this.parent.set((event.target as HTMLInputElement).value);
  }

  protected onDepthInput(event: Event): void {
    this.depth.set((event.target as HTMLInputElement).value);
  }

  protected onBranchInput(event: Event): void {
    this.branch.set((event.target as HTMLInputElement).value);
  }

  protected toggleOptions(): void {
    this.showOptions.update((value) => !value);
  }

  protected async chooseParent(): Promise<void> {
    const chosen = await openDialog({ directory: true, multiple: false });
    if (typeof chosen === 'string' && chosen.length > 0) this.parent.set(chosen);
  }

  /** While a clone runs, closing means cancelling it. */
  protected onClose(): void {
    if (this.cloning()) {
      void this.onCancelClone();
      return;
    }
    this.closed.emit();
  }

  protected async onCancelClone(): Promise<void> {
    const cloneId = this.cloneId;
    if (!cloneId || this.canceling()) return;
    this.canceling.set(true);
    await this.currentRepo.cancelCloneAction(cloneId);
  }

  protected async onClone(): Promise<void> {
    if (!this.canClone()) return;
    const url = this.url().trim();
    const dest = this.destination();
    const depth = Number.parseInt(this.depth(), 10);
    const branch = this.branch().trim();

    const cloneId = crypto.randomUUID();
    this.cloneId = cloneId;
    this.cloning.set(true);
    this.canceling.set(false);
    this.progress.set(null);
    try {
      const outcome = await this.currentRepo.cloneRepoAction(
        url,
        dest,
        {
          depth: Number.isFinite(depth) && depth > 0 ? depth : null,
          branch: branch.length > 0 ? branch : null,
          recursive: this.recursive(),
          cloneId,
        },
        (progress) => this.progress.set(progress),
      );
      // A real failure already raised its own toast; a cancel is not an error.
      if (outcome === 'canceled') {
        this.toast.info('Clone canceled.');
        this.closed.emit();
        return;
      }
      if (outcome === 'failed') return;
      this.toast.success(`Cloned into ${dest}`);
      this.cloned.emit(dest);
      this.closed.emit();
    } finally {
      this.cloneId = null;
      this.cloning.set(false);
      this.canceling.set(false);
      this.progress.set(null);
    }
  }
}
