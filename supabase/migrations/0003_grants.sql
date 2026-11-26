-- Table permissions for the app.
-- Newer Supabase projects no longer grant signed-in users access to new tables by default,
-- so we grant it explicitly. Row Level Security (0001_init.sql) still decides WHICH rows
-- each user can see; these grants only allow the app to ask.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.companies,
  public.company_members,
  public.jobs,
  public.vendors,
  public.invoices,
  public.expected_payments,
  public.recurring_costs,
  public.dashboard_layouts,
  public.connections,
  public.bank_accounts,
  public.bank_transactions
to authenticated;

-- Tokens: server only. Signed-in users get no access at all.
revoke all on public.connection_secrets from anon, authenticated;

-- The server (service role) can do everything.
grant all on all tables in schema public to service_role;

-- Helper functions used by the security rules
grant execute on function public.is_member(uuid) to authenticated, service_role;
grant execute on function public.member_role(uuid) to authenticated, service_role;
grant execute on function public.is_member_path(text) to authenticated, service_role;
grant execute on function public.create_company(text) to authenticated;

-- Not-signed-in visitors get nothing.
revoke all on all tables in schema public from anon;
