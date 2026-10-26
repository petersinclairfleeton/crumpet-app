import { describe, expect, it } from 'vitest';
import { fromMarkdown } from '@crumpet/editor/markdown';
import { type GrammarLint, grammarIssues, grammarText, issueKey } from '../../src/data/grammar';

const lint = (start: number, end: number, extra: Partial<GrammarLint> = {}): GrammarLint => ({ start, end, message: 'Did you mean to repeat this word?', kind: 'Repetition', rule: 'RepeatedWords', suggestions: [{ kind: 'replace', text: 'the' }], ...extra });

describe('grammar checking', () => {
  it('reads paragraphs, headings and lists, a blank line apart, leaving out code and deleted text', () => {
    const doc = fromMarkdown('# A title\n\nShe went to the {--old --}shop.\n\n```math\nx^2\n```\n\n- one item');
    const src = grammarText(doc);
    expect(src.text).toBe('A title\n\nShe went to the shop.\n\none item');
    // Each character knows its place: "shop" comes after the deleted text in its paragraph.
    const shop = src.text.indexOf('shop');
    expect(src.places[shop]).toEqual({ block: doc.blocks[1].id, offset: 'She went to the old '.length });
    expect(src.places[src.text.indexOf('\n')]).toBeNull();
  });

  it('turns findings into places, with their fixes', () => {
    const doc = fromMarkdown('The lamp.\n\nShe went to the the shop.');
    const src = grammarText(doc);
    const at = src.text.indexOf('the the');
    const [issue] = grammarIssues(src, [lint(at, at + 7)]);
    expect(issue).toMatchObject({ block: doc.blocks[1].id, from: 12, to: 19, text: 'the the', kind: 'Repetition', fixes: [{ label: 'the', from: 12, to: 19, text: 'the' }] });
    // Removing and adding.
    const [rm] = grammarIssues(src, [lint(at, at + 4, { suggestions: [{ kind: 'remove', text: '' }, { kind: 'insert', text: ',' }] })]);
    expect(rm.fixes).toEqual([
      { label: 'Remove it', from: 12, to: 16, text: '' },
      { label: 'Add “,”', from: 16, to: 16, text: ',' },
    ]);
  });

  it('counts whole letters as Harper does, so text after an emoji still lines up', () => {
    const doc = fromMarkdown('Hi 😀 the the end.');
    const src = grammarText(doc);
    // Harper's "the the" starts at character 5 (the emoji is one character to it, two to JavaScript).
    const [issue] = grammarIssues(src, [lint(5, 12)]);
    expect(issue.text).toBe('the the');
    expect(issue.from).toBe(6);
  });

  it('leaves out spelling (the spelling check does that), rules turned off, and findings across paragraphs', () => {
    const src = grammarText(fromMarkdown('One.\n\nTwo.'));
    expect(grammarIssues(src, [lint(0, 3, { kind: 'Spelling' }), lint(0, 3, { rule: 'Off' }), lint(2, 8)], ['Off'])).toEqual([]);
    expect(issueKey({ block: 'b', rule: 'R', text: 'x' })).toBe('b:R:x');
  });
});
