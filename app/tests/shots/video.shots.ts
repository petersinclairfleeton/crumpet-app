import { type BrowserContext, type Locator, type Page, devices, expect, test } from '@playwright/test';
import { book, crumpet, inBook, openChapter, outline, scrollTo, start } from './book';

// Short videos for social posts, recorded from the real app being used (typed,
// clicked, dragged) with the home page's made-up book. Chrome's own screen
// capture gives sharp frames; ffmpeg makes them an MP4 for X (H.264, 30 fps,
// 1920 × 1080; the iPhone one 1080 × 2338). A pointer is drawn where the mouse
// is, and short captions sit at the foot, so the videos make sense muted.
//   CHROMIUM_PATH=… npx playwright test -c playwright.shots.config.ts video
// They land in app/marketing-out/videos/ (not kept in git).

const OUT = 'marketing-out/videos';
test.use({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
test.describe.configure({ timeout: 240_000 });

// Node's modules, named so the type check (which has no Node types here) leaves them be.
type Fs = { mkdirSync(p: string, o: object): void; writeFileSync(p: string, d: Uint8Array | string): void; rmSync(p: string, o: object): void };
const node = async () => ({
  fs: (await import('node:' + 'fs')) as Fs,
  cp: (await import('node:' + 'child_process')) as { execFileSync(cmd: string, args: string[], o?: object): void },
  buf: (globalThis as unknown as { Buffer: { from(s: string, enc: 'base64'): Uint8Array } }).Buffer,
});

/** A pointer (an arrow, or a fingertip on the phone), a ring on each click, and a caption strip. */
async function addOverlay(context: BrowserContext, touch = false) {
  await context.addInitScript((isTouch) => {
    const css = `
      #vid-pointer { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; will-change: transform; }
      #vid-pointer.touch { width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(40, 40, 45, .22); border: 2px solid rgba(255, 255, 255, .9); opacity: 0; transition: opacity .15s; }
      #vid-pointer.touch.on { opacity: 1; }
      .vid-ring { position: fixed; z-index: 2147483646; pointer-events: none; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 2.5px solid rgba(212, 162, 87, .95); animation: vid-ring .5s ease-out forwards; }
      @keyframes vid-ring { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
      #vid-cap { position: fixed; left: 50%; bottom: 34px; z-index: 2147483647; pointer-events: none; transform: translate(-50%, 8px); opacity: 0; transition: opacity .35s, transform .35s;
        max-width: min(86vw, 900px); padding: 12px 24px; border-radius: 14px; background: rgba(24, 24, 27, .86); color: #fff; text-align: center;
        font: 500 26px/1.3 Onest, system-ui, sans-serif; letter-spacing: -.005em; box-shadow: 0 8px 30px rgba(0, 0, 0, .18); }
      #vid-cap.on { opacity: 1; transform: translate(-50%, 0); }
      #vid-cap.phone { font-size: 19px; bottom: 30px; padding: 10px 18px; background: rgba(24, 24, 27, .94); max-width: 80vw; }`;
    const ready = () => {
      if (document.getElementById('vid-cap')) return;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
      const p = document.createElement('div');
      p.id = 'vid-pointer';
      if (isTouch) p.className = 'touch';
      else p.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2l18 15.5-8.2.7 4.8 9.6-3.6 1.7-4.7-9.6L3 26z" fill="#1f2328" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
      const cap = document.createElement('div');
      cap.id = 'vid-cap';
      if (isTouch) cap.classList.add('phone');
      document.body.append(p, cap);
      const at = (x: number, y: number) => (p.style.transform = `translate(${x}px, ${y}px)`);
      addEventListener('mousemove', (e) => at(e.clientX, e.clientY), true);
      const ring = (x: number, y: number) => {
        const r = document.createElement('div');
        r.className = 'vid-ring';
        r.style.left = `${x}px`;
        r.style.top = `${y}px`;
        document.body.append(r);
        setTimeout(() => r.remove(), 600);
      };
      addEventListener('mousedown', (e) => ring(e.clientX, e.clientY), true);
      addEventListener(
        'touchstart',
        (e) => {
          const t = e.touches[0];
          at(t.clientX, t.clientY);
          p.classList.add('on');
          ring(t.clientX, t.clientY);
        },
        true,
      );
      addEventListener('touchend', () => setTimeout(() => p.classList.remove('on'), 250), true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
    else ready();
  }, touch);
}

async function caption(page: Page, text: string | null) {
  await page.evaluate((t) => {
    const cap = document.getElementById('vid-cap')!;
    if (t) cap.textContent = t;
    cap.classList.toggle('on', !!t);
  }, text);
}

/** Moves the mouse to the middle of `target` (or a point in it) as a hand would. */
async function glide(page: Page, target: Locator, at?: { x: number; y: number }) {
  const b = (await target.boundingBox())!;
  await page.mouse.move(b.x + (at ? at.x : b.width / 2), b.y + (at ? at.y : b.height / 2), { steps: 28 });
  await page.waitForTimeout(180);
}

async function tap(page: Page, target: Locator, at?: { x: number; y: number }) {
  await glide(page, target, at);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(350);
}

/** Types as a person does: not every key at the same speed, a pause after a full stop (`pace` < 1 is quicker). */
async function typeLike(page: Page, text: string, pace = 1) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(pace * (ch === ' ' ? 55 + Math.random() * 60 : /[.,;?!”]/.test(ch) ? 220 + Math.random() * 120 : 28 + Math.random() * 55));
  }
}

/** The closing card: Crumpet's wordmark and a line, over the app's own wash. */
async function endCard(page: Page, line: string) {
  await page.evaluate((text) => {
    document.getElementById('vid-cap')?.classList.remove('on');
    const card = document.createElement('div');
    card.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;justify-items:center;gap:34px;opacity:0;transition:opacity .6s;' +
      'background:radial-gradient(circle at 4% 0%, rgba(212,162,87,.34) 0, transparent 46%), radial-gradient(circle at 96% 100%, rgba(170,190,222,.5) 0, transparent 46%), #efede8;';
    const logo = document.createElement('img');
    logo.src = '/brand/wordmark.png';
    logo.style.cssText = 'width:300px;height:auto';
    const words = document.createElement('p');
    words.textContent = text;
    words.style.cssText = 'margin:0;font:400 40px/1.25 Newsreader, Georgia, serif;color:#1f2328;text-align:center;max-width:900px';
    card.append(logo, words);
    document.body.append(card);
    requestAnimationFrame(() => requestAnimationFrame(() => (card.style.opacity = '1')));
  }, line);
}

/** Records what `fn` does, then makes it an MP4. */
async function record(page: Page, name: string, size: { width: number; height: number }, fn: () => Promise<void>) {
  const { fs, cp, buf } = await node();
  const cdp = await page.context().newCDPSession(page);
  const frames: { data: string; t: number }[] = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp ?? Date.now() / 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  await page.waitForTimeout(700);
  await fn();
  await page.waitForTimeout(1600);
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  const dir = `${OUT}/${name}-frames`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const file = `f${String(i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(`${dir}/${file}`, buf.from(f.data, 'base64'));
    const next = frames[i + 1]?.t ?? end;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(`${dir}/list.txt`, lines.join('\n') + '\n');
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', `scale=${size.width}:${size.height}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', `${OUT}/${name}.mp4`]);
  fs.rmSync(dir, { recursive: true, force: true });
}

const HD = { width: 1920, height: 1080 };

test.beforeEach(async ({ context }, info) => {
  if (!info.title.includes('iPhone')) await addOverlay(context);
});

async function ready(page: Page, chapter?: string) {
  await start(page, chapter);
  await page.mouse.move(800, 450);
}

test('1 · the writing room', async ({ page }) => {
  await ready(page);
  const editor = page.locator('.note-editor').first();
  await crumpet(page, 'updateLayout', { list: false, right: false });
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true, fade: true } });
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await scrollTo(page, '“Your grandmother asked me', 2);
  await page.mouse.move(1450, 760);
  await record(page, '01-writing-room', HD, async () => {
    await caption(page, 'Just the page, and the line you’re on.');
    await typeLike(page, 'She turned back to the gap where the page had been and ran her thumb along the cut edge. ');
    await caption(page, 'No button that writes for you.');
    await typeLike(page, 'Whatever had happened on the fifteenth of October, Tam had written it down first.');
    await page.waitForTimeout(900);
    await caption(page, 'Crumpet. A free writing app.');
    await page.waitForTimeout(2200);
  });
});

