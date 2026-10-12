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
| Save As / change file type | 🟡 | Word (.docx), e-book (.epub), PDF (by printing), and Markdown (the files themselves). No RTF, OpenDocument (.odt), web page (.html) or plain text (.txt) download. |
| Word files saved back to themselves | ✅ | An uploaded .docx is written back to its own file as it's edited. |
| Protect: password | ❌ | |
| Protect: restrict editing / read-only | ❌ | |
| Protect: mark as final | ❌ | |
| Protect: digital signature | ❌ | |
| Inspect Document (remove hidden data, comments, authors) | ❌ | |
| Check Accessibility | ❌ | |
| Check Compatibility | ➖ | Only matters between Word versions. |
| Version history | ✅ | Automatic versions while writing, plus snapshots you take, compared side by side and restored. |
| Recover unsaved documents | ✅ | Not needed: nothing is ever unsaved. |
| Print | ✅ | Prints exactly as page view shows (headers, footers, footnotes). |
| Print settings, page ranges, preview | 🟡 | Through the browser's print window (which has page ranges, copies and a preview), not a print screen of Crumpet's own. |
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
| Paste options menu (keep / merge / text only) after pasting | ❌ | No little menu after pasting; "merge formatting" doesn't exist. |
| Format Painter | ✅ | Including double-click to keep painting. |
| Clipboard pane (history of copied things) | ❌ | |

### Font

| Feature | | Crumpet today |
|---|---|---|
| Font, size, grow / shrink | ✅ | |
| Bold, italic, underline, strikethrough | ✅ | |
| Subscript, superscript | ✅ | |
| Underline styles (double, dotted, wavy, coloured) | ❌ | One kind of underline only. |
| Double strikethrough, small caps, all caps, hidden text | ❌ | All caps exists only as part of a style. |
| Text effects (outline, shadow, glow, reflection) | ❌ | |
| Highlight, font colour | ✅ | |
| Change case | ✅ | Sentence case, lowercase, UPPERCASE, Capitalise Each Word, tOGGLE. |
| Clear formatting | ✅ | |
| Font dialog: character spacing, kerning | ❌ | |
| Font dialog: OpenType ligatures, number styles | ❌ | |

### Paragraph

| Feature | | Crumpet today |
|---|---|---|
| Bullets, numbering (with libraries, restart and start at) | ✅ | |
| Multilevel lists | 🟡 | Lists nest, and "1. 1.1 1.1.1" numbering is there. No gallery of multilevel styles, and no "define new multilevel list". |
| Increase / decrease indent | ✅ | Also on the ruler. |
| Sort | ❌ | |
| Show/hide ¶ (formatting marks) | ✅ | The ¶ button or Ctrl+Shift+8: dots for spaces, arrows for tabs, ¶ at paragraph ends; page, section and column breaks are labelled outside page view. |
| Alignment | ✅ | Left, centre, right, justify. |
| Line and paragraph spacing | ✅ | |
| Shading, borders | ✅ | Paragraph shading, and borders on any side. No border styles (dashed, double, thickness, colour). |
| Paragraph dialog: indents and spacing | ✅ | |
| Keep with next, keep lines together, page break before | ✅ | |
| Widow/orphan control | 🟡 | Always on; can't be switched off for a paragraph. |
| Tab stops (and the Tabs window) | ✅ | Tab types a tab (outside lists); left, centre, right and decimal stops with dot, dash or line leaders, set on the ruler (page view) or in the Tabs window (Paragraph settings → Tabs…); default stops every half inch; to and from Word. |

### Styles

| Feature | | Crumpet today |
|---|---|---|
| Styles gallery | ✅ | The style menu on the bar (Normal, Title, Headings 1–4, Quote, Caption, Epigraph, Scene break and more). |
| Styles pane | ✅ | Right sidebar: each style as it looks and how often it's used. |
| Modify a style, update to match selection | ✅ | |
| Create a new style of your own | ❌ | The list of styles is fixed. |
| Style Inspector / Reveal Formatting | ❌ | |
| Manage Styles (import, export, hide, order) | 🟡 | Style sets can be applied (Crumpet, Manuscript, Book, Modern); no managing beyond that. |

### Editing

