-- ClimaZEN — signatures à distance (client absent)
-- À coller dans : Supabase → SQL Editor → Run

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id text not null,
  client_id text,
  ot_id text,
  site_nom text,
  client_nom text,
  nom_prefill text,
  qualite_prefill text,
  created_by_name text,
  expires_at timestamptz not null,
  used_at timestamptz,
  signature_nom text,
  signature_qualite text,
  signature_image text,
  created_at timestamptz not null default now()
);

create index if not exists signature_requests_org_idx
  on public.signature_requests (organization_id);
create index if not exists signature_requests_token_idx
  on public.signature_requests (token);
create index if not exists signature_requests_site_idx
  on public.signature_requests (organization_id, site_id);

alter table public.signature_requests enable row level security;

-- Membres de l’org : lire / créer / mettre à jour leurs demandes
drop policy if exists signature_requests_select_org on public.signature_requests;
create policy signature_requests_select_org on public.signature_requests
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists signature_requests_insert_org on public.signature_requests;
create policy signature_requests_insert_org on public.signature_requests
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists signature_requests_update_org on public.signature_requests;
create policy signature_requests_update_org on public.signature_requests
  for update to authenticated
  using (organization_id = public.current_org_id());

-- Lecture publique par token (lien SMS / e-mail) — champs limités via RPC
create or replace function public.get_signature_request_public(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  r public.signature_requests%rowtype;
begin
  select * into r from public.signature_requests where token = p_token limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Lien invalide.');
  end if;
  if r.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Signature déjà enregistrée.', 'used', true);
  end if;
  if r.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Lien expiré. Demandez un nouveau lien au technicien.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'siteNom', coalesce(r.site_nom, ''),
    'clientNom', coalesce(r.client_nom, ''),
    'nomPrefill', coalesce(r.nom_prefill, ''),
    'qualitePrefill', coalesce(r.qualite_prefill, 'Représentant client'),
    'createdByName', coalesce(r.created_by_name, ''),
    'expiresAt', r.expires_at
  );
end;
$$;

create or replace function public.submit_signature_request_public(
  p_token text,
  p_nom text,
  p_qualite text,
  p_image text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  r public.signature_requests%rowtype;
begin
  if coalesce(trim(p_nom), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Indiquez votre nom.');
  end if;
  if coalesce(trim(p_image), '') = '' or length(p_image) < 100 then
    return jsonb_build_object('ok', false, 'error', 'Signature manquante.');
  end if;
  if length(p_image) > 900000 then
    return jsonb_build_object('ok', false, 'error', 'Signature trop lourde — signez plus simplement.');
  end if;

  select * into r from public.signature_requests where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Lien invalide.');
  end if;
  if r.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Signature déjà enregistrée.');
  end if;
  if r.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Lien expiré.');
  end if;

  update public.signature_requests
  set
    used_at = now(),
    signature_nom = trim(p_nom),
    signature_qualite = coalesce(nullif(trim(p_qualite), ''), 'Représentant client'),
    signature_image = p_image
  where id = r.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_signature_request_public(text) to anon, authenticated;
grant execute on function public.submit_signature_request_public(text, text, text, text) to anon, authenticated;
