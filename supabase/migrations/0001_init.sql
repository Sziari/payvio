-- Payvio initial schema.
-- Every business table has company_id and Row Level Security so a user only sees their own company.
-- Money is stored in cents (bigint).

create extension if not exists pgcrypto;

-- Companies ---------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text,
  city text,
  state text default 'CA',
  phone text,
  inbound_slug text not null unique,               -- ap+<slug>@yourdomain for email-in invoices
  starting_cash_cents bigint not null default 0,   -- manual cash on hand until a bank is connected
  min_cash_cents bigint not null default 0,        -- forecast warning line
  qbo_expense_accounts jsonb not null default '{}'::jsonb, -- cost type -> QuickBooks account id
  created_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'owner'
    check (role in ('owner', 'office_manager', 'project_manager', 'estimator')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members(user_id);

-- Helpers used by RLS policies. SECURITY DEFINER so they can read company_members
-- without recursing into its own policies.
create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members where company_id = cid and user_id = auth.uid());
$$;

create or replace function public.member_role(cid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.company_members where company_id = cid and user_id = auth.uid();
$$;

-- Jobs ------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  job_number text,
  address text,
  city text,
  customer text,
  contract_cents bigint not null default 0,
  budgets jsonb not null default '{}'::jsonb,  -- cost type -> cents
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index jobs_company_idx on public.jobs(company_id);

-- Vendors ---------------------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  qbo_vendor_id text,
  created_at timestamptz not null default now()
);
create unique index vendors_company_name_idx on public.vendors(company_id, lower(name));

-- Invoices (accounts payable) ------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  due_date date,
  ship_to text,
  job_id uuid references public.jobs(id) on delete set null,
  suggested_job_id uuid references public.jobs(id) on delete set null,
  cost_type text,
  line_items jsonb not null default '[]'::jsonb,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  is_credit_memo boolean not null default false,
  is_finance_charge boolean not null default false,
  discount_percent numeric(5,2),
  discount_due_date date,
  status text not null default 'Received',
  approvals jsonb not null default '[]'::jsonb,
  file_path text,          -- path in the private "invoices" storage bucket: <company_id>/<file>
  file_name text,
  file_mime text,
  source text not null default 'upload' check (source in ('upload', 'email')),
  extraction jsonb,        -- raw AI output, kept for audit
  extraction_error text,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  scheduled_date date,
  paid_at date,
  qbo_bill_id text,
  created_at timestamptz not null default now()
);
create index invoices_company_idx on public.invoices(company_id);
create index invoices_job_idx on public.invoices(job_id);
create index invoices_status_idx on public.invoices(company_id, status);

-- Cash forecast inputs --------------------------------------------------------
create table public.expected_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  customer text not null,
  amount_cents bigint not null,
  expected_date date not null,
  received boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index expected_payments_company_idx on public.expected_payments(company_id);

create table public.recurring_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  category text not null default 'other' check (category in ('payroll', 'loan', 'lease', 'card', 'other')),
  amount_cents bigint not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  next_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index recurring_costs_company_idx on public.recurring_costs(company_id);

-- Dashboard layout per company -----------------------------------------------
create table public.dashboard_layouts (
  company_id uuid primary key references public.companies(id) on delete cascade,
  layout jsonb not null,
  updated_at timestamptz not null default now()
);

-- Connections (Plaid, QuickBooks) --------------------------------------------
-- "connections" is safe for members to read. Tokens live in connection_secrets,
-- which has RLS on and NO policies: only the server (service role) can read it.
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('plaid', 'quickbooks')),
  external_id text not null,     -- Plaid item_id or QuickBooks realmId
  display_name text,
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index connections_company_idx on public.connections(company_id);

create table public.connection_secrets (
  connection_id uuid primary key references public.connections(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  encrypted text not null,       -- AES-256-GCM, key in TOKEN_ENCRYPTION_KEY
  cursor text,                   -- Plaid transactions sync cursor
  updated_at timestamptz not null default now()
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  plaid_account_id text not null unique,
  name text not null,
  mask text,
  type text,
  subtype text,
  current_cents bigint,
  available_cents bigint,
  include_in_cash boolean not null default true,
  updated_at timestamptz not null default now()
);
create index bank_accounts_company_idx on public.bank_accounts(company_id);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  plaid_transaction_id text not null unique,
  date date not null,
  name text not null,
  amount_cents bigint not null,   -- positive = money out (Plaid convention)
  pending boolean not null default false
);
create index bank_transactions_company_idx on public.bank_transactions(company_id, date desc);

-- Row Level Security -----------------------------------------------------------
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.jobs enable row level security;
alter table public.vendors enable row level security;
alter table public.invoices enable row level security;
alter table public.expected_payments enable row level security;
alter table public.recurring_costs enable row level security;
alter table public.dashboard_layouts enable row level security;
alter table public.connections enable row level security;
alter table public.connection_secrets enable row level security; -- no policies on purpose
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

create policy "members read company" on public.companies
  for select using (public.is_member(id));
create policy "owners and office managers edit company" on public.companies
  for update using (public.member_role(id) in ('owner', 'office_manager'))
  with check (public.member_role(id) in ('owner', 'office_manager'));

create policy "members see teammates" on public.company_members
  for select using (public.is_member(company_id));
create policy "owners manage teammates" on public.company_members
  for all using (public.member_role(company_id) = 'owner')
  with check (public.member_role(company_id) = 'owner');

do $$
declare t text;
begin
  foreach t in array array['jobs', 'vendors', 'invoices', 'expected_payments', 'recurring_costs', 'dashboard_layouts']
  loop
    execute format('create policy "members read" on public.%I for select using (public.is_member(company_id))', t);
    execute format('create policy "members insert" on public.%I for insert with check (public.is_member(company_id))', t);
    execute format('create policy "members update" on public.%I for update using (public.is_member(company_id)) with check (public.is_member(company_id))', t);
    execute format('create policy "members delete" on public.%I for delete using (public.is_member(company_id))', t);
  end loop;
end $$;

-- Bank and connection data are written by the server only; members can read them
-- and toggle which bank accounts count as cash.
create policy "members read" on public.connections for select using (public.is_member(company_id));
create policy "members read" on public.bank_accounts for select using (public.is_member(company_id));
create policy "members toggle cash" on public.bank_accounts
  for update using (public.is_member(company_id)) with check (public.is_member(company_id));
create policy "members read" on public.bank_transactions for select using (public.is_member(company_id));

-- Sign-up: create a company and make the caller its owner ------------------
create or replace function public.create_company(company_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  base_slug text;
  slug text;
  n int := 0;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  base_slug := trim(both '-' from regexp_replace(lower(company_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'company'; end if;
  slug := base_slug;
  while exists (select 1 from public.companies where inbound_slug = slug) loop
    n := n + 1;
    slug := base_slug || '-' || n;
  end loop;
  insert into public.companies (name, inbound_slug) values (trim(company_name), slug) returning id into new_id;
  insert into public.company_members (company_id, user_id, email, role)
    values (new_id, auth.uid(), (select email from auth.users where id = auth.uid()), 'owner');
  return new_id;
end $$;

revoke all on function public.create_company(text) from public;
grant execute on function public.create_company(text) to authenticated;
