# Launch plan: from here to a paid launch, with no money in

Written 18 October 2026, after the October review (`docs/review-plan.md`). It
takes Crumpet from where it is to a launch where people can pay for it,
without spending anything first. Upgrades come later, paid for by what
Crumpet earns.

**Peter is the producer.** He makes the calls (🎬) and does only what nobody
else legally or physically can (🙋: creating accounts, identity checks,
MitID). Claude Code does everything else: building, writing, pictures and
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
- **Sandbox**: a shop's practice version, where nothing is really charged.
- **Buffer**: a free service that posts at set times. **Umami**: a small, free
  counting service that sees no names or writing. **Polar**: the shop that
  sells Crumpet Pro for you. **Show HN**: a post on Hacker News, a news site
  many programmers read.

## The plan at a glance

| Stage | When | What happens | Your calls |
|---|---|---|---|
| 1. Safe and quick | 19 Oct – 1 Nov | Words can't be lost, long chapters type quickly, the first visit goes straight to the page, automatic checks before anything goes live | 2 |
| 2. The shop window | 19 Oct – 8 Nov | A new free address (off GitHub), a home page, privacy put right, a support address, usage counts, the newsletter, and X, Bluesky and Threads posting by themselves | 10 |
| 3. November: write with Crumpet | 1 – 30 Nov | A free push around November's novel-writing month: a 50,000-word goal, progress pictures to share, posts and emails | 1 |
| 4. Crumpet Pro | 2 Nov – 7 Dec | Free and Pro, licence keys through Polar, prices and terms, the Danish basics | 6 |
| 5. Founders' presale | 8 Dec – launch | Pro opens at the founders' price to newsletter readers and followers: the first money | 1 |
| 6. Launch | Tue 12 Jan 2027 | Product Hunt, Show HN, Reddit, directories, the launch email | 1 |
| 7. After launch | from 13 Jan | The weekly routine, upgrades only from earnings, and check-ins at 30, 60 and 90 days: keep going, change course or stop | a few a week |

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
| Reading the privacy and buying pages before they go live | Nov | about 45 min |
| Sittings 3 and 4: Polar and the CVR | 9 Nov and 20–23 Nov | about 50 min |
| The weekly OK (D10) | Fridays from 30 Oct | about 10 min a week, 2 hours in all |
| Buyers' emails (Polar wants replies within 48 hours) | from 8 Dec | a few minutes a day, about 1 hour |
| Directories, Product Hunt listing, invited reviewers | Nov – Jan | about 1½ hours |
| Launch days | 12–14 Jan | 2–3 hours |
| **Total before launch** | | **about 14 hours, a little over an hour a week** |
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
   an unanswered 🎬) never hold up later work. Stages 1 and 2 run side by
   side, and so do 3 and 4. Build as CLAUDE.md says (one pull request per
   item or few items, every check, the guide updated, merged and published),
   and tick items here in the same pull request. Work done only in the ops
   repo is ticked in a small docs pull request here (several can share one).
3. **🎬 Calls:** ask Peter with the question tool, using the options given
   here, recommended first, each with its cost in money and in his time. No
   more than four at a time. In the first week, ask in this order: D1, D2, D3
   and D13; then D4, D5, D6 and D7; then D9, D11 and D12. Ask D8 with the
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
   (checkout links, product and website ids, form addresses) go in
   `app/.env`. This container can't reach most outside services (Polar,
   Buffer, the email service, Umami, skat.dk, even the live site), so
   anything that calls them runs as a workflow, which Claude starts
   (`actions_run_trigger`) and reads (`get_job_logs`) through the GitHub
   tools. Workflow logs in a public repo are public, so such workflows live
   in the ops repo.
6. **No money.** Only free plans: nothing that takes a card, charges, or
   starts a trial that becomes a charge. Paid things are only on the
   **Upgrade ladder**, each needing Peter's yes. If a free plan's limits
   bite, or a price or plan has changed, raise it as a call.
7. **Re-check before relying.** Every outside service's prices, limits and
   rules here were researched on 18 October 2026, some only from search
   results. When setting a service up, check its own pages, in this order:
   WebSearch (note the page and date); a manual workflow in the ops repo
   (`fetch-pages.yml`) that fetches a list of addresses with curl and prints
   their text to its log; otherwise ask Peter to look, or (for Danish rules)
   to ring Skattestyrelsen's business line. Note here what changed and how
   it was checked.
8. **The repo is public.** Never put in it: keys, licence keys, anyone's
   name or email (customers, subscribers, reviewers), sales or subscriber
   numbers (unless Peter chooses to share them, D10), bookkeeping, his CPR
   number or bank details. Those belong in the ops repo, its secrets, or
   Peter's Google Drive.
9. **Nothing goes out in Peter's name without his OK** (posts, emails,
   listings): per weekly batch, or by a standing rule he gives in D10. Social
   posts follow X's automation rules: scheduled original posts only. Never
   automated replies, likes, follows or messages; no trending hashtags or
   topics; never the same post twice on one account or on two X accounts.
   Never message anyone who hasn't asked (by email or direct message):
   Danish law treats it as spam. Never add anyone to the newsletter who
   didn't sign up themselves.
