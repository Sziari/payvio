# Payvio setup guide

Plain-English steps to go from "demo mode" to a real, live app. Do them in order.
You can stop after any step; the app works with whatever is set up so far.

| Step | What it turns on | Time |
|---|---|---|
| 0. Run it on your computer | Demo mode with sample data | 5 min |
| 1. Supabase | Real accounts, your own data, file storage | 15 min |
| 2. Anthropic | AI reads invoices for you | 5 min |
| 3. Plaid | Bank balance on the dashboard and forecast | 15 min |
| 4. QuickBooks | Send bills and suppliers to QuickBooks | 20 min |
| 5. Vercel | The app on the internet | 15 min |
| 6. Email-in | Suppliers email invoices straight in | 20 min |

Every key goes in a file called `.env.local` in the project folder (copy `.env.local.example`),
and later in Vercel → Project → Settings → Environment Variables. Never paste keys into chat or commit them.

---

## 0. Run it on your computer

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without any keys you'll see **demo mode**: sample company "Advance Concrete",
5 jobs, invoices, and a forecast. Check the math: **Dixon Warehouse Slab** should total **$2,145.60**, all in April 2026.

## 1. Supabase (database and sign-in)

1. Create a free project at [supabase.com](https://supabase.com). Pick a region near California (e.g. West US).
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, press **Run**.
   Then do the same with `supabase/migrations/0002_storage.sql` and `supabase/migrations/0003_grants.sql`
   (newer Supabase projects need the third file, or sign-up loops back to the company-name page).
3. **Project Settings → API**: copy
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one secret)
4. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` (later, your Vercel address)
   and add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Also set `TOKEN_ENCRYPTION_KEY` to any long random text (run `openssl rand -base64 32`).
6. Restart `npm run dev`, go to http://localhost:3000, and **Create an account**.
7. Optional: **Settings → Load sample data** fills your new company with the same sample data.
8. Turn on backups: Supabase → Database → Backups. Use a separate Supabase project for testing.

## 2. Anthropic (AI invoice reading)

1. Sign in at [console.anthropic.com](https://console.anthropic.com), add billing, create an API key.
2. Put it in `ANTHROPIC_API_KEY`. Restart.
3. Upload a supplier invoice in **AP Inbox**. The details fill in within about 30 seconds; check them and press **Confirm**.

Each invoice costs a few cents to read. Nothing the AI reads counts until a person presses Confirm.

## 3. Plaid (bank connection)

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com/signup).
2. **Developers → Keys**: copy `client_id` → `PLAID_CLIENT_ID` and the **Sandbox** secret → `PLAID_SECRET`.
   Set `PLAID_ENV=sandbox`. Restart.
3. In the app: **Settings → Connections → Connect your bank**. Choose any bank and sign in with
   username `user_good`, password `pass_good` (Plaid's test bank).
4. Your test balance now shows as **Cash on hand** and is the starting point of the forecast.
   Untick "Count as cash" on accounts that shouldn't count (savings, credit cards).
5. For real banks: in the Plaid dashboard, request **Production** access (they review your use case),
   then switch to the Production secret and `PLAID_ENV=production`.

Payvio only reads balances and transactions. It never sees bank passwords and can't move money.
Balances refresh every morning on Vercel (step 5) or when you press **Update now**.

## 4. QuickBooks Online

1. Sign in at [developer.intuit.com](https://developer.intuit.com) and **Create an app** →
   "QuickBooks Online and Payments" → scope **Accounting**.
2. **Keys & credentials → Development**: add this Redirect URI exactly:
   `http://localhost:3000/api/quickbooks/callback` (later also `https://<your-vercel-address>/api/quickbooks/callback`).
3. Copy the Client ID → `INTUIT_CLIENT_ID`, Client Secret → `INTUIT_CLIENT_SECRET`, set `INTUIT_ENVIRONMENT=sandbox`. Restart.
4. In the app: **Settings → Connections → Connect to QuickBooks**, sign in, pick the sandbox company.
5. Pick a **default expense account** (and any per-cost-type accounts), press **Save accounts**.
6. **Import suppliers** links your QuickBooks vendors. **Send bills to QuickBooks** creates a Bill for each
   confirmed, approved invoice (credit memos become Vendor Credits). Each invoice is only sent once.
7. For real companies: complete Intuit's production questionnaire, then use the Production keys and
   `INTUIT_ENVIRONMENT=production`.

## 5. Vercel (put it online)

1. Push the code to GitHub (already done if you're reading this there).
2. At [vercel.com](https://vercel.com) → **Add New → Project** → import the `payvio` repo.
3. Add every variable from your `.env.local` under **Environment Variables**, changing
   `NEXT_PUBLIC_APP_URL` to your Vercel address, and add `CRON_SECRET` (any long random text).
4. Deploy. Then update the Supabase Site URL / Redirect URLs and the Intuit Redirect URI to the Vercel address.

## 6. Email-in invoices (Postmark)

Each company gets an address like `ap+advance-concrete@inbox.yourdomain.com`.

1. Create a Postmark account and an **Inbound** stream. Point your domain's MX record at Postmark
   (Postmark shows the exact record), or use the address Postmark gives you to start.
2. Set `INBOUND_EMAIL_DOMAIN` (e.g. `inbox.yourdomain.com`) and `INBOUND_EMAIL_SECRET` (long random text).
3. In Postmark, set the inbound webhook URL to
   `https://<your-vercel-address>/api/inbound/postmark?token=<INBOUND_EMAIL_SECRET>`.
4. Forward a supplier invoice email to the address shown in **AP Inbox**. PDF and photo attachments arrive as "Received" and are read by the AI.

Resend inbound can be added later the same way (a new route under `app/api/inbound/`).

## Before real customer data

- In Claude Code: *"Review the whole app for security problems: Row Level Security on every table, secrets in code,
  file access between companies, and AI prompt injection from uploaded invoices. Fix what you find and list it."*
- Have an experienced engineer review it for a few hours.
- Terms of service and privacy policy, reviewed by a lawyer.
- Supabase backups on, and a separate test project.

## Checking that it works

```bash
npm test                 # money math, approvals, job matching, forecast (includes the $2,145.60 check)
npm run build            # production build
```

Database security tests (needs a local Postgres): `PGHOST=/tmp PGPORT=5433 PGUSER=postgres supabase/tests/run.sh`
