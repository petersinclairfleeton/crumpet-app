// Notes as Markdown: what Crumpet writes to files people own.
//
// The Markdown is ordinary CommonMark/GFM so other apps can read it:
// headings, quotes, bulleted, numbered and task lists (nested with 4 spaces),
// **bold**, _italic_, ~~strike~~, `code`, [links](url), and <u>underline</u>,
// which plain Markdown has no syntax for. Two extra conventions keep round
// trips exact: an empty paragraph is written as `&nbsp;`, and whitespace at
// the start or end of a line is written as a character reference (`&#32;`).
//
// toMarkdown/fromMarkdown round-trip every document (apart from block ids,
// which files don't hold). The one thing that can change is formatting on
// spaces at the edge of a formatted stretch: `**bold **` isn't valid Markdown,
// so the space moves outside. Every line the writer produces is parsed back
// and checked; when the tidy form wouldn't read back the same (formatting
// inside a word, next to punctuation...), the line uses HTML tags instead,
// which always does.
//
// The parser also reads Markdown written elsewhere: `__strong__`, `*em*`,
// `<b>`/`<i>`/`<s>`, `+`/`*` bullets, 2-space nesting, `1)` lists, wrapped
// lines, fenced code and autolinks. Things Crumpet can't show yet (images,
// tables, other HTML) are kept as their literal text.

import { type Align, type Block, type BlockType, type Doc, type Mark, type Run, isList, makeBlock, normalizeRuns, tidyRows, sameFormat, withText, FOOTNOTE, type Comment, type CommentReply, commentId, type Change, sameChange, sortMarks, styleAllowed, BLOCK_STYLES } from './model';

// ---------------------------------------------------------------- writing

const INDENT = '    ';

export function toMarkdown(doc: Doc): string {
  const blocks = doc.blocks;
  if (blocks.length === 1 && blocks[0].type === 'paragraph' && !blocks[0].runs.length && !blocks[0].style && !blocks[0].align) return '';
  const counters: number[] = [];
  let out = '';
  let prev: Block | null = null;
  for (const b of blocks) {
    const list = isList(b.type);
    const level = list ? (b.indent ?? 0) : 0;
    // Numbering per level, restarting the way the editor shows it.
    if (b.type === 'numbered') {
      counters.length = level + 1;
      counters[level] = (counters[level] ?? 0) + 1;
    } else {
      counters.length = list ? level : 0;
    }
    // List items sit on consecutive lines; everything else is separated by a blank line.
    if (prev) out += list && isList(prev.type) ? '\n' : '\n\n';
    out += blockLine(b, counters[level] ?? 1);
    prev = b;
  }
  return out + '\n';
}

function blockLine(b: Block, number: number): string {
  // Tables are GitHub-style pipe tables; the first row is the header.
  if (b.type === 'table') {
    const rows = tidyRows(b.rows);
    const row = (cells: string[]) => `| ${cells.map((c) => c.replace(/([\\|])/g, '\\$1') || ' ').join(' | ')} |`.replace(/ {2,}\|/g, ' |');
    return [row(rows[0]), `|${rows[0].map(() => ' --- ').join('|')}|`, ...rows.slice(1).map(row)].join('\n');
  }
  // Pictures are Markdown images; attached files are links, each on a line of its own.
  if (b.type === 'image' || b.type === 'file') {
    const caption = runsPlain(b.runs).replace(/([\\\[\]])/g, '\\$1').replace(/\n/g, ' ');
    const line = `${b.type === 'image' ? '!' : ''}[${caption}](${linkTarget(b.src ?? '')})`;
    return b.align ? `${line} {.${b.align}}` : line;
  }
  // A scene break is Markdown's own section break.
  if (b.style === 'scenebreak' && !b.runs.length && !b.align) return '* * *';
  const text = protectBraces(inline(b.runs));
  const body = escapeLineStart(text);
  const pad = INDENT.repeat(b.indent ?? 0);
  const line = (() => {
    switch (b.type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'heading4':
        // A trailing run of #s would be read as the heading's closing sequence.
        return `${'#'.repeat(Number(b.type.slice(-1)))} ${text.replace(/#+$/, (s) => `\\${s}`)}`.trimEnd();
      case 'quote':
        return `> ${body}`.trimEnd();
      case 'bullet':
        return `${pad}- ${body}`.trimEnd();
      case 'numbered':
        return `${pad}${number}. ${body}`.trimEnd();
      case 'todo':
        return `${pad}- [${b.checked ? 'x' : ' '}] ${body}`.trimEnd();
      case 'paragraph':
      default:
        return text ? body : '&nbsp;';
    }
  })();
  // Styles and alignment Markdown has no syntax for go at the end of the line, as {.title .center}.
  const classes = [b.style, b.align, b.folded ? 'folded' : undefined].filter(Boolean);
  return classes.length ? `${line} {${classes.map((c) => `.${c}`).join(' ')}}` : line;
}

