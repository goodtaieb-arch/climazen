import assert from 'node:assert/strict'
import {
  hrefDossierCloudTech,
  migratePersonnelDossiers,
  normalizeLienCloudRh,
  segmentsDossierCloudRh,
} from '../src/lib/rhDocuments'
import {
  classifyCloudLink,
  extractGoogleDriveId,
  localCloudLinkCheck,
} from '../src/lib/cloudLinkGuard'

assert.equal(normalizeLienCloudRh('javascript:alert(1)'), undefined)
assert.equal(normalizeLienCloudRh('http://drive.google.com/x'), undefined)
assert.ok(
  normalizeLienCloudRh('https://drive.google.com/drive/folders/abc1234567')?.startsWith('https://'),
)

const perso = 'https://drive.google.com/drive/folders/techjean01'
const racine = 'https://drive.google.com/drive/folders/societe01'
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
  undefined,
)

const segs = segmentsDossierCloudRh({ techName: 'Jean / Dupont', type: 'cni' })
assert.ok(segs.includes('Jean Dupont'))
assert.ok(segs.includes('Identité'))

assert.equal(classifyCloudLink('https://1drv.ms/f/s!abc'), 'public')
assert.equal(
  classifyCloudLink('https://contoso-my.sharepoint.com/:f:/g/personal/a/xyz?e=TOKEN'),
  'public',
)
assert.equal(
  classifyCloudLink('https://drive.google.com/drive/folders/ABCDEFGHIJK123'),
  'needs_probe',
)
assert.equal(classifyCloudLink('javascript:alert(1)'), 'invalid')
assert.equal(localCloudLinkCheck('https://1drv.ms/f/s!abc')?.error, 'public')
assert.equal(
  extractGoogleDriveId('https://drive.google.com/drive/folders/AbCdEfGhIjK1234567'),
  'AbCdEfGhIjK1234567',
)

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
