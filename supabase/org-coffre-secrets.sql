-- ClimaZEN — secrets coffre-fort documents (NAS / Drive / OneDrive / S3)
-- À exécuter DANS SUPABASE → SQL Editor → Run
--
-- Les jetons et URL NAS/cloud ne sont JAMAIS exposés au client Supabase.
-- Seul le serveur Vercel (service role) lit / écrit cette table.
-- Le bureau télécharge via /api/documents/download/:id

create table if not exists public.organization_coffre_secrets (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  secrets jsonb not null default '{}'::jsonb,
  coffre_actif boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid
);

create index if not exists organization_coffre_secrets_updated_idx
  on public.organization_coffre_secrets (updated_at desc);

alter table public.organization_coffre_secrets enable row level security;

-- Aucune policy SELECT/INSERT/UPDATE pour authenticated :
-- seul le service role (API Vercel) lit / écrit les jetons.

comment on table public.organization_coffre_secrets is
  'Secrets coffre documents (NAS, WebDAV, Drive, Graph, S3). Jamais exposés au client.';

select 'organization_coffre_secrets OK' as status
where to_regclass('public.organization_coffre_secrets') is not null;
