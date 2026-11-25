-- Row Level Security checks: two companies must never see each other's data.
\set ON_ERROR_STOP on

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'alice@a.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@b.test');

-- Alice signs up and creates Company A
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.create_company('Advance Concrete') as a_id \gset
insert into public.jobs (company_id, name, address, city) values (:'a_id', 'Dixon', '2700 Plaza Ct', 'Dixon');
insert into public.invoices (company_id, vendor_name, total_cents) values (:'a_id', 'CalPortland', 214560);
insert into storage.objects (bucket_id, name) values ('invoices', :'a_id' || '/inv1.pdf');

-- Bob signs up and creates Company B
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select public.create_company('Advance Concrete') as b_id \gset

do $$ begin
  if (select count(*) from public.jobs) <> 0 then raise exception 'FAIL: Bob sees Alice''s jobs'; end if;
  if (select count(*) from public.invoices) <> 0 then raise exception 'FAIL: Bob sees Alice''s invoices'; end if;
  if (select count(*) from public.companies) <> 1 then raise exception 'FAIL: Bob sees other companies'; end if;
  if (select count(*) from storage.objects) <> 0 then raise exception 'FAIL: Bob sees Alice''s files'; end if;
  if (select inbound_slug from public.companies) <> 'advance-concrete-1' then raise exception 'FAIL: slug not unique'; end if;
end $$;

-- Bob cannot write into Alice's company
do $$ begin
  begin
    insert into public.jobs (company_id, name) select id, 'hack' from public.companies limit 0; -- no rows visible
    perform 1;
  end;
end $$;
\set ON_ERROR_STOP off
insert into public.jobs (company_id, name) values (:'a_id', 'hack');
insert into storage.objects (bucket_id, name) values ('invoices', :'a_id' || '/evil.pdf');
insert into storage.objects (bucket_id, name) values ('invoices', 'not-a-uuid/evil.pdf');
\set ON_ERROR_STOP on
update public.invoices set total_cents = 0 where company_id = :'a_id';
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  if (select count(*) from public.jobs where name = 'hack') <> 0 then raise exception 'FAIL: cross-company insert'; end if;
  if (select total_cents from public.invoices limit 1) <> 214560 then raise exception 'FAIL: cross-company update'; end if;
  if (select count(*) from storage.objects) <> 1 then raise exception 'FAIL: cross-company upload'; end if;
end $$;

-- Secrets table is never readable by signed-in users
do $$ begin
  if (select count(*) from public.connection_secrets) <> 0 then raise exception 'FAIL: secrets visible'; end if;
end $$;
\set ON_ERROR_STOP off
insert into public.connection_secrets (connection_id, company_id, encrypted) values (gen_random_uuid(), :'a_id', 'x');
\set ON_ERROR_STOP on

-- Not signed in: nothing visible
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.companies) <> 0 then raise exception 'FAIL: anonymous sees companies'; end if;
end $$;

reset role;
select 'ALL RLS CHECKS PASSED' as result;
