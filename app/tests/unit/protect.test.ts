// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeBlock } from '@crumpet/editor/model';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { docPrint } from '@crumpet/editor/editor';
import { isLocked, lockDoc, sealWith, unlockDoc } from '../../src/data/lock';
import { fromDocx, toDocx } from '../../src/data/docx';
import { readZip } from '../../src/data/zip';

describe('notes protected with a password', () => {
  it('locks the text, opens with the right password only, and saves again with the same key', async () => {
    const doc = fromMarkdown('# Secret\n\nThe **plan**.\n');
    const { doc: sealed, opened } = await lockDoc(doc, 'swordfish');
    expect(isLocked(sealed)).toBe(true);
    expect(isLocked(doc)).toBe(false);
    const md = toMarkdown(sealed);
    expect(md).not.toContain('plan');
    expect(md).toContain('```locked');
    // Back from the file as it's saved.
    const back = fromMarkdown(md);
    expect(isLocked(back)).toBe(true);
    await expect(unlockDoc(back, 'wrong')).rejects.toThrow('That isn’t the password.');
    const open = await unlockDoc(back, 'swordfish');
    expect(toMarkdown(open.doc)).toBe(toMarkdown(doc));
    // Saved again after changes, still opened by the same password.
    const changed = fromMarkdown('# Secret\n\nThe new plan.\n');
    const again = await sealWith(changed, opened.key, opened.salt);
    expect(toMarkdown((await unlockDoc(fromMarkdown(toMarkdown(again)), 'swordfish')).doc)).toContain('new plan');
  }, 20000);
});

describe('protecting a document', () => {
  it('keeps final, restrict, its password lock and signatures in the file', () => {
    const md = 'Text {.final restrict=comments plock=open}\n\nJo · signed today {sig=0123456789abcdef}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].para).toMatchObject({ final: true, restrict: 'comments', plock: 'open' });
    expect(doc.blocks[1].para?.sig).toBe('0123456789abcdef');
    expect(toMarkdown(doc)).toBe(md);
  });

  it('a signature’s fingerprint changes with the text, but not with the signature itself', () => {
    const a = fromMarkdown('One.\n\nTwo.\n');
    const print = docPrint(a);
    expect(print).toMatch(/^[0-9a-f]{16}$/);
    const signed = { blocks: [...a.blocks, makeBlock('paragraph', 'Jo', [], { para: { sig: print } })] };
    expect(docPrint(signed)).toBe(print);
    expect(docPrint(fromMarkdown('One.\n\nTwo!\n'))).not.toBe(print);
  });

  it('goes to Word as read-only or comments-only protection and Mark as Final, and comes back', async () => {
    const doc = fromMarkdown('Text {.final restrict=read}\n');
    const bytes = await toDocx([{ doc }], { title: 'T' });
    const files = await readZip(bytes);
    const dec = (n: string) => new TextDecoder().decode(files.get(n));
    expect(dec('word/settings.xml')).toContain('<w:documentProtection w:edit="readOnly" w:enforcement="1"/>');
    expect(dec('docProps/custom.xml')).toContain('name="_MarkAsFinal"');
    expect(dec('[Content_Types].xml')).toContain('/docProps/custom.xml');
    expect(dec('_rels/.rels')).toContain('custom-properties');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].para).toMatchObject({ final: true, restrict: 'read' });

    const comments = await fromDocx(await toDocx([{ doc: fromMarkdown('Text {restrict=comments}\n') }], { title: 'T' }));
    expect(comments.doc.blocks[0].para?.restrict).toBe('comments');
    expect(comments.doc.blocks[0].para?.final).toBeUndefined();
  });
});
