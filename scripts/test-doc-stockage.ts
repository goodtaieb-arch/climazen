import assert from 'node:assert/strict'
import {
  CLOUD_DOCS_FOLDER,
  CLOUD_DOCS_ROOT,
  arborescenceDocumentsEntreprise,
  cheminRelatifDocument,
  resolveDocsStockageMode,
  slugSegment,
} from '../src/lib/docStockage'

assert.equal(CLOUD_DOCS_ROOT, 'ClimaZEN')
assert.equal(CLOUD_DOCS_FOLDER, 'Documents')
assert.equal(slugSegment('École Saint-Jean'), 'Ecole-Saint-Jean')

const path = cheminRelatifDocument({
  kind: 'devis',
  fileName: 'devis-D001.pdf',
  year: 2026,
})
assert.equal(path, 'ClimaZEN/Documents/2026/Devis/devis-D001.pdf')

const pathClient = cheminRelatifDocument({
  kind: 'cerfa',
  fileName: 'cerfa.pdf',
  clientNom: 'ACME Clim',
})
assert.ok(pathClient.includes('Clients/ACME-Clim/CERFA/cerfa.pdf'))

assert.equal(resolveDocsStockageMode({}), 'telechargement')
assert.equal(
  resolveDocsStockageMode({ serveurPriveDocsUrl: 'https://nas.exemple.fr/docs' }),
  'prive',
)
assert.equal(
  resolveDocsStockageMode({ lienCloudDocsRacine: 'https://drive.google.com/drive/folders/x' }),
  'cloud',
)
assert.equal(
  resolveDocsStockageMode({
    docsStockageMode: 'telechargement',
    serveurPriveDocsUrl: 'https://nas.exemple.fr/docs',
  }),
  'telechargement',
)

const tree = arborescenceDocumentsEntreprise(2026)
assert.ok(tree.some((l) => l.includes('Devis')))
assert.ok(tree.some((l) => l.includes('CERFA')))
assert.ok(tree.some((l) => l.includes('Clients')))

console.log('test-doc-stockage: ok')
