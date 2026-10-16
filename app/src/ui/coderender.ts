// Drawing maths (KaTeX) and diagrams (Mermaid) in the editor. Both are loaded
// only when first needed, so notes without them open as fast as before.

import { setCodeRenderer, setMathImage } from '@crumpet/editor/view';
import { setModelLoader } from '@crumpet/editor/video';
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

// Equations within a line: KaTeX's MathML, measured on the page, then drawn
// as a picture (an SVG holding the MathML) so the editor can show it over the
// equation's one character without its words counting as text. MathML is
// drawn with the system's maths font, the same on the page and in the picture.
const pictures = new Map<string, { url: string; depth: number } | null>();
const waiting = new Map<string, (() => void)[]>();
let loaded: typeof import('katex') | null = null;

/** The MathML for some LaTeX (null if it can't be drawn). */
export function mathML(k: typeof import('katex'), tex: string, display = false): string | null {
  try {
    return k.default.renderToString(tex, { output: 'mathml', throwOnError: true, displayMode: display });
  } catch {
    return null;
  }
}

function makePicture(tex: string, size: number, color: string): { url: string; depth: number } | null {
  const html = loaded && mathML(loaded, tex);
  if (!html) return null;
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;left:-9999px;top:0;font-size:${size}px;color:${color};font-family:math, 'STIX Two Math', 'Cambria Math', serif;line-height:normal;white-space:nowrap`;
  box.innerHTML = html;
  const math = box.querySelector('math');
  if (!math) return null;
  // A zero-height mark on the baseline, to know how far the maths reaches below it.
  const base = document.createElement('span');
  base.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  box.appendChild(base);
  document.body.appendChild(box);
  const r = math.getBoundingClientRect();
  const b = base.getBoundingClientRect();
  box.remove();
  const w = Math.ceil(r.width) + 2;
  const h = Math.ceil(r.height) + 2;
  const depth = Math.max(0, Math.round(r.bottom - b.top)) + 1;
  const xml = new XMLSerializer().serializeToString(math);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${size}px;color:${color};font-family:math, 'STIX Two Math', 'Cambria Math', serif;line-height:normal;white-space:nowrap;padding:1px">${xml}</div></foreignObject></svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, depth };
}

setMathImage((tex, size, color, ready) => {
  const key = `${size}|${color}|${tex}`;
  if (pictures.has(key)) return pictures.get(key)!;
  if (!loaded) {
    const list = waiting.get(key) ?? [];
    list.push(ready);
    waiting.set(key, list);
    void loadKatex().then((k) => {
      loaded = k;
      const calls = [...waiting.values()].flat();
      waiting.clear();
      for (const f of new Set(calls)) f();
    });
    return null;
  }
  const pic = makePicture(tex, size, color);
  if (pictures.size > 500) pictures.clear();
  pictures.set(key, pic);
  return pic;
});

/** KaTeX, loaded (for the equation tools' previews and Word files). */
export const katexReady = loadKatex;

// 3D models: Google's model viewer (with three.js), loaded the first time a model is shown.
let viewer: Promise<unknown> | null = null;
setModelLoader(() => (viewer ??= import('@google/model-viewer')));
