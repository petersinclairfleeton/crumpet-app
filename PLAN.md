# Crumpet — Plan

A playful note-taking app that later grows a full, Word-like document editor.
This is a clean restart: nothing is carried over from the previous Crumpet codebase.

## Decisions so far

| Area | Decision |
|---|---|
| Focus | Note-taking first; drafting documents second |
| Notes vs documents | Separate spaces. Documents can link to and quote notes |
| Organising notes | Folders and tags |
| Documents | Fiction and non-fiction first. Must feel as seamless as Word: page view, rich formatting, .docx import/export, comments and tracked changes. Blog formatting later |
| Feel | Playful: colour and character |
| Platforms | Mac, iPad, iPhone, web |
| Sync | Seamless cloud sync with accounts |
| Audience | Personal first, built so it can be released later |
| AI | Not in v1 |
| Codebase | One web codebase (React + TypeScript), wrapped for Apple platforms |
| Editor | Built fully from scratch: our own editing engine, no Tiptap/ProseMirror/Lexical |

## Phases

1. **Notes (v1)**: a synced, playful notes app with folders, tags, search and our own rich-text editor.
2. **Documents (v2)**: the separate documents space, linking/quoting notes, page view, rich formatting.
3. **Word parity (v3)**: .docx import/export, comments, tracked changes.
4. **Later**: blog post formatting, sharing, AI assist.

## v1 scope: Notes

- Create, edit and delete notes; trash with restore
- Folders (nested) and tags
- Full-text search
- Rich text: headings, bold/italic/underline/strike, lists, checklists, links, quotes, code, images
- Pinning, colours per note/folder (part of the playful identity)
- Account sign-in; offline editing; sync across all four platforms
- Light and dark themes

Out of v1: documents, pages, .docx, comments, sharing, AI.

## Architecture (proposed, open for discussion)

- **App:** React + TypeScript + Vite, one codebase.
- **Web:** deployed as a progressive web app.
- **iPhone/iPad:** Capacitor wrapper.
- **Mac:** Tauri or Electron wrapper (to decide).
- **Editor:** our own engine. Document model (tree of blocks and inline marks) is separate from rendering; every edit is a small, invertible operation (gives undo/redo and sync for free). Input handled via `beforeinput` events, our own selection model, custom rendering. IME/composition, mobile keyboards and accessibility are the known hard parts and need early prototypes on real devices.
- **Data & sync:** local database on each device (IndexedDB), edits recorded as operations and synced through a hosted backend with accounts (e.g. Supabase). Conflict handling designed into the editor's operation model from day one.

## Risks

- **Editor from scratch** is the largest and riskiest piece. Mitigation: build a throwaway prototype first, tested on iPhone, iPad, Mac and web, before anything else depends on it.
- **Sync conflicts**: two devices editing the same note offline. Must be solved in the operation model, not bolted on.
- **Pagination (v2)** was the fragile part of the old Crumpet; design page layout as a separate layer over the document model, not inside the editor.

## Open questions

- Visual identity: palette, mascot/icon set, typography
- Mac wrapper: Tauri vs Electron
- Backend: Supabase vs alternatives; pricing once others use it
- Monetisation model if released