test('2 · your own folder', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as { crumpet: { setView(v: object): void } }).crumpet.setView({ kind: 'all' }));
  await page.waitForTimeout(600);
  await record(page, '02-your-own-folder', HD, async () => {
    await caption(page, 'No account. Nothing kept about you.');
    await tap(page, page.getByRole('navigation', { name: 'Notebooks' }).getByRole('button', { name: 'Settings and more' }));
    await tap(page, page.getByRole('button', { name: 'Settings…' }));
    await tap(page, page.getByRole('tab', { name: 'Sync and storage' }));
    await caption(page, 'Your book saves as Markdown files you own…');
    await glide(page, page.getByRole('button', { name: /Continue with Google/ }));
    await page.waitForTimeout(1400);
    await caption(page, '…in your own Google Drive, or a folder on your computer.');
    await glide(page, page.getByRole('button', { name: /Choose a folder/ }));
    await page.waitForTimeout(2400);
  });
});

test('3 · the corkboard', async ({ page }) => {
  await ready(page);
  await record(page, '03-corkboard', HD, async () => {
    await caption(page, 'Every chapter a card.');
    await tap(page, outline(page).getByRole('button', { name: 'Cards' }));
    await expect(page.getByRole('region', { name: 'Corkboard' })).toBeVisible();
    await page.waitForTimeout(1200);
    await caption(page, 'Drag a card to move the chapter.');
    const board = page.getByRole('region', { name: 'Corkboard' });
    const from = board.locator('.cork-card, [draggable="true"]').filter({ hasText: 'Paraffin and salt' }).first();
    const to = board.locator('.cork-card, [draggable="true"]').filter({ hasText: 'The logbook' }).first();
    await glide(page, from, { x: 120, y: 60 });
    await page.mouse.down();
    const tb = (await to.boundingBox())!;
    await page.mouse.move(tb.x + 30, tb.y + 60, { steps: 40 });
    await page.waitForTimeout(250);
    await page.mouse.up();
    await page.waitForTimeout(1500);
    await caption(page, 'Free, like everything in Crumpet.');
    await page.waitForTimeout(2000);
  });
});

