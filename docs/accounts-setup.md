# Accounts: one-time setup for whoever publishes Crumpet

Crumpet's sign-in screen (email and password, or Google) uses **Firebase
Authentication**, Google's free account service. Until it's set up, Crumpet
simply doesn't offer accounts: there's no sign-in screen and nothing in
Settings about them, and everything else works as before.

What an account is for: your name and email on every device you sign in on.
Notes don't go to Firebase. They stay on each device and sync through your
own Google Drive or folder, as before.

It takes about 10 minutes and is free (Firebase's free "Spark" plan covers
email and Google sign-in). The value you copy at the end is public: it ends
up in the web page, like the Google values in `app/.env`.

## 1. Add Firebase to Crumpet's Google Cloud project

Use the **same** Google Cloud project as Google Drive (the one in
`docs/google-drive-setup.md`, number `278181377805`). Then "Continue with
Google" can use Crumpet's existing Google client.

1. Go to <https://console.firebase.google.com/> and choose
   **Create a project** (or **Add project**).
2. Scroll the box with the project name to the bottom and choose
   **Add Firebase to Google Cloud project**. Pick **Crumpet**.
3. Google Analytics isn't needed: switch it off. Finish.

## 2. Turn on the two ways to sign in

1. **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password**: enable the first switch (not "Email
   link"). Save.
3. **Sign-in method → Add new provider → Google**: enable it, choose your
   support email. Save.
4. Open the Google provider again, expand **Allowlist client IDs from
   external projects** and add Crumpet's web client id (the
   `VITE_GOOGLE_CLIENT_ID` in `app/.env`). Save. (In the same project it's
   usually accepted already; listing it does no harm.)
5. **Settings → Authorised domains**: add `petersinclairfleeton.github.io`.
   `localhost` is there already.

In Google Cloud (<https://console.cloud.google.com/>, project Crumpet),
**Google Auth Platform → Data access**: add the scopes `openid`,
`.../auth/userinfo.email` and `.../auth/userinfo.profile` if they aren't
listed. They're non-sensitive, so no review is needed.

## 3. The value Crumpet needs

1. In Firebase, **Project settings** (the cog) **→ General → Your apps →
   Add app → Web** (`</>`). Call it `Crumpet`. No hosting.
2. From the `firebaseConfig` it shows, copy **apiKey** only.
3. Add it to `app/.env`:

   ```
   VITE_FIREBASE_API_KEY=AIza…
   ```

4. Commit and push. The next publish shows the sign-in screen on each
   device's first visit.

Optional: in **Authentication → Templates**, the emails people get (confirm
your email, reset your password) can have Crumpet's name and your wording.

## 4. Limits

In Google Cloud, **APIs & Services → Credentials**, open the key that Firebase
made ("Browser key (auto created by Firebase)") and restrict it:

- **Website restrictions**: `https://petersinclairfleeton.github.io/*`,
  `http://localhost:5180/*`, `http://localhost:4173/*`
- **API restrictions**: Identity Toolkit API and Token Service API.

## What people see

- On first visit, a **Sign in to Crumpet** screen with **Continue with
  Google**, email and password, **Create an account**, **Forgot your
  password?**, and **Continue without an account**. Choosing that last option
  means the screen isn't shown on that device again.
- **Settings → Account & sync → Account**: who you're signed in as, **Sign
  out**, **Delete account…**, or **Sign in or create an account**.
- New email accounts get a link to confirm the address. Signing in works
  either way.
- The Mac app offers email sign-in. Google sign-in there would need a change
  to its own Google sign-in, which hasn't been built yet.
