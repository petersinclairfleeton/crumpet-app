# Microsoft Word features: what Crumpet has, and what's missing

Checked against the code in October 2026. Each line says what Crumpet does today.

- ✅ **Has it**: works much like Word's.
- 🟡 **Partly**: there's a version of it, with gaps (the gaps are named).
- ❌ **Missing**: not built yet.
- ➖ **Leave out**: retired by Microsoft, tied to Microsoft's own services, or
  against a decision in `PLAN.md` (for example, no AI in v1).

At the end there's a suggested order for building what's missing.

---

## File (Backstage view)

| Feature | | Crumpet today |
|---|---|---|
| New blank document | ✅ | New note, new project, new chapter. |
| New from a template | ✅ | Ready-made templates, plus any note in a notebook called "Templates". |
| Open | ✅ | Upload or drop in Word, PDF, Markdown, pictures and other files; each opens as what it is. |
| Save / AutoSave | ✅ | Everything saves as you type and syncs to Google Drive or a folder on the computer. |
| Save to OneDrive / SharePoint | 🟡 | No direct connection, but a OneDrive folder on a computer works as "a folder on the computer". |
| Save As / change file type | ✅ | Word (.docx), e-book (.epub), PDF (by printing), OpenDocument (.odt), Rich Text (.rtf), web page (.html, pictures inside), plain text (.txt), and Markdown (the files themselves). |
| Word files saved back to themselves | ✅ | An uploaded .docx is written back to its own file as it's edited. |
| Protect: password | ✅ | A note's ⋯ menu → Protect with a password: its text is scrambled (AES) here and in the folder or Drive, opened with the password for the session; Lock now, Remove the password. Notes only, not chapters; downloads of an opened note are the plain text, without the password. |
| Protect: restrict editing / read-only | ✅ | Formatting bar → Protect document: no changes, or comments only, with a password to stop it if you like; goes to Word as its own document protection. |
| Protect: mark as final | ✅ | Protect document → Mark as final: opens read only with a bar and Edit anyway; goes to Word as its Mark as Final. |
| Protect: digital signature | 🟡 | Formatting bar → Signature line: the name, title and date on a signature line that remembers the document and says if it changes afterwards. Not a certificate-based digital signature (that needs a certificate service); goes to Word as text. |
| Inspect Document (remove hidden data, comments, authors) | ✅ | The right sidebar's Check tab → Inspect: comments, tracked changes, people's names, hidden text and hidden objects, with Remove all comments, Accept all changes and Remove hidden text. |
| Check Accessibility | ✅ | Check tab → Accessibility: pictures without alt text, tables without a heading row, skipped or empty headings, hard-to-read colours, unclear links. |
| Check Compatibility | ✅ | Check tab → Word: what a Word download won't keep or shows differently. |
| Version history | ✅ | Automatic versions while writing, plus snapshots you take, compared side by side and restored. |
| Recover unsaved documents | ✅ | Not needed: nothing is ever unsaved. |
| Print | ✅ | Prints exactly as page view shows (headers, footers, footnotes). |
| Print settings, page ranges, preview | ✅ | Crumpet's own print window: a preview of every page, which pages (1-3, 5), how many copies; then the browser's window for the printer or a PDF. |
| Export PDF | ✅ | "Print or save as PDF". |
| Export XPS | ➖ | Microsoft-only format. |
| Share (send a link, work together) | ❌ | Known gap: no sharing yet. |
| Transform to Sway | ➖ | Being retired. |
| Close | ✅ | Close tab. |
| Account | ✅ | Optional sign-in with email or Google. |
| Feedback | ❌ | No way to send feedback from the app. |
| Options: AutoCorrect | ✅ | Curly quotes, em and en dashes, … and © ® ™ → ⇒, a typo list (teh → the) plus your own replacements, capitals at a sentence's start; each can be turned off (Settings → Writing). Plus Markdown shortcuts ("# " makes a heading). |
| Options: proofing | 🟡 | The browser's spell check (and right-click suggestions in the Mac app); no settings for it. |
| Options: save settings | 🟡 | Automatic versions can be turned off; that's all there is to set. |
| Options: customise the ribbon / Quick Access Toolbar | ❌ | The formatting bar can show always or only over selected text; you can't choose its buttons. |
| Options: add-ins | ❌ | |
| Options: Trust Center | ➖ | Crumpet has a privacy page; nothing to configure. |

## Home

### Clipboard

| Feature | | Crumpet today |
|---|---|---|
| Cut, copy, paste | ✅ | |
| Paste keeping formatting | ✅ | Pasting from web pages and Word keeps the formatting. |
| Paste text only | ✅ | Ctrl+Shift+V. |
| Paste options menu (keep / merge / text only) after pasting | ✅ | A small button by the pasted text: Keep formatting, Merge formatting (lists, bold and italic kept; the look where it goes), Text only. Copying within Crumpet now keeps its formatting too. |
| Format Painter | ✅ | Including double-click to keep painting. |
| Clipboard pane (history of copied things) | ✅ | The right sidebar's Clipboard tab: the last 24 things copied or cut while Crumpet is open, to paste again (with their formatting). |

### Font

