// The top bar's Help menu (Word's Help tab): the guide, what's new, reporting
// a problem or sending feedback, and contacting support. Reports and feedback
// go to VITE_FEEDBACK_EMAIL as an email from the person's own email app
// (data/bugreport.ts), support to VITE_SUPPORT_URL (both in app/.env); without
// them those aren't offered.

import { useEffect, useState } from 'react';
import { IconClose, IconExternal, IconFlag, IconHeart, IconHelp, IconKeyboard, IconSparkle } from './icons';
import { Popover } from './Sidebar';
import { openGuide } from './guide';
import { WHATS_NEW, hasNews } from '../data/whatsnew';
import { useAppState, useAppStore, useSync } from './hooks';
import { FEEDBACK_EMAIL, FEEDBACK_KINDS, PROBLEM, buildReport, deviceLines, gmailUrl, mailtoUrl, type DeviceInfo, type FeedbackKind, type Report } from '../data/bugreport';
import { recentErrors } from '../data/errorlog';
import { desktop } from '../data/desktop';
import { isInstalled } from '../data/pwa';
import { statusText } from './SyncSettings';
import type { AppState } from '../data/store';

const SUPPORT_URL = (import.meta.env?.VITE_SUPPORT_URL as string | undefined) ?? '';

const OPEN_NEWS = 'crumpet:whats-new';
const OPEN_FEEDBACK = 'crumpet:feedback';
const OPEN_SHORTCUTS = 'crumpet:shortcuts';
/** Opens Settings → Shortcuts. */
export const openShortcuts = () => window.dispatchEvent(new Event(OPEN_SHORTCUTS));
/** Calls `fn` whenever Settings → Shortcuts is asked for. */
export function onOpenShortcuts(fn: () => void): () => void {
  window.addEventListener(OPEN_SHORTCUTS, fn);
  return () => window.removeEventListener(OPEN_SHORTCUTS, fn);
}
export const openWhatsNew = () => window.dispatchEvent(new Event(OPEN_NEWS));
/** Reports and feedback can be sent from this copy of Crumpet. */
export const canSendFeedback = !!FEEDBACK_EMAIL;
/** Opens the window for reporting a problem (or, with another kind, sending feedback). */
export const openFeedback = (kind: FeedbackKind = PROBLEM) => window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK, { detail: kind }));

/** The guide, what's new, feedback and support, as menu items (here and in the sidebar's menu). */
export function HelpItems({ onPick }: { onPick(): void }) {
  const { settings } = useAppState();
  const news = hasNews(settings.whatsNewSeen);
  const pick = (f: () => void) => () => {
    onPick();
    f();
  };
  return (
    <>
      <button type="button" className="menu-item" onClick={pick(openGuide)}>
        <IconHelp size={14} /> Guide to Crumpet
      </button>
      <button type="button" className="menu-item" onClick={pick(openShortcuts)}>
        <IconKeyboard size={14} /> Keyboard shortcuts
      </button>
      <button type="button" className="menu-item" onClick={pick(openWhatsNew)}>
        <IconSparkle size={14} /> What’s new {news && <small className="menu-hint news-new">New</small>}
      </button>
      {FEEDBACK_EMAIL && (
        <>
          <button type="button" className="menu-item" onClick={pick(() => openFeedback(PROBLEM))}>
            <IconFlag size={14} /> Report a problem…
          </button>
          <button type="button" className="menu-item" onClick={pick(() => openFeedback('An idea'))}>
            <IconHeart size={14} /> Send an idea or thanks…
          </button>
        </>
      )}
      {SUPPORT_URL && (
        <a className="menu-item" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={onPick}>
          <IconExternal size={14} /> Contact support
        </a>
      )}
    </>
  );
}

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  return (
    <span className="help-menu">
      <button type="button" className="icon-btn guide-btn" aria-label="Help" aria-expanded={open} data-tip="Help" onClick={() => setOpen(!open)}>
        <IconHelp size={17} />
      </button>
      {open && (
        <Popover label="Help" onClose={() => setOpen(false)}>
          <div className="menu-list">
            <HelpItems onPick={() => setOpen(false)} />
          </div>
        </Popover>
      )}
    </span>
  );
}

