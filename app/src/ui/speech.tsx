// Read aloud and dictation, like Word's, with the browser's own speech:
// - Read aloud speaks from the caret (or just the selected text), lighting up
//   each word as it's read. Pause, stop, speed and voice are in a small bar.
// - Dictate types what you say at the caret. Saying "comma", "full stop",
//   "question mark" or "new paragraph" puts those in.

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState, useAppStore } from './hooks';

type Status = { kind: 'idle' } | { kind: 'reading'; paused: boolean } | { kind: 'dictating'; heard: string } | { kind: 'error'; message: string };

let status: Status = { kind: 'idle' };
const listeners = new Set<() => void>();
const setStatus = (s: Status) => {
  status = s;
  listeners.forEach((f) => f());
};
export function useSpeech(): Status {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => status,
    () => status,
  );
}

export const canRead = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const RecognitionClass: (new () => Recognition) | undefined = typeof window !== 'undefined' ? ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition) : undefined;
export const canDictate = !!RecognitionClass;

const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

// ---------------------------------------------------------------- read aloud

interface Piece {
  /** The text as shown, and where each character is on the page. */
  text: string;
  at(offset: number, end: boolean): [Text, number];
}

/** A block's text as the page shows it (in page view, across the columns and pages it runs over). */
function pieceOf(ed: Editor, id: string): Piece | null {
  const nodes: Text[] = [];
  for (const el of ed.view.pieces(id)) {
    const text = el.querySelector(':scope > .text') ?? el;
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  }
  if (!nodes.length) return null;
  const starts: number[] = [];
  let all = '';
  for (const n of nodes) {
    starts.push(all.length);
    all += n.data;
  }
  return {
    text: all,
    at(offset, end) {
      let i = nodes.length - 1;
      while (i > 0 && (starts[i] > offset || (end && starts[i] === offset))) i--;
      return [nodes[i], Math.min(nodes[i].data.length, offset - starts[i])];
    },
  };
}

let reading: { ed: Editor; queue: { id: string; from: number; to: number }[]; rate: number; voice: string | null } | null = null;

function light(piece: Piece | null, from: number, to: number): void {
  if (!canHighlight) return;
  if (!piece || to <= from) return void CSS.highlights.delete('crumpet-speak');
  const r = document.createRange();
  try {
    r.setStart(...piece.at(from, false));
    r.setEnd(...piece.at(to, true));
    CSS.highlights.set('crumpet-speak', new Highlight(r));
    // Keep the word being read in view.
    const box = r.getBoundingClientRect();
    if (box.bottom > window.innerHeight - 80 || box.top < 60) (r.startContainer.parentElement ?? undefined)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch {
    // The page changed under us: no highlight for this word.
  }
}

function speakNext(): void {
  const job = reading;
  if (!job) return;
  const next = job.queue.shift();
  if (!next) return stopReading();
  const piece = pieceOf(job.ed, next.id);
  const text = (piece?.text ?? '').slice(next.from, next.to);
  if (!text.trim()) return speakNext();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = job.rate;
  const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === job.voice);
  if (voice) u.voice = voice;
  u.onboundary = (e) => {
    if (e.name !== 'word' || reading !== job) return;
    const start = next.from + e.charIndex;
    const len = e.charLength || (/^\S+/.exec(text.slice(e.charIndex))?.[0].length ?? 1);
    light(pieceOf(job.ed, next.id), start, start + len);
  };
  u.onend = () => {
    if (reading === job) speakNext();
  };
  u.onerror = (e) => {
    if (reading === job && e.error !== 'interrupted' && e.error !== 'canceled') setStatus({ kind: 'error', message: 'Your browser couldn’t read this aloud.' });
  };
  speechSynthesis.speak(u);
}

