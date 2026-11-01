import { afterEach, describe, expect, it } from 'vitest';
import { PROBLEM, buildReport, deviceLines, gmailUrl, mailtoUrl, type DeviceInfo } from '../../src/data/bugreport';
import { clearErrors, logError, recentErrors } from '../../src/data/errorlog';

const device: DeviceInfo = {
  app: 'Windows app 1.1.5',
  build: 'what’s new 2026-11-01-report',
  system: 'Mozilla/5.0 (Windows NT 10.0)',
  window: '1280×800 at 1×',
  language: 'en-GB',
  look: 'light, calm',
  sync: 'Google Drive · Synced just now.',
  size: '12 notes, 1 book',
  errors: [],
};

describe('bug reports', () => {
  afterEach(() => clearErrors());

  it('a problem report has what was written, then the device, and no notes', () => {
    const r = buildReport(PROBLEM, '  Typing froze after pasting a table. ', device);
    expect(r.subject).toBe('Crumpet problem report');
    expect(r.body.startsWith('Typing froze after pasting a table.\n\n—\nAbout this device (no notes are included):')).toBe(true);
    expect(r.body).toContain('Crumpet: Windows app 1.1.5 (what’s new 2026-11-01-report)');
    expect(r.body).toContain('Sync: Google Drive · Synced just now.');
    expect(r.body).toContain('Recent errors: none');
  });

  it('leaves the device out when unticked', () => {
    const r = buildReport('An idea', 'A dark paper colour, please.', null);
    expect(r.subject).toBe('Crumpet idea');
    expect(r.body).toBe('A dark paper colour, please.');
  });

  it('the email and Gmail links carry the address, subject and body', () => {
    const r = buildReport(PROBLEM, 'It broke & then: “this”', device);
    const mail = mailtoUrl(r, 'info.crumpetapp@gmail.com');
    expect(mail.startsWith('mailto:info.crumpetapp@gmail.com?subject=Crumpet%20problem%20report&body=')).toBe(true);
    expect(decodeURIComponent(mail.split('&body=')[1])).toBe(r.body);
    const gmail = new URL(gmailUrl(r, 'info.crumpetapp@gmail.com'));
    expect(gmail.hostname).toBe('mail.google.com');
    expect(gmail.searchParams.get('to')).toBe('info.crumpetapp@gmail.com');
    expect(gmail.searchParams.get('su')).toBe('Crumpet problem report');
    expect(gmail.searchParams.get('body')).toBe(r.body);
  });

  it('keeps the last five errors, short, with where in the code and not the web address', () => {
    const err = new Error('Cannot read properties of undefined (reading "id")');
    err.stack = `TypeError: x\n    at layout (https://petersinclairfleeton.github.io/crumpet-app/assets/index-abc123.js:12:345)\n    at draw (app://crumpet/assets/index-abc123.js:9:1)\n    at more (x.js:1:1)`;
    logError(err, new Date(2026, 10, 1, 14, 3, 9));
    const [e] = recentErrors();
    expect(e.at).toBe('14:03:09');
    expect(e.message).toBe('Error: Cannot read properties of undefined (reading "id")');
    expect(e.where).toBe('layout index-abc123.js:12:345 ← draw index-abc123.js:9:1');
    logError(err); // the same again isn't repeated
    expect(recentErrors()).toHaveLength(1);
    for (let i = 0; i < 7; i++) logError(`Problem ${i}`);
    expect(recentErrors().map((x) => x.message)).toEqual(['Problem 2', 'Problem 3', 'Problem 4', 'Problem 5', 'Problem 6']);
    logError(new Error('Drive said no'), new Date(), 'Sync could not start');
    expect(recentErrors().at(-1)?.message).toBe('Sync could not start: Error: Drive said no');
    expect(deviceLines({ ...device, errors: recentErrors().slice(-1) }).at(-1)).toMatch(/^- \d\d:\d\d:\d\d Sync could not start: Error: Drive said no \(/);
  });
});
