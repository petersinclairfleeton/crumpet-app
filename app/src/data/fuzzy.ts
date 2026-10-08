// Loose matching for the quick switcher and command palette: the letters typed
// must appear in order ("lgh" finds "Lighthouse"), and matches at the start of
// words, in a row, or near the start score higher.

export interface Match {
  score: number;
  /** Which characters matched, for highlighting. */
  hits: number[];
}

const isWordStart = (text: string, i: number) => i === 0 || /[\s\-_/.:(“"']/.test(text[i - 1]) || (/[a-z]/.test(text[i - 1]) && /[A-Z]/.test(text[i]));

/** How well `query` matches `text`, or null when it doesn't. Spaces in the query match anywhere. */
export function fuzzy(query: string, text: string): Match | null {
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return { score: 0, hits: [] };
  const lower = text.toLowerCase();
  // Each space-separated part must match, in order.
  let from = 0;
  let score = 0;
  const hits: number[] = [];
  for (const part of q.split(' ')) {
    // A run of the whole part is best; otherwise letter by letter.
    const whole = lower.indexOf(part, from);
    if (whole >= 0) {
      score += 10 * part.length + (isWordStart(text, whole) ? 15 : 0) - Math.min(whole, 20) * 0.5;
      for (let k = 0; k < part.length; k++) hits.push(whole + k);
      from = whole + part.length;
      continue;
    }
    let prev = -2;
    for (const ch of part) {
      const at = lower.indexOf(ch, from);
      if (at < 0) return null;
      score += at === prev + 1 ? 6 : isWordStart(text, at) ? 5 : 1;
      hits.push(at);
      prev = at;
      from = at + 1;
    }
  }
  // Shorter texts win ties: "Salt" before "Salt and the sea".
  return { score: score - text.length * 0.05, hits };
}

/** Items that match, best first. */
export function rank<T>(query: string, items: T[], text: (t: T) => string): { item: T; match: Match }[] {
  const out: { item: T; match: Match; i: number }[] = [];
  items.forEach((item, i) => {
    const match = fuzzy(query, text(item));
    if (match) out.push({ item, match, i });
  });
  if (query.trim()) out.sort((a, b) => b.match.score - a.match.score || a.i - b.i);
  return out.map(({ item, match }) => ({ item, match }));
}
