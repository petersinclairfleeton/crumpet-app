// Fields, like Word's: a spot in the text that shows something worked out
// when it's drawn, such as today's date. In the text a field is one FIELD
// character carrying the field's name; in Markdown it's {{name}}.

/** The fields Crumpet knows, with what they're called in menus. */
export const FIELDS: Record<string, string> = {
  date: 'Date (12 October 2026)',
  'date-full': 'Date with the day (Monday, 12 October 2026)',
  'date-short': 'Short date (12/10/2026)',
  'date-iso': 'Date as 2026-10-12',
  month: 'Month and year (October 2026)',
  time: 'Time (2:30 pm)',
  datetime: 'Date and time',
};

/** Fields about the document itself (Word's Quick Parts > Field), filled in by the editor and the app. */
export const DOC_FIELDS: Record<string, string> = {
  page: 'Page number',
  pages: 'Number of pages',
  words: 'Number of words',
  chars: 'Number of characters',
  title: 'Title',
  author: 'Author',
  created: 'Date created',
  saved: 'Date last saved',
};

/**
 * Fields with something after a colon: `seq:Figure` (a caption's number),
 * `bm:Name` (a bookmark: shows nothing), `ref:Name` or `ref:Name:text|page|dir`
 * (a cross-reference to a bookmark), `xe:Term` (an index entry: shows
 * nothing), `cite:key` (a citation of a source), `math:LaTeX` (an equation
 * within the line, drawn by the app's maths; `$`…`$` in Markdown), and form
 * controls (Word's content controls): `chk:0|1` a tick box, `drop:N:A|B|C` a
 * drop-down list (N the choice, -1 none), `pick:YYYY-MM-DD` a date picker
 * (empty: none yet), `fill:Prompt|What's typed` a fill-in box.
 */
const PARAM = /^(?:seq:[A-Za-z][\w ]{0,30}|bm:[A-Za-z_][\w-]{0,39}|ref:[A-Za-z_][\w-]{0,39}(?::(?:num|text|page|dir))?|xe:[^{}\n:][^{}\n]{0,99}|cite:[\w.:-]{1,60}|math:[^\n]{1,1000}|chk:[01]|drop:-?\d{1,3}:[^{}\n]{1,300}|pick:(?:\d{4}-\d\d-\d\d)?|fill:[^{}\n]{0,300})$/;

/** Breaks kept as fields: Word's Text Wrapping break (the text after it starts below any picture or shape it's wrapping round). */
export const BREAK_FIELDS: Record<string, string> = { wrapbreak: 'Text wrapping break' };

export function isField(name: string): boolean {
  return name in FIELDS || name in DOC_FIELDS || name in BREAK_FIELDS || PARAM.test(name);
}

/** What kind a field is. */
export function fieldKind(name: string): 'date' | 'doc' | 'break' | 'seq' | 'bm' | 'ref' | 'xe' | 'cite' | 'math' | 'form' | null {
  if (name in FIELDS) return 'date';
  if (name in BREAK_FIELDS) return 'break';
  if (name in DOC_FIELDS) return 'doc';
  if (/^(chk|drop|pick|fill):/.test(name)) return 'form';
  const k = /^(seq|bm|ref|xe|cite|math):/.exec(name)?.[1];
  return (k as 'seq' | 'bm' | 'ref' | 'xe' | 'cite' | 'math' | undefined) ?? null;
}

