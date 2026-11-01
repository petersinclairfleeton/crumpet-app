import { type Page, expect, test } from '@playwright/test';

// The home page's pictures, taken from the real app with a made-up book (no one's
// real name or writing). PNG, at device scale 2, so the narrowest is 2,000 pixels
// wide. Run again whenever the app's look changes:
//   CHROMIUM_PATH=… npx playwright test -c playwright.shots.config.ts landing
// They land in docs/marketing/screenshots/.

const OUT = '../docs/marketing/screenshots';
type Crumpet = Record<string, (...args: unknown[]) => unknown> & { getState(): Record<string, unknown> };

test.use({ deviceScaleFactor: 2 });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, type: 'png' });
}

// The chapter the hero shows: long enough that the page opens in its middle.
const LOGBOOK = `The logbook lay open on the kitchen table where Tam had left it, its pages soft and swollen with salt. Mara did not mean to read it. She meant to make tea, and find the fuse box, and write a list of everything in the tower that would have to be sold or thrown away.

She read it standing up, one hand still on the kettle.

The entries went back forty years, every one in the same careful hand: the time the lamp was lit, the time it was put out, the wind, the sea, the ships that passed. *Lamp lit 4.12pm. Wind SW, light. Sea slight. MV Hebridean Isles, 6.40pm, northbound.* Nothing else. No weather that was not weather. No word about the island, or the winters, or the woman who had lived here with him for most of them.

Her grandmother had called it Tam’s bible. “He’d sooner lose a hand,” she used to say, “than miss a line.”

Mara turned the pages slowly. The handwriting never changed, not when the paraffin burners came out and the electric lamp went in, not when the boats stopped coming twice a week and started coming once. It did not change the winter her grandmother died. That entry said only *Lamp lit 3.58pm. Wind N, strong. Sea rough. No traffic.* and below it, in the same steady ink, the next day’s.

She found the gap near the back.

A page had been cut out, close to the spine, with something sharper than a knife. You would not have noticed unless you were looking, unless you were the kind of person who counted stairs. The entry before it was the fourteenth of October, nine years ago. The entry after it was the sixteenth.

“That’s mine,” Tam said from the doorway.

She had not heard him on the stairs. She closed the book, which was a mistake, because it looked like guilt, and then opened it again, which was worse.

“There’s a page missing.”

“There is.”

“The fifteenth.”

He came in and took the kettle off the stove, though it had not boiled, and poured it anyway. His hands were steady. Everything about him was steady, the way the tower was steady, the way the rock under it had been steady for longer than anyone had been counting.

“Your grandmother asked me the same,” he said. “Drink your tea.”

Outside, the light was going. Mara watched him cross to the window and check the sky the way other men checked a watch, and she thought of all the evenings he had done exactly that, alone, with no one to write it down for. When he went up to the lamp room she heard every one of the hundred and twelve steps.

She sat with the logbook a long time after that. The wind got up. Somewhere below her the sea began to work at the rocks, patient as a clock, and at eleven minutes past four the beam came round for the first time and crossed the kitchen wall, and crossed it again, and again, as it had every night for a hundred years.`;

