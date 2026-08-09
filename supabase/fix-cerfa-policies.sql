-- Fix : helpers RLS manquants + policies Storage cerfa
-- Coller dans SQL Editor → Run

-- ---------------------------------------------------------------------------
-- Helpers (nécessaires aux policies)
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_org_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and active = true
  )
$$;

-- ---------------------------------------------------------------------------
-- Policies Storage bucket cerfa
-- ---------------------------------------------------------------------------

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
