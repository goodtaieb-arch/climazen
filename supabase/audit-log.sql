-- ClimaZEN — journal d'audit (actions métier clés, pas chaque frappe clavier)
-- À coller dans : Supabase → SQL Editor → Run
--
-- Objectif : en cas de piratage, panne ou bug majeur, retrouver qui a fait
-- quoi, quand, sur quel enregistrement — même si les données elles-mêmes
-- (org_data) sont perdues ou corrompues. Table séparée, jamais modifiable
-- après coup (pas d'update/delete côté app).

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_name text,
  -- Code court stable, ex. 'ot.statut', 'absence.decision', 'devis.cree',
  -- 'fiche.signee', 'commande.statut'… (pas un texte libre par écran).
  action text not null,
  -- Type d'enregistrement concerné, ex. 'ordre_travail', 'demande_absence',
  -- 'devis', 'fiche_maintenance_clim'…
  entity_type text not null,
  entity_id text not null,
  -- Résumé lisible humain, ex. « OT#20260917-03 : pret_a_planifier → cloture ».
  summary text not null,
  -- Détails structurés optionnels (ancien/nouveau statut, etc.) — jamais de
  -- secret (mot de passe, clé API, token) : uniquement des faits métier.
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_org_idx
  on public.audit_log (organization_id, created_at desc);
create index if not exists audit_log_entity_idx
  on public.audit_log (organization_id, entity_type, entity_id);

alter table public.audit_log enable row level security;

-- Journal immuable : les membres de l'org peuvent lire et créer des lignes,
-- jamais les modifier ni les supprimer (aucune policy update/delete = refusé).
drop policy if exists audit_log_select_org on public.audit_log;
create policy audit_log_select_org on public.audit_log
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists audit_log_insert_org on public.audit_log;
create policy audit_log_insert_org on public.audit_log
  for insert to authenticated
  with check (organization_id = public.current_org_id());