/** A writer's book in progress, made up for the pictures: parts, scenes, characters, research. */
async function book(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  await page.evaluate(async (logbook) => {
    const md = await import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts' as string);
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const doc = (s: string) => md.fromMarkdown(s);
    c.updateSettings({ name: 'Alex Rowan', guideSeen: true, toolbarAll: false, sessionTarget: 250, dailyGoal: 1000 });
    const ideas = c.createNotebook('Ideas') as { id: string };
    c.createNote({ title: 'Story ideas', notebookId: ideas.id, doc: doc('A keeper’s granddaughter comes back to **Gull Rock** to close it down.\n') });
    const p = c.createProject('The Lighthouse') as { id: string };
    const st = c.getState() as { chapters: { id: string; projectId: string }[] };
    const first = st.chapters.find((x) => x.projectId === p.id)!;
    const mara = c.addCastMember(p.id, 'character', 'Mara') as { id: string };
    c.updateCastMember(p.id, mara.id, {
      aliases: ['Mara Quinn'],
      description: 'Comes back to Gull Rock to close the lighthouse. Sharp, tired, not as sure as she sounds.',
      fields: [
        { label: 'Age', value: '34' },
        { label: 'Looks', value: 'Her grandmother’s hands. A city coat, wrong for the island.' },
        { label: 'Wants', value: 'To sign the papers and be on the Friday boat.' },
        { label: 'Fears', value: 'That she left Iona alone here at the end.' },
        { label: 'Secret', value: 'She’s already sold the lens.' },
        { label: 'How they speak', value: 'Dry, quick, deflects with jokes.' },
        { label: 'How they change', value: 'Stops counting the steps.' },
      ],
    });
    const tam = c.addCastMember(p.id, 'character', 'Tam') as { id: string };
    c.updateCastMember(p.id, tam.id, { aliases: ['Old Tam'], description: 'Keeper of the light for forty years. Says little, misses nothing. Has never once missed a line in the logbook.' });
    const iona = c.addCastMember(p.id, 'character', 'Iona') as { id: string };
    c.updateCastMember(p.id, iona.id, { description: 'Mara’s grandmother. Dead nine years, and still in every room.' });
    c.updateCastMember(p.id, mara.id, { ties: [{ to: iona.id, kind: 'other', note: 'Granddaughter of' }, { to: tam.id, kind: 'friend' }] });
    c.addCastMember(p.id, 'place', 'Gull Rock');
    c.addCastMember(p.id, 'place', 'The lamp room');
    type Scene = [string, string, string, string, string[], string?];
    const scenes: (Scene | string)[] = [
      'Part One: The Rock',
      ['The boat leaves', 'Mara comes back to Gull Rock to close the light for good.', 'done', 'Mara', ['arrival']],
      ['A hundred and twelve steps', 'Tam meets her at the top of the steps and doesn’t wave.', 'done', 'Mara', ['Tam']],
      ['The logbook', 'Forty years in one careful hand, and a page cut out.', 'draft', 'Mara', ['logbook', 'mystery'], logbook],
      ['Paraffin and salt', 'Tam shows her how the old lamp was lit, by hand.', 'draft', 'Tam', ['the light']],
      'Part Two: The Storm',
      ['Wind SW, rising', 'The forecast changes. Tam won’t say why he’s worried.', 'todo', 'Tam', ['storm']],
      ['The fifteenth of October', 'Mara finds out what happened the night of the missing page.', 'todo', 'Mara', ['logbook', 'mystery']],
      ['A lantern on the rocks', 'Someone is out on the rocks with a lantern.', 'todo', 'Mara', ['storm']],
      ['What Iona knew', 'A letter in the lamp room, nine years too late.', 'todo', 'Tam', ['mystery']],
      'Part Three: The Last Light',
      ['Morning', 'The sea is flat. Mara signs nothing.', 'todo', 'Mara', []],
    ];
    const ids: Record<string, string> = {};
    const chapters: string[] = [];
    let usedFirst = false;
    for (const s of scenes) {
      if (typeof s === 'string') {
        c.addPart(p.id, s);
        continue;
      }
      const id = usedFirst ? (c.addChapter(p.id) as { id: string }).id : first.id;
      usedFirst = true;
      const [title, synopsis, status, , keywords, text] = s;
      c.setChapterTitle(id, title);
      c.setChapterSynopsis(id, synopsis);
      c.setChapterStatus(id, status);
      c.setChapterKeywords(id, keywords);
      if (text) c.setChapterDoc(id, doc(text));
      ids[title] = id;
      chapters.push(id);
    }
    // Parts go where they belong: before the first chapter after them.
    const proj = () => c.project(p.id) as { outline: { id: string; type?: string; title?: string }[] };
    let at = 0;
    for (const s of scenes) {
      if (typeof s === 'string') {
        const part = proj().outline.find((x) => x.type === 'part' && x.title === s)!;
        c.moveOutlineItem(p.id, part.id, at);
      } else {
        at = proj().outline.findIndex((x) => x.id === ids[s[0]]);
      }
      at++;
    }
    c.setChapterDoc(first.id, doc('The boat left her at the foot of the steps and turned back before she had found her footing.\n\nMara stood on the wet stone with her one bag and looked up. The tower was smaller than she remembered, the white paint gone grey, but the lamp room still caught the last of the light as if it were waiting for something.'));
    c.setChapterDoc(ids['A hundred and twelve steps'], doc('Old Tam was waiting at the top of the steps with his hands in his coat pockets, exactly where her grandmother used to stand, and he did not wave.'));
    c.setChapterDoc(ids['Paraffin and salt'], doc('“Before the electric,” Tam said, “you lit it by hand. Every night. You didn’t miss.”'));
    const who: Record<string, string> = { Mara: mara.id, Tam: tam.id };
    c.setPlan(p.id, { chapters: scenes.filter((s): s is Scene => typeof s !== 'string').map((s) => ({ id: ids[s[0]], pov: who[s[3]] })) });
    c.setProjectGoal(p.id, 90000);
    c.addResearchNote(p.id, { title: 'Lighthouse lamps', doc: doc('Fresnel lenses bend the light into a beam that can be seen 20 miles out.\n\n- Paraffin vapour burners until the 1950s\n- Clockwork turned the lens: wound every few hours\n') }, false);
    c.addResearchNote(p.id, { title: 'Shipping forecast', doc: doc('Hebrides, Bailey, Fair Isle.\n') }, false);
    c.openCast(null);
    c.openResearch(null);
    c.setView({ kind: 'project', id: p.id });
    c.selectChapter(ids['The logbook']);
    c.setProjectMode('chapter');
  }, LOGBOOK);
}

