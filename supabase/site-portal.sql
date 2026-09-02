-- ClimaZEN — Portail client GMAO (maintenance + tickets)
-- Supabase → SQL Editor → Run

create table if not exists public.site_portals (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id text not null,
  site_nom text,
  client_nom text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_portals_token_idx on public.site_portals (token);
create index if not exists site_portals_org_site_idx on public.site_portals (organization_id, site_id);

create table if not exists public.client_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_id text not null,
  portal_token text not null,
  localisation text not null,
  description text not null,
  contact_nom text,
  contact_email text,
  contact_tel text,
  statut text not null default 'nouveau',
  ot_id text,
  ot_numero text,
  created_at timestamptz not null default now(),
  traite_at timestamptz
);

create index if not exists client_tickets_org_idx on public.client_tickets (organization_id, statut);
create index if not exists client_tickets_site_idx on public.client_tickets (organization_id, site_id);

alter table public.site_portals enable row level security;
alter table public.client_tickets enable row level security;

drop policy if exists site_portals_org on public.site_portals;
create policy site_portals_org on public.site_portals
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists client_tickets_org on public.client_tickets;
create policy client_tickets_org on public.client_tickets
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.get_site_portal_public(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  p public.site_portals%rowtype;
  payload jsonb;
  hist jsonb := '[]'::jsonb;
  o jsonb;
  tickets jsonb := '[]'::jsonb;
begin
  select * into p from public.site_portals where token = p_token and actif = true limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Lien portail invalide ou désactivé.');
  end if;

  select od.payload into payload from public.org_data od where od.organization_id = p.organization_id limit 1;
  if payload is null then
    payload := '{}'::jsonb;
  end if;

  for o in select * from jsonb_array_elements(coalesce(payload->'ordresTravail', '[]'::jsonb))
  loop
    if (o->>'chantierId') = p.site_id
       and (o->>'statut') in ('termine', 'signe') then
      hist := hist || jsonb_build_array(jsonb_build_object(
        'id', o->>'id',
        'numero', o->>'numero',
        'date', coalesce(o->>'date', o->>'updatedAt'),
        'action', coalesce(o->>'rapportAction', o->>'action', ''),
        'statut', o->>'statut',
        'localisation', o->>'localisationClient'
      ));
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'localisation', t.localisation,
    'description', t.description,
    'statut', t.statut,
    'otNumero', t.ot_numero,
    'createdAt', t.created_at
  ) order by t.created_at desc), '[]'::jsonb)
  into tickets
  from public.client_tickets t
  where t.organization_id = p.organization_id and t.site_id = p.site_id
    and t.created_at > now() - interval '365 days';

  return jsonb_build_object(
    'ok', true,
    'siteNom', coalesce(p.site_nom, ''),
    'clientNom', coalesce(p.client_nom, ''),
    'siteId', p.site_id,
    'historique', hist,
    'tickets', tickets
  );
end;
$$;

create or replace function public.submit_client_ticket_public(
  p_token text,
  p_localisation text,
  p_description text,
  p_contact_nom text default '',
  p_contact_email text default '',
  p_contact_tel text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  p public.site_portals%rowtype;
  tid uuid;
begin
  if coalesce(trim(p_localisation), '') = '' or coalesce(trim(p_description), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Indiquez le lieu (ex. Bureau 117) et la description.');
  end if;

  select * into p from public.site_portals where token = p_token and actif = true limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Lien portail invalide.');
  end if;

  insert into public.client_tickets (
    organization_id, site_id, portal_token, localisation, description,
    contact_nom, contact_email, contact_tel, statut
  ) values (
    p.organization_id, p.site_id, p_token, trim(p_localisation), trim(p_description),
    nullif(trim(p_contact_nom), ''), nullif(trim(p_contact_email), ''), nullif(trim(p_contact_tel), ''),
    'nouveau'
  ) returning id into tid;

  return jsonb_build_object('ok', true, 'ticketId', tid);
end;
$$;

create or replace function public.list_client_tickets_org(p_org_id uuid)
returns setof public.client_tickets
language sql
security definer
set search_path = public
set row_security = off
as $$
  select * from public.client_tickets
  where organization_id = p_org_id and statut = 'nouveau'
  order by created_at asc;
$$;

create or replace function public.mark_client_ticket_traite(
  p_ticket_id uuid,
  p_ot_id text,
  p_ot_numero text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.client_tickets
  set statut = 'ot_cree', ot_id = p_ot_id, ot_numero = p_ot_numero, traite_at = now()
  where id = p_ticket_id;
$$;