/** A field's name in words, for its tooltip. */
export function fieldLabel(name: string): string {
  if (FIELDS[name]) return `${FIELDS[name].replace(/ \(.*\)$/, '')}: updates by itself`;
  if (DOC_FIELDS[name]) return `${DOC_FIELDS[name]}: updates by itself`;
  if (BREAK_FIELDS[name]) return BREAK_FIELDS[name];
  const [kind, rest] = [name.slice(0, name.indexOf(':')), name.slice(name.indexOf(':') + 1)];
  if (kind === 'seq') return `${rest} number: counts up through the text`;
  if (kind === 'bm') return `Bookmark “${rest}”`;
  if (kind === 'ref') return `Cross-reference to “${rest.split(':')[0]}” (Ctrl+click to go there)`;
  if (kind === 'xe') return `Index entry: ${rest}`;
  if (kind === 'cite') return `Citation: ${rest}`;
  if (kind === 'math') return `Equation: ${rest} (click to edit)`;
  if (kind === 'form') return { chk: 'Tick box (click to tick)', drop: 'Drop-down list (click to choose)', pick: 'Date picker (click to pick a date)', fill: 'Fill-in box (click to type)' }[name.slice(0, name.indexOf(':'))] ?? 'Form control';
  return 'Field';
}

/** A form control's parts (see PARAM). */
export type FormControl =
  | { kind: 'chk'; checked: boolean }
  | { kind: 'drop'; chosen: number; choices: string[] }
  | { kind: 'pick'; date: string }
  | { kind: 'fill'; prompt: string; value: string };

export function readForm(name: string): FormControl | null {
  const [kind] = name.split(':', 1);
  const rest = name.slice(kind.length + 1);
  if (kind === 'chk') return { kind, checked: rest === '1' };
  if (kind === 'drop') {
    const at = rest.indexOf(':');
    return { kind, chosen: Number(rest.slice(0, at)), choices: rest.slice(at + 1).split('|') };
  }
  if (kind === 'pick') return { kind, date: rest };
  if (kind === 'fill') {
    const at = rest.indexOf('|');
    return { kind, prompt: at < 0 ? rest : rest.slice(0, at), value: at < 0 ? '' : rest.slice(at + 1) };
  }
  return null;
}

/** A form control's field name (choices and words tidied so they fit: no braces, bars or new lines). */
export function formName(f: FormControl): string {
  const clean = (s: string) => s.replace(/[{}|\n]/g, ' ').trim();
  if (f.kind === 'chk') return `chk:${f.checked ? 1 : 0}`;
  if (f.kind === 'drop') {
    const choices = f.choices.map(clean).filter(Boolean);
    return `drop:${f.chosen >= 0 && f.chosen < choices.length ? f.chosen : -1}:${(choices.length ? choices : ['Choice 1']).join('|')}`.slice(0, 310);
  }
  if (f.kind === 'pick') return `pick:${/^\d{4}-\d\d-\d\d$/.test(f.date) ? f.date : ''}`;
  return `fill:${clean(f.prompt) || 'Click to type'}|${f.value.replace(/[{}\n]/g, ' ')}`.slice(0, 305);
}

/** What a form control shows, and whether that's its prompt (shown faintly). */
export function formShown(f: FormControl): { text: string; prompt: boolean } {
  if (f.kind === 'chk') return { text: f.checked ? '☑' : '☐', prompt: false };
  if (f.kind === 'drop') return f.choices[f.chosen] !== undefined ? { text: f.choices[f.chosen], prompt: false } : { text: 'Choose an item', prompt: true };
  if (f.kind === 'pick') {
    if (!f.date) return { text: 'Pick a date', prompt: true };
    const d = new Date(`${f.date}T12:00:00`);
    return { text: Number.isNaN(d.getTime()) ? f.date : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), prompt: false };
  }
  return f.value ? { text: f.value, prompt: false } : { text: f.prompt || 'Click to type', prompt: true };
}

/** What a field shows now. */
export function fieldValue(name: string, now = new Date()): string {
  switch (name) {
    case 'date':
      return now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    case 'date-full':
      return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'date-short':
      return now.toLocaleDateString();
    case 'date-iso':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    case 'month':
      return now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    case 'time':
      return now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    case 'datetime':
      return now.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    default:
      return '';
  }
}

/** Word's DATE/TIME picture for each field, for Word files. */
export const WORD_PICTURES: Record<string, string> = {
  date: 'd MMMM yyyy',
  'date-full': 'dddd, d MMMM yyyy',
  'date-short': 'dd/MM/yyyy',
  'date-iso': 'yyyy-MM-dd',
  month: 'MMMM yyyy',
  time: 'h:mm am/pm',
  datetime: 'd MMM yyyy h:mm am/pm',
};

