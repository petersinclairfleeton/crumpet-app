// What's new in Crumpet: the latest first. The newest entry's id marks what
// a device has seen (settings.whatsNewSeen), so the Help menu can show a dot.

export interface WhatsNew {
  id: string;
  date: string;
  title: string;
  points: string[];
}

export const WHATS_NEW: WhatsNew[] = [
  {
    id: '2026-10-16-closer',
    date: '16 October 2026',
    title: 'Even quieter',
    points: [
      'More opens on a few everyday tools (font, colour and highlight, clear formatting, footnotes, tables, pictures, comments, track changes); All writing tools… shows the rest.',
      'A note’s corner keeps to the star and the ··· menu: Focus mode, Page view, Reading view and Add a reminder are in that menu, and Track changes is under More until it’s on.',
      'Ctrl/⌘+K opens Find anything, the window that finds notes, chapters and headings as you type; Search everything at the bottom lists every match, with filters.',
      'The right sidebar shows three tabs (Outline, Review and Links; or In this chapter, Outline and Review in a book), with the rest under More ▾.',
      'Settings has its sections down the left; Appearance shows four themes (More themes has the rest), and its Calm settings are on/off switches.',
      'A chapter opens centred, like a printed book: Chapter One, the title and a short honey line.',
      'Board cards are white with a small Text or Note label and titles in the book’s font; the Immersive reader’s tools sit in one pill at the top (Aa, Line focus, Syllables, Read aloud) with Done beside.',
    ],
  },
  {
    id: '2026-10-16-calm-bar',
    date: '16 October 2026',
    title: 'Five buttons, and the rest in groups',
    points: [
      'The formatting bar shows five everyday buttons: style, bold, italic, bullets and link. Everything else is under More, sorted into Text, Paragraph, Insert, Layout, References and Review.',
      'In page view those groups become menus of their own, like Word’s: Format, Insert, Layout, References and Review.',
      'Settings → Look → Calm: show every formatting tool, keep the right sidebar open, or reduce motion.',
      'The quick switcher (Ctrl/⌘+O) finds words inside notes and chapters too, groups what it finds (notes, your books, headings) and shows a line of each.',
      'Each note says when it was last edited, above its title.',
      'Export a book from its ••• menu: a manuscript for Word, an e-book, a PDF or another format, with or without chapters still To do, and a picture of page 1.',
      'The Graph shows a card for the note under the mouse, with zoom buttons in the corner; a board’s tools float at the bottom; the Immersive reader shows how far reading aloud has got and how long is left.',
      'A book’s Cards have Show ▾: choose whether each card shows its synopsis, status and keywords.',
      'On iPhone: the bar above the keyboard has Aa, bullets, a checklist, a picture and More; the library is in tidy groups, a book’s chapters are cards, and search has quick filters (Favourites, Pictures, Checklists, Files).',
      'On an iPad held upright, the right sidebar slides up from the bottom as a sheet.',
      'The first visit is a clean page with four ways to start, including Bring in your writing (Word, Markdown, text, PDFs and pictures).',
    ],
  },
  {
    id: '2026-10-16-quiet-paper',
    date: '16 October 2026',
    title: 'A calmer look: Quiet Paper',
    points: [
      'Notes now sit on warm paper, with titles in a book serif.',
      'The note you’re on is lifted onto paper with a small honey dot, instead of a ring round it.',
      'New note is the one honey button, so it’s easy to find.',
      'A tidier sidebar: Library, Projects and Notebooks; Recent notes, Writing stats and the Graph fold away under Explore.',
      'While you type, the bar above the note fades away; move the mouse and it’s back.',
      'Chapters open like a book’s: a honey “Chapter 1” above the title and a short line under it.',
      'In a book, the notes sidebar steps back to a strip of icons so the outline is your side panel, and the right sidebar’s new In this chapter tab shows who and where the chapter names.',
      'A friendlier first visit, warmer theme pictures in Settings → Look, and a roomier quick switcher (Ctrl/⌘+O).',
      'A book’s Cards are clean paper cards with a status dot; boards and the Immersive reader match the new look, and tick boxes and sliders are honey.',
      'On iPhone, notes in the list are paper cards with room between them, the title is bigger, and the back button says where it goes (‹ Notes, ‹ Outline).',
      'Corners, colours and shadows match all through the app, in light and dark.',
    ],
  },
  {
    id: '2026-10-16-tools',
    date: '16 October 2026',
    title: 'Macros, your own formatting bar, and help',
    points: [
      'Macros: record typing and formatting once (Macros ▾ → Record), then play it back anywhere, from the menu or with Alt+Shift and a number.',
      'Customise the formatting bar: choose which buttons show, which stay on the bar and which go under More.',
      'The ? button is now Help: the guide, this list of what’s new, and ways to get in touch.',
    ],
  },
  {
    id: '2026-10-16-draw',
    date: '16 October 2026',
    title: 'Drawing',
    points: ['Draw: a drawing in the text with pen, pencil, highlighter, eraser and lasso, with a finger, mouse or Apple Pencil. Ink to shape makes rough boxes and ovals neat; Replay draws it again.'],
  },
  {
    id: '2026-10-16-forms',
    date: '16 October 2026',
    title: 'Forms and spreadsheets',
    points: ['Form control: tick boxes, drop-down lists, date pickers and fill-in boxes; Protect document → Filling in forms.', 'Table → Spreadsheet: column letters, row numbers and sums.'],
  },
  {
    id: '2026-10-13-media',
    date: '13 October 2026',
    title: 'Charts, video, screenshots and equations',
    points: ['Charts of your numbers or a table’s, sent to Word as real charts.', 'YouTube and Vimeo videos play in the text; so do attached video and sound.', 'Screenshot: a picture of a window, tab or screen.', 'Equations in the line (Alt+=), with structures, symbols and UnicodeMath; Word gets real equations.'],
  },
  {
    id: '2026-10-13-protect',
    date: '13 October 2026',
    title: 'Protecting and checking',
    points: ['A note can be protected with a password; documents can be marked as final, restricted, or signed.', 'The Check tab: accessibility, Word compatibility, inspect, spelling, clarity and inclusive language.', 'More downloads: OpenDocument, Rich Text, web page and plain text; a print window with a preview.'],
  },
];

/** Whether there's news this device hasn't seen. */
export function hasNews(seen: string | undefined): boolean {
  return !!WHATS_NEW[0] && seen !== WHATS_NEW[0].id;
}
