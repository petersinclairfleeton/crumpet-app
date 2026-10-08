// Typewriter mode: the line being typed stays in the middle of the screen,
// other paragraphs fade back, and (if wanted) keys make a soft typewriter
// sound, made on the spot with the Web Audio API (no sound files).

import { useEffect } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import { useAppState } from './hooks';

/** Where the typing line sits, as a share of the writing area's height. */
const LINE_AT = 0.45;

export function useTypewriter(editor: Editor | null): void {
  const tw = useAppState().settings.typewriter;
  const scroll = !!tw?.scroll;
  const fade = !!tw?.fade;
  const sound = !!tw?.sound;

  useEffect(() => {
    if (!editor || !(scroll || fade || sound)) return;
    const root = editor.view.root;
    const scroller = root.closest<HTMLElement>('.note-scroll');
    root.classList.toggle('tw-fade', fade);
    if (scroll) scroller?.classList.add('tw-scroll');

    let current: Element | null = null;
    const update = () => {
      const sel = root.ownerDocument.getSelection();
      if (!sel?.rangeCount || !sel.focusNode || !root.contains(sel.focusNode)) return;
      const node = sel.focusNode.nodeType === Node.ELEMENT_NODE ? (sel.focusNode as Element) : sel.focusNode.parentElement;
      const block = node?.closest('.blk') ?? null;
      if (fade && block !== current) {
        current?.classList.remove('tw-current');
        block?.classList.add('tw-current');
        current = block;
      }
      if (scroll && scroller) {
        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(false);
        // A caret at the start of an empty line has no box of its own: use its paragraph's.
        const box = range.getClientRects()[0] ?? block?.getBoundingClientRect();
        if (!box) return;
        const view = scroller.getBoundingClientRect();
        const delta = box.top + box.height / 2 - (view.top + view.height * LINE_AT);
        if (Math.abs(delta) > 4) scroller.scrollTop += delta;
      }
    };
    const off = editor.onChange(update);
    const doc = root.ownerDocument;
    doc.addEventListener('selectionchange', update);

    const onKey = (e: KeyboardEvent) => {
      if (!sound || e.ctrlKey || e.metaKey || e.repeat) return;
      if (e.key === 'Enter') typeSound('return');
      else if (e.key === 'Backspace' || e.key === 'Delete') typeSound('back');
      else if (e.key.length === 1) typeSound(e.key === ' ' ? 'space' : 'key');
    };
    root.addEventListener('keydown', onKey);
    update();

    return () => {
      off();
      doc.removeEventListener('selectionchange', update);
      root.removeEventListener('keydown', onKey);
      root.classList.remove('tw-fade');
      current?.classList.remove('tw-current');
      scroller?.classList.remove('tw-scroll');
    };
  }, [editor, scroll, fade, sound]);
}

// ------------------------------------------------------------------ sounds

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** A short, soft typewriter sound: a key, the space bar, a backspace, or the carriage return. */
export function typeSound(kind: 'key' | 'space' | 'back' | 'return'): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const ctx = audio;
    if (!noise) {
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.006));
    }
    const t = ctx.currentTime;
    const click = (freq: number, gain: number, rate: number) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = rate * (0.92 + Math.random() * 0.16);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(filter).connect(g).connect(ctx.destination);
      src.start(t);
    };
    if (kind === 'key') click(2400, 0.5, 1);
    else if (kind === 'space') click(900, 0.45, 0.8);
    else if (kind === 'back') click(1600, 0.35, 1.2);
    else {
      // The carriage sliding back, then the little bell.
      click(500, 0.6, 0.5);
      const bell = ctx.createOscillator();
      bell.frequency.value = 2093;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      bell.connect(g).connect(ctx.destination);
      bell.start(t + 0.05);
      bell.stop(t + 1);
    }
  } catch {
    // No sound on this device: typing carries on silently.
  }
}