const crumpet = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => ((window as unknown as { crumpet: Crumpet }).crumpet[f as string] as (...x: unknown[]) => unknown)(...(a as unknown[])), [fn, args] as const);

async function openChapter(page: Page, title: string) {
  await page.evaluate((t) => {
    const c = (window as unknown as { crumpet: Crumpet }).crumpet;
    const st = c.getState() as { projects: { id: string; name: string }[]; chapters: { id: string; projectId: string; title: string }[] };
    const p = st.projects.find((x) => x.name === 'The Lighthouse')!;
    c.setView({ kind: 'project', id: p.id });
    c.selectChapter(st.chapters.find((x) => x.projectId === p.id && x.title === t)!.id);
    c.setProjectMode('chapter');
  }, title);
}

const TYPED = 'She turned back to the gap where the page had been and ran her thumb along the cut edge. Whatever had happened on the fifteenth of October, Tam had written it down first. He wrote everything down. That was the whole of him.';
const MORE = 'Above her the lamp turned and turned. She thought about the Friday boat, and the papers in her bag, and the man upstairs who had never once missed a line. Then she found a pencil in the drawer by the stove, and in the margin beside the missing page, very small, she wrote the date.';

/** Scrolls so a paragraph starts `top` pixels below the top of the editor's scroll box. */
async function scrollTo(page: Page, words: string, top: number) {
  // After the app's own scrolling to the caret has settled.
  await page.waitForTimeout(500);
  await page.evaluate(([w, t]) => {
    const block = [...document.querySelectorAll<HTMLElement>('.note-editor [data-block]')].find((b) => b.textContent?.startsWith(w as string))!;
    const scroller = block.closest<HTMLElement>('.note-scroll')!;
    scroller.scrollTop += block.getBoundingClientRect().top - scroller.getBoundingClientRect().top - (t as number);
  }, [words, top] as const);
}

/**
 * A picture with the caret showing. The caret blinks, so a few pictures are taken
 * and the one with the most ink just where the caret is gets kept.
 */
