import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { YoruButton, YoruDialog } from '../../shared/ui';
import { AboutPanel } from './about-panel';

@Component({
  selector: 'app-about-dialog',
  imports: [YoruDialog, YoruButton, AboutPanel],
  templateUrl: './about-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'about-dialog-host' },
})
export class AboutDialog {
  readonly open = input<boolean>(false);
  readonly closed = output<void>();
}
