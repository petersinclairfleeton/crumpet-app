// The web clipper: a bookmark ("Clip to Crumpet") that, clicked on any web
// page, opens Crumpet with that page (or just the part selected) ready to be
// saved as a note.
//
// The bookmark opens Crumpet at #clip. Crumpet says it's ready to its opener;
// the bookmark answers with the page's title, address and HTML. Short clips
// also travel in the address itself (#clip=…), for pages that cut the link
// between windows.

import { type Block, type BlockType, type Doc, type Mark, type Run, makeBlock, normalizeRuns, sortMarks, tidyRows } from '@crumpet/editor/model';
import { cellText, domRuns } from '@crumpet/editor/cells';

export interface Clip {
  title: string;
  url: string;
  html: string;
  /** Only the selected part of the page. */
  selection: boolean;
}

/** Clips longer than this go by message only, not in the address. */
const MAX_IN_URL = 6000;

/** The bookmark's code, for a Crumpet at `appUrl`. */
export function bookmarklet(appUrl: string): string {
  const code = `(function(){
var A=${JSON.stringify(appUrl)},O=new URL(A).origin,s=getSelection(),h='',sel=!!(s&&s.rangeCount&&!s.isCollapsed);
if(sel){var d=document.createElement('div');for(var i=0;i<s.rangeCount;i++)d.appendChild(s.getRangeAt(i).cloneContents());h=d.innerHTML}
else{var e=document.querySelector('article')||document.querySelector('main')||document.querySelector('[role=main]')||document.body;h=e.innerHTML}
var p={type:'crumpet-clip',title:document.title,url:location.href,html:h,selection:sel};
var j=JSON.stringify({title:p.title,url:p.url,html:h,selection:sel});
var w=window.open(A+'#clip'+(j.length<${MAX_IN_URL}?'='+encodeURIComponent(j):''),'_blank');
function f(m){if(m.source===w&&m.data&&m.data.type==='crumpet-ready'){w.postMessage(p,O);removeEventListener('message',f)}}
addEventListener('message',f);setTimeout(function(){removeEventListener('message',f)},60000)})();`;
  return `javascript:${encodeURIComponent(code.replace(/\n/g, ''))}`;
}

let pending: Clip | null = null;
const listeners = new Set<(c: Clip | null) => void>();

function deliver(c: Clip | null): void {
  pending = c;
  for (const fn of listeners) fn(c);
}

function isClip(x: unknown): x is Clip {
  const c = x as Clip;
  return !!c && typeof c.title === 'string' && typeof c.url === 'string' && typeof c.html === 'string';
}

/**
 * Started once, early: when Crumpet was opened by the bookmark, waits for the
 * clip (from the address, or a message from the page that opened it).
 */
export function startClipListener(): void {
  const hash = location.hash;
  if (!hash.startsWith('#clip')) return;
  const clear = () => history.replaceState(null, '', location.pathname + location.search);
  if (hash.startsWith('#clip=')) {
    try {
      const c = JSON.parse(decodeURIComponent(hash.slice(6)));
      if (isClip(c)) {
        clear();
        deliver({ ...c, selection: !!c.selection });
        return;
      }
    } catch {
      // Fall through to waiting for the message.
    }
  }
  const opener = window.opener as Window | null;
  if (!opener) return clear();
  let tries = 0;
  const ask = () => {
    try {
      opener.postMessage({ type: 'crumpet-ready' }, '*');
    } catch {
      // The opener went away.
    }
  };
  const timer = setInterval(() => {
    if (++tries > 40) {
      clearInterval(timer);
      window.removeEventListener('message', onMessage);
    } else ask();
  }, 250);
  const onMessage = (e: MessageEvent) => {
    // Only the page that opened this window, and only a clip.
    if (e.source !== opener || e.data?.type !== 'crumpet-clip' || !isClip(e.data)) return;
    clearInterval(timer);
    window.removeEventListener('message', onMessage);
    clear();
    deliver({ title: e.data.title, url: e.data.url, html: e.data.html, selection: !!e.data.selection });
  };
  window.addEventListener('message', onMessage);
  ask();
}

/** Calls `fn` with the clip waiting to be saved (now, and whenever one arrives). */
export function onClip(fn: (c: Clip | null) => void): () => void {
  listeners.add(fn);
  fn(pending);
  return () => listeners.delete(fn);
}

export function dismissClip(): void {
  deliver(null);
}

