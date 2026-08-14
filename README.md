# Taskora

A dispute-proof delivery ledger for freelancers. Log every deliverable you
send a client, attach a timestamped screenshot or file as proof, and track
what's been paid vs. what's still pending — all in one place instead of
scattered across chat threads and platform messages.

**The gap it fills:** Upwork/Fiverr disputes and "client went quiet after
delivery" situations are common, and freelancers rarely keep organized,
timestamped proof of what they shipped and when. Existing tools are either
full invoicing suites (overkill) or nothing at all. Taskora is the
lightweight middle: a ledger + evidence vault, free to run.

Stack: **Next.js 14 (App Router)** · **Supabase** (auth + Postgres +
Storage, free tier) · **Vercel** (hosting, free tier).

## 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run everything in `supabase/schema.sql` — it creates
   the `clients`, `projects` and `deliverables` tables with row-level
   security, **and** sets up a public `deliverable-proofs` Storage bucket
   (with policies so each user can only upload/delete inside their own
   folder) for proof files. No separate storage provider needed. The script
   is idempotent, so if you already have a Taskora database, re-run the
   whole file — it adds the clients table, backfills your existing projects
   into it, and adds the new deliverable evidence columns without touching
   your data.
3. In **Authentication → URL Configuration**, set your Site URL (use
   `http://localhost:3000` for now; update it after you deploy).
4. In **Project Settings → API**, copy the **Project URL** and **anon
   public key** — you'll need these below.
5. Email confirmations are on by default, which is what the sign-up flow
   here expects. You can turn them off in **Authentication → Providers →
   Email** if you'd rather skip that step while testing.

## 2. Google sign-in via Firebase (optional)

Skip this and the app works exactly as before with email + password — the
"Sign in with Google" button only renders once the Firebase variables are set.

Firebase is used purely as the OAuth broker. It opens the Google popup, and the
Google ID token it returns is exchanged for a normal Supabase session
(`supabase.auth.signInWithIdToken`), so row-level security, the middleware and
every server component keep working off the same Supabase user as before.

**In Firebase** ([console.firebase.google.com](https://console.firebase.google.com)):

1. Create a project, then **Authentication → Get started → Sign-in method** and
   enable **Google**.
2. Under **Authentication → Settings → Authorized domains**, make sure
   `localhost` is listed (it is by default) and add your Vercel domain once you
   deploy.
3. **Project settings → Your apps → Web app** (create one if there isn't one).
   Copy `apiKey`, `authDomain`, `projectId` and `appId` into the
   `NEXT_PUBLIC_FIREBASE_*` variables below.
4. Back in **Authentication → Sign-in method**, click the **Google** row to
   expand it and open the **Web SDK configuration** dropdown. Copy the **Web
   client ID** (it looks like `123456789-abc.apps.googleusercontent.com`) —
   not the client secret. You need it in the next step. If that dropdown is
   empty, the same value is in the Google Cloud Console under **APIs &
   Services → Credentials → OAuth 2.0 Client IDs**, named *Web client (auto
   created by Google Service)*.

**In Supabase**:

5. Go to **Authentication → Providers → Google** and enable it.
6. Paste the Firebase **Web client ID** from step 4 into **Authorized Client
   IDs**. This is the part that matters — Supabase checks the `aud` claim of the
   incoming ID token against this list, and rejects it otherwise.
7. Because sign-in happens through the Firebase popup rather than a Supabase
   redirect, you can leave the Google **Client Secret** blank and skip adding a
   Supabase callback URL to Google Cloud.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill it in with the values from
steps 1–2:

```bash
cp .env.example .env.local
```

`ANTHROPIC_API_KEY` is optional. With it, the AI Dispute Assistant has Claude
write the summary; without it, the assistant still works and generates the
same summary directly from your Taskora records. The key is read only on
the server (in `app/api/dispute/route.ts`) and is never sent to the browser.

## 4. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, sign up, confirm your email, and create your
first project.

## 5. Deploy to Vercel

1. Push this project to a GitHub repo.
2. In [Vercel](https://vercel.com), click **Add New → Project** and import
   the repo.
3. Add the same environment variables from `.env.local` in the Vercel
   project's **Settings → Environment Variables**.
4. Deploy. Once it's live, go back to Supabase's **Authentication → URL
   Configuration** and update the Site URL (and add a redirect URL) to your
   Vercel domain, e.g. `https://your-app.vercel.app`, so the email
   confirmation links point to the right place.
5. If you set up Google sign-in, add your Vercel domain to Firebase's
   **Authentication → Settings → Authorized domains** too, or the popup will
   fail with `auth/unauthorized-domain`.

## How it works

- **Auth** — Supabase email/password auth. Sessions are kept in cookies and
  refreshed by `middleware.ts`, which also gates `/dashboard` and
  `/projects/*` behind sign-in.
- **Database** — Three tables: `clients` (one row per client, with the name
  unique per user), `projects` (one per client engagement, linked to its
  client via `client_id`) and `deliverables` (each logged item of work, with
  an amount, a paid flag and an optional client acknowledgement). Row-level
  security means the Postgres database itself enforces that users only ever
  read or write their own rows.
- **Clients** — A database trigger attaches every project to a single client
  record: creating or renaming a project finds the matching client for that
  user (ignoring case and surrounding whitespace), creates one if it does not
  exist yet, and normalises `client_name` to that client's spelling. So two
  projects for "Northwind Studio" and "northwind studio " end up under the
  same client, and the project page lists the client's other projects.
- **AI Dispute Assistant** — "Analyze Dispute" on a project (or "Analyze" on a
  single deliverable) collects everything Taskora stores for that work —
  deliverables, timestamps, proof files, client acknowledgements, payment
  amounts, payment history and payment status — and returns a neutral
  Delivery Summary, including which evidence is missing or inconsistent. The
  summary can be copied as text or downloaded as a PDF. It only uses data from
  Taskora, states plainly when something is not recorded, and does not
  assign fault or give legal advice.
- **File storage** — Proof files never pass through the Next.js server.
  The browser uploads the file straight to a Supabase Storage bucket using
  your signed-in session; storage policies (in `supabase/schema.sql`)
  enforce that you can only write into your own folder, and the resulting
  public URL is what gets saved on the deliverable.

## Notes on the free tiers

- Supabase's free tier covers this comfortably for personal use (500MB
  database, 1GB file storage, 50k monthly active users).
- Vercel's free (Hobby) tier is fine for a personal project like this.

None of these are affiliate links or sponsored recommendations — they're
just the most practical free combination for this kind of app today.
