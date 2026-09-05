-- Santé coffre (si organization_coffre_secrets existe déjà)
-- À coller dans Supabase → SQL Editor → Run

alter table public.organization_coffre_secrets
  add column if not exists health jsonb not null default '{}'::jsonb;

comment on column public.organization_coffre_secrets.health is
  'État de synchro NAS/cloud (pannes, depuis quand, dernier e-mail 24 h).';
