// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { formName, formShown, readForm } from '@crumpet/editor/fields';
import { fromDocx, toDocx } from '../../src/data/docx';
import { readZip } from '../../src/data/zip';

describe('form controls', () => {
  it('read and write each kind', () => {
    expect(readForm('chk:1')).toEqual({ kind: 'chk', checked: true });
    expect(readForm('drop:1:Red|Green|Blue')).toEqual({ kind: 'drop', chosen: 1, choices: ['Red', 'Green', 'Blue'] });
    expect(readForm('pick:2026-10-13')).toEqual({ kind: 'pick', date: '2026-10-13' });
    expect(readForm('fill:Your name|Jo')).toEqual({ kind: 'fill', prompt: 'Your name', value: 'Jo' });
    expect(formName({ kind: 'drop', chosen: 5, choices: ['A{', 'B|C', ''] })).toBe('drop:-1:A|B C');
    expect(formShown(readForm('drop:-1:A|B')!)).toEqual({ text: 'Choose an item', prompt: true });
    expect(formShown(readForm('fill:Your name|')!)).toEqual({ text: 'Your name', prompt: true });
  });

  it('are saved as fields in the file', () => {
    const md = 'Agree {{chk:1}} colour {{drop:0:Red|Green}} on {{pick:2026-10-13}} by {{fill:Your name|Jo}} and {{pick:}}\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].runs.filter((r) => r.field).map((r) => r.field)).toEqual(['chk:1', 'drop:0:Red|Green', 'pick:2026-10-13', 'fill:Your name|Jo', 'pick:']);
    expect(toMarkdown(doc)).toBe(md);
  });

  it('go to Word as content controls, and come back', async () => {
    const doc = fromMarkdown('Agree {{chk:1}} colour {{drop:1:Red|Green}} on {{pick:2026-10-13}} by {{fill:Your name|Jo}} then {{fill:Town|}} {{drop:-1:A|B}} {{pick:}} {{chk:0}} {.restrict=forms}\n'.replace(' {.restrict=forms}', '') + '\nEnd {restrict=forms}\n');
    const bytes = await toDocx([{ doc }], { title: 'T' });
    const files = await readZip(bytes);
    const xml = new TextDecoder().decode(files.get('word/document.xml'));
    expect(xml).toContain('<w14:checkbox>');
    expect(xml).toContain('<w:dropDownList><w:listItem w:displayText="Red"');
    expect(xml).toContain('w:fullDate="2026-10-13T00:00:00Z"');
    expect(xml).toContain('<w:alias w:val="Your name"/>');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].runs.filter((r) => r.field).map((r) => r.field)).toEqual(['chk:1', 'drop:1:Red|Green', 'pick:2026-10-13', 'fill:Your name|Jo', 'fill:Town|', 'drop:-1:A|B', 'pick:', 'chk:0']);
  });

  it('Restrict editing → Filling in forms goes to Word', async () => {
    const bytes = await toDocx([{ doc: fromMarkdown('Form {restrict=forms}\n') }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/settings.xml'));
    expect(xml).toContain('<w:documentProtection w:edit="forms" w:enforcement="1"/>');
    expect((await fromDocx(bytes)).doc.blocks[0].para?.restrict).toBe('forms');
  });
});
