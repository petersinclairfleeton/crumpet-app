// Drawing maths (KaTeX) and diagrams (Mermaid) in the editor. Both are loaded
// only when first needed, so notes without them open as fast as before.

import { setCodeRenderer } from '@crumpet/editor/view';
import type { CodeLang } from '@crumpet/editor/model';

let katex: Promise<typeof import('katex')> | null = null;
let mermaid: Promise<typeof import('mermaid').default> | null = null;
let count = 0;

function loadKatex() {
  if (!katex) {
    katex = import('katex');
    void import('katex/dist/katex.min.css');
  }
  return katex;
}

function loadMermaid() {
  if (!mermaid)
    mermaid = import('mermaid').then((m) => {
      const dark = document.documentElement.matches('[data-theme="dark"], .dark') || matchMedia('(prefers-color-scheme: dark)').matches;
      m.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral', fontFamily: 'inherit' });
      return m.default;
    });
  return mermaid;
}

const showError = (out: HTMLElement, message: string) => {
  out.textContent = '';
  const p = document.createElement('div');
  p.className = 'code-error';
  p.textContent = message;
  out.appendChild(p);
};

/** Draws `text` into `out`; the newest drawing wins if several are on their way. */
export function renderCode(lang: CodeLang, text: string, out: HTMLElement): void {
  const ticket = String(++count);
  out.dataset.ticket = ticket;
  if (lang === 'canvas') {
    out.textContent = 'A board: it shows as cards and arrows in a note of its own.';
    return;
  }
  if (lang === 'math') {
    void loadKatex().then((k) => {
      if (out.dataset.ticket !== ticket) return;
      try {
        k.default.render(text, out, { displayMode: true, throwOnError: true, output: 'htmlAndMathml' });
      } catch (e) {
        showError(out, `This maths can’t be drawn yet: ${(e as Error).message.replace(/^KaTeX parse error: /, '')}`);
      }
    });
  } else {
    void loadMermaid().then(async (m) => {
      try {
        const { svg } = await m.render(`crumpet-diagram-${ticket}`, text);
        if (out.dataset.ticket !== ticket) return;
        out.innerHTML = svg;
      } catch (e) {
        if (out.dataset.ticket === ticket) showError(out, `This diagram can’t be drawn yet: ${(e as Error).message.split('\n')[0]}`);
        document.getElementById(`dcrumpet-diagram-${ticket}`)?.remove();
      }
    });
  }
}

setCodeRenderer(renderCode);
