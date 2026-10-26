import { expect, test } from '@playwright/test';

// Submissions: where a book has been sent, replies logged with their dates, what's past its reply time, a warning
// before sending to the same place twice, the others still out once one makes an offer, and a spreadsheet.

type C = { createProject(n: string): { id: string }; openProject(id: string): void; updateSettings(p: object): void; getState(): { settings: { submissions?: { to: string; status: string; replied?: string }[] } } };

test('track where a book has been sent and what came back', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  const day = (n: number) => {
    const d = new Date(Date.now() - n * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  await page.evaluate(
    ({ old }) => {
      const c = (window as unknown as { crumpet: C }).crumpet;
      c.updateSettings({ toolbarAll: true });
      const p = c.createProject('The Lighthouse');
      // Sent to one agent 60 days ago; they said they reply within 42.
      c.updateSettings({ submissions: [{ id: 's0', title: 'The Lighthouse', of: { kind: 'project', id: p.id }, to: 'Agent Grey', kind: 'agent', sent: old, status: 'sent', wait: 42 }] });
      c.openProject(p.id);
    },
    { old: day(60) },
  );
  await page.getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: 'Submissions…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Submissions' });
  await expect(dialog.getByRole('status').first()).toContainText('1 submission · 1 still out · 1 past their reply time');
  const list = dialog.getByRole('list', { name: 'Submissions' });
  await expect(list).toContainText('Agent Grey');
  await expect(list).toContainText('60 days out');
  await expect(list).toContainText('Past their reply time (42 days)');

  // Two more, the book already filled in; the second warns it's been there before.
  for (const to of ['Doe Literary', 'Agent Grey']) {
    await dialog.getByRole('button', { name: 'Add a submission' }).click();
    const form = dialog.getByRole('form', { name: 'Add a submission' });
    await expect(form.getByLabel('What')).toHaveValue('The Lighthouse');
    await form.getByLabel('Sent to').fill(to);
    if (to === 'Agent Grey') {
      await expect(form.getByRole('status')).toContainText(`You sent this to Agent Grey on`);
      await form.getByRole('button', { name: 'Cancel' }).click();
      continue;
    }
    await form.getByLabel('They reply in (days)').fill('30');
    await form.getByRole('button', { name: 'Add' }).click();
  }
  await expect(list.getByRole('listitem')).toHaveCount(2);

  // Agent Grey asks for the full manuscript: the reply is dated today and the clock starts again.
  await list.getByLabel('Status: The Lighthouse at Agent Grey').selectOption({ label: 'Asked for the full manuscript' });
  await expect(list).toContainText('0 days since they asked');
  await expect(list).not.toContainText('Past their reply time');
  // Doe Literary makes an offer: Crumpet lists the others still holding it.
  await list.getByLabel('Status: The Lighthouse at Doe Literary').selectOption({ label: 'Offer or accepted' });
  const offer = dialog.getByRole('alert');
  await expect(offer).toContainText('The Lighthouse has an offer from Doe Literary. One other place still has it: Agent Grey.');
  await offer.getByRole('button', { name: 'Mark it withdrawn' }).click();
  await expect(offer).toHaveCount(0);
  const saved = await page.evaluate(() => (window as unknown as { crumpet: C }).crumpet.getState().settings.submissions!.map((s) => `${s.to}: ${s.status} ${s.replied ? 'dated' : ''}`.trim()));
  expect(saved).toEqual(['Agent Grey: withdrawn dated', 'Doe Literary: offer dated']);
  // Still out: nothing now.
  await dialog.getByRole('radio', { name: 'Still out' }).click();
  await expect(dialog).toContainText('Nothing still out.');
  await dialog.getByRole('radio', { name: 'All' }).click();

  // The list as a spreadsheet.
  const [file] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Download as a spreadsheet/ }).click()]);
  expect(file.suggestedFilename()).toBe('Submissions.csv');
  const text = await new Promise<string>((done) => {
    void file.createReadStream().then((st) => {
      let out = '';
      st.on('data', (d: { toString(): string }) => (out += d.toString()));
      st.on('end', () => done(out));
    });
  });
  expect(text).toContain('The Lighthouse,Doe Literary,Agent,');
  expect(text).toContain('Offer or accepted');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
