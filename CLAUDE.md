# Payvio - cash-flow and job cost app for subcontractors

## Who it's for
Small and mid-size trade subcontractors ($2-20M revenue), starting in California.
Users: owner, office manager/AP, project manager, estimator.
They are busy and not technical. Every screen must be simple, mobile-friendly
and in plain English.

## Core features (build in this order)
1. Company setup: sign up, company profile, jobs (name, job #, address, city,
GC/customer, contract amount, budget by cost type).
2. AP inbox: upload or email-forward supplier invoices (PDF/photo). AI
extracts vendor, invoice #, date, ship-to/job address, line items, tax,
total. Suggest the job; user confirms. Always keep and link the original file.
3. Job cost dashboard: cost by job, vendor, month and cost type (material,
trucking, equipment, labor, finance charges) vs budget.
4. Cash forecast: 13 weeks, from expected customer payments, recurring costs
(payroll, loans, leases) and open supplier invoices.
5. Connections: bank feed (Plaid) and QuickBooks Online sync. Connecting must be
one button on Settings > Connections, with plain-English help when keys are missing.
6. Later: pay apps, CA preliminary notices and lien waivers.

## Tech stack
- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn-style components in /components/ui
- Supabase: Postgres, Auth, Storage, Row Level Security on every table
- Anthropic API (Claude) for document extraction, called only from the server
- Plaid (bank balances + transactions), Intuit QuickBooks Online API (OAuth 2)
- Deploy on Vercel

## Customization rules (very important)
- All branding, navigation, dashboard layout, workflows and feature switches
live in /config. Never hard-code these in components.
- The dashboard is a grid of widgets. Each widget is a self-contained
component registered in /components/widgets/registry.tsx.
- Users can drag, resize, hide and re-add widgets in an "Edit layout" mode.
Save each company's layout in the database; /config/dashboard.ts is the default.
- Workflows (invoice statuses, approval steps, thresholds) come from /config/workflows.ts.
- When I ask to move or change something, prefer editing /config first.

## Data and safety rules
- Multi-company from day one: every row has company_id, enforced by Row Level Security.
- Use test data only until I say we're live. Seed data lives in /supabase/seed.sql.
- Demo mode: when Supabase keys are missing, the app runs on built-in sample data
(lib/data/demo.ts) so screens can be viewed without any accounts.
- Never store bank passwords or card numbers. Secrets only in .env.local, never committed.
- Plaid and QuickBooks tokens are encrypted (lib/crypto.ts) and live in tables
only the server (service role) can read.
- Money is stored in cents as integers. Show dollars with 2 decimals.
- Every AI-extracted value needs a human "confirm" step and shows the source document.

## How to work with me
- I'm not an engineer. Explain changes in plain English, in 3-5 bullets.
- Make small changes, then tell me exactly how to test them in the browser.
- Commit to git after each working feature with a clear message.
- Before deleting data, tables or files, ask me first.
- If something is ambiguous, ask one question instead of guessing.

## Commands
- `npm run dev` - run locally at http://localhost:3000
- `npm test` - unit tests (money, forecast, approvals, job matching)
- `npm run build` - production build
