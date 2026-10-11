// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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

  it('the bookmark sends a tidied page in the address, so it arrives even when the site cuts the link between windows', () => {
    const filler = Array.from({ length: 300 }, (_, i) => `<p class="para p${i}" data-track="x${i}" onclick="go()">Paragraph ${i + 1} about the keeper's day.</p>`).join('');
    document.title = 'The last lighthouse';
    document.body.innerHTML = `<nav>Menu</nav><article><h1 class="big">The last lighthouse</h1><script>evil()</script><style>p{}</style><p>It stands <span style="font-weight:700;color:red">alone</span>. <a href="/more" class="x">More</a></p><svg><path d="M0"/></svg><!-- ad -->${filler}</article>`;
    const opened: string[] = [];
    const open = vi.spyOn(window, 'open').mockImplementation((u) => (opened.push(String(u)), null));
    const code = decodeURIComponent(bookmarklet('https://crumpet.example/app/').slice('javascript:'.length));
    new Function(code)();
    open.mockRestore();
    expect(opened).toHaveLength(1);
    const [base, data] = opened[0].split('#clip=');
    expect(base).toBe('https://crumpet.example/app/');
    const clip = JSON.parse(decodeURIComponent(data));
    expect(clip.title).toBe('The last lighthouse');
    expect(clip.html).toContain('<span style="font-weight:700;color:red">alone</span>');
    expect(clip.html).toContain('<a href="/more">More</a>');
    expect(clip.html).toContain('<h1>The last lighthouse</h1>');
    expect(clip.html).toContain('Paragraph 300');
    expect(clip.html).not.toMatch(/evil|<style|<svg|ad -->|class=|data-track|onclick|Menu/);
  });

  it('the Mac app’s bookmark opens crumpet://clip with the page in the address', () => {
    const code = decodeURIComponent(bookmarklet('crumpet://clip').slice('javascript:'.length));
    expect(code).toContain('location.href=A+\'#clip=\'+q');
    expect(code).not.toContain('window.open');
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

describe('pasting keeps fonts and colours', () => {
  const html =
    '<p style="color:#1155cc">Blue <span style="font-family:Georgia,serif;font-size:14pt">and Georgia</span></p>' +
    '<p><span style="color:#000000;background-color:#ffff00">marked</span> H<sub>2</sub>O <font face="Courier New" color="#cc0000">old</font></p>';
  it('as Word does: font, size, colour, highlight, subscript (black text is just the default)', () => {
    const { blocks } = htmlToDoc(html, 'https://example.com/', { looks: true });
    expect(blocks[0].runs).toEqual([
      { text: 'Blue ', marks: [], look: { color: '#1155cc' } },
      { text: 'and Georgia', marks: [], look: { font: 'Georgia', size: 14, color: '#1155cc' } },
    ]);
    expect(blocks[1].runs.map((r) => [r.text, r.look])).toEqual([
      ['marked', { highlight: '#ffff00' }],
      [' H', undefined],
      ['2', { va: 'sub' }],
      ['O ', undefined],
      ['old', { font: 'Courier New', color: '#cc0000' }],
    ]);
  });
  it('not for web clippings', () => {
    const { blocks } = htmlToDoc(html, 'https://example.com/');
    expect(blocks.flatMap((b) => b.runs).every((r) => !r.look)).toBe(true);
  });
});
