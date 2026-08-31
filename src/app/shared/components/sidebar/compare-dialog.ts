import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { CompareResult } from '../../../core/models';
import { shortSha } from '../../../core/utils';
import { YoruButton, YoruDialog } from '../../ui';

export interface CompareRequest {
  readonly base: string;
  readonly head: string;
  readonly result: CompareResult;
}

/** Read-only divergence report for two refs. */
@Component({
  selector: 'app-compare-dialog',
  imports: [NgIcon, YoruButton, YoruDialog],
  templateUrl: './compare-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareDialog {
  readonly request = input.required<CompareRequest>();
  readonly closed = output<void>();

  protected readonly shortSha = shortSha;
}
