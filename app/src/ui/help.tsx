// The top bar's Help menu (Word's Help tab): the guide, what's new, sending
// feedback and contacting support. Feedback and support go wherever
// VITE_FEEDBACK_EMAIL and VITE_SUPPORT_URL say (in app/.env); without them
// those two aren't offered.

import { useEffect, useState } from 'react';
import { IconHelp } from './icons';
import { Popover } from './Sidebar';
import { openGuide } from './guide';
import { WHATS_NEW, hasNews } from '../data/whatsnew';
import { useAppState, useAppStore } from './hooks';

const FEEDBACK_EMAIL = (import.meta.env?.VITE_FEEDBACK_EMAIL as string | undefined) ?? '';
const SUPPORT_URL = (import.meta.env?.VITE_SUPPORT_URL as string | undefined) ?? '';

const OPEN_NEWS = 'crumpet:whats-new';
const OPEN_FEEDBACK = 'crumpet:feedback';
export const openWhatsNew = () => window.dispatchEvent(new Event(OPEN_NEWS));

export function HelpMenu() {
  const { settings } = useAppState();
  const [open, setOpen] = useState(false);
  const news = hasNews(settings.whatsNewSeen);
  const pick = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <span className="help-menu">
      <button type="button" className="icon-btn guide-btn" aria-label="Help" aria-expanded={open} data-tip="Help" onClick={() => setOpen(!open)}>
        <IconHelp size={17} />
        {news && <span className="news-dot" aria-label="Something new" />}
      </button>
      {open && (
        <Popover label="Help" onClose={() => setOpen(false)}>
          <div className="menu-list">
            <button type="button" className="menu-item" onClick={pick(openGuide)}>
              Guide to Crumpet
            </button>
            <button type="button" className="menu-item" onClick={pick(openWhatsNew)}>
              What’s new {news && <span className="news-dot inline" />}
            </button>
            {FEEDBACK_EMAIL && (
              <button type="button" className="menu-item" onClick={pick(() => window.dispatchEvent(new Event(OPEN_FEEDBACK)))}>
                Send feedback…
              </button>
            )}
            {SUPPORT_URL && (
              <a className="menu-item" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                Contact support ↗
              </a>
            )}
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
  useEffect(() => {
    const news = () => setShown('news');
    const feedback = () => setShown('feedback');
    window.addEventListener(OPEN_NEWS, news);
    window.addEventListener(OPEN_FEEDBACK, feedback);
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
            <button type="button" className="btn quiet small" onClick={close} autoFocus>
              Close
            </button>
          </header>
          <div className="dialog-body">
            {WHATS_NEW.map((n) => (
              <section key={n.id} className="news-item">
                <h3>
                  {n.title} <small>{n.date}</small>
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
        <Feedback onClose={close} />
      )}
    </div>
  );
}

function Feedback({ onClose }: { onClose(): void }) {
  const [kind, setKind] = useState('An idea');
  const [text, setText] = useState('');
  const send = () => {
    const body = `${text}\n\n—\nCrumpet on ${navigator.userAgent}`;
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Crumpet feedback: ${kind}`)}&body=${encodeURIComponent(body)}`;
    onClose();
  };
  return (
    <form
      className="dialog small-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send();
      }}
    >
      <header className="dialog-head">
        <h2>Send feedback</h2>
      </header>
      <div className="dialog-body">
        <div className="segmented small" role="group" aria-label="Kind of feedback">
          {['An idea', 'Something’s wrong', 'A thank-you'].map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
        <textarea aria-label="Your feedback" rows={6} value={text} autoFocus onChange={(e) => setText(e.target.value)} placeholder="What would make Crumpet better?" />
        <p className="sync-hint">Opens your email with this written in. Your notes aren’t sent.</p>
      </div>
      <footer className="print-foot">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={!text.trim()}>
          Send
        </button>
      </footer>
    </form>
  );
}
