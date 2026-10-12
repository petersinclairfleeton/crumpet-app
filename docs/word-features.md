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
| Options: AutoCorrect | 🟡 | Markdown shortcuts ("# " makes a heading, "- " a list). No AutoCorrect list (teh → the), no automatic curly quotes, dashes or (c) → ©. |
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
| Show/hide ¶ (formatting marks) | ❌ | |
| Alignment | ✅ | Left, centre, right, justify. |
| Line and paragraph spacing | ✅ | |
| Shading, borders | ✅ | Paragraph shading, and borders on any side. No border styles (dashed, double, thickness, colour). |
| Paragraph dialog: indents and spacing | ✅ | |
| Keep with next, keep lines together, page break before | ✅ | |
| Widow/orphan control | 🟡 | Always on; can't be switched off for a paragraph. |
| Tab stops (and the Tabs window) | ❌ | Not on Word's list above, but a big part of Word's paragraph formatting. |

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
| Go To (page, section, footnote, comment…) | 🟡 | Jump to headings (status bar, outline) and to notes/chapters (Ctrl+O). No "go to page 37". |
| Select all | ✅ | |
| Select objects, text with similar formatting | ❌ | |
| Selection Pane | ❌ | |

### Voice, Editor, Add-ins, Copilot

| Feature | | Crumpet today |
|---|---|---|
| Dictate | ✅ | Including spoken punctuation ("comma", "new paragraph"). |
| Spelling | 🟡 | The browser's own red underlines; no spelling pass, "ignore all" or custom dictionary of Crumpet's own. |
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
| Blank Page | 🟡 | Two page breaks do it; no button. |
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
| Drop Cap | ❌ | |
| Signature Line | ❌ | |
| Date & Time | ✅ | In a choice of forms. Inserted as text, not a field that updates. |
| Quick Parts: AutoText, Building Blocks | 🟡 | Templates cover whole notes; no saved snippets to drop in. |
| Quick Parts: Document Property, Field | 🟡 | Fields exist in headers and footers only, not in the text. |
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
| Wrap Text | 🟡 | For shapes and text boxes: in line, square left or right, in front of the text. Not behind the text, not "tight", and not for pictures. |
| Position | 🟡 | Shapes can be dragged anywhere; placed from their paragraph, not the page. Pictures can't be moved off their line. |
| Bring Forward / Send Backward | ❌ | |
| Align, Group | ❌ | |
| Rotate | 🟡 | Shapes and text boxes only, not pictures. |

## References

| Feature | | Crumpet today |
|---|---|---|
| Table of contents: insert | ✅ | With page numbers; in a project it lists the whole book. |
| Table of contents: update | ✅ | Updates by itself. |
| Table of contents: Add Text (include a paragraph) | 🟡 | Only headings are included. No choice of levels or styles of contents. |
| Footnote | ✅ | Numbered through the whole book. |
| Endnote | ❌ | A Word file's endnotes come in as empty footnote numbers: their text is lost. |
| Next Footnote, Show Notes | 🟡 | Footnotes are listed under the note; no "next footnote" button. |
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
| Resize | ❌ | Pictures are shown at the width of the text. |
| Crop (to shape, to aspect ratio) | ❌ | |
| Remove Background, Corrections, Colour, Artistic Effects, Transparency | ❌ | |
| Compress | 🟡 | Pictures are sized down for Word and e-books, not on request. |
| Change Picture, Reset | ❌ | |
| Picture Styles, Border, Effects | ❌ | |
| Alt Text | 🟡 | The caption is used as the alt text; no separate alt text. |
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

### Wanted, in a suggested order to build

Each group is one pull request or a few. Everyday writing first, then
reviewing, then the bigger and more specialised jobs.

**1. Everyday writing**
AutoCorrect (curly quotes, dashes, …, ©, a typo list, capitals); show/hide ¶;
tab stops and the Tabs window; drop cap; blank page button; date that updates;
go to page; next/previous footnote; spelling settings (own dictionary,
ignore all, language).

**2. Pictures**
Resize; wrap, move and rotate; crop (to shape and ratio); separate alt text;
change/reset; picture styles and borders; corrections, colour, transparency;
remove background; compress.

**3. Reviewing**
Markup views; reviewing pane; previous/next change and comment; keep resolved
comments; track just mine; lock tracking; show markup by person; @ names in
comments; combine copies.

**4. Fonts and paragraphs**
Small caps, all caps, double strikethrough, hidden text; underline styles;
character spacing and kerning; ligatures and number styles; text effects;
paste options menu; clipboard history; multilevel list gallery; sort
paragraphs; paragraph border styles; widow/orphan switch.

**5. Styles, find and selecting**
Create your own styles; reveal formatting; manage styles; set as default;
advanced find (wildcards, formatting, special characters); find results
list; select similar formatting; selection pane.

**6. Tables**
Paragraphs in cells; cell alignment (per cell, top/middle/bottom); repeat
header rows; row heights; distribute evenly; cell margins; text direction;
border styles and border painter; more table style options; convert text to
table and back; sort; formulas; draw a table; quick tables.

**7. Book and non-fiction tools**
Endnotes (and keeping Word files' endnotes); contents options; numbered
captions; table of figures; cross-references; bookmarks in the text; index;
citations, sources and bibliography; web search in the sidebar; fields in the
text; saved snippets; text from file.

**8. Page layout and design**
Hyphenation; headers per section; header distance; odd/even section breaks;
custom paper sizes per section; line numbers; text wrapping break; watermark;
page colour saved in the document; page borders; cover pages; document
themes, theme colours and fonts; paragraph spacing presets; design effects.

**9. Shapes and arranging**
Wrap behind / tight; position on the page; bring forward/back; align and
group; more shapes; shape styles; fill and line options; shape effects; more
text in shapes; text direction in shapes; linked text boxes; edit points;
icons; convert icons to shapes; gridlines.

**10. Views and windows**
Word-style outline view; multiple pages zoom; side-to-side pages; page
thumbnails; immersive reader spacing; syllables and picture dictionary; new
window; synchronous scrolling.

**11. Checking and files**
Accessibility checker; compatibility checker; document inspector; spelling
pass; clarity suggestions; inclusive language; grammar checking (needs an
outside service); more download types (.odt, .rtf, .html, .txt); Crumpet's
own print screen; password protection; read-only; mark as final; digital
signature.

**12. Bigger additions**
Equations: toolbar of structures, symbols palette, equations within a line,
UnicodeMath and handwriting. Charts; screenshot; online video; online
pictures; embedded objects; form controls; spreadsheet in a document; 3D
models. The Draw tab: pen drawing, ink to shape and maths, ink editing
gestures, drawing canvas. Macros. Customise the toolbar; add-ins; feedback
button; contact support; what's new; OneDrive connection (needs an app key
from Microsoft).