test('4 · the book on an iPhone', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 15'], baseURL: test.info().project.use.baseURL });
  await addOverlay(context, true);
  const page = await context.newPage();
  await book(page);
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForFunction(() => 'crumpet' in window);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.waitForTimeout(400);
  const touch = async (target: Locator) => {
    const b = (await target.boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(900);
  };
  await record(page, '04-iphone', { width: 1080, height: 2338 }, async () => {
    await caption(page, 'Your whole book, on your phone.');
    await page.waitForTimeout(1400);
    await touch(page.getByRole('button', { name: /The Lighthouse/ }));
    await caption(page, 'Chapters, cast, research and plan.');
    await page.waitForTimeout(1400);
    await touch(page.getByRole('tab', { name: 'Cast' }).or(page.getByRole('button', { name: 'Cast', exact: true })).first());
    await page.waitForTimeout(1400);
    await touch(page.getByRole('tab', { name: 'Chapters' }).or(page.getByRole('button', { name: 'Chapters', exact: true })).first());
    await page.waitForTimeout(900);
    await caption(page, 'Open a chapter and write.');
    await touch(page.getByRole('button', { name: /The logbook/ }).first());
    await page.waitForTimeout(1600);
    await caption(page, 'The same files as your computer.');
    await page.waitForTimeout(2600);
  });
  await context.close();
});

