import assert from 'node:assert/strict'
import {
  hrefDossierCloudTech,
  migratePersonnelDossiers,
  normalizeLienCloudRh,
  segmentsDossierCloudRh,
} from '../src/lib/rhDocuments'
import {
  classifyCloudLink,
  cloudAlertMessage,
  cloudKindFromUrl,
  cloudPasteHint,
  collectCloudKinds,
  extractGoogleDriveId,
  localCloudLinkCheck,
  orderedCloudSetupSteps,
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
assert.match(localCloudLinkCheck('https://1drv.ms/f/s!abc')?.message || '', /OneDrive/)
assert.match(
  localCloudLinkCheck('https://contoso-my.sharepoint.com/:f:/g/personal/a/xyz?e=TOKEN')
    ?.message || '',
  /SharePoint/,
)
assert.match(
  localCloudLinkCheck('https://drive.google.com/uc?id=ABCDEFGHIJ123')?.message || '',
  /Google Drive/,
)
assert.equal(cloudKindFromUrl('https://drive.google.com/drive/folders/abc'), 'drive')
assert.equal(cloudKindFromUrl('https://onedrive.live.com/?cid=x'), 'onedrive')
assert.equal(cloudKindFromUrl('https://contoso.sharepoint.com/sites/rh'), 'sharepoint')
assert.match(cloudPasteHint('https://drive.google.com/drive/folders/x'), /Google Drive/)
assert.match(cloudPasteHint('https://onedrive.live.com/redir'), /OneDrive/)
assert.match(cloudPasteHint('https://contoso.sharepoint.com/sites/x'), /SharePoint/)
assert.match(cloudAlertMessage('drive', 'public'), /Google Drive/)
assert.match(cloudAlertMessage('onedrive', 'public'), /OneDrive/)
assert.match(cloudAlertMessage('sharepoint', 'public'), /SharePoint/)
assert.equal(cloudAlertMessage('onedrive', 'public').includes('Google Drive'), false)
assert.equal(cloudAlertMessage('drive', 'public').includes('OneDrive'), false)
assert.match(cloudAlertMessage('drive', 'unverifiable'), /Restreint/)
assert.match(cloudAlertMessage('onedrive', 'unverifiable'), /Personnes spécifiques/)
assert.match(cloudAlertMessage('sharepoint', 'unverifiable'), /Tout le monde/)
assert.deepEqual(
  collectCloudKinds(['https://onedrive.live.com/?cid=x', 'https://example.com']),
  ['onedrive'],
)
assert.equal(orderedCloudSetupSteps(['onedrive'])[0]?.kind, 'onedrive')
assert.equal(orderedCloudSetupSteps(['sharepoint'])[0]?.title, 'SharePoint')
assert.equal(orderedCloudSetupSteps()[0]?.kind, 'drive')
assert.ok(orderedCloudSetupSteps()[0]?.body.includes('Restreint'))
assert.ok(orderedCloudSetupSteps()[1]?.body.includes('Personnes spécifiques'))
assert.ok(orderedCloudSetupSteps()[2]?.body.includes('Tout le monde'))
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
