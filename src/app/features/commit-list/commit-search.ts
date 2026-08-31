import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CurrentRepoService } from '../../core/services/current-repo.service';
import { KeyboardShortcutsService } from '../../shared/ui';

/**
 * Search box for the commit history.
 *
 * Owns no state of its own: the query, the debounce and the results all live
 * in `CurrentRepoService`, so the box can be mounted in the panel header or
 * above the list without the two copies ever disagreeing.
 */
@Component({
  selector: 'app-commit-search',
  imports: [NgIcon],
  templateUrl: './commit-search.html',
  styleUrl: './commit-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex h-[34px] shrink-0 items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface-raised)]/40 px-2',
  },
})
export class CommitSearch {
  private readonly repo = inject(CurrentRepoService);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  /**
   * The query exactly as typed. The service splits the `path:` token off
   * itself, so the box keeps no copy of its own and the palette can drive the
   * same state.
   */
  protected readonly query = this.repo.searchQuery;

  protected readonly isSearching = this.repo.isSearching;
  protected readonly isActive = this.repo.isSearchActive;
  protected readonly resultCount = computed(() => this.repo.searchResults().length);

  protected readonly countLabel = computed(() => {
    const count = this.resultCount();
    return `${count} ${count === 1 ? 'result' : 'results'}`;
  });

  constructor() {
    const off = this.shortcuts.register({
      id: 'commit-search-focus',
      combo: 'mod+f',
      label: 'Search commits',
      allowInInputs: true,
      run: () => this.focus(),
    });
    inject(DestroyRef).onDestroy(off);
  }

  /** Focuses and selects the box; the palette and `Ctrl+F` both land here. */
  focus(): void {
    const input = this.field()?.nativeElement;
    if (!input) return;
    input.focus();
    input.select();
  }

  protected onInput(value: string): void {
    this.repo.searchCommitsAction(value);
  }

  protected onClear(): void {
    this.repo.clearSearch();
    this.field()?.nativeElement.focus();
  }

  protected onEscape(): void {
    if (this.isActive()) this.onClear();
  }
}
