# Settle 1.1: setup checklist

The app code for friends, the redesign, activity, invites, receipts, push
notifications and Apple/Google sign-in is all in the repo. These are the
one-time steps outside the code. Do them in order.

## 1. Install the new packages

In the `split-app` folder:

```
npm install
```

## 2. Run the database updates (Supabase → SQL Editor → New query)

Run each file once, in this order. Both are safe to run again.

1. `supabase/sql/2026-11-19-use-user-ids.sql` (skip if you already ran it)
2. `supabase/sql/2026-11-19b-friends-activity-features.sql`

Each should say "Success. No rows returned".

## 3. Redirect URLs (Supabase → Authentication → URL Configuration)

Under **Redirect URLs**, add:

```
settle://**
exp://**
http://localhost:8081/**
```

These let password reset, email confirmation and Google sign-in links come
back into the app.

## 4. Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → **Create credentials
   → OAuth client ID → Web application**.
2. Under **Authorized redirect URIs**, add
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (your project ref is in your Supabase URL).
3. Copy the **Client ID** and **Client secret**.
4. Supabase → Authentication → Providers → **Google** → turn on, paste both and save.

## 5. Sign in with Apple (iPhone)

1. Supabase → Authentication → Providers → **Apple** → turn on.
2. In **Client IDs**, enter `com.danielbuilds.settle`, then save.
   (The iPhone app signs in natively, so the secret key fields can stay empty.)
3. The next EAS build turns on the "Sign in with Apple" capability for the
   app automatically (`usesAppleSignIn` is set in `app.json`).

Apple requires Sign in with Apple whenever an app offers Google sign-in, so
keep both.

## 6. Push notifications

**a) Deploy the function.** Use either:

- Dashboard: Supabase → Edge Functions → **Deploy a new function → Via
  Editor**, name it `push`, and paste in `supabase/functions/push/index.ts`.
- Terminal: `npx supabase login`, then
  `npx supabase functions deploy push --project-ref <your-project-ref>`.

**b) Trigger it.** Supabase → Database → **Webhooks → Create a new hook**:

- Table: `activity`, Events: **Insert**
- Type: **Supabase Edge Functions**, function: `push`, method POST
- Click **Add auth header with service key**, then create

**c) Apple push key.** When you run `eas build`, answer **yes** when EAS asks
to set up a push notifications key.

Push only works on a real phone running a build (TestFlight or the App
Store), not in the browser.

## 7. Build and ship

The new features add native modules (notifications, Apple sign-in), so you
need a new build. An over-the-air update isn't enough.

```
eas build -p ios --profile production
eas submit -p ios
```

The version is set to 1.1.0 in `app.json`.

## Testing before you build

- `npx expo start --offline`, then press `w`: everything except push and
  Apple sign-in works in the browser. Pop-ups now work on web too.
- Expo Go on your phone: everything except push and Apple sign-in.
