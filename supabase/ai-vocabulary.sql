-- ClimaZEN — vocabulaire technique partagé (Gemini site + OpenAI accueil téléphone + tickets/e-mails)
-- À exécuter dans Supabase → SQL Editor après schema.sql
--
-- Les agents enregistrent les mentions techniques et apprennent alias / corrections
-- pour mieux comprendre le jargon froid / clim (R-32, PAC, CERFA, etc.).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.ai_technical_terms (
  id uuid primary key default gen_random_uuid(),
  /** null = terme global ClimaZEN (fluides, réglementation…) */
  organization_id uuid references public.organizations (id) on delete cascade,
  canonical text not null,
  domain text not null default 'metier'
    check (domain in ('fluide', 'equipement', 'reglementaire', 'metier', 'client', 'general')),
  definition text,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_technical_terms_global_canonical_idx
  on public.ai_technical_terms (lower(canonical))
  where organization_id is null;

create unique index if not exists ai_technical_terms_org_canonical_idx
  on public.ai_technical_terms (organization_id, lower(canonical))
  where organization_id is not null;

create index if not exists ai_technical_terms_org_idx
  on public.ai_technical_terms (organization_id);

create table if not exists public.ai_term_aliases (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.ai_technical_terms (id) on delete cascade,
  alias text not null,
  source text not null default 'manual'
    check (source in ('gemini', 'phone', 'email', 'ticket', 'voice', 'manual', 'seed')),
  confidence numeric(4, 3) not null default 1.000,
  usage_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_term_aliases_term_alias_idx
  on public.ai_term_aliases (term_id, alias);

create table if not exists public.ai_agent_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent text not null
    check (agent in ('gemini', 'phone', 'email', 'ticket', 'voice')),
  raw_text text not null,
  normalized_text text,
  terms_found jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_agent_interactions_org_created_idx
  on public.ai_agent_interactions (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Contexte vocabulaire pour injection dans les prompts IA
-- ---------------------------------------------------------------------------

create or replace function public.get_ai_vocabulary_context(p_org_id uuid, p_limit int default 80)
returns text
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  lines text := '';
  rec record;
begin
  for rec in
    select t.canonical, t.domain, t.definition,
      coalesce(
        (select string_agg(a.alias, ', ' order by a.usage_count desc)
         from public.ai_term_aliases a
         where a.term_id = t.id
         limit 8),
        ''
      ) as aliases
    from public.ai_technical_terms t
    where t.organization_id is null
       or t.organization_id = p_org_id
    order by t.usage_count desc, t.canonical
    limit greatest(10, least(p_limit, 200))
  loop
    lines := lines || '- ' || rec.canonical;
    if rec.domain is not null and rec.domain <> 'general' then
      lines := lines || ' [' || rec.domain || ']';
    end if;
    if rec.definition is not null and length(trim(rec.definition)) > 0 then
      lines := lines || ' : ' || left(rec.definition, 120);
    end if;
    if rec.aliases is not null and length(trim(rec.aliases)) > 0 then
      lines := lines || ' (aussi : ' || rec.aliases || ')';
    end if;
    lines := lines || E'\n';
  end loop;

  if lines = '' then
    return 'Aucun terme appris pour cette société.';
  end if;

  return 'Vocabulaire technique ClimaZEN (global + société) :' || E'\n' || lines;
end;
$$;

-- ---------------------------------------------------------------------------
-- Apprentissage : terme + alias optionnel
-- ---------------------------------------------------------------------------

create or replace function public.learn_ai_technical_term(
  p_org_id uuid,
  p_canonical text,
  p_domain text default 'metier',
  p_definition text default null,
  p_alias text default null,
  p_source text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_term_id uuid;
  v_canonical text := trim(p_canonical);
  v_alias text := nullif(trim(coalesce(p_alias, '')), '');
begin
  if v_canonical = '' then
    return null;
  end if;

  select id into v_term_id
  from public.ai_technical_terms
  where lower(canonical) = lower(v_canonical)
    and (
      (organization_id is null and p_org_id is null)
      or organization_id = p_org_id
    )
  limit 1;

  if v_term_id is null then
    insert into public.ai_technical_terms (organization_id, canonical, domain, definition, usage_count)
    values (p_org_id, v_canonical, coalesce(nullif(trim(p_domain), ''), 'metier'), p_definition, 1)
    returning id into v_term_id;
  else
    update public.ai_technical_terms
    set usage_count = usage_count + 1,
        updated_at = now(),
        definition = coalesce(p_definition, definition)
    where id = v_term_id;
  end if;

  if v_alias is not null and lower(v_alias) <> lower(v_canonical) then
    insert into public.ai_term_aliases (term_id, alias, source, usage_count)
    values (v_term_id, v_alias, coalesce(nullif(trim(p_source), ''), 'manual'), 1)
    on conflict (term_id, alias)
    do update set
      usage_count = public.ai_term_aliases.usage_count + 1,
      updated_at = now(),
      source = excluded.source;
  end if;

  return v_term_id;
end;
$$;

-- Journal interaction agent
create or replace function public.log_ai_agent_interaction(
  p_org_id uuid,
  p_agent text,
  p_raw_text text,
  p_normalized_text text default null,
  p_terms_found jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
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
  insert into public.ai_agent_interactions (
    organization_id, agent, raw_text, normalized_text, terms_found, metadata
  ) values (
    p_org_id,
    p_agent,
    left(p_raw_text, 8000),
    left(p_normalized_text, 8000),
    coalesce(p_terms_found, '[]'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — lecture org + global ; écriture via service role (API) ou owner
-- ---------------------------------------------------------------------------

alter table public.ai_technical_terms enable row level security;
alter table public.ai_term_aliases enable row level security;
alter table public.ai_agent_interactions enable row level security;

drop policy if exists ai_terms_select on public.ai_technical_terms;
create policy ai_terms_select on public.ai_technical_terms
  for select using (
    organization_id is null
    or organization_id = public.current_org_id()
  );

drop policy if exists ai_terms_insert_owner on public.ai_technical_terms;
create policy ai_terms_insert_owner on public.ai_technical_terms
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_org_owner()
  );

drop policy if exists ai_aliases_select on public.ai_term_aliases;
create policy ai_aliases_select on public.ai_term_aliases
  for select using (
    exists (
      select 1 from public.ai_technical_terms t
      where t.id = term_id
        and (t.organization_id is null or t.organization_id = public.current_org_id())
    )
  );

drop policy if exists ai_interactions_select on public.ai_agent_interactions;
create policy ai_interactions_select on public.ai_agent_interactions
  for select using (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Graines globales (fluides / métier frigoriste)
-- ---------------------------------------------------------------------------

insert into public.ai_technical_terms (organization_id, canonical, domain, definition)
select null, v.canonical, v.domain, v.definition
from (values
  ('R-32', 'fluide', 'HFC A2L — clim résidentielle / PAC'),
  ('R-134a', 'fluide', 'HFC — chillers, froid commercial'),
  ('R-410A', 'fluide', 'Mélange HFC — splits / VRV'),
  ('R-407C', 'fluide', 'Mélange HFC — climatisation'),
  ('R-404A', 'fluide', 'HFC — froid commercial négatif'),
  ('R-448A', 'fluide', 'HFC bas GWP — remplacement R-404A'),
  ('R-449A', 'fluide', 'HFC bas GWP — remplacement R-404A'),
  ('R-452A', 'fluide', 'HFC bas GWP — transport froid'),
  ('R-513A', 'fluide', 'HFO/HFC — remplacement R-134a'),
  ('R-1234yf', 'fluide', 'HFO faible GWP — automobile'),
  ('R-290', 'fluide', 'Propane — naturel A3'),
  ('R-744', 'fluide', 'CO₂ transcritique'),
  ('CERFA 15497', 'reglementaire', 'Fiche intervention fluides frigorigènes'),
  ('F-Gas', 'reglementaire', 'Règlement européen gaz fluorés'),
  ('PAC', 'equipement', 'Pompe à chaleur'),
  ('VRV', 'equipement', 'Volume de fluide variable Daikin / multi-split pro'),
  ('CTA', 'equipement', 'Centrale de traitement d''air'),
  ('VMC', 'equipement', 'Ventilation mécanique contrôlée'),
  ('GWP', 'reglementaire', 'Pouvoir de réchauffement global'),
  ('A2L', 'reglementaire', 'Classe sécurité fluide légèrement inflammable'),
  ('contrôle d''étanchéité', 'metier', 'Contrôle fuite périodique F-Gas'),
  ('charge fluide', 'metier', 'Recharge ou transfert frigorigène'),
  ('monobloc', 'equipement', 'Climatiseur monobloc'),
  ('split', 'equipement', 'Climatiseur split'),
  ('groupe froid', 'equipement', 'Groupe de production eau glacée / froid'),
  ('chambre froide', 'equipement', 'Installation frigorifique positive/négative'),
  ('détendeur', 'equipement', 'Détente fluide — TEV / capillaire'),
  ('compresseur', 'equipement', 'Compresseur hermétique / scroll / vis'),
  ('échangeur', 'equipement', 'Échangeur thermique'),
  ('OT', 'metier', 'Ordre de travail ClimaZEN')
) as v(canonical, domain, definition)
where not exists (
  select 1 from public.ai_technical_terms t
  where t.organization_id is null and lower(t.canonical) = lower(v.canonical)
);

insert into public.ai_term_aliases (term_id, alias, source)
select t.id, a.alias, 'seed'
from public.ai_technical_terms t
cross join lateral (values
  ('R32'), ('R 32'), ('erre trente deux')
) as a(alias)
where t.organization_id is null and lower(t.canonical) = 'r-32'
  and not exists (
    select 1 from public.ai_term_aliases x where x.term_id = t.id and lower(x.alias) = lower(a.alias)
  );

insert into public.ai_term_aliases (term_id, alias, source)
select t.id, a.alias, 'seed'
from public.ai_technical_terms t
cross join lateral (values
  ('134a'), ('R134'), ('R 134a')
) as a(alias)
where t.organization_id is null and lower(t.canonical) = 'r-134a'
  and not exists (
    select 1 from public.ai_term_aliases x where x.term_id = t.id and lower(x.alias) = lower(a.alias)
  );

insert into public.ai_term_aliases (term_id, alias, source)
select t.id, a.alias, 'seed'
from public.ai_technical_terms t
cross join lateral (values
  ('410a'), ('R410'), ('R 410 A')
) as a(alias)
where t.organization_id is null and lower(t.canonical) = 'r-410a'
  and not exists (
    select 1 from public.ai_term_aliases x where x.term_id = t.id and lower(x.alias) = lower(a.alias)
  );

insert into public.ai_term_aliases (term_id, alias, source)
select t.id, a.alias, 'seed'
from public.ai_technical_terms t
cross join lateral (values
  ('cerfa'), ('15497'), ('fiche fluide')
) as a(alias)
where t.organization_id is null and lower(t.canonical) = 'cerfa 15497'
  and not exists (
    select 1 from public.ai_term_aliases x where x.term_id = t.id and lower(x.alias) = lower(a.alias)
  );
