import { describe, expect, it } from 'vitest';
import { type WorkbenchState, workbenchLayout } from './workbench-layout';

const history: WorkbenchState = {
  view: 'history',
  workspaceOpen: false,
  refsVisible: true,
  refsSide: 'left',
  inspectorPlacement: 'right',
  blameOpen: false,
  fileHistoryOpen: false,
};

const ids = (blocks: readonly { id: string }[]): string[] => blocks.map((b) => b.id);

describe('workbenchLayout', () => {
  describe('outer row', () => {
    it('puts the refs panel on its side of the split', () => {
      expect(workbenchLayout(history).outer).toEqual(['refs', 'split']);
      expect(workbenchLayout({ ...history, refsSide: 'right' }).outer).toEqual([
        'split',
        'refs',
      ]);
    });

    it('leaves the split alone when the refs panel is closed', () => {
      expect(workbenchLayout({ ...history, refsVisible: false }).outer).toEqual([
        'split',
      ]);
    });

    it('runs the centre and the inspector along the axis the placement asks for', () => {
      expect(workbenchLayout(history).axis).toBe('row');
      expect(workbenchLayout({ ...history, inspectorPlacement: 'bottom' }).axis).toBe(
        'column',
      );
    });
  });

  describe('centre column', () => {
    it('mounts the view the rail picked', () => {
      expect(workbenchLayout(history).centre).toEqual([
        { id: 'history', hidden: false },
      ]);
      expect(workbenchLayout({ ...history, view: 'changes' }).centre).toEqual([
        { id: 'changes', hidden: false },
      ]);
      expect(workbenchLayout({ ...history, view: 'reflog' }).centre).toEqual([
        { id: 'reflog', hidden: false },
      ]);
    });

    it('replaces History and Reflog with the diff workspace', () => {
      for (const view of ['history', 'reflog'] as const) {
        expect(
          workbenchLayout({ ...history, view, workspaceOpen: true }).centre,
        ).toEqual([{ id: 'diff-workspace', hidden: false }]);
      }
    });

    // The Changes panel owns the file order the workspace steps through and the
    // composer draft, so opening the workspace hides it instead of unmounting it.
    it('keeps Changes mounted but hidden behind the diff workspace', () => {
      expect(
        workbenchLayout({ ...history, view: 'changes', workspaceOpen: true }).centre,
      ).toEqual([
        { id: 'diff-workspace', hidden: false },
        { id: 'changes', hidden: true },
      ]);
    });
  });

  describe('inspector column', () => {
    it('gives History to the commit block and only parks the diff viewer', () => {
      expect(workbenchLayout(history).inspector).toEqual([
        { id: 'commit', size: 'fill', divided: false },
        { id: 'diff', size: 'collapsed', divided: false },
      ]);
    });

    it('gives Changes to the diff viewer, with no commit block', () => {
      expect(workbenchLayout({ ...history, view: 'changes' }).inspector).toEqual([
        { id: 'diff', size: 'fill', divided: true },
      ]);
    });

    it('collapses the diff slot while the workspace borrows the viewer', () => {
      expect(
        workbenchLayout({ ...history, view: 'changes', workspaceOpen: true }).inspector,
      ).toEqual([{ id: 'diff', size: 'collapsed', divided: false }]);
    });

    // The diff viewer is one element, re-hosted through a portal: a state that
    // dropped its slot would destroy it and everything it has loaded.
    it('always keeps the diff slot, whatever is open', () => {
      for (const view of ['history', 'changes', 'reflog'] as const) {
        for (const workspaceOpen of [false, true]) {
          for (const blameOpen of [false, true]) {
            const layout = workbenchLayout({
              ...history,
              view,
              workspaceOpen,
              blameOpen,
            });
            expect(ids(layout.inspector)).toContain('diff');
          }
        }
      }
    });

    it('stacks blame and file history under the diff, each on a fixed share', () => {
      expect(workbenchLayout({ ...history, blameOpen: true }).inspector.at(-1)).toEqual(
        {
          id: 'blame',
          size: '0 0 37.5%',
          divided: true,
        },
      );
      expect(
        workbenchLayout({ ...history, fileHistoryOpen: true }).inspector.at(-1),
      ).toEqual({ id: 'file-history', size: '0 0 28.6%', divided: true });

      const both = workbenchLayout({
        ...history,
        blameOpen: true,
        fileHistoryOpen: true,
      });
      expect(ids(both.inspector)).toEqual(['commit', 'diff', 'blame', 'file-history']);
      expect(both.inspector.slice(2).map((block) => block.size)).toEqual([
        '0 0 30%',
        '0 0 20%',
      ]);
    });

    // Every pixel the stacked panels or a collapsed header release belongs to
    // one block; two growing blocks would split it.
    it('never lets more than one block grow', () => {
      for (const view of ['history', 'changes', 'reflog'] as const) {
        for (const workspaceOpen of [false, true]) {
          for (const blameOpen of [false, true]) {
            for (const fileHistoryOpen of [false, true]) {
              const layout = workbenchLayout({
                ...history,
                view,
                workspaceOpen,
                blameOpen,
                fileHistoryOpen,
              });
              const growing = layout.inspector.filter((block) => block.size === 'fill');
              expect(growing.length).toBeLessThanOrEqual(1);
            }
          }
        }
      }
    });
  });
});
