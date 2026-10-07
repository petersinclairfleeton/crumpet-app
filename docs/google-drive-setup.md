# Google Drive: one-time setup for whoever publishes Crumpet

People using Crumpet never see any of this. For them, connecting is:

1. **Continue with Google** (in Settings, or the "Connect Google Drive" link at
   the bottom of the sidebar, or any link to Crumpet ending in `#connect`).
2. Sign in to Google and allow Crumpet.
3. Pick where the notes go: a new "Crumpet" folder, the Crumpet folder found
   from another device, or **Choose a folder…** in Google's own folder picker.

For that to work, Crumpet needs to be registered with Google once, by its
publisher. It takes about 15 minutes and is free. Everything you copy below
is a public value that ends up in the web page; none of it is a password.

## 1. A Google Cloud project

1. Go to <https://console.cloud.google.com/>, and in the project picker at the
   top choose **New project**. Name it `Crumpet`, create it, and select it.
2. **APIs & Services → Library**: enable **Google Drive API** and
   **Google Picker API**.

## 2. The sign-in screen people see

1. Open **Google Auth Platform** and click **Get started**.
2. App name `Crumpet`, your support email, audience **External**, your contact
   email. Create.
3. **Data access → Add or remove scopes**: tick
   `.../auth/drive.file` ("See, edit, create and delete only the specific Google
   Drive files you use with this app"). Save.
4. **Audience**: while testing, add your own Google address under **Test
   users**. When you're ready for anyone to use it, press **Publish app**.
   Crumpet asks only for `drive.file`, which Google treats as a non-sensitive
   permission, so publishing doesn't need Google's security review.

## 3. The three values Crumpet needs

1. **Client ID**: **Google Auth Platform → Clients → Create client**, type
   **Web application**. Under **Authorised JavaScript origins** add:
   - `https://petersinclairfleeton.github.io` (the published app)
   - `http://localhost:5180` (running it on your computer)

   Leave redirect URIs empty. Create, and copy the client ID
   (`….apps.googleusercontent.com`).
2. **API key** (for the folder picker): **APIs & Services → Credentials →
   Create credentials → API key**. Edit it:
   - Application restrictions: **Websites**, add
     `https://petersinclairfleeton.github.io/*` and `http://localhost:5180/*`.
   - API restrictions: **Google Picker API** only.
3. **Project number**: **IAM & Admin → Settings** (or the project dashboard).

## 4. Give them to the app

They live in `app/.env` (all three are public: they're part of the web page
anyway, and the API key only works from Crumpet's addresses and only for the
folder picker):

```
VITE_GOOGLE_CLIENT_ID=1234-abcd.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIza...
VITE_GOOGLE_APP_ID=123456789012
```

The project number is also the number at the start of the client ID.

## 5. Publish the app

1. In the GitHub repository: **Settings → Pages → Build and deployment →
   Source: GitHub Actions**.
2. Every push to `main` publishes the app to
   <https://petersinclairfleeton.github.io/crumpet-app/>. You can also run the
   "Publish web app" workflow by hand from the **Actions** tab.

## 6. Let everyone sign in (later)

While the app is in "Testing", only the test users from step 2 can sign in.
To open it to everyone, fill in **Google Auth Platform → Branding**:

- App home page: `https://petersinclairfleeton.github.io/crumpet-app/`
- Privacy policy: `https://petersinclairfleeton.github.io/crumpet-app/privacy.html`
- Terms of service: `https://petersinclairfleeton.github.io/crumpet-app/terms.html`

then **Audience → Publish app**.

## What Crumpet can see in someone's Drive

Only the `drive.file` permission: the files and folders Crumpet created, or
that the person picked in Google's folder picker. Nothing else in their Drive.

One consequence: a brand-new file that another app or the Drive website adds
to the folder isn't visible to Crumpet. Files Crumpet made can be edited,
renamed and moved by any app, and Crumpet picks the changes up.

## Where things go

```
Crumpet/
  Writing/                  a stack
    Novel/                  a notebook in that stack
      Opening scene.md      a note
  Journal/                  a notebook without a stack
  Loose thought.md          a note in no notebook
  .trash/                   the Trash
  .crumpet/vault.json       notebook colours and ids
  Projects/
    The Lighthouse/         a project
      project.json          its name, word goal and order of parts and chapters
      01 The Keeper.md      its chapters, numbered in order
      02 Salt.md
```

Each note is Markdown with a short header (front matter) holding its title,
tags and dates. Chapters are the same, with their status, synopsis and word
goal in the header. Deleting a note in Crumpet moves its file to Drive's own bin,
where it stays for 30 days.

The claude.ai artifact preview of Crumpet can't sign in to Google: its address
can't be registered in step 3.