/** What's new and the feedback window, opened from the Help menu or the command palette. */
export function HelpHost() {
  const { settings } = useAppState();
  const store = useAppStore();
  const [shown, setShown] = useState<'news' | 'feedback' | null>(null);
  const [kind, setKind] = useState<FeedbackKind>(PROBLEM);
  useEffect(() => {
    const news = () => setShown('news');
    const feedback = (e: Event) => {
      if (!FEEDBACK_EMAIL) return;
      const k = (e as CustomEvent).detail;
      setKind(FEEDBACK_KINDS.includes(k) ? k : PROBLEM);
      setShown('feedback');
    };
    window.addEventListener(OPEN_NEWS, news);
    window.addEventListener(OPEN_FEEDBACK, feedback);
    // The desktop app's own Help menu: Report a Problem….
    desktop?.onFeedback?.(() => openFeedback(PROBLEM));
    return () => {
      window.removeEventListener(OPEN_NEWS, news);
      window.removeEventListener(OPEN_FEEDBACK, feedback);
    };
  }, []);
  if (!shown) return null;
  const close = () => {
    if (shown === 'news' && settings.whatsNewSeen !== WHATS_NEW[0]?.id) store.updateSettings({ whatsNewSeen: WHATS_NEW[0]?.id });
    setShown(null);
  };
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => e.key === 'Escape' && close()}>
      {shown === 'news' ? (
        <div className="dialog whats-new" role="dialog" aria-modal="true" aria-label="What’s new">
          <header className="dialog-head">
            <h2>What’s new</h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={close} autoFocus>
              <IconClose size={18} />
            </button>
          </header>
          <div className="dialog-body">
            {WHATS_NEW.map((n) => (
              <section key={n.id} className="news-item">
                <h3>
                  {n.title} <small>{localDate(n.date)}</small>
                </h3>
                <ul>
                  {n.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <Feedback onClose={close} initial={kind} />
      )}
    </div>
  );
}

/** Which Crumpet this is, for a report. */
function appName(): string {
  if (desktop) {
    const name = desktop.platform === 'darwin' ? 'Mac app' : desktop.platform === 'win32' ? 'Windows app' : `${desktop.platform} app`;
    return desktop.version ? `${name} ${desktop.version}` : name;
  }
  return isInstalled() ? 'Installed web app' : 'Website';
}

/** What a report says about this device (shown in the window before it's sent). */
function deviceInfo(state: AppState, sync: ReturnType<typeof useSync>['state']): DeviceInfo {
  const notes = state.notes.filter((n) => n.trashedAt === null).length;
  const books = state.projects.length;
  const config = sync.config;
  const where = !config ? 'not connected (only on this device)' : config.kind === 'drive' ? 'Google Drive' : 'a folder on this computer';
  const status = config && sync.status ? ` · ${statusText(sync.status)}` : '';
  return {
    app: appName(),
    build: `what’s new ${WHATS_NEW[0]?.id ?? '?'}`,
    system: navigator.userAgent,
    window: `${window.innerWidth}×${window.innerHeight} at ${window.devicePixelRatio || 1}×`,
    language: navigator.language,
    look: `${state.settings.theme}${state.settings.toolbarAll ? ', older layout' : ''}${state.settings.allTools ? ', every formatting tool' : ''}`,
    sync: `${where}${status}`,
    size: `${notes.toLocaleString('en')} ${notes === 1 ? 'note' : 'notes'}, ${books} ${books === 1 ? 'book' : 'books'}`,
    errors: recentErrors(),
  };
}

/** Opens the email app. The desktop app hands mailto: to the computer (older ones ignore a page going there). */
function openMail(url: string) {
  if (desktop?.openMail) void desktop.openMail(url);
  else window.location.href = url;
}

function Feedback({ onClose, initial }: { onClose(): void; initial: FeedbackKind }) {
  const state = useAppState();
  const { state: sync } = useSync();
  const [kind, setKind] = useState<FeedbackKind>(initial);
  const [text, setText] = useState('');
  const [withDevice, setWithDevice] = useState(true);
  const [sent, setSent] = useState<Report | null>(null);
  const [copied, setCopied] = useState(false);
  const problem = kind === PROBLEM;
  const device = deviceInfo(state, sync);
  const send = () => {
    const report = buildReport(kind, text, withDevice ? device : null);
    openMail(mailtoUrl(report));
    setSent(report);
  };
  if (sent) {
    const all = `To: ${FEEDBACK_EMAIL}\nSubject: ${sent.subject}\n\n${sent.body}`;
    return (
      <div className="dialog small-dialog feedback-sent" role="dialog" aria-modal="true" aria-label="Send it by email">
        <header className="dialog-head">
          <h2>Nearly there</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </header>
        <div className="dialog-body">
          <p>Your email should have opened with this written in, ready to send. Thank you!</p>
          <p className="sync-hint">
            Nothing opened? Write it in Gmail instead, or copy it and email it to <strong className="feedback-address">{FEEDBACK_EMAIL}</strong>.
          </p>
          <textarea aria-label="Your report" rows={8} readOnly value={all} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <footer className="print-foot">
          <a className="btn" href={gmailUrl(sent)} target="_blank" rel="noopener noreferrer">
            Write it in Gmail ↗
          </a>
          <button
            type="button"
            className="btn"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(all)
                .then(() => setCopied(true))
                .catch(() => {})
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn primary" onClick={onClose} autoFocus>
            Done
          </button>
        </footer>
      </div>
    );
  }
  return (
    <form
      className="dialog small-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={problem ? 'Report a problem' : 'Send feedback'}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send();
      }}
    >
      <header className="dialog-head">
        <h2>{problem ? 'Report a problem' : 'Send feedback'}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <IconClose size={18} />
        </button>
      </header>
      <div className="dialog-body">
        <div className="segmented small" role="group" aria-label="Kind of feedback">
          {FEEDBACK_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
        <textarea
          aria-label={problem ? 'What went wrong' : 'Your feedback'}
          rows={6}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          placeholder={problem ? 'What happened, and what did you expect? The steps that make it happen again help most.' : 'What would make Crumpet better?'}
        />
        <label className="check-row">
          <input type="checkbox" checked={withDevice} onChange={(e) => setWithDevice(e.target.checked)} /> Include details about this device and recent errors
        </label>
        {withDevice && (
          <details className="feedback-details">
            <summary>What’s included</summary>
            <pre>{deviceLines(device).join('\n')}</pre>
          </details>
        )}
        <p className="sync-hint">Opens your email with this written in, to {FEEDBACK_EMAIL}. Your notes aren’t sent.</p>
      </div>
      <footer className="print-foot">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={!text.trim()}>
          Send…
        </button>
      </footer>
    </form>
  );
}

/** "8 November 2026" as this device writes dates (8 November 2026, November 8, 2026…). */
function localDate(written: string): string {
  const t = Date.parse(`${written} 12:00`);
  return Number.isNaN(t) ? written : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
