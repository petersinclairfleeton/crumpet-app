// Templates: ready-made note layouts, plus your own (any note in a notebook
// called "Templates"). {{date}} in a template becomes today's date.

import { type Doc, makeBlock } from '@crumpet/editor/model';
import { fromMarkdown } from '@crumpet/editor/markdown';

export const TEMPLATES_NOTEBOOK = 'Templates';
export const DAILY_NOTEBOOK = 'Daily notes';
/** A template of yours with this title is used for each day's note. */
export const DAILY_TEMPLATE = 'Daily note';

/** A date written out the way people write it here, e.g. "Wednesday 7 October 2026". */
export function longDate(t = Date.now()): string {
  return new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export interface Template {
  id: string;
  name: string;
  hint: string;
  title: string;
  body: string;
}

export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'meeting',
    name: 'Meeting notes',
    hint: 'Who, what was decided, what’s next',
    title: 'Meeting, {{date}}',
    body: '## Who\n\n- \n\n## Notes\n\n\n\n## Decided\n\n- \n\n## Next steps\n\n- [ ] \n',
  },
  {
    id: 'journal',
    name: 'Journal entry',
    hint: 'Today, grateful for, on my mind',
    title: '{{date}}',
    body: '## Today\n\n\n\n## Grateful for\n\n- \n\n## On my mind\n\n\n',
  },
  {
    id: 'book',
    name: 'Book notes',
    hint: 'A book you’re reading',
    title: 'Book: ',
    body: '**Author:** \n\n**Started:** {{date}}\n\n## In a sentence\n\n\n\n## Quotes\n\n> \n\n## What I think\n\n\n',
  },
  {
    id: 'character',
    name: 'Character sheet',
    hint: 'For a story: who they are and what they want',
    title: 'Character: ',
    body: '**Age:** \n\n**Role in the story:** \n\n## Looks\n\n\n\n## Wants\n\n\n\n## Fears\n\n\n\n## How they change\n\n\n',
  },
  {
    id: 'chapter',
    name: 'Chapter plan',
    hint: 'Goal, scenes and loose ends',
    title: 'Plan: chapter ',
    body: '## Purpose\n\n\n\n## Scenes\n\n1. \n\n## Loose ends\n\n- [ ] \n',
  },
  {
    id: 'recipe',
    name: 'Recipe',
    hint: 'Ingredients and method',
    title: '',
    body: '**Serves:** \n\n**Time:** \n\n## Ingredients\n\n- \n\n## Method\n\n1. \n',
  },
];

export function fillIn(text: string, now = Date.now()): string {
  return text.replace(/\{\{\s*date\s*\}\}/gi, longDate(now));
}

/** A template's text as a document, with {{date}} filled in. */
export function templateDoc(body: string, now = Date.now()): Doc {
  const doc = fromMarkdown(fillIn(body, now));
  return doc.blocks.length ? doc : { blocks: [makeBlock('paragraph')] };
}
