import { describe, expect, it } from 'vitest';
import { makeBlock, runsText } from '../src/model';
import { isBlankDoc, splitTitleBlocks, splitTitleText } from '../src/pastetitle';

describe('a pasted first line as the title', () => {
  it('splits plain text at its first line, leaving out blank lines and a Markdown heading’s #s', () => {
    expect(splitTitleText('\n# The storm\n\nIt rained.\nAll night.')).toEqual({ title: 'The storm', heading: true, restText: 'It rained.\nAll night.', rest: 'It rained.\nAll night.' });
    expect(splitTitleText('Notes  from Rome\r\nDay one.')?.title).toBe('Notes from Rome');
    expect(splitTitleText('Just one line')).toBeNull();
    expect(splitTitleText('One line\n\n  \n')).toBeNull();
  });

  it('splits blocks at the first paragraph, but not at a picture or a table', () => {
    const h = makeBlock('heading1', 'The storm');
    const split = splitTitleBlocks([makeBlock('paragraph', ''), h, makeBlock('paragraph', ''), makeBlock('paragraph', 'It rained.')]);
    expect(split?.title).toBe('The storm');
    expect(split?.heading).toBe(true);
    expect(split?.rest.map((b) => runsText(b.runs))).toEqual(['It rained.']);
    expect(splitTitleBlocks([makeBlock('image', ''), makeBlock('paragraph', 'Text')])).toBeNull();
    expect(splitTitleBlocks([makeBlock('paragraph', 'Only this')])).toBeNull();
  });

  it('knows an empty document', () => {
    expect(isBlankDoc({ blocks: [makeBlock('paragraph', '')] })).toBe(true);
    expect(isBlankDoc({ blocks: [makeBlock('paragraph', 'x')] })).toBe(false);
    expect(isBlankDoc({ blocks: [makeBlock('heading1', '')] })).toBe(false);
  });
});
