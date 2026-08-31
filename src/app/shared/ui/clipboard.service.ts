import { Injectable } from '@angular/core';

/**
 * Copies text to the system clipboard.
 *
 * Prefers the Tauri plugin (the only path that works when the webview denies
 * the async clipboard API) and falls back to `navigator.clipboard`, which keeps
 * copy working in `ng serve` outside the desktop shell.
 */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  async writeText(text: string): Promise<void> {
    try {
      const plugin = await import('@tauri-apps/plugin-clipboard-manager');
      await plugin.writeText(text);
      return;
    } catch {
      // Plugin not registered, or not running inside Tauri.
    }
    await navigator.clipboard.writeText(text);
  }
}
