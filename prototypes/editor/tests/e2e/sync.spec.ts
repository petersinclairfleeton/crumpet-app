import { type Page, expect, test } from '@playwright/test';

// Two editors on one page, each a separate "device" with its own sync client.

async function docs(page: Page) {
  return page.evaluate(() => {
    const w = window as any;
    const text = (d: any) => d.state.doc.blocks.map((b: any) => b.runs.map((r: any) => r.text).join(''));
    return { mac: text(w.devices[0].editor), phone: text(w.devices[1].editor), server: w.server.doc.blocks.map((b: any) => b.runs.map((r: any) => r.text).join('')) };
  });
}

async function settled(page: Page) {
  await expect
    .poll(async () => page.evaluate(() => (window as any).devices.every((d: any) => d.client.pending.length === 0 && d.timer === null)), { timeout: 5000 })
    .toBe(true);
  // One more round so the last device to push has been pulled by the other.
  await page.waitForTimeout(600);
}

async function placeCaret(page: Page, device: 'mac' | 'phone', blockIndex: number, offset: number) {
  await page.locator(`#${device} [data-editor]`).click();
  await page.evaluate(
    ([device, blockIndex, offset]) => {
      const d = (window as any).devices[device === 'mac' ? 0 : 1];
      const b = d.editor.state.doc.blocks[blockIndex];
      const at = d.editor.view.posToDom({ block: b.id, offset });
      getSelection()!.setBaseAndExtent(at.node, at.offset, at.node, at.offset);
    },
    [device, blockIndex, offset] as const,
  );
}

test('typing on one device appears on the other', async ({ page }) => {
  await page.goto('/sync.html');
  await placeCaret(page, 'mac', 1, 0);
  await page.keyboard.type('Remember: ');
  await settled(page);
  const d = await docs(page);
  expect(d.mac[1]).toBe('Remember: Ferry leaves at 7:40, so pack the night before.');
  expect(d.phone).toEqual(d.mac);
  expect(d.server).toEqual(d.mac);
});

test('offline edits on both devices merge when they reconnect', async ({ page }) => {
  await page.goto('/sync.html');
  await page.locator('#mac [data-online]').uncheck();
  await page.locator('#phone [data-online]').uncheck();

  // Mac: adds a new checklist item at the end.
  const macLast = await page.evaluate(() => (window as any).devices[0].editor.state.doc.blocks.length - 1);
  await placeCaret(page, 'mac', macLast, 'Tide tables'.length);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Sun cream');

  // iPhone: edits the first item and bolds a word in the paragraph.
  await placeCaret(page, 'phone', 2, 'Torch'.length);
  await page.keyboard.type(', head torch');
  await placeCaret(page, 'phone', 1, 0);
  await page.keyboard.press('Shift+End');
  await page.keyboard.press('ControlOrMeta+b');

  await expect(page.locator('#mac [data-state]')).toContainText('waiting');
  await page.locator('#mac [data-online]').check();
  await page.locator('#phone [data-online]').check();
  await settled(page);

  const d = await docs(page);
  expect(d.mac).toEqual(d.phone);
  expect(d.mac).toEqual(d.server);
  expect(d.mac).toContain('Torch, head torch and spare batteries');
  expect(d.mac).toContain('Sun cream');
  const bold = await page.evaluate(() => (window as any).devices[0].editor.state.doc.blocks[1].runs[0].marks);
  expect(bold).toEqual(['bold']);
});
