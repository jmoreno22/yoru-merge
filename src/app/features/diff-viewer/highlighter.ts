import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import type { HighlightLanguage } from './language-map';

/**
 * Syntax highlighting for diff lines.
 *
 * `highlight.js/lib/core` plus an explicit grammar list, never the default
 * bundle: the full package registers ~190 languages and costs about a megabyte
 * of the initial chunk, which is most of what this app ships.
 */

let registered = false;

function register(): void {
  if (registered) return;
  registered = true;
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('c', c);
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('diff', diff);
  hljs.registerLanguage('dockerfile', dockerfile);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('ini', ini);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('kotlin', kotlin);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('plaintext', plaintext);
  hljs.registerLanguage('powershell', powershell);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('scss', scss);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('yaml', yaml);
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
    register();
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
    // `hljs.highlight` logs and throws for a grammar nobody registered, so the
    // lookup happens here instead of inside a catch block.
    if (language === null || language === 'plaintext' || !hljs.getLanguage(language)) {
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
