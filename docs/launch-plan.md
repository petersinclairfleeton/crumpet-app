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

## The plan at a glance

| Stage | When | What happens | Your part |
|---|---|---|---|
| 1. Safe and quick | 19 Oct – 1 Nov | Words can't be lost, long chapters type quickly, the first visit goes straight to the page, automatic checks before anything goes live | 2 calls; an optional 15-minute iPhone test |
| 2. The shop window | 19 Oct – 8 Nov | A home page, privacy put right, a support address, usage counts, the newsletter, and X, Bluesky and Threads accounts whose posts go out by themselves | 10 calls; one 45-minute sitting to make accounts |
| 3. November: write with Crumpet | 1 – 30 Nov | A free push around November's novel-writing month: a 50,000-word goal, progress pictures to share, posts and emails, hearing from real writers | 1 call; merge each week's posts (5 minutes) |
| 4. Crumpet Pro | 2 Nov – 7 Dec | Free and Pro, licence keys through Polar, prices and terms, the Danish basics | 6 calls; one 45-minute sitting (Polar, bank, CVR) |
| 5. Founders' presale | 8 Dec – launch | Pro opens at the founders' price to newsletter readers and followers: the first money | 3 calls; 10 minutes |
| 6. Launch | Tue 12 Jan 2027 | Product Hunt, Show HN, Reddit, directories, reviewers, the launch email | 2 calls; directories 20 minutes; launch days 1–3 hours |
| 7. After launch | from 13 Jan | A weekly routine that runs itself, upgrades only from earnings, and check-ins at 30, 60 and 90 days: keep going, change course or stop | up to 3 calls a week |

Your hands-on time before launch: about 4 hours, spread over 12 weeks.
Optional but the biggest growth lever that can't be automated: 15 minutes,
three times a week, replying to people yourself on X, Bluesky or Threads.

## How Claude works through this plan

1. **Each session:** fetch `main` and restart the session's branch from
   `origin/main` (CLAUDE.md), read this file, then **Calls made** and
   **Waiting on Peter**. Add the ops repo to the session when a stage needs
   it (`add_repo`, push access).
2. **Order:** take the first stage with unticked items. Stages 1 and 2 run
   side by side, and so do 3 and 4. Build as CLAUDE.md says (one pull request
   per item or few items, every check, the guide updated, merged and
   published), and tick items here in the same pull request.
3. **🎬 Calls:** when the work reaches one, ask Peter with the question tool:
   the options given here, recommended first, each with what it costs in
   money and in his time. Ask a call only when its stage needs it (or a step
   now depends on it), and no more than four at a time. Record the answer
   under **Calls made** with the date. If he says "your call", take the
   recommendation and record that.
4. **🙋 Peter's steps:** send them as numbered click-by-click steps with how
   long each takes, add them to **Waiting on Peter**, and carry on with
   whatever isn't blocked. Never ask him for something Claude can do.
5. **Keys and passwords never go in the chat or the repo.** Keys used by
   workflows go in the ops repo's secrets (GitHub → the repo → Settings →
   Secrets and variables → Actions), under the names this plan gives. Public
   values (checkout links, product ids, website ids, form addresses) go in
   `app/.env`. This container can't reach most outside services' APIs, so
   anything that calls them runs as a GitHub workflow, which Claude starts
   and reads through the GitHub tools.
6. **No money.** Only free plans: nothing that takes a card, charges, or
   starts a trial that becomes a charge. Paid things are only on the
   **Upgrade ladder**, each needing Peter's yes. If a free plan's limits
   bite, or a price or plan has changed, raise it as a call.
7. **Re-check before relying.** Every outside service's prices, limits and
   rules here were researched on 18 October 2026, some only from search
   results. Check the service's own pages when setting it up, and note
   changes here.
8. **The repo is public.** Never put in it: keys, licence keys, anyone's
   name or email (customers, subscribers, reviewers), sales or subscriber
   numbers (unless Peter chooses to share them, D12), bookkeeping, his CPR
   number or bank details. Those live in the private ops repo, its secrets,
   or Peter's Google Drive.
9. **Nothing goes out in Peter's name without his OK** (posts, emails,
   listings): per weekly batch, or by a standing rule he gives in D12.
   Social posts follow X's automation rules: scheduled original posts only.
   Never automated replies, likes, follows or messages, and never the same
   post on two X accounts. Never message anyone who hasn't asked (by email or
   direct message): Danish law treats it as spam. Never add anyone to the
   newsletter who didn't sign up themselves.
10. **Honest marketing.** Every claim true and checkable; "free" only for what
    is free; a founders' price says when it ends, then ends; no fake reviews;
    never ask for upvotes (Product Hunt, Hacker News and Reddit forbid it);
    anyone given free Pro to review it must label the review as an ad; quote
    writers only with their written yes.
11. **Crumpet stays calm and people's words stay theirs.** No pop-ups or
    nagging: upgrades and sign-ups are quiet lines and Settings rows. Books
    stay open and editable whether or not anyone pays; plain text and
    Markdown downloads are always free.
12. **End each session** with CLAUDE.md's summary, plus the next call coming
    up and anything waiting on Peter.

## Calls made

Newest last. The review plan's calls still stand: first visit straight to the
page; Word is done; the classic window retires; one name, "book".

- 18 Oct 2026: no money in until Crumpet earns it; upgrades are paid from
  earnings.
