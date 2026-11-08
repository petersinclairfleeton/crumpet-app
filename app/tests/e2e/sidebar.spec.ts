import { type Page, expect, test } from '@playwright/test';

// The calm sidebar: CODE's four sections (Capture, Organise, Distill, Express) under
// Favourites, one New button, Search as a row, tags and settings at the foot.

type Crumpet = Record<string, (...a: unknown[]) => { id: string }> & { getState(): { notes: { id: string; title: string; notebookId: string | null; daily?: string }[]; notebooks: { id: string; name: string; stackId: string | null }[]; stacks: { id: string; name: string }[]; projects: { name: string }[] } };
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Notebooks' });
const list = (page: Page) => page.getByRole('region', { name: 'Notes', exact: true });
const state = (page: Page) => page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.getState());

async function calm(page: Page) {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.updateSettings({ guideSeen: true, toolbarAll: false });
    c.createNote({ title: 'First thought', notebookId: null });
  });
  await expect(page.locator('.sidebar.calm')).toBeVisible();
}

test('the calm sidebar: New, Search, Favourites and the graph in one list, then Capture, Organise, Distill and Express, each folding away', async ({ page }) => {
  await calm(page);
  const side = sidebar(page);
  // The app's own logo at the top.
  await expect(side.locator('.brand img.logo')).toBeVisible();
  const top = await side.locator('.side-start > *').evaluateAll((els) => els.map((e) => e.textContent?.trim().replace(/(Ctrl K|⌘K|\d+)$/, '')));
  expect(top).toEqual(['New', 'Search', 'Favourites', 'Graph of links']);
  // One under the other, with no gaps.
  const boxes = await side.locator('.side-start > :not(.new-wrap)').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.bottom]));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i][0] - boxes[i - 1][1]).toBeLessThan(4);
  // New keeps the honey colour.
  expect(await side.getByRole('button', { name: 'New', exact: true }).evaluate((b) => getComputedStyle(b).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  const order = await side.locator('.side-scroll > .side-section').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(order).toEqual(['Capture', 'Organise', 'Distill', 'Express']);
  const capture = side.getByRole('region', { name: 'Capture' });
  await expect(capture.getByRole('button', { name: /^Inbox/ })).toBeVisible();
  await capture.getByRole('button', { name: 'Capture' }).click();
  await expect(capture.getByRole('button', { name: /^Inbox/ })).toHaveCount(0);
  await capture.getByRole('button', { name: 'Capture' }).click();
  await expect(capture.getByRole('button', { name: /^Inbox/ })).toBeVisible();
  // No + beside the manuscripts: they're made from New.
  await expect(side.getByRole('region', { name: 'Express' }).getByRole('button', { name: 'New project' })).toHaveCount(0);
  // Search is a row that opens into a box.
  await side.getByRole('button', { name: 'Search', exact: true }).click();
  await page.keyboard.type('First');
  await expect(list(page)).toContainText('First thought');
  await page.keyboard.press('Escape');
  await expect(side.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
});

test('New makes notes, notebooks, stacks and manuscripts; a notebook goes into a stack, and a stack holds only notebooks', async ({ page }) => {
  await calm(page);
  const side = sidebar(page);
  const make = async (what: string, name?: string) => {
    await side.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByRole('dialog', { name: 'New' }).getByRole('button', { name: what, exact: true }).click();
    if (name) {
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');
    }
  };
  await make('Notebook', 'Journal');
  await make('Notebook stack', 'Writing');
  await make('Manuscript', 'The Lighthouse');
  await expect.poll(async () => (await state(page)).projects.map((p) => p.name)).toEqual(['The Lighthouse']);
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.setView({ kind: 'all' }));
  const organise = side.getByRole('region', { name: 'Organise' });
  await expect(organise.locator('.nb-row', { hasText: 'Journal' })).toBeVisible();
  // Drag the notebook onto the stack.
  await organise.locator('.nb-row', { hasText: 'Journal' }).dragTo(organise.locator('.stack-row', { hasText: 'Writing' }));
  await expect.poll(async () => {
    const st = await state(page);
    return st.notebooks.find((n) => n.name === 'Journal')?.stackId === st.stacks.find((s) => s.name === 'Writing')?.id;
  }).toBe(true);
  // Clicking the stack shows or hides its notebooks; it doesn't open a list of notes.
  const view = async () => page.evaluate(() => (window as unknown as { crumpet: { getState(): { view: { kind: string } } } }).crumpet.getState().view.kind);
  await organise.locator('.stack-row .row-main').click();
  await expect(organise.locator('.nb-row', { hasText: 'Journal' })).toHaveCount(0);
  expect(await view()).toBe('all');
  await organise.locator('.stack-row .row-main').click();
  await expect(organise.locator('.nb-row', { hasText: 'Journal' })).toBeVisible();
});