| Feature | | Crumpet today |
|---|---|---|
| Find | ✅ | In a note, a chapter or the whole book, with matches highlighted. |
| Find options: match case, whole words | ✅ | |
| Advanced Find: wildcards, formatting, special characters (¶, tab, page break) | ❌ | |
| Replace, Replace all | ✅ | Can be undone, and is tracked when Track Changes is on. |
| Go To (page, section, footnote, comment…) | ✅ | F5, the command palette, or the page number in page view: a page, heading, footnote or comment by number (or +1 / -2), or the previous or next one. No sections, lines or bookmarks yet. |
| Select all | ✅ | |
| Select objects, text with similar formatting | ❌ | |
| Selection Pane | ❌ | |

### Voice, Editor, Add-ins, Copilot

| Feature | | Crumpet today |
|---|---|---|
| Dictate | ✅ | Including spoken punctuation ("comma", "new paragraph"). |
| Spelling | 🟡 | The browser's own red underlines, with Crumpet's own dictionary, characters' and places' names never marked, Ignore all (for now, from the command palette), a language, and a switch to turn it off (Settings → Writing). No spelling pass yet. |
| Grammar | ❌ | |
| Clarity, conciseness | 🟡 | The Writing tab highlights -ly adverbs, filler words and likely passive voice; no suggestions to fix them. |
| Inclusive language | ❌ | |
| Similarity checker (plagiarism) | ❌ | |
| Add-ins | ❌ | |
| Copilot | ➖ | No AI in v1 (a decision in the plan); worth revisiting later. |

## Insert

