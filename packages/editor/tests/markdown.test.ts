import { describe, expect, it } from 'vitest';
import { BLOCK_STYLES, type Block, type BlockType, type Doc, type Mark, type Run, MARK_ORDER, makeBlock, normalizeRuns } from '../src/model';
import { fromMarkdown, parseInline, toMarkdown } from '../src/markdown';

function doc(...blocks: Block[]): Doc {
  return { blocks };
}

function p(...runs: (string | Run)[]): Block {
  return withRuns(makeBlock('paragraph'), runs);
}

function withRuns(b: Block, runs: (string | Run)[]): Block {
  b.runs = normalizeRuns(runs.map((r) => (typeof r === 'string' ? { text: r, marks: [] } : r)));
  return b;
}

function r(text: string, ...marks: Mark[]): Run {
  return { text, marks };
}

/** Blocks without ids, for comparing documents. */
function shape(d: Doc) {
  return d.blocks.map((b) => ({ type: b.type, checked: b.type === 'todo' ? !!b.checked : undefined, indent: b.indent ?? 0, style: b.style, align: b.align, runs: b.runs }));
}

function roundTrip(d: Doc): Doc {
  return fromMarkdown(toMarkdown(d));
}

describe('writing Markdown', () => {
  it('writes blocks', () => {
    const d = doc(
      withRuns(makeBlock('heading1'), ['Trip']),
      p('Some ', r('bold', 'bold'), ' and ', r('slanted', 'italic'), '.'),
      makeBlock('paragraph'),
      withRuns(makeBlock('bullet'), ['one']),
      withRuns(makeBlock('bullet', '', [], { indent: 1 }), ['nested']),
      withRuns(makeBlock('numbered'), ['first']),
      withRuns(makeBlock('numbered'), ['second']),
      withRuns(makeBlock('todo', '', [], { checked: true }), ['done']),
      withRuns(makeBlock('todo'), ['not yet']),
      withRuns(makeBlock('quote'), ['Said']),
      withRuns(makeBlock('heading2'), ['End']),
    );
    expect(toMarkdown(d)).toBe(
      [
        '# Trip',
        '',
        'Some **bold** and _slanted_.',
        '',
        '&nbsp;',
        '',
        '- one',
        '    - nested',
        '1. first',
        '2. second',
        '- [x] done',
        '- [ ] not yet',
        '',
        '> Said',
        '',
        '## End',
        '',
      ].join('\n'),
    );
  });

  it('writes an empty note as an empty file', () => {
    expect(toMarkdown(doc(makeBlock('paragraph')))).toBe('');
    expect(shape(fromMarkdown(''))).toEqual(shape(doc(makeBlock('paragraph'))));
  });

  it('nests marks and keeps spaces outside them', () => {
    expect(toMarkdown(doc(p(r('all ', 'bold'), r('of', 'bold', 'italic'), r(' it ', 'bold'), 'plain')))).toBe('**all _of_ it** plain\n');
  });

  it('writes links, code and underline', () => {
    const link = (text: string, href: string, ...marks: Mark[]): Run => ({ text, marks, link: href });
    expect(toMarkdown(doc(p('See ', link('the docs', 'https://example.com/a_(b)'), ', ', r('x = 1', 'code'), ', ', r('this', 'underline'))))).toBe(
      'See [the docs](https://example.com/a_\\(b\\)), `x = 1`, <u>this</u>\n',
    );
    expect(toMarkdown(doc(p(r('a ', 'bold'), link('b', 'https://x.com/', 'bold'), r(' c', 'bold'))))).toBe('**a [b](https://x.com/) c**\n');
  });

  it('escapes text that looks like Markdown', () => {
    const d = doc(p('# not a heading'), p('1. not a list'), p('- nor this'), p('*stars* and _bars_ and [brackets]'), p('a &amp; b'));
    const md = toMarkdown(d);
    expect(md).toContain('\\# not a heading');
    expect(md).toContain('1\\. not a list');
    expect(md).toContain('\\*stars\\* and \\_bars\\_ and \\[brackets\\]');
    expect(md).toContain('a &amp;amp; b');
    expect(shape(fromMarkdown(md))).toEqual(shape(d));
  });

  it('falls back to HTML tags inside words', () => {
    const d = doc(p('un', r('believ', 'italic'), 'able'));
    const md = toMarkdown(d);
    expect(md).toBe('un*believ*able\n');
    const d2 = doc(p('a', r('"quoted"', 'bold'), 'b'));
    expect(toMarkdown(d2)).toBe('a<strong>"quoted"</strong>b\n');
    expect(shape(roundTrip(d2))).toEqual(shape(d2));
  });

  it('keeps spaces at line edges and backticks in code', () => {
    const d = doc(p('  indented  '), p(r('a `tick`', 'code')), p(r('`', 'code')), p(r(' padded ', 'code')));
    expect(shape(roundTrip(d))).toEqual(shape(d));
    expect(toMarkdown(doc(p('  x')))).toBe('&#32;&#32;x\n');
  });

  it('keeps consecutive quotes apart', () => {
    const d = doc(withRuns(makeBlock('quote'), ['one']), withRuns(makeBlock('quote'), ['two']));
    expect(shape(roundTrip(d))).toEqual(shape(d));
  });

  it('keeps headings that end in #', () => {
    const d = doc(withRuns(makeBlock('heading1'), ['C#']), withRuns(makeBlock('heading2'), ['#']));
    expect(shape(roundTrip(d))).toEqual(shape(d));
  });

  it('keeps list items that start deeper than their parent', () => {
    const d = doc(withRuns(makeBlock('bullet', '', [], { indent: 2 }), ['deep']), withRuns(makeBlock('bullet'), ['top']), withRuns(makeBlock('numbered', '', [], { indent: 3 }), ['deeper']));
    expect(shape(roundTrip(d))).toEqual(shape(d));
  });
});

