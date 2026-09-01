import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleDot,
  lucideGitBranch,
  lucideGlobe,
  lucideTag,
} from '@ng-icons/lucide';
import type { YoruIconName } from '../icons';

export type BadgeType = 'branch' | 'remote' | 'tag' | 'head';

const ICON_BY_TYPE: Readonly<Record<BadgeType, YoruIconName>> = {
  branch: 'lucideGitBranch',
  remote: 'lucideGlobe',
  tag: 'lucideTag',
  head: 'lucideCircleDot',
};

const TONE_BY_TYPE: Readonly<Record<BadgeType, string>> = {
  branch: 'border-accent/40 bg-accent/10 text-accent-ink',
  remote: 'border-neon-blue/40 bg-neon-blue/10 text-neon-blue',
  tag: 'border-neon-violet/40 bg-neon-violet/10 text-neon-violet',
  head: 'border-accent/50 bg-accent/12 text-accent-ink',
};

/**
 * Ref pill for branches, remote branches, tags and HEAD.
 *
 * `solid` is reserved for HEAD: per the glow budget it is the only pill in a
 * commit row allowed to carry a filled background and a glow.
 */
@Component({
  selector: 'yoru-badge',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({ lucideGitBranch, lucideGlobe, lucideTag, lucideCircleDot }),
  ],
  templateUrl: './yoru-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()' },
})
export class YoruBadge {
  readonly type = input<BadgeType>('branch');
  readonly label = input.required<string>();
  readonly solid = input<boolean>(false);

  protected readonly icon = computed<YoruIconName>(() => ICON_BY_TYPE[this.type()]);

  protected readonly hostClass = computed(() => {
    const base =
      'inline-flex max-w-[16rem] items-center gap-1 rounded-full border px-1.5 py-px font-mono text-y-xs leading-[15px]';
    return this.solid()
      ? `${base} border-accent bg-accent text-yoru-950 shadow-accent`
      : `${base} ${TONE_BY_TYPE[this.type()]}`;
  });
}
