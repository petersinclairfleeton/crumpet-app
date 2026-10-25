// A series: books that share a series name (in each book's project.json).
// Its books share a bible: every book's characters and places, and its
// research, show in each of them (kept in the book that made them, and
// edited there from any of them), and names are spotted across all of them.

import type { CastMember, Note, Project } from './types';

/** The books in a book's series, in the order they're listed (the book itself included); just the book when it's in none. */
export function seriesBooks(projects: Project[], project: Project): Project[] {
  const name = project.series?.trim().toLowerCase();
  if (!name) return [project];
  return projects.filter((p) => p.series?.trim().toLowerCase() === name);
}

/** A character or place and the book it's kept in. */
export interface SeriesMember {
  member: CastMember;
  book: Project;
}

/** Characters and places from the series' other books (not this one's own), each once, in book order. */
export function seriesCast(projects: Project[], project: Project): SeriesMember[] {
  return seriesBooks(projects, project)
    .filter((p) => p.id !== project.id)
    .flatMap((book) => (book.cast ?? []).map((member) => ({ member, book })));
}

/** Every character and place a book can name: its own, then the rest of the series'. */
export function bookCast(projects: Project[], project: Project): CastMember[] {
  return [...(project.cast ?? []), ...seriesCast(projects, project).map((s) => s.member)];
}

/** The book a character or place is kept in (searching the series), with it. */
export function findMember(projects: Project[], project: Project, id: string): SeriesMember | null {
  for (const book of seriesBooks(projects, project)) {
    const member = book.cast?.find((m) => m.id === id);
    if (member) return { member, book };
  }
  return null;
}

/** Research notes kept in the series' other books. */
export function seriesResearch(notes: Note[], projects: Project[], project: Project): { note: Note; book: Project }[] {
  const others = seriesBooks(projects, project).filter((p) => p.id !== project.id);
  return others.flatMap((book) => notes.filter((n) => n.projectId === book.id && n.trashedAt === null).map((note) => ({ note, book })));
}

/** The series names in use, for choosing one. */
export function seriesNames(projects: Project[]): string[] {
  const seen = new Map<string, string>();
  for (const p of projects) {
    const n = p.series?.trim();
    if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** "Book 2 of 3 in The Lighthouse Trilogy" (by the order the books are listed). */
export function seriesLine(projects: Project[], project: Project): string {
  const books = seriesBooks(projects, project);
  const n = books.findIndex((p) => p.id === project.id) + 1;
  return books.length > 1 ? `Book ${n} of ${books.length} in ${project.series}` : `In ${project.series}`;
}