/** A field's instruction for Word (its field code). */
export function wordInstr(name: string): string {
  const kind = fieldKind(name);
  if (kind === 'date') {
    const pic = WORD_PICTURES[name];
    return pic ? ` ${name === 'time' ? 'TIME' : 'DATE'} \\@ "${pic}" ` : ' DATE ';
  }
  const DOC: Record<string, string> = { page: 'PAGE', pages: 'NUMPAGES', words: 'NUMWORDS', chars: 'NUMCHARS', title: 'TITLE', author: 'AUTHOR', created: 'CREATEDATE \\@ "d MMMM yyyy"', saved: 'SAVEDATE \\@ "d MMMM yyyy"' };
  if (kind === 'doc') return ` ${DOC[name]} `;
  const rest = name.slice(name.indexOf(':') + 1);
  if (kind === 'seq') return ` SEQ ${rest.replace(/ /g, '_')} \\* ARABIC `;
  if (kind === 'ref') {
    const [target, how] = rest.split(':');
    return how === 'page' ? ` PAGEREF ${target} \\h ` : how === 'dir' ? ` REF ${target} \\p \\h ` : ` REF ${target} \\h `;
  }
  if (kind === 'xe') return ` XE "${rest.replace(/"/g, '')}" `;
  return '';
}

/** The field a Word field instruction is: dates and times, page numbers and counts, captions' numbers, cross-references, index entries; null for others. */
export function fieldFromWord(instr: string): string | null {
  const word = /^\s*([A-Z]+)\b\s*(.*)$/is.exec(instr);
  if (word) {
    const [, code, args] = word;
    const DOC: Record<string, string> = { PAGE: 'page', NUMPAGES: 'pages', NUMWORDS: 'words', NUMCHARS: 'chars', TITLE: 'title', AUTHOR: 'author', CREATEDATE: 'created', SAVEDATE: 'saved' };
    const up = code.toUpperCase();
    if (DOC[up]) return DOC[up];
    const first = /^"([^"]*)"|^(\S+)/.exec(args.trim());
    const arg = first ? (first[1] ?? first[2]) : '';
    if (up === 'SEQ' && /^[A-Za-z]\w{0,30}$/.test(arg)) return `seq:${arg.replace(/_/g, ' ')}`;
    if ((up === 'REF' || up === 'PAGEREF') && /^[A-Za-z_][\w-]{0,39}$/.test(arg)) return `ref:${arg}${up === 'PAGEREF' ? ':page' : /\\p\b/.test(args) ? ':dir' : ''}`;
    if (up === 'XE' && arg && !/[{}\n]/.test(arg)) return `xe:${arg.slice(0, 100)}`;
  }
  const m = /^\s*(DATE|TIME|CREATEDATE|SAVEDATE|PRINTDATE)\b(?:.*?\\@\s*"([^"]*)")?/i.exec(instr);
  if (!m || !/^(DATE|TIME)$/i.test(m[1])) return null;
  const pic = m[2]?.trim();
  if (!pic) return m[1].toUpperCase() === 'TIME' ? 'time' : 'date-short';
  const found = Object.entries(WORD_PICTURES).find(([, p]) => p === pic);
  if (found) return found[0];
  const hasDate = /[dMy]/.test(pic);
  const hasTime = /[Hhm](?![a-z]*M)/.test(pic.replace(/M+/g, ''));
  if (hasDate && hasTime) return 'datetime';
  if (hasTime) return 'time';
  if (/dddd/.test(pic)) return 'date-full';
  if (/MMMM/.test(pic) && !/d/.test(pic)) return 'month';
  if (/MMM/.test(pic)) return 'date';
  if (/^y+-M+-d+$/.test(pic)) return 'date-iso';
  return 'date-short';
}