test('5 · drafts', async ({ page }) => {
  await ready(page, 'The boat leaves');
  await crumpet(page, 'updateLayout', { right: false });
  const editor = page.locator('.note-editor').first();
  await record(page, '05-drafts', HD, async () => {
    await caption(page, 'Rewriting a chapter? Start a new draft.');
    await tap(page, page.getByRole('button', { name: 'Chapter options' }));
    await tap(page, page.getByRole('button', { name: 'New draft…' }));
    await tap(page, page.getByRole('button', { name: /Copy of Draft 1/ }));
    await page.waitForTimeout(800);
    await caption(page, 'Draft 1 stays, one click away.');
    await tap(page, editor.locator('[data-block]').first(), { x: 2, y: 14 });
    await page.keyboard.press('Control+Home');
    await typeLike(page, 'The boat came in on the last of the tide, and the skipper would not take it closer than the steps.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    await caption(page, 'And it shows how much you’ve rewritten.');
    await glide(page, page.locator('.draft-progress, .draft-tabs').first());
    await page.waitForTimeout(1600);
    await tap(page, page.getByRole('tab', { name: /Draft 1$/ }).first());
    await page.waitForTimeout(1600);
    await tap(page, page.getByRole('tab', { name: /Draft 2$/ }).first());
    await page.waitForTimeout(1600);
  });
});

test('6 · who’s in this chapter', async ({ page }) => {
  await ready(page);
  await crumpet(page, 'updateLayout', { list: true, right: true, rightTab: 'chapter' });
  const editor = page.locator('.note-editor').first();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.mouse.move(1000, 700);
  await record(page, '06-in-this-chapter', HD, async () => {
    await caption(page, 'Who’s in this chapter? It knows.');
    await glide(page, page.getByRole('complementary', { name: 'Right sidebar' }).locator('.cast-card, article, li').first());
    await page.waitForTimeout(900);
    await caption(page, 'Write a name, and their card appears.');
    await page.mouse.move(1000, 760, { steps: 20 });
    await typeLike(page, 'She thought of Iona, alone up here at the end, and of the hundred and twelve steps.');
    await page.waitForTimeout(1600);
    await caption(page, 'No tagging. It reads the names on your cards.');
    await page.waitForTimeout(2400);
  });
});

test('7 · echoes and adverbs', async ({ page }) => {
  await ready(page);
  await crumpet(page, 'updateLayout', { list: false, right: true, rightTab: 'writing' });
  const group = page.getByRole('complementary', { name: 'Right sidebar' }).getByRole('group', { name: 'Highlight in the text' });
  await group.scrollIntoViewIfNeeded();
  await record(page, '07-echoes', HD, async () => {
    await caption(page, 'Revising? Let Crumpet point, then you decide.');
    await page.waitForTimeout(800);
    await caption(page, 'Echoes: a word used again within 30 words.');
    await tap(page, group.getByRole('button', { name: 'Echoes' }));
    await page.waitForTimeout(2200);
    await caption(page, '-ly adverbs.');
    await tap(page, group.getByRole('button', { name: /adverbs/ }));
    await page.waitForTimeout(1800);
    await caption(page, 'Long sentences.');
    await tap(page, group.getByRole('button', { name: 'Long sentences' }));
    await page.waitForTimeout(1800);
    await caption(page, 'Nothing is changed for you.');
    await page.waitForTimeout(1800);
  });
});

test('8 · grammar on the device', async ({ page }) => {
  await ready(page, 'Paraffin and salt');
  await inBook(
    page,
    `return import('/@fs' + '/home/user/crumpet-app/packages/editor/src/markdown.ts').then((md) => {
       c.setChapterDoc(ids['Paraffin and salt'], md.fromMarkdown(arg));
     });`,
    '“Before the electric,” Tam said, “you lit it by hand. Every night. You didn’t miss.”\n\nHe showed her the the burner, its brass gone dark with years of hands, and the little pump that fed it. Their was a smell of paraffin still, under the salt.\n\n“Your grandmother could of done it with her eyes shut,” he said.\n\nMara put her hand on the cold glass and said nothing.',
  );
  await openChapter(page, 'Paraffin and salt');
  await crumpet(page, 'updateLayout', { list: false, right: true, rightTab: 'check' });
  const side = page.getByRole('complementary', { name: 'Right sidebar' });
  await side.getByRole('tab', { name: 'Grammar' }).click();
  // The checker (about 8 MB) is fetched once beforehand, so the video shows the check, not the download.
  await page.evaluate(async () => {
    const m = await import('/src/ui/grammarengine.ts' as string);
    const load = m.grammarEngine as ((o: object) => Promise<unknown>) | undefined;
    await load?.({}).catch(() => {});
  });
  await record(page, '08-grammar', HD, async () => {
    await caption(page, 'Grammar, checked on your own device.');
    await tap(page, side.getByRole('button', { name: 'Check grammar' }));
    await expect(side.getByRole('region', { name: 'Grammar' }).locator('.btn.small').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1200);
    await caption(page, 'Your chapters never leave it.');
    await tap(page, side.getByRole('button', { name: 'could have' }));
    await page.waitForTimeout(1200);
    await tap(page, side.getByRole('button', { name: 'There', exact: true }));
    await page.waitForTimeout(1200);
    await tap(page, side.getByRole('button', { name: 'the', exact: true }));
    await page.waitForTimeout(1200);
    await caption(page, 'It’s Harper: open source, and it works offline.');
    await page.waitForTimeout(2200);
  });
});

test('9 · a print-ready paperback', async ({ page }) => {
  await ready(page);
  await record(page, '09-print-ready', HD, async () => {
    await caption(page, 'A paperback’s pages, for KDP or IngramSpark.');
    await tap(page, outline(page).getByRole('button', { name: 'Project options' }));
    await tap(page, page.getByRole('button', { name: /^Export/ }));
    const dialog = page.getByRole('dialog', { name: /^Export/ });
    await tap(page, dialog.getByRole('radio', { name: /Print-ready book/ }));
    await page.waitForTimeout(1200);
    await caption(page, 'Trim size, typeface, chapter openings.');
    const trim = dialog.getByRole('combobox', { name: 'Trim size' });
    await glide(page, trim);
    const sizes = await trim.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    await trim.selectOption(sizes[sizes.length - 1]);
    await page.waitForTimeout(1300);
    await tap(page, dialog.getByRole('radio', { name: 'Modern' }));
    await page.waitForTimeout(1500);
    await tap(page, dialog.getByRole('radio', { name: 'Simple' }));
    await page.waitForTimeout(1500);
    await tap(page, dialog.getByRole('radio', { name: 'Classic' }));
    await page.waitForTimeout(1200);
    await caption(page, 'Free. Then Save as PDF.');
    await glide(page, dialog.getByRole('button', { name: /Make/ }));
    await page.waitForTimeout(2000);
  });
});

test('10 · where the book has been sent', async ({ page }) => {
  await ready(page);
  await inBook(
    page,
    `const of = { kind: 'project', id: p.id };
     const s = (id, to, sent, status, extra) => ({ id, title: 'The Lighthouse', of, to, kind: 'agent', sent, status, ...extra });
     c.updateSettings({ submissions: [
       s('s1', 'Harbour Lane Literary (made up)', '2026-09-02', 'full', { replied: '2026-10-14', wait: 60, notes: 'Asked for the full manuscript' }),
       s('s2', 'North Light Agency (made up)', '2026-09-02', 'partial', { replied: '2026-09-29', wait: 45 }),
       s('s3', 'Saltmarsh & Reed (made up)', '2026-09-09', 'sent', { wait: 56 }),
       s('s4', 'The Tidewater Agency (made up)', '2026-08-19', 'declined', { replied: '2026-09-21', notes: 'Kind note: loved the voice' }),
       s('s5', 'Fathom Books (made up)', '2026-08-19', 'sent', { wait: 42 }),
     ] });`,
  );
  await record(page, '10-submissions', HD, async () => {
    await caption(page, 'Querying? Keep it with the book.');
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(400);
    await typeLike(page, 'Submissions');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1600);
    await caption(page, 'Who has it, and who’s past their reply time.');
    const dialog = page.getByRole('dialog', { name: 'Submissions' });
    await glide(page, dialog.locator('li, .sub-row').filter({ hasText: 'Fathom Books' }).first());
    await page.waitForTimeout(1600);
    await caption(page, 'An offer? It reminds you who else has the book.');
    const row = dialog.locator('li, .sub-row').filter({ hasText: 'Harbour Lane' }).first();
    const status = row.getByRole('combobox').first();
    await glide(page, status);
    await status.selectOption('offer');
    await page.waitForTimeout(3000);
  });
});

