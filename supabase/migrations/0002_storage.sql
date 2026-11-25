-- Private bucket for original invoice files. Path: <company_id>/<file name>
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- True when the first folder of an object path is a company the caller belongs to.
-- Checks the format first so a non-uuid folder can never raise an error.
create or replace function public.is_member_path(object_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare folder text := split_part(object_name, '/', 1);
begin
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_member(folder::uuid);
end $$;

create policy "members read invoice files" on storage.objects
  for select using (bucket_id = 'invoices' and public.is_member_path(name));

create policy "members upload invoice files" on storage.objects
  for insert with check (bucket_id = 'invoices' and public.is_member_path(name));
