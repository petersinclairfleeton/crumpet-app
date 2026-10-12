// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeBlock } from '@crumpet/editor/model';
import { fileKind, fileLabel, wordBytes, wordLook } from '../../src/data/documents';
import { fromDocx, toDocx } from '../../src/data/docx';
import { defaultPage } from '../../src/data/styles';
import { parseNoteFile, writeNoteFile } from '../../src/sync/notefile';
import type { Note } from '../../src/data/types';

describe('uploaded documents', () => {
  it('knows what a file is from its name or type', () => {
    expect(fileKind('Report.DOCX')).toBe('word');
    expect(fileKind('scan.pdf')).toBe('pdf');
    expect(fileKind('photo.jpeg')).toBe('image');
    expect(fileKind('pasted', 'image/png')).toBe('image');
    expect(fileKind('clip.mov')).toBe('video');
    expect(fileKind('memo.m4a')).toBe('audio');
    expect(fileKind('plan.md')).toBe('text');
    expect(fileKind('Budget.xlsx')).toBe('other');
    expect(fileLabel('Attachments/k3j9a2x-Report.docx')).toBe('Report.docx');
  });

  it('writes a Word document back in its own font, size and paper', async () => {
    const doc = { blocks: [makeBlock('paragraph', 'Dear all,')] };
    const original = await toDocx([{ doc }], { title: 'Letter', page: { ...defaultPage(), size: 'a5' }, font: 'Garamond', size: 13 });
    const look = await wordLook(original);
    expect(look).toEqual({ font: 'Garamond', size: 13, paper: 'a5' });
    const note = { title: 'Letter', doc: { blocks: [makeBlock('paragraph', 'Dear all, again')] } } as Note;
    const again = await wordBytes(note, look);
    expect(await wordLook(again)).toEqual(look);
    expect((await fromDocx(again)).doc.blocks[0].runs.map((r) => r.text).join('')).toBe('Dear all, again');
  });

  it('keeps the note’s file in its front matter', () => {
    const text = writeNoteFile({ id: 'n1', title: 'Map', tags: [], favorite: false, file: 'Attachments/abc1234-Map.png', created: 1, updated: 2, trashed: null, from: null, extra: '', body: '![](Attachments/abc1234-Map.png)\n' });
    expect(text).toContain('file: Attachments/abc1234-Map.png');
    const back = parseNoteFile(text);
    expect(back.file).toBe('Attachments/abc1234-Map.png');
    expect(back.extra).toBe('');
  });
});
