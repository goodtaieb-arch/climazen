-- ClimaZEN — schéma Supabase (Auth + org_data + Storage)
-- À coller dans : Supabase → SQL Editor → Run

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  owner_user_id uuid
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null check (role in ('owner', 'operateur')),
  active boolean not null default true,
  signataire_nom text,
  signataire_qualite text,
  signature_image text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);

create table if not exists public.org_data (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.operator_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operator_invites_org_idx on public.operator_invites (organization_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer — utilisés par RLS + trigger)
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
-- Trigger : à l’inscription Auth → org + profile + org_data (ou opérateur via invite)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  invite_id uuid;
  invite_row public.operator_invites%rowtype;
  org_id uuid;
  company_name text;
  full_name text;
begin
  full_name := coalesce(nullif(trim(meta->>'full_name'), ''), split_part(new.email, '@', 1));

  -- Opérateur : inscription avec invite_id
  if coalesce(meta->>'role', '') = 'operateur' then
    begin
      invite_id := (meta->>'invite_id')::uuid;
    exception when others then
      raise exception 'invite_id invalide';
    end;

    select * into invite_row
    from public.operator_invites
    where id = invite_id
      and used_at is null
      and lower(email) = lower(new.email);

    if not found then
      raise exception 'Invitation opérateur introuvable ou déjà utilisée';
    end if;

    insert into public.profiles (
      id, email, full_name, organization_id, role, active,
      signataire_nom, signataire_qualite
    ) values (
      new.id,
      lower(new.email),
      coalesce(nullif(trim(invite_row.full_name), ''), full_name),
      invite_row.organization_id,
      'operateur',
      true,
      coalesce(nullif(trim(invite_row.full_name), ''), full_name),
      'Opérateur attesté'
    );

    update public.operator_invites
    set used_at = now()
    where id = invite_row.id;

    return new;
  end if;

  -- Owner : création société
  company_name := coalesce(nullif(trim(meta->>'company_name'), ''), full_name || ' — société');

  insert into public.organizations (name, owner_user_id)
  values (company_name, new.id)
  returning id into org_id;

  insert into public.profiles (
    id, email, full_name, organization_id, role, active,
    signataire_nom, signataire_qualite
  ) values (
    new.id,
    lower(new.email),
    full_name,
    org_id,
    'owner',
    true,
    full_name,
    'Responsable / gérant'
  );

  insert into public.org_data (organization_id, payload)
  values (org_id, '{}'::jsonb);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_data enable row level security;
alter table public.operator_invites enable row level security;

-- Organizations
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
drop policy if exists org_data_select on public.org_data;
create policy org_data_select on public.org_data
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists org_data_update on public.org_data;
create policy org_data_update on public.org_data
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active = true
    )
  )
  with check (organization_id = public.current_org_id());

drop policy if exists org_data_insert on public.org_data;
create policy org_data_insert on public.org_data
  for insert to authenticated
  with check (organization_id = public.current_org_id());

-- Invites (owner only)
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

-- ---------------------------------------------------------------------------
-- Storage bucket CERFA
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cerfa',
  'cerfa',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

-- Path : {organization_id}/{intervention_id}.pdf
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
