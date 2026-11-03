# Launch plan: from here to a free launch, with no money in

Written 18 October 2026, after the October review (`docs/review-plan.md`).
It takes Crumpet from where it is to a public launch, without spending
anything. **Crumpet is free** (Peter's call, 1 November 2026: no Crumpet Pro,
no shop, no Polar), for Mac, Windows and the web, and **holds no user data**:
no accounts, no names, writing only on people's own devices and in their own
Drive or folder. Anything paid for later is Peter's choice (the upgrade
ladder).

**Peter is the producer.** He makes the calls (🎬) and does only what nobody
else legally or physically can (🙋: signing up for services, MitID). Claude Code does everything else: building, writing, pictures and
short videos, posts, emails, pages, and keeping this file up to date.

**To run it**, paste this into Claude Code in this repo:

> Continue the launch plan.

## Words used here

- **Repo**: a project folder on GitHub. Crumpet's is public; **crumpet-ops** is
  a second, private one for marketing work that only you and Claude can see.
- **Pull request** and **Merge**: Claude's proposed change, and the green
  button that says yes to it.
- **Workflow**: a small robot on GitHub that runs a job (posting, sending,
  counting) on a schedule or when asked.
- **Key** or **token**: a password-like code that lets a workflow use a
  service. It goes in the repo's safe (**Secrets**), never in a chat.
- **Buffer**: a free service that posts at set times. **Umami**: a small, free
  counting service that sees no names or writing. **Show HN**: a post on
  Hacker News, a news site many programmers read.

## The plan at a glance

| Stage | When | What happens | Your calls |
|---|---|---|---|
| 1. Safe and quick | 19 Oct – 1 Nov | Words can't be lost, long chapters type quickly, the first visit goes straight to the page, automatic checks before anything goes live | 2 |
| 2. The shop window | 19 Oct – 8 Nov | The web address, a home page, privacy and terms, the code's licence, usage counts, the newsletter, and X, Bluesky and Threads posting by themselves | 10 |
| 3. November: write with Crumpet | 1 – 30 Nov | A free push around November's novel-writing month: a 50,000-word goal, progress pictures to share, posts and emails | 1 |
| ~~4. Crumpet Pro~~ | dropped 1 Nov | No Pro: Crumpet is free | – |
| ~~5. Founders' presale~~ | dropped 1 Nov | Nothing to sell; its polish moved to stage 6 | – |
| 6. Launch | Tue 12 Jan 2027 | Polish, then Product Hunt, Show HN, Reddit, directories, the launch email | 1 |
| 7. After launch | from 13 Jan | The weekly routine, and check-ins at 30, 60 and 90 days: keep going, change course or stop | a few a week |

The first week has the most calls (about twelve, in three or four short
rounds of multiple choice). After that it's one or two a week.

## Your time

Honest estimates, with the recommended options. Claude keeps this current.

| What | When | Time |
|---|---|---|
| Answering calls and reading Claude's reports | throughout | about 3½ hours |
| Sitting 1: settings and accounts | by Sun 25 Oct | about 1 hour |
| Sitting 2: social accounts and the newsletter | by Sun 1 Nov | about 45 min |
| iPhone check (D2) | late Oct | about 30 min |
| Reading the privacy and terms pages before they go live | Nov | about 30 min |
| The weekly OK (D10) | Fridays from 30 Oct | about 10 min a week, 2 hours in all |
| Directories, Product Hunt listing, invited reviewers | Nov – Jan | about 1½ hours |
| Launch days | 12–14 Jan | 2–3 hours |
| **Total before launch** | | **about 12 hours, about an hour a week** |
| If D12 includes Hacker News and Reddit: using them as an ordinary reader so the accounts aren't brand new | 20 min twice a week until January | about 5 hours more |
| Optional, the biggest growth lever that can't be automated: replying to people yourself on X, Bluesky or Threads | 15 min, three times a week | |

## How Claude works through this plan

1. **Each session:** fetch `main` and restart the session's branch from
   `origin/main` (CLAUDE.md). If this file isn't on `origin/main`, stop and
   say so. Read this file, then **Calls made**, **Claude's calls** and
   **Waiting on Peter**. Check which tools the session has (GitHub, Gmail,
   scheduled tasks, Artifact). When a stage needs the ops repo, attach it
   (`add_repo`: owner petersinclairfleeton, repo crumpet-ops, push access),
   clone it to `/home/user/crumpet-ops` and register it
   (`register_repo_root`).
2. **Order:** first, anything whose date has arrived (dates are on stages and
   on items marked "by" or "from"), oldest first. Then the first stage with
   unticked items that aren't waiting on Peter. Items waiting on Peter (🙋, or
   an unanswered 🎬) never hold up later work. Stages 1, 2 and 3 run side
   by side. Build as CLAUDE.md says (one pull request per
   item or few items, every check, the guide updated, merged and published),
   and tick items here in the same pull request. Work done only in the ops
   repo is ticked in a small docs pull request here (several can share one).
3. **🎬 Calls:** ask Peter with the question tool, using the options given
   here, recommended first, each with its cost in money and in his time. No
   more than four at a time. Still to ask, in this order: D1, D2, D3 and
   D13; then D5, D6, D7 and D19; then D9, D11 and D12. Ask D8 with the
   first newsletter and D10 with the first weekly batch. Later calls come
   when their stage needs them. Record each answer under **Calls made** with
   the date. If Peter says "your call", take the recommendation and record
   that. Sessions that run on a schedule with nobody watching don't use the
   question tool: they put calls in **Waiting on Peter** and in the report.
4. **🙋 Peter's steps:** send them as numbered click-by-click steps with how
   long each takes, add them to **Waiting on Peter**, and carry on with
   whatever isn't blocked. Never ask him for something Claude can do.
5. **Keys and passwords never go in the chat or the repo.** Keys used by
   workflows go in a repo's secrets (GitHub → the repo → Settings → Secrets
   and variables → Actions), under the names this plan gives. Public values
   (website ids, form addresses) go in `app/.env`. This container can't
   reach most outside services (Buffer, the email service, Umami, even the
   live site), so
   anything that calls them runs as a workflow, which Claude starts
   (`actions_run_trigger`) and reads (`get_job_logs`) through the GitHub
   tools. Workflow logs in a public repo are public, so such workflows live
   in the ops repo.
