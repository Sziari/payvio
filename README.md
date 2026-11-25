# Payvio

**Know your cash. Know your jobs.** Cash flow and job cost for trade subcontractors.

- **AP Inbox**: upload or email supplier invoices; AI reads them, suggests the job, flags duplicates; a person confirms.
- **Jobs**: cost by job, supplier, month and cost type vs budget. CSV and Excel export.
- **Cash Forecast**: 13 weeks of customer payments, payroll, loans, leases and supplier bills, with what-if dragging.
- **Dashboard**: drag-and-drop widgets, saved per company.
- **Connections**: bank balances via Plaid, bills and suppliers to QuickBooks Online.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no keys it runs in **demo mode** on sample data.
To go live, follow [docs/SETUP.md](docs/SETUP.md).

## Customizing

Most changes are a one-line edit in `/config`:

| Change | File |
|---|---|
| Name, colors, logo | `config/brand.ts` |
| Sidebar menu | `config/navigation.ts` |
| Default dashboard layout | `config/dashboard.ts` |
| Invoice statuses, approval limits, cost types | `config/workflows.ts` |
| Turn features on or off | `config/features.ts` |

New dashboard widgets are registered in `components/widgets/registry.tsx`.

## Project map

- `app/(app)/` pages: dashboard, inbox, jobs, forecast, vendors, settings
- `lib/` business logic (money in cents, approvals, forecast, job matching) and data access
- `lib/data/` one interface, two backends: demo (in memory) and Supabase (Row Level Security)
- `lib/integrations/` Plaid and QuickBooks
- `supabase/migrations/` database schema; `supabase/tests/` security tests
- `tests/` unit tests
