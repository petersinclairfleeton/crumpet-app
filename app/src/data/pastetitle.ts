// Pasting a long piece into an empty note: does its first line look like a
// title? Short, not a sentence that runs on, with plenty of text after it.

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** True if `title`, the first line of something pasted, should become the note's title, with `rest` as its text. */
export function looksLikeTitle(title: string, rest: string, heading: boolean): boolean {
  const t = title.trim();
  if (!t || t.length > 120) return false;
  const n = words(t);
  if (n > 16) return false;
  // Enough after it to be a piece of writing, not a couple of lines.
  const restWords = words(rest);
  if (restWords < 25 || restWords < n * 3) return false;
  if (heading) return true;
  // A sentence or the start of one (ending in . , ; : or a dash), a list item, or a bare link isn't a title.
  if (/[.,;:–—-]$/.test(t) && !/\.\.\.$|…$/.test(t)) return false;
  if (/^([-*+•]\s|\d+[.)]\s|>)/.test(t)) return false;
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return false;
  return true;
}
