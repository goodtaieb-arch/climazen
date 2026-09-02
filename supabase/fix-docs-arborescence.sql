-- Arborescence documents sous le bucket cerfa existant
-- Chemins : {orgId}/documents/ClimaZEN/Documents/...
-- Les policies actuelles (foldername[1] = org) couvrent déjà ce préfixe.
-- Aucun nouveau bucket requis.

-- Vérification optionnelle : lister les objets documents
-- select name from storage.objects where bucket_id = 'cerfa' and name like '%/documents/%';
