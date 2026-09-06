-- ClimaZEN — connexions cloud OAuth2 par société
-- À exécuter DANS SUPABASE → SQL Editor → Run (après schema.sql)
--
-- Google Drive (scope drive.file) et Microsoft OneDrive / SharePoint
-- (Files.ReadWrite.All + offline_access).
--
-- Les refresh_token sont chiffrés AES-256-GCM par le serveur Vercel avant
-- insertion : même avec un accès lecture à la base, ils restent inutilisables.
-- Aucune policy RLS → seul le service role (API Vercel) lit / écrit ces lignes.

-- ---------------------------------------------------------------------------
-- Jetons cloud par société
-- ---------------------------------------------------------------------------

create table if not exists public.organization_cloud_connections (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  account_label text,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid,
  primary key (organization_id, provider)
);

create index if not exists organization_cloud_connections_updated_idx
  on public.organization_cloud_connections (updated_at desc);

alter table public.organization_cloud_connections enable row level security;

comment on table public.organization_cloud_connections is
  'Jetons OAuth2 cloud (Drive / OneDrive / SharePoint) chiffrés. Jamais exposés au client Supabase (RLS sans policy).';

-- ---------------------------------------------------------------------------
-- États anti-CSRF + PKCE (durée de vie 10 minutes)
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_oauth_states (
  state text primary key,
  provider text not null check (provider in ('google', 'microsoft')),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  code_verifier text not null,
  redirect_path text not null default '/app/operateur',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists cloud_oauth_states_expires_idx
  on public.cloud_oauth_states (expires_at);

alter table public.cloud_oauth_states enable row level security;

comment on table public.cloud_oauth_states is
  'États OAuth2 à usage unique (anti-CSRF + PKCE). Purgés à chaque connexion.';

-- Vérification rapide
select 'cloud OAuth OK' as status
where to_regclass('public.organization_cloud_connections') is not null
  and to_regclass('public.cloud_oauth_states') is not null;