| Feature | | Crumpet today |
|---|---|---|
| Font, size, grow / shrink | ✅ | |
| Bold, italic, underline, strikethrough | ✅ | |
| Subscript, superscript | ✅ | |
| Underline styles (double, dotted, wavy, coloured) | ✅ | Single, double, thick, dotted, dashed, wavy, in any colour (the Font window); to and from Word. |
| Double strikethrough, small caps, all caps, hidden text | ✅ | In the Font window; hidden text shows only with Show/hide ¶ and isn't printed; to and from Word. |
| Text effects (outline, shadow, glow, reflection) | ✅ | Outline, shadow, glow, reflection, emboss, engrave (the Text effects button). Outline, shadow, emboss and engrave go to Word; glow and reflection don't. Reflection shows in Chrome, Edge and Safari only. |
| Highlight, font colour | ✅ | |
| Change case | ✅ | Sentence case, lowercase, UPPERCASE, Capitalise Each Word, tOGGLE. |
| Clear formatting | ✅ | |
| Font dialog: character spacing, kerning | ✅ | Ctrl+D or the button at the end of the Font group: expanded or condensed spacing, raised or lowered, kerning; spacing and position go to Word. |
| Font dialog: OpenType ligatures, number styles | ✅ | Ligatures, number spacing, number forms, stylistic sets (where the font has them). Crumpet only: not sent to Word. |

### Paragraph

| Feature | | Crumpet today |
|---|---|---|
| Bullets, numbering (with libraries, restart and start at) | ✅ | |
| Multilevel lists | ✅ | Lists nest; the Multilevel list button has a gallery (1. a. i., 1.1.1, Chapter 1, Article I / Section 1.01…) and Define new multilevel list sets each level's style and pattern. To and from Word. |
| Increase / decrease indent | ✅ | Also on the ruler. |
| Sort | ✅ | Sort paragraphs… in the Paragraph group: by text, a number or a date, ascending or descending. |
| Show/hide ¶ (formatting marks) | ✅ | The ¶ button or Ctrl+Shift+8: dots for spaces, arrows for tabs, ¶ at paragraph ends; page, section and column breaks are labelled outside page view. |
| Alignment | ✅ | Left, centre, right, justify. |
| Line and paragraph spacing | ✅ | |
| Shading, borders | ✅ | Paragraph shading, and borders on any side, single, thick, double, dotted or dashed, in a colour. To and from Word. |
| Paragraph dialog: indents and spacing | ✅ | |
| Keep with next, keep lines together, page break before | ✅ | |
| Widow/orphan control | ✅ | On by default; switched off for a paragraph in the Paragraph window. To and from Word. |
| Tab stops (and the Tabs window) | ✅ | Tab types a tab (outside lists); left, centre, right and decimal stops with dot, dash or line leaders, set on the ruler (page view) or in the Tabs window (Paragraph settings → Tabs…); default stops every half inch; to and from Word. |

### Styles

| Feature | | Crumpet today |
|---|---|---|
| Styles gallery | ✅ | The style menu on the bar (Normal, Title, Headings 1–4, Quote, Caption, Epigraph, Scene break and more). |
| Styles pane | ✅ | Right sidebar: each style as it looks and how often it's used. |
| Modify a style, update to match selection | ✅ | |
| Create a new style of your own | ✅ | Styles pane → New style… (from the text at the caret), or + New style in the styles window: a name, the style it's based on, and its look. Saved on the paragraph as `{.c-name}`; to Word as a style of the same name, and a Word file's own styles come in as yours. |
| Style Inspector / Reveal Formatting | ✅ | Styles pane → Reveal formatting: the font and paragraph at the caret, with what's set by hand marked apart from what comes from the style. |
| Manage Styles (import, export, hide, order) | ✅ | In the styles window: show or hide a style in the menu, move it up or down, delete your own, and copy all the styles from notes or another project. |

### Editing

| Feature | | Crumpet today |
|---|---|---|
| Find | ✅ | In a note, a chapter or the whole book, with matches highlighted. |
| Find options: match case, whole words | ✅ | |
| Advanced Find: wildcards, formatting, special characters (¶, tab, page break) | ✅ | Find → More options: Word's wildcards (? * [ ] @ {n,m} < > and groups, \1 in the replacement), formatting (bold, italic, underline, strikethrough, highlighted, a paragraph style, with or without words) and special characters (^t, ^l, ^#, ^$, ^&…). Not ^p: paragraph marks can't be found or replaced. |
| Replace, Replace all | ✅ | Can be undone, and is tracked when Track Changes is on. |
| Go To (page, section, footnote, comment…) | ✅ | F5, the command palette, or the page number in page view: a page, heading, footnote or comment by number (or +1 / -2), or the previous or next one. No sections, lines or bookmarks yet. |
| Select all | ✅ | |
| Select objects, text with similar formatting | ✅ | More → Select text with similar formatting, or a style's "Select all instances" in the Styles pane: the places light up, with a bar to make them bold, italic, underlined, highlighted, plain or another style at once. |
| Selection Pane | ✅ | The right sidebar's Selection tab: pictures, shapes, text boxes, maths and diagrams, to go to, hide and show (Word is told they're hidden; it doesn't tell Crumpet back yet). |

### Voice, Editor, Add-ins, Copilot

| Feature | | Crumpet today |
|---|---|---|
| Dictate | ✅ | Including spoken punctuation ("comma", "new paragraph"). |
| Spelling | ✅ | The browser's own red underlines, with Crumpet's own dictionary, characters' and places' names never marked, Ignore all, a language, and a switch to turn it off (Settings → Writing); and a spelling pass (Check tab → Spelling: British or American English, suggestions, Change, Change all, Ignore, Add to dictionary). |
| Grammar | ❌ | |
| Clarity, conciseness | ✅ | The Writing tab highlights -ly adverbs, filler words and likely passive voice; the Check tab's Clarity finds wordy phrases with a plainer one to use. |
| Inclusive language | ✅ | Check tab → Inclusive: words with fairer alternatives, one click to use one. |
| Similarity checker (plagiarism) | ❌ | |
| Add-ins | ❌ | |
| Copilot | ➖ | No AI in v1 (a decision in the plan); worth revisiting later. |

