// Word's Immersive Reader: the document's text on its own, full screen, with
// the reader's own text size, letter, word and line spacing, column width and
// page colour; line focus (only a few lines lit); words split into syllables;
// nouns, verbs, adjectives and adverbs coloured; a picture dictionary (click a
// word); and read aloud, each word lit as it's read.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import { type Pos, readBlocks, syllables, tagWords, tokens, wordPicture } from '../data/reading';
import { lookUp } from '../data/thesaurus';
import { useAppState, useAppStore } from './hooks';
import { currentHelped } from './helpers';
import { numberInWords, projectChapters } from '../data/selectors';
import { IconClose } from './icons';

export interface ReaderPrefs {
  size?: number;
  letter?: number;
  word?: number;
  line?: number;
  width?: 'narrow' | 'medium' | 'wide' | 'full';
  paper?: 'white' | 'sepia' | 'grey' | 'dark';
  focus?: 0 | 1 | 3 | 5;
  syllables?: boolean;
  pos?: { noun?: boolean; verb?: boolean; adj?: boolean; adv?: boolean; labels?: boolean };
}

const OPEN = 'crumpet:reader';

/** Opens the immersive reader on an editor's text. */
export function openReader(ed: Editor): void {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: ed }));
}

export function ReaderHost() {
  const [ed, setEd] = useState<Editor | null>(null);
  useEffect(() => {
    const on = (e: Event) => setEd((e as CustomEvent<Editor>).detail);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  return ed ? <Reader ed={ed} onClose={() => setEd(null)} /> : null;
}

const WIDTHS = { narrow: '38ch', medium: '56ch', wide: '76ch', full: '100%' };
const POS_NAMES: Record<Exclude<Pos, null>, string> = { noun: 'Nouns', verb: 'Verbs', adj: 'Adjectives', adv: 'Adverbs' };

function Reader({ ed, onClose }: { ed: Editor; onClose(): void }) {
  const { settings } = useAppState();
  const store = useAppStore();
  const p: ReaderPrefs = settings.reader ?? {};
  // What's being read, at its head (design 23): a chapter's number and title, or a note's title.
  const heading = useMemo(() => {
    const h = currentHelped();
    const id = h?.editor === ed ? h.docId : null;
    const s = store.getState();
    const chapter = s.chapters.find((c) => c.id === id);
    if (chapter) {
      const project = s.projects.find((x) => x.id === chapter.projectId);
      const n = project ? projectChapters(project, s.chapters).findIndex((x) => x.chapter.id === chapter.id) + 1 : 0;
      return { kicker: n ? `Chapter ${numberInWords(n)}` : '', title: chapter.title };
    }
    const note = s.notes.find((x) => x.id === id);
    return { kicker: '', title: note?.title ?? '' };
  }, [ed]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<ReaderPrefs>) => store.updateSettings({ reader: { ...p, ...patch } });
  const [panel, setPanel] = useState<'text' | 'grammar' | 'reading' | null>(null);
  const [picked, setPicked] = useState<{ word: string; x: number; y: number } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  // Where reading aloud has got to: the paragraph, of how many, and the words still to come.
  const [heard, setHeard] = useState<{ k: number; n: number; left: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // Line focus: the lit lines a third of the way down the text area (the text starts there).
  const [bodyH, setBodyH] = useState(600);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBodyH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bandTop = Math.round(bodyH * 0.33);
  const blocks = useMemo(() => readBlocks(ed.state.doc), [ed]);
  const size = p.size ?? 22;
  const line = p.line ?? 1.8;

  // Esc closes; with line focus on, the arrow keys move the text a few lines at a time.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (picked) setPicked(null);
        else onClose();
      } else if (p.focus && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        scroller.current?.scrollBy({ top: (e.key === 'ArrowDown' ? 1 : -1) * size * line * p.focus, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, picked, p.focus, size, line]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // Read aloud: a paragraph at a time, each word lit as it's spoken.
  const readAloud = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      setHeard(null);
      return;
    }
    const paras = Array.from(scroller.current?.querySelectorAll<HTMLElement>('[data-read]') ?? []);
    setSpeaking(true);
    const speak = (k: number) => {
      const el = paras[k];
      const count = (e: HTMLElement) => (e.dataset.read ?? '').split(/\s+/).filter(Boolean).length;
      setHeard(el ? { k, n: paras.length, left: paras.slice(k).reduce((w, e) => w + count(e), 0) } : null);
      if (!el) {
        setSpeaking(false);
        scroller.current?.querySelectorAll('.rw.speaking').forEach((w) => w.classList.remove('speaking'));
        return;
      }
      const u = new SpeechSynthesisUtterance(el.dataset.read ?? '');
      u.onboundary = (ev) => {
        scroller.current?.querySelectorAll('.rw.speaking').forEach((w) => w.classList.remove('speaking'));
        const words = Array.from(el.querySelectorAll<HTMLElement>('.rw'));
        const hit = [...words].reverse().find((w) => Number(w.dataset.at) <= ev.charIndex);
        hit?.classList.add('speaking');
        hit?.scrollIntoView({ block: 'nearest' });
      };
      u.onend = () => speak(k + 1);
      synth.speak(u);
    };
    speak(0);
  };

  const pos = p.pos ?? {};
  const anyPos = pos.noun || pos.verb || pos.adj || pos.adv;
  const style = {
    fontSize: `${size}px`,
    letterSpacing: `${(p.letter ?? 0) / 100}em`,
    wordSpacing: `${(p.word ?? 0) / 100}em`,
    lineHeight: String(line),
    maxWidth: WIDTHS[p.width ?? 'medium'],
  };
  const tagClass = (t: Pos) => (t && pos[t] ? ` pos-${t}` : '');

  return createPortal(
    <div className={`reader paper-${p.paper ?? 'sepia'}${pos.labels ? ' pos-labels' : ''}`} role="dialog" aria-modal="true" aria-label="Immersive reader">
      <header className="reader-bar">
        <span className="grow" />
        <div className="reader-pill" role="group" aria-label="Reader tools">
          {(['text', 'reading', 'grammar'] as const).map((k) => (
            <button key={k} type="button" className={panel === k ? 'on' : ''} aria-label={k === 'text' ? 'Text preferences' : k === 'grammar' ? 'Grammar options' : 'Reading preferences'} aria-expanded={panel === k} onClick={() => setPanel(panel === k ? null : k)}>
              {k === 'text' ? 'Aa' : k === 'grammar' ? 'Syllables' : 'Line focus'}
            </button>
          ))}
          <button type="button" className="reader-aloud" aria-pressed={speaking} onClick={readAloud} disabled={!window.speechSynthesis}>
            {speaking ? '■ Stop' : '▶ Read aloud'}
          </button>
        </div>
        <span className="grow" />
        <button type="button" className="btn quiet small reader-done" aria-label="Close the reader" title="Close (Esc)" onClick={onClose}>
          Done
        </button>
      </header>
      {panel && (
        <div className="reader-panel" role="group" aria-label={panel === 'text' ? 'Text preferences' : panel === 'grammar' ? 'Grammar options' : 'Reading preferences'}>
          {panel === 'text' && (
            <>
              <label>
                <span>Text size</span>
                <input type="range" min={14} max={44} value={size} aria-label="Text size" onChange={(e) => set({ size: Number(e.target.value) })} />
              </label>
              <label>
                <span>Letter spacing</span>
                <input type="range" min={0} max={20} value={p.letter ?? 0} aria-label="Letter spacing" onChange={(e) => set({ letter: Number(e.target.value) || undefined })} />
              </label>
              <label>
                <span>Word spacing</span>
                <input type="range" min={0} max={60} value={p.word ?? 0} aria-label="Word spacing" onChange={(e) => set({ word: Number(e.target.value) || undefined })} />
              </label>
              <label>
                <span>Line spacing</span>
                <input type="range" min={1.2} max={3} step={0.1} value={line} aria-label="Line spacing" onChange={(e) => set({ line: Number(e.target.value) })} />
              </label>
              <div className="reader-choice" role="group" aria-label="Column width">
                <span>Column width</span>
                {(['narrow', 'medium', 'wide', 'full'] as const).map((w) => (
                  <button key={w} type="button" aria-pressed={(p.width ?? 'medium') === w} onClick={() => set({ width: w })}>
                    {w === 'narrow' ? 'Narrow' : w === 'medium' ? 'Moderate' : w === 'wide' ? 'Wide' : 'Very wide'}
                  </button>
                ))}
              </div>
              <div className="reader-choice" role="group" aria-label="Page colour">
                <span>Page colour</span>
                {(['white', 'sepia', 'grey', 'dark'] as const).map((c) => (
                  <button key={c} type="button" className={`swatch-chip paper-${c}`} aria-pressed={(p.paper ?? 'sepia') === c} aria-label={c} title={c[0].toUpperCase() + c.slice(1)} onClick={() => set({ paper: c })} />
                ))}
              </div>
            </>
          )}
          {panel === 'grammar' && (
            <>
              <label className="check">
                <input type="checkbox" checked={!!p.syllables} onChange={(e) => set({ syllables: e.target.checked || undefined })} /> Syllables
              </label>
              <span className="reader-sub">Parts of speech (a rough guess)</span>
              {(Object.keys(POS_NAMES) as Exclude<Pos, null>[]).map((k) => (
                <label key={k} className={`check pos-key pos-${k}`}>
                  <input type="checkbox" checked={!!pos[k]} onChange={(e) => set({ pos: { ...pos, [k]: e.target.checked || undefined } })} /> <span>{POS_NAMES[k]}</span>
                </label>
              ))}
              <label className="check">
                <input type="checkbox" checked={!!pos.labels} disabled={!anyPos} onChange={(e) => set({ pos: { ...pos, labels: e.target.checked || undefined } })} /> Show labels
              </label>
            </>
          )}
          {panel === 'reading' && (
            <>
              <div className="reader-choice" role="group" aria-label="Line focus">
                <span>Line focus</span>
                {([0, 1, 3, 5] as const).map((n) => (
                  <button key={n} type="button" aria-pressed={(p.focus ?? 0) === n} onClick={() => set({ focus: n || undefined })}>
                    {n === 0 ? 'Off' : n === 1 ? 'One line' : `${n} lines`}
                  </button>
                ))}
              </div>
              <p className="sync-hint">With line focus on, the arrow keys move on a few lines at a time. Click any word for its picture and meaning.</p>
            </>
          )}
        </div>
      )}
      <div className="reader-body" ref={body}>
      <div className="reader-scroll" ref={scroller} style={p.focus ? { paddingTop: bandTop, paddingBottom: bodyH } : undefined}>
        <article className="reader-text" style={style}>
          {heading.title && (
            <header className="reader-heading">
              {heading.kicker && <p>{heading.kicker}</p>}
              <h1>{heading.title}</h1>
            </header>
          )}
          {blocks.length === 0 && <p>There’s no text to read yet.</p>}
          {blocks.map((b, i) => {
            const toks = tokens(b.text);
            const tags = anyPos ? tagWords(toks.filter((t) => t.word).map((t) => t.text)) : [];
            let wi = 0;
            const Tag = b.kind === 'li' ? 'li' : b.kind === 'quote' ? 'blockquote' : b.kind === 'p' ? 'p' : b.kind;
            return (
              <Tag key={i} data-read={b.text}>
                {toks.map((t, k) => {
                  if (!t.word) return <span key={k}>{t.text}</span>;
                  const tag = anyPos ? tags[wi++] : null;
                  return (
                    <span
                      key={k}
                      className={`rw${tagClass(tag)}`}
                      data-at={t.at}
                      data-pos={tag && pos[tag] ? tag : undefined}
                      onClick={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setPicked({ word: t.text, x: r.left, y: r.bottom });
                      }}
                    >
                      {p.syllables ? syllables(t.text).join('·') : t.text}
                    </span>
                  );
                })}
              </Tag>
            );
          })}
        </article>
      </div>
      {p.focus ? (
        <div className="reader-focus" aria-hidden="true">
          <div className="dim top" style={{ height: bandTop }} />
          <div className="dim bottom" style={{ top: bandTop + size * line * p.focus }} />
        </div>
      ) : null}
      </div>
      {speaking && heard && (
        <div className="reader-playing" role="status">
          <button type="button" className="reader-stop" aria-label="Stop reading aloud" onClick={readAloud}>
            ■
          </button>
          <span>
            Paragraph {heard.k + 1} of {heard.n}
          </span>
          <span className="reader-track" aria-hidden="true">
            <span style={{ width: `${Math.round((heard.k / Math.max(1, heard.n)) * 100)}%` }} />
          </span>
          <span>{Math.max(1, Math.round(heard.left / 160))} min left</span>
        </div>
      )}
      {picked && <PictureCard word={picked.word} x={picked.x} y={picked.y} onClose={() => setPicked(null)} />}
    </div>,
    document.body,
  );
}

/** Word's Picture Dictionary: the word's picture (from Wikipedia), its meaning, and hearing it said. */
function PictureCard({ word, x, y, onClose }: { word: string; x: number; y: number; onClose(): void }) {
  const [pic, setPic] = useState<{ src: string; title: string } | null | undefined>(undefined);
  const [meaning, setMeaning] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void wordPicture(word).then((r) => live && setPic(r));
    lookUp(word)
      .then((r) => live && setMeaning(r.senses[0] ? `${r.senses[0].pos}: ${r.senses[0].definition}` : null))
      .catch(() => live && setMeaning(null));
    return () => {
      live = false;
    };
  }, [word]);
  const say = () => {
    const u = new SpeechSynthesisUtterance(word);
    window.speechSynthesis?.speak(u);
  };
  const left = Math.min(Math.max(8, x), window.innerWidth - 300);
  const top = Math.min(y + 8, window.innerHeight - 320);
  return (
    <div className="reader-card" role="dialog" aria-label={`Picture dictionary: ${word}`} style={{ left, top }}>
      <div className="reader-card-head">
        <strong>{word}</strong>
        <button type="button" className="btn quiet small" onClick={say} disabled={!window.speechSynthesis}>
          🔊 Hear it
        </button>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      {pic === undefined ? <p className="sync-hint">Looking for a picture…</p> : pic ? <img src={pic.src} alt={pic.title} /> : <p className="sync-hint">No picture for this word.</p>}
      {meaning === undefined ? null : meaning ? <p className="reader-meaning">{meaning}</p> : <p className="sync-hint">No meaning found (or you’re offline).</p>}
    </div>
  );
}