describe('reading Markdown written elsewhere', () => {
  const read = (md: string) => fromMarkdown(md).blocks.map((b) => ({ type: b.type, indent: b.indent ?? 0, checked: b.checked, runs: b.runs }));

  it('reads emphasis variants', () => {
    expect(parseInline('__strong__ and *em* and ***both***')).toEqual([
      r('strong', 'bold'),
      r(' and '),
      r('em', 'italic'),
      r(' and '),
      r('both', 'bold', 'italic'),
    ]);
    expect(parseInline('snake_case_name')).toEqual([r('snake_case_name')]);
    expect(parseInline('<b>b</b><i>i</i><del>s</del>')).toEqual([r('b', 'bold'), r('i', 'italic'), r('s', 'strike')]);
    expect(parseInline('2 * 3 * 4')).toEqual([r('2 * 3 * 4')]);
    expect(parseInline('**unclosed')).toEqual([r('**unclosed')]);
  });

  it('reads emphasis around a link', () => {
    expect(parseInline('*see [this](https://a.com) now*')).toEqual([r('see ', 'italic'), { text: 'this', marks: ['italic'], link: 'https://a.com' }, r(' now', 'italic')]);
  });

  it('reads links and autolinks', () => {
    expect(parseInline('[a](<https://x.com/a b> "title") <https://y.com>')).toEqual([
      { text: 'a', marks: [], link: 'https://x.com/a b' },
      r(' '),
      { text: 'https://y.com', marks: [], link: 'https://y.com' },
    ]);
  });

  it('reads lists with other markers and 2-space nesting', () => {
    expect(read('+ one\n  * two\n    - three\n  * back\n1) first\n2) second\n- [X] done')).toEqual([
      { type: 'bullet', indent: 0, checked: undefined, runs: [r('one')] },
      { type: 'bullet', indent: 1, checked: undefined, runs: [r('two')] },
      { type: 'bullet', indent: 2, checked: undefined, runs: [r('three')] },
      { type: 'bullet', indent: 1, checked: undefined, runs: [r('back')] },
      { type: 'numbered', indent: 0, checked: undefined, runs: [r('first')] },
      { type: 'numbered', indent: 0, checked: undefined, runs: [r('second')] },
      { type: 'todo', indent: 0, checked: true, runs: [r('done')] },
    ]);
  });

  it('joins wrapped lines', () => {
    expect(read('A paragraph\nthat wraps.\n\n- an item\n  that wraps\n> a quote\n> that wraps')).toEqual([
      { type: 'paragraph', indent: 0, checked: undefined, runs: [r('A paragraph that wraps.')] },
      { type: 'bullet', indent: 0, checked: undefined, runs: [r('an item that wraps')] },
      { type: 'quote', indent: 0, checked: undefined, runs: [r('a quote that wraps')] },
    ]);
  });

  it('does not start a list in the middle of a paragraph unless it starts at 1', () => {
    expect(read('It was\n2015. A good year.').map((b) => b.type)).toEqual(['paragraph']);
  });

  it('reads fenced code as code lines', () => {
    expect(read('```js\nlet a = 1;\n\n  b();\n```\nafter')).toEqual([
      { type: 'paragraph', indent: 0, checked: undefined, runs: [r('let a = 1;', 'code')] },
      { type: 'paragraph', indent: 0, checked: undefined, runs: [] },
      { type: 'paragraph', indent: 0, checked: undefined, runs: [r('  b();', 'code')] },
      { type: 'paragraph', indent: 0, checked: undefined, runs: [r('after')] },
    ]);
  });

  it('reads headings of every level and closing hashes', () => {
    expect(read('# One #\n### Three\n#nospace').map((b) => [b.type, b.runs.map((x) => x.text).join('')])).toEqual([
      ['heading1', 'One'],
      ['heading3', 'Three'],
      ['paragraph', '#nospace'],
    ]);
  });

  it('keeps things it does not understand as text', () => {
    expect(read('![img](a.png)\n\n| a | b |')).toEqual([
      { type: 'paragraph', indent: 0, checked: undefined, runs: [r('!'), { text: 'img', marks: [], link: 'a.png' }] },
      { type: 'paragraph', indent: 0, checked: undefined, runs: [r('| a | b |')] },
    ]);
  });
});