async function shotWithCaret(page: Page, name: string) {
  await page.waitForTimeout(600);
  const at = await page.evaluate(() => {
    const r = getSelection()!.getRangeAt(0).getClientRects()[0];
    return { x: r.left, y: r.top, h: r.height };
  });
  let best: { ink: number; png: Uint8Array & { toString(enc: 'base64'): string } } | null = null;
  for (let i = 0; i < 6; i++) {
    const png = await page.screenshot({ type: 'png', caret: 'initial' });
    const ink = await page.evaluate(async ([b64, box]) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const k = img.width / innerWidth;
      const c = new OffscreenCanvas(img.width, img.height).getContext('2d')!;
      c.drawImage(img, 0, 0);
      const { data } = c.getImageData(Math.round((box.x - 1) * k), Math.round(box.y * k), Math.round(3 * k), Math.round(box.h * k));
      let n = 0;
      for (let j = 0; j < data.length; j += 4) if (data[j] + data[j + 1] + data[j + 2] < 300) n++;
      return n;
    }, [png.toString('base64'), at] as const);
    if (!best || ink > best.ink) best = { ink, png };
    await page.waitForTimeout(170);
  }
  // Node's file module, named so the type check (which has no Node types here) leaves it be.
  const fs = (await import('node:' + 'fs')) as { writeFileSync(path: string, data: Uint8Array): void };
  fs.writeFileSync(`${OUT}/${name}.png`, best!.png);
}

test('the home page’s pictures', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 945 });
  await book(page);
  // Reload so this session starts now: what's typed below is the session's words.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Notebooks' })).toBeVisible();
  await openChapter(page, 'The logbook');
  const editor = page.locator('.note-editor').first();
  await expect(editor).toBeVisible();

  // The hero: the writing room (the sidebar folded to its strip), the middle of a
  // chapter, the writer at the end of what they've written so far.
  await crumpet(page, 'updateLayout', { list: false, right: false });
  await page.waitForTimeout(500);
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(TYPED, { delay: 2 });
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true } });
  await page.waitForTimeout(300);
  // Typewriter scrolling brings the line up the page; then a paragraph's start is put near the top.
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true } });
  await page.keyboard.press('End');
  await scrollTo(page, '“Your grandmother asked me', 2);
  await shotWithCaret(page, 'hero');
  // The same with the other paragraphs faded back (Typewriter's fade).
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true, fade: true } });
  await page.keyboard.press('End');
  await scrollTo(page, '“Your grandmother asked me', 2);
  await shotWithCaret(page, 'hero-typewriter');
  await crumpet(page, 'updateSettings', { typewriter: {} });

  // Characters and a target for the session: a character's card beside the chapter,
  // and the Writing tab's This session.
  await page.keyboard.press('Enter');
  await page.keyboard.type(MORE, { delay: 2 });
  await crumpet(page, 'updateLayout', { list: true, right: true, rightTab: 'writing' });
  const outline = page.getByRole('region', { name: 'Outline' });
  await outline.getByRole('button', { name: /^Characters & places/ }).click();
  await outline.locator('.research-item', { hasText: 'Mara' }).click();
  await expect(page.getByRole('region', { name: 'Character card' })).toBeVisible();
  await crumpet(page, 'updateLayout', { list: false });
  await scrollTo(page, 'Outside, the light was going', 90);
  await shot(page, 'characters-and-goals');
  await crumpet(page, 'openCast', null);

  // The outline and a chapter open: the two panels working together.
  await page.setViewportSize({ width: 1440, height: 900 });
  await crumpet(page, 'updateLayout', { list: true, right: false });
  await editor.evaluate((el) => (el.closest('.note-scroll') as HTMLElement).scrollTo(0, 0));
  await shot(page, 'outline');

  // The corkboard.
  // A little narrower and taller, so each part's four cards fill a row and all three parts show.
  await page.setViewportSize({ width: 1400, height: 1010 });
  await outline.getByRole('button', { name: 'Cards' }).click();
  await expect(page.getByRole('region', { name: 'Corkboard' })).toBeVisible();
  await shot(page, 'corkboard');
  await outline.getByRole('button', { name: 'Write', exact: true }).click();

  // Nothing but the page: focus mode, in a small window, at the chapter's opening with the caret in its text.
  await page.setViewportSize({ width: 1000, height: 680 });
  await crumpet(page, 'setFocusMode', true);
  await page.waitForTimeout(500);
  await editor.locator('[data-block]', { hasText: 'She read it standing up' }).click();
  await page.keyboard.press('End');
  await editor.evaluate((el) => (el.closest('.note-scroll') as HTMLElement).scrollTo(0, 0));
  await shotWithCaret(page, 'page-only');
});