// ------------------------------------------------------------ HTML to a note

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'nav', 'footer', 'aside', 'form', 'button', 'select', 'input', 'textarea', 'svg', 'iframe', 'object', 'embed', 'canvas', 'dialog', 'menu', 'header']);
const BLOCKS = new Set(['p', 'div', 'section', 'article', 'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'figure', 'figcaption', 'hr', 'dl', 'dt', 'dd', 'address', 'details', 'summary']);
const MARKS: Record<string, Mark> = { b: 'bold', strong: 'bold', i: 'italic', em: 'italic', cite: 'italic', u: 'underline', ins: 'underline', s: 'strike', strike: 'strike', del: 'strike', code: 'code', kbd: 'code', samp: 'code', tt: 'code' };

/** A line break inside a paragraph, kept apart from ordinary spaces until the end. */
const LINE = '\u2028';

function absolute(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * A web page's HTML as a note: headings, paragraphs, lists, quotes, code,
 * tables and pictures (left on the web), with bold, italic, links and so on.
 */
export function htmlToDoc(html: string, base: string): Doc {
  const page = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  let runs: Run[] = [];
  let current: { type: BlockType; extra: Partial<Block> } = { type: 'paragraph', extra: {} };

  const flush = () => {
    const clean = normalizeRuns(
      runs.map((r) => ({ ...r, text: r.marks.includes('code') ? r.text : r.text.replace(/[ \t\r\n\f]+/g, ' ') })),
    );
    // Trim the paragraph's ends.
    while (clean.length && !clean[0].marks.includes('code') && /^\s/.test(clean[0].text)) {
      clean[0] = { ...clean[0], text: clean[0].text.replace(/^\s+/, '') };
      if (!clean[0].text) clean.shift();
    }
    while (clean.length && !clean[clean.length - 1].marks.includes('code') && /\s$/.test(clean[clean.length - 1].text)) {
      const last = clean.length - 1;
      clean[last] = { ...clean[last], text: clean[last].text.replace(/\s+$/, '') };
      if (!clean[last].text) clean.pop();
    }
    if (clean.length) blocks.push({ ...makeBlock(current.type, '', [], current.extra), runs: normalizeRuns(clean.map((r) => ({ ...r, text: r.text.replace(/ ?\u2028 ?/g, '\n') }))) });
    runs = [];
  };
  const start = (type: BlockType, extra: Partial<Block> = {}) => {
    flush();
    current = { type, extra };
  };

  const inline = (node: Node, marks: Mark[], link: string | undefined) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) runs.push(link ? { text, marks: sortMarks(marks), link } : { text, marks: sortMarks(marks) });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.localName;
    if (SKIP.has(tag) || el.getAttribute('aria-hidden') === 'true' || (el as HTMLElement).hidden) return;
    if (tag === 'br') {
      runs.push({ text: LINE, marks: [] });
      return;
    }
    if (tag === 'img') {
      const src = absolute(el.getAttribute('src') ?? el.getAttribute('data-src') ?? '', base);
      if (!src) return;
      const saved = current;
      flush();
      blocks.push(makeBlock('image', (el.getAttribute('alt') ?? '').trim(), [], { src }));
      current = saved;
      return;
    }
    if (BLOCKS.has(tag)) {
      block(el);
      return;
    }
    // Word's list bullets and numbers are written out as text; the list itself is what counts.
    if (/mso-list:\s*ignore/i.test(el.getAttribute('style') ?? '')) return;
    const style = (el.getAttribute('style') ?? '').toLowerCase();
    let here = [...marks];
    const add = (mk: Mark) => {
      if (!here.includes(mk)) here.push(mk);
    };
    const drop = (mk: Mark) => {
      here = here.filter((x) => x !== mk);
    };
    if (MARKS[tag]) add(MARKS[tag]);
    // Inline styles win (Google Docs wraps everything in <b style="font-weight:normal">).
    if (/font-weight:\s*(bold|[6-9]00)/.test(style)) add('bold');
    else if (/font-weight:\s*(normal|[1-5]00)/.test(style)) drop('bold');
    if (/font-style:\s*italic/.test(style)) add('italic');
    else if (/font-style:\s*normal/.test(style)) drop('italic');
    if (/text-decoration[^;]*underline/.test(style)) add('underline');
    if (/text-decoration[^;]*line-through/.test(style)) add('strike');
    const href = tag === 'a' ? absolute(el.getAttribute('href') ?? '', base) : null;
    for (const c of Array.from(el.childNodes)) inline(c, here, href ?? link);
  };

  const listDepth: ('bullet' | 'numbered')[] = [];
  const block = (el: Element) => {
    const tag = el.localName;
    if (SKIP.has(tag) || el.getAttribute('aria-hidden') === 'true' || (el as HTMLElement).hidden) return;
    const kids = () => {
      for (const c of Array.from(el.childNodes)) inline(c, [], undefined);
    };
    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        start(`heading${Math.min(4, Number(tag[1]))}` as BlockType);
        kids();
        start('paragraph');
        return;
      case 'ul':
      case 'ol':
        flush();
        listDepth.push(tag === 'ul' ? 'bullet' : 'numbered');
        for (const c of Array.from(el.children)) {
          if (c.localName === 'li') block(c);
          else if (c.localName === 'ul' || c.localName === 'ol') block(c);
        }
        listDepth.pop();
        start('paragraph');
        return;
      case 'li': {
        const type = listDepth[listDepth.length - 1] ?? 'bullet';
        const checkbox = el.querySelector(':scope > input[type=checkbox]') as HTMLInputElement | null;
        start(checkbox ? 'todo' : type, { indent: Math.min(6, Math.max(0, listDepth.length - 1)), ...(checkbox ? { checked: checkbox.checked || checkbox.hasAttribute('checked') } : {}) });
        for (const c of Array.from(el.childNodes)) {
          if (c.nodeType === Node.ELEMENT_NODE && ((c as Element).localName === 'ul' || (c as Element).localName === 'ol')) block(c as Element);
          else if (c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'p') {
            for (const g of Array.from(c.childNodes)) inline(g, [], undefined);
            runs.push({ text: ' ', marks: [] });
          } else inline(c, [], undefined);
        }
        start('paragraph');
        return;
      }
      case 'blockquote':
        start('quote');
        for (const c of Array.from(el.childNodes)) {
          if (c.nodeType === Node.ELEMENT_NODE && BLOCKS.has((c as Element).localName) && (c as Element).localName !== 'p') block(c as Element);
          else if (c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'p') {
            if (runs.length) runs.push({ text: LINE, marks: [] });
            for (const g of Array.from(c.childNodes)) inline(g, [], undefined);
            current = { type: 'quote', extra: {} };
          } else inline(c, [], undefined);
        }
        start('paragraph');
        return;
      case 'pre': {
        flush();
        // Code: a paragraph per line, in code style.
        for (const line of (el.textContent ?? '').replace(/\n$/, '').split('\n')) blocks.push(line ? { ...makeBlock('paragraph'), runs: [{ text: line, marks: ['code'] }] } : makeBlock('paragraph'));
        start('paragraph');
        return;
      }
      case 'table': {
        flush();
        const rows = Array.from((el as HTMLTableElement).rows ?? []).map((r) => Array.from(r.cells).map((c) => cellText(domRuns(c as HTMLElement)).replace(/\s+/g, ' ').trim()));
        if (rows.length) blocks.push(makeBlock('table', '', [], { rows: tidyRows(rows) }));
        start('paragraph');
        return;
      }
      case 'hr':
        flush();
        blocks.push(makeBlock('paragraph', '', [], { style: 'scenebreak' }));
        start('paragraph');
        return;
      case 'figcaption':
        start('paragraph', { style: 'caption' });
        kids();
        start('paragraph');
        return;
      default: {
        // A Word list item: a paragraph styled as a list, its bullet or number written out.
        const mso = /mso-list:\s*l\d+\s+level(\d+)/i.exec(el.getAttribute('style') ?? '');
        if (tag === 'p' && (mso || /MsoListParagraph/i.test(el.getAttribute('class') ?? ''))) {
          const marker = el.querySelector('[style*="mso-list"]')?.textContent ?? '';
          start(/\d|^[a-z]\.|^[ivx]+\./i.test(marker.trim()) ? 'numbered' : 'bullet', { indent: Math.min(6, Math.max(0, Number(mso?.[1] ?? 1) - 1)) });
          kids();
          start('paragraph');
          return;
        }
        // p, div, section…: their own paragraph(s).
        start('paragraph');
        kids();
        start('paragraph');
      }
    }
  };

  block(page.body);
  flush();
  // Paragraphs that are only spaces, and runs of empty lines, aren't wanted.
  const out = blocks.filter((b) => b.type !== 'paragraph' || b.runs.length || b.style);
  return { blocks: out.length ? out : [makeBlock('paragraph')] };
}

/** The note for a clip: a line saying where it came from, then the page. */
export function clipDoc(c: Clip): Doc {
  const body = htmlToDoc(c.html, c.url);
  let host = c.url;
  try {
    host = new URL(c.url).hostname.replace(/^www\./, '');
  } catch {
    // Keep the address as it is.
  }
  const source = makeBlock('paragraph', '', [], { style: 'caption' });
  source.runs = [
    { text: 'Clipped from ', marks: ['italic'] },
    { text: host, marks: ['italic'], link: c.url },
    { text: ` on ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`, marks: ['italic'] },
  ];
  return { blocks: [source, ...body.blocks] };
}