| Feature | | Crumpet today |
|---|---|---|
| Cover Page | ❌ | |
| Blank Page | ✅ | The Blank page button: an empty page at the caret, the rest moved on past it. |
| Page Break | ✅ | |
| Insert a table | ✅ | |
| Draw a table | ❌ | |
| Convert text to table | ❌ | |
| Excel spreadsheet in the document | ❌ | |
| Quick Tables (ready-made calendars, tables) | ❌ | |
| Pictures from the device | ✅ | Also pasted or dropped in. |
| Stock images, online pictures | ❌ | |
| Shapes | ✅ | Rectangle, rounded rectangle, oval, line, arrow. Word has many more (stars, callouts, flowchart shapes). |
| Icons | ❌ | |
| 3D Models | ❌ | |
| SmartArt | 🟡 | Diagrams written as text (Mermaid flowcharts, timelines); no picture-based SmartArt gallery. |
| Chart | ❌ | No bar/line/pie charts from data. |
| Screenshot / screen clipping | ❌ | |
| Online Video | 🟡 | Uploaded video files play; no YouTube or web video in the text. |
| Link | ✅ | Web links and [[note links]]. |
| Bookmark (a place in the text to link to) | 🟡 | Headings can be bookmarked in the sidebar; no bookmark on any spot of the text, no links to it. |
| Cross-reference ("see page 12", "see Figure 3") | ❌ | |
| Comments | ✅ | |
| Header, Footer, Page Number | ✅ | Left/centre/right places, fields such as page number, number of pages, chapter title, author, date. |
| Text Box | ✅ | |
| Drop Cap | 🟡 | Dropped, 2 to 5 lines tall; to and from Word. No "in margin" kind, and no font or distance of its own. |
| Signature Line | ❌ | |
| Date & Time | ✅ | In a choice of forms, as text or (Update automatically) a field that shows the day it's read; to and from Word as DATE/TIME fields. |
| Quick Parts: AutoText, Building Blocks | 🟡 | Templates cover whole notes; no saved snippets to drop in. |
| Quick Parts: Document Property, Field | 🟡 | Fields in headers and footers; in the text, date and time fields only. |
| WordArt | ❌ | |
| Object (embedded/linked file) | 🟡 | Files can be attached in the text (shown as a chip); not embedded as editable objects. |
| Text from file (put a whole document into this one) | ❌ | |
| Equation | 🟡 | Written in LaTeX and drawn at once. No equation toolbar of structures, no UnicodeMath, no ink equation. |
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
| Themes | 🟡 | Themes change the app's look, not the document's (in Word a theme changes the document's colours and fonts and goes with the file). |
| Style Sets | ✅ | Crumpet, Manuscript, Book, Modern. |
| Colours, Fonts (for the whole document) | 🟡 | Done by modifying styles one by one. |
| Paragraph Spacing presets | 🟡 | Comes with the style sets; no separate menu. |
| Effects | ❌ | |
| Set as Default | 🟡 | Styles are kept per project; no "use these for every new document". |
| Watermark ("DRAFT", "CONFIDENTIAL") | ❌ | |
| Page Colour | 🟡 | The paper colour you write on is an app setting; it isn't saved in the document or printed. |
| Page Borders | ❌ | |

## Layout

| Feature | | Crumpet today |
|---|---|---|
| Margins | ✅ | Per section too. |
| Orientation | ✅ | Per section too. |
| Size | 🟡 | Letter, A4, A5, 6 × 9 in book, Legal. No custom size, and one size for the whole document. |
| Columns | ✅ | Per section, balanced before a continuous break. |
| Breaks: page, column | ✅ | |
| Breaks: text wrapping | ❌ | |
| Section breaks: next page, continuous | ✅ | |
| Section breaks: even page, odd page | ❌ | |
| Line Numbers | ❌ | |
| Hyphenation | ❌ | |
| Paragraph: Indent, Spacing | ✅ | |
| Wrap Text | 🟡 | For pictures, shapes and text boxes: in line, square left or right, in front of the text. Not behind the text, and not "tight". |
| Position | 🟡 | Pictures and shapes in front of the text can be dragged anywhere; placed from their paragraph, not the page. |
| Bring Forward / Send Backward | ❌ | |
| Align, Group | ❌ | |
| Rotate | ✅ | Pictures, shapes and text boxes: by the handle above them, or 90° from their menu. |

## References

| Feature | | Crumpet today |
|---|---|---|
| Table of contents: insert | ✅ | With page numbers; in a project it lists the whole book. |
| Table of contents: update | ✅ | Updates by itself. |
| Table of contents: Add Text (include a paragraph) | 🟡 | Only headings are included. No choice of levels or styles of contents. |
| Footnote | ✅ | Numbered through the whole book. |
| Endnote | ❌ | A Word file's endnotes come in as empty footnote numbers: their text is lost. |
| Next Footnote, Show Notes | ✅ | Footnotes are listed under the note, with Previous and Next footnote (also in the command palette and Go To). |
| Research: Search, Researcher | 🟡 | Research notes beside the writing, web clipper, thesaurus and definitions; no searching the web from inside Crumpet. |
| Insert Citation, Manage Sources | ❌ | |
| Citation styles (APA, MLA, Chicago), Bibliography | ❌ | |
| Insert Caption | 🟡 | Pictures have captions, and there's a Caption style; no automatic numbering ("Figure 3"). |
| Table of Figures | ❌ | |
| Cross-reference | ❌ | |
| Index: Mark Entry, Insert Index | ❌ | |
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
| Editor (spelling and grammar pass) | 🟡 | See Home → Editor above. |
| Thesaurus | ✅ | Shift+F7, with definitions. |
| Word Count | ✅ | In the status bar (and selected words), plus full statistics. |
| Read Aloud | ✅ | Each word lit as it's read; voice and speed. |
| Check Accessibility | ❌ | |
| Translate (selection or document) | ❌ | |
| Proofing language (per paragraph) | ❌ | |
| Comments: new, reply (threaded), show | ✅ | Listed in the right sidebar too. |
| Comments: resolve | 🟡 | Resolving takes the comment away; Word keeps it, greyed out, and can reopen it. |
| Comments: delete, previous/next | 🟡 | Resolving is the way to delete one; no next/previous buttons. |
| Comments: @mentions | ❌ | Needs sharing first. |
| Track Changes on/off | ✅ | Plus Crumpet's own revision colours. |
| Track Changes: just mine / Lock Tracking | ❌ | |
| Display for Review (Simple / All Markup / No Markup / Original) | ❌ | Changes are always shown in full. |
| Show Markup (choose what's shown, by person) | ❌ | |
| Reviewing Pane (all changes in a list) | ❌ | There's a count with Accept all / Reject all, but no list. |
| Accept, Reject (one, or all) | ✅ | |
| Previous / Next change | ❌ | |
| Compare two versions | ✅ | Word by word, or as a copy with the differences as tracked changes. |
| Combine (several reviewers' copies into one) | ❌ | |
| Block Authors, Restrict Editing | ❌ | |
| Hide Ink | ➖ | There's no ink. |
| Resume Assistant | ➖ | Retired. |

## View

| Feature | | Crumpet today |
|---|---|---|
| Read Mode | ✅ | Reading view. |
| Print Layout | ✅ | Page view. |
| Web Layout / Draft | ✅ | The text as one long page (the usual way of writing notes). |
| Outline view | 🟡 | Headings fold away, there's a headings outline beside the text, and projects have their outline and corkboard; no Word-style outline view with levels to promote and demote. |
| Focus | ✅ | Focus mode, plus typewriter mode. |
| Immersive Reader: line focus | 🟡 | Typewriter mode fades the other paragraphs. |
| Immersive Reader: text spacing, syllables, picture dictionary | ❌ | |
| Page Movement: vertical | ✅ | |
| Page Movement: side to side (like a book) | ❌ | |
| Ruler | ✅ | |
| Gridlines | ❌ | |
| Navigation Pane: headings | ✅ | Right sidebar's outline, and the status bar. |
| Navigation Pane: pages (thumbnails) | ❌ | |
| Navigation Pane: results | 🟡 | Find highlights matches and counts them; no list of results with their text around them. |
| Zoom, 100%, Page Width | ✅ | 25%–300% and "Fit". |
| Zoom: One Page, Multiple Pages | ❌ | Pages are always one under the other. |
| New Window | 🟡 | Panes and tabs do much the same inside one window. |
| Arrange All, Split, View Side by Side | ✅ | Panes side by side or one above the other, with tabs in each. |
| Synchronous Scrolling | ❌ | |
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
| Borders | 🟡 | All lines, outside only, between rows, none. No line styles, thickness, colour or per-cell borders. |
| Border painter | ❌ | |
| Header row, banded rows | ✅ | |
| First column, last column, total row, banded columns | ❌ | |

### Table Layout

| Feature | | Crumpet today |
|---|---|---|
| Insert/delete rows and columns | ✅ | |
| Merge / split cells | ✅ | |
| Cell size (column widths) | 🟡 | Column widths; no row heights. |
| Distribute rows/columns evenly | ❌ | |
| Alignment | 🟡 | Left/centre/right for a whole column; not per cell, not top/middle/bottom. |
| Text direction | ❌ | |
| Cell margins | ❌ | |
| Repeat Header Rows on each page | ❌ | |
| Convert table to text | ❌ | |
| Sort | ❌ | |
| Formula (=SUM) | ❌ | |
| More than one paragraph in a cell | ❌ | A cell holds one line of formatted text. |

### Picture Format

| Feature | | Crumpet today |
|---|---|---|
| Resize | ✅ | Drag a picture's corner (it keeps its shape); Original size in its menu. |
| Crop (to shape, to aspect ratio) | ✅ | Drag the edges (Crop in the picture's menu), crop to a ratio (square, 4:3, 3:2, 16:9, 3:4) or to a shape (oval, rounded, triangle, diamond, hexagon, star); to and from Word. |
| Remove Background, Corrections, Colour, Artistic Effects, Transparency | 🟡 | Corrections and effects window: brightness, contrast, colour, see-through, and six effects (black and white, sepia, washout, vintage, blur, negative). Brightness, contrast, black and white and see-through go to Word; colour and the other effects don't. No background removal yet. |
| Compress | 🟡 | Pictures are sized down for Word and e-books, not on request. |
| Change Picture, Reset | ✅ | In the picture's menu: another picture keeps the size and look; Reset goes back to how it was put in (keeping the alt text). |
| Picture Styles, Border, Effects | ✅ | Simple frame, white frame, shadow, rounded corners, soft edges and snapshot; a coloured border. Word gets the nearest it has (a line, a shadow, rounded corners). |
| Alt Text | ✅ | Its own, apart from the caption (the caption serves when there's none); to and from Word and in e-books. |
| Wrap, position, rotate | ❌ | Only shapes have these. |

### Shape Format

| Feature | | Crumpet today |
|---|---|---|
| Insert shapes | ✅ | Five kinds. |
| Edit Shape / Edit Points | ❌ | |
| Shape Styles (ready-made looks) | ❌ | |
| Fill, Outline | ✅ | A choice of colours; no gradients, line thickness or dashes. |
| Effects (shadow, glow, 3D) | ❌ | |
| WordArt Styles | ❌ | |
| Text in a shape | 🟡 | One paragraph of text. |
| Text Direction | ❌ | |
| Arrange (wrap, position, rotate) | 🟡 | See Layout → Arrange. |
| Size | ✅ | Drag the corner. |

### Graphics, SmartArt, Chart

| Feature | | Crumpet today |
|---|---|---|
| Graphics Format (icons, SVG, Convert to Shape) | ❌ | |
| SmartArt Design/Format | ❌ | (Mermaid diagrams are the stand-in.) |
| Chart Design/Format | ❌ | |

### Header & Footer

| Feature | | Crumpet today |
|---|---|---|
| Edit in place (double-click top or bottom of a page) | ✅ | |
| Different First Page | ✅ | Also a different first page for each chapter. |
| Different Odd & Even pages | ✅ | |
| Link to Previous (different headers per section) | ❌ | One set of headers and footers for the whole document. |
| Header/footer position (distance from the edge) | ❌ | |
| Go to Header / Footer | ✅ | By double-clicking. |
| Page number formats (1, 2, 3 / i, ii, iii…) | ✅ | |

### Equation

| Feature | | Crumpet today |
|---|---|---|
| Professional / Linear view | 🟡 | You write the LaTeX (linear) and see the drawn result (professional) together. |
| Structures (fractions, scripts, radicals, integrals, matrices) | ❌ | No buttons for them; they're typed in LaTeX. |
| Maths symbols palette | ❌ | |
| Equations inside a line of text | ❌ | An equation is a block of its own. |

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
- [ ] Remove background
- [ ] Compress on request

**3. Reviewing**
Where: `app/src/ui/changes.tsx`, `comments.tsx`, `rightside.tsx`, `comparedocs.tsx`; `model.ts` (`Comment`, `Change`); `docx.ts`.
- [ ] Markup views: Simple, All Markup, No Markup, Original
- [ ] Reviewing pane: every change and comment listed, with who and when
- [ ] Previous/next change; previous/next comment
- [ ] Resolved comments kept (greyed out, reopen), also to and from Word
- [ ] Track just my changes, or everyone's
- [ ] Lock tracking (with a password)
- [ ] Show markup by kind and by person
- [ ] @ names in comments (a label only; nothing is sent)
- [ ] Combine several reviewers' copies into one

**4. Fonts and paragraphs**
Where: `model.ts` (`Look`, `Mark`, `ParaLook`), `markdown.ts`, `docx.ts`, `app/src/ui/fonttools.tsx`, `listtools.tsx`, `paratools.tsx`.
- [ ] Small caps, all caps, double strikethrough, hidden text
- [ ] Underline styles (double, dotted, dashed, wavy, coloured)
- [ ] A Font window: character spacing and kerning
- [ ] Ligatures and number styles (OpenType)
- [ ] Text effects (outline, shadow, glow, reflection)
- [ ] Paste options menu after pasting (keep, merge, text only)
- [ ] Clipboard history
- [ ] Multilevel list gallery, and defining your own
- [ ] Sort paragraphs
- [ ] Paragraph border styles (dashed, double, thickness, colour)
- [ ] Widow/orphan control switch per paragraph

**5. Styles, find and selecting**
Where: `app/src/data/styles.ts`, `ui/stylespane.tsx`, `ui/styles-ui.tsx`, `ui/find.tsx`, `packages/editor/src/find.ts`.
- [ ] Create your own styles
- [ ] Reveal formatting (Style Inspector)
- [ ] Manage styles: copy between documents, hide, order
- [ ] Set as default for new documents
- [ ] Advanced find: wildcards, formatting, special characters
- [ ] Find results list with the words around each match
- [ ] Select text with similar formatting
- [ ] Selection pane (shapes, pictures, text boxes)

**6. Tables**
Where: `packages/editor/src/table.ts`, `cells.ts`, `view.ts` (the Table menu), `paginate.ts`, `markdown.ts`, `docx.ts`.
- [ ] Several paragraphs, lists or pictures in a cell
- [ ] Cell alignment per cell, and top/middle/bottom
- [ ] Repeat the heading row on each page
- [ ] Row heights
- [ ] Distribute rows/columns evenly
- [ ] Cell margins
- [ ] Text direction in cells
- [ ] Border styles per cell, and the border painter
- [ ] Table style options: first column, last column, total row, banded columns
- [ ] Convert text to table, and table to text
- [ ] Sort a table
- [ ] Formulas (=SUM and friends)
- [ ] Draw a table
- [ ] Quick tables (calendars, lists, matrix)

**7. Book and non-fiction tools**
Where: `model.ts` (footnotes), `paginate.ts`, `app/src/ui/booktoc.ts`, `footnotes.tsx`, `print.tsx`, `docx.ts`, `epub.ts`.
- [ ] Endnotes, turning footnotes into endnotes, and keeping a Word file's endnotes (their text is lost on import today: `docx.ts`, `endnoteReference`)
- [ ] Contents options: levels, Add Text, contents styles
- [ ] Numbered captions (Figure 1, Table 2)
- [ ] Table of figures
- [ ] Cross-references that update
- [ ] Bookmarks on any spot of the text, and links to them
- [ ] Index: mark entries, insert the index
- [ ] Citations, sources and a bibliography (APA, MLA, Chicago…)
- [ ] Web search in the right sidebar (Wikipedia, the web), into research
- [ ] Fields in the text (page, words, title, author…)
- [ ] Saved snippets (AutoText / Building Blocks)
- [ ] Text from file (another document poured in at the caret)

**8. Page layout and design**
Where: `paginate.ts`, `app/src/ui/pagesetup.tsx`, `layouttools.tsx`, `pages.tsx`, `headers.tsx`, `data/headers.ts`, `data/styles.ts`, `print.tsx`, `docx.ts`.
- [ ] Hyphenation (automatic and manual)
- [ ] Headers and footers per section (Link to Previous)
- [ ] Header and footer distance from the edge
- [ ] Odd page / even page section breaks
- [ ] Custom paper sizes, and size per section
- [ ] Line numbers
- [ ] Text wrapping break
- [ ] Watermark (text or picture)
- [ ] Page colour saved in the document, printed and sent to Word
- [ ] Page borders
- [ ] Cover pages
- [ ] Document themes; theme colours and fonts menus
- [ ] Paragraph spacing presets
- [ ] Design effects

**9. Shapes and arranging**
Where: `packages/editor/src/shape.ts`, `view.ts` (the Shape menu), `paginate.ts`, `docx.ts`.
- [ ] Wrap behind the text, tight, top and bottom
- [ ] Position from the page's corner or margins
- [ ] Bring forward / send backward
- [ ] Align and group
- [ ] More shapes (stars, callouts, banners, flowchart, block arrows)
- [ ] Shape styles gallery
- [ ] Fill and line options: gradients, picture fill, thickness, dashes, arrowheads
- [ ] Shape effects (shadow, glow, soft edges, 3D)
- [ ] Several paragraphs and lists in a shape
- [ ] Text direction in shapes
- [ ] Linked text boxes
- [ ] Edit points
- [ ] Icons library; convert icons and SVGs to shapes
- [ ] Gridlines

**10. Views and windows**
Where: `app/src/ui/pages.tsx`, `statusbar.tsx`, `NotePane.tsx` (reading view), `panes.tsx`, `rightside.tsx`.
- [ ] Word-style outline view (promote, demote, drag)
- [ ] One page / multiple pages zoom
- [ ] Side-to-side pages (like a book)
- [ ] Page thumbnails in the navigation pane
- [ ] Immersive reader: letter, word and line spacing, column width
- [ ] Syllables, parts of speech, picture dictionary
- [ ] New window on the same document
- [ ] Synchronous scrolling of two panes

**11. Checking and files**
Where: `app/src/data/docx.ts`, `textstats.ts`, `ui/writingtab.tsx`, `ui/print.tsx`, `data/documents.ts`.
- [ ] Accessibility checker
- [ ] Compatibility checker (what won't survive in Word)
- [ ] Document inspector (comments, changes, authors, hidden text)
- [ ] Spelling pass with suggestions
- [ ] Clarity suggestions (from the Writing tab's highlights, plus wordy phrases)
- [ ] Inclusive language
- [ ] Grammar checking (needs an outside service such as LanguageTool: ask Peter first)
- [ ] More download types: .odt, .rtf, .html, .txt
- [ ] Crumpet's own print screen (preview, page ranges, copies)
- [ ] Password protection
- [ ] Read-only / restrict editing
- [ ] Mark as final
- [ ] Digital signature

**12. Bigger additions**
- [ ] Equation toolbar (fractions, scripts, roots, integrals, matrices)
- [ ] Maths symbols palette
- [ ] Equations within a line
- [ ] UnicodeMath, and handwritten maths
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