/** Links to other notes: `note:` and the note's title, written [[Title]] in Markdown. */
export const NOTE_LINK = 'note:';

export function noteLink(title: string): string {
  return NOTE_LINK + encodeURIComponent(title);
}

export function noteLinkTitle(link: string): string {
  try {
    return decodeURIComponent(link.slice(NOTE_LINK.length));
  } catch {
    return link.slice(NOTE_LINK.length);
  }
}

/** Files Crumpet keeps next to the notes (see the app's attachments). */
export const ATTACHMENTS_DIR = 'Attachments';

function isAttachment(href: string): boolean {
  return href.replace(/^<|>$/g, '').startsWith(`${ATTACHMENTS_DIR}/`);
}

function runsPlain(runs: Run[]): string {
  return runs.map((r) => r.text).join('');
}

const ALIGNS = new Set<string>(['left', 'center', 'right', 'justify']);
const KNOWN_STYLES = new Set<string>([...Object.values(BLOCK_STYLES).flat(), 'folded']);
const ATTRS = /^(.*?)[ \t]*(?<!\\)\{[ \t]*((?:\.[A-Za-z][\w-]*[ \t]*)+)\}[ \t]*$/;

/** Text ending in something that looks like {.attributes} gets its brace escaped. */
function protectBraces(text: string): string {
  // Only braces that would be read as {.attributes}; a comment or change ending the line ({>>…<<}) stays as it is.
  return /\{[ \t]*\.[^{}]*\}\s*$/.test(text) ? text.replace(/\{([^{}]*\}\s*)$/, '\\{$1') : text;
}

/** A line's trailing {.style .align}, if every class is one Crumpet knows. */
function splitAttrs(line: string): { line: string; classes: string[] } {
  const m = ATTRS.exec(line);
  if (!m) return { line, classes: [] };
  const classes = m[2].trim().split(/\s+/).map((c) => c.slice(1));
  if (!classes.every((c) => ALIGNS.has(c) || KNOWN_STYLES.has(c))) return { line, classes: [] };
  return { line: m[1], classes };
}

function applyAttrs(b: Block, classes: string[]): Block {
  for (const c of classes) {
    if (ALIGNS.has(c)) {
      if (c !== 'left') b.align = c as Align;
    } else if (c === 'folded' && b.type.startsWith('heading')) b.folded = true;
    else if (styleAllowed(b.type, c)) b.style = c;
  }
  return b;
}

