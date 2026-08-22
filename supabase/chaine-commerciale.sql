-- ClimaZEN — chaîne commerciale OT (cible normalisée)
-- À coller dans Supabase → SQL Editor quand vous quittez le blob org_data.
-- AUJOURD’HUI le runtime utilise AppData JSON (org_data.payload) — ce fichier
-- documente le modèle cible + foreign keys demandées.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.origine_ot as enum (
    'depannage_urgence',
    'installation_devis',
    'maintenance_contrat',
    'garantie',
    'sous_traitance',
    'commande_materiel'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.statut_facturation_ot as enum (
    'non_facture',
    'sous_contrat',
    'devis_a_faire',
    'devis_regule_emis',
    'facture_generee',
    'garantie_prise_en_charge'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.statut_ot as enum (
    'brouillon',
    'en_cours',
    'en_attente_piece',
    'pret_a_planifier',
    'termine',
    'signe'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.statut_devis as enum (
    'brouillon', 'envoye', 'accepte', 'refuse', 'annule', 'execute'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.type_devis as enum ('standard', 'regularisation');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.statut_commande_fournisseur as enum (
    'brouillon', 'commandee', 'recue', 'annulee'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables commerciales (par organisation)
-- ---------------------------------------------------------------------------

create table if not exists public.devis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  numero text not null,
  type public.type_devis not null default 'standard',
  statut public.statut_devis not null default 'brouillon',
  client_id uuid not null,
  site_id uuid,
  ot_origine_id uuid,
  libelle text not null default '',
  lignes jsonb not null default '[]'::jsonb,
  montant_ht numeric(12,2),
  externe_url text,
  notes text,
  accepte_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);

create index if not exists devis_org_idx on public.devis (organization_id);
create index if not exists devis_client_idx on public.devis (organization_id, client_id);

create table if not exists public.commandes_fournisseur (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  numero text not null,
  fournisseur text not null default '',
  statut public.statut_commande_fournisseur not null default 'brouillon',
  client_id uuid,
  site_id uuid,
  ot_id uuid,
  libelle text not null default '',
  reference_piece text,
  notes text,
  commandee_at timestamptz,
  recue_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);

create index if not exists commandes_fournisseur_org_idx on public.commandes_fournisseur (organization_id);
create index if not exists commandes_fournisseur_ot_idx on public.commandes_fournisseur (ot_id);

create table if not exists public.factures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  numero text not null,
  statut text not null default 'brouillon',
  client_id uuid not null,
  client_payeur_id uuid,
  site_id uuid,
  ot_id uuid,
  devis_id uuid references public.devis (id) on delete set null,
  libelle text not null default '',
  montant_ht numeric(12,2),
  externe_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);

create index if not exists factures_org_idx on public.factures (organization_id);

-- ---------------------------------------------------------------------------
-- Ordres de travail (cible) — FK commerciales
-- ---------------------------------------------------------------------------

create table if not exists public.ordres_de_travail (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  numero text not null,
  date date not null default current_date,
  type_ot text not null default 'depanage',
  action text not null default '',
  rapport_action text not null default '',
  observations text not null default '',
  client_id uuid,
  site_id uuid,
  equipement_id uuid,
  equipement_ids jsonb not null default '[]'::jsonb,
  technicien text not null default '',
  intervention_id uuid,
  fiche_maintenance_id uuid,
  fiche_chaufferie_id uuid,
  -- Chaîne commerciale
  devis_id uuid references public.devis (id) on delete set null,
  contrat_id uuid,
  commande_fournisseur_id uuid references public.commandes_fournisseur (id) on delete set null,
  facture_id uuid references public.factures (id) on delete set null,
  origine_ot public.origine_ot not null default 'depannage_urgence',
  statut_facturation public.statut_facturation_ot not null default 'non_facture',
  sous_garantie boolean not null default false,
  client_payeur_id uuid,
  main_oeuvre_incluse_contrat boolean not null default false,
  lien_commande_type text,
  lien_commande_ref text,
  statut public.statut_ot not null default 'brouillon',
  parcours_step text,
  signature_technicien_image text,
  signature_client_image text,
  created_by_user_id uuid,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);

create index if not exists ot_org_idx on public.ordres_de_travail (organization_id);
create index if not exists ot_devis_idx on public.ordres_de_travail (devis_id);
create index if not exists ot_contrat_idx on public.ordres_de_travail (contrat_id);
create index if not exists ot_commande_idx on public.ordres_de_travail (commande_fournisseur_id);
create index if not exists ot_client_idx on public.ordres_de_travail (organization_id, client_id);

-- 1 devis → N OT (multi-visites)
comment on column public.ordres_de_travail.devis_id is
  'Devis accepté d’origine OU devis de régule ; plusieurs OT peuvent partager le même devis_id';

-- ---------------------------------------------------------------------------
-- RLS (même pattern org)
-- ---------------------------------------------------------------------------

alter table public.devis enable row level security;
alter table public.commandes_fournisseur enable row level security;
alter table public.factures enable row level security;
alter table public.ordres_de_travail enable row level security;

drop policy if exists devis_org_all on public.devis;
create policy devis_org_all on public.devis
  for all using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists commandes_org_all on public.commandes_fournisseur;
create policy commandes_org_all on public.commandes_fournisseur
  for all using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists factures_org_all on public.factures;
create policy factures_org_all on public.factures
  for all using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists ot_org_all on public.ordres_de_travail;
create policy ot_org_all on public.ordres_de_travail
  for all using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Trigger : commande reçue → OT prêt à planifier
-- ---------------------------------------------------------------------------

create or replace function public.on_commande_recue_update_ot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'recue' and new.ot_id is not null
     and (old.statut is distinct from 'recue') then
    update public.ordres_de_travail
       set statut = 'pret_a_planifier',
           updated_at = now()
     where id = new.ot_id
       and statut = 'en_attente_piece';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commande_recue_ot on public.commandes_fournisseur;
create trigger trg_commande_recue_ot
  after update of statut on public.commandes_fournisseur
  for each row execute function public.on_commande_recue_update_ot();
