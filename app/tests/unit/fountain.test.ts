// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { runsText } from '@crumpet/editor/model';
import { fromFountain, isScriptDoc, toFountain } from '../../src/data/fountain';

const SCRIPT = 'INT. LIGHTHOUSE - NIGHT {.sc-scene}\n\nWind at the glass. MARA climbs. {.sc-action}\n\nMara {.sc-char}\n\n(out of breath) {.sc-paren}\n\nEleven years. {.sc-dial}\n\nTAM {.sc-char}\n\nAnd still lit. {.sc-dial}\n\nCUT TO: {.sc-trans}\n\nThe sea at dawn {.sc-scene}\n\nBOOM. {.sc-action}\n';

describe('Fountain', () => {
  it('writes a script so it reads back as the same elements', () => {
    const out = toFountain('The Light', [{ doc: fromMarkdown(SCRIPT) }], 'Ann Writer');
    expect(out).toBe(
      'Title: The Light\nAuthor: Ann Writer\n\nINT. LIGHTHOUSE - NIGHT\n\nWind at the glass. MARA climbs.\n\n@Mara\n(out of breath)\nEleven years.\n\nTAM\nAnd still lit.\n\nCUT TO:\n\n.THE SEA AT DAWN\n\n!BOOM.\n',
    );
    const back = fromFountain(out);
    expect(back.title).toBe('The Light');
    expect(back.blocks.map((b) => [b.style, runsText(b.runs)])).toEqual([
      ['sc-scene', 'INT. LIGHTHOUSE - NIGHT'],
      ['sc-action', 'Wind at the glass. MARA climbs.'],
      ['sc-char', 'Mara'],
      ['sc-paren', '(out of breath)'],
      ['sc-dial', 'Eleven years.'],
      ['sc-char', 'TAM'],
      ['sc-dial', 'And still lit.'],
      ['sc-trans', 'CUT TO:'],
      ['sc-scene', 'THE SEA AT DAWN'],
      ['sc-action', 'BOOM.'],
    ]);
  });

  it('reads Fountain as other apps write it: notes and the boneyard left out, extensions on names', () => {
    const src = 'EXT. HARBOUR - DAY\n\nBoats. [[a note]]\n\n/* cut this */\nMARA (V.O.)\nThe sea gives back.\n\n> FADE OUT.\n';
    expect(fromFountain(src).blocks.map((b) => [b.style, runsText(b.runs)])).toEqual([
      ['sc-scene', 'EXT. HARBOUR - DAY'],
      ['sc-action', 'Boats.'],
      ['sc-char', 'MARA (V.O.)'],
      ['sc-dial', 'The sea gives back.'],
      ['sc-trans', 'FADE OUT.'],
    ]);
    expect(isScriptDoc(fromMarkdown(SCRIPT))).toBe(true);
    expect(isScriptDoc(fromMarkdown('Just prose.'))).toBe(false);
  });
});

describe('scripts in Word', () => {
  it('go to Word as its screenplay styles, and come back as the same elements', async () => {
    const { toDocx, fromDocx } = await import('../../src/data/docx');
    const { readZip } = await import('../../src/data/zip');
    const bytes = await toDocx([{ doc: fromMarkdown(SCRIPT) }], { title: 'The Light' });
    const files = await readZip(bytes);
    const styles = new TextDecoder().decode(files.get('word/styles.xml')!);
    expect(styles).toContain('<w:name w:val="Scene Heading"/>');
    expect(styles).toContain('w:styleId="Character"');
    const document = new TextDecoder().decode(files.get('word/document.xml')!);
    expect(document).toContain('<w:pStyle w:val="Dialogue"/>');
    const back = await fromDocx(bytes);
    expect(back.doc.blocks.slice(0, 5).map((b) => b.style)).toEqual(['sc-scene', 'sc-action', 'sc-char', 'sc-paren', 'sc-dial']);
  });
});