/** Text that happens to start like a block marker gets that marker escaped. */
function escapeLineStart(text: string): string {
  if (/^(#{1,6}(\s|$)|[-+*](\s|$)|\d{1,9}[.)](\s|$)|-{2,}\s*$|={2,}\s*$)/.test(text)) {
    const m = /^\d+/.exec(text);
    return m ? `${m[0]}\\${text.slice(m[0].length)}` : `\\${text}`;
  }
  return text;
}

interface Style {
  open: Record<Mark, string>;
  close: Record<Mark, string>;
}

const markdownStyle = (italic: string): Style => ({
  open: { bold: '**', italic, underline: '<u>', strike: '~~', code: '' },
  close: { bold: '**', italic, underline: '</u>', strike: '~~', code: '' },
});
const TIDY: Style[] = [markdownStyle('_'), markdownStyle('*')];
const HTML: Style = {
  open: { bold: '<strong>', italic: '<em>', underline: '<u>', strike: '<s>', code: '' },
  close: { bold: '</strong>', italic: '</em>', underline: '</u>', strike: '</s>', code: '' },
};

/** Writes runs as inline Markdown, preferring tidy delimiters and falling back to HTML tags. */
function inline(runs: Run[]): string {
  if (!runs.length) return '';
  const tidy = spacesOutside(runs);
  for (const style of TIDY) {
    const out = edgeSpaces(writeRuns(tidy, style));
    if (sameRuns(parseInline(out), tidy)) return out;
  }
  return edgeSpaces(writeRuns(runs, HTML));
}

function escapeText(text: string): string {
  return text
    .replace(/[\\`*_~[\]<>]/g, (c) => `\\${c}`)
    .replace(/&(?=[a-zA-Z#][a-zA-Z0-9]*;)/g, '&amp;')
    .replace(/[\t\n\r]/g, (c) => `&#${c.charCodeAt(0)};`)
    .replace(/\{(?=[=+-]{2})/g, '\\{');
}

/** Whitespace at the start or end of a line would be dropped, so it's written as character references. */
function edgeSpaces(s: string): string {
  const ref = (w: string) => [...w].map((c) => `&#${c.codePointAt(0)};`).join('');
  return s.replace(/^\s+/, ref).replace(/\s+$/, ref);
}

function codeSpan(text: string): string {
  // A code span can't hold its own delimiter run, so use a longer one when needed.
  let ticks = '`';
  while (text.includes(ticks)) ticks += '`';
  // A space is added inside when the text starts or ends with a backtick, or
  // would otherwise lose a space at each end; readers strip one from each side.
  const pad = text.startsWith('`') || text.endsWith('`') || /^ .*[^ ].* $/.test(text) ? ' ' : '';
  return `${ticks}${pad}${text}${pad}${ticks}`;
}

const ENTITY_START = /&(?=[a-zA-Z#][a-zA-Z0-9]*;)/g;

function linkTarget(url: string): string {
  const u = url.replace(/\n/g, '%0A').replace(ENTITY_START, '&amp;');
  return !u || /[\s<>]/.test(u) ? `<${u.replace(/[\\<>]/g, '\\$&')}>` : u.replace(/[\\()]/g, '\\$&');
}

const FORMATTING: Mark[] = ['bold', 'italic', 'underline', 'strike'];

function formatting(r: Run): Mark[] {
  return FORMATTING.filter((m) => r.marks.includes(m));
}

/**
 * Writes runs with each mark opened and closed where it changes, nesting
 * properly. A mark that covers a whole link stays open around it.
 */
function writeRuns(runs: Run[], style: Style): string {
  let out = '';
  // Commented text is CriticMarkup: {==the text==}{>>the comment<<}{>>a reply<<}.
  for (let i = 0; i < runs.length; ) {
    const c = runs[i].comment;
    let j = i + 1;
    while (j < runs.length && runs[j].comment?.id === c?.id) j++;
    const part = writeChanges(runs.slice(i, j), style);
    out += c ? `{==${part}==}${commentMarkup(c)}` : part;
    i = j;
  }
  return out;
}

/** Tracked changes are CriticMarkup too: {++added++} and {--deleted--}, each followed by {>>who (when)<<}. */
function writeChanges(runs: Run[], style: Style): string {
  let out = '';
  for (let i = 0; i < runs.length; ) {
    const c = runs[i].change;
    let j = i + 1;
    while (j < runs.length && sameChange(runs[j].change, c)) j++;
    const part = writeFormatted(runs.slice(i, j), style);
    if (!c) out += part;
    else {
      const mark = c.kind === 'ins' ? '++' : '--';
      const who = c.author.replace(/[()]/g, '') || (c.at ? 'Someone' : '');
      out += `{${mark}${part}${mark}}${who ? `{>>${who} (${c.at ? commentTime(c.at) : 'undated'})<<}` : ''}`;
    }
    i = j;
  }
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** A time as written in a comment: 2026-10-07 09:32Z. */
function commentTime(at: number): string {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}Z`;
}

function commentMarkup(c: Comment): string {
  return [c, ...(c.replies ?? [])]
    .map((m) => {
      const who = m.author.replace(/[()]/g, '') || (m.at ? 'Someone' : '');
      const head = who ? `${who} (${m.at ? commentTime(m.at) : 'undated'}): ` : '';
      return `{>>${head}${m.text.replace(/\s+/g, ' ').replace(/<<\}/g, '<< }')}<<}`;
    })
    .join('');
}

/** A comment (or reply) as written: "Author (2026-10-07 09:32Z): text", or just text. */
function readCommentPart(raw: string): CommentReply {
  const m = /^([^()]*?) \((\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)Z\): ([\s\S]*)$/.exec(raw) ?? /^([^()]*?) \((undated)\)(): ([\s\S]*)$/.exec(raw);
  if (!m) return { author: '', at: 0, text: raw.trim() };
  if (m[2] === 'undated') return { author: m[1].trim(), at: 0, text: m[4].trim() };
  return { author: m[1].trim(), at: Date.UTC(+m[2], +m[3] - 1, +m[4], +m[5], +m[6]), text: m[7].trim() };
}

function writeFormatted(runs: Run[], style: Style): string {
  let out = '';
  const open: Mark[] = [];
  const moveTo = (want: Mark[]) => {
    let keep = 0;
    while (keep < open.length && want.includes(open[keep])) keep++;
    while (open.length > keep) out += style.close[open.pop()!];
    for (const m of want) {
      if (!open.includes(m)) {
        out += style.open[m];
        open.push(m);
      }
    }
  };
  const writeRun = (r: Run) => {
    moveTo(formatting(r));
    // A footnote is written in place, as ^[what it says].
    if (r.footnote !== undefined) out += `^[${escapeText(r.footnote.replace(/\s+/g, ' '))}]`;
    else out += r.marks.includes('code') ? codeSpan(r.text) : escapeText(r.text);
  };
  for (let i = 0; i < runs.length; ) {
    const link = runs[i].link;
    if (link === undefined) {
      writeRun(runs[i++]);
      continue;
    }
    let j = i;
    while (j < runs.length && runs[j].link === link) j++;
    const label = runs.slice(i, j);
    // A link to another note is a wiki link: [[Title]], or [[Title|what it says]].
    if (link.startsWith(NOTE_LINK)) {
      moveTo([]);
      const title = noteLinkTitle(link);
      const text = label.map((r) => r.text).join('');
      out += text === title ? `[[${title}]]` : `[[${title}|${text.replace(/\]\]/g, '] ]')}]]`;
      i = j;
      continue;
    }
    const shared = FORMATTING.filter((m) => label.every((r) => r.marks.includes(m)));
    moveTo(shared);
    out += '[';
    label.forEach(writeRun);
    moveTo(shared);
    out += `](${linkTarget(link)})`;
    i = j;
  }
  moveTo([]);
  return out;
}

/**
 * The same runs, but with whitespace next to a formatting change taking the
 * formatting shared by both sides, so delimiters always sit against text.
 * Line edges and the edges of a link's label count as edges.
 */
function spacesOutside(runs: Run[]): Run[] {
  const chars: Run[] = [];
  for (const r of runs) for (const ch of r.text) chars.push(withText(r, ch));
  const isSpace = (c: Run) => /^\s$/u.test(c.text) && !c.marks.includes('code');
  for (let i = 0; i < chars.length; ) {
    if (!isSpace(chars[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < chars.length && isSpace(chars[j]) && chars[j].link === chars[i].link && chars[j].comment?.id === chars[i].comment?.id && sameChange(chars[j].change, chars[i].change)) j++;
    // Spaces inside a link label stop at the label's edges; spaces outside can sit next to a link.
    const link = chars[i].link;
    const comment = chars[i].comment?.id;
    const change = chars[i].change;
    const reach = (c: Run | undefined) => (c && !isSpace(c) && (link === undefined || c.link === link) && (comment === undefined || c.comment?.id === comment) && sameChange(c.change, change) ? formatting(c) : []);
    const left = reach(chars[i - 1]);
    const right = reach(chars[j]);
    const marks = left.filter((m) => right.includes(m));
    for (let k = i; k < j; k++) chars[k] = { ...withText(chars[k], chars[k].text), marks };
    i = j;
  }
  return normalizeRuns(chars);
}

function sameRuns(a: Run[], b: Run[]): boolean {
  return a.length === b.length && a.every((r, i) => r.text === b[i].text && sameFormat(r, b[i]));
}

// ---------------------------------------------------------------- reading

/** Width of leading whitespace, with tabs to the next multiple of 4. */
function indentWidth(ws: string): number {
  let w = 0;
  for (const c of ws) w = c === '\t' ? w + 4 - (w % 4) : w + 1;
  return w;
}

const trimLine = (s: string) => s.replace(/^[ \t]+|[ \t]+$/g, '');

export function fromMarkdown(md: string): Doc {
  const lines = referenceFootnotes(md.replace(/\r\n?/g, '\n').split('\n'));
  const blocks: Block[] = [];
  let para: string[] = [];
  /** Indent widths of the open list levels, so 2- and 4-space nesting both work. */
  let listIndents: number[] = [];
  let fence: { char: string; length: number } | null = null;
  let lastWasQuote = false;

  let paraClasses: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(applyAttrs(withRuns(makeBlock('paragraph'), para.join(' ')), paraClasses));
    para = [];
    paraClasses = [];
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(raw);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      else blocks.push(raw ? { ...makeBlock('paragraph'), runs: [{ text: raw, marks: ['code'] }] } : makeBlock('paragraph'));
      continue;
    }
    const { line, classes } = splitAttrs(raw);
    const quoteLine = lastWasQuote;
    lastWasQuote = false;
    if (/^[ \t]*$/.test(line)) {
      flushPara();
      continue;
    }
    // A backtick fence's info string can't contain a backtick, so a line of code spans isn't a fence.
    const fenceOpen = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/.exec(line);
    if (fenceOpen) {
      flushPara();
      listIndents = [];
      fence = { char: fenceOpen[1][0], length: fenceOpen[1].length };
      continue;
    }
    if (/^ {0,3}&nbsp;[ \t]*$/.test(line)) {
      flushPara();
      listIndents = [];
      blocks.push(applyAttrs(makeBlock('paragraph'), classes));
      continue;
    }
    // A section break (* * *, ---, ___) is a scene break.
    if (/^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/.test(line)) {
      flushPara();
      listIndents = [];
      blocks.push(applyAttrs(makeBlock('paragraph', '', [], { style: 'scenebreak' }), classes));
      continue;
    }
    // A pipe table: a header row, then a row of dashes.
    if (!para.length && /^ {0,3}\|/.test(line) && li + 1 < lines.length && TABLE_RULE.test(lines[li + 1])) {
      flushPara();
      listIndents = [];
      const rows = [tableCells(line)];
      li++;
      while (li + 1 < lines.length && /^ {0,3}\|/.test(lines[li + 1])) rows.push(tableCells(lines[++li]));
      blocks.push(makeBlock('table', '', [], { rows: tidyRows(rows) }));
      continue;
    }
    // A picture, or a link to an attached file, alone on its line.
    const media = /^ {0,3}(!?)\[((?:\\.|[^\]\\])*)\]\(\s*(<(?:\\.|[^>\\])*>|(?:\\.|[^\s)\\])+)(?:\s+"[^"]*")?\s*\)[ \t]*$/.exec(line);
    if (media && !para.length && (media[1] || isAttachment(media[3]))) {
      flushPara();
      listIndents = [];
      const src = decodeEntities(media[3].replace(/^<|>$/g, '').replace(/\\(.)/g, '$1')).replace(/%0A/g, '\n');
      const caption = decodeEntities(media[2].replace(/\\(.)/g, '$1'));
      blocks.push(applyAttrs(makeBlock(media[1] ? 'image' : 'file', caption, [], { src }), classes));
      continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (heading) {
      flushPara();
      listIndents = [];
      const level = Math.min(heading[1].length, 4);
      blocks.push(applyAttrs(withRuns(makeBlock(`heading${level}` as BlockType), heading[2] ?? ''), classes));
      continue;
    }
    const quote = /^ {0,3}>[ \t]?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      listIndents = [];
      const prev = blocks[blocks.length - 1];
      // Consecutive quote lines are one quote.
      if (quoteLine && prev?.type === 'quote') applyAttrs(prev, classes), appendText(prev, trimLine(quote[1]));
      else blocks.push(applyAttrs(withRuns(makeBlock('quote'), trimLine(quote[1])), classes));
      lastWasQuote = true;
      continue;
    }
    const item = /^([ \t]*)([-*+]|\d{1,9}[.)])(?:[ \t]+(?:\[([ xX])\](?=[ \t]|$))?(.*)|[ \t]*)$/.exec(line);
    // Inside a paragraph, only a list starting at 1 interrupts it (so "2015. A good year" stays text).
    const startsList = item && !(para.length && /^\d/.test(item[2]) && !/^1[.)]$/.test(item[2]));
    if (item && startsList) {
      flushPara();
      const level = listLevel(listIndents, indentWidth(item[1]));
      const ordered = /^\d/.test(item[2]);
      const task = item[3] !== undefined;
      const type: BlockType = task ? 'todo' : ordered ? 'numbered' : 'bullet';
      const extra = { indent: level, ...(task ? { checked: item[3] !== ' ' } : {}) };
      blocks.push(applyAttrs(withRuns(makeBlock(type, '', [], extra), trimLine(item[4] ?? '')), classes));
      continue;
    }
    // A wrapped line that continues the list item above.
    const prev = blocks[blocks.length - 1];
    if (!para.length && listIndents.length && prev && isList(prev.type) && /^[ \t]+\S/.test(line)) {
      appendText(prev, trimLine(line));
      continue;
    }
    if (!para.length) listIndents = [];
    para.push(trimLine(line));
    if (classes.length) paraClasses = classes;
  }
  flushPara();
  return { blocks: blocks.length ? blocks : [makeBlock('paragraph')] };
}

/**
 * Footnotes written the other common way, [^1] in the text and "[^1]: what it
 * says" on a line of its own, turned into ^[what it says] in place.
 */
function referenceFootnotes(lines: string[]): string[] {
  const DEF = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/;
  if (!lines.some((l) => DEF.test(l))) return lines;
  const defs = new Map<string, string>();
  const rest: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = DEF.exec(lines[i]);
    if (!m) {
      rest.push(lines[i]);
      continue;
    }
    let text = m[2];
    // Indented lines below carry on the footnote.
    while (i + 1 < lines.length && /^( {4}|\t)\S/.test(lines[i + 1])) text += ` ${lines[++i].trim()}`;
    defs.set(m[1].toLowerCase(), text.trim());
  }
  return rest.map((l) =>
    l.replace(/(?<!\\)\[\^([^\]\s]+)\]/g, (all, label: string) => {
      const text = defs.get(label.toLowerCase());
      return text === undefined ? all : `^[${text.replace(/\\?([[\]])/g, '\\$1')}]`;
    }),
  );
}

const TABLE_RULE = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/** The cells of a table row: split on pipes, with \| and \\ read back as | and \. */
function tableCells(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && (body[i + 1] === '|' || body[i + 1] === '\\')) cur += body[++i];
    else if (c === '|') cells.push(cur.trim()), (cur = '');
    else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * The nesting level of a list item indented by `width`, updating the stack of
 * open levels. Steps of 4 or more spaces past the level above open several
 * levels at once, so Crumpet's own files (4 spaces a level) read back exactly.
 */
function listLevel(indents: number[], width: number): number {
  while (indents.length && width < indents[indents.length - 1]) indents.pop();
  const top = indents.length ? indents[indents.length - 1] : -1;
  if (width > top) {
    const steps = top < 0 ? Math.floor(width / 4) + 1 : Math.max(1, Math.floor((width - top) / 4));
    for (let s = steps - 1; s >= 0; s--) indents.push(width - s * 4);
  }
  return Math.min(indents.length - 1, 6);
}

function withRuns(b: Block, source: string): Block {
  b.runs = parseInline(source);
  return b;
}

function appendText(b: Block, source: string): void {
  b.runs = normalizeRuns([...b.runs, { text: ' ', marks: [] }, ...parseInline(source)]);
}

// ---- inline parsing: a compact version of CommonMark's delimiter algorithm ----

interface TextNode {
  kind: 'text';
  text: string;
  marks: Mark[];
  link?: string;
  footnote?: string;
}

interface Delim {
  kind: 'delim';
  char: '*' | '_' | '~';
  count: number;
  canOpen: boolean;
  canClose: boolean;
  /** The delimiter characters left over once matched ones are used up. */
  node: TextNode;
}

type Node = TextNode | Delim | { kind: 'mark'; mark: Mark; open: boolean } | { kind: 'link'; open: boolean; href?: string } | { kind: 'comment'; open: boolean; comment?: Comment } | { kind: 'change'; open: boolean; change?: Change };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : '�';
    }
    return ENTITIES[e] ?? m;
  });
}

const ESCAPABLE = /[!-/:-@[-`{-~]/;
const unescape = (s: string) => s.replace(/\\([!-/:-@[-`{-~])/g, '$1');

const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/u;

const TAGS: Record<string, Mark> = { b: 'bold', strong: 'bold', i: 'italic', em: 'italic', u: 'underline', s: 'strike', del: 'strike', strike: 'strike' };

export function parseInline(src: string): Run[] {
  const nodes = tokenize(src);
  processEmphasis(nodes);
  // Walk the nodes, keeping track of which marks and link are active.
  const active = new Map<Mark, number>();
  const links: string[] = [];
  const notes: Comment[] = [];
  const edits: Change[] = [];
  const runs: Run[] = [];
  for (const n of nodes) {
    if (n.kind === 'mark') {
      active.set(n.mark, Math.max(0, (active.get(n.mark) ?? 0) + (n.open ? 1 : -1)));
      continue;
    }
    if (n.kind === 'link') {
      if (n.open) links.push(n.href ?? '');
      else links.pop();
      continue;
    }
    if (n.kind === 'comment') {
      if (n.open) notes.push(n.comment!);
      else notes.pop();
      continue;
    }
    if (n.kind === 'change') {
      if (n.open) edits.push(n.change!);
      else edits.pop();
      continue;
    }
    const node = n.kind === 'delim' ? n.node : n;
    if (!node.text) continue;
    const marks = sortMarks([...node.marks, ...[...active.entries()].filter(([, c]) => c > 0).map(([m]) => m)]);
    const link = node.link ?? links[links.length - 1];
    const run: Run = link ? { text: node.text, marks, link } : { text: node.text, marks };
    if (node.footnote !== undefined) run.footnote = node.footnote;
    if (notes.length) run.comment = notes[notes.length - 1];
    if (edits.length) run.change = edits[edits.length - 1];
    runs.push(run);
  }
  return normalizeRuns(runs);
}

function tokenize(src: string): Node[] {
  const nodes: Node[] = [];
  let text = '';
  const flush = () => {
    if (text) nodes.push({ kind: 'text', text: decodeEntities(text), marks: [] });
    text = '';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length && ESCAPABLE.test(src[i + 1])) {
      // An escaped character is plain text (and not an entity start).
      flush();
      nodes.push({ kind: 'text', text: src[i + 1], marks: [] });
      i += 2;
      continue;
    }
    if (c === '`') {
      const run = /^`+/.exec(src.slice(i))![0];
      const close = findCodeClose(src, i + run.length, run.length);
      if (close >= 0) {
        flush();
        let code = src.slice(i + run.length, close).replace(/\n/g, ' ');
        if (/^ .*[^ ].* $/.test(code)) code = code.slice(1, -1);
        nodes.push({ kind: 'text', text: code, marks: ['code'] });
        i = close + run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    }
    if (c === '<') {
      const tag = /^<(\/?)(strong|b|em|i|u|s|del|strike)>/i.exec(src.slice(i));
      if (tag) {
        flush();
        nodes.push({ kind: 'mark', mark: TAGS[tag[2].toLowerCase()], open: !tag[1] });
        i += tag[0].length;
        continue;
      }
      const auto = /^<((?:https?|mailto):[^\s<>]+)>/i.exec(src.slice(i));
      if (auto) {
        flush();
        nodes.push({ kind: 'text', text: auto[1], marks: [], link: auto[1] });
        i += auto[0].length;
        continue;
      }
    }
    // A comment: {==the text==}{>>the comment<<}, and any replies after it.
    if (c === '{' && src.startsWith('{==', i)) {
      const close = src.indexOf('==}', i + 3);
      const parts: string[] = [];
      let k = close + 3;
      while (close >= 0 && src.startsWith('{>>', k)) {
        const end = src.indexOf('<<}', k + 3);
        if (end < 0) break;
        parts.push(src.slice(k + 3, end));
        k = end + 3;
      }
      if (parts.length) {
        flush();
        const [first, ...replies] = parts.map(readCommentPart);
        const comment: Comment = { id: commentId(first.author, first.at, first.text), ...first };
        if (replies.length) comment.replies = replies;
        nodes.push({ kind: 'comment', open: true, comment });
        nodes.push(...tokenize(src.slice(i + 3, close)));
        nodes.push({ kind: 'comment', open: false });
        i = k;
        continue;
      }
    }
    // A tracked change: {++added++} or {--deleted--}, with {>>who (when)<<} after it.
    if (c === '{' && (src.startsWith('{++', i) || src.startsWith('{--', i))) {
      const mark = src.slice(i + 1, i + 3);
      const close = src.indexOf(`${mark}}`, i + 3);
      if (close >= 0) {
        flush();
        let k = close + 3;
        let who: CommentReply = { author: '', at: 0, text: '' };
        const meta = src.startsWith('{>>', k) ? src.indexOf('<<}', k + 3) : -1;
        if (meta >= 0) {
          const read = readCommentPart(`${src.slice(k + 3, meta)}: `);
          if (!read.text && (read.author || read.at)) {
            who = read;
            k = meta + 3;
          }
        }
        const change: Change = { kind: mark === '++' ? 'ins' : 'del', author: who.author, at: who.at };
        nodes.push({ kind: 'change', open: true, change });
        nodes.push(...tokenize(src.slice(i + 3, close)));
        nodes.push({ kind: 'change', open: false });
        i = k;
        continue;
      }
    }
    // A footnote: ^[what it says].
    if (c === '^' && src[i + 1] === '[') {
      const end = closeBracket(src, i + 1);
      if (end > 0) {
        flush();
        const note = decodeEntities(unescape(src.slice(i + 2, end))).trim();
        nodes.push({ kind: 'text', text: FOOTNOTE, marks: [], footnote: note });
        i = end + 1;
        continue;
      }
    }
    if (c === '[' && src[i + 1] === '[') {
      const wiki = /^\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/.exec(src.slice(i));
      if (wiki) {
        flush();
        const title = wiki[1].trim();
        nodes.push({ kind: 'text', text: wiki[2] ?? title, marks: [], link: noteLink(title) });
        i += wiki[0].length;
        continue;
      }
    }
    if (c === '[') {
      const link = matchLink(src, i);
      if (link) {
        flush();
        nodes.push({ kind: 'link', open: true, href: link.href });
        nodes.push(...tokenize(link.label));
        nodes.push({ kind: 'link', open: false });
        i = link.end;
        continue;
      }
    }
    if (c === '*' || c === '_' || (c === '~' && src[i + 1] === '~')) {
      const run = (c === '~' ? /^~+/ : c === '*' ? /^\*+/ : /^_+/).exec(src.slice(i))![0];
      if (c === '~' && run.length !== 2) {
        text += run;
        i += run.length;
        continue;
      }
      flush();
      const before = i > 0 ? src[i - 1] : ' ';
      const after = i + run.length < src.length ? src[i + run.length] : ' ';
      const leftFlanking = !SPACE.test(after) && (!PUNCT.test(after) || SPACE.test(before) || PUNCT.test(before));
      const rightFlanking = !SPACE.test(before) && (!PUNCT.test(before) || SPACE.test(after) || PUNCT.test(after));
      const canOpen = c === '_' ? leftFlanking && (!rightFlanking || PUNCT.test(before)) : leftFlanking;
      const canClose = c === '_' ? rightFlanking && (!leftFlanking || PUNCT.test(after)) : rightFlanking;
      nodes.push({ kind: 'delim', char: c, count: run.length, canOpen, canClose, node: { kind: 'text', text: run, marks: [] } });
      i += run.length;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return nodes;
}

/** Where the ] matching the [ at `open` is (skipping escapes and nested brackets), or -1. */
function closeBracket(src: string, open: number): number {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === '[') depth++;
    else if (src[j] === ']' && --depth === 0) return j;
  }
  return -1;
}

function findCodeClose(src: string, from: number, len: number): number {
  let j = from;
  while (j < src.length) {
    const k = src.indexOf('`', j);
    if (k < 0) return -1;
    const run = /^`+/.exec(src.slice(k))![0];
    if (run.length === len) return k;
    j = k + run.length;
  }
  return -1;
}

/** `[label](href)` or `[label](<href with spaces>)`, with balanced brackets in the label. */
function matchLink(src: string, start: number): { label: string; href: string; end: number } | null {
  let depth = 0;
  let j = start;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '\\') {
      j++;
      continue;
    }
    if (ch === '`') {
      const run = /^`+/.exec(src.slice(j))![0];
      const close = findCodeClose(src, j + run.length, run.length);
      j = close >= 0 ? close + run.length - 1 : j + run.length - 1;
      continue;
    }
    if (ch === '[') depth++;
    if (ch === ']' && --depth === 0) break;
  }
  if (depth !== 0 || src[j + 1] !== '(') return null;
  const rest = src.slice(j + 2);
  const m = /^[ \t]*(?:<((?:[^<>\n\\]|\\.)*)>|((?:[^\s()\\]|\\.|\((?:[^\s()\\]|\\.)*\))*))(?:[ \t]+(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))?[ \t]*\)/.exec(rest);
  if (!m) return null;
  const href = decodeEntities(unescape(m[1] ?? m[2]));
  return { label: src.slice(start + 1, j), href, end: j + 2 + m[0].length };
}

/** CommonMark's "process emphasis": pairs openers and closers and turns them into marks. */
function processEmphasis(nodes: Node[]): void {
  for (let ci = 0; ci < nodes.length; ci++) {
    const closer = nodes[ci];
    if (closer.kind !== 'delim' || !closer.canClose || closer.count === 0) continue;
    for (let oi = ci - 1; oi >= 0 && closer.count > 0; oi--) {
      const opener = nodes[oi];
      if (opener.kind === 'link') {
        if (opener.open) break; // a closer inside a link label can't reach outside it
        // Skip over a whole link: emphasis can contain one.
        let depth = 0;
        for (; oi >= 0; oi--) {
          const n = nodes[oi];
          if (n.kind !== 'link') continue;
          depth += n.open ? -1 : 1;
          if (depth === 0) break;
        }
        continue;
      }
      if (opener.kind !== 'delim' || opener.char !== closer.char || !opener.canOpen || opener.count === 0) continue;
      // The "rule of 3": a delimiter that can both open and close doesn't pair
      // with one whose run lengths add up to a multiple of 3.
      if (closer.char !== '~' && (opener.canClose || closer.canOpen) && (opener.count + closer.count) % 3 === 0 && !(opener.count % 3 === 0 && closer.count % 3 === 0)) continue;
      const use = closer.char === '~' ? 2 : opener.count >= 2 && closer.count >= 2 ? 2 : 1;
      const mark: Mark = closer.char === '~' ? 'strike' : use === 2 ? 'bold' : 'italic';
      opener.count -= use;
      closer.count -= use;
      // Matched characters come off the inner side of each run.
      opener.node.text = opener.node.text.slice(use);
      closer.node.text = closer.node.text.slice(use);
      nodes.splice(oi + 1, 0, { kind: 'mark', mark, open: true });
      ci++;
      nodes.splice(ci, 0, { kind: 'mark', mark, open: false });
      ci++;
      // Delimiters between them can no longer match anything outside.
      for (let k = oi + 2; k < ci - 1; k++) {
        const n = nodes[k];
        if (n.kind === 'delim') n.canOpen = n.canClose = false;
      }
      oi = ci; // look again for an opener for whatever is left of this closer
    }
  }
}
