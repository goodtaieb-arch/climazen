-- ClimaZEN — jeton API Trackdéchets par société (création automatique des BSFF)
-- À exécuter DANS SUPABASE → SQL Editor → Run (après schema.sql)
--
-- Chaque utilisateur colle SON jeton personnel Trackdéchets (Mon compte →
-- Applications et API → Jeton d'accès à l'API sur trackdechets.beta.gouv.fr).
-- Le jeton porte les droits de l'utilisateur sur son propre établissement —
-- ClimaZEN ne fait que relayer ses actions. Jamais exposé au client Supabase.

create table if not exists public.organization_trackdechets_secrets (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  api_token text,
  api_token_hint text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid
);

create index if not exists organization_trackdechets_secrets_updated_idx
  on public.organization_trackdechets_secrets (updated_at desc);

alter table public.organization_trackdechets_secrets enable row level security;

-- Aucune policy SELECT/INSERT/UPDATE pour authenticated :
-- seul le service role (API Vercel) lit / écrit le jeton.

comment on table public.organization_trackdechets_secrets is
  'Jeton API Trackdéchets par société. Jamais exposé au client Supabase (RLS sans policy).';

-- Vérification rapide (doit renvoyer organization_trackdechets_secrets OK)
select 'organization_trackdechets_secrets OK' as status
where to_regclass('public.organization_trackdechets_secrets') is not null;
