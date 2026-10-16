// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { embeddable } from '@crumpet/editor/video';

describe('embedded files and 3D models', () => {
  it('knows which files can be shown inside the page', () => {
    expect(embeddable('Attachments/abc-report.pdf')).toBe('pdf');
    expect(embeddable('Attachments/abc-page.HTML')).toBe('html');
    expect(embeddable('Attachments/abc-teapot.glb')).toBe('model');
    expect(embeddable('Attachments/abc-notes.docx')).toBeNull();
  });

  it('a file shown inside is saved marked .embed, and comes back so', () => {
    const md = '[Report](Attachments/abc1234-report.pdf) {.embed}\n\n[Teapot](Attachments/abc1234-teapot.glb)\n\n[Plan](Attachments/abc1234-plan.pdf) {.embed .center}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0]).toMatchObject({ type: 'file', style: 'embed' });
    expect(doc.blocks[1].style).toBeUndefined();
    expect(doc.blocks[2]).toMatchObject({ style: 'embed', align: 'center' });
    expect(toMarkdown(doc)).toBe(md);
  });
});
