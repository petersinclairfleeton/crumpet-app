# Pictures for social posts

Taken from the real app (light theme, Crumpet's own look) with the home page's
made-up book, *The Lighthouse*: no real person's name or writing. The agencies
in the submissions picture are invented and labelled "(made up)". PNG at twice
the screen's pixels, 16:9 (3200 × 1800) for X; the iPhone picture is iPhone 15
sized (taken in Chromium set to that size, not on a real iPhone).

| File | What it shows | The feature |
| --- | --- | --- |
| `01-writing-room.png` | The writing room, Typewriter's fade: the paragraph being written in ink | Nothing writes for you |
| `02-your-own-folder.png` | Settings → Sync and storage: Google Drive or a folder | Free, no account, your own files |
| `03-corkboard.png` | Cards: three parts, synopses, point of view, keywords, status | The corkboard |
| `04-iphone.png` | The book on an iPhone: Chapters, Cast, Research, Plan | The whole book on your phone |
| `05-drafts.png` | Draft 1 and Draft 2 of a chapter, "38% rewritten" | Drafts |
| `06-in-this-chapter.png` | The right sidebar's In this chapter: Mara, Tam, the lamp room | Who's in each chapter |
| `07-echoes.png` | The Writing tab's Highlight, Echoes on | Echoes, adverbs, filler |
| `08-grammar.png` | The Check tab's Grammar pass (Harper, on the device) | Grammar on your device |
| `09-print-ready.png` | Export → Print-ready book: trim, typeface, openings, preview | A print-ready paperback |
| `10-submissions.png` | Submissions: what's out, what they asked for, who's overdue | Submissions tracker |

The post drafts that go with them are kept out of this public repo (the launch
plan's call C2). Retake the pictures after the app's look changes (from `app/`):

```sh
CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test -c playwright.shots.config.ts social
```

The script is `app/tests/shots/social.shots.ts`; the book is in `app/tests/shots/book.ts`.
