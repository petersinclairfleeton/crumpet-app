import { type Page, expect, test } from '@playwright/test';

// Each test drives the real editor in Chromium with real key events, then
// checks both the model and that the DOM still shows exactly the model.

interface Snapshot {
  blocks: { type: string; checked?: boolean; indent?: number; text: string; runs: { text: string; marks: string[] }[] }[];
  domTexts: string[];
  selection: { anchor: { block: string; offset: number }; focus: { block: string; offset: number } };
}

async function snap(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const ed = (window as any).editor;
    const blocks = ed.state.doc.blocks.map((b: any) => ({
      type: b.type,
      checked: b.checked,
      indent: b.indent,
      text: b.runs.map((r: any) => r.text).join(''),
      runs: b.runs,
    }));
    const domTexts = Array.from(document.querySelectorAll('#editor > [data-block] > .text')).map((el) => el.textContent ?? '');
    return { blocks, domTexts, selection: ed.state.selection };
  });
}

/** The DOM must always match the model block for block. */
async function expectInSync(page: Page) {
  const s = await snap(page);
  expect(s.domTexts).toEqual(s.blocks.map((b) => b.text));
  return s;
}

async function texts(page: Page) {
  return (await expectInSync(page)).blocks.map((b) => b.text);
}

async function blank(page: Page) {
  await page.goto('/?blank');
  await page.locator('#editor').click();
}

test('typing, Enter and Backspace', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('Hello world');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second line');
  expect(await texts(page)).toEqual(['Hello world', 'Second line']);

  // Backspace at the start of the second line joins it to the first.
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  expect(await texts(page)).toEqual(['Hello worldSecond line']);

  // Enter in the middle splits again.
  await page.keyboard.type(' ');
  await page.keyboard.press('Enter');
  expect(await texts(page)).toEqual(['Hello world ', 'Second line']);
});

test('bold with the keyboard shortcut, then typing inherits it', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('plain ');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('bold');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type(' plain');
  const s = await expectInSync(page);
  expect(s.blocks[0].runs).toEqual([
    { text: 'plain ', marks: [] },
    { text: 'bold', marks: ['bold'] },
    { text: ' plain', marks: [] },
  ]);
  await expect(page.locator('#editor strong')).toHaveText('bold');
});

test('formatting a selection across two blocks', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('ControlOrMeta+i');
  const s = await expectInSync(page);
  expect(s.selection.focus).toEqual({ block: (await page.evaluate(() => (window as any).editor.state.doc.blocks[0].id)), offset: 0 });
  expect(s.blocks[0].runs).toEqual([{ text: 'first', marks: ['italic'] }]);
  expect(s.blocks[1].runs).toEqual([{ text: 'second', marks: ['italic'] }]);
});

test('markdown shortcuts make headings, checklists and quotes', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('# Title');
  await page.keyboard.press('Enter');
  await page.keyboard.type('[] buy milk');
  await page.keyboard.press('Enter');
  await page.keyboard.type('call mum');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // empty item leaves the list
  await page.keyboard.type('> a quote');
  const s = await expectInSync(page);
  expect(s.blocks.map((b) => [b.type, b.text])).toEqual([
    ['heading1', 'Title'],
    ['todo', 'buy milk'],
    ['todo', 'call mum'],
    ['quote', 'a quote'],
  ]);
  await expect(page.locator('#editor h1')).toHaveText('Title');
});

test('clicking a checkbox toggles it and undo reverts it', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('[] task');
  await page.locator('#editor .check').click();
  expect((await snap(page)).blocks[0].checked).toBe(true);
  await page.keyboard.press('ControlOrMeta+z');
  expect((await snap(page)).blocks[0].checked).toBe(false);
});

test('undo and redo restore text, structure and formatting', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('two');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('ControlOrMeta+b');
  const done = await texts(page);
  expect(done).toEqual(['one', 'two']);

  for (let i = 0; i < 10; i++) await page.keyboard.press('ControlOrMeta+z');
  expect(await texts(page)).toEqual(['']);

  for (let i = 0; i < 10; i++) await page.keyboard.press('ControlOrMeta+Shift+z');
  const s = await expectInSync(page);
  expect(s.blocks.map((b) => b.text)).toEqual(['one', 'two']);
  expect(s.blocks[1].runs).toEqual([{ text: 'two', marks: ['bold'] }]);
});

test('typing over a selection that spans blocks replaces it', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('alpha');
  await page.keyboard.press('Enter');
  await page.keyboard.type('beta');
  await page.keyboard.press('Enter');
  await page.keyboard.type('gamma');
  // Select from inside "alpha" to inside "gamma".
  await page.evaluate(() => {
    const ed = (window as any).editor;
    const [a, , c] = ed.state.doc.blocks;
    const from = ed.view.posToDom({ block: a.id, offset: 2 });
    const to = ed.view.posToDom({ block: c.id, offset: 3 });
    getSelection()!.setBaseAndExtent(from.node, from.offset, to.node, to.offset);
  });
  await page.keyboard.type('X');
  expect(await texts(page)).toEqual(['alXma']);
});