// ---------------------------------------------------------------- random round trips

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const PIECES = ['a', 'word', ' ', '  ', 'x y', '*', '_', '~', '~~', '`', '``', '\\', '[', ']', '(', ')', '<', '>', '<u>', '&', '&amp;', '&#32;', '#', '# ', '1. ', '- ', '"', '.', ',', '!', 'é', '😀', '\t', ' ', 'http://a.b', '**', '__', '|'];
const TYPES: BlockType[] = ['paragraph', 'paragraph', 'heading1', 'heading2', 'heading3', 'heading4', 'quote', 'bullet', 'numbered', 'todo'];
const ALIGN_CHOICES = [undefined, undefined, 'center', 'right', 'justify'] as const;
const LINKS = ['https://example.com/', 'https://example.com/a_(b)?q=1&amp;x', 'mailto:me@x.com', 'https://x.com/a b', 'https://x.com/\\<>'];

function randomRuns(rand: () => number): Run[] {
  const runs: Run[] = [];
  const n = Math.floor(rand() * 6);
  let link: string | undefined;
  for (let i = 0; i < n; i++) {
    let text = '';
    const k = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < k; j++) text += PIECES[Math.floor(rand() * PIECES.length)];
    const marks = MARK_ORDER.filter(() => rand() < 0.3);
    if (rand() < 0.3) link = rand() < 0.5 ? undefined : LINKS[Math.floor(rand() * LINKS.length)];
    runs.push(link ? { text, marks, link } : { text, marks });
  }
  return normalizeRuns(runs);
}

function randomDoc(rand: () => number): Doc {
  const blocks: Block[] = [];
  const n = 1 + Math.floor(rand() * 8);
  let depth = 0;
  for (let i = 0; i < n; i++) {
    const type = TYPES[Math.floor(rand() * TYPES.length)];
    const list = type === 'bullet' || type === 'numbered' || type === 'todo';
    depth = list ? Math.max(0, Math.min(6, depth + Math.floor(rand() * 4) - 1)) : 0;
    const styles = BLOCK_STYLES[type] ?? [];
    const style = styles.length && rand() < 0.4 ? styles[Math.floor(rand() * styles.length)] : undefined;
    const align = ALIGN_CHOICES[Math.floor(rand() * ALIGN_CHOICES.length)];
    const b = makeBlock(type, '', [], { indent: depth, checked: rand() < 0.5, style, align });
    b.runs = style === 'scenebreak' && rand() < 0.5 ? [] : randomRuns(rand);
    blocks.push(b);
  }
  return { blocks };
}

