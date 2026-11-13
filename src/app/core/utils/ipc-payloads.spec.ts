// @vitest-environment jsdom
// The DOM environment is for `FileReader`, which node does not have; nothing
// here renders a component.
import { describe, expect, it } from 'vitest';
import { decodeText, encodeBase64, expandBlame } from './ipc-payloads';

const bytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer;

describe('decodeText', () => {
  it('decodes UTF-8 sent as an ArrayBuffer or as a number array', () => {
    const patch = '+señal "ñ"\t\\\n';
    expect(decodeText(bytes(patch))).toBe(patch);
    expect(decodeText([...new TextEncoder().encode(patch)])).toBe(patch);
  });

  it('keeps a leading byte-order mark', () => {
    expect(decodeText(bytes('﻿text'))).toBe('﻿text');
  });
});

describe('encodeBase64', () => {
  it('encodes binary bytes the way the backend used to', async () => {
    expect(await encodeBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBe(
      'iVBORw==',
    );
    expect(await encodeBase64([0, 255, 1])).toBe('AP8B');
  });

  it('encodes nothing as an empty string', async () => {
    expect(await encodeBase64(new ArrayBuffer(0))).toBe('');
  });
});

describe('expandBlame', () => {
  it('gives every line the metadata of its commit', () => {
    const first = { sha: 'a'.repeat(40), author: 'Ana', time: 1, message: 'init' };
    const second = { sha: 'b'.repeat(40), author: 'Bo', time: 2, message: 'fix' };
    const lines = expandBlame({
      commits: [first, second],
      lines: [
        { commit: 0, line_no: 1, content: 'one' },
        { commit: 1, line_no: 2, content: 'two' },
        { commit: 0, line_no: 3, content: 'three' },
      ],
    });

    expect(lines).toEqual([
      { ...first, line_no: 1, content: 'one' },
      { ...second, line_no: 2, content: 'two' },
      { ...first, line_no: 3, content: 'three' },
    ]);
  });
});