test('word deletion uses the browser’s idea of a word', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('keep these words');
  await page.keyboard.press('Control+Backspace');
  expect(await texts(page)).toEqual(['keep these ']);
});

test('pasting multi-line plain text', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('[]');
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text/plain', 'line one\nline two');
    document.getElementById('editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  expect(await texts(page)).toEqual(['[]line one', 'line two']);
});

test('IME composition (e.g. Japanese input) lands in the model', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('Tokyo: ');
  const cdp = await page.context().newCDPSession(page);
  // Simulate an input method composing, updating, then committing text.
  await cdp.send('Input.imeSetComposition', { text: 'とう', selectionStart: 2, selectionEnd: 2 });
  await cdp.send('Input.imeSetComposition', { text: 'とうきょう', selectionStart: 5, selectionEnd: 5 });
  await cdp.send('Input.insertText', { text: '東京' });
  await page.waitForTimeout(50);
  expect(await texts(page)).toEqual(['Tokyo: 東京']);
  // And typing continues normally afterwards, with undo removing the composed text.
  await page.keyboard.type('!');
  expect(await texts(page)).toEqual(['Tokyo: 東京!']);
  await page.waitForTimeout(20);
  expect(await page.evaluate(() => (window as any).recorder.problems)).toBe(0);
});

test('emoji are deleted as whole characters', async ({ page }) => {
  await blank(page);
  await page.keyboard.insertText('hi 👍🏽');
  await page.keyboard.press('Backspace');
  expect(await texts(page)).toEqual(['hi ']);
});

test('the sample note loads and the DOM matches the model', async ({ page }) => {
  await page.goto('/?fresh');
  const s = await expectInSync(page);
  expect(s.blocks[0]).toMatchObject({ type: 'heading1', text: 'Opening scene, first pass' });
});

test('device-test recorder stays quiet when in sync and flags a desync', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('# Heading');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Some text');
  await page.keyboard.press('Control+Backspace');
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => (window as any).recorder.problems)).toBe(0);
  await expect(page.locator('#status')).toHaveText('No problems seen yet');

  // Change the page behind the editor's back: the recorder must notice.
  await page.evaluate(() => {
    document.querySelector('#editor h1 .text')!.textContent = 'Tampered';
    (window as any).recorder.check();
  });
  expect(await page.evaluate(() => (window as any).recorder.problems)).toBeGreaterThan(0);
  await expect(page.locator('#status')).toContainText('problem');
});

test('lists: markdown shortcuts, Enter, Tab nesting and numbering', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('1. First');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Nested');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.type('Third');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // empty item leaves the list
  await page.keyboard.type('- bullet');
  const s = await expectInSync(page);
  expect(s.blocks.map((b: any) => [b.type, b.indent ?? 0, b.text])).toEqual([
    ['numbered', 0, 'First'],
    ['numbered', 0, 'Second'],
    ['numbered', 1, 'Nested'],
    ['numbered', 0, 'Third'],
    ['bullet', 0, 'bullet'],
  ]);
  // The page numbers them per level: 1. 2. a. 3.
  const markers = await page.$$eval('#editor .blk-numbered', (els) => els.map((el) => getComputedStyle(el, '::before').content));
  expect(markers).toEqual(['counter(n0) "."', 'counter(n0) "."', 'counter(n1, lower-alpha) "."', 'counter(n0) "."']);
});

test('links: ⌘K on a selection, typed addresses, and pasted addresses', async ({ page }) => {
  await blank(page);
  await page.keyboard.type('Read the guide');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#link-input')).toBeFocused();
  await page.keyboard.type('example.com/guide');
  await page.keyboard.press('Enter');
  await expect(page.locator('#editor a')).toHaveAttribute('href', 'https://example.com/guide');

  await page.keyboard.press('End');
  await page.keyboard.type(' or visit www.crumpet.app then');
  await expect(page.locator('#editor a')).toHaveCount(2);
  await expect(page.locator('#editor a').nth(1)).toHaveText('www.crumpet.app');

  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text/plain', 'https://example.org/notes');
    document.getElementById('editor')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#editor a').nth(2)).toHaveAttribute('href', 'https://example.org/notes');
  await expectInSync(page);

  // A bad address shows an error instead of making a broken link.
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('#link-input').fill('javascript:alert(1)');
  await page.keyboard.press('Enter');
  await expect(page.locator('#link-error')).toContainText('doesn’t look like a web address');
});
