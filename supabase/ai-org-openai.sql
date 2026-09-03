-- ClimaZEN — clé OpenAI par société (site + Lola)
-- À exécuter DANS SUPABASE → SQL Editor → Run
-- (après schema.sql ; ai-vocabulary.sql et ai-telephony-security.sql si déjà utilisés)
--
-- Chaque gérant colle SA clé OpenAI dans Mon entreprise.
-- OpenAI facture le compte de la société (pas ClimaZEN).
-- La clé n’est lisible que par le serveur Vercel (service role).

-- ---------------------------------------------------------------------------
-- Table secrets OpenAI par société
-- ---------------------------------------------------------------------------

create table if not exists public.organization_ai_secrets (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  openai_api_key text,
  openai_key_hint text,
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid
);

create index if not exists organization_ai_secrets_updated_idx
  on public.organization_ai_secrets (updated_at desc);

alter table public.organization_ai_secrets enable row level security;

-- Aucune policy SELECT/INSERT/UPDATE pour authenticated :
-- seul le service role (API Vercel) lit / écrit la clé.

comment on table public.organization_ai_secrets is
  'Secrets IA par société. Jamais exposés au client Supabase (RLS sans policy).';

-- ---------------------------------------------------------------------------
-- Audit / vocabulaire : autoriser agent « openai » (si les tables existent)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.ai_action_audit_log') is not null then
    alter table public.ai_action_audit_log drop constraint if exists ai_action_audit_log_agent_check;
    alter table public.ai_action_audit_log
      add constraint ai_action_audit_log_agent_check
      check (agent in ('gemini', 'openai', 'phone', 'email', 'ticket', 'voice', 'system'));
  end if;

  if to_regclass('public.ai_agent_interactions') is not null then
    alter table public.ai_agent_interactions drop constraint if exists ai_agent_interactions_agent_check;
    alter table public.ai_agent_interactions
      add constraint ai_agent_interactions_agent_check
      check (agent in ('gemini', 'openai', 'phone', 'email', 'ticket', 'voice'));
  end if;

  if to_regclass('public.ai_term_aliases') is not null then
    alter table public.ai_term_aliases drop constraint if exists ai_term_aliases_source_check;
    alter table public.ai_term_aliases
      add constraint ai_term_aliases_source_check
      check (source in ('gemini', 'openai', 'phone', 'email', 'ticket', 'voice', 'manual', 'seed'));
  end if;
end $$;

-- Vérification rapide (doit renvoyer organization_ai_secrets)
select 'organization_ai_secrets OK' as status
where to_regclass('public.organization_ai_secrets') is not null;
