-- ClimaZEN — identifiants facturation électronique par société, multi-prestataire
-- À exécuter DANS SUPABASE → SQL Editor → Run (après schema.sql)
--
-- Chaque société choisit SON prestataire agréé (FactPulse, IOPOLE, B2Brouter…)
-- et colle SES identifiants. ClimaZEN ne facture rien pour ce service, ne
-- mutualise rien, n'impose aucun prestataire — même schéma que Trackdéchets
-- (supabase/trackdechets-secrets.sql). Aujourd'hui seul FactPulse est
-- réellement câblé (test de connexion) ; la colonne provider permet
-- d'ajouter IOPOLE / B2Brouter plus tard sans nouvelle migration de fond.
--
-- Remplace supabase/factpulse-secrets.sql (renommage sans perte de données
-- si vous l'aviez déjà exécuté).

do $$
begin
  if to_regclass('public.organization_factpulse_secrets') is not null
     and to_regclass('public.organization_invoicing_secrets') is null then
    alter table public.organization_factpulse_secrets
      rename to organization_invoicing_secrets;
  end if;
end $$;

create table if not exists public.organization_invoicing_secrets (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  provider text not null default 'factpulse',
  email text,
  password text,
  client_uid text,
  api_key text,
  franchise_tva boolean not null default false,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid
);

-- Si la table existait déjà (ancien schéma factpulse-secrets.sql sans ces colonnes)
alter table public.organization_invoicing_secrets add column if not exists provider text not null default 'factpulse';
alter table public.organization_invoicing_secrets add column if not exists api_key text;

create index if not exists organization_invoicing_secrets_updated_idx
  on public.organization_invoicing_secrets (updated_at desc);

alter table public.organization_invoicing_secrets enable row level security;

-- Aucune policy SELECT/INSERT/UPDATE pour authenticated :
-- seul le service role (API Vercel) lit / écrit les identifiants.

comment on table public.organization_invoicing_secrets is
  'Identifiants facturation électronique par société, multi-prestataire (provider). Mot de passe/clé jamais exposés au client Supabase (RLS sans policy).';

-- Vérification rapide (doit renvoyer organization_invoicing_secrets OK)
select 'organization_invoicing_secrets OK' as status
where to_regclass('public.organization_invoicing_secrets') is not null;
