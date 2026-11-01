// Bug reports and feedback (Help → Report a problem / Send feedback): the
// email they become. It goes from the person's own email app (or Gmail in
// the browser) to Crumpet's address, VITE_FEEDBACK_EMAIL in app/.env; there
// is no server. What it says about the device is shown before it's sent,
// and never includes the text of notes.

import type { LoggedError } from './errorlog';

export const FEEDBACK_EMAIL: string = (import.meta.env?.VITE_FEEDBACK_EMAIL as string | undefined) ?? '';

export const FEEDBACK_KINDS = ['Something’s wrong', 'An idea', 'A thank-you'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const PROBLEM: FeedbackKind = 'Something’s wrong';

export interface DeviceInfo {
  /** Which Crumpet: "Website", "Mac app 1.1.3", "Windows app 1.1.3", "Home Screen app". */
  app: string;
  /** The newest What's new entry this copy has (the website's version, in effect). */
  build: string;
  system: string;
  window: string;
  language: string;
  look: string;
  sync: string;
  /** How much is kept: "120 notes, 2 books". */
  size: string;
  errors: LoggedError[];
}

/** The device details as lines of text, as they appear in the email. */
export function deviceLines(d: DeviceInfo): string[] {
  const lines = [
    `Crumpet: ${d.app} (${d.build})`,
    `System: ${d.system}`,
    `Window: ${d.window}`,
    `Language: ${d.language}`,
    `Look: ${d.look}`,
    `Sync: ${d.sync}`,
    `Kept: ${d.size}`,
  ];
  if (d.errors.length) {
    lines.push('Recent errors:');
    for (const e of d.errors) lines.push(`- ${e.at} ${e.message}${e.where ? ` (${e.where})` : ''}`);
  } else lines.push('Recent errors: none');
  return lines;
}

export interface Report {
  subject: string;
  body: string;
}

/** The email: what the person wrote, then (if they leave it ticked) the device details. */
export function buildReport(kind: FeedbackKind, text: string, device: DeviceInfo | null): Report {
  const subject = kind === PROBLEM ? 'Crumpet problem report' : kind === 'An idea' ? 'Crumpet idea' : 'Crumpet thank-you';
  const parts = [text.trim()];
  if (device) parts.push(['—', 'About this device (no notes are included):', ...deviceLines(device)].join('\n'));
  return { subject, body: parts.join('\n\n') };
}

/** Opens the person's email app with the report written in. */
export function mailtoUrl(r: Report, to = FEEDBACK_EMAIL): string {
  return `mailto:${to}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`;
}

/** Writes the report in Gmail in the browser, for people with no email app set up. */
export function gmailUrl(r: Report, to = FEEDBACK_EMAIL): string {
  return `https://mail.google.com/mail/?${new URLSearchParams({ view: 'cm', fs: '1', to, su: r.subject, body: r.body })}`;
}