/** Reads aloud from the caret to the end, or just the selected text. */
export function readAloud(ed: Editor, rate = 1, voice: string | null = null): void {
  if (!canRead) return setStatus({ kind: 'error', message: 'This browser can’t read aloud.' });
  stopAll();
  const sel = ed.currentSelection();
  const blocks = ed.state.doc.blocks;
  const ia = blocks.findIndex((b) => b.id === sel.anchor.block);
  const ib = blocks.findIndex((b) => b.id === sel.focus.block);
  const collapsed = ia === ib && sel.anchor.offset === sel.focus.offset;
  const [a, b] = ia < ib || (ia === ib && sel.anchor.offset <= sel.focus.offset) ? [sel.anchor, sel.focus] : [sel.focus, sel.anchor];
  const first = blocks.findIndex((x) => x.id === a.block);
  const last = collapsed ? blocks.length - 1 : blocks.findIndex((x) => x.id === b.block);
  const queue: { id: string; from: number; to: number }[] = [];
  for (let i = Math.max(0, first); i <= last; i++) {
    const id = blocks[i].id;
    const len = pieceOf(ed, id)?.text.length ?? 0;
    // From the start of the word the caret is in.
    const startAt = i === first ? Math.max(0, (pieceOf(ed, id)?.text.slice(0, a.offset).search(/\S*$/) ?? 0)) : 0;
    queue.push({ id, from: startAt, to: !collapsed && i === last ? b.offset : len });
  }
  reading = { ed, queue, rate, voice };
  setStatus({ kind: 'reading', paused: false });
  speakNext();
}

export function stopReading(): void {
  reading = null;
  if (canRead) speechSynthesis.cancel();
  if (canHighlight) CSS.highlights.delete('crumpet-speak');
  if (status.kind === 'reading') setStatus({ kind: 'idle' });
}

function pauseReading(paused: boolean): void {
  if (!reading) return;
  if (paused) speechSynthesis.pause();
  else speechSynthesis.resume();
  setStatus({ kind: 'reading', paused });
}

// ---------------------------------------------------------------- dictation

let listening: { rec: Recognition; ed: Editor } | null = null;

