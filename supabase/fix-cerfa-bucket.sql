-- Fix manquant : bucket Storage CERFA (à exécuter si le bucket n'existe pas)
-- SQL Editor → Run

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cerfa',
  'cerfa',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

drop policy if exists cerfa_select on storage.objects;
create policy cerfa_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cerfa'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists cerfa_insert on storage.objects;
create policy cerfa_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cerfa'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists cerfa_update on storage.objects;
create policy cerfa_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cerfa'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists cerfa_delete on storage.objects;
create policy cerfa_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cerfa'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
