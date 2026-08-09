-- Signature personnelle : l’admin ne peut activer/désactiver un opérateur
-- sans pouvoir écraser signataire_nom / signature_image.
-- À exécuter dans Supabase SQL Editor si besoin.

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.is_org_owner()
    and role = 'operateur'
  )
  with check (
    organization_id = public.current_org_id()
    and public.is_org_owner()
    and role = 'operateur'
  );

-- Note : Postgres RLS ne filtre pas les colonnes.
-- L’app liste l’équipe SANS signature_image (listOrgUsers).
-- Chaque opérateur lit/écrit sa propre signature via profiles_update_self.
