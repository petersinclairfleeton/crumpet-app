# Connecting Crumpet to Google Drive

Crumpet keeps your notes as Markdown files in a folder in your own Google
Drive. To talk to Drive, Crumpet needs a **Google OAuth client ID**: a public
identifier that tells Google "this is Crumpet, running at this web address".
You create it once in your own Google Cloud account, so nobody else holds the
keys to your files. It takes about five minutes and costs nothing.

The client ID is not a secret (it sits in the web page), and there's no
password or "client secret" to look after.

## 1. Create a project

1. Go to <https://console.cloud.google.com/> and sign in with the Google account
   whose Drive should hold your notes.
2. In the project picker at the top, choose **New project**. Call it `Crumpet`
   and create it. Make sure it's selected afterwards.

## 2. Turn on the Drive API

1. Open **APIs & Services → Library**.
2. Search for **Google Drive API**, open it and click **Enable**.

## 3. Describe the app (consent screen)

1. Open **Google Auth Platform** (in older consoles: **APIs & Services → OAuth
   consent screen**) and click **Get started**.
2. App name: `Crumpet`. Support email: your address.
3. Audience: **External**.
4. Contact email: your address. Agree and **Create**.
5. Under **Audience → Test users**, add your own Google address (and anyone else
   you want to let in while testing).

While the app is in "Testing", Google shows a "Google hasn't verified this
app" screen when you sign in. That's expected for your own app: choose
**Continue**.

## 4. Create the client ID

1. Open **Clients** (or **Credentials → Create credentials → OAuth client ID**).
2. Application type: **Web application**. Name: `Crumpet web`.
3. Under **Authorised JavaScript origins**, add every address you open Crumpet
   from, for example:
   - `http://localhost:5180` (running it on your computer with `npm run dev`)
   - your published address, e.g. `https://petersinclairfleeton.github.io`

   Leave **Authorised redirect URIs** empty.
4. **Create**, then copy the **Client ID** (it ends in
   `.apps.googleusercontent.com`).

Google can take a few minutes to recognise a new origin.

## 5. Connect

In Crumpet, open **Settings** (your name at the top of the sidebar) →
**Where your notes live** → **Connect Google Drive**, paste the client ID,
choose a folder name (default `Crumpet`) and press **Connect**.

To build the client ID into your own copy instead, put it in `app/.env.local`:

```
VITE_GOOGLE_CLIENT_ID=1234-abcd.apps.googleusercontent.com
```

## What Crumpet can see

Crumpet asks only for the `drive.file` permission: it can see and change the
files it created, on any of your devices, and nothing else in your Drive.

One consequence: a brand-new file you add to the folder with another app or
the Drive website isn't visible to Crumpet. Files Crumpet made can be edited,
renamed and moved anywhere, by any app, and Crumpet picks the changes up.

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
```

Each note is Markdown with a short header (front matter) holding its title,
tags and dates. Deleting a note in Crumpet moves its file to Drive's own bin,
where it stays for 30 days.

## It doesn't work in the preview page

Google only signs you in on the addresses listed in step 4. The Crumpet
preview published as a claude.ai artifact runs at an address you can't
register, so connect from `localhost` or your own published copy.
