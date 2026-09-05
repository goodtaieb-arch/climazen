import assert from 'node:assert/strict'
import {
  CLOUD_DOCS_FOLDER,
  CLOUD_DOCS_ROOT,
  arborescenceDocumentsEntreprise,
  cheminRelatifDocument,
  resolveDocsStockageMode,
  slugSegment,
} from '../src/lib/docStockage'
import {
  COPIE_SECOURS_RELPATH,
  isSafeDocumentRelPath,
  mergeArchive,
  peutConfigurerCoffreDocs,
  type DocumentArchive,
} from '../src/lib/documentArchive'
import { copieSecoursSheetNames, COPIE_SECOURS_SHEETS } from '../src/lib/exportSocieteExcel'
import { emptyData } from '../src/lib/storage'

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
assert.ok(tree.some((l) => l.includes('Secours')))
assert.ok(tree.some((l) => l.includes('climazen-donnees.xlsx')))

assert.equal(COPIE_SECOURS_RELPATH, 'ClimaZEN/Documents/Secours/climazen-donnees.xlsx')
assert.equal(isSafeDocumentRelPath('ClimaZEN/Documents/2026/CERFA/a.pdf'), true)
assert.equal(isSafeDocumentRelPath('../etc/passwd'), false)
assert.equal(isSafeDocumentRelPath('Documents/x.pdf'), false)
assert.equal(peutConfigurerCoffreDocs({ isOwner: true }), true)
assert.equal(peutConfigurerCoffreDocs({ userId: 'u1', personnelStockageDocsUserIds: ['u1'] }), true)
assert.equal(peutConfigurerCoffreDocs({ userId: 'u2', personnelStockageDocsUserIds: ['u1'] }), false)

const a: DocumentArchive = {
  id: '1',
  kind: 'cerfa',
  fileName: 'a.pdf',
  relPath: 'ClimaZEN/Documents/Clients/X/CERFA/a.pdf',
  interventionId: 'int1',
  createdAt: '2026-01-01T00:00:00.000Z',
}
const b: DocumentArchive = {
  ...a,
  id: '2',
  fileName: 'b.pdf',
  relPath: 'ClimaZEN/Documents/Clients/X/CERFA/b.pdf',
}
const merged = mergeArchive([a], b)
assert.equal(merged.length, 1)
assert.equal(merged[0].fileName, 'b.pdf')

const names = copieSecoursSheetNames(emptyData())
for (const s of COPIE_SECOURS_SHEETS) {
  assert.ok(names.includes(s), `feuille manquante: ${s}`)
}
assert.ok(!names.some((n) => /token|cni|signature/i.test(n)))

console.log('test-doc-stockage: ok')
