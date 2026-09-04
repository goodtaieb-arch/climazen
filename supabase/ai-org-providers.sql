-- ClimaZEN — multi-fournisseurs IA (OpenAI | Anthropic Claude | Google Gemini)
-- Exécuter dans Supabase → SQL Editor → Run
-- Compatible avec ai-org-openai.sql (colonnes OpenAI inchangées).

alter table public.organization_ai_secrets
  add column if not exists ai_provider text not null default 'openai';

alter table public.organization_ai_secrets
  add column if not exists ai_model text;

alter table public.organization_ai_secrets
  add column if not exists anthropic_api_key text;

alter table public.organization_ai_secrets
  add column if not exists anthropic_key_hint text;

alter table public.organization_ai_secrets
  add column if not exists gemini_api_key text;

alter table public.organization_ai_secrets
  add column if not exists gemini_key_hint text;

do $$
begin
  alter table public.organization_ai_secrets
    drop constraint if exists organization_ai_secrets_provider_check;
  alter table public.organization_ai_secrets
    add constraint organization_ai_secrets_provider_check
    check (ai_provider in ('openai', 'anthropic', 'gemini'));
exception
  when others then null;
end $$;

comment on column public.organization_ai_secrets.ai_provider is
  'openai | anthropic | gemini — actif pour site + Lola';

select 'ai-org-providers OK' as status
where to_regclass('public.organization_ai_secrets') is not null;
