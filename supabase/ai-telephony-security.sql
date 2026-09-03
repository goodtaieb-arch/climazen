-- ClimaZEN — téléphonie Lola (1 numéro → 1 société) + journal audit actions IA
-- À exécuter après schema.sql (+ ai-vocabulary.sql si présent)

-- ---------------------------------------------------------------------------
-- Numéro entrant : isolation stricte (pas de mélange entre sociétés)
-- ---------------------------------------------------------------------------

create table if not exists public.organization_telephony (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  /** twilio | vonage | plivo | other — webhook compatible form POST */
  provider text not null default 'twilio'
    check (provider in ('twilio', 'vonage', 'plivo', 'other')),
  /** Numéro entrant E.164 unique — ex. +33123456789 */
  inbound_e164 text not null,
  lola_enabled boolean not null default false,
  /** E-mail gérant pour accord OT proposés par Lola */
  manager_notify_email text,
  /** Secret optionnel pour vérifier webhooks entrants */
  webhook_secret text,
  notes text,
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_telephony_inbound_e164_idx
  on public.organization_telephony (inbound_e164);

create index if not exists organization_telephony_enabled_idx
  on public.organization_telephony (lola_enabled)
  where lola_enabled = true;

/** Routage serveur : numéro appelé → société (AVANT toute IA). */
create or replace function public.resolve_org_id_by_inbound_phone(p_e164 text)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select organization_id
  from public.organization_telephony
  where inbound_e164 = trim(p_e164)
    and lola_enabled = true
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Journal audit — qui a fait quoi, pour quelle société (sans secrets dans detail)
-- ---------------------------------------------------------------------------

create table if not exists public.ai_action_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent text not null
    check (agent in ('gemini', 'phone', 'email', 'ticket', 'voice', 'system')),
  action text not null,
  actor_user_id uuid,
  success boolean not null default true,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_action_audit_log_org_created_idx
  on public.ai_action_audit_log (organization_id, created_at desc);

create or replace function public.log_ai_action_audit(
  p_org_id uuid,
  p_agent text,
  p_action text,
  p_actor_user_id uuid default null,
  p_success boolean default true,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_id uuid;
begin
  insert into public.ai_action_audit_log (
    organization_id, agent, action, actor_user_id, success, detail
  ) values (
    p_org_id,
    p_agent,
    left(p_action, 200),
    p_actor_user_id,
    coalesce(p_success, true),
    coalesce(p_detail, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — gérant voit / modifie uniquement SA société
-- ---------------------------------------------------------------------------

alter table public.organization_telephony enable row level security;
alter table public.ai_action_audit_log enable row level security;

drop policy if exists org_telephony_select on public.organization_telephony;
create policy org_telephony_select on public.organization_telephony
  for select using (organization_id = public.current_org_id());

drop policy if exists org_telephony_insert on public.organization_telephony;
create policy org_telephony_insert on public.organization_telephony
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_org_owner()
  );

drop policy if exists org_telephony_update on public.organization_telephony;
create policy org_telephony_update on public.organization_telephony
  for update using (
    organization_id = public.current_org_id()
    and public.is_org_owner()
  );

drop policy if exists ai_audit_select on public.ai_action_audit_log;
create policy ai_audit_select on public.ai_action_audit_log
  for select using (
    organization_id = public.current_org_id()
    and public.is_org_owner()
  );
