-- Fix RLS tables ClimaZEN (coller tout → Run)
-- Recrée helpers + policies profiles / organizations / org_data / invites

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select organization_id from public.profiles where id = auth.uid() limit 1
$$;

create or replace function public.is_org_owner()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and active = true
  )
$$;

-- Organizations
alter table public.organizations enable row level security;
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.current_org_id());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (id = public.current_org_id() and public.is_org_owner())
  with check (id = public.current_org_id() and public.is_org_owner());

-- Profiles
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.is_org_owner()
    and role = 'operateur'
  )
  with check (
    organization_id = public.current_org_id()
    and public.is_org_owner()
  );

-- org_data
alter table public.org_data enable row level security;
drop policy if exists org_data_select on public.org_data;
create policy org_data_select on public.org_data
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists org_data_update on public.org_data;
create policy org_data_update on public.org_data
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists org_data_insert on public.org_data;
create policy org_data_insert on public.org_data
  for insert to authenticated
  with check (organization_id = public.current_org_id());

-- Invites
alter table public.operator_invites enable row level security;
drop policy if exists invites_select on public.operator_invites;
create policy invites_select on public.operator_invites
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_org_owner());

drop policy if exists invites_insert on public.operator_invites;
create policy invites_insert on public.operator_invites
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.is_org_owner()
    and created_by = auth.uid()
  );

drop policy if exists invites_update on public.operator_invites;
create policy invites_update on public.operator_invites
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_owner());

-- Vérification rapide
select public.current_org_id() as my_org;
