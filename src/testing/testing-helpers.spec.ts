// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { installResizeObserver } from './resize-observer';
import { createTauriGitStub } from './tauri-git-stub';

describe('resize observer stand-in', () => {
  it('reports a size only to the observers still watching that element', () => {
    const stub = installResizeObserver();
    const target = document.createElement('div');
    const heights: number[] = [];
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) heights.push(entry.contentRect.height);
    });
    observer.observe(target);

    stub.resize(target, { width: 300, height: 120 });
    stub.resize(document.createElement('p'), { width: 300, height: 40 });
    observer.disconnect();
    stub.resize(target, { width: 300, height: 40 });

    expect(heights).toEqual([120]);

    stub.restore();
    // The stand-in exists because jsdom ships no ResizeObserver of its own.
    expect(globalThis.ResizeObserver).toBeUndefined();
  });
});

describe('typed invoke stub', () => {
  it('answers by command name, records every call and flags a missing one', async () => {
    const stub = createTauriGitStub({ get_diff: 'diff text' });

    await expect(stub.service.getDiff('/repo', 'a.ts', false)).resolves.toBe(
      'diff text',
    );
    await expect(
      stub.service.getCommitFileDiff('/repo', 'sha', 'a.ts'),
    ).rejects.toThrow("No canned response for 'get_commit_file_diff'.");

    expect(stub.calls).toEqual([
      { command: 'get_diff', args: ['/repo', 'a.ts', false] },
      { command: 'get_commit_file_diff', args: ['/repo', 'sha', 'a.ts'] },
    ]);
  });
});