## Insert

| Feature | | Crumpet today |
|---|---|---|
| Cover Page | ✅ | Four designs (Classic, Banner, Rule, Frame) with your title, subtitle, author and date; a page of its own with no header or footer; replace or remove it. |
| Blank Page | ✅ | The Blank page button: an empty page at the caret, the rest moved on past it. |
| Page Break | ✅ | |
| Insert a table | ✅ | The Table button's size grid, or /table. |
| Draw a table | ✅ | Table → Draw table…: drag lines across or down a box (click one to rub it out); their places become the rows' heights and columns' widths. Lines that stop partway (merged cells as you draw) aren't drawn. |
| Convert text to table | ✅ | Table → Convert text to table…: the selected lines cut at tabs, commas, spaces or a character of your own; formatting kept. |
| Excel spreadsheet in the document | ❌ | |
| Quick Tables (ready-made calendars, tables) | ✅ | This month's calendar, a list, a matrix, and a table with subheadings and totals (formulas). |
| Pictures from the device | ✅ | Also pasted or dropped in. |
| Stock images, online pictures | ❌ | |
| Shapes | ✅ | 35 shapes in groups: lines, basic shapes, block arrows, stars and banners, callouts, flowchart. Word has more still. |
| Icons | ✅ | 30 icons in groups (signs, people, things, nature), put in as shapes to recolour and size. |
| 3D Models | ❌ | |
| SmartArt | 🟡 | Diagrams written as text (Mermaid flowcharts, timelines); no picture-based SmartArt gallery. |
| Chart | ❌ | No bar/line/pie charts from data. |
| Screenshot / screen clipping | ❌ | |
| Online Video | 🟡 | Uploaded video files play; no YouTube or web video in the text. |
| Link | ✅ | Web links and [[note links]]. |
| Bookmark (a place in the text to link to) | ✅ | References → Bookmark…: any spot, named; go to it, delete it, link to it (the link box lists them, Ctrl+click follows). To and from Word. |
| Cross-reference ("see page 12", "see Figure 3") | ✅ | References → Cross-reference…: to a heading, caption or bookmark, as its number, its text, its page (page view) or above/below; updates by itself. |
| Comments | ✅ | |
| Header, Footer, Page Number | ✅ | Left/centre/right places, fields such as page number, number of pages, chapter title, author, date. |
| Text Box | ✅ | Linked text boxes too: text that doesn't fit runs on into the next box (Link to next box, in its menu). |
| Drop Cap | 🟡 | Dropped, 2 to 5 lines tall; to and from Word. No "in margin" kind, and no font or distance of its own. |
| Signature Line | ❌ | |
| Date & Time | ✅ | In a choice of forms, as text or (Update automatically) a field that shows the day it's read; to and from Word as DATE/TIME fields. |
| Quick Parts: AutoText, Building Blocks | ✅ | The Snippets button: save the selection as a snippet (with its formatting), drop one in from the menu, or type its name and press F3. Shared across devices. |
| Quick Parts: Document Property, Field | ✅ | References → Field…: page, number of pages, words, characters, title, author, date created and saved, besides dates and times. To and from Word as field codes. |
| WordArt | ❌ | |
| Object (embedded/linked file) | 🟡 | Files can be attached in the text (shown as a chip); not embedded as editable objects. |
| Text from file (put a whole document into this one) | ✅ | Snippets → Text from file…: a Word document, Markdown or plain text, poured in at the caret with its formatting. |
| Equation | ✅ | Formatting bar → Equation (or Alt+= for one within the line): written in LaTeX or UnicodeMath, with structures and symbols to pick, drawn at once; Word gets real Word equations, and Word's equations come in as Crumpet's. No handwritten (ink) equations. |
| Symbol | ✅ | Symbols and special characters (non-breaking space and hyphen, dashes, quotes…). |
| Forms (content controls: tick boxes, drop-downs, date pickers) | 🟡 | Checklists only. |
| Loop components | ➖ | Microsoft 365 only. |

## Draw

