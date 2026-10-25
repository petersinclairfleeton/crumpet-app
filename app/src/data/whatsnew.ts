// What's new in Crumpet: the latest first. The newest entry's id marks what
// a device has seen (settings.whatsNewSeen), so the Help menu can mark it New.

export interface WhatsNew {
  id: string;
  date: string;
  title: string;
  points: string[];
}

export const WHATS_NEW: WhatsNew[] = [
  {
    id: '2026-10-26-plan',
    date: '26 October 2026',
    title: 'Plan a book: timeline, plotlines and structure',
    points: [
      'A book’s outline has a new view, Plan (beside Write, Cards and Read), with three tabs.',
      'Timeline: what happens when in the story, as events at a date (1912-04-14 23:40) or a day of the story (Day 3, Day 3 14:30), each told in a chapter, on a plotline, with who’s there. See them in lanes by plotline or by character; Add the chapters starts it from your chapters; and it warns when a character is in two places at once.',
      'Plotlines: a grid of your chapters and the threads of the story. Say in a line what each thread does in each chapter, and see how much of the book it runs through and where it goes quiet.',
      'Structure: choose three acts, Save the Cat, the hero’s journey, seven points, the story circle or kishōtenketsu. Each beat is placed in the chapter where it falls by words written, with a note when a turn comes much earlier or later than expected. A new book can start with a chapter for each beat.',
    ],
  },
  {
    id: '2026-10-26-sprints',
    date: '26 October 2026',
    title: 'Writing sprints',
    points: [
      'Write against the clock: pick 10, 15, 20, 25, 30, 45 or 60 minutes in the Writing tab beside your text (or in Writing stats, or the command palette) and start. A small bar at the foot of the window counts down and counts the words you write, with Pause and Stop.',
      'When the time’s up, a soft chime and what you wrote: “412 words in 25 minutes · 16 a minute”, with Another to go again. Your sprints are kept, with your best.',
      'A sprint carries on if you reload, and counts the words in every note and chapter you write in while it runs.',
    ],
  },
  {
    id: '2026-10-26-week-month-goals',
    date: '26 October 2026',
    title: 'Weekly and monthly goals, and days off',
    points: [
      'Writing stats (in the sidebar’s ⚙ menu) now has a goal for the week and for the month as well as the day: 50,000 words for November, say. Each shows what’s left and about how many words a day will get you there.',
      'Mark your days off (Sundays, say): they don’t break your streak, and the words a day leave them out. They show dashed in the calendar.',
      'The Writing tab beside your text shows the week’s and the month’s progress too.',
    ],
  },
  {
    id: '2026-10-25-phone-size-preview-syncing',
    date: '25 October 2026',
    title: 'Text size and page preview on your phone, and “Syncing…”',
    points: [
      'On a phone, pinch the writing with two fingers to make the text bigger or smaller, or use Text size (A− and A+) in the ··· menu of a note or chapter. Each device keeps its own size, so your phone can be bigger than your computer.',
      'Preview pages, in the same menu, shows how a note or chapter falls on pages: fitted to the screen, or at actual size. Print… goes on to print it or save a PDF.',
      'While changes are on their way to Google Drive or your folder, “Syncing…” shows (at the top on a phone, at the foot of the window on a computer when the sidebar is folded away), then “Synced” for a moment, so you know when it’s safe to close.',
    ],
  },
  {
    id: '2026-10-25-phone-writing',
    date: '25 October 2026',
    title: 'Writing on your phone',
    points: [
      'On a phone, notes and chapters are always flowing text at a comfortable size, never a whole page shrunk to the screen. Page view is still there on a computer or an iPad.',
      'Chapters on a phone are written in your writing font and size, like notes, and so is the book’s Read view.',
      'Tap the empty space below your writing to carry on where it ends; the keyboard comes up ready.',
      'Right-click a character, a place or a research note in a book to open it here, in a new tab or beside, rename it, or take it out (a character can become a place and back).',
      'A note’s picture in the note list now has its own shape: wide pictures get a wider box, tall ones a narrower one.',
    ],
  },
  {
    id: '2026-10-23-more-right-click',
    date: '23 October 2026',
    title: 'More in the right-click menu, and a warning before closing mid-sync',
    points: [
      'In your writing, the menu starts with Bold, Italic, Underline and Strikethrough buttons, and has Font…, Paragraph… and Clear formatting.',
      'Right-click a table cell to insert a row above or below, a column left or right, merge or split cells, or delete a row, a column or the table.',
      'Right-click a chapter in a book’s outline to open it (here, in a new tab or beside), rename it, set its status, add a chapter after it, or move it up or down. Parts have Rename, New chapter, Move and Remove.',
      'Closing the tab (or the Mac app) before your latest changes have reached Google Drive or your folder now asks first, and starts the sync straight away, so waiting a moment lets it finish.',
      'Fixed: a long note title sometimes lost its last line when the window or the sidebar changed width. And a note’s picture in the note list now shows whole, not cropped, with the note’s title stopping short of it.',
    ],
  },
  {
    id: '2026-10-20-right-click',
    date: '20 October 2026',
    title: 'Right-click anywhere',
    points: [
      'Right-click in your writing for Crumpet’s own menu: spelling suggestions for a word it doesn’t know (with Add to dictionary and Ignore all), Cut, Copy, Paste, Paste text only, Link…, New comment, Look up, Undo and Redo.',
      'Right-click a link to open or copy it, a picture to copy or save it, a chapter or card to open it in a new tab or beside, and a text box for cut, copy and paste. Anywhere else gives New note, Find anything, All commands, Settings and the guide.',
    ],
  },
  {
    id: '2026-10-20-draft-progress',
    date: '20 October 2026',
    title: 'How far each draft has come',
    points: [
      'Under a chapter’s draft tabs, a line compares the draft with the one before: “4,120 words · 380 fewer than Draft 1 · 34% rewritten”. A draft’s ⌄ menu → Compare with Draft 1 shows every word added and taken out.',
      'The outline does the same for the whole book, under the book’s draft.',
      'Snapshots and the versions kept as you write belong to each draft, and a snapshot’s Make it a new draft starts a draft from it.',
    ],
  },
  {
    id: '2026-10-20-linked-notes',
    date: '20 October 2026',
    title: 'Link your notes into a book',
    points: [
      'A book’s Research can now show notes from your notebooks as well as its own: Research’s + → Link a note…, or right-click a note → Link to a book…. A linked note stays in its notebook, so your general notes and the book’s own notes sit together without moving or copying anything.',
      'Linked notes are marked with a link, open beside the chapter like research, and Unlink from this book (in its ··· menu) takes it out of the book again.',
      'Fixed: the + menus under Characters & places and Research, at the foot of a book’s outline, were cut off.',
    ],
  },
  {
    id: '2026-10-20-book-drafts',
    date: '20 October 2026',
    title: 'A second draft of the whole book',
    points: [
      'The book’s ··· menu → New draft of the book… starts Draft 2 (or 3, or 4) in every chapter at once: copies to revise, or blank pages to write again. Give it a note on what it’s for (“Bring the wreck in early”) and the outline shows it under the book’s name; click it to change it.',
      'A draft’s ⌄ menu → Open beside puts an older draft next to the one you’re writing, scrolling together, to look back at while you rewrite.',
    ],
  },
  {
    id: '2026-10-20-chapter-drafts',
    date: '20 October 2026',
    title: 'Drafts of a chapter',
    points: [
      'Rewrite a chapter and keep what you had: the chapter’s ··· menu → New draft… starts Draft 2, as a copy to revise or a blank page to write again.',
      'Tabs above the chapter switch between its drafts, and you can still write in any of them. The dot marks the one your book uses (for Read, printing and export); “Use Draft 1 instead” goes back. The outline shows a small D2 on chapters that have moved on.',
      'Each draft can have a name and a note on what it’s for. In your synced folder, drafts the book isn’t using are in the book’s Drafts folder, one folder per draft.',
    ],
  },
  {
    id: '2026-10-19-mcp',
    date: '19 October 2026',
    title: 'Your notes, with Claude and other AIs',
    points: [
      'Claude can now search and read your notes, notebooks, tags and books (chapters in order, characters and places, research), and write new notes for you: “What have I written about Rome?”, “Summarise chapter 3”, “Make a packing list in Travel”. It never changes or deletes what you’ve written, and locked notes stay locked.',
      'Settings → Clipper and Mac app → Add to Claude downloads it for Claude for desktop; open the file, and choose the folder Crumpet syncs to. Notes Claude writes come into Crumpet at its next sync.',
      'Other AI apps that support MCP (ChatGPT, Gemini, Cursor and more) can use the same server.',
    ],
  },
  {
    id: '2026-10-19-paste-title',
    date: '19 October 2026',
    title: 'Pasted writing finds its title',
    points: [
      'Paste a long piece (an article, a story, a chapter) into a new, empty note and its first line becomes the note’s title, with the rest as its text. It happens only when that line looks like a title: short, not a sentence ending in a full stop, with plenty of writing after it. Chapters do the same.',
      'Not wanted? The 📋 button beside the pasted text has Keep the first line in the text.',
      'Pasting several lines into an empty title box keeps the first line there and sends the rest into the note.',
    ],
  },
  {
    id: '2026-10-19-indents-zoom',
    date: '19 October 2026',
    title: 'Indents you can change, and zoom that works',
    points: [
      'In a book, Backspace at the start of an indented line takes its indent away (as in Word), and Tab puts it back. Setting Special to None in the Paragraph window, or dragging the ruler’s first-line marker to the margin, now sticks too: before, the book’s style put the indent straight back.',
      'Page view’s − and + zoom the pages with One page chosen too (they used to change the number and nothing else), and from Fit they step from the size the page is shown at.',
    ],
  },
  {
    id: '2026-10-17-phone-book',
    date: '17 October 2026',
    title: 'A book on a phone, all of a piece',
    points: [
      'In a book on a phone, Cast and Research are rows like the library’s, under a heading with its own +, instead of small lists that folded away.',
      'The round + adds a chapter and shows only under Chapters (under Cast it used to add a chapter you couldn’t see).',
      'Chapters, Cast and Research share the switch evenly, and the book’s ··· menu says Rename book and Delete book.',
    ],
  },
  {
    id: '2026-10-17-phone-settings',
    date: '17 October 2026',
    title: 'Settings on a phone, like an iPhone’s',
    points: [
      'On a phone, Settings opens on a list of its sections (Appearance shows your theme, Account your name); tap one for a page of its own, with ‹ Settings to go back and Done to close.',
      'Choices that do nothing on a phone aren’t offered there: the inspector, the computer’s formatting bar, a folder on the computer, and dragging the clipper to a bookmarks bar (the phone’s way to add it comes first instead).',
      'Rows fit the screen: a menu, a name box or a button sits under its words, and the four themes fit on one row.',
    ],
  },
  {
    id: '2026-10-17-phone-library',
    date: '17 October 2026',
    title: 'The library on a phone, like the computer’s',
    points: [
      'On a phone the library has the same groups as the computer’s sidebar, in the same order: Capture (Inbox and Today), Library (All notes and Favourites), Notebooks and Writing, with + beside Writing for a new book.',
      'Tags are a row of chips, as in Apple’s Notes, and Graph of links and Trash are at the foot; nothing waits behind More any more.',
      'A list’s back button says where it goes (‹ Crumpet), its ··· menu is just Sort by (a phone shows notes as cards), Cancel is plain words, and the round + steps aside while you search.',
    ],
  },
  {
    id: '2026-10-17-phone-writing',
    date: '17 October 2026',
    title: 'Writing on a phone, calmer and fixed',
    points: [
      'Above the keyboard, Aa and ··· now open their menus as a panel just above the bar (they were opening out of sight), and the bar’s few tools are spread evenly.',
      'Aa offers the styles a writer reaches for (Normal, Title, three headings, Quote and Scene Break) instead of Word’s whole gallery.',
      'A note’s ··· menu on a phone is shorter and reads like an iPhone’s: the words first and the icon at the end. The six download formats wait behind Download a copy…, and Page view, Focus mode and Save as template stay on the computer.',
      'A chapter’s ··· menu on a phone no longer offers the inspector (a phone has no room for it) or Focus mode, and keyboard shortcuts aren’t shown on touch screens.',
    ],
  },
  {
    id: '2026-10-17-book-calm',
    date: '17 October 2026',
    title: 'Books, with less on screen',
    points: [
      'The outline no longer has a colour key at its foot: rest the mouse on a chapter’s dot to see its status, or look at the top of the chapter.',
      'The top of a chapter reads “Draft · 157 words”, without the gap after the status.',
      'Cards has one way to add a chapter, the card at the end, and no how-to line under the Show choices.',
      'The inspector’s tabs fit on one line: the panel button at the top of a note or chapter opens and closes it, so it no longer has a second close button of its own (it keeps one as a drawer on smaller screens).',
      'Read’s zoom reads − 100% +, and One page and Two pages are one switch. Tick boxes are ink, like switches.',
    ],
  },
  {
    id: '2026-10-17-one-voice',
    date: '17 October 2026',
    title: 'One voice, everywhere',
    points: [
      'Headings in the sidebar, the list, Find, menus and the side panels are written normally (“Today”, “Library”, “Notes”) instead of in small capitals, as on a Mac or an iPhone. Capitals stay only where a book uses them, above a chapter’s title.',
      'Every drop-down has the same thin arrow, and the rows of the More menu line up with their headings.',
      'A button’s name no longer covers the menu it has just opened, and the settings menu is plain words, like every other menu.',
      'No red dot on the settings button: What’s new is marked New in its menu instead. Links are quiet text, underlined only when you point at them.',
    ],
  },
  {
    id: '2026-10-17-settings-calm',
    date: '17 October 2026',
    title: 'Settings, all of a piece',
    points: [
      'Every page of Settings now looks and works the same way: a short heading for each group, then one row per setting with a line about it, and its switch, menu or button at the end.',
      'Writing’s typewriter, AutoCorrect and spelling options are switches, each with a plain example (“teh becomes the”), and the spelling language is a proper menu.',
      'Sync and storage offers two clear choices, Google Drive or a folder on this computer, each with one button.',
      'Each setting is in one place only: Show every formatting tool is under Formatting bar, and the inspector’s switch under Appearance. Switches that are on are ink-coloured, so honey is kept for the one main thing on each screen.',
    ],
  },
  {
    id: '2026-10-17-paper-phone',
    date: '17 October 2026',
    title: 'Paper and ink on a phone, fixed',
    points: [
      'With the Paper and ink theme, the phone now has the same tidy layout as the other themes: chapters in a book are neat rows again, and the back buttons say where they go (Notes, Crumpet, Outline).',
      'On a phone a chapter opens as plain writing, like a note, instead of a small printed page; its status, word count, goal, synopsis and page view are in its ··· menu.',
      'In dark mode the phone’s rows and screens now take each theme’s own dark colours, so their words are easy to read in Paper and ink, Classic, Vapor, Console, Desktop, Sepia and Midnight.',
    ],
  },
  {
    id: '2026-10-17-ink-editing',
    date: '17 October 2026',
    title: 'Edit with ink',
    points: [
      'More → Edit with ink lets you edit by drawing over the text, with a finger, a pen or the mouse, like Word’s ink editor.',
      'Strike a line through words, or scribble over them, to delete them (tracked when Track changes is on). Circle words to select them. Draw a line down to start a new paragraph there, or a ^ under the gap between two words to put the cursor there and type.',
      'Undo on the bar takes the last one back; Done (or Esc) puts the pen away. Handwriting isn’t read, so you type what you add.',
    ],
  },
  {
    id: '2026-10-17-export-included',
    date: '17 October 2026',
    title: 'Exporting a book: a title page, parts, and a clean copy',
    points: [
      'Export (in a book’s ··· menu) can start with a title page: the book’s name, your name and about how many words.',
      'Each part of the book can have a page of its own before its chapters.',
      'Comments and tracked changes are left out unless you tick them: the export reads as if every change were accepted. Your book itself isn’t changed.',
    ],
  },
  {
    id: '2026-10-16-quiet-paper-ipad',
    date: '16 October 2026',
    title: 'Quiet Paper on an iPad',
    points: [
      'On an iPad the formatting tools float in a small bar at the foot of the page: Aa for styles, a checklist, bullets, Draw for the pencil, a picture, and ··· for the rest.',
      'The list has its own search box under the title, and New note sits at the foot of the sidebar.',
      'Held upright (or in any narrower window), a chapter has the whole window: the top shows the book and the chapter, and the chapter’s name opens a list of every chapter to jump to. The sidebar button brings the outline out beside it.',
      'The chapter’s status, words, page view and the inspector are in its ··· menu; the inspector (who’s in the chapter, notes, comments) comes up as a drawer at the foot.',
    ],
  },
  {
    id: '2026-10-16-quiet-paper-iphone',
    date: '16 October 2026',
    title: 'Quiet Paper on an iPhone',
    points: [
      'Crumpet on an iPhone opens on your library, like Apple’s Notes: Capture (Inbox, All notes, Favourites), your notebooks and your books as grouped rows, with tags, the graph and the Trash under More. The bar of tabs along the bottom has gone.',
      'Each list has a back arrow, a big title and its search box; searching moves the box to the top with Cancel beside it, and the round + makes a new note.',
      'A note has Share and ··· at the top; its notebook and tags, and adding it to Favourites, are in the ··· menu.',
      'A book shows its words against the goal, then Chapters, Cast and Research side by side, each chapter a card with its synopsis; the + adds a chapter.',
      'Prefer the old phone layout? Settings → Formatting bar → Show every formatting tool brings back the tabs.',
    ],
  },
  {
    id: '2026-10-16-quiet-paper-whole-window',
    date: '16 October 2026',
    title: 'Quiet Paper: the whole window',
    points: [
      'The Graph has the window beside the slim strip: All notes, Near the open note or Two links away as chips, the open note a honey dot with its links in honey. Anything on the strip leaves it.',
      'A board has the window to itself, its name and card count on a small floating card with a way back to your notes.',
      'A note in page view has the whole window, its name in the bar; the foot has One page and Two pages, and the zoom as − % +.',
      'The Immersive reader shows the chapter’s number and title above the text.',
      'Export, from a book, opens over the whole window again.',
    ],
  },
  {
    id: '2026-10-16-quiet-paper-settings',
    date: '16 October 2026',
    title: 'Quiet Paper: Settings, Find and a first visit',
    points: [
      'Settings opens on Appearance: four themes as pictures, the accent, the writing font and text size, and switches. Its sections run down the left: Writing, Formatting bar, Sync and storage, Account, Clipper and Mac app, and Advanced at the foot.',
      'The new Formatting bar section floats the tools over selected text, or keeps them at the top, and opens Customise the bar.',
      'Find anything (Ctrl/⌘+K) shows each result with its icon, a book’s name over its chapters, and offers a new note called what you typed.',
      'A first visit is quieter: New note and All notes in the sidebar, and three ways to start.',
      '“Saved on this device” and Fix… open Settings straight at Sync and storage.',
    ],
  },
  {
    id: '2026-10-16-quiet-paper-books',
    date: '16 October 2026',
    title: 'Quiet Paper: books',
    points: [
      'In a book the outline is the sidebar: the back arrow to your notes, Write, Cards and Read, the words against your goal, one line a chapter, and Characters & places and Research at its foot.',
      'A chapter opens as plain writing in your writing font, its status and words at the top, its tools over the words you select. Page view (in manuscript format) is the page button beside it.',
      'The inspector (the panel button) shows the characters and places the chapter names, the book’s notes and the comments.',
      'Cards has a heading, + Chapter and a New chapter card; what the cards show is chosen beside them.',
      'A chapter’s word goal and keywords are in its ··· menu, with Find and replace and Focus mode.',
    ],
  },
  {
    id: '2026-10-16-quiet-paper-writing',
    date: '16 October 2026',
    title: 'Quiet Paper: room to write',
    points: [
      'Fold the sidebar away with the panel button at its top: it becomes a slim strip, the list steps aside and the page gets the width.',
      'The top of the page then says where the note is (All notes / Story ideas), its word count, and Focus.',
      'Select words for a white bar of tools: style, bold, italic, highlight, link and comment. Its ··· opens Text, Insert and Write, then All writing tools….',
      'The back arrow brings the list back; the button at the foot of the strip brings the sidebar.',
    ],
  },
  {
    id: '2026-10-16-quiet-paper-notes',
    date: '16 October 2026',
    title: 'Quiet Paper: the notes screen',
    points: [
      'The sidebar, the list and the page now sit as separate sheets on the soft wash, with no bar across the top.',
      'The sidebar has Search (Ctrl/⌘+K opens Find anything) and three groups: Capture (Inbox, Today), Library (All notes, Favourites, and Notebooks and Tags folded into one row each) and Writing (your books).',
      'New: the Inbox. Notes you haven’t put in a notebook wait there; file one from the notebook’s name above its title.',
      'The ⚙ at the foot of the sidebar holds Settings, templates, uploads, Writing stats, the Graph, the Trash and help.',
      'A note’s five everyday tools stay on show at the top of the page; its ··· menu can float them over selected text instead. The list’s Last edited ▾ sorts, shows as cards or a table, and hides the list.',
    ],
  },
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
      'A note in page view has the width to itself, with Word’s menus on the bar and Back to writing view to return; before your first note, the welcome has the whole window.',
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
