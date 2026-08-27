import assert from 'node:assert/strict'
import {
  hrefDossierCloudTech,
  migratePersonnelDossiers,
  normalizeLienCloudRh,
  segmentsDossierCloudRh,
} from '../src/lib/rhDocuments'

assert.equal(normalizeLienCloudRh('javascript:alert(1)'), undefined)
assert.equal(normalizeLienCloudRh('http://drive.google.com/x'), undefined)
assert.ok(
  normalizeLienCloudRh('https://drive.google.com/drive/folders/abc')?.startsWith('https://'),
)

const perso = 'https://drive.google.com/drive/folders/tech-jean'
const racine = 'https://drive.google.com/drive/folders/societe'
assert.equal(
  hrefDossierCloudTech({
    racineCloud: racine,
    lienCloudDossier: perso,
    techName: 'Jean Dupont',
  }),
  perso,
)
assert.equal(
  hrefDossierCloudTech({
    racineCloud: racine,
    techName: 'Jean Dupont',
  }),
  racine,
)

const segs = segmentsDossierCloudRh({ techName: 'Jean / Dupont', type: 'cni' })
assert.ok(segs.includes('Jean Dupont'))
assert.ok(segs.includes('Identité'))

const migrated = migratePersonnelDossiers([
  {
    id: 'u1',
    userId: 'u1',
    userName: 'Jean',
    toucheFroid: true,
    toucheElectricite: true,
    conduitVehicule: true,
    documents: [],
    lienCloudDossier: 'javascript:bad',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
])
assert.equal(migrated[0]?.lienCloudDossier, undefined)

const ok = migratePersonnelDossiers([
  {
    id: 'u2',
    userId: 'u2',
    userName: 'Léa',
    toucheFroid: true,
    toucheElectricite: true,
    conduitVehicule: true,
    documents: [],
    lienCloudDossier: perso,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
])
assert.equal(ok[0]?.lienCloudDossier, perso)

console.log('test-rh-cloud: ok')
