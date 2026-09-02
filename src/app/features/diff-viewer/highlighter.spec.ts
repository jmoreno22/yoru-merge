import { beforeAll, describe, expect, it, vi } from 'vitest';
import { escapeHtml, Highlighter, loadHighlightGrammars } from './highlighter';
import type { HighlightLanguage } from './language-map';

describe('escapeHtml', () => {
  it('escapes every character that could open a tag or an attribute', () => {
    expect(escapeHtml('<script>alert("x" & \'y\')</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('const answer = 42;')).toBe('const answer = 42;');
  });
});

describe('Highlighter with the grammars still in flight', () => {
  it('escapes the line instead of colouring it', async () => {
    // A fresh module registry puts the grammars back in flight, which is what
    // the first lines of a session are rendered with.
    vi.resetModules();
    const pending = await import('./highlighter');
    expect(pending.highlightGrammarsLoaded()).toBe(false);
    expect(new pending.Highlighter().line('const tag = "<b>";', 'typescript')).toBe(
      'const tag = &quot;&lt;b&gt;&quot;;',
    );
  });
});

describe('Highlighter', () => {
  beforeAll(async () => {
    await loadHighlightGrammars();
  });

  it('returns an empty string for an empty line', () => {
    expect(new Highlighter().line('', 'typescript')).toBe('');
  });

  it('only escapes when the file is not highlighted', () => {
    const highlighter = new Highlighter();
    expect(highlighter.line('a < b && c > d', null)).toBe(
      'a &lt; b &amp;&amp; c &gt; d',
    );
  });

  it('only escapes plaintext', () => {
    expect(new Highlighter().line('<not markup>', 'plaintext')).toBe(
      '&lt;not markup&gt;',
    );
  });

  it('marks up a registered language', () => {
    const html = new Highlighter().line('const x = 1;', 'typescript');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('const');
  });

  it('escapes the code it highlights', () => {
    const html = new Highlighter().line('const tag = "<b>";', 'typescript');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('falls back to escaped text for a grammar that is not registered', () => {
    const unknown = 'brainfuck' as HighlightLanguage;
    expect(new Highlighter().line('a < b', unknown)).toBe('a &lt; b');
  });

  it('registers the grammars once, so a second instance still highlights', () => {
    const first = new Highlighter().line('def f(): pass', 'python');
    const second = new Highlighter().line('def f(): pass', 'python');
    expect(second).toBe(first);
    expect(second).toContain('hljs-');
  });

  it('caches by language, not only by text', () => {
    const highlighter = new Highlighter();
    const asJson = highlighter.line('{ "a": 1 }', 'json');
    const asYaml = highlighter.line('{ "a": 1 }', 'yaml');
    expect(asJson).not.toBe(asYaml);
  });
});
