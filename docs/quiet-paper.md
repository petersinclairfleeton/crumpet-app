# Quiet Paper: the redesign, screen by screen

The design canvas "Crumpet Quiet Paper" (23 screens) and what's built. Ticked
items are in the app; the PR that built each is in brackets.

## Rules (screen 7)
- [x] Warm paper, honey once per screen, three corner sizes, serif titles (#141)
- [x] The chosen thing lifted, not ringed (#141)
- [x] Five tools, then More, in groups; page view's menus (#148)
- [x] Drawers open when asked: right sidebar closed until asked (Settings → Appearance → Calm)
- [x] Notes and books feel different: project mode (#144)
- [x] Empty means helpful: the first visit (#145)

## Desktop
- [x] 1 Notes: sidebar groups (#142), list cards, paper sheet (#141)
- [x] 1 Note's "Edited today at 11:25" line (#149; tags have no colours, so no dots)
- [x] 2 Writing a note: selection bar with grouped More (#148), fading bar (#143)
- [x] 3 Project mode with the inspector (#144), chapter openings (#143)
- [x] 6 First visit (#145)
- [x] 6 First visit's wording: "A clean page.", Bring in your writing, the Ctrl/⌘ K hint (#152)
- [x] 8–9 Dark mode (#141)
- [x] 11 Find anything: results grouped with a line of text, words inside found too (#149)
- [x] 12 Cards: Show synopsis / status / keywords (#152)
- [x] 13 Settings → Appearance: theme pictures (#145), Calm switches (#148)
- [x] 19 Graph: zoom and Fit, hover card (#151; the filter stays a drop-down)
- [x] 20 Board: tools floating at the bottom (#151)
- [x] 21 Export window with a preview of page 1 (#150; title page and comments options left out: the Word file has no such choices yet)
- [x] 22 Page view: Word's tools as menus (#148)
- [x] 23 Reader: a playback pill while reading aloud (#151)

## iPhone and iPad
- [x] 4 iPhone list as paper cards (#147)
- [x] 5 iPhone note: ‹ Notes (#147)
- [x] 5 iPhone keyboard bar: Aa, checklist, list, picture, More, Done (#153)
- [x] 16 iPhone library: grouped lists (#153)
- [x] 17 iPhone book: chapters as cards (#153; Chapter / Manuscript / Cards stay as the switch, with characters and research below)
- [x] 18 iPhone search: quick filters (#153)
- [x] 14 iPad landscape (#147, already close)
- [x] 15 iPad portrait: the right sidebar as a sheet from the bottom (#153)
- [x] The Mac app's window: checked with the new look, nothing needed changing (#153)

## Calmer still: clarity, restraint, consistency
After the canvas, a pass to make Crumpet feel calm and of a piece, the way an
Apple app does: fewer things on screen, one way of doing each thing, the same
look for the same kind of control everywhere.

- [x] Settings all of a piece: every page built from the same rows (`settingrows.tsx`), switches instead of tick boxes, plain examples, sync as two clear choices, each setting in one place, switches in ink (#170)
- [x] One voice: headings in normal case, one drop-down sign (`.caret`), menus without stray icons and lined up, no name over an open menu, no red dot, quieter links (#171)
- [x] Books with less on screen: no colour key, one New chapter, no how-to line, the status as words (no gap), the inspector's tabs on one line with the page's button its only switch, Read's zoom as − 100% + and its pages as one switch, ink tick boxes (#172)

## Calmer still: the phone
The same pass on an iPhone: what a phone needs, shaped the way an iPhone app is.

- [x] Writing: the keyboard bar's menus open (they were clipped out of sight) as a panel above it, its tools evenly spaced; Aa's short list of styles; the note's and chapter's ··· menus shorter, icons at the end, downloads behind one row, no keyboard shortcuts on touch screens (#173)
- [x] The library and lists: the same groups as the computer, tags as chips, no More, back buttons that say where they go, a list menu without desktop choices (Sort by only, always cards), plain Cancel, the + out of the way while searching (#174)
- [x] Settings like an iPhone's: a list of sections (with the theme and your name beside them), each a page of its own with ‹ Settings and Done; what a phone can't use left out; controls under their words (#175)
- [ ] A book: characters and research as the same rows as chapters
