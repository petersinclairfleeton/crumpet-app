# Crumpet app

The notes app itself (v1 in `PLAN.md`), built on our own editor engine in
`packages/editor`.

## Run it

```sh
npm install
npm run dev            # http://localhost:5173
npm test               # data layer: storage, notebooks, stacks, tags, Trash, search, upgrades
npm run e2e            # browser tests (set CHROMIUM_PATH if Playwright's browser isn't installed)
npm run typecheck
npm run build:single   # dist-single/index.html: the whole app in one file, to open on any device
```

## What's in it

- **Notebooks and stacks**, as in the design: a slate sidebar with your name and
  settings, New Note, Recent Notes, All Notes, Favorites, your notebooks and stacks,
  Tags and Trash. Crumpet starts empty: the + next to Notebooks creates a notebook or
  a stack. A notebook's menu renames it, changes its colour, moves it into, between or
  out of stacks, or deletes it (its notes go to the Trash). A stack's menu adds a
  notebook to it, renames it, or deletes it (its notebooks stay). Notes don't have to
  be in a notebook.
- **Note list**: cards grouped by Today, Yesterday, This week and month, with
  title, time, a two-line preview, notebook and tags; or a table. Starred notes
  show a star.
- **Notes**: a wrapping title, a notebook picker, tags, the star for Favorites,
  and the editor with its formatting toolbar, lists, checklists, quotes and links.
  Word count and dates at the end.
- **Search** (⌘K / Ctrl+K when not editing selected text) covers titles, text,
  tags and notebook names across every notebook, and offers matching notebooks to
  jump to.
- **Trash**: notes can be restored or deleted forever; anything older than 30 days
  is emptied automatically.
- **Settings**: your name, light/dark/match device, and the five accent colours.
- **Phones**: one pane at a time (list, then note, with the notebooks behind the menu
  button), with touch-sized controls.
- **Upgrading**: notes saved by the first version are tidied once: untouched example
  notes and empty example notebooks are removed, stacks become real stacks, and
  Shortcuts become Favorites. Anything you wrote or edited stays.

## How it's built

- React + TypeScript + Vite. The editor engine is plain TypeScript, mounted once in
  `src/ui/EditorHost.tsx` and re-loaded when another note is opened.
- `src/data/store.ts` holds the state and every action; components read it with
  `useSyncExternalStore`. `src/data/selectors.ts` derives lists, search, groups and
  previews.
- `src/data/db.ts` stores notebooks, notes and settings in IndexedDB (the browser's
  built-in database). Note text is saved half a second after typing pauses and
  immediately when the page is hidden. If the browser refuses storage, the app says
  so instead of losing work silently.

## Not yet

Sync between devices (needs a backend choice), images and featured images, drag and
drop, a desktop and iPhone/iPad wrapper, and importing from other apps.