- 18 Oct 2026: marketing is organic: a Crumpet X account and an email
  newsletter.
- 18 Oct 2026: Peter makes the calls; Claude does the work and asks along the
  way.

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
- **You, 15 minutes** (recommended): Claude writes `docs/device-checklist.md`
  (the review's group 7, cut to the ten checks that matter); you go through it
  on your iPhone and say what misbehaves.
- The November writers do it (the checklist goes in their welcome email); the
  first strangers would meet the bugs.
- Skip it.

- [ ] Checks before merging (review group 6): a pull-request workflow (app and
      editor types and tests, a build, the browser tests split over four
      runners); merging waits for it to pass; the Pages workflow runs the
      editor's tests too. First, because from here every merge reaches real
      people. Add "wait for the checks" to CLAUDE.md's shipping steps.
- [ ] Words can't be lost (review group 3): ask the browser to keep Crumpet's
      storage; Settings → Download everything (a .zip of the same Markdown
      folder sync writes) and taking it back in; "Only on this device · Keep
      a copy" in the sidebar while nothing is connected.
- [ ] Quick typing in long writing (review group 2), all five items,
      including the speed test kept in the repo (under 35 ms per key at
      30,000 words, from 111).
- [ ] A gentler first visit (review group 4): straight to the page; one
      Google step (connecting Drive also signs in); the account stays in
      Settings.
- [ ] Fresh pictures for people who've visited before: the service worker
      keeps non-hashed files (guide pictures, brand, and soon the home page's
      images) forever, so retaken pictures never reach returning visitors.
      Make them refresh in the background (hashed `/assets/` files stay as
      they are) and check the app still starts offline. Where:
      `app/public/sw.js` (the fetch handler, `CACHE`, `keepPage()`).
- [ ] The Mac app released on purpose: `mac.yml` builds on a tag or a manual
      run (not every merge), with release notes from `data/whatsnew.ts`; the
      Mac app says when a newer version is out (it doesn't update itself).
      Where: `.github/workflows/mac.yml`, `desktop/main.cjs`,
      `desktop/preload.cjs`, `app/src/data/desktop.ts`.
- [ ] 🙋 Google sign-in open to everyone (2 minutes; it can't be seen from
      here): Google Cloud console → Google Auth platform → Audience. If it
      says Testing, press Publish app. Until then only listed test users can
      connect Google Drive. (`docs/google-drive-setup.md` step 6.)

## Stage 2. The shop window (19 Oct – 8 Nov)

Somewhere to send people, a way to hear from them, a list to write to, and
accounts that post by themselves. Runs alongside stage 1.

### Where things live

🎬 **D3 · Crumpet's web address**
- **Stay at petersinclairfleeton.github.io/crumpet-app** (recommended): free
  and nothing moves. Moving later, with the first domain on the upgrade
  ladder, is a single move, helped by Download everything (stage 1). GitHub
  says Pages isn't meant for running online businesses; Crumpet's sales
  happen on Polar's site, so for a small app the risk looks low, but it is a
  grey area.
- Move now to a free Cloudflare Pages address (something like
  crumpet-app.pages.dev): commercial use allowed and a tidier name, but a
  second move if a domain comes later, and about 10 minutes of your clicks
  (Cloudflare, Google and Firebase settings).
- Buy a domain now (about 100 kr a year): tidiest, but breaks the no-money
  rule.

🎬 **D4 · Where the home page sits**
- **At …/crumpet-app/welcome/** (recommended): a plain page beside the app,
  nothing for you to set up.
- A free GitHub organisation gives a brand address such as
  crumpet-writing.github.io for the home page (you create the organisation
  and let Claude into it: 5 minutes). The app stays where it is.

🎬 **D5 · Where the marketing work lives**
- **A private repo, crumpet-ops** (recommended): post drafts, newsletter
  issues, the list of reviewers to contact (people's contact details), the
  weekly numbers and the service keys stay private. Free, including enough
  workflow minutes for this. Claude creates it; you may need to let Claude's
  GitHub app into it (2 minutes).
- In the public crumpet-app repo: simpler, but drafts are visible before
  they go out, and contact lists and numbers can't be kept there.

- [ ] The ops repo: `crumpet-ops` (private), with folders `social/` (one file
      per week), `email/` (issues and welcome emails), `outreach/`,
      `scoreboard/` and `.github/workflows/`; a README that points back here.
- [ ] The home page: who it's for (novelists, and anyone writing something
      long), what Crumpet does in pictures, "your files stay yours" (Drive or
      a folder, plain Markdown), Free and Pro (Pro shown from stage 4), the
      newsletter sign-up, the Mac download, questions and answers, About (per
      D7 and D13), privacy and terms; card images (1200×630) so shared links
      look good on X and elsewhere. No outside scripts on the app's address
      (they could read the sign-in token): sign-up forms are plain HTML posts
      or framed. Where: `app/public/welcome/` (static, like `privacy.html`;
      image names with a version in them); linked from the app's welcome page
      and Help.
- [ ] Pages writers find by searching, five to start: Crumpet and Scrivener
      compared; a Scrivener alternative for iPhone and iPad; writing a novel
      in Google Drive; manuscript format for agents (and how Crumpet does
      it); a writing app with no AI in it. One more a week after launch (the
      weekly routine). `sitemap.xml` and `robots.txt`. Fair, checkable
      comparisons only.
- [ ] Press kit (`docs/marketing/press-kit.md`): name, one-liners of 60, 140
      and 260 characters, a description, features, logo, pictures, a
      60-second video, a short maker bio.
- [ ] Voice (`docs/marketing/voice.md`): who we talk to, the tone (calm, warm,
      plain), what we never say (hype, AI-writing claims, knocking other
      apps), following D11 and D13.

### Privacy and contact, before collecting anything

🎬 **D6 · Support address**
- **A new free Gmail just for Crumpet** (recommended), something like
  hello.crumpetapp@gmail.com: your own inbox stays private; this one is
  published in the app and on the pages. You make it (5 minutes) and can
  forward it to your own inbox.
- Your own address.

🎬 **D7 · Your name and address.** Danish law (e-handelsloven § 7) asks anyone
selling online to show a name, a physical address and an email on the site.
Email services also print a postal address at the foot of every newsletter,
and a CVR registration (D19) is public.
- **Your name and home address** (recommended, and the only free way): on the
  About page and in the email footer.
- Pay for a business address later (an upgrade); no selling until then.
- Footer only: Kit's free plan prints Kit's own address in emails (D9); the
  website still needs yours.

- [ ] Fonts from our own address: the interface fonts come from Google's
      servers, which sends each visitor's IP address to Google (a German
      court called that unlawful without consent). Ship them with the app;
      fonts a person picks later still come from Google, and the privacy page
      says so. Where: `app/index.html` (~lines 39–40), `app/src/ui/fonts.ts`
      (~87), the font handling in `app/public/sw.js`.
- [ ] The privacy page rewritten for what Crumpet now does: who is
      responsible (Peter, the support address); each purpose and its basis
      (account: contract; newsletter: consent; usage counts: consent; licence
      checks: contract; buying: Polar, as a separate controller); who handles
      data for us (Firebase, the email service, Umami); Google Fonts; lookups
      (Datamuse, Free Dictionary, Wikipedia); transfers outside the EU; how
      long things are kept; people's rights; complaints to Datatilsynet. "Does
      not collect anything" goes. Peter approves the wording. Where:
      `app/public/privacy.html`.
- [ ] Feedback and support switched on: `VITE_FEEDBACK_EMAIL` and
      `VITE_SUPPORT_URL` in `app/.env` (the support link goes to the home
      page's help section). The menu items are already built
      (`app/src/ui/help.tsx`).

### Counting what matters

🎬 **D8 · Usage counts**
- **Umami (free), only for people who switch on "Share anonymous counts"**
  (recommended): clearly lawful in Denmark, keeps "nothing is collected
  unless you say yes" true; fewer numbers, but the proportions hold.
- Umami for everyone, explained on the privacy page: more numbers, but a
  grey area under the Danish cookie rules.
- No counting in the app: only the counts the services already give (Mac
  downloads, sign-ups, sales).

- [ ] A tiny sender of our own, with no outside script:
      `app/src/data/analytics.ts` with `track(name)`, posting to Umami's
      collect address. It's off in development, under automation
      (`navigator.webdriver`) and unless switched on. It never sends titles
      or text, and each milestone is counted once per device. Events: app
      opened (installed or not, Mac or web), first note, first book, a book's
      third chapter, an export (which kind), Drive or folder connected, Pro
      window shown, checkout opened, licence activated, newsletter link
      opened. The switch: a quiet line on the welcome page and a row in
      Settings. Where: new `data/analytics.ts`; `main.tsx` (`start()`); the
      call sites (`store.createNote`, the three book buttons, `exportbook.tsx`,
      `NotePane.tsx` `downloadItems`, `exportmenu.tsx`, `sync/connection.ts`,
      `data/pwa.ts`).
- [ ] Links say where they came from (`?ref=x`, `bsky`, `threads`, `email`),
      passed on to newsletter sign-ups (a hidden field) and checkout (Polar's
      metadata), so we can tell which channel brings sign-ups and sales
      without following anyone around.
- [ ] The weekly scoreboard: a workflow in the ops repo gathers the week's
      numbers (Mac downloads from GitHub, newsletter subscribers, Umami
      counts, Buffer's post stats, and Polar's sales once they start) into
      `scoreboard/YYYY-Www.md`. It's read by the weekly routine and never
      published.

### The newsletter

🎬 **D9 · Email service**
- **Brevo** (recommended): free; a French company (EU); sends without a
  domain of our own; fully automatic (welcome emails, and issues sent by the
  ops workflow); sign-ups never pause. It sends 300 emails a day, so past
  about 300 readers an issue goes out over two days (or upgrade later). Your
  address goes in the footer (D7).
- Kit: free up to 10,000 readers, and can print Kit's address in the footer
  instead of yours. But no automatic welcome series on the free plan, a US
  company, and a Gmail sender is more likely to land in spam until there's a
  domain.
- EmailOctopus: free up to 2,500 readers, a simple welcome series, quick
  approval; each issue may need you to press send.

🎬 **D10 · The newsletter's shape**
- **"Notes from Crumpet", from you by name, every two weeks (weekly during
  November)** (recommended).
- Monthly.
- Only when there's news.

- [ ] Sign-up with the consent Danish law asks for: who (Crumpet, Peter
      Sinclair Fleeton), what (Crumpet news, writing tips and offers,
      including Crumpet Pro), how often, unsubscribe any time, a link to
      privacy; double opt-in; no outside script on the app's address. Places:
      the home page (top and foot); Help ("Crumpet news by email"); Settings →
      Account; the foot of the What's new window; the welcome page's last
      line; and once, a quiet line in a book's outline after its first 1,000
      words. Where: `app/.env` `VITE_NEWSLETTER_URL` (shown only when set,
      like the feedback item), `ui/help.tsx`, `ui/account.tsx`,
      `ui/NotePane.tsx` (`Welcome`, ~637–695), `ui/Project.tsx`
      (`ProjectOutline`).
- [ ] Three welcome emails: hello, and how to start a book; three things most
      people miss (Cards, characters underlined where they appear, export);
      your files are yours (connect Drive or a folder). Built in the email
      service's own automation (Claude gives you about 10 minutes of click
      steps) or sent by the ops workflow.
- [ ] Issues as Markdown files in the ops repo; once approved (D12), the
      workflow schedules them through the service's API (key in the ops
      repo's secrets as `BREVO_API_KEY` or `KIT_API_KEY`). Every email has
      the sender's name, an unsubscribe link and the footer address.

### X, Bluesky and Threads

X's free API ended in February 2026, so posts go through Buffer's free plan,
which posts to X, Bluesky and Threads at no cost. The ops workflow puts each
week's approved posts into Buffer ahead of time (the free plan holds 10
waiting posts per network, so it tops them up daily).

🎬 **D11 · The accounts**
- Handle: Claude suggests four (the same on all three networks); you pick
  one and check it's free when signing up.
- Voice: **you, the maker, in the first person ("I'm building a calm writing
  app")** (recommended: makers' accounts grow faster, and writers trust a
  person) / Crumpet as "we" / both (your own account and Crumpet's, which
  mustn't post the same thing on X).
- Networks: **X, Bluesky and Threads** (recommended: the same posts for three
  audiences; writers are more on Bluesky and Threads, indie-app people on X) /
  X only / X and Bluesky.
- Your face and name on it: yes / name only / neither.

🎬 **D12 · How you OK what goes out**
- **One weekly batch** (recommended): every Friday Claude opens a pull
  request in the ops repo with next week's posts (pictures and videos
  attached) and any newsletter issue; merging it is your OK (about 5
  minutes). Not merged, nothing goes out.
- A standing OK: Claude merges on Sunday evening unless you've commented, and
  you get the summary.
- Every post one by one.
- And: share real numbers in posts ("building in public", good material for
  indie audiences)? Yes / no.

🎬 **D13 · Saying it was made with AI.** Many writers are wary of AI, and
Hacker News expects honesty.
- **Open, but not the headline** (recommended): the About page says it's made
  by one writer with an AI coding assistant, and that no AI touches your
  writing; posts are about writing, not how Crumpet was built; honest answers
  when asked.
- Lead with it ("one person and Claude built a Scrivener rival"): a strong
  story for tech audiences, risky with writers.
- Only if asked (risky on Hacker News).

- [ ] Profile pictures and words: avatar 400×400 and header 1500×500 from the
      brand mark and app pictures; a bio (who it's for, free to try, the home
      page link with `?ref=`); a pinned post (a 30-second video of writing in
      Crumpet).
- [ ] Pictures and short videos from the real app:
      `tests/shots/marketing.shots.ts` (separate from the guide's; reuses its
      sample library) takes stills sized for posts (light and dark, phone
      frames) and records 15–45-second clips (Playwright video turned into
      MP4 with captions, using ffmpeg). Output goes outside `app/public` (a
      gitignored `app/marketing-out/`). Clips chosen for posts are copied to
      `app/public/social/`, so Buffer can fetch them from the live site, and
      `mac.yml` leaves them out of the Mac app. First, fix `guide.shots.ts`'s
      fixed `/@fs/home/user/crumpet-app/` path so shots run anywhere.
- [ ] The posting workflow (ops repo, `social.yml`, daily and on demand): it
      reads the week's file (text per network, picture or video address, alt
      text, time) and keeps up to 10 waiting posts per network in Buffer
      through its API (`BUFFER_API_KEY`). It marks what's queued and reports
      errors. A usual week: 5 posts (2 short clips, 2 tips for novelists shown
      in Crumpet, 1 "this week in Crumpet" from `data/whatsnew.ts`) and one
      thread. On X the link goes in the bio or the first reply (posts with
      links are shown to fewer people); on Bluesky and Threads it can go in
      the post.
- [ ] If Buffer's free plan or API doesn't work as researched: Bluesky posts
      straight from the workflow (free; an app password as
      `BSKY_APP_PASSWORD`), X by hand from a weekly copy sheet with x.com's
      free scheduler (about 10 minutes a week), and it's raised as a call.

### 🙋 Your first sitting (about 45 minutes, by Sun 25 Oct)

Claude sends the exact steps when the calls above are made, in this order:

1. The support Gmail (D6). 5 min
2. The X account with that address (a phone check if asked), switched to a
   free Professional account (category Software), with Claude's pictures and
   bio. 10 min
3. Bluesky and Threads with the same handle (D11). 5 min
4. Buffer, free plan: connect X, Bluesky and Threads; make an API key and put
   it in the ops repo's secrets as `BUFFER_API_KEY`. 5 min
5. The email service (D9): sign up as an individual, enter the footer address
   (D7), make an API key and put it in the ops repo's secrets. 10 min
6. Umami (if D8): sign up, add the website, and tell Claude its website id
   (a public value). 3 min
7. Google sign-in published (stage 1), and Firebase's data processing terms
   accepted (Firebase console → Project settings → Data privacy). 4 min
8. Product Hunt, Hacker News and Reddit: sign in (or create accounts) and use
   them a little from now on (comment, follow things you like). Launches
   from brand-new accounts are restricted. 3 min
9. If asked, let Claude's GitHub app into the ops repo. 2 min

## Stage 3. November: write with Crumpet (1 – 30 Nov)

NaNoWriMo closed in 2025, but thousands still write a novel in November
(ProWritingAid's Novel November, World Anvil's NovelEmber, Reedsy's Novel
Sprint). It's the best free moment of the year to meet novelists: build the
list and hear from real writers before asking anyone to pay.

🎬 **D14 · November**
- **A free "write your November novel in Crumpet" push** (recommended): a
  50,000-word goal, a progress picture to share, posts and emails. Crumpet
  stays free; Pro comes in December.
- Skip November and keep building towards December.
- Open Pro in November: less ready, brand-new accounts, few people to sell to
  yet.

- [ ] A November goal in one tap: a book's deadline of 30 November and
      50,000 words (deadlines and daily targets already exist), offered on the
      welcome page and in a book's ··· menu.
- [ ] A progress card to share: words, days and streak as a picture to save
      (made in the browser; nothing uploaded). Where: a small new
      `ui/progresscard.tsx` (canvas to PNG), opened from the book's deadline.
- [ ] A November page beside the home page, with posts and emails around it:
      write your November novel in a calm app that keeps your files yours.
- [ ] Hearing from writers: "Tell me what's missing" in Help and in the
      welcome email; replies feed the weekly routine; anyone quoted has said
      yes in writing.
- [ ] Places to tell writers, where sharing your own tool is allowed (for
      example r/SideProject, and r/FantasyWriters' Wednesday check-in thread),
      each with a draft that follows its rules; 🙋 you post the ones you like
      from your own accounts (optional; Claude never posts there).

## Stage 4. Crumpet Pro (2 Nov – 7 Dec)

Free stays generous; Pro is for people writing books who want them finished
and sent out. Pro is built switched off (`VITE_PRO`), so it can merge piece
by piece and be switched on later in one small change.

🎬 **D15 · What's free and what's Pro**
- **Free: notes and one book, everything inside them, and plain-text and
  Markdown downloads. Pro: any number of books, plus Word, e-book and
  print-ready PDF** (recommended: you pay when you're ready to send your book
  out).
- Free: everything, any number of books. Pro: only the Word, e-book and PDF
  exports.
- Free: notes only. Pro: books (a stronger reason to pay, but fewer people
  try the best part).

🎬 **D16 · Price**
- **$69 once (about 450 kr), with a founders' price of $49 until a week after
  launch** (recommended).
- $49 once, founders' $35.
- $39 a year: keeps earning, but writers dislike subscriptions.
- And: what "once" includes. Recommended: every Crumpet 1 update (a future
  Crumpet 2 could be a paid upgrade, as Scrivener does). Shown with tax
  included (what EU buyers expect) or added at checkout.

🎬 **D17 · Refunds**
- **30 days, no questions** (recommended): simple, honest, builds trust;
  Polar handles it.
- 14 days.
- Only what the law requires (with the withdrawal tick box at checkout).

🎬 **D18 · The shop**
- **Polar** (recommended). It's free to start, and as the seller it takes care
  of VAT and sales tax worldwide. Its licence keys can be checked straight
  from the browser, its founders' discount can have an end date, it has a
  test sandbox, and it pays out to a Danish bank. It takes about 5% + 50¢ a
  sale, plus 1.5% for cards from outside the US (about $4.50 of a $49 sale
  in Europe). Its company is in the US, which keeps Danish VAT simple (check
  this when signing up).
- Dodo Payments: a little cheaper, but Crumpet must check more itself, and
  payouts to Denmark are unconfirmed.
- Gumroad: simplest, but about twice the fees and weak licence limits.

🎬 **D19 · Danish business form** (Claude re-checks the facts on skat.dk
first)
- **A free sole-trader business (enkeltmandsvirksomhed) with a CVR number, no
  VAT** (recommended): 10 minutes on virk.dk with MitID. It makes Crumpet
  clearly a business, so costs and later upgrades are deductible. Your name
  and address become public on the CVR register.
- Sell the first copies as personal income (B-income) without a CVR, and
  register once sales are steady: keeps your address off the register for
  now, but whether it's a hobby or a business is less clear.

🎬 **D20 · The code's licence** (the repo is public; anyone can read it)
- **"All rights reserved, source visible"** (recommended): a LICENSE saying
  the code may be read but not copied or sold, and a README line asking
  people to buy Pro rather than remove the check. Pro works on trust, and
  that's fine.
- PolyForm Noncommercial: free to use and change, not to sell.
- Open source, where anyone may copy and sell it: not recommended.

- [ ] One place decides Pro: `app/src/data/pro.ts` (`isPro`, `canStartBook`,
      `canExport`, the `VITE_PRO` switch) and `app/src/ui/pro.tsx`
      (`openUpgrade(reason)`, and a calm Pro window: what Pro adds, Buy, Enter
      a licence key). Gate only in the interface, never in the store or sync:
      books arriving through sync always appear, and books made before Pro
      was switched on stay fully usable. Where: the three book buttons
      (`App.tsx` ~361 `newProject`, `Sidebar.tsx` ~151, `phone.tsx` ~36) and
      the export buttons (`exportbook.tsx` `go()`, `NotePane.tsx`
      `downloadItems`, `exportmenu.tsx`, `finder.tsx` ~201–202). Never gate a
      person's own uploaded Word file or its saving back. Add a free Markdown
      (.md) download.
- [ ] The licence (`app/src/data/licence.ts`): activate, check and remove,
      using Polar's public licence addresses with Crumpet's organisation id,
      and checking the benefit id. The result is remembered and checked at
      most once a day. A long offline grace period means Pro is never removed
      because of a network error or a busy server. It's kept per device in
      `Settings.licence` (`types.ts`), not in shared settings. The activation
      limit is generous, because the website, the Home Screen app and the Mac
      app each count. In the Mac app, calls go through the main process
      (`ipcMain.handle('licence')` and `crumpetDesktop.licence` in the
      preload), because its address is app://crumpet. Where: `types.ts`,
      `data/account.ts` (copy its error handling), `desktop/main.cjs`,
      `desktop/preload.cjs`, `data/desktop.ts`.
- [ ] Settings → Crumpet Pro: Free or Pro (and who it's licensed to), Buy (at
      the founders' price while it lasts), enter a key, remove it from this
      device, a lost-key link (Polar's customer page); also in the ⚙ menu.
      Where: `Settings.tsx` (`CALM_SECTIONS` and the classic `SECTIONS`),
      `settingrows.tsx`, `Sidebar.tsx` (`SideMenu`).
- [ ] Back from checkout: Polar's thank-you page links back to Crumpet with
      the key in the address (`#licence=…`, read and cleared like `#clip=`);
      pasting the key from the receipt email always works too. Where:
      `data/clip.ts` (the `startClipListener` pattern), `main.tsx`.
- [ ] Tests: a "be Pro" hook in `open()` (`tests/e2e/app.spec.ts`) so the
      existing tests keep working; tests of the Free limits (a second book
      opens the Pro window; .txt and .md still download); Polar faked with
      `page.route` (as `account.spec.ts` fakes Firebase); unit tests for
      `pro.ts` and `licence.ts`.
- [ ] Polar set up by a workflow, not by hand. An on-demand workflow in the
      ops repo uses `POLAR_SANDBOX_TOKEN`, and later `POLAR_TOKEN`, to create
      the product, the licence-key benefit (prefix CRUMPET, an activation
      limit of about 10), the founders' discount (end date and cap), the
      checkout link, and a required tick box: "I want Crumpet Pro now and
      understand I lose my 14-day right of withdrawal once my licence key is
      delivered." It prints the public ids, which go in `app/.env`
      (`VITE_POLAR_ORG_ID`, `VITE_POLAR_CHECKOUT_URL` and so on). The whole
      purchase is tested in Polar's sandbox (test card 4242…) before anything
      real.
- [ ] Pages for buying:
  - pricing, on the home page
  - terms of use and the Pro licence (personal use, which devices, what
    updates "once" includes, Danish law, without taking away consumers'
    rights)
  - the refund policy (D17), pointing to Polar as the seller
  - About and contact (name, address, email, and the CVR if there is one;
    D7, D19)
  - privacy updated for licence checks and Polar

  You approve the legal wording. Where: `app/public/terms.html`, new
  `refund.html` and `about.html` (or in `welcome/`), `privacy.html`.
- [ ] The guide and What's new say what's free and what's Pro (CLAUDE.md rule
      2); retake the export pictures if the export window changes. Where:
      `ui/guide.tsx` (~44, ~84–91), `tests/shots/guide.shots.ts`.
- [ ] The Danish facts re-checked on skat.dk, virk.dk and erhvervsstyrelsen.dk:
      VAT when the shop is a US company, the 50,000 kr line, bookkeeping, the
      CVR. Then one page for you, with the exact answers for virk.dk. If
      anything is unclear, ask for free on Skattestyrelsen's business line or
      at the local Erhvervshus.
- [ ] Books kept privately: a bookkeeping spreadsheet and the short "how I
      keep my books" note the bookkeeping law asks for. They go in your Google
      Drive, never in the repo; Claude puts them there if your Drive is
      connected to Claude, otherwise you save them (2 minutes). A monthly
      reminder runs in the weekly routine.
- [ ] Polar review: submit once the pricing, terms and refund pages are live
      (aim for Mon 23 Nov; the review takes up to 14 days; if Polar asks for
      a 100% discount code to test with, Claude makes it).

### 🙋 Your second sitting (about 45 minutes, around 20–23 Nov)

1. Polar: sign up (GitHub or Google login); create the organisation "Crumpet"
   and a sandbox one; make an access token in each and put them in the ops
   repo's secrets as `POLAR_TOKEN` and `POLAR_SANDBOX_TOKEN`. 10 min
2. Polar: identity check (passport or ID card, and a selfie); the payout
   account (Stripe, personal, Denmark, a DKK account in your name, not Wise
   or Revolut); the W-8BEN tax form (you're not a US person; Claude explains
   each box). 15 min
3. The CVR on virk.dk with MitID (if D19), using Claude's answers; tick
   advertising protection (reklamebeskyttelse). 10 min
4. Submit Polar for review, with the business description Claude writes.
   5 min
5. If you're in an a-kasse, tell it about the side business, and check your
   employment contract allows one. 5 min

## Stage 5. Founders' presale (8 Dec – launch)

The first real money, from people who already know Crumpet, before any
fanfare.

🎬 **D21 · Opening Pro**
- **Open Pro at the founders' price to newsletter readers and followers in
  December** (recommended): money and proof before launch. The founders'
  price ends a week after launch day.
- Wait for the January launch.

- [ ] Pro switched on (`VITE_PRO=1`) once Polar has approved and the live
      checkout is tested with a 100% code. 🙋 Optionally, one real purchase
      with your own card, then refunded (5 min).
- [ ] The founders' email and posts: what Pro adds, the price, exactly when
      the founders' price ends, and the refund promise.
- [ ] First money: Claude works out the change to your forskudsopgørelse
      (expected profit for 2026 and 2027), and 🙋 you enter it in TastSelv
      with MitID (5 min; it avoids back-tax and interest). Set aside about 45%
      of each payout (50% if your salary is over about 58,000 kr a month).
- [ ] Polish before launch (review group 9, and group 5's first item: browser
      tests in the calm look): the chapter opening in Read, one name ("book")
      everywhere, the two React warnings, the note list as one Tab stop, and
      the phone list's compact choice.

🎬 **D22 · Retiring the classic window** (review group 5, your 17 Oct call;
this is only about timing)
- **Straight after launch** (recommended: less risk in launch month).
- Before launch, if time allows.

🎬 **D23 · A lighter first download** (review group 8: rarely used windows
loaded when first opened)
- **Before launch** (recommended: faster on older phones on launch day).
- After launch.

## Stage 6. Launch (Tue 12 Jan 2027)

Mid-January is when people decide this is the year they write their book.
Claude prepares everything; you press the buttons, because these sites need
a real person.

🎬 **D24 · Launch day**
- **Tuesday 12 January** (recommended: more visitors).
- Saturday 16 January: easier to reach Product Hunt's top five, fewer
  visitors.
- Tuesday 5 January: earlier, with people just back from the holidays.

🎬 **D25 · Where you'll post yourself.** Product Hunt, Hacker News and
Reddit need a real person writing their own replies (Hacker News forbids
AI-written comments).
- **Product Hunt, Show HN and one or two Reddit posts** (recommended): about
  2–3 hours over two days, mostly answering comments.
- Product Hunt only: about an hour.
- None: launch through the newsletter, the social accounts and directories,
  fully automatic and smaller.

- [ ] Directories, submitted early because their free queues take weeks to
      months (from November): AlternativeTo (as an alternative to Scrivener,
      Ulysses, Dabble and Obsidian), SaaSHub (with its free verification tag on
      the home page), Microlaunch, SaaSCity (needs its badge), Uneed if its
      free line is open, and Peerlist Launchpad on a Monday in December.
      Skip BetaList and DevHunt (paid, or for developer tools only). Claude
      writes every listing and keeps a tracker in the ops repo; 🙋 you submit
      them (2–3 minutes each).
- [ ] People who write about writing apps (December): writing-app directories
      (Reedsy's, Become a Writer Today's), newsletters about tools for
      writers, and AuthorTube reviewers. Claude drafts a personal email to
      each and makes a free Pro licence for each (they must label reviews as
      ads). 🙋 You send them from the support address, or Claude leaves them
      as drafts in your Gmail if it's connected to Claude.
- [ ] Product Hunt: name, tagline, description, five pictures and a
      60-second video, and your first comment; scheduled up to a month ahead.
      Never ask for upvotes; only "come and tell me what you think".
- [ ] Show HN (Thu 14 Jan): title options and the story (our own editor, no
      server, your files in your own Drive), plus likely questions with
      factual answers. You write the post and your replies in your own words.
- [ ] Reddit: a post written for each subreddit's rules (r/SideProject,
      r/FantasyWriters' Wednesday thread, r/macapps at most once a month);
      read the rules again on the day.
- [ ] The launch email and posts; "the founders' price ends Tue 19 Jan".
- [ ] Launch-day watch: Claude watches feedback and fixes problems quickly
      (with the checks), and never replies on your behalf.

## Stage 7. After launch

### The weekly routine

Set up as a scheduled task in Claude Code (Mondays at 08:47 Copenhagen time)
if the session can make one; otherwise you paste "Run the weekly routine"
once a week. It also runs during stages 3–6.

1. Read the scoreboard and feedback (beta replies, GitHub issues, and the
   support inbox if your Gmail is connected to Claude).
2. Fix the biggest problems (ordinary pull requests).
3. Next week's posts and pictures, the newsletter when it's due, and one new
   search page.
4. Update this file: tick, record, and list what's waiting on you.
5. Write you a short report: numbers against last week, what changed, and up
   to three calls.

Ongoing for you: the weekly OK (D12), and answering support emails within two
days (Polar requires it; Claude drafts the replies).

### The upgrade ladder

Paid only from what Crumpet has earned. Each is a call when its line is
crossed. Before the first one, Claude checks Danish VAT, because buying
services from abroad can require VAT registration.

1. **A domain** (about 100 kr a year), moving the app to it on Cloudflare
   Pages (free), with a helper so nobody's notes are left behind. When
   earnings pass about 1,000 kr.
2. **X Premium** for Crumpet's account (about 60 kr a month): free accounts'
   posts reach a median of under 100 people, Premium's over 600. When
   earnings pass about 2,000 kr.
3. **Apple's developer programme** (about 750 kr a year): a signed Mac app
   with no warning, then iPhone and iPad in the App Store. When earnings pass
   about 5,000 kr.
4. **The email service's paid plan**, when the free limits bite.
5. **Polar's Pro plan** ($20 a month for lower fees), when sales pass about
   $1,400 a month.

### Check-ins: is it making money?

At 30, 60 and 90 days after launch (Fri 12 Feb, Fri 12 Mar and Mon 12 Apr
2027), Claude reports the numbers against these lines, and you choose:

- **Going well**, 100 or more paying by day 90: keep going and climb the
  ladder.
- **Promising**, 20–100: change one thing (price, what's in Pro, or who we
  talk to) and run another 60 days.
- **Not yet**, under 20: look at where people stop (do they try it, start a
  book, open checkout?) and decide: one bigger change, keep Crumpet as your
  own tool, or stop.

For scale, October's projections put the middle case at about 250 paying
customers in 2027.

---

## What this plan rests on (researched 18 Oct 2026)

Re-check each when it's used (rule 7).

- **Polar:** a merchant of record (EU VAT, UK VAT, US sales tax), no monthly
  fee, 5% + 50¢ a sale plus 1.5% for non-US cards, worked out on the total
  with VAT. Individuals are allowed, and Denmark is on its payout list
  (Stripe Connect Express, a DKK bank account). Licence keys are checked with
  `POST https://api.polar.sh/v1/customer-portal/license-keys/{activate,validate,deactivate}`:
  no key needed, open to browsers (CORS from any origin), 3 requests a second
  per address. Discounts can have an end date and a cap. There's a sandbox at
  sandbox.polar.sh, and required tick boxes at checkout. The first review
  takes up to 14 days. Support emails must be answered within 48 hours.
- **X:** no free API since 6 February 2026 (pay per use, a card and credits
  needed). Scheduling your own original posts through an authorised tool is
  allowed. Forbidden: automated likes, follows, replies and messages, and the
  same post on two of your accounts. Accounts without Premium can make up to
  50 posts a day. Free accounts' median reach is under 100 per post
  (Buffer's study of 18.8 million posts). X Communities have closed.
- **Buffer free:** 3 networks, 10 waiting posts per network, an API on the
  free plan (one personal key; pictures and videos given as public
  addresses). Reported: one X thread queued at a time, and a lifetime limit of
  8 network connections.
- **Bluesky:** free API (app passwords), videos up to 10 minutes; the most
  writerly network, but shrinking. **Threads:** free API, large and growing.
  Substack Notes can't be posted to automatically.
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
- **Danish email rules:** markedsføringsloven § 10 needs prior, active,
  informed consent and an easy way out, with proof kept of each consent. A
  privacy notice is required by GDPR article 13. Promotional direct messages
  to people who haven't asked count as spam too.
- **Usage counts:** Umami Cloud's free Hobby plan gives 100,000 events a
  month and custom events, with no cookies. Danish guidance (Datatilsynet
  and Digitaliseringsstyrelsen, May 2025) names visitor statistics as needing
  consent. Cloudflare Web Analytics has no custom events.
- **Launch sites:**
  - Product Hunt: free, scheduled up to a month ahead, no asking for votes,
    and the product must be usable on the day.
  - Hacker News: Show HN posts from new accounts restricted since about
    March 2026; AI-written comments not allowed.
  - BetaList: now paid.
  - Uneed: its free line may have closed in August 2026.
  - AlternativeTo: its free queue takes months.
  - NaNoWriMo closed in 2025; Novel November (ProWritingAid) runs 1–30
    November.
- **Denmark** (from knowledge, not checked against live pages; re-check in
  stage 4):
  - A CVR for a sole trader is free on virk.dk, and only required once VAT
    registration is.
  - A sale to a non-EU merchant of record is most likely outside Danish VAT
    and doesn't count towards the 50,000 kr line. An EU-based shop, or buying
    services from abroad, can require VAT registration from the first krone.
  - A registered digital bookkeeping system is only needed above 300,000 kr
    turnover two years running.
  - e-handelsloven § 7 requires a name, physical address and email on the
    site.
  - Interface fonts loaded from Google send visitors' IP addresses to
    Google.
- **This repo:**
  - Pages publishes on every merge to `main`.
  - The app lives at `/crumpet-app/`. Don't move it, or change the manifest,
    the service worker's place or the OAuth origins.
  - `app/.env` is public.
  - Book creation in the interface happens in exactly three places.
  - Shared settings sync through `.crumpet/vault.json`, where an older app
    can drop keys it doesn't know (so the licence stays out of them).
  - Most of the 160 browser tests make books or download files, so turning
    the gate on needs a "be Pro" test hook.

## Sources

- Polar: [fees](https://polar.sh/docs/merchant-of-record/fees),
  [licence keys](https://polar.sh/docs/features/benefits/license-keys),
  [validate](https://polar.sh/docs/api-reference/customer-portal/license-keys/validate),
  [CORS in its server code](https://raw.githubusercontent.com/polarsource/polar/main/server/polar/app.py),
  [supported countries](https://polar.sh/docs/merchant-of-record/supported-countries),
  [account reviews](https://polar.sh/docs/merchant-of-record/account-reviews),
  [discounts](https://polar.sh/docs/features/discounts),
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