/** What the writer promises to keep: spaces next to a formatting change may lose that formatting. */
function comparable(d: Doc) {
  return shape(d).map((b) => ({
    ...b,
    runs: normalizeRuns(
      b.runs.flatMap((r) => [...r.text].map((ch) => ({ text: ch, marks: /^\s$/u.test(ch) && !r.marks.includes('code') ? [] : r.marks, link: r.link }))).map((x) => (x.link ? x : { text: x.text, marks: x.marks })),
    ),
  }));
}

describe('random round trips', () => {
  const SEEDS = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SEEDS ?? 300);
  it(`keeps ${SEEDS} random documents`, () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rand = rng(seed);
      for (let t = 0; t < 10; t++) {
        const d = randomDoc(rand);
        const md = toMarkdown(d);
        const back = fromMarkdown(md);
        const ctx = `seed ${seed}.${t}\n${md}`;
        expect(comparable(back), ctx).toEqual(comparable(d));
        // Writing what was read gives the same file, so syncing never sees a change that isn't there.
        expect(toMarkdown(back), ctx).toBe(md);
      }
    }
  }, 600_000);
});

describe('random Markdown from elsewhere', () => {
  const BITS = ['a', 'b c', ' ', '\n', '\n\n', '  ', '\t', '*', '**', '_', '__', '~~', '`', '```', '~~~', '#', '# ', '> ', '- ', '+ ', '1. ', '2) ', '[', ']', '(', ')', '](', '<', '>', '<u>', '</u>', '<b>', '</i>', '&', '&amp;', '&#', ';', '\\', '!', 'https://x.y', '- [ ] ', '    ', '&nbsp;'];
  it('reads anything, and settles after one save', () => {
    const rand = rng(7);
    for (let t = 0; t < 3000; t++) {
      let md = '';
      const n = Math.floor(rand() * 30);
      for (let i = 0; i < n; i++) md += BITS[Math.floor(rand() * BITS.length)];
      const once = toMarkdown(fromMarkdown(md));
      expect(toMarkdown(fromMarkdown(once)), JSON.stringify(md)).toBe(once);
    }
  });
});

describe('styles and alignment', () => {
  it('writes heading levels, a scene break, and other styles as {.attributes}', () => {
    const d: Doc = {
      blocks: [
        makeBlock('paragraph', 'The Lighthouse', [], { style: 'title', align: 'center' }),
        makeBlock('heading3', 'Three'),
        makeBlock('heading4', 'Four', [], { align: 'right' }),
        makeBlock('paragraph', '', [], { style: 'scenebreak' }),
        makeBlock('quote', 'Loud', [], { style: 'intense' }),
        makeBlock('paragraph', 'Ends in {.title}'),
        makeBlock('paragraph', '', [], { style: 'subtitle' }),
      ],
    };
    const md = toMarkdown(d);
    expect(md).toBe('The Lighthouse {.title .center}\n\n### Three\n\n#### Four {.right}\n\n* * *\n\n> Loud {.intense}\n\nEnds in \\{.title}\n\n&nbsp; {.subtitle}\n');
    expect(shape(fromMarkdown(md))).toEqual(shape(d));
  });

  it('reads section breaks from other apps as scene breaks, and ignores unknown attributes', () => {
    const d = fromMarkdown('---\n\n***\n\n_ _ _\n\nKeep {.unknown}\n');
    expect(d.blocks.map((b) => b.style ?? b.type)).toEqual(['scenebreak', 'scenebreak', 'scenebreak', 'paragraph']);
    expect(d.blocks[3].runs[0].text).toBe('Keep {.unknown}');
  });
});
