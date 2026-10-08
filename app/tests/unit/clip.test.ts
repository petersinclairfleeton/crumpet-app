// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { bookmarklet, clipDoc, htmlToDoc } from '../../src/data/clip';

const shape = (html: string) => htmlToDoc(html, 'https://example.com/post/1').blocks.map((b) => [b.type, b.runs.map((r) => r.text).join(''), ...(b.indent ? [b.indent] : [])]);

describe('clipping a web page', () => {
  it('keeps headings, paragraphs, lists, quotes, code and tables', () => {
    expect(
      shape(`<script>bad()</script><nav>Menu</nav>
        <h1>Title</h1><p>First <b>bold</b>   text.</p>
        <div>Loose <em>div</em> text<br>second line</div>
        <ul><li>One</li><li>Two<ul><li>Nested</li></ul></li></ul>
        <ol><li><p>Step</p></li></ol>
        <blockquote><p>Quoted</p></blockquote>
        <pre>let a = 1;\n  a++;</pre>
        <table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
        <hr><footer>Footer</footer>`),
    ).toEqual([
      ['heading1', 'Title'],
      ['paragraph', 'First bold text.'],
      ['paragraph', 'Loose div text\nsecond line'],
      ['bullet', 'One'],
      ['bullet', 'Two'],
      ['bullet', 'Nested', 1],
      ['numbered', 'Step'],
      ['quote', 'Quoted'],
      ['paragraph', 'let a = 1;'],
      ['paragraph', '  a++;'],
      ['table', ''],
      ['paragraph', ''],
    ]);
  });

  it('keeps formatting, makes links and pictures absolute', () => {
    const doc = htmlToDoc('<p>A <a href="/about">link</a> and <strong><i>both</i></strong> and <code>x()</code>.</p><img src="pic.png" alt="A pic">', 'https://example.com/post/1');
    expect(doc.blocks[0].runs).toEqual([
      { text: 'A ', marks: [] },
      { text: 'link', marks: [], link: 'https://example.com/about' },
      { text: ' and ', marks: [] },
      { text: 'both', marks: ['bold', 'italic'] },
      { text: ' and ', marks: [] },
      { text: 'x()', marks: ['code'] },
      { text: '.', marks: [] },
    ]);
    expect(doc.blocks[1]).toMatchObject({ type: 'image', src: 'https://example.com/post/pic.png', runs: [{ text: 'A pic' }] });
  });

  it('notes where the clip came from', () => {
    const doc = clipDoc({ title: 'T', url: 'https://www.example.com/a', html: '<p>Hi</p>', selection: false });
    expect(doc.blocks[0].runs[1]).toEqual({ text: 'example.com', marks: ['italic'], link: 'https://www.example.com/a' });
    expect(doc.blocks[1].runs[0].text).toBe('Hi');
  });

  it('the bookmark is a javascript: link that opens this Crumpet', () => {
    const b = bookmarklet('https://crumpet.example/app/');
    expect(b.startsWith('javascript:')).toBe(true);
    const code = decodeURIComponent(b.slice('javascript:'.length));
    expect(code).toContain('"https://crumpet.example/app/"');
    expect(() => new Function(code)).not.toThrow();
  });
});

describe('pasting from Word and Google Docs', () => {
  it('Google Docs: the bold wrapper around everything is ignored, styled spans count', () => {
    const doc = htmlToDoc('<b style="font-weight:normal;" id="docs-internal-guid-1"><p><span style="font-weight:700">Strong</span><span> and </span><span style="font-style:italic;text-decoration:underline">fancy</span></p></b>', 'https://x.test/');
    expect(doc.blocks[0].runs).toEqual([
      { text: 'Strong', marks: ['bold'] },
      { text: ' and ', marks: [] },
      { text: 'fancy', marks: ['italic', 'underline'] },
    ]);
  });

  it('Word: list paragraphs become lists, without their written-out bullets', () => {
    const html = `<p class=MsoListParagraphCxSpFirst style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>·<span>&nbsp;&nbsp;</span></span>Apples</p>
      <p class=MsoListParagraphCxSpLast style='mso-list:l0 level2 lfo1'><span style='mso-list:Ignore'>o<span>&nbsp;</span></span>Green</p>
      <p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span>First</p>`;
    expect(shape(html)).toEqual([
      ['bullet', 'Apples'],
      ['bullet', 'Green', 1],
      ['numbered', 'First'],
    ]);
  });
});
