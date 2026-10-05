# Crumpet — Plan

A calm, organised note-taking app that later grows a full, Word-like document editor.
This is a clean restart: nothing is carried over from the previous Crumpet codebase.

## Decisions so far

| Area | Decision |
|---|---|
| Focus | Note-taking first; drafting documents second |
| Notes vs documents | Separate spaces. Documents can link to and quote notes |
| Organising notes | Notebooks grouped into stacks (nested), plus tags |
| Documents | Fiction and non-fiction first. Must feel as seamless as Word: page view, rich formatting, .docx import/export, comments and tracked changes. Blog formatting later |
| Feel | Classic three-pane notebook (Evernote-like structure) with modern, softly rounded details. See [Visual design](#visual-design) |
| Platforms | Mac, iPad, iPhone, web |
| Sync | Seamless cloud sync with accounts |
| Audience | Personal first, built so it can be released later |
| AI | Not in v1 |
| Codebase | One web codebase (React + TypeScript), wrapped for Apple platforms |
| Editor | Built fully from scratch: our own editing engine, no Tiptap/ProseMirror/Lexical |

## Phases

1. **Notes (v1)**: a synced notes app with notebooks, stacks, tags, search and our own rich-text editor.
2. **Documents (v2)**: the separate documents space, linking/quoting notes, page view, rich formatting.
3. **Word parity (v3)**: .docx import/export, comments, tracked changes.
4. **Later**: blog post formatting, sharing, AI assist.

## Status

- **Notes app (v1)**: first version in `app/`: notebooks and stacks, tags, search, Shortcuts, Trash, settings, phone layout, notes saved on the device. Not yet: sync, images, desktop and mobile wrappers.
- **Editor**: `packages/editor`, used by the app; lists, links, undo across devices.
- **Sync**: works against a simulated server; needs a real backend.

## v1 scope: Notes

- Create, edit and delete notes; trash with restore
- Notebooks, stacks of notebooks, and tags
- Full-text search
- Rich text: headings, bold/italic/underline/strike, lists, checklists, links, quotes, code, images
- Shortcuts (pinned notes and notebooks), a colour per notebook, a featured image per note
- Account sign-in; offline editing; sync across all four platforms
- Light and dark themes, user-selectable accent colour

Out of v1: documents, pages, .docx, comments, sharing, AI.

## Visual design

Mockups: Claude design canvas "Crumpet visual identity" (identity sheet, Mac/web light and dark, iPhone list and note).

**Direction:** the structure of classic Evernote (dense three-pane layout, dark notebook sidebar), the picture-first note list of Bear, and a cleaner, more modern note page. Its own identity comes from the honey accent, notebook colours, the ⌘K jump bar, date-grouped cards and the crumpet logo.

### Colour

Calm, near-neutral greys with one accent. Nothing loud.

| Token | Light | Dark |
|---|---|---|
| Sidebar | `#2F3237` | `#151618` |
| Sidebar text / muted | `#E8E8E6` / `#A3A6AB` | `#DCDDDF` / `#95989D` |
| Sidebar selected row | `#464A50` | `#2C2E32` |
| Page (note, toolbar) | `#FFFFFF` | `#1E1F21` |
| Note list | `#F8F7F5` | `#1A1B1D` |
| Field / chip | `#F1EFEC` | `#2A2B2E` |
| Text / secondary / muted | `#26272A` / `#48494D` / `#67686C` | `#ECECEA` / `#C8C8C6` / `#9FA0A3` |
| Lines | `#E7E5E1` | `#2F3033` |

**Accent** (user-selectable): Honey `#D4A257` (default), Sage `#2F8A57`, Rosehip `#B84A5A`, Blueberry `#3E6DB5`, Plum `#7E5BB5`. Light accents carry dark text (`#2A1F0E`), dark accents carry white. Tag text and links use a darkened accent so they pass 4.5:1; soft tints (accent mixed ~85% toward the page) back tags and callouts.

**Notebook colours:** each notebook has a muted colour shown on its icon in the sidebar, the list header and the note's notebook chip: `#C98A4B`, `#6F93BF`, `#D4A257`, `#9A82BC`, `#78A88A`, `#C27D74`, `#B39A73`, grey `#9A9A9A` for Inbox.

### Type

Figtree throughout. Note title 30 px / 800, headings 19 px / 800, body 16 px / 400 at 1.75 line height, UI 13 px / 600, sidebar rows 12.5–13 px.

### Shape

Softly rounded, never bubbly: sidebar rows 4 px, chips 4 px, buttons and fields 5–6 px, cards 7 px, cover image 10 px. Circles only for avatars and the New Note "+". Lines are 1 px hairlines; shadows only on the selected card and floating mobile bars.

### Desktop layout (Mac / web)

1. **Sidebar** (Evernote order, tight ~23 px rows): account with avatar and menu → round accent "+ New Note" (⌘N) → Recent Notes (3) → All Notes, Shortcuts → Notebooks: stacks with disclosure triangles (e.g. 0 Inbox, 1 Projects, 2 Areas, 3 Resources, 4 Archive), each notebook with its coloured icon and count → Tags → Trash → logo and sync status at the bottom.
2. **Top bar**: notebook breadcrumb, centred ⌘K "Search or jump to…" field, Share button.
3. **Note list**: notebook name with its colour, note count, Cards / Table switch. Cards are grouped by date (Today, This week, then month). Each card: featured-image thumbnail on the left (52 px) when the note has one, bold title and time, two-line preview, first tag. The selected card is white with a 1.5 px accent ring. Table view keeps the classic Created / Title / Notebook / Size columns.
4. **Note**: formatting toolbar with "Edited" time; optional cover image (the note's featured image) with "Change cover"; large title; chips for notebook, tags and "+ tag"; body with callout blocks (accent tint), checklists, inline images with captions; word count and reading time at the end.

### iPhone

- **List**: back link to the stack, notebook title with colour, search within the notebook, date-grouped cards with left thumbnails (56 px). A floating slate tab bar (Notes, Notebooks, Shortcuts, Search) and a separate accent "+" button.
- **Note**: back link, Share and More, cover image, title, notebook and tag chips, body. A floating formatting bar sits above the keyboard (style, bold, italic, checklist, image, tag, hide keyboard). Touch targets at least 44 px.
- **iPad**: not designed yet; uses the desktop layout with taller rows for touch.

### Logo

A filled accent circle with a few round "holes", like a crumpet. Used in the sidebar footer, app icon and loading states.

## Architecture (proposed, open for discussion)

- **App:** React + TypeScript + Vite, one codebase.
- **Web:** deployed as a progressive web app.
- **iPhone/iPad:** Capacitor wrapper.
- **Mac:** Tauri or Electron wrapper (to decide).
- **Editor:** our own engine. Document model (tree of blocks and inline marks) is separate from rendering; every edit is a small, invertible operation (gives undo/redo and sync for free). Input handled via `beforeinput` events, our own selection model, custom rendering. IME/composition, mobile keyboards and accessibility are the known hard parts and need early prototypes on real devices.
- **Data & sync:** local database on each device (IndexedDB), edits recorded as operations and synced through a hosted backend with accounts (e.g. Supabase). Conflict handling designed into the editor's operation model from day one.

## Risks

- **Editor from scratch** is the largest and riskiest piece. Mitigation: build a throwaway prototype first, tested on iPhone, iPad, Mac and web, before anything else depends on it. Status: prototype started in `prototypes/editor` and passing in Chromium; real-device testing (Safari, iOS, Android, IMEs) is next.
- **Sync conflicts**: two devices editing the same note offline. Must be solved in the operation model, not bolted on. Status: first version in `prototypes/editor/src/sync` (server-ordered operations, devices rebase their pending edits); randomised three-device tests converge. Undo across devices works too. Open: a real server and storage.
- **Pagination (v2)** was the fragile part of the old Crumpet; design page layout as a separate layer over the document model, not inside the editor.

## Open questions

- iPad layout details; empty states and onboarding
- Mac wrapper: Tauri vs Electron
- Backend: Supabase vs alternatives; pricing once others use it
- Monetisation model if released
