import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppShell } from './shared/components/app-shell/app-shell';

@Component({
  selector: 'app-root',
  imports: [AppShell],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