test('the pinned post · 30 seconds of Crumpet', async ({ page }) => {
  await ready(page);
  const editor = page.locator('.note-editor').first();
  await crumpet(page, 'updateLayout', { list: false, right: false });
  await crumpet(page, 'updateSettings', { typewriter: { scroll: true } });
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await scrollTo(page, '“Your grandmother asked me', 2);
  await page.mouse.move(1450, 760);
  await record(page, '00-pinned', HD, async () => {
    // Writing.
    await caption(page, 'A writing app for finishing your book.');
    await typeLike(page, 'She turned back to the gap where the page had been, and ran her thumb along the cut edge.', 0.7);
    await page.waitForTimeout(500);
    // Planning: the book as cards.
    await crumpet(page, 'updateSettings', { typewriter: {} });
    await crumpet(page, 'updateLayout', { list: true });
    await caption(page, 'Every chapter on a card. Move them until it fits.');
    await tap(page, outline(page).getByRole('button', { name: 'Cards' }));
    const board = page.getByRole('region', { name: 'Corkboard' });
    await expect(board).toBeVisible();
    await page.waitForTimeout(500);
    await glide(page, board.locator('.cork-card').filter({ hasText: 'Paraffin and salt' }).first(), { x: 120, y: 60 });
    await page.mouse.down();
    const to = (await board.locator('.cork-card').filter({ hasText: 'The logbook' }).first().boundingBox())!;
    await page.mouse.move(to.x + 30, to.y + 60, { steps: 30 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    // Rewriting: a new draft, the first kept.
    await caption(page, 'Rewrite a chapter. The first draft stays.');
    await tap(page, board.locator('.cork-card').filter({ hasText: 'The boat leaves' }).first().locator('.cork-title'));
    await page.waitForTimeout(500);
    await tap(page, page.getByRole('button', { name: 'Chapter options' }));
    await tap(page, page.getByRole('button', { name: 'New draft…' }));
    await tap(page, page.getByRole('button', { name: /Copy of Draft 1/ }));
    await page.waitForTimeout(900);
    // A target for the day, filling as you write.
    await caption(page, 'Set a target for today. Then meet it.');
    await crumpet(page, 'updateLayout', { right: true, rightTab: 'writing' });
    await page.waitForTimeout(400);
    await tap(page, page.locator('.note-editor').first().locator('[data-block]').last(), { x: 4, y: 12 });
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await typeLike(page, 'Tam was already at the top of the steps.', 0.7);
    await page.waitForTimeout(700);
    // Finished: the paperback.
    await caption(page, 'When it’s done, make the paperback.');
    await tap(page, outline(page).getByRole('button', { name: 'Project options' }));
    await tap(page, page.getByRole('button', { name: /^Export/ }));
    await tap(page, page.getByRole('dialog', { name: /^Export/ }).getByRole('radio', { name: /Print-ready book/ }));
    await expect(page.getByRole('group', { name: 'Book design' })).toBeVisible();
    await page.waitForTimeout(2200);
    await endCard(page, 'Free. No account. Nothing writes it for you.');
    await page.waitForTimeout(2800);
  });
});