test('Today lists daily notes and makes none by itself; New daily note starts today’s, which can move to a notebook', async ({ page }) => {
  await calm(page);
  const side = sidebar(page);
  await side.getByRole('button', { name: /^Today/ }).click();
  await expect(list(page).getByRole('heading', { name: 'Today' })).toBeVisible();
  expect((await state(page)).notes.filter((n) => n.daily)).toEqual([]);
  expect((await state(page)).notebooks).toEqual([]);
  await list(page).getByRole('button', { name: 'New daily note' }).click();
  await expect.poll(async () => (await state(page)).notes.filter((n) => n.daily).length).toBe(1);
  const day = (await state(page)).notes.find((n) => n.daily)!;
  expect(day.notebookId).toBeNull();
  await expect(list(page)).toContainText(day.title);
  // Not in the Inbox, and no Daily notes notebook.
  await side.getByRole('button', { name: /^Inbox/ }).click();
  await expect(list(page)).not.toContainText(day.title);
  expect((await state(page)).notebooks).toEqual([]);
  // Filed in a notebook, it leaves Today.
  await page.evaluate((id) => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.moveNote(id, c.createNotebook('Journal').id);
    c.setView({ kind: 'today' });
  }, day.id);
  await expect(list(page)).not.toContainText(day.title);
});

test('tags are under the # at the sidebar’s foot, beside the settings cog', async ({ page }) => {
  await calm(page);
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.addTag(c.getState().notes[0].id, 'idea');
  });
  const side = sidebar(page);
  await expect(side.getByRole('region', { name: 'Organise' }).getByRole('button', { name: 'Tags' })).toHaveCount(0);
  await side.getByRole('button', { name: 'Tags' }).click();
  await page.getByRole('dialog', { name: 'Tags' }).getByRole('button', { name: /#idea/ }).click();
  await expect(list(page).getByRole('heading', { name: '#idea' })).toBeVisible();
  await side.getByRole('button', { name: 'Settings and more' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings and more' }).getByRole('button', { name: /Settings…/ })).toBeVisible();
});

test('the note list and a book’s outline fold away with a button of their own', async ({ page }) => {
  await calm(page);
  await list(page).getByRole('button', { name: 'Hide the note list' }).click();
  await expect(list(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the list' }).click();
  await expect(list(page)).toBeVisible();
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.setView({ kind: 'project', id: c.createProject('The Lighthouse').id });
  });
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: 'Hide the outline' }).click();
  await expect(outline).toHaveCount(0);
  await page.getByRole('button', { name: 'Open the sidebar' }).click();
  await expect(outline).toBeVisible();
});

