// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as katex from 'katex';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';
import { unicodeMathToLatex } from '../../src/data/unicodemath';
import { M_NS, latexToOmml, ommlToLatex } from '../../src/data/omml';
import { fromDocx, toDocx } from '../../src/data/docx';
import { readZip } from '../../src/data/zip';

const k = katex as unknown as typeof import('katex');

describe('UnicodeMath', () => {
  it.each([
    ['a/b', '\\frac{a}{b}'],
    ['(a+b)/c', '\\frac{a+b}{c}'],
    ['x^2+y^2=z^2', 'x^{2}+y^{2}=z^{2}'],
    ['x_i^2', 'x_{i}^{2}'],
    ['e^(iπ)+1=0', 'e^{i\\pi}+1=0'],
    ['√(a+b)', '\\sqrt{a+b}'],
    ['√(3&x)', '\\sqrt[3]{x}'],
    ['∑_(i=1)^n i', '\\sum_{i=1}^{n} i'],
    ['∫_0^∞ e^-x dx', '\\int_{0}^{\\infty} e^{-x} dx'],
    ['lim_(x→0) sin x/x', '\\lim_{x\\to 0} \\sin \\frac{x}{x}'],
    ['(■(a&b@c&d))', '\\left(\\begin{matrix}a & b \\\\ c & d\\end{matrix}\\right)'],
    ['\\alpha+\\beta', '\\alpha+\\beta'],
    ['α≤β', '\\alpha \\le \\beta'],
  ])('%s', (src, tex) => {
    expect(unicodeMathToLatex(src)).toBe(tex);
  });
});

describe('equations in the text', () => {
  it('an equation within a line is saved as $`…`$ and read back', () => {
    const md = 'Energy $`E = mc^2`$ and money $5 and \\`code\\`.\n';
    const doc = fromMarkdown(md);
    expect(doc.blocks[0].runs.some((r) => r.field === 'math:E = mc^2')).toBe(true);
    expect(toMarkdown(doc)).toBe(md);
    const ticks = fromMarkdown('A $`` a`b ``$ b\n');
    expect(ticks.blocks[0].runs.find((r) => r.field)?.field).toBe('math:a`b');
    expect(toMarkdown(ticks)).toBe('A $`` a`b ``$ b\n');
  });
});

describe('equations in Word', () => {
  const parse = (omml: string) => new DOMParser().parseFromString(`<m:oMath xmlns:m="${M_NS}">${omml}</m:oMath>`, 'application/xml').documentElement;
  it.each(['\\frac{a}{b}', 'x^{2}+y_{i}', '\\sqrt{x+1}', '\\sqrt[3]{x}', '\\sum_{i=1}^{n} i^{2}', '\\left(a+b\\right)', '\\begin{matrix}a & b \\\\ c & d\\end{matrix}', '\\hat{x}', '\\alpha \\le \\beta', '\\binom{n}{k}'])('%s goes to Word’s maths and comes back', (tex) => {
    const omml = latexToOmml(k, tex);
    expect(omml).toBeTruthy();
    const back = ommlToLatex(parse(omml!));
    // Drawn the same: KaTeX gives the same MathML for both.
    const norm = (t: string) => k.default.renderToString(t, { output: 'mathml' }).replace(/<annotation[^]*?<\/annotation>/, '');
    expect(norm(back)).toBe(norm(tex));
  });

  it('a Word file has real equations, on their own line and within a line, and reads them back', async () => {
    const doc = fromMarkdown('Area $`\\pi r^2`$ here.\n\n```math\n\\frac{a}{b}\n```\n');
    const bytes = await toDocx([{ doc }], { title: 'T' });
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'));
    expect(xml).toContain('<m:oMathPara><m:oMath><m:f>');
    expect(xml).toMatch(/Area <\/w:t><\/w:r><m:oMath>/);
    const back = await fromDocx(bytes);
    expect(back.doc.blocks[0].runs.find((r) => r.field)?.field).toBe('math:\\pi r^{2}');
    const code = back.doc.blocks.find((b) => b.type === 'code');
    expect(code?.code).toEqual({ lang: 'math', text: '\\frac{a}{b}' });
  });
});
