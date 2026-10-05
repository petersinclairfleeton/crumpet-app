// What a brand-new Crumpet shows on first run: a short welcome note that
// explains how things work, plus a few example notebooks and notes so the
// layout makes sense straight away. They are ordinary notes and can be
// deleted like any other.

import { type Block, type Doc, makeBlock } from '@crumpet/editor/model';
import type { AppStore } from './store';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function doc(...blocks: Block[]): Doc {
  return { blocks };
}

function rich(type: Block['type'], parts: (string | [string, ...('bold' | 'italic')[]] | { text: string; link: string })[], extra: Partial<Block> = {}): Block {
  const b = makeBlock(type, '', [], extra);
  b.runs = parts.map((p) => (typeof p === 'string' ? { text: p, marks: [] } : Array.isArray(p) ? { text: p[0], marks: p.slice(1) as ('bold' | 'italic')[] } : { text: p.text, marks: [], link: p.link }));
  return b;
}

export function seed(store: AppStore, now = Date.now()): void {
  const inbox = store.createNotebook('Inbox');
  const novel = store.createNotebook('Novel: The Lighthouse', '1 Projects');
  const essay = store.createNotebook('Essay: Why tides lag', '1 Projects');
  const journal = store.createNotebook('Journal', '2 Areas');
  store.createNotebook('Reading list', '3 Resources');

  // Oldest first, so the list (newest first) reads naturally.
  const notes: { notebookId: string; title: string; doc: Doc; tags?: string[]; pinned?: boolean; age: number }[] = [
    {
      notebookId: essay.id,
      title: 'Tide tables for the finale',
      doc: doc(
        makeBlock('paragraph', 'Spring tides land near the full moon, so the causeway floods twice that night.'),
        makeBlock('bullet', 'High water 02:14 and 14:38'),
        makeBlock('bullet', 'Causeway closed for about three hours either side'),
      ),
      tags: ['research'],
      age: 9 * DAY,
    },
    {
      notebookId: journal.id,
      title: 'Weekly review',
      doc: doc(
        makeBlock('todo', 'Empty the Inbox notebook', [], { checked: true }),
        makeBlock('todo', 'Move finished projects to the Archive'),
        makeBlock('todo', 'Pick next week’s writing goal'),
      ),
      pinned: true,
      age: 3 * DAY,
    },
    {
      notebookId: novel.id,
      title: 'Names for the island',
      doc: doc(makeBlock('paragraph', 'Hollin, Skerrow, Marrow Rock, Little Tern. Skerrow sounds the loneliest. Check it isn’t a real place.')),
      tags: ['setting'],
      age: 2 * DAY,
    },
    {
      notebookId: novel.id,
      title: 'Villain who is right',
      doc: doc(makeBlock('paragraph', 'What if the antagonist’s plan would actually work? The reader should half agree with him by chapter ten.')),
      tags: ['characters'],
      age: DAY + 5 * HOUR,
    },
    {
      notebookId: novel.id,
      title: 'Opening scene, first pass',
      doc: doc(
        rich('paragraph', ['She counted the steps every night: ', ['one hundred and twelve', 'bold'], ', and the last one always creaked as if it had ', ['something to say', 'italic'], '. Tonight it said nothing, and that was how she knew someone else had climbed them first.']),
        makeBlock('quote', 'Maybe the visitor is her brother, the one the village thinks drowned.'),
        makeBlock('heading2', 'Things to work out'),
        makeBlock('todo', 'Why does she stay on the island?', [], { checked: true }),
        makeBlock('todo', 'Who climbed the stairs?'),
      ),
      tags: ['opening', 'characters'],
      pinned: true,
      age: 2 * HOUR,
    },
    {
      notebookId: inbox.id,
      title: 'Welcome to Crumpet',
      doc: doc(
        makeBlock('paragraph', 'Crumpet keeps your notes in notebooks, and notebooks in stacks. Everything here is an example you can edit or delete.'),
        makeBlock('heading2', 'Getting around'),
        rich('bullet', [['New note', 'bold'], ': the button at the top of the sidebar (the + on a phone).']),
        rich('bullet', [['Search', 'bold'], ': the box at the top, or ⌘K when you are not editing text.']),
        rich('bullet', [['Notebooks and stacks', 'bold'], ': use the + next to Notebooks, and a notebook’s … menu to rename it, colour it or put it in a stack.']),
        rich('bullet', [['Shortcuts', 'bold'], ': pin a note with the star to keep it in Shortcuts.']),
        makeBlock('heading2', 'Writing'),
        rich('paragraph', ['Type ', ['# ', 'bold'], 'for a heading, ', ['- ', 'bold'], 'for bullets, ', ['1. ', 'bold'], 'for numbers, ', ['[] ', 'bold'], 'for a checklist and ', ['> ', 'bold'], 'for a quote. Tab nests list items. Select text and press ⌘K to add a link.']),
        rich('paragraph', ['Notes are saved on this device as you type. Syncing between devices comes later.']),
      ),
      age: 0,
    },
  ];
  for (const n of notes) {
    const note = store.createNote({ notebookId: n.notebookId, title: n.title, doc: n.doc, tags: n.tags ?? [], pinned: n.pinned ?? false });
    store.backdate(note.id, now - n.age);
  }
  store.setView({ kind: 'all' });
}
