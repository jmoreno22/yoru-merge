import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatCombo } from './combo';

/**
 * Renders a shortcut as key caps: `<yoru-kbd combo="mod+shift+p" />` shows
 * Ctrl Shift P. Always fed the same combo string the shortcut is registered
 * with, so the hint cannot drift from the binding.
 */
@Component({
  selector: 'yoru-kbd',
  templateUrl: './yoru-kbd.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1 align-middle' },
})
export class YoruKbd {
  readonly combo = input.required<string>();
  protected readonly tokens = computed(() => formatCombo(this.combo()));
}
