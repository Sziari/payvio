# Product decisions

One line per decision, newest at the bottom.

- 2026-11-25: Name is Payvio. Brand colors stay the guide's navy (#1F2937) and amber (#F59E0B) until a brand is chosen.
- 2026-11-25: Without Supabase keys the app runs in demo mode on sample data, so screens can be reviewed before any accounts exist.
- 2026-11-25: Invoice flow: Received (uploaded) → Needs review (AI read it; a person must confirm) → Approved → Scheduled → Paid; Disputed at any point. Approval steps come from config/workflows.ts. Changing the amount after confirming resets approvals.
- 2026-11-25: Only confirmed, non-disputed invoices count toward job cost and the forecast.
- 2026-11-25: Tax, freight and any amount not on a line go to the invoice's cost type.
- 2026-11-25: Bank and QuickBooks turned on by default (config/features.ts); each shows setup steps until its keys are added.
- 2026-11-25: QuickBooks: Payvio only adds (bills, vendor credits, vendors). It never edits or deletes anything in QuickBooks.
- 2026-11-25: Dashboard visual design is intentionally plain; the owner will design it at the end.
