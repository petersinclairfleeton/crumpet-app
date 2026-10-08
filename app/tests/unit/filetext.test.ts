import { describe, expect, it } from 'vitest';
import { makeBlock } from '@crumpet/editor/model';
import { noteText } from '../../src/data/selectors';
import { readable } from '../../src/data/filetext';
import type { Note } from '../../src/data/types';

describe('words in attached files', () => {
  it('are searched with the note when given, and only PDFs and pictures are read', () => {
    const note = { id: 'n', title: 'T', doc: { blocks: [makeBlock('paragraph', 'Body'), makeBlock('file', 'timetable.pdf', [], { src: 'Attachments/a-timetable.pdf' })] } } as unknown as Note;
    expect(noteText(note)).not.toContain('Fresnel');
    expect(noteText(note, { 'Attachments/a-timetable.pdf': 'Fresnel lens' })).toContain('Fresnel lens');
    expect(['a.pdf', 'b.JPG', 'c.webp', 'd.docx', 'e.txt'].map(readable)).toEqual([true, true, true, false, false]);
  });
});