/** Turns what was said into text to type: spoken punctuation, and a capital to start a sentence. */
export function dictated(said: string, before: string): string {
  let t = ` ${said.trim()} `;
  const marks: [RegExp, string][] = [
    [/\s+(?:new paragraph|next paragraph)\s+/gi, '\n'],
    [/\s+(?:new line)\s+/gi, '\n'],
    [/\s+(?:full stop|period)\s+/gi, '. '],
    [/\s+comma\s+/gi, ', '],
    [/\s+question mark\s+/gi, '? '],
    [/\s+exclamation (?:mark|point)\s+/gi, '! '],
    [/\s+colon\s+/gi, ': '],
    [/\s+semicolon\s+/gi, '; '],
    [/\s+(?:open quote|open quotes)\s+/gi, ' “'],
    [/\s+(?:close quote|close quotes|end quote)\s+/gi, '” '],
  ];
  for (const [re, to] of marks) t = t.replace(re, to);
  t = t.replace(/ +/g, ' ').replace(/ ?\n ?/g, '\n').replace(/“ /g, '“');
  // Leading space unless at the start of a paragraph or after an opening quote.
  t = t.replace(/^ +/, '');
  const startSentence = !before.trim() || /[.!?]["”’)]?\s*$/.test(before);
  if (startSentence) t = t.replace(/^(["“]?)(\p{Ll})/u, (_, q, c) => q + c.toUpperCase());
  t = t.replace(/([.!?]\s+|\n)(["“]?)(\p{Ll})/gu, (_, p, q, c) => p + q + c.toUpperCase());
  if (before && !/[\s“(]$/.test(before) && !/^[,.;:!?\n”]/.test(t)) t = ` ${t}`;
  return t.replace(/\s+$/, (m) => (m.includes('\n') ? '\n' : ''));
}

export function dictate(ed: Editor): void {
  if (!RecognitionClass) return setStatus({ kind: 'error', message: 'This browser can’t take dictation. Chrome, Edge and Safari can.' });
  stopAll();
  const rec = new RecognitionClass();
  rec.lang = navigator.language || 'en-GB';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let heard = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const sel = ed.currentSelection();
        const block = ed.state.doc.blocks.find((b) => b.id === sel.focus.block);
        const before = block ? block.runs.map((x) => x.text).join('').slice(0, sel.focus.offset) : '';
        ed.focus();
        ed.typeText(dictated(r[0].transcript, before));
      } else heard += r[0].transcript;
    }
    if (listening?.rec === rec) setStatus({ kind: 'dictating', heard });
  };
  rec.onerror = (e) => {
    if (listening?.rec !== rec) return;
    listening = null;
    setStatus({ kind: 'error', message: e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Crumpet needs permission to use the microphone.' : e.error === 'no-speech' ? 'Nothing was heard. Try again.' : 'Dictation stopped.' });
  };
  rec.onend = () => {
    if (listening?.rec === rec) {
      listening = null;
      setStatus({ kind: 'idle' });
    }
  };
  listening = { rec, ed };
  setStatus({ kind: 'dictating', heard: '' });
  ed.focus();
  rec.start();
}

export function stopDictating(): void {
  const l = listening;
  listening = null;
  l?.rec.stop();
  if (status.kind === 'dictating') setStatus({ kind: 'idle' });
}

export function stopAll(): void {
  stopReading();
  stopDictating();
}

// ---------------------------------------------------------------- the bar

/** Shown while reading aloud or taking dictation: pause, stop, speed and voice. */
export function SpeechBar() {
  const s = useSpeech();
  const state = useAppState();
  const store = useAppStore();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (canRead ? speechSynthesis.getVoices() : []));
  useEffect(() => {
    if (!canRead) return;
    const load = () => setVoices(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  useEffect(() => {
    if (s.kind !== 'error') return;
    const t = setTimeout(() => setStatus({ kind: 'idle' }), 5000);
    return () => clearTimeout(t);
  }, [s]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (status.kind === 'reading' || status.kind === 'dictating') && stopAll();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (s.kind === 'idle') return null;
  const rate = state.settings.speech?.rate ?? 1;
  const voice = state.settings.speech?.voice ?? null;
  const restart = (r: number, v: string | null) => {
    store.updateSettings({ speech: { rate: r, voice: v } });
    if (reading) {
      reading.rate = r;
      reading.voice = v;
    }
  };
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="speech-bar" role="status" aria-label={s.kind === 'reading' ? 'Reading aloud' : s.kind === 'dictating' ? 'Dictation' : 'Speech'}>
      {s.kind === 'error' && <span>{s.message}</span>}
      {s.kind === 'reading' && (
        <>
          <span className="speech-dot reading" aria-hidden="true" />
          <span>{s.paused ? 'Paused' : 'Reading aloud'}</span>
          <button type="button" className="btn small" onMouseDown={keep} onClick={() => pauseReading(!s.paused)}>
            {s.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="btn quiet small" onMouseDown={keep} onClick={stopReading}>
            Stop
          </button>
          <label className="speech-pick">
            <span className="visually-hidden">Speed</span>
            <select aria-label="Reading speed" value={rate} onChange={(e) => restart(Number(e.target.value), voice)}>
              {[0.75, 0.9, 1, 1.15, 1.3, 1.5].map((r) => (
                <option key={r} value={r}>
                  {r === 1 ? 'Normal speed' : `${r}×`}
                </option>
              ))}
            </select>
          </label>
          {voices.length > 1 && (
            <label className="speech-pick">
              <span className="visually-hidden">Voice</span>
              <select aria-label="Voice" value={voice ?? ''} onChange={(e) => restart(rate, e.target.value || null)}>
                <option value="">Default voice</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {s.kind === 'dictating' && (
        <>
          <span className="speech-dot listening" aria-hidden="true" />
          <span className="speech-heard">{s.heard || 'Listening… say “full stop”, “comma” or “new paragraph” for those.'}</span>
          <button type="button" className="btn small" onMouseDown={keep} onClick={stopDictating}>
            Stop
          </button>
        </>
      )}
    </div>
  );
}

/** Starts reading aloud with the saved speed and voice. */
export function startReading(ed: Editor, settings: { speech?: { rate?: number; voice?: string | null } }): void {
  if (status.kind === 'reading') return stopReading();
  readAloud(ed, settings.speech?.rate ?? 1, settings.speech?.voice ?? null);
}

/** Starts or stops dictation. */
export function toggleDictation(ed: Editor): void {
  if (status.kind === 'dictating') return stopDictating();
  dictate(ed);
}