| Feature | | Crumpet today |
|---|---|---|
| Pens, pencil, highlighter, eraser, lasso select | ❌ | No drawing with a finger, mouse or Apple Pencil. |
| Ink to Shape, Ink to Math, Ink Replay | ❌ | |
| Ink editor (strike out or insert text with gestures) | ❌ | |
| Drawing canvas | 🟡 | Boards (cards and arrows, like Obsidian's Canvas) are notes of their own, not drawings inside a document. |
| Ruler | ✅ | In page view, with draggable indents. |

## Design

| Feature | | Crumpet today |
|---|---|---|
| Themes | ✅ | Eight document themes (colours, fonts and effects together), saved with the document and sent to Word as its styles' fonts and colours. The app's own look is separate (Settings). |
| Style Sets | ✅ | Crumpet, Manuscript, Book, Modern. |
| Colours, Fonts (for the whole document) | ✅ | Theme colours (seven sets: headings, title, links, and a theme row in Font colour) and theme fonts (eight heading and body pairs). |
| Paragraph Spacing presets | ✅ | No paragraph space, Compact, Tight, Open, Relaxed, Double; spacing set by hand on a paragraph stays. |
| Effects | 🟡 | Flat, Subtle, Soft shadow, Lifted, Glow on shapes, text boxes and pictures; shown in Crumpet only (Word keeps the theme's name, not the shadows). |
| Set as Default | ✅ | The styles window's "Set as default for new projects" (shared across devices). |
| Watermark ("DRAFT", "CONFIDENTIAL") | ✅ | Ready-made words, words of your own (slanting or flat, in a colour) or a picture; on every page, printed and in Word. |
| Page Colour | ✅ | Saved in the document, printed and sent to Word; the paper you write on stays a setting of its own. Shown in page view. |
| Page Borders | 🟡 | A line round every page: single, double, thick, dotted or dashed, in a colour. No art borders, and the same on every page. |

## Layout

| Feature | | Crumpet today |
|---|---|---|
| Margins | ✅ | Per section too. |
| Orientation | ✅ | Per section too. |
| Size | ✅ | Letter, A4, A5, A3, B5, 6 × 9 and pocket books, Executive, Legal, Tabloid, or a size of your own; per section too. |
| Columns | ✅ | Per section, balanced before a continuous break. |
| Breaks: page, column | ✅ | |
| Breaks: text wrapping | ✅ | Layout → Breaks → Text wrapping: the text after it goes below a picture beside it. |
| Section breaks: next page, continuous | ✅ | |
| Section breaks: even page, odd page | ✅ | A blank page is put in when needed. |
| Line Numbers | ✅ | Continuous, or restarting each page or section; every line or every 2nd, 5th, 10th. Headings and tables aren't numbered. |
| Hyphenation | ✅ | Automatic (the browser's own word breaking, by the document's language), or optional hyphens (Ctrl+-). |
| Paragraph: Indent, Spacing | ✅ | |
| Wrap Text | ✅ | Shapes and text boxes: in line, square or tight on the left or right, top and bottom, in front of or behind the text. Pictures: in line, square, in front (not yet behind, tight or top and bottom). |
| Position | ✅ | Shapes placed anywhere can be placed from their paragraph, the page's margins or the page's corner (pictures from their paragraph). |
| Bring Forward / Send Backward | ✅ | Bring to front, forward, backward, to back, for shapes in front of or behind the text. |
| Align, Group | ✅ | Align a shape to the margins, or several (Shift+click) to each other; group shapes so they move together (Word gets them one by one). |
| Rotate | ✅ | Pictures, shapes and text boxes: by the handle above them, or 90° from their menu. |

## References

| Feature | | Crumpet today |
|---|---|---|
| Table of contents: insert | ✅ | With page numbers; in a project it lists the whole book. |
| Table of contents: update | ✅ | Updates by itself. |
| Table of contents: Add Text (include a paragraph) | ✅ | References → Add text to the contents (level 1–4, or a heading left out); the contents' ⚙: levels shown, title, page numbers, dotted leaders. |
| Footnote | ✅ | Numbered through the whole book. |
| Endnote | ✅ | References → Insert endnote (or /endnote): numbered i, ii, iii and listed at the end (after the pages, in page view); all footnotes made endnotes or back. To and from Word, endnotes' text included. Not yet printed. |
| Next Footnote, Show Notes | ✅ | Footnotes are listed under the note, with Previous and Next footnote (also in the command palette and Go To). |
| Research: Search, Researcher | ✅ | The right sidebar's Search tab: Wikipedia articles, to save as a research note (into a project's Research), cite or link to; and a link to search the whole web. |
| Insert Citation, Manage Sources | ✅ | References → Insert citation… (choose a source or add one: book, chapter, article, web page) and Manage sources… (one list for all your notes and projects). |
| Citation styles (APA, MLA, Chicago), Bibliography | ✅ | APA 7, MLA 9 or Chicago author-date, in the text and in References → Bibliography (the sources cited, A to Z). Go to Word as text (not Word's own citation fields). |
| Insert Caption | ✅ | References → Insert caption…: Figure, Table, Equation or a label of your own, numbered by itself (a picture's own caption, or a line above or below a table or paragraph). |
| Table of Figures | ✅ | References → Table of figures: the captions of one label, with their pages in page view. |
| Cross-reference | ✅ | See above (Insert tab). |
| Index: Mark Entry, Insert Index | ✅ | References → Mark index entry… (an entry, or one under another; or every place the words appear) and Insert index (A to Z, with every page in page view). |
| Table of Authorities | ❌ | |

## Mailings

| Feature | | Crumpet today |
|---|---|---|
| Envelopes, Labels | ❌ | |
| Mail merge (letters, emails, envelopes, labels, directory) | ❌ | |
| Recipients, merge fields, Address Block, Greeting Line | ❌ | |
| Rules (If…Then…Else, Fill-in, Ask, Skip Record) | ❌ | |
| Preview Results, Check for Errors, Finish & Merge | ❌ | |

(None of Mailings exists. It matters little for fiction; it would matter for letters.)

## Review

| Feature | | Crumpet today |
|---|---|---|
| Editor (spelling and grammar pass) | 🟡 | A spelling pass, clarity and inclusive language (the Check tab); no grammar yet (it needs an outside service). |
| Thesaurus | ✅ | Shift+F7, with definitions. |
| Word Count | ✅ | In the status bar (and selected words), plus full statistics. |
| Read Aloud | ✅ | Each word lit as it's read; voice and speed. |
| Check Accessibility | ✅ | The right sidebar's Check tab. |
| Translate (selection or document) | ❌ | |
| Proofing language (per paragraph) | ❌ | |
| Comments: new, reply (threaded), show | ✅ | Listed in the right sidebar too. |
| Comments: resolve | ✅ | Kept, greyed out, until reopened; to and from Word ("done"). |
| Comments: delete, previous/next | ✅ | Delete on the comment's card; previous and next in the Reviewing pane, Go To and the command palette. |
| Comments: @mentions | ✅ | Typing @ in a comment suggests names (people in the document, and you); shown picked out. A label only: nothing is sent. |
| Track Changes on/off | ✅ | Plus Crumpet's own revision colours. |
| Track Changes: just mine / Lock Tracking | ✅ | Just mine (this device) or everyone's (saved in the document), and Lock tracking with a password: it can't be turned off, nor changes accepted or rejected, until unlocked. To and from Word (Word gets the lock without the password). |
| Display for Review (Simple / All Markup / No Markup / Original) | ✅ | In the Reviewing pane, the changes bar and the command palette. |
| Show Markup (choose what's shown, by person) | ✅ | In the Reviewing pane: insertions and deletions, comments, and each person's. |
| Reviewing Pane (all changes in a list) | ✅ | The right sidebar's Review tab: every change and comment in order, with who and when, Accept or Reject each. |
| Accept, Reject (one, or all) | ✅ | |
| Previous / Next change | ✅ | In the Reviewing pane, Go To (F5) and the command palette. |
| Compare two versions | ✅ | Word by word, or as a copy with the differences as tracked changes. |
| Combine (several reviewers' copies into one) | ✅ | From the command palette: choose the copies and who each is from; a new note with each reviewer's changes tracked in their name. Text only (formatting isn't compared). |
| Block Authors, Restrict Editing | ❌ | |
| Hide Ink | ➖ | There's no ink. |
| Resume Assistant | ➖ | Retired. |

## View

| Feature | | Crumpet today |
|---|---|---|
| Read Mode | ✅ | Reading view. |
| Print Layout | ✅ | Page view. |
| Web Layout / Draft | ✅ | The text as one long page (the usual way of writing notes). |
| Outline view | ✅ | Word's outline view (under More): levels shown by indent with markers, promote, demote, move up and down (Alt+Shift+arrows), expand and collapse, show a level, first line only; drag a heading's marker to move its section. |
| Focus | ✅ | Focus mode, plus typewriter mode. |
| Immersive Reader: line focus | ✅ | The immersive reader's line focus (one, three or five lines lit, arrow keys move on); typewriter mode too. |
| Immersive Reader: text spacing, syllables, picture dictionary | ✅ | Text size, letter, word and line spacing, column width, page colour; syllables (by rule, so compound words can split oddly); parts of speech coloured and labelled (a rough guess); picture dictionary (Wikipedia picture and a dictionary meaning, online); read aloud with each word lit. |
| Page Movement: vertical | ✅ | |
| Page Movement: side to side (like a book) | ✅ | Facing pages, the first alone on the right (Pages on screen). |
| Ruler | ✅ | |
| Gridlines | ✅ | A quarter-inch grid behind the text; shapes snap to it as they're moved and sized. |
| Navigation Pane: headings | ✅ | Right sidebar's outline, and the status bar. |
| Navigation Pane: pages (thumbnails) | ✅ | The right sidebar's Pages tab: a small copy of each page; click to go there. |
| Navigation Pane: results | ✅ | Find → More options → List results: each match with the words round it (and its chapter, across a book); click one to go there. |
| Zoom, 100%, Page Width | ✅ | 25%–300% and "Fit". |
| Zoom: One Page, Multiple Pages | ✅ | One page in the window, or 2, 3 or 4 pages in a row (Pages on screen, under More). |
| New Window | ✅ | Opens the document again in a pane beside it, both kept in step (inside the one browser window). |
| Arrange All, Split, View Side by Side | ✅ | Panes side by side or one above the other, with tabs in each. |
| Synchronous Scrolling | ✅ | Scroll together: panes side by side move as one. |
| Switch Windows | ✅ | Tabs and the quick switcher (Ctrl+O). |
| Macros: view, record | ❌ | |
| SharePoint: Properties | ➖ | |
| Dark Mode | ✅ | |

## Help

| Feature | | Crumpet today |
|---|---|---|
| Help, Show Training | ✅ | The welcome guide (with pictures and workflows) and the first-visit tour, from the ? button. |
| What's New | ❌ | |
| Contact Support, Feedback | ❌ | |

## Contextual tabs

### Table Design

| Feature | | Crumpet today |
|---|---|---|
| Table styles | ✅ | A gallery of eight (they go to Word as styles of their own). |
| Shading | ✅ | Per cell. |
| Borders | ✅ | All lines, outside only, between rows, none for the table; and per cell: which sides, single, thick, double, dotted or dashed, in a colour. To and from Word. |
| Border painter | ✅ | Table menu → Cell lines → Border painter: each cell clicked gets lines all round in the style and colour chosen. |
| Header row, banded rows | ✅ | |
| First column, last column, total row, banded columns | ✅ | In the Table menu's Style options; to and from Word. A total row stays at the foot when sorting. |

### Table Layout

| Feature | | Crumpet today |
|---|---|---|
| Insert/delete rows and columns | ✅ | |
| Merge / split cells | ✅ | |
| Cell size (column widths) | ✅ | Column widths (drag the edges) and row heights (at least 0.3, 0.5, 0.75 or 1 inch, or as tall as the text). |
| Distribute rows/columns evenly | ✅ | |
| Alignment | ✅ | Left/centre/right for a column or one cell, and top/middle/bottom per cell. Applies to the cell with the cursor (not several selected cells at once). |
| Text direction | ✅ | Per cell: across, down or up. |
| Cell margins | ✅ | Narrow, normal or wide, for the whole table. |
| Repeat Header Rows on each page | ✅ | In page view, a table that runs onto another page is split between rows, with its heading row again at the top (on unless switched off). |
| Convert table to text | ✅ | Each row a line, cells parted by tabs. |
| Sort | ✅ | By the cursor's column, A to Z or Z to A, as numbers when the column holds numbers; rows keep their shading and settings. Not when merged cells span rows. |
| Formula (=SUM) | ✅ | A cell starting with = shows what it comes to: SUM, AVERAGE, MIN, MAX, COUNT, PRODUCT of ABOVE/LEFT/BELOW/RIGHT, cells (A1) or ranges (B2:B5), with + − × ÷. To Word as formula fields. |
| More than one paragraph in a cell | 🟡 | Shift+Enter starts another line in a cell, and "- " a bullet; to Word as separate paragraphs. Pictures and real lists in a cell aren't possible yet. |

### Picture Format

| Feature | | Crumpet today |
|---|---|---|
| Resize | ✅ | Drag a picture's corner (it keeps its shape); Original size in its menu. |
| Crop (to shape, to aspect ratio) | ✅ | Drag the edges (Crop in the picture's menu), crop to a ratio (square, 4:3, 3:2, 16:9, 3:4) or to a shape (oval, rounded, triangle, diamond, hexagon, star); to and from Word. |
| Remove Background, Corrections, Colour, Artistic Effects, Transparency | ✅ | Remove background (a plain background, by colour, with a preview and a slider; no marking areas to keep or remove). Corrections and effects window: brightness, contrast, colour, see-through, and six effects (black and white, sepia, washout, vintage, blur, negative). Brightness, contrast, black and white and see-through go to Word; colour and the other effects don't. |
| Compress | ✅ | Compress… in the picture's menu: print, web or email resolution for how big it's shown, cropped parts thrown away; Reset picture brings the original back. One picture at a time. |
| Change Picture, Reset | ✅ | In the picture's menu: another picture keeps the size and look; Reset goes back to how it was put in (keeping the alt text). |
| Picture Styles, Border, Effects | ✅ | Simple frame, white frame, shadow, rounded corners, soft edges and snapshot; a coloured border. Word gets the nearest it has (a line, a shadow, rounded corners). |
| Alt Text | ✅ | Its own, apart from the caption (the caption serves when there's none); to and from Word and in e-books. |
| Wrap, position, rotate | ❌ | Only shapes have these. |

### Shape Format

| Feature | | Crumpet today |
|---|---|---|
| Insert shapes | ✅ | 35 kinds, from the Shapes gallery. |
| Edit Shape / Edit Points | ✅ | Edit points turns a shape into a freeform: drag corners, drag a side's middle to add one, double-click to take one away (curves become many corners). |
| Shape Styles (ready-made looks) | ✅ | Twelve styles in the shape's menu (fills, gradients, lines, effects, text colour). |
| Fill, Outline | ✅ | Colours, a gradient, a picture fill; line thickness, dashes, and arrowheads, open arrows or dots at a line's ends. |
| Effects (shadow, glow, 3D) | ✅ | Shadow, glow, soft edges, bevel and reflection (one at a time); go to Word. |
| WordArt Styles | ❌ | |
| Text in a shape | ✅ | Several lines, bullets ("- "), left, centre or right, top, middle or bottom. |
| Text Direction | ✅ | Across, or turned to read down or up. |
| Arrange (wrap, position, rotate) | ✅ | See Layout → Arrange. |
| Size | ✅ | Drag the corner. |

### Graphics, SmartArt, Chart

| Feature | | Crumpet today |
|---|---|---|
| Graphics Format (icons, SVG, Convert to Shape) | ✅ | Icons are shapes; an SVG picture's Convert to shape makes it one (its outlines, first colour). |
| SmartArt Design/Format | ❌ | (Mermaid diagrams are the stand-in.) |
| Chart Design/Format | ❌ | |

### Header & Footer

| Feature | | Crumpet today |
|---|---|---|
| Edit in place (double-click top or bottom of a page) | ✅ | |
| Different First Page | ✅ | Also a different first page for each chapter. |
| Different Odd & Even pages | ✅ | |
| Link to Previous (different headers per section) | ✅ | Each section's header and footer can be its own; also a blank first page and page numbers starting again, per section. |
| Header/footer position (distance from the edge) | ✅ | Page Setup → Layout. |
| Go to Header / Footer | ✅ | By double-clicking. |
| Page number formats (1, 2, 3 / i, ii, iii…) | ✅ | |

### Equation

| Feature | | Crumpet today |
|---|---|---|
| Professional / Linear view | 🟡 | You write the LaTeX (linear) and see the drawn result (professional) together. |
| Structures (fractions, scripts, radicals, integrals, matrices) | ✅ | Over a maths block while you write it, and in the card for one within a line: fractions, scripts, roots, integrals, large operators, brackets, functions, accents, matrices and operators. |
| Maths symbols palette | ✅ | Symbols beside Structures: basic maths, Greek letters, sets and logic, arrows, letter-like symbols. |
| Equations inside a line of text | ✅ | Alt+= (or Equation → In the line): drawn in the line at the text's size; click to change it, or put it on a line of its own. Saved as $`…`$. |
| UnicodeMath (Word's typed maths, like a/b or x^2) | ✅ | In the equation card (LaTeX / UnicodeMath) and a line under the structures; turned into LaTeX. The common parts: fractions, scripts, roots, n-ary operators, brackets, matrices. |

### Text Box / Drawing Canvas

| Feature | | Crumpet today |
|---|---|---|
| Text box | ✅ | See Shape Format. |
| Linking text boxes (text flows from one to the next) | ❌ | |
| Drawing canvas | ❌ | |

---

## Things Crumpet has that Word doesn't

Projects with chapters, corkboard and outline; research beside the writing;
characters and places spotted in the text; snapshots and automatic versions;
revision colours; writing targets, deadlines and streaks; focus tools for
adverbs, filler and passive voice; boards and graph view; note links and
backlinks; e-book export; the web clipper; Markdown files you own.

---

## Peter's choices (October 2026)

Peter went through every missing or partly built feature and chose what to
build. Unless it's listed under "Not wanted", it's wanted.

### Not wanted

- Sharing (and with it Block Authors). Crumpet stays personal for now.
- Mail merge, merge rules, merge emails, envelopes and labels.
- Similarity checker, Translate, Table of authorities, SmartArt gallery, WordArt.
- AI assistant (Copilot-like), XPS, Sway, Loop, SharePoint (and Hide Ink,
  Resume Assistant, Trust Center, which have nothing to do in Crumpet).

### Decided along the way

- **@mentions**: names only. Typing @ in a comment picks a name (an editor,
  a co-writer) as a label; nobody is sent anything.
- **Markup views** (Simple / All Markup / No Markup / Original): wanted.
- **Compatibility checker**: wanted, as a check of what won't survive when a
  document goes to Word.

### Wanted: the build list

Work through these groups in order, one pull request per group (or per few
items when a group is big), as `CLAUDE.md` describes. In the same pull
request: tick the item here (`[x]`), change its line in the tables above to
✅ (or 🟡 with what's still missing), and update the welcome guide. "Where"
points to the code to start from.

**1. Everyday writing**
Where: `packages/editor/src/editor.ts` (input), `commands.ts`, `view.ts`;
`app/src/ui/paratools.tsx`, `inserttools.tsx`, `ruler.tsx`, `statusbar.tsx`.
- [x] AutoCorrect: curly quotes, em/en dashes, `...` → …, (c) → ©, a typo list (teh → the), capital at a sentence's start; each can be turned off in Settings
- [x] Show/hide ¶ (spaces, tabs, paragraph ends, breaks)
- [x] Tab stops (left, centre, right, decimal, dot leaders) on the ruler and in a Tabs window; to and from Word
- [x] Drop cap
- [x] Blank page button
- [x] Date and time that update (a field), as well as fixed text
- [x] Go to page (and footnote, comment, heading)
- [x] Next/previous footnote
- [x] Spelling settings: own dictionary (character names), ignore all, language

**2. Pictures**
Where: `view.ts` (`buildMedia`), `model.ts` (image blocks), `markdown.ts`, `app/src/data/docx.ts`; follow `shape.ts` for wrap, drag and turning.
- [x] Resize by dragging a corner
- [x] Wrap text round them, move anywhere, rotate (as shapes do)
- [x] Crop, to a shape and to a ratio
- [x] Alt text of its own, apart from the caption
- [x] Change picture, reset picture
- [x] Picture styles: frames, shadows, rounded corners, borders
- [x] Corrections: brightness, contrast, colour, transparency, artistic effects
- [x] Remove background
- [x] Compress on request

**3. Reviewing**
Where: `app/src/ui/changes.tsx`, `comments.tsx`, `rightside.tsx`, `comparedocs.tsx`; `model.ts` (`Comment`, `Change`); `docx.ts`.
- [x] Markup views: Simple, All Markup, No Markup, Original
- [x] Reviewing pane: every change and comment listed, with who and when
- [x] Previous/next change; previous/next comment
- [x] Resolved comments kept (greyed out, reopen), also to and from Word
- [x] Track just my changes, or everyone's
- [x] Lock tracking (with a password)
- [x] Show markup by kind and by person
- [x] @ names in comments (a label only; nothing is sent)
- [x] Combine several reviewers' copies into one

**4. Fonts and paragraphs**
Where: `model.ts` (`Look`, `Mark`, `ParaLook`), `markdown.ts`, `docx.ts`, `app/src/ui/fonttools.tsx`, `listtools.tsx`, `paratools.tsx`.
- [x] Small caps, all caps, double strikethrough, hidden text
- [x] Underline styles (double, dotted, dashed, wavy, coloured)
- [x] A Font window: character spacing and kerning
- [x] Ligatures and number styles (OpenType)
- [x] Text effects (outline, shadow, glow, reflection)
- [x] Paste options menu after pasting (keep, merge, text only)
- [x] Clipboard history
- [x] Multilevel list gallery, and defining your own
- [x] Sort paragraphs
- [x] Paragraph border styles (dashed, double, thickness, colour)
- [x] Widow/orphan control switch per paragraph

**5. Styles, find and selecting**
Where: `app/src/data/styles.ts`, `ui/stylespane.tsx`, `ui/styles-ui.tsx`, `ui/find.tsx`, `packages/editor/src/find.ts`.
- [x] Create your own styles
- [x] Reveal formatting (Style Inspector)
- [x] Manage styles: copy between documents, hide, order
- [x] Set as default for new documents
- [x] Advanced find: wildcards, formatting, special characters
- [x] Find results list with the words around each match
- [x] Select text with similar formatting
- [x] Selection pane (shapes, pictures, text boxes)

**6. Tables**
Where: `packages/editor/src/table.ts`, `cells.ts`, `view.ts` (the Table menu), `paginate.ts`, `markdown.ts`, `docx.ts`.
- [x] Several paragraphs, lists or pictures in a cell
- [x] Cell alignment per cell, and top/middle/bottom
- [x] Repeat the heading row on each page
- [x] Row heights
- [x] Distribute rows/columns evenly
- [x] Cell margins
- [x] Text direction in cells
- [x] Border styles per cell, and the border painter
- [x] Table style options: first column, last column, total row, banded columns
- [x] Convert text to table, and table to text
- [x] Sort a table
- [x] Formulas (=SUM and friends)
- [x] Draw a table
- [x] Quick tables (calendars, lists, matrix)

**7. Book and non-fiction tools**
Where: `model.ts` (footnotes), `paginate.ts`, `app/src/ui/booktoc.ts`, `footnotes.tsx`, `print.tsx`, `docx.ts`, `epub.ts`.
- [x] Endnotes, turning footnotes into endnotes, and keeping a Word file's endnotes (their text is lost on import today: `docx.ts`, `endnoteReference`)
- [x] Contents options: levels, Add Text, contents styles
- [x] Numbered captions (Figure 1, Table 2)
- [x] Table of figures
- [x] Cross-references that update
- [x] Bookmarks on any spot of the text, and links to them
- [x] Index: mark entries, insert the index
- [x] Citations, sources and a bibliography (APA, MLA, Chicago…)
- [x] Web search in the right sidebar (Wikipedia, the web), into research
- [x] Fields in the text (page, words, title, author…)
- [x] Saved snippets (AutoText / Building Blocks)
- [x] Text from file (another document poured in at the caret)

**8. Page layout and design**
Where: `paginate.ts`, `app/src/ui/pagesetup.tsx`, `layouttools.tsx`, `pages.tsx`, `headers.tsx`, `data/headers.ts`, `data/styles.ts`, `print.tsx`, `docx.ts`.
- [x] Hyphenation (automatic and manual)
- [x] Headers and footers per section (Link to Previous)
- [x] Header and footer distance from the edge
- [x] Odd page / even page section breaks
- [x] Custom paper sizes, and size per section
- [x] Line numbers
- [x] Text wrapping break
- [x] Watermark (text or picture)
- [x] Page colour saved in the document, printed and sent to Word
- [x] Page borders
- [x] Cover pages
- [x] Document themes; theme colours and fonts menus
- [x] Paragraph spacing presets
- [x] Design effects

**9. Shapes and arranging**
Where: `packages/editor/src/shape.ts`, `view.ts` (the Shape menu), `paginate.ts`, `docx.ts`.
- [x] Wrap behind the text, tight, top and bottom
- [x] Position from the page's corner or margins
- [x] Bring forward / send backward
- [x] Align and group
- [x] More shapes (stars, callouts, banners, flowchart, block arrows)
- [x] Shape styles gallery
- [x] Fill and line options: gradients, picture fill, thickness, dashes, arrowheads
- [x] Shape effects (shadow, glow, soft edges, 3D)
- [x] Several paragraphs and lists in a shape
- [x] Text direction in shapes
- [x] Linked text boxes
- [x] Edit points
- [x] Icons library; convert icons and SVGs to shapes
- [x] Gridlines

**10. Views and windows**
Where: `app/src/ui/pages.tsx`, `statusbar.tsx`, `NotePane.tsx` (reading view), `panes.tsx`, `rightside.tsx`.
- [x] Word-style outline view (promote, demote, drag)
- [x] One page / multiple pages zoom
- [x] Side-to-side pages (like a book)
- [x] Page thumbnails in the navigation pane
- [x] Immersive reader: letter, word and line spacing, column width
- [x] Syllables, parts of speech, picture dictionary
- [x] New window on the same document
- [x] Synchronous scrolling of two panes

**11. Checking and files**
Where: `app/src/data/docx.ts`, `textstats.ts`, `ui/writingtab.tsx`, `ui/print.tsx`, `data/documents.ts`.
- [x] Accessibility checker
- [x] Compatibility checker (what won't survive in Word)
- [x] Document inspector (comments, changes, authors, hidden text)
- [x] Spelling pass with suggestions
- [x] Clarity suggestions (from the Writing tab's highlights, plus wordy phrases)
- [x] Inclusive language
- [ ] Grammar checking (needs an outside service such as LanguageTool: ask Peter first)
- [x] More download types: .odt, .rtf, .html, .txt
- [x] Crumpet's own print screen (preview, page ranges, copies)
- [x] Password protection
- [x] Read-only / restrict editing
- [x] Mark as final
- [x] Digital signature

**12. Bigger additions**
- [x] Equation toolbar (fractions, scripts, roots, integrals, matrices)
- [x] Maths symbols palette
- [x] Equations within a line
- [x] UnicodeMath (handwritten maths not built: it needs a handwriting recogniser, see the ink items)
- [ ] Charts from a table of numbers
- [ ] Screenshot
- [ ] Online video (YouTube links play in the text)
- [ ] Online pictures (needs a picture service's key: ask Peter first)
- [ ] Embedded objects
- [ ] Form controls (drop-downs, date pickers, fill-in boxes)
- [ ] Spreadsheet in a document
- [ ] 3D models
- [ ] Draw tab: pen, pencil, highlighter, eraser, lasso (finger, mouse, Apple Pencil)
- [ ] Ink to shape and maths, ink replay
- [ ] Ink editing gestures
- [ ] Drawing canvas in a document
- [ ] Macros (record and play back)
- [ ] Customise the formatting bar
- [ ] Add-ins
- [ ] Feedback button; contact support; what's new
- [ ] OneDrive connection (needs an app key from Microsoft: ask Peter first)
