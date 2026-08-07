-- Fix CRITIQUE : trigger inscription + rattrapage des users sans profil
-- SQL Editor → Run une seule fois

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

-- Rattrapage : utilisateurs Auth déjà créés SANS profil
create or replace function public.bootstrap_missing_profiles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  org_id uuid;
  full_name text;
  company_name text;
  n int := 0;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on p.id = au.id
    where p.id is null
  loop
    full_name := coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      split_part(u.email, '@', 1)
    );
    company_name := coalesce(
      nullif(trim(u.raw_user_meta_data->>'company_name'), ''),
      full_name || ' — société'
    );

    insert into public.organizations (name, owner_user_id)
    values (company_name, u.id)
    returning id into org_id;

    insert into public.profiles (
      id, email, full_name, organization_id, role, active,
      signataire_nom, signataire_qualite
    ) values (
      u.id,
      lower(u.email),
      full_name,
      org_id,
      'owner',
      true,
      full_name,
      'Responsable / gérant'
    );

    insert into public.org_data (organization_id, payload)
    values (org_id, '{}'::jsonb);

    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Filet : un user connecté sans profil peut s’auto-réparer
create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  full_name text;
  company_name text;
  org_id uuid;
  result public.profiles;
begin
  if uid is null then
    raise exception 'Non authentifié';
  end if;

  select * into result from public.profiles where id = uid;
  if found then
    return result;
  end if;

  select raw_user_meta_data into meta from auth.users where id = uid;
  meta := coalesce(meta, '{}'::jsonb);
  full_name := coalesce(nullif(trim(meta->>'full_name'), ''), 'Utilisateur');
  company_name := coalesce(nullif(trim(meta->>'company_name'), ''), full_name || ' — société');

  insert into public.organizations (name, owner_user_id)
  values (company_name, uid)
  returning id into org_id;

  insert into public.profiles (
    id, email, full_name, organization_id, role, active,
    signataire_nom, signataire_qualite
  )
  select
    uid,
    lower(au.email),
    full_name,
    org_id,
    'owner',
    true,
    full_name,
    'Responsable / gérant'
  from auth.users au
  where au.id = uid
  returning * into result;

  insert into public.org_data (organization_id, payload)
  values (org_id, '{}'::jsonb);

  return result;
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.bootstrap_missing_profiles() to postgres;

-- Exécute le rattrapage maintenant
select public.bootstrap_missing_profiles() as profiles_created;
