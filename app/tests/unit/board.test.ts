import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { boardDoc, boardOf, boardPreview, isBoard, readBoard } from '../../src/data/board';

describe('boards', () => {
  const board = {
    nodes: [
      { id: 'a', type: 'text' as const, x: 0, y: 0, width: 250, height: 120, text: 'The **lamp**', color: '4' as const },
      { id: 'b', type: 'file' as const, x: 300, y: 0, width: 250, height: 120, file: 'Mara', note: 'n1' },
      { id: 'g', type: 'group' as const, x: -20, y: -40, width: 600, height: 200, label: 'Act one' },
    ],
    edges: [{ id: 'e', fromNode: 'a', toNode: 'b', label: 'leads to' }],
  };

  it('is a note with one canvas block, kept in its Markdown file', () => {
    const doc = boardDoc(board);
    expect(isBoard({ doc })).toBe(true);
    const md = toMarkdown(doc);
    expect(md.startsWith('```canvas\n{')).toBe(true);
    const back = fromMarkdown(md);
    expect(isBoard({ doc: back })).toBe(true);
    expect(boardOf({ doc: back })).toEqual(board);
  });

  it('reads JSON Canvas from elsewhere safely', () => {
    const b = readBoard(JSON.stringify({ nodes: [{ id: 'x', type: 'text', text: 'Hi' }, { id: 'y', type: 'weird' }, { type: 'text' }], edges: [{ id: 'e1', fromNode: 'x', toNode: 'gone' }] }));
    expect(b.nodes).toEqual([{ id: 'x', type: 'text', x: 0, y: 0, width: 250, height: 120, text: 'Hi' }]);
    expect(b.edges).toEqual([]);
    expect(readBoard('not json')).toEqual({ nodes: [], edges: [] });
  });

  it('says what is on it', () => {
    expect(boardPreview(board)).toBe('Board · 2 cards · The **lamp** Mara Act one');
  });
});