test('Distill holds notebooks and stacks of your own thinking; Organise what you gather', async ({ page }) => {
  await calm(page);
  const side = sidebar(page);
  const organise = side.getByRole('region', { name: 'Organise' });
  const distill = side.getByRole('region', { name: 'Distill' });
  await expect(distill).not.toContainText('Boards');
  await expect(distill).not.toContainText('Graph');
  await side.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('dialog', { name: 'New' }).getByRole('button', { name: 'Distill notebook', exact: true }).click();
  await page.keyboard.type('Reflections');
  await page.keyboard.press('Enter');
  await expect(distill.locator('.nb-row', { hasText: 'Reflections' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { crumpet: Crumpet }).crumpet.createNotebook('Clippings'));
  await expect(organise.locator('.nb-row', { hasText: 'Clippings' })).toBeVisible();
  // Its menu moves it across.
  await organise.getByRole('button', { name: 'Clippings options' }).click();
  await page.getByRole('button', { name: 'Move to Distill' }).click();
  await expect(distill.locator('.nb-row', { hasText: 'Clippings' })).toBeVisible();
  await expect(organise.locator('.nb-row', { hasText: 'Clippings' })).toHaveCount(0);
  // Dragged onto Organise's heading, back it goes.
  await distill.locator('.nb-row', { hasText: 'Clippings' }).dragTo(organise.locator('.fold-head'));
  await expect(organise.locator('.nb-row', { hasText: 'Clippings' })).toBeVisible();
});

test('Read in a book is for reading: nothing can be typed, and it looks like a printed book', async ({ page }) => {
  await calm(page);
  await page.evaluate(() => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    c.setView({ kind: 'project', id: c.createProject('The Lighthouse').id });
  });
  await page.getByRole('group', { name: 'Writing view' }).getByRole('button', { name: 'Read' }).click();
  const ms = page.getByRole('region', { name: 'Manuscript' });
  await expect(ms.locator('.note-pane.reading')).toBeVisible();
  await expect(ms.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(ms.locator('textarea, input')).toHaveCount(0);
  await expect(ms.getByRole('button', { name: /Add a chapter/ })).toHaveCount(0);
  await expect(ms.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name: 'Bold', exact: true })).toHaveCount(0);
});

test('Read on a wide screen: two facing pages, turned with the arrow keys or the buttons, a chapter starting on a new page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 860 });
  await calm(page);
  await page.evaluate(async () => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const p = c.createProject('The Lighthouse');
    const para = 'The logbook lay open on the kitchen table where Tam had left it, its pages soft and swollen with salt. Mara did not mean to read it.';
    const st = c.getState() as unknown as { chapters: { id: string; projectId: string }[] };
    const first = st.chapters.find((x) => x.projectId === p.id)!;
    c.setChapterDoc(first.id, md.fromMarkdown(Array(30).fill(para).join('\n\n') + '\n'));
    const second = c.addChapter(p.id, first.id);
    c.setChapterTitle(second.id, 'Second');
    c.setChapterDoc(second.id, md.fromMarkdown(para + '\n'));
    c.setView({ kind: 'project', id: p.id });
    c.selectChapter(null);
  });
  await page.getByRole('group', { name: 'Writing view' }).getByRole('button', { name: 'Read' }).click();
  const ms = page.getByRole('region', { name: 'Manuscript' });
  await expect(ms.locator('.note-pane.spread')).toBeVisible();
  const at = ms.locator('.spread-at');
  await expect(at).toContainText(/^Pages 1–2 of \d+$/);
  await expect(ms.getByRole('button', { name: 'Previous pages' })).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(at).toContainText(/^Pages 3–4 of/);
  await ms.getByRole('button', { name: 'Previous pages' }).click();
  await expect(at).toContainText(/^Pages 1–2 of/);
  // Each pair of pages is exactly the screen: the text's columns sit at whole halves of it.
  const lefts = await ms.locator('.note-scroll').evaluate((el) => [...el.querySelectorAll('p.blk-paragraph')].map((p) => Math.round(p.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft)).map((x) => ((x % (el.clientWidth / 2)) + el.clientWidth / 2) % (el.clientWidth / 2)));
  expect(lefts.filter((x) => Math.abs(x - 60) > 3), String(lefts)).toEqual([]);
  // The second chapter starts at the top of a page.
  const top = await ms.locator('.ms-chapter').nth(1).evaluate((el) => el.getBoundingClientRect().top - el.closest('.note-scroll')!.getBoundingClientRect().top);
  expect(top).toBeLessThan(60);
});
