import type { HLJSApi } from 'highlight.js';
import type { HighlightLanguage } from './language-map';

/**
 * Syntax highlighting for diff lines.
 *
 * The grammars arrive in their own chunk (see `highlight-grammars.ts`), so
 * until they land every line is escaped and nothing more. Anything caching what
 * `line()` returns has to rebuild it once `loadHighlightGrammars()` resolves.
 */

let grammars: HLJSApi | null = null;
let loading: Promise<void> | null = null;

/**
 * Fetches the highlighting core and its grammars, once per session.
 *
 * Constructing a `Highlighter` starts this; callers that need to know when the
 * colours appear await the same promise.
 */
export function loadHighlightGrammars(): Promise<void> {
  loading ??= import('./highlight-grammars').then((module) => {
    grammars = module.registerGrammars();
  });
  return loading;
}

/** Whether `line()` can colour a line rather than only escape it. */
export function highlightGrammarsLoaded(): boolean {
  return grammars !== null;
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * Per-diff cache of highlighted lines.
 *
 * A diff repeats the same short lines constantly (closing braces, blank lines,
 * imports), and toggling split/unified or the context budget rebuilds the rows
 * without changing their text. One instance per rendered patch keeps the cache
 * from outliving what it describes.
 */
export class Highlighter {
  private readonly cache = new Map<string, string>();

  constructor() {
    void loadHighlightGrammars();
  }

  /**
   * Highlighted HTML for one line of code.
   *
   * Lines are highlighted in isolation, so a construct spanning several lines
   * (a block comment, a template literal) is coloured per line. That is the
   * price of rendering a patch, where the surrounding lines may not exist.
   *
   * `language` is `null` for a file the viewer decided not to highlight, and
   * the text is only escaped.
   */
  line(text: string, language: HighlightLanguage | null): string {
    if (text === '') return '';
    const hljs = grammars;
    // `hljs.highlight` logs and throws for a grammar nobody registered, so the
    // lookup happens here instead of inside a catch block. Escaped output is
    // never cached: with the grammars still in flight it would outlive them.
    if (
      hljs === null ||
      language === null ||
      language === 'plaintext' ||
      !hljs.getLanguage(language)
    ) {
      return escapeHtml(text);
    }

    // NUL cannot occur in a source line, so it separates the two parts of the
    // key without any chance of collision.
    const key = `${language}\u0000${text}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    let html: string;
    try {
      html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
    } catch {
      // A grammar that blows up on one line must not take the panel with it.
      html = escapeHtml(text);
    }
    this.cache.set(key, html);
    return html;
  }
}