10. **Honest marketing.** Every claim true and checkable; "free" only for
    what is free; prices shown with VAT included; no "was" prices that were
    never charged; a founders' price says when it ends, then ends; no fake
    reviews; never ask for upvotes (Product Hunt, Hacker News and Reddit
    forbid it); quote writers only with their written yes. Whenever Peter
    mentions Crumpet from his own accounts (replies, Reddit, Hacker News,
    Product Hunt, forums), the post itself says he makes it ("I make
    Crumpet"), and his bios say so too. Anyone given free Pro to review it
    must say so in the review, and the licence never depends on what they
    say.
11. **Pages with legal weight wait for Peter.** Privacy, terms, refunds,
    About (with his address) and pricing go in a pull request of their own
    that isn't merged until he OKs the wording. Claude shows the full text
    on a private page (Artifact) or in the question tool, not as a diff.
    Everything else merges as CLAUDE.md says. Usage counts and the newsletter
    sign-up are switched on only in or after the pull request that publishes
    the privacy page he approved.
12. **Crumpet stays calm and people's words stay theirs.** No pop-ups or
    nagging: upgrades and sign-ups are quiet lines and Settings rows. Books
    stay open and editable whether or not anyone pays; plain text and
    Markdown downloads are always free.
13. **End each session** with CLAUDE.md's summary, plus the next call coming
    up, anything waiting on Peter, and an updated **Your time**.

## Calls made

Newest last. The review plan's calls still stand: first visit straight to the
page; Word is done; the classic window retires; one name, "book".

- 18 Oct 2026: no money in until Crumpet earns it; upgrades are paid from
  earnings.
- 18 Oct 2026: marketing is organic: a Crumpet X account and an email
  newsletter.
- 18 Oct 2026: Peter makes the calls; Claude does the work and asks along the
  way.

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
- [ ] A gentler first visit (review group 4): straight to the page; one
      Google step (connecting Drive also signs in); the account stays in
      Settings.
- [ ] Fresh pictures for people who've visited before: the service worker
      keeps non-hashed files (guide pictures, brand, and soon the home page's
      images) forever, so retaken pictures never reach returning visitors.
      Make them refresh in the background (hashed `/assets/` files stay as
      they are) and check the app still starts offline. Where:
      `app/public/sw.js` (the fetch handler, `CACHE`, `keepPage()`).
- [ ] The Mac app released on purpose: `mac.yml` runs only when started
      (`workflow_dispatch`; Claude starts it with `actions_run_trigger` on
      `main`), with release notes from `data/whatsnew.ts`. The Mac app says
      when a newer version is out (it doesn't update itself). Releases happen
      after changes that matter to the Mac app (the D3 move doesn't; Pro
      does). Where: `.github/workflows/mac.yml`, `desktop/main.cjs`,
      `desktop/preload.cjs`, `app/src/data/desktop.ts`.
- [ ] 🙋 Google sign-in open to everyone: in sitting 1 (stage 2).

## Stage 2. The shop window (19 Oct – 8 Nov)

Somewhere to send people, a way to hear from them, a list to write to, and
accounts that post by themselves. Runs alongside stage 1.

### A new address, before anything points to it

GitHub's terms say Pages "is not intended for or allowed to be used as a free
web-hosting service to run your online business … or providing commercial
software as a service", and "shouldn't be used for sensitive transactions like
sending passwords". Crumpet will sell Pro, and its accounts already use
passwords. Today is the cheapest time to move: almost nobody keeps notes only
at the current address yet, and nothing has been posted that points to it.

🎬 **D3 · Crumpet's web address**
- **Move to a free Cloudflare address now** (recommended), something like
  crumpet.pages.dev (Claude suggests names; Cloudflare offers what's free).
  Its free plan is widely used for commercial sites; Claude confirms its terms
  allow it before you sign up (rule 7). The old address
  stays on GitHub only as a forwarding page that helps people bring their
  notes across, and clipper links still work. It takes about 20 minutes of
  your clicks in sitting 1 (Cloudflare, plus Google's and Firebase's
  settings). A domain later on the ladder means one more move, with the same
  helper, and buyers entering their key once more there.
- Stay on GitHub Pages: free and nothing moves, but it breaks GitHub's terms
  from the day Pro opens, putting the whole GitHub account (code, Mac
  releases) at risk.
- Buy a domain now (about 100 kr a year): one move instead of two, but it
  breaks the no-money rule.
- If Cloudflare's terms turn out to rule this out, Netlify's free plan is the
  fallback (checked the same way). Vercel's free plan is for non-commercial
  use only.

- [ ] A free trademark search for "Crumpet" in software classes 9 and 42
      (EUIPO's TMview, the USPTO's search, the Danish DKPTO), before the
      accounts and home page. A clash becomes a call before anything more is
      built on the name.
- [ ] The move (by Sun 25 Oct, after Download everything has shipped): a
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
      `docs/google-drive-setup.md`, `docs/accounts-setup.md`, and `mac.yml`'s
      notes. 🙋 Peter's part is in sitting 1.
- [ ] The ops repo (C2): `crumpet-ops`, private, made by Claude
      (`create_repository`), with `social/` (one file per week), `email/`
      (issues and welcome emails), `outreach/`, `scoreboard/`,
      `.github/workflows/` and a README that points back here. Free plans
      include 2,000 workflow minutes a month for private repos, far more than
      this needs.

### The home page and the words around it

- [ ] The home page (at the new address's root): who it's for (novelists, and
      anyone writing something long), what Crumpet does in pictures, "your
      files stay yours" (Drive or a folder, plain Markdown), Free and Pro (Pro
      shown from stage 4), the newsletter sign-up, the Mac download,
      questions and answers, About (D5, D11), privacy and terms; card images
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

🎬 **D4 · Support address**
- **A new free Gmail just for Crumpet** (recommended), something like
  hello.crumpetapp@gmail.com: your own inbox stays private, and this one is
  published in the app and on the pages. It forwards to your own inbox, with
  Gmail's "Send mail as" so replies go out from the Crumpet address (10
  minutes in sitting 1).
- Your own address.

🎬 **D5 · Your name and address.** Danish law (e-handelsloven § 7) asks a
business's website to show a name, a physical address, an email, and its CVR
number if it has one. Email services also print a postal address at the foot
of every newsletter, and a CVR registration (D18) is public.
- **Your name and home address** (recommended, and the only free way): on the
  About page (linked from every page's foot) and in the email footer.
- Your home address on the website only, with Kit's address in the emails
  (only if you pick Kit in D7).
- Pay for a business address later (an upgrade): no home page, newsletter or
  selling until then.

- [ ] Fonts from our own address: the interface fonts come from Google's
      servers, which sends each visitor's IP address to Google (a German court
      called that unlawful without consent). Ship them with the app, with
      their licence files (SIL OFL); fonts a person picks later still come
      from Google, and the privacy page says so. Where: `app/index.html`
      (~lines 39–40), `app/src/ui/fonts.ts` (~87), the font handling in
      `app/public/sw.js`.
- [ ] The privacy page rewritten for what Crumpet now does (rule 11: Peter
      approves the wording, about 15 minutes of reading). It covers:
  - who is responsible (Peter, the support address)
  - each purpose and its basis: the account (contract), the newsletter and
    usage counts (consent, from age 13), licence checks (contract), buying
    (Polar, as a separate controller), and sales and bookkeeping records (a
    legal duty, kept 5 years)
  - who handles data for us: Firebase, the email service, Umami, the host's
    logs
  - Google sign-in and Drive, when someone connects them (their scripts load
    from Google), and Google Fonts
  - the browser's dictation service, YouTube and Vimeo for embedded videos,
    and lookups (Datamuse, Free Dictionary, Wikipedia)
  - transfers outside the EU, how long things are kept, people's rights, and
    complaints to Datatilsynet

  "Does not collect anything" goes. Where: `app/public/privacy.html`.
- [ ] Feedback and support switched on: `VITE_FEEDBACK_EMAIL` and
      `VITE_SUPPORT_URL` in `app/.env` (the support link goes to the home
      page's help section). The menu items are already built
      (`app/src/ui/help.tsx`).

### Counting what matters

🎬 **D6 · Usage counts**
- **Umami (free), only for people who switch on "Share anonymous counts"**
  (recommended): lawful in Denmark, keeps "nothing is collected unless you say
  yes" true; fewer numbers, but the proportions hold. (Claude first checks
  that Umami's free plan allows a paid app and lets the scoreboard read the
  numbers; if not, the free choice is PostHog's EU plan, or no counting.)
- Umami for everyone, explained on the privacy page: more numbers, but against
  the Danish authorities' 2025 guidance (visitor statistics need consent),
  and remembering what's been counted on the device needs consent anyway.
- No counting in the app: only the counts the services already give (Mac
  downloads, sign-ups, sales).

- [ ] A tiny sender of our own, with no outside script:
      `app/src/data/analytics.ts` with `track(name)`, posting to Umami's
      collect address. It's off in development, under automation
      (`navigator.webdriver`) and unless switched on. It never sends titles or
      text, and each milestone is counted once per device. Events: app opened
      (installed or not, Mac or web), first note, first book, a book's third
      chapter, an export (which kind), Drive or folder connected, Pro window
      shown, checkout opened, licence activated, newsletter link opened. The
      switch: a quiet line on the welcome page and a row in Settings. Where:
      new `data/analytics.ts` (`VITE_UMAMI_WEBSITE_ID` in `app/.env`);
      `main.tsx` (`start()`); the call sites (`store.createNote`, the three
      book buttons, `exportbook.tsx`, `NotePane.tsx` `downloadItems`,
      `exportmenu.tsx`, `sync/connection.ts`, `data/pwa.ts`).
- [ ] Links say where they came from (`?ref=x`, `bsky`, `threads`, `email`).
      The tag is passed on in the address to a newsletter sign-up (a hidden
      field) or checkout (Polar's metadata) during the same visit, and kept
      on the device only for people who switched on counts.
- [ ] The weekly scoreboard: a workflow in the ops repo gathers the week's
      numbers into `scoreboard/YYYY-Www.md`, read by the weekly routine and
      never published: Mac downloads from GitHub, newsletter subscribers,
      Umami counts (`UMAMI_API_KEY`, if the free plan has an API), Buffer's
      post stats, and Polar's sales once they start.

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
      Sinclair Fleeton), what (Crumpet news, writing tips and offers,
      including Crumpet Pro), how often, unsubscribe any time, a link to
      privacy; double opt-in. A plain HTML form post to the service (its
      captcha off), or a link to its own sign-up page in a new tab, with no
      framed forms (they load the service's scripts and Google reCAPTCHA,
      which need cookie consent). Places: the home page (top and foot); Help
      ("Crumpet news by email"); Settings → Account; the foot of the What's
      new window; the welcome page's last line; and once, a quiet line in a
      book's outline after its first 1,000 words. Where: `app/.env`
      `VITE_NEWSLETTER_URL` (shown only when set, like the feedback item),
      `ui/help.tsx`, `ui/account.tsx`, `ui/NotePane.tsx` (`Welcome`,
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

🎬 **D9 · The accounts**
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
      brand mark and app pictures; a bio (who it's for, free to try, "I make
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
      `social/YYYY-Www/` folder, merged only after Peter's OK. The Mac build leaves
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

Claude sends the exact steps once D3, D4, D6 and D12 are made:

1. Check your employment contract allows a side business and doesn't claim
   what you make in your own time; if you're in an a-kasse, note that you'll
   tell it once there's a business. 5 min
2. The support Gmail (D4), forwarding to your own, and "Send mail as" in your
   own Gmail. 10 min
3. If asked, let Claude's GitHub app into crumpet-ops. 2 min
4. Cloudflare (D3): sign up (free, no card), make an API token with the
   permissions Claude names, and put it and the account id in crumpet-app's
   secrets. Then Google Cloud (the new address as an allowed origin for the
   sign-in client and the API key; the home page, privacy and terms links on
   the Branding page; Audience → Publish app, so anyone can connect Google
   Drive) and Firebase (the new address as an authorised domain; Project
   settings → Data privacy → accept the data processing terms). 25 min
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
  50,000-word goal, a progress picture to share, posts and emails. Pro comes in
  December, and everything said in November says so plainly (below).
- Skip November and keep building towards December.
- Open Pro in November: less ready, brand-new accounts, few people to sell to
  yet.

- [ ] A November goal in one tap (by Sat 31 Oct): a book's deadline of 30
      November and 50,000 words (deadlines and daily targets already exist),
      offered on the welcome page and in a book's ··· menu.
- [ ] A progress card to share (by Sat 31 Oct): words, days and streak as a
      picture to save (made in the browser; nothing uploaded). Where: a small
      new `ui/progresscard.tsx` (canvas to PNG), opened from the book's
      deadline.
- [ ] A November page beside the home page (by Sat 31 Oct), with posts and
      emails around it. Every one of them says plainly: Crumpet is free to
      write in; from December, Crumpet Pro adds more books and Word, e-book
      and print-ready PDF downloads (with D14's answer on November books);
      plain-text and Markdown downloads stay free.
- [ ] Hearing from writers: "Tell me what's missing" in Help and in the
      welcome email; replies feed the weekly routine; anyone quoted has said
      yes in writing.
- [ ] Places to tell writers where sharing your own tool is allowed (for
      example r/SideProject; r/FantasyWriters only if its moderators say yes
      in writing first), each with a draft that follows its rules and says "I
      make Crumpet". 🙋 You post the ones you like from your own accounts
      (optional; Claude never posts there).

## Stage 4. Crumpet Pro (2 Nov – 7 Dec)

Free stays generous; Pro is for people writing books who want them finished
and sent out. One switch, `VITE_PRO`, has three settings: off (as today);
`show` (Settings → Crumpet Pro, Buy and the key box are there, but no limits
apply), for Polar's review; and `1` (the Free limits apply).

🎬 **D14 · What's free and what's Pro**
- **Free: notes and one book, everything inside them, printing, and .txt,
  .md, .odt, .rtf and .html downloads. Pro: any number of books, plus Word,
  e-book and the print-ready manuscript PDF from a book's Export window**
  (recommended: you pay when you're ready to send your book out).
- Free: everything, any number of books. Pro: only the Word, e-book and PDF
  exports.
- Free: notes only. Pro: books (a stronger reason to pay, but fewer people
  try the best part).
- And: a single note's Word download: **free** (recommended: Pro is about
  books) / Pro.
- And: books started before Pro switches on keep free Word, e-book and PDF
  downloads: **yes** (recommended: a thank-you to November's writers, and it
  makes "free in November" wholly true) / no.

🎬 **D15 · Price** (always shown with VAT included, as Danish price rules
require; for Danish buyers it's in kroner at checkout)
- **$49 as the founders' price until Tue 19 Jan 2027, then $69** (recommended).
  After Polar's fees and VAT, a European sale leaves you about $35.50 at $49
  and about $50 at $69; a US sale about $46 and $65.
- $35 founders', then $49.
- $39 a year: keeps earning, but writers dislike subscriptions.
- And: the founders' price ends on its date only (recommended), or also after
  the first N buyers (then every mention names both).
- And: what "once" includes. Recommended: Pro for Crumpet 1 on the web, Home
  Screen and Mac, with every Crumpet 1 update. If a Crumpet 2 ever comes,
  Crumpet 1 stays online and working for buyers, with fixes it needs for at
  least two years.

🎬 **D16 · Refunds**
- **30 days, no questions** (recommended): simple, honest, builds trust, and
  goes further than the law's 14 days, so there's no withdrawal tick box at
  checkout. Each refund still costs Polar's fee (about $3.70).
- 14 days.
- Only what the law requires: a required tick box at checkout ("I want
  Crumpet Pro now and understand I lose my 14-day right of withdrawal once my
  licence key is delivered"). Only once it's confirmed that Polar's receipt
  repeats that consent, as the law requires.

🎬 **D17 · The shop**
- **Polar** (recommended). Free to start; as the seller it takes care of VAT
  and sales tax worldwide. Its licence keys can be checked straight from the
  browser. It has a test sandbox and pays out to a Danish bank account.
  Costs: 5% + 50¢ a sale, plus 1.5% for cards from outside the US, worked out
  on the price with VAT (about $3.70 of a $49 sale in Europe). Polar keeps
  that fee if you refund, charges $15 for a disputed payment, and may refund
  a buyer itself within 60 days to head off a dispute. Getting money out
  costs about $2 in each month you withdraw, plus 0.25% + 25¢ a time; you
  press Withdraw yourself, once a month (Claude reminds you, 2 minutes). From
  the presale, buyers' emails need an answer within 48 hours, weekends and
  holidays included, or Polar may refund them. Its company is in the US,
  which keeps Danish VAT simple (checked before sitting 4).
- Dodo Payments: a little cheaper, but Crumpet must check more itself, and
  payouts to Denmark are unconfirmed.
- Gumroad: simplest, but about twice the fees and weak licence limits.

🎬 **D18 · Danish business form** (after Claude's re-check of the Danish
facts, below)
- **A free sole-trader business (enkeltmandsvirksomhed) with a CVR number, no
  VAT** (recommended): 10 minutes on virk.dk with MitID. It tells
  Skattestyrelsen Crumpet is meant as a business. They decide on the facts
  (selling at a price, with marketing), not the CVR alone, and a business is
  what makes costs deductible and a loss usable against your salary. Your
  name and address become public on the CVR register. Crumpet gets its own
  Digital Post, read with MitID. Each year Claude prepares the extended tax
  return for you to check and send (about 30 minutes, by 1 July).
- Sell the first copies as personal income (B-income) without a CVR, and
  register once sales are steady: keeps your address off the register (though
  with D5's recommendation it's on the website and in the emails anyway), but
  whether it's a hobby or a business is less clear.

🎬 **D19 · The code's licence** (the repo is public; anyone can read it)
- **Look, don't copy** (recommended): a LICENSE saying the code may be read,
  and forked on GitHub as GitHub's terms allow, but not used, shared or sold
  anywhere else; others' code and the fonts keep their own licences. A README
  line asks people to buy Pro rather than remove the check. Pro works on
  trust, and that's fine.
- Free for personal use (PolyForm Noncommercial): people may use and change
  it, not sell it.
- Open source, where anyone may copy and sell it: not recommended.

- [ ] One place decides Pro: `app/src/data/pro.ts` (`isPro`, `canStartBook`,
      `canExport`, the `VITE_PRO` switch) and `app/src/ui/pro.tsx`
      (`openUpgrade(reason)`, and a calm Pro window: what Pro adds, Buy, Enter
      a licence key). Gate only in the interface, never in the store or sync:
      books arriving through sync always appear, books made before Pro
      switched on stay fully usable (and keep free exports if D14 says so),
      and nothing is ever hidden. Where: the three book buttons (`App.tsx`
      ~361 `newProject`, `Sidebar.tsx` ~151, `phone.tsx` ~36) and the export
      buttons (`exportbook.tsx` `go()`, `NotePane.tsx` `downloadItems`,
      `exportmenu.tsx`, `finder.tsx` ~201–202), matched to D14's answer.
      Never gate a person's own uploaded Word file or its saving back. Add a
      free Markdown (.md) download.
- [ ] The licence (`app/src/data/licence.ts`): activate, check and remove,
      using Polar's public licence addresses (`VITE_POLAR_API`, live or
      sandbox) with Crumpet's organisation id (`VITE_POLAR_ORG_ID`), and
      checking the benefit id (`VITE_POLAR_BENEFIT_ID`). The result is
      remembered and checked at most once a day. A long offline grace period
      means Pro is never removed because of a network error or a busy server.
      It's kept per device in `Settings.licence` (`types.ts`), not in shared
      settings. The activation limit is generous, because the website, the
      Home Screen app and the Mac app each count. A hidden `#polar=sandbox`
      switch (kept per device, with a "Sandbox" badge) points the live app at
      Polar's sandbox for testing. In the Mac app, calls go through the main
      process (`ipcMain.handle('licence')` and `crumpetDesktop.licence` in the
      preload), because its address is app://crumpet. Where: `types.ts`,
      `data/account.ts` (copy its error handling), `desktop/main.cjs`,
      `desktop/preload.cjs`, `data/desktop.ts`.
- [ ] Settings → Crumpet Pro: Free or Pro (and who it's licensed to), Buy (at
      the founders' price while it lasts), enter a key, remove it from this
      device, a lost-key link (Polar's customer page); also in the ⚙ menu.
      Where: `Settings.tsx` (`CALM_SECTIONS` and the classic `SECTIONS`),
      `settingrows.tsx`, `Sidebar.tsx` (`SideMenu`).
- [ ] Back from checkout: the checkout's success address is a thank-you page
      on the home page (`thanks.html?checkout_id={CHECKOUT_ID}`). It says the
      key is on Polar's confirmation page and in the receipt email, and links
      to the app with `#pro`, which opens Settings → Crumpet Pro with the key
      box ready (read and cleared like `#clip=`, `data/clip.ts`'s pattern).
      Pasting the key is the way in, unless Polar later puts the key in the
      address.
- [ ] Tests: a "be Pro" hook in `open()` (`tests/e2e/app.spec.ts`) so the
      existing tests keep working; tests of the Free limits (a second book
      opens the Pro window; .txt and .md still download); Polar faked with
      `page.route` (as `account.spec.ts` fakes Firebase); unit tests for
      `pro.ts` and `licence.ts`.
- [ ] Polar set up by a workflow, not by hand (by Sat 14 Nov, after sitting
      3). An on-demand workflow in the ops repo uses `POLAR_SANDBOX_TOKEN`,
      then `POLAR_TOKEN`, to create the product at the founders' price (VAT
      included), the licence-key benefit (prefix CRUMPET, an activation limit
      of about 10) and the checkout link (success address above). Only if D16
      is the legal minimum, it also adds the withdrawal tick box. It prints
      the public ids for `app/.env`. On Wed 20 Jan 2027 the same workflow
      raises the price to $69: no discount codes, so no crossed-out "was"
      price ever shows. Also check that Polar's checkout has the EU
      withdrawal function required since 19 June 2026.
- [ ] Pages for buying (rule 11: about 30 minutes of reading for you):
  - pricing, on the home page (VAT included; the founders' price with its end
    date)
  - terms of use and the Pro licence (personal use, which devices, what
    "once" includes per D15, Danish law, without taking away consumers'
    rights)
  - the refund policy (D16), pointing to Polar as the seller
  - About and contact (name, address, email, and the CVR if there is one; D5,
    D18)
  - privacy updated for licence checks and Polar

  Where: `app/public/terms.html`, new `refund.html` and `about.html`,
  `privacy.html`.
- [ ] A security contact: `SECURITY.md` in the repo and
      `/.well-known/security.txt` on the site with the support address. Also
      a one-page note in the ops repo on reporting an actively exploited
      weakness under the EU Cyber Resilience Act (its reporting duty has
      applied to sold software since 11 Sep 2026; Claude drafts, Peter
      submits). Review the full rules before 11 Dec 2027.
- [ ] The guide and What's new say what's free and what's Pro (CLAUDE.md rule
      2); retake the export pictures if the export window changes. Where:
      `ui/guide.tsx` (~44, ~84–91), `tests/shots/guide.shots.ts`.
- [ ] The Danish facts re-checked (rule 7), before sitting 4: VAT when the
      shop is a US company; whether Polar's fee and Stripe's payout fees count
      as services bought from abroad (a business buying services from abroad
      must register for VAT from the first purchase, whatever its turnover; if
      so, D18 becomes a CVR with VAT); the 50,000 kr line; bookkeeping; the
      CVR. Then one page for you, with the exact answers for virk.dk.
- [ ] Books kept privately: a bookkeeping spreadsheet, and a short note of how
      the books are kept (good practice; the law requires it only above
      300,000 kr turnover two years running), with receipts and payout
      statements kept 5 years. In your Google Drive, never the repo: Claude
      puts them there if your Drive is connected to Claude, otherwise you save
      them (2 minutes). A monthly reminder (withdraw the payout, file the
      statement) runs in the weekly routine.
- [ ] `VITE_PRO=show` with the live checkout and organisation, then submit to
      Polar for review (aim for Mon 23 Nov; the review takes up to 14 days),
      so its reviewers can buy with a 100% code Claude makes and use the key
      in the live app. A Mac release follows.

### 🙋 Sitting 3: Polar (about 10 minutes, by Mon 9 Nov)

Once D17 is made: sign up at Polar (GitHub or Google login); create the
organisation "Crumpet" and a sandbox one; in each, organisation settings →
the website, the support address and the X profile; make an access token in
each and put them in crumpet-ops' secrets as `POLAR_TOKEN` and
`POLAR_SANDBOX_TOKEN`.

### 🙋 Sitting 4: identity, bank and the CVR (about 40 minutes, 20–23 Nov)

1. A test purchase in the sandbox: open the link Claude sends, pay with the
   test card 4242 4242 4242 4242, open Crumpet with `#polar=sandbox` and
   paste the key. 5 min
2. Polar: the identity check (passport or ID card, and a selfie); the payout
   account (Stripe, personal, Denmark, a DKK account in your name, not Wise
   or Revolut); the W-8BEN tax form if Polar asks for it (you're not a US
   person; Claude explains each box). 15 min
3. The CVR on virk.dk with MitID (if D18), using Claude's answers; tick
   advertising protection (reklamebeskyttelse). If you're in an a-kasse,
   tell it about the business. 15 min
4. Submit Polar for review, with the description Claude writes. 5 min

## Stage 5. Founders' presale (8 Dec – launch)

The first real money, from people who already know Crumpet, before any
fanfare.

🎬 **D20 · Opening Pro**
- **Open Pro at the founders' price to newsletter readers and followers in
  December** (recommended): money and proof before launch.
- Wait for the January launch.

- [ ] The Free limits switched on (`VITE_PRO=1`) once Polar has approved, and
      a Mac release. 🙋 First, one live purchase with a 100% code Claude
      makes, then activating the key (5 min). Polar forbids testing with real
      cards, and keeps its fee when a sale is refunded.
- [ ] The founders' email and posts: what Pro adds, the price, exactly when
      the founders' price ends, and the refund promise.
- [ ] First money: Claude works out the change to your forskudsopgørelse
      (expected profit for 2026 and 2027), and 🙋 you enter it in TastSelv
      with MitID (5 min; it avoids back-tax and interest). Set aside about
      45% of each payout's profit (about 50% if your salary is over about
      58,000 kr a month, about 56% over about 70,500 kr).
- [ ] Polish before launch: review group 9 (the chapter opening in Read, one
      name, "book", everywhere, the two React warnings, the note list as one
      Tab stop, the phone list's compact choice); group 5's first item
      (browser tests in the calm look); group 8 (C3). A Mac release by Fri 8
      Jan with all of it.

## Stage 6. Launch (Tue 12 Jan 2027)

Mid-January is when people decide this is the year they write their book.
Claude prepares everything; you press the buttons, because these sites need
a real person.

🎬 **D21 · Launch day**
- **Tuesday 12 January** (recommended: more visitors).
- Saturday 16 January: easier to reach Product Hunt's top five, fewer
  visitors.
- Tuesday 5 January: earlier, with people just back from the holidays.

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
      drafts each note and makes a free Pro code for each (a single-use 100%
      Polar code); 🙋 you send them from the support address (about 2 minutes
      each).
- [ ] Product Hunt: name, tagline, description, five pictures and a
      60-second video, and your first comment. 🙋 You make the listing from
      Claude's words and pictures (the video on YouTube for its gallery) and
      schedule it (on or after Sat 12 Dec, by Fri 8 Jan; about 30 minutes).
      Never ask for upvotes; only "come and tell me what you think".
- [ ] Show HN (Thu 14 Jan, if D12 includes it): title options and the story
      (our own editor, no server, your files in your own Drive), plus likely
      questions with factual answers. You write the post and your replies in
      your own words. Never link the Show HN post from emails or posts (Hacker
      News treats that as rounding up votes).
- [ ] Reddit (if D12 includes it): a post written for each subreddit's rules,
      saying "I made this": r/SideProject, and r/macapps at most once a month.
      Not r/FantasyWriters (its rules ban ads for paid services). Read the
      rules again on the day.
- [ ] The launch email and posts (pointing to the app or the Product Hunt page
      with "tell me what you think"); "the founders' price ends Tue 19 Jan".
- [ ] Launch-day watch: Claude watches feedback and fixes problems quickly
      (with the checks, and a Mac release if it's affected), and never replies
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
4. Once a month: remind Peter to withdraw the payout, and file the statement
   in the books.
5. Update this file: tick, record, and list what's waiting on Peter.
6. The report on a private page: numbers against last week, what changed, and
   up to three calls.

### The upgrade ladder

Paid only from what Crumpet has earned. Each is a call when its line is
crossed. Before the first one, Claude checks Danish VAT: if buying it means
registering for VAT, the call says so (a VAT return in TastSelv twice a year,
about 15 minutes each with Claude's numbers, and 25% Danish VAT on top of the
price).

1. **A domain** (about 100 kr a year), moving Crumpet there with the same
   helper as D3, and buyers entering their key once more. When earnings pass
   about 1,000 kr.
2. **X Premium** for Crumpet's account (about 60 kr a month): free accounts'
   posts get a median of under 100 impressions, Premium's over 600 (Buffer's
   study; a correlation, not proof). When earnings pass about 2,000 kr.
3. **Apple's developer programme** (about 750 kr a year): a signed Mac app
   with no warning, then iPhone and iPad in the App Store, where Apple takes
   15% of Pro bought in the app. When earnings pass about 5,000 kr.
4. **The email service's paid plan**, when the free limits bite.
5. **Polar's Pro plan** ($20 a month for lower fees), when sales pass about
   $1,400 a month.

### Check-ins: is it making money?

At 30, 60 and 90 days after launch (Fri 12 Feb, Fri 12 Mar and Mon 12 Apr
2027), Claude reports the numbers against these lines, and you choose:

- **Going well**, 60 or more paying by day 90: keep going and climb the
  ladder.
- **Promising**, 15–60: change one thing (what's in Pro, who we talk to, or
  the price, which once at $69 stays there for months: never back to the
  founders' price) and run another 60 days.
- **Not yet**, under 15: look at where people stop (do they try it, start a
  book, open checkout?) and decide: one bigger change, keep Crumpet as your
  own tool, or stop. Stopping means switching the Pro check off so every
  buyer keeps Pro, keeping the app online for at least a year (with a copy to
  download), emailing buyers, and offering refunds to recent ones.

For scale, October's projections put a quiet website-only launch at about 30
paying customers in 2027, and a fuller one like this at about 45. The middle
case, about 250, assumed about 10,000 people trying Crumpet and an iPhone app
in the App Store, which here is only on the ladder.

---

## What this plan rests on (researched 18 Oct 2026)

Re-check each when it's used (rule 7). "Third-party" means it came from a
secondary source.

- **GitHub Pages:** not "for running your online business … or providing
  commercial software as a service", and not for "sensitive transactions like
  sending passwords" (GitHub Pages limits). **Cloudflare Pages free:** 500
  builds a month, unlimited static requests (third-party); commercial use not
  confirmed this session. Vercel's free plan is non-commercial.
- **Polar:**
  - A merchant of record (EU VAT, UK VAT, US sales tax) with no monthly fee.
  - Fees: 5% + 50¢ a sale plus 1.5% for non-US cards, worked out on the total
    with VAT; kept on refunds; $15 a dispute; it may refund within 60 days.
  - Payouts cost $2 a month with one, plus 0.25% + 25¢. Individuals are
    allowed, and Denmark is on its payout list (Stripe Connect Express, a DKK
    bank account).
  - Licence keys are checked with
    `POST https://api.polar.sh/v1/customer-portal/license-keys/{activate,validate,deactivate}`:
    no key needed, open to browsers (CORS from any origin), 3 requests a
    second per address.
  - Its success address can carry `{CHECKOUT_ID}`, but not the key.
  - There's a sandbox at sandbox.polar.sh and a test card 4242…; testing
    with real cards is not allowed.
  - The first review takes up to 14 days, with the integration built first.
    Support emails must be answered within 48 hours.
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
- **Danish marketing and consumer rules:**
  - markedsføringsloven § 10 needs prior, active, informed consent and an
    easy way out, with proof of consent kept. Promotional direct messages and
    emails to people who haven't asked count as spam.
  - Prices to consumers are shown with VAT; no "before" prices that weren't
    charged.
  - The digital-content withdrawal waiver needs express consent and a
    confirmation.
  - Hidden advertising is not allowed, so makers say they make it.
  - GDPR article 13 sets what a privacy notice says.
- **Usage counts:** Umami Cloud's free Hobby plan gives 100,000 events a
  month and custom events, with no cookies. Unconfirmed: whether a paid app
  may use it, where it stores data, and whether its API is on the free plan.
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
  - r/FantasyWriters bans ads for paid services.
  - NaNoWriMo closed in 2025; Novel November (ProWritingAid) runs 1–30
    November.
- **Denmark** (from knowledge, not checked against live pages; re-check in
  stage 4):
  - A CVR for a sole trader is free on virk.dk, and only required once VAT
    registration is.
  - A sale to a non-EU merchant of record is most likely outside Danish VAT
    and doesn't count towards the 50,000 kr line. An EU-based shop, or buying
    services from abroad (perhaps including Polar's fee), can require VAT
    registration from the first krone.
  - Bookkeeping: receipts are kept 5 years. A written procedure and a
    registered digital system are only required above 300,000 kr turnover
    two years running.
  - e-handelsloven § 7: a name, physical address, email and CVR on a
    business's site.
  - Interface fonts loaded from Google send visitors' IP addresses to
    Google.
  - The EU Cyber Resilience Act's reporting duty applies to sold software
    from 11 Sep 2026; the full rules from 11 Dec 2027.
- **This repo:**
  - Pages publishes on every merge to `main`.
  - The app lives at `/crumpet-app/` until D3. Moving it changes where the
    browser keeps notes, so Download everything and the forwarding helper
    come first, and the manifest, the service worker's place and the OAuth
    origins move with it.
  - `app/.env` is public.
  - Book creation in the interface happens in exactly three places.
  - Shared settings sync through `.crumpet/vault.json`, where an older app
    can drop keys it doesn't know (so the licence stays out of them).
  - Most of the 160 browser tests make books or download files, so turning
    the limits on needs a "be Pro" test hook.
  - 47 test lines hold this container's folder path.

## Sources

- GitHub and hosting: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits),
  [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- Polar: [fees](https://polar.sh/docs/merchant-of-record/fees),
  [licence keys](https://polar.sh/docs/features/benefits/license-keys),
  [validate](https://polar.sh/docs/api-reference/customer-portal/license-keys/validate),
  [CORS in its server code](https://raw.githubusercontent.com/polarsource/polar/main/server/polar/app.py),
  [supported countries](https://polar.sh/docs/merchant-of-record/supported-countries),
  [account reviews](https://polar.sh/docs/merchant-of-record/account-reviews),
  [checkout links](https://polar.sh/docs/features/checkout/links),
  [custom fields](https://polar.sh/docs/features/custom-fields),
  [sandbox](https://polar.sh/docs/integrate/sandbox)
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
- Denmark: [skat.dk on VAT](https://skat.dk/erhverv/moms), [virk.dk](https://virk.dk/),
  [e-handelsloven § 7](https://www.lovguiden.dk/loven/e-handelsloven/7)
