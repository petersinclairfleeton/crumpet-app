# Home page pictures

Taken from the real app (light theme, Crumpet's own look) with a made-up book,
*The Lighthouse*: no real person's name or writing. PNG at twice the screen's
pixels, no browser frame.

| File | What it shows | Size |
| --- | --- | --- |
| `hero.png` | The writing room: the middle of a chapter, the caret at the end of the line being written, the sidebar folded to its strip | 3360 × 1890 |
| `hero-typewriter.png` | The same, with Typewriter's fade: the paragraph being written in ink, the rest faded back | 3360 × 1890 |
| `corkboard.png` | Cards: three parts, scene names, synopses, point-of-view colours, keywords, status | 2800 × 2020 |
| `outline.png` | The outline beside an open chapter | 2880 × 1800 |
| `characters-and-goals.png` | A chapter, a character's card beside it, and the Writing tab's This session with its target | 3360 × 1890 |
| `page-only.png` | Focus mode: nothing but the page | 2000 × 1360 |

Retake them after the app's look changes (from `app/`):

```sh
CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test -c playwright.shots.config.ts landing
```

The script is `app/tests/shots/landing.shots.ts`.
