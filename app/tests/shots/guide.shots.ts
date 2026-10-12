import { type Page, expect, test } from '@playwright/test';

// The pictures in the guide (ui/guide.tsx), taken from the real app with a
// small sample library: a book, some notes, characters and research. Run
// again whenever the app's look changes (see playwright.shots.config.ts).

const OUT = 'public/guide';
type Crumpet = Record<string, (...args: unknown[]) => unknown> & { getState(): Record<string, unknown> };

async function shot(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });
}

/** A writer's library: notebooks, notes and a book in progress. */
async function library(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Notes', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const doc = (s: string) => md.fromMarkdown(s);
    c.updateSettings({ name: 'Alex Rowan', toolbar: 'always', guideSeen: true });
    const writing = c.createStack('Writing') as { id: string };
    const ideas = c.createNotebook('Ideas', writing.id) as { id: string };
    const journal = c.createNotebook('Journal') as { id: string };
    const reading = c.createNotebook('Reading') as { id: string };
    c.createNote({ title: 'Books to read', notebookId: reading.id, tags: ['reading'], doc: doc('- [x] *The Lighthouse Stevensons*, Bella Bathurst\n- [ ] *To the Lighthouse*, Virginia Woolf\n- [ ] *Moby-Dick*, Herman Melville\n') });
    c.createNote({ title: 'Monday, 12 October', notebookId: journal.id, doc: doc('Wrote 1,200 words before breakfast. The storm chapter finally moved.\n\nTomorrow: Tam’s backstory, and [[The keeper’s logbook]].\n') });
    c.createNote({ title: 'Mara’s voice', notebookId: ideas.id, tags: ['the-lighthouse'], doc: doc('Dry, quick, deflects with jokes. Never says what she misses. See [[Story ideas]] and [[The keeper’s logbook]].\n') });
    c.createNote({ title: 'Storms on the west coast', notebookId: reading.id, tags: ['research'], doc: doc('Notes for the storm chapter. Ties into [[Story ideas]].\n') });
    c.createNote({ title: 'The keeper’s logbook', notebookId: ideas.id, tags: ['idea', 'the-lighthouse'], doc: doc('Every entry in the same careful hand, until the night of the storm.\n\n> “Lamp lit 4.12pm. Wind SW, rising.”\n\nCould open each part with a page from it.\n') });
    const ideaNote = c.createNote({ title: 'Story ideas', notebookId: ideas.id, tags: ['idea'], favorite: true, doc: doc('## A lighthouse that remembers\n\nA keeper’s granddaughter comes back to **Gull Rock** to close it down, and finds the light *still being lit* every night.\n\n## Threads to pull\n\n- Who lights the lamp?\n- The logbook with one page torn out\n- A storm that arrives on the same date every year\n\n## Tone\n\nQuiet, salt-worn, a little uncanny. See [[The keeper’s logbook]].\n') }) as { id: string };
    // The book.
    const p = c.createProject('The Lighthouse') as { id: string };
    const st = c.getState() as { chapters: { id: string; projectId: string }[] };
    const first = st.chapters.find((x) => x.projectId === p.id)!;
    const chapters: [string, string, string, string][] = [
      [first.id, 'Arrival', 'Mara comes back to Gull Rock to close the light for good.', 'draft'],
    ];
    for (const [title, synopsis, status] of [
      ['The Keeper', 'Old Tam shows her the logbook, and the torn-out page.', 'draft'],
      ['Storm', 'The gale comes, on the same date as every year.', 'todo'],
      ['Rescue', 'Someone is out on the rocks with a lantern.', 'todo'],
    ]) {
      const ch = c.addChapter(p.id) as { id: string };
      chapters.push([ch.id, title, synopsis, status]);
    }
    const text = [
      'The boat left her at the foot of the steps and turned back before she had found her footing.\n\nMara stood on the wet stone with her one bag and looked up. The tower was smaller than she remembered, the white paint gone grey, but the lamp room still caught the last of the light as if it were waiting for something.\n\nOld Tam was waiting too. He stood at the top of the steps with his hands in his coat pockets, exactly where her grandmother used to stand, and he did not wave.\n\n“They told me you were coming to shut it,” he said.\n\n“They told you right.”\n\nHe looked at her for a long moment, then turned and went in, leaving the door open behind him. Inside, the stairs wound up into the dark, a hundred and twelve of them. She had counted them every summer until she was eleven.\n\nThe kettle was already on.',
      'The logbook lay open on the table, its pages soft with salt.',
      '',
      '',
    ];
    chapters.forEach(([id, title, synopsis, status], i) => {
      c.setChapterTitle(id, title);
      c.setChapterSynopsis(id, synopsis);
      c.setChapterStatus(id, status);
      if (text[i]) c.setChapterDoc(id, doc(text[i]));
    });
    c.addPart(p.id, 'Part One: The Rock');
    c.moveOutlineItem(p.id, (c.project(p.id) as { outline: { id: string }[] }).outline.at(-1)!.id, 0);
    c.setProjectGoal(p.id, 80000);
    const mara = c.addCastMember(p.id, 'character', 'Mara') as { id: string };
    c.updateCastMember(p.id, mara.id, { aliases: ['Mara Quinn'], description: 'Comes back to Gull Rock to close the lighthouse. Sharp, tired, not as sure as she sounds.' });
    const tam = c.addCastMember(p.id, 'character', 'Tam') as { id: string };
    c.updateCastMember(p.id, tam.id, { aliases: ['Old Tam'], description: 'Keeper of the light for forty years. Says little, misses nothing.' });
    c.addCastMember(p.id, 'place', 'Gull Rock');
    c.addResearchNote(p.id, { title: 'Lighthouse lamps', doc: doc('Fresnel lenses bend the light into a beam that can be seen 20 miles out.\n\n- Paraffin vapour burners until the 1950s\n- Clockwork turned the lens: wound every few hours\n') }, false);
    c.openCast(null);
    c.openResearch(null);
    c.setView({ kind: 'all' });
    c.select(ideaNote.id);
  });
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });

test('the guide’s pictures', async ({ page }) => {
  await library(page);

  // Notes: the library, a note open.
  await sidebar(page).getByRole('button', { name: /^All Notes/ }).click();
  await page.getByRole('region', { name: 'Notes', exact: true }).locator('.card').filter({ has: page.locator('.card-title', { hasText: /^Story ideas$/ }) }).click();
  await page.locator('.note-editor').first().click({ position: { x: 5, y: 5 } });
  await shot(page, 'notes');

  // Writing: the / menu on a new line.
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await expect(page.getByRole('listbox')).toBeVisible();
  await shot(page, 'writing');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace');

  // A book: the outline and a chapter in page view.
  await sidebar(page).getByRole('button', { name: /^The Lighthouse/ }).click();
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.locator('.outline-chapter', { hasText: 'Arrival' }).click();
  await expect(page.locator('.pg').first()).toBeVisible();
  await shot(page, 'book');

  // The corkboard.
  await outline.getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByRole('region', { name: 'Corkboard' })).toBeVisible();
  await shot(page, 'cards');
  await outline.getByRole('button', { name: 'Chapter', exact: true }).click();

  // A character's card beside the writing.
  await outline.locator('.research-item', { hasText: 'Tam' }).click();
  await expect(page.getByRole('region', { name: 'Character card' })).toBeVisible();
  await shot(page, 'cast');
  await page.getByRole('region', { name: 'Character card' }).getByRole('button', { name: 'Close card' }).click();

  // Research beside the writing.
  await outline.locator('.research-item', { hasText: 'Lighthouse lamps' }).click();
  await expect(page.getByRole('region', { name: 'Research note' })).toBeVisible();
  await shot(page, 'research');
  await page.getByRole('region', { name: 'Research note' }).getByRole('button', { name: 'Close research' }).click();

  // Handing it in: Word, PDF, e-book.
  await outline.getByRole('button', { name: 'Project options' }).click();
  await expect(page.getByRole('button', { name: 'Download as e-book (ePub)' })).toBeVisible();
  await shot(page, 'export');
  await page.keyboard.press('Escape');

  // Links between notes: the graph.
  await sidebar(page).getByRole('button', { name: 'Graph' }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'graph');

  // Keeping notes on every device.
  await sidebar(page).locator('.account').click();
  await expect(page.getByRole('group', { name: /Where/ })).toBeVisible();
  await shot(page, 'sync');
});