6. **No money.** Only free plans: nothing that takes a card, charges, or
   starts a trial that becomes a charge. Paid things are only on the
   **Upgrade ladder**, each needing Peter's yes (Crumpet earns nothing, so
   they're paid by Peter). If a free plan's limits bite, or a price or plan
   has changed, raise it as a call.
7. **Re-check before relying.** Every outside service's prices, limits and
   rules here were researched on 18 October 2026, some only from search
   results. When setting a service up, check its own pages, in this order:
   WebSearch (note the page and date); a manual workflow in the ops repo
   (`fetch-pages.yml`) that fetches a list of addresses with curl and prints
   their text to its log; otherwise ask Peter to look, or (for Danish rules)
   to ring Skattestyrelsen's business line. Note here what changed and how
   it was checked.
8. **The repo is public.** Never put in it: keys, anyone's name or email
   (subscribers, reviewers, people who sent a report), subscriber numbers
   (unless Peter chooses to share them, D10), his CPR number or bank
   details. Those belong in the ops repo, its secrets, or
   Peter's Google Drive.
9. **Nothing goes out in Peter's name without his OK** (posts, emails,
   listings): per weekly batch, or by a standing rule he gives in D10. Social
   posts follow X's automation rules: scheduled original posts only. Never
   automated replies, likes, follows or messages; no trending hashtags or
   topics; never the same post twice on one account or on two X accounts.
   Never message anyone who hasn't asked (by email or direct message):
   Danish law treats it as spam. Never add anyone to the newsletter who
   didn't sign up themselves.
