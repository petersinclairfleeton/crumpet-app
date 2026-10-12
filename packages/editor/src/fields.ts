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

export function isField(name: string): boolean {
  return name in FIELDS;
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

/** The field a Word DATE or TIME instruction is closest to, or null for other fields. */
export function fieldFromWord(instr: string): string | null {
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