10. **Honest marketing.** Every claim true and checkable ("free" and "holds
    no user data" included: if something changes, the words change first); no
    fake reviews; never ask for upvotes (Product Hunt, Hacker News and Reddit
    forbid it); quote writers only with their written yes. Whenever Peter
    mentions Crumpet from his own accounts (replies, Reddit, Hacker News,
    Product Hunt, forums), the post itself says he makes it ("I make
    Crumpet"), and his bios say so too.
11. **Pages with legal weight wait for Peter.** Privacy, terms and About
    (with his address) go in a pull request of their own
    that isn't merged until he OKs the wording. Claude shows the full text
    on a private page (Artifact) or in the question tool, not as a diff.
    Everything else merges as CLAUDE.md says. Usage counts and the newsletter
    sign-up are switched on only in or after the pull request that publishes
    the privacy page he approved.
12. **Crumpet stays calm and people's words stay theirs.** No pop-ups or
    nagging: sign-ups are quiet lines and Settings rows. Nothing that keeps
    data about people (accounts, names, tracking) without Peter's yes.
13. **End each session** with CLAUDE.md's summary, plus the next call coming
    up, anything waiting on Peter, and an updated **Your time**.

## Calls made

Newest last. The review plan's calls still stand: first visit straight to the
page; Word is done; the classic window retires; one name, "book".

- 18 Oct 2026: no money in until Crumpet earns it; upgrades are paid from
  earnings. (Since 1 Nov Crumpet earns nothing: upgrades are Peter's choice.)
- 18 Oct 2026: marketing is organic: a Crumpet X account and an email
  newsletter.
- 18 Oct 2026: Peter makes the calls; Claude does the work and asks along the
  way.
- 1 Nov 2026: Crumpet for Windows alongside the Mac app, as free downloads
  (`desktop.yml`, released on purpose).
- 1 Nov 2026: D4 · support address: **info.crumpetapp@gmail.com**, where Help →
  Report a problem sends bug reports and feedback.
- 1 Nov 2026: **no accounts and no name**: Crumpet holds no user data. Firebase
  and the sign-in screen are gone; comments are signed "Author"; a book has its
  own Author name. 🙋 Peter deletes the Firebase project's users (or the
  project).
- 1 Nov 2026: **no Crumpet Pro and no Polar: Crumpet is free.** Stages 4 and 5
  are dropped, with D14–D18 and D20; D19 (the code's licence) moved to stage 2.
- 3 Nov 2026: D9 · voice: **Crumpet as a brand** (@Crumpetwriting on X), never
  personal posts or Peter's own stories; second person, about quitting and
  finishing, for someone who has never finished a book (the voice is kept in
  Peter's Eden). Rule 10's "I make Crumpet" applies only to his own accounts.

## Claude's calls (you can overrule any)

Technical choices Claude has made so as not to ask you. Say the word to
change one.

- C1. At the new address (D3), the home page is at its root and the app at
  `/app/`. The old address forwards there and helps move notes across.
- C2. Marketing work lives in a private repo, **crumpet-ops**: post drafts,
  newsletter issues, the numbers and service keys, and any contact details,
  which mustn't go in the public repo.
- C3. The lighter first download (review group 8) happens before launch,
  because it makes Crumpet faster on older phones on launch day.
- C4. Retiring the classic window (review group 5, your 17 Oct call) waits
  until after launch, to keep launch month low-risk.
- C5. The weekly routine runs on Fridays, so its report and next week's posts
  reach you in one go.

## Waiting on Peter

Kept current by Claude: what's blocked on Peter, and since when.

- Nothing yet.

---

## Stage 1. Safe and quick (19 Oct – 1 Nov)

Before strangers use Crumpet, their words must be safe, long chapters must
type quickly, and nothing broken may reach the live app. Mostly the review's
groups 6, 3, 2 and 4, in that order; their details and where to start in the
code are in `docs/review-plan.md` (tick them there too).

🎬 **D1 · Feature freeze until launch**
- **Freeze** (recommended): only this plan's items and fixes until launch.
  Everything already built stays.
- Small additions when Claude thinks they help the launch, asking first.
- Keep building new features alongside.

🎬 **D2 · Typing on a real iPhone.** Our own editor has never been tried with
autocorrect, predictive text and dictation on a real phone; `PLAN.md` names it
the top risk.
- **You, about 30 minutes** (recommended): Claude writes
  `docs/device-checklist.md` (the review's group 7, cut to the ten checks that
  matter); you go through it on your iPhone and say what misbehaves.
- The November writers do it (the checklist goes in their welcome email); the
  first strangers would meet the bugs.
- Skip it.

- [ ] Checks before merging (review group 6). First, remove the fixed
      `/home/user/crumpet-app/` path from the tests (46 places in
      `tests/e2e/app.spec.ts`, one in `tests/shots/guide.shots.ts`): build it
      from the working folder (a `globalThis` cast for `process`, as CLAUDE.md
      says) or reach `fromMarkdown`/`toMarkdown` through the dev-only
      `window.crumpet` hook. Prove it by running the browser tests from a
      checkout in another folder. Then a pull-request workflow
      (`.github/workflows/checks.yml`): app and editor types and tests, a
      build, and the browser tests split over four runners. The Pages
      workflow runs the editor's tests too. Claude merges only once every
      check on the pull request is green (`pull_request_read`, check runs;
      `subscribe_pr_activity` to hear when they finish, rather than
      polling). Add that to CLAUDE.md's shipping step 4. 🙋 Optional, 3
      minutes: a GitHub rule that blocks merging until the checks pass
      (crumpet-app → Settings → Rules → New branch ruleset for `main` →
      Require status checks).
- [ ] Words can't be lost (review group 3): ask the browser to keep Crumpet's
      storage; Settings → Download everything (a .zip of the same Markdown
      folder sync writes) and taking it back in; "Only on this device · Keep
      a copy" in the sidebar while nothing is connected. This must ship before
      the move in D3.
- [ ] Quick typing in long writing (review group 2), all five items. The
      speed test (under 35 ms per key at 30,000 words, from 111) is tagged
      `@perf` and left out of the pull-request checks (`--grep-invert @perf`),
      because timings on GitHub's shared machines vary. It runs here, and on
      GitHub when asked.
- [ ] A gentler first visit (review group 4): straight to the page. The
      sign-in screen went with accounts on 1 Nov; the guide still opens by
      itself. (One Google step and the account in Settings were dropped with
      accounts: Drive's is the only sign-in.)
- [ ] Fresh pictures for people who've visited before: the service worker
      keeps non-hashed files (guide pictures, brand, and soon the home page's
      images) forever, so retaken pictures never reach returning visitors.
      Make them refresh in the background (hashed `/assets/` files stay as
      they are) and check the app still starts offline. Where:
      `app/public/sw.js` (the fetch handler, `CACHE`, `keepPage()`).
- [x] The Mac app released on purpose: `mac.yml` runs only when started
      (`workflow_dispatch`; Claude starts it with `actions_run_trigger` on
      `main`), with release notes from `data/whatsnew.ts`. The Mac app says
      when a newer version is out (it doesn't update itself). Releases happen
      after changes that matter to the Mac app (the D3 move doesn't). Where: `.github/workflows/mac.yml`, `desktop/main.cjs`,
      `desktop/preload.cjs`, `app/src/data/desktop.ts`.
      Done 1 Nov, together with **Crumpet for Windows** (Peter asked for a free
      download on both): `mac.yml` became `desktop.yml` ("Desktop apps"), which
      builds both and publishes one release `v1.1.<run>`; the newer-version
      check is `desktop/updates.cjs`; notes from `desktop/release-notes.mjs`.
- [ ] 🙋 Google sign-in open to everyone: in sitting 1 (stage 2).

## Stage 2. The shop window (19 Oct – 8 Nov)

Somewhere to send people, a way to hear from them, a list to write to, and
accounts that post by themselves. Runs alongside stage 1.

### The web address

GitHub's terms say Pages "is not intended for or allowed to be used as a free
web-hosting service to run your online business … or providing commercial
software as a service", and "shouldn't be used for sensitive transactions like
sending passwords". That was the reason to move while Crumpet was going to sell
Pro and had accounts with passwords. Since 1 Nov it does neither: a free app
with no passwords is what Pages is for. (Recommendation changed 1 Nov; not yet
asked.)

🎬 **D3 · Crumpet's web address**
- **Stay on GitHub Pages** (recommended since 1 Nov): free, nothing moves, no
  forwarding page, and nothing for you to set up. If a domain comes later (the
  ladder), that's the one move, with the forwarding helper below.
- Move to a free Cloudflare address now, something like crumpet.pages.dev: a
  shorter address, the home page at its root, but a move (about 20 minutes of
  your clicks, and the forwarding helper) for no rule that needs it.
- Buy a domain now (about 100 kr a year): a proper address, but it breaks the
  no-money rule.

- [ ] A free trademark search for "Crumpet" in software classes 9 and 42
      (EUIPO's TMview, the USPTO's search, the Danish DKPTO), before the
      social accounts and home page. A clash becomes a call before anything more is
      built on the name.
- [ ] Only if D3 is a move. The move (after Download everything has shipped): a
      deploy workflow to Cloudflare from crumpet-app (secrets
      `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`), building the app
      with `--base=/app/` and the home page at the root (C1). The old GitHub
      address becomes a forwarding page: if the browser there holds notes
      that aren't in Drive or a folder, it offers "Bring my notes to the new
      address". It opens the new address and passes the notes across in the
      browser (the same .zip as Download everything); otherwise it forwards
      at once, keeping `#clip=` links (clipper bookmarks made before the move
      still point at the old address). Update every place the address
      appears: `desktop/main.cjs` (the "Crumpet on the web" menu link),
      `.github/workflows/pages.yml`, README, CLAUDE.md, PLAN.md,
      `docs/google-drive-setup.md`, and the desktop
      release notes (`desktop/release-notes.mjs`). 🙋 Peter's part is in sitting 1.
- [ ] The ops repo (C2): `crumpet-ops`, private, made by Claude
      (`create_repository`), with `social/` (one file per week), `email/`
      (issues and welcome emails), `outreach/`, `scoreboard/`,
      `.github/workflows/` and a README that points back here. Free plans
      include 2,000 workflow minutes a month for private repos, far more than
      this needs.

### The home page and the words around it

- [ ] The home page (at the root of the address D3 settles on; on GitHub
      Pages, beside the app): who it's for (novelists, and
      anyone writing something long), what Crumpet does in pictures, "your
      files stay yours" (Drive or a folder, plain Markdown), free with no
      account and nothing kept about you, the newsletter sign-up, the Mac and
      Windows downloads, questions and answers, About (D5, D11), privacy and
      terms; card images
      (1200×630) so shared links look good on X and elsewhere. No new outside
      scripts on the app's address (only Google's sign-in and folder picker,
      which are already there): sign-up forms are plain HTML form posts, or a
      link to the service's own sign-up page. Where: static files beside the
      app in the build (image names with a version in them).
- [ ] Pages writers find by searching, five to start: Crumpet and Scrivener
      compared; a Scrivener alternative for iPhone and iPad; writing a novel
      in Google Drive; manuscript format for agents (and how Crumpet does it);
      a writing app with no generative AI. One more a week after launch (the
      weekly routine). `sitemap.xml` and `robots.txt` at the root. 🙋
      Optional, 5 minutes: Google Search Console (add the address, verified
      by a file Claude adds; submit the sitemap). Fair, checkable comparisons
      only.
- [ ] Press kit (`docs/marketing/press-kit.md`): name, one-liners of 60, 140
      and 260 characters, a description, features, logo, pictures, a
      60-second video, a short maker bio.
- [ ] Voice (`docs/marketing/voice.md`): who we talk to, the tone (calm, warm,
      plain), what we never say (hype, claims about AI, knocking other apps),
      following D9 and D11. On AI, the true wording is: "Crumpet has no
      generative AI. Your typed writing is never sent to an AI service or used
      to train one. Two optional tools use machine recognition: dictation uses
      your browser's own speech service (in Chrome, Google hears what you
      say), and reading words in pictures runs on your device."

### Privacy and contact, before collecting anything

🎬 **D4 · Support address**: decided 1 Nov, **info.crumpetapp@gmail.com**
(Calls made). Optional, 10 minutes in sitting 1: forward it to your own inbox,
with Gmail's "Send mail as" so replies go out from the Crumpet address.

🎬 **D5 · Your name and address.** Crumpet isn't a business now (nothing is
sold), so e-handelsloven § 7 most likely doesn't apply to the website (Claude
re-checks, rule 7). But email services print a postal address at the foot of
every newsletter, and their rules require it.
- **Your name on the About page; your home address only in the newsletter's
  footer** (recommended, and the only free way to have a newsletter).
- Your home address on the website too.
- Kit's address in the emails instead of yours (only if you pick Kit in D7).
- No newsletter, so no address anywhere.

🎬 **D19 · The code's licence** (the repo is public; anyone can read it)
- **Look, don't copy** (recommended): a LICENSE saying the code may be read,
  and forked on GitHub as GitHub's terms allow, but not used, shared or sold
  anywhere else; others' code and the fonts keep their own licences.
- Free for personal use (PolyForm Noncommercial): people may use and change
  it, not sell it.
- Open source (MIT or GPL), where anyone may copy, change and sell it: easy
  goodwill on Hacker News, but someone could sell your work.

- [ ] A security contact: `SECURITY.md` in the repo and
      `/.well-known/security.txt` on the site with the support address.

- [ ] Fonts from our own address: the interface fonts come from Google's
      servers, which sends each visitor's IP address to Google (a German court
      called that unlawful without consent). Ship them with the app, with
      their licence files (SIL OFL); fonts a person picks later still come
      from Google, and the privacy page says so. Where: `app/index.html`
      (~lines 39–40), `app/src/ui/fonts.ts` (~87), the font handling in
      `app/public/sw.js`.
- [ ] The privacy page completed (rule 11: Peter approves the wording, about
      15 minutes of reading). Done 1 Nov: no accounts, "keeps nothing about
      you", problem reports by email, and the other services a device talks
      to (GitHub, Google Fonts, videos, lookups). Still to add, when they
      exist: who is responsible (Peter, the support address); the newsletter
      and usage counts (consent, from age 13) and who handles them (the email
      service, Umami); transfers outside the EU, how long things are kept,
      people's rights, and complaints to Datatilsynet. Where:
      `app/public/privacy.html`.
- [ ] Terms of use (rule 11): free to use, no warranty, your writing is
      yours, Danish law, without taking away consumers' rights. Where:
      `app/public/terms.html`, and About (`about.html`, D5, D11).
- [ ] Feedback and support switched on: `VITE_FEEDBACK_EMAIL` and
      `VITE_SUPPORT_URL` in `app/.env` (the support link goes to the home
      page's help section). The menu items are already built
      (`app/src/ui/help.tsx`). Feedback done 1 Nov (Peter asked for bug
      reports to info.crumpetapp@gmail.com): Report a problem, with device
      details and recent errors (`data/bugreport.ts`, `data/errorlog.ts`), also
      on the desktop apps' Help menu and a phone's library. The support link
      still waits for the home page.

### Counting what matters

🎬 **D6 · Usage counts**
- **Umami (free), only for people who switch on "Share anonymous counts"**
  (recommended): lawful in Denmark, keeps "Crumpet holds no user data" true
  for everyone who doesn't say yes, and counts nothing about a person even
  for those who do; fewer numbers, but the proportions hold. (Claude first
  checks that Umami's free plan lets the scoreboard read the numbers; if not,
  the free choice is PostHog's EU plan, or no counting.)
- Umami for everyone, explained on the privacy page: more numbers, but against
  the Danish authorities' 2025 guidance (visitor statistics need consent),
  and remembering what's been counted on the device needs consent anyway.
- No counting in the app (keeps the promise simplest): only the counts the
  services already give (Mac and Windows downloads, newsletter sign-ups).

- [ ] A tiny sender of our own, with no outside script:
      `app/src/data/analytics.ts` with `track(name)`, posting to Umami's
      collect address. It's off in development, under automation
      (`navigator.webdriver`) and unless switched on. It never sends titles or
      text, and each milestone is counted once per device. Events: app opened
      (installed or not, Mac, Windows or web), first note, first book, a
      book's third chapter, an export (which kind), Drive or folder connected,
      newsletter link opened. The
      switch: a quiet line on the welcome page and a row in Settings. Where:
      new `data/analytics.ts` (`VITE_UMAMI_WEBSITE_ID` in `app/.env`);
      `main.tsx` (`start()`); the call sites (`store.createNote`, the three
      book buttons, `exportbook.tsx`, `NotePane.tsx` `downloadItems`,
      `exportmenu.tsx`, `sync/connection.ts`, `data/pwa.ts`).
- [ ] Links say where they came from (`?ref=x`, `bsky`, `threads`, `email`).
      The tag is passed on in the address to a newsletter sign-up (a hidden
      field) during the same visit, and kept
      on the device only for people who switched on counts.
- [ ] The weekly scoreboard: a workflow in the ops repo gathers the week's
      numbers into `scoreboard/YYYY-Www.md`, read by the weekly routine and
      never published: Mac and Windows downloads from GitHub, newsletter
      subscribers, Umami counts (`UMAMI_API_KEY`, if the free plan has an
      API), Buffer's post stats, and the number of problem reports.

### The newsletter

🎬 **D7 · Email service**
- **Brevo** (recommended): free; a French company (EU); sends without a
  domain of our own; fully automatic (welcome emails, and issues sent by the
  ops workflow); sign-ups never pause. It sends 300 emails a day, probably
  including sign-up confirmations, so on a busy day some confirmations wait
  until the next, and past about 300 readers an issue goes out over two days
  (or upgrade later). Your address goes in the footer (D5).
- Kit: free up to 10,000 readers, and can print Kit's address in the footer
  instead of yours. But no automatic welcome series on the free plan, a US
  company, and a Gmail sender is more likely to land in spam until there's a
  domain.
- EmailOctopus: free up to 2,500 readers, a simple welcome series, quick
  approval; each issue may need you to press send.

🎬 **D8 · The newsletter's shape**
- **"Notes from Crumpet", from you by name, every two weeks (weekly during
  November)** (recommended).
- Monthly.
- Only when there's news.

- [ ] Sign-up with the consent Danish law asks for: who (Crumpet, Peter
      Sinclair Fleeton), what (Crumpet news and writing tips), how often, unsubscribe any time, a link to
      privacy; double opt-in. A plain HTML form post to the service (its
      captcha off), or a link to its own sign-up page in a new tab, with no
      framed forms (they load the service's scripts and Google reCAPTCHA,
      which need cookie consent). Places: the home page (top and foot); Help
      ("Crumpet news by email"); Settings → Clipper & app; the foot of the What's
      new window; the welcome page's last line; and once, a quiet line in a
      book's outline after its first 1,000 words. Where: `app/.env`
      `VITE_NEWSLETTER_URL` (shown only when set, like the feedback item),
      `ui/help.tsx`, `ui/Settings.tsx`, `ui/NotePane.tsx` (`Welcome`,
      ~637–695), `ui/Project.tsx` (`ProjectOutline`).
- [ ] Three welcome emails, sent by the ops workflow through the service's
      API (nothing for you to click): hello, and how to start a book; three
      things most people miss (Cards, characters underlined where they
      appear, export); your files are yours (connect Drive or a folder).
- [ ] Issues as Markdown files in the ops repo; once approved (D10), the
      workflow schedules them through the service's API (`BREVO_API_KEY` or
      `KIT_API_KEY`). Every email has the sender's name, an unsubscribe link
      and the footer address.

### X, Bluesky and Threads

X's free API ended in February 2026, so posts go through Buffer's free plan,
which posts to X, Bluesky and Threads at no cost. The ops workflow puts each
week's approved posts into Buffer ahead of time (the free plan holds 10
waiting posts per network, so it tops them up daily).

🎬 **D9 · The accounts** (decided 3 Nov: Crumpet as a brand, @Crumpetwriting on X; other networks still open)
- Handle: Claude suggests four (the same on all three networks); you pick
  one and check it's free when signing up.
- Voice: **you, the maker, in the first person ("I'm building a calm writing
  app")** (recommended: makers' accounts grow faster, and writers trust a
  person) / Crumpet as "we" / both, your own account and Crumpet's (Buffer's
  free plan holds three accounts, so your own would be posted by hand, about
  10 minutes a week, and the two mustn't post the same thing on X).
- Networks: **X, Bluesky and Threads** (recommended: the same posts for three
  audiences; writers are more on Bluesky and Threads, indie-app people on X) /
  X only / X and Bluesky.
- On the profile: **your name and a photo** (recommended: your name is on the
  site and the newsletter anyway) / your name only / neither (then the voice
  is Crumpet's "we").

🎬 **D10 · How you OK what goes out**
- **One weekly batch** (recommended): every Friday the weekly routine sends
  you a link to a private page with next week's posts as they'll look (clips
  playing), any newsletter issue, the week's numbers and up to three calls.
  Pressing Merge on the linked pull request is your OK (about 10 minutes). Not
  merged, nothing goes out.
- A standing OK: Claude merges on Sunday evening unless you've commented.
- Every post one by one.
- And: share real numbers in posts ("building in public")? **Not before
  launch** (recommended: early numbers are small and stay public for good) /
  yes.

🎬 **D11 · Saying it was made with AI.** Many writers are wary of AI, and
Hacker News expects honesty.
- **Open, but not the headline** (recommended): the About page says it's made
  by one writer with an AI coding assistant, and that Crumpet has no
  generative AI (the wording in Voice above); posts are about writing, not how
  Crumpet was built; honest answers when asked.
- Lead with it ("one person and Claude built a Scrivener rival"): a strong
  story for tech audiences, risky with writers.
- Only if asked (risky on Hacker News).

🎬 **D12 · Where you'll post yourself at launch.** Product Hunt, Hacker News
and Reddit need a real person writing their own replies (Hacker News forbids
AI-written comments), and Hacker News and Reddit limit posts from new or quiet
accounts. So this is asked now.
- **Product Hunt, Show HN and one or two Reddit posts** (recommended): 2–3
  hours over the launch days, plus about 20 minutes twice a week from now
  until January using Hacker News and Reddit as an ordinary reader (you can
  use the optional reply slots): about 5 hours in all.
- Product Hunt only: about an hour on the day, and a few minutes a week there.
- None: launch through the newsletter, the social accounts and directories,
  fully automatic and smaller.

- [ ] Profile pictures and words: avatar 400×400 and header 1500×500 from the
      brand mark and app pictures; a bio (who it's for, free, "I make
      Crumpet" if it's your voice, the home page link with `?ref=`); a pinned
      post (a 30-second video of writing in Crumpet).
- [ ] Pictures and short videos from the real app. Move the guide's sample
      `library()` into `tests/shots/library.ts`. Add
      `tests/shots/marketing.shots.ts` with its own config
      (`playwright.marketing.config.ts`), and make the guide's config match
      only `guide.shots.ts`. It takes stills sized for posts (light and dark,
      phone frames) and records 15–45-second clips (Playwright video turned
      into MP4 with captions, using ffmpeg) into a gitignored
      `app/marketing-out/`.
- [ ] The posting workflow (ops repo, `social.yml`, daily and on demand): it
      reads the week's file (text per network, picture or video address, alt
      text, time in Europe/Copenhagen) and keeps up to 10 waiting posts per
      network in Buffer through its API (`BUFFER_API_KEY`). It skips any post
      whose picture or video isn't live yet, retrying the next day, marks
      what's queued and reports errors. A usual week: 5 posts (2 short
      clips, 2 tips for novelists shown in Crumpet, 1 "this week in Crumpet"
      from `data/whatsnew.ts`) and one thread. On X the link goes in the bio
      or the weekly thread (whether X shows link posts to fewer people is
      disputed); on Bluesky and Threads it can go in the post.
- [ ] Each Friday's batch is two pull requests: the ops one (text and times,
      which is Peter's OK), and one in crumpet-app adding only that week's
      chosen pictures and clips (each under 8 MB) to the site's
      `social/YYYY-Www/` folder, merged only after Peter's OK. The desktop build leaves
      `social/` out, and each week's media is removed 30 days after it posts.
- [ ] The weekly routine scheduled now, not after launch (stage 7 lists its
      steps). Use `create_trigger` with `create_new_session_on_fire: true`,
      push and email notifications, and only connectors Peter names: Fridays
      `CRON_TZ=Europe/Copenhagen 47 8 * * 5`, and Sundays
      `CRON_TZ=Europe/Copenhagen 47 19 * * 0` only if D10 is the standing OK.
      Each prompt stands alone: "In petersinclairfleeton/crumpet-app, read
      CLAUDE.md and docs/launch-plan.md, then do 'The weekly routine'. Attach
      crumpet-ops (add_repo, push) and clone it to /home/user/crumpet-ops.
      Don't use the question tool: put calls in Waiting on Peter and in the
      report." If scheduled tasks aren't available, add "Paste: Run the weekly
      routine (docs/launch-plan.md)" to Waiting on Peter for Fridays.
- [ ] If Buffer's free plan or API doesn't work as researched: Bluesky posts
      straight from the workflow (free; `BSKY_HANDLE` and an app password as
      `BSKY_APP_PASSWORD`), X by hand from a weekly copy sheet with x.com's
      free scheduler (about 10 minutes a week), and it's raised as a call.

### 🙋 Sitting 1: settings and accounts (about 1 hour, by Sun 25 Oct)

Claude sends the exact steps once D3, D6 and D12 are made:

1. Check your employment contract doesn't claim what you make in your own
   time. 5 min
2. Optional: info.crumpetapp@gmail.com forwarding to your own, and "Send mail
   as" in your own Gmail. 10 min
3. If asked, let Claude's GitHub app into crumpet-ops. 2 min
4. Google Cloud: the home page, privacy and terms links on the Branding page;
   Audience → Publish app, so anyone can connect Google Drive; and remove the
   `openid`, `email` and `profile` scopes if accounts ever added them (Crumpet
   asks only for `drive.file` now). Firebase: delete the project (or its
   users), since Crumpet no longer has accounts. Only if D3 is a move:
   Cloudflare (sign up, free, no card; an API token with the permissions
   Claude names, and it and the account id in crumpet-app's secrets) and the
   new address as an allowed origin for the sign-in client and the API key.
   10 min (25 with a move)
5. Umami (if D6): sign up, add the website, tell Claude the website id (a
   public value), and put an API key in crumpet-ops' secrets as
   `UMAMI_API_KEY` if the free plan has one. 5 min
6. Only for the sites you chose in D12: sign in or make accounts on Product
   Hunt, Hacker News and Reddit (bios say "I make Crumpet"). 5 min

### 🙋 Sitting 2: social and the newsletter (about 45 minutes, by Sun 1 Nov)

Claude sends the exact steps once D5, D7 and D9 are made:

1. The X account with the support address (a phone check if asked), switched
   to a free Professional account (category Software), with Claude's pictures
   and bio. 10 min
2. Bluesky and Threads with the same handle (D9). For Threads, a standalone
   profile if offered; otherwise a new Instagram account for Crumpet, never
   your personal one. 10 min
3. Buffer, free plan: connect X, Bluesky and Threads; make an API key and put
   it in crumpet-ops' secrets as `BUFFER_API_KEY`. 5 min
4. The email service (D7): sign up as an individual; confirm the support
   address as the sender; enter the footer address (D5); in Brevo, under
   Security → Authorised IPs, turn off blocking (GitHub's machines change
   address); make the sign-up form Claude describes (double opt-in, its
   wording, a hidden REF field) and send Claude its address; make an API key
   and put it in crumpet-ops' secrets as `BREVO_API_KEY` (or `KIT_API_KEY`).
   20 min

## Stage 3. November: write with Crumpet (1 – 30 Nov)

NaNoWriMo closed in 2025, but thousands still write a novel in November
(ProWritingAid's Novel November, World Anvil's NovelEmber, Reedsy's Novel
Sprint). It's the best free moment of the year to meet novelists: build the
list and hear from real writers before asking anyone to pay.

🎬 **D13 · November**
- **A free "write your November novel in Crumpet" push** (recommended): a
  50,000-word goal, a progress picture to share, posts and emails.
- Skip November and keep building towards January.

- [ ] A November goal in one tap (by Sat 31 Oct): a book's deadline of 30
      November and 50,000 words (deadlines and daily targets already exist),
      offered on the welcome page and in a book's ··· menu.
- [ ] A progress card to share (by Sat 31 Oct): words, days and streak as a
      picture to save (made in the browser; nothing uploaded). Where: a small
      new `ui/progresscard.tsx` (canvas to PNG), opened from the book's
      deadline.
- [ ] A November page beside the home page (by Sat 31 Oct), with posts and
      emails around it: Crumpet is free, with no account, and keeps nothing
      about you; your novel stays in your own Drive or folder.
- [ ] Hearing from writers: "Tell me what's missing" in Help and in the
      welcome email; replies feed the weekly routine; anyone quoted has said
      yes in writing.
- [ ] Places to tell writers where sharing your own tool is allowed (for
      example r/SideProject; r/FantasyWriters only if its moderators say yes
      in writing first), each with a draft that follows its rules and says "I
      make Crumpet". 🙋 You post the ones you like from your own accounts
      (optional; Claude never posts there).

## Stage 4. ~~Crumpet Pro~~ (dropped 1 Nov 2026)

Peter's call: no Crumpet Pro and no Polar. Crumpet is free. Gone with it: Free
and Pro limits (D14), price (D15), refunds (D16), the shop (D17), the Danish
business form, VAT and bookkeeping (D18), licence keys, buying pages, Polar's
review and sittings 3 and 4. The code's licence (D19) and the security contact
moved to stage 2; the guide needs no Free/Pro wording. If selling ever comes
back, it starts as a new call, with a fresh look at shops (Polar excluded).

## Stage 5. ~~Founders' presale~~ (dropped 1 Nov 2026)

Nothing to sell, so no presale (D20), no founders' price and no tax changes.
Its polish moved to stage 6.

## Stage 6. Launch (Tue 12 Jan 2027)

Mid-January is when people decide this is the year they write their book.
Claude prepares everything; you press the buttons, because these sites need
a real person.

🎬 **D21 · Launch day**
- **Tuesday 12 January** (recommended: more visitors).
- Saturday 16 January: easier to reach Product Hunt's top five, fewer
  visitors.
- Tuesday 5 January: earlier, with people just back from the holidays.

- [ ] Polish before launch: review group 9 (the chapter opening in Read, one
      name, "book", everywhere, the two React warnings, the note list as one
      Tab stop, the phone list's compact choice); group 5's first item
      (browser tests in the calm look); group 8 (C3). A desktop release by
      Fri 8 Jan with all of it.
- [ ] Directories (from Mon 2 Nov, because their free queues take weeks to
      months):
  - AlternativeTo, as an alternative to Scrivener, Ulysses, Dabble and
    Obsidian
  - SaaSHub, with its free verification tag on the home page
  - Microlaunch
  - Uneed, if its free line is open
  - Peerlist Launchpad, on a Monday in December

  A directory badge only if it can be copied into our own files; otherwise
  skip that directory. Skip BetaList and DevHunt (paid, or for developer tools
  only). Claude writes every listing and keeps a tracker in the ops repo; 🙋
  you submit them (about 45 minutes in all, including an account on each).
- [ ] People who write about writing apps (from Tue 1 Dec): only those who
      invite it publicly, such as a "suggest a tool" form or a page that says
      where to send review requests. Use exactly that route, once, with no
      follow-up unless they reply; nobody else is contacted (rule 9). Claude
      drafts each note; 🙋 you send them from the support address (about 2
      minutes each).
- [ ] Product Hunt: name, tagline, description, five pictures and a
      60-second video, and your first comment. 🙋 You make the listing from
      Claude's words and pictures (the video on YouTube for its gallery) and
      schedule it (on or after Sat 12 Dec, by Fri 8 Jan; about 30 minutes).
      Never ask for upvotes; only "come and tell me what you think".
- [ ] Show HN (Thu 14 Jan, if D12 includes it): title options and the story
      (our own editor, free, no server and no accounts, your files in your own
      Drive), plus likely
      questions with factual answers. You write the post and your replies in
      your own words. Never link the Show HN post from emails or posts (Hacker
      News treats that as rounding up votes).
- [ ] Reddit (if D12 includes it): a post written for each subreddit's rules,
      saying "I made this": r/SideProject, and r/macapps at most once a month.
      r/FantasyWriters only if its moderators say yes in writing first. Read
      the rules again on the day.
- [ ] The launch email and posts (pointing to the app or the Product Hunt page
      with "tell me what you think").
- [ ] Launch-day watch: Claude watches feedback and fixes problems quickly
      (with the checks, and a desktop release if it's affected), and never replies
      on your behalf.

## Stage 7. After launch

### The weekly routine

Runs every Friday morning from stage 2 (scheduled there), or when Peter pastes
"Run the weekly routine".

1. Read the scoreboard and feedback: beta replies, GitHub issues, and the
   support inbox if the session's Gmail tools can read it. Otherwise the
   report asks Peter to paste new emails into the chat, and Claude writes
   the replies for him to send from the support address.
2. Fix the biggest problems (ordinary pull requests).
3. Next week's posts and pictures (the Friday batch, D10), the newsletter
   when it's due, and one new search page.
4. Update this file: tick, record, and list what's waiting on Peter.
5. The report on a private page: numbers against last week, what changed, and
   up to three calls.

### The upgrade ladder

Crumpet earns nothing, so each of these is paid by Peter, and each is a call
when it would clearly help. None is needed.

1. **A domain** (about 100 kr a year), moving Crumpet there with the
   forwarding helper (stage 2's move item).
2. **Apple's developer programme** (about 750 kr a year): a signed Mac app
   with no warning, then iPhone and iPad in the App Store.
3. **A Windows code-signing certificate** (or Microsoft's Trusted Signing,
   about 70 kr a month): no "Windows protected your PC" warning. First check
   SignPath's free signing for open-source projects (only if D19 makes the
   code open source).
4. **X Premium** for Crumpet's account (about 60 kr a month): free accounts'
   posts get a median of under 100 impressions, Premium's over 600 (Buffer's
   study; a correlation, not proof).
5. **The email service's paid plan**, when the free limits bite.

### Check-ins: is it working?

At 30, 60 and 90 days after launch (Fri 12 Feb, Fri 12 Mar and Mon 12 Apr
2027), Claude reports the numbers (downloads, newsletter readers, usage counts
if D6 has them, problem reports and what people wrote) and you choose:

- **Going well**: people keep writing in it and telling others. Keep going;
  climb the ladder if you want to.
- **Promising**: some stay, many don't. Change one thing (who we talk to, the
  first visit, what we show) and run another 60 days.
- **Not yet**: look at where people stop (do they try it, start a book,
  connect Drive?) and decide: one bigger change, keep Crumpet as your own
  tool, or stop. Stopping means keeping the app online for at least a year,
  with a note saying so; people's writing is already in their own files.

---

## What this plan rests on (researched 18 Oct 2026)

Re-check each when it's used (rule 7). "Third-party" means it came from a
secondary source.

- **GitHub Pages:** not "for running your online business … or providing
  commercial software as a service", and not for "sensitive transactions like
  sending passwords" (GitHub Pages limits). **Cloudflare Pages free:** 500
  builds a month, unlimited static requests (third-party); commercial use not
  confirmed this session. Vercel's free plan is non-commercial.
- **X:**
  - No free API since 6 February 2026 (pay per use, a card and credits
    needed).
  - Allowed: scheduling your own original posts through an authorised tool.
  - Forbidden: automated likes, follows, replies and messages, trending
    topics, and duplicate posts.
  - Accounts without Premium can make up to 50 posts a day.
  - Free accounts' median is under 100 impressions per post (Buffer's study
    of 18.8 million posts).
  - X Communities have closed.
  - Whether X holds back posts with links is disputed.
- **Buffer free:** 3 networks, 10 waiting posts per network, an API on the
  free plan (one personal key; pictures and videos given as public
  addresses). Third-party: one X thread queued at a time, and a lifetime limit
  of 8 network connections.
- **Bluesky:** free API (app passwords), videos up to 10 minutes; the most
  writerly network, but shrinking. **Threads:** free API, large and growing; a
  standalone sign-up without Instagram is unconfirmed for Denmark. Substack
  Notes can't be posted to automatically.
- **Email:**
  - Brevo free: 300 emails a day, 100,000 contacts, automation for up to
    2,000, an API, a French company.
  - Kit free: 10,000 readers, but no sequences or automations since about
    September 2026.
  - MailerLite free: down to 250 readers since June 2026.
  - beehiiv free: no automations or sending API.
  - Sender and Loops need a domain of our own.
  - Gmail addresses can't be authenticated, so with no domain the service
    sends from its own address.
- **Danish marketing rules:**
  - markedsføringsloven § 10 needs prior, active, informed consent and an
    easy way out, with proof of consent kept. Promotional direct messages and
    emails to people who haven't asked count as spam.
  - Hidden advertising is not allowed, so makers say they make it.
  - GDPR article 13 sets what a privacy notice says.
- **Usage counts:** Umami Cloud's free Hobby plan gives 100,000 events a
  month and custom events, with no cookies. Unconfirmed: where it stores
  data, and whether its API is on the free plan.
  Danish guidance (Datatilsynet and Digitaliseringsstyrelsen, May 2025) names
  visitor statistics as needing consent. Cloudflare Web Analytics has no
  custom events.
- **Launch sites:**
  - Product Hunt: free, scheduled up to a month ahead, no asking for votes,
    and the product must be usable on the day. Advice about account age is
    third-party.
  - Hacker News: Show HN posts from new accounts restricted since about
    March 2026; AI-written comments are not allowed; linking people to a
    submission counts as rounding up votes.
  - BetaList: paid only now (third-party).
  - Uneed: its free line may have closed in August 2026.
  - AlternativeTo: its free queue takes months.
  - NaNoWriMo closed in 2025; Novel November (ProWritingAid) runs 1–30
    November.
- **Denmark** (from knowledge, not checked against live pages):
  - e-handelsloven § 7 (name, physical address, email, CVR) applies to
    businesses; a free app with nothing sold most likely isn't one.
  - Interface fonts loaded from Google send visitors' IP addresses to
    Google.
- **This repo:**
  - Pages publishes on every merge to `main`.
  - The app lives at `/crumpet-app/` until D3. Moving it changes where the
    browser keeps notes, so Download everything and the forwarding helper
    come first, and the manifest, the service worker's place and the OAuth
    origins move with it.
  - `app/.env` is public.
  - Shared settings sync through `.crumpet/vault.json`, where an older app
    can drop keys it doesn't know.
  - 47 test lines hold this container's folder path.

## Sources

- GitHub and hosting: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits),
  [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- X: [API pricing](https://docs.x.com/x-api/getting-started/pricing),
  [automation rules](https://help.x.com/en/rules-and-policies/x-automation),
  [Buffer's study of X Premium reach](https://buffer.com/resources/x-premium-review/)
- Buffer: [API for developers](https://buffer.com/made-for/developers),
  [hosting media](https://developers.buffer.com/guides/hosting-media.md)
- Bluesky and Threads: [atproto rate limits](https://github.com/bluesky-social/atproto/discussions/697),
  [Threads API](https://developers.facebook.com/docs/threads/overview)
- Email: [Brevo free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan),
  [Kit free plan](https://help.kit.com/en/articles/16627071-the-kit-free-plan),
  [MailerLite free plan change](https://www.mailerlite.com/help/free-plan-update-faq),
  [Forbrugerombudsmanden on spam and consent](https://forbrugerombudsmanden.dk/media/bjajzdv1/vejledning-om-spamforbuddet-2021-a.pdf)
- Usage counts: [Umami pricing](https://umami.is/pricing),
  [Datatilsynet and Digitaliseringsstyrelsen's cookie guidance](https://www.datatilsynet.dk/Media/638829899950476628/F%C3%A6llesvejledning%20med%20DIGST%20-%20Cookie%20og%20lignende%20teknologier.pdf)
- Launch: [Product Hunt guidelines](https://help.producthunt.com/en/articles/3615694-community-guidelines),
  [Show HN guidelines](https://news.ycombinator.com/showhn.html),
  [Jane Friedman on Novel November](https://janefriedman.com/goodbye-nanowrimo-hello-novel-november/)
- Denmark: [e-handelsloven § 7](https://www.lovguiden.dk/loven/e-handelsloven/7)
