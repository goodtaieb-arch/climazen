import assert from 'node:assert/strict'
import {
  buildSiteQrPayload,
  buildSiteQrShort,
  findSiteById,
  parseSiteQrPayload,
  siteEquipementCount,
  siteQrPrintLines,
} from '../src/lib/siteQr'
import { parseEquipQrPayload } from '../src/lib/equipementQr'
import type { AppData, Client, Site } from '../src/lib/types'

const SITE_ID = '11111111-1111-4111-8111-111111111111'
const EQ_ID = '22222222-2222-4222-8222-222222222222'
const CLIENT_ID = '33333333-3333-4333-8333-333333333333'

assert.equal(
  buildSiteQrPayload(SITE_ID, 'https://climazen.fr'),
  `https://climazen.fr/app/scan-equip?site=${SITE_ID}`,
)
assert.equal(buildSiteQrShort(SITE_ID), `CZ-SITE|${SITE_ID}`)

assert.equal(
  parseSiteQrPayload(`https://climazen.fr/app/scan-equip?site=${SITE_ID}`),
  SITE_ID,
)
assert.equal(parseSiteQrPayload(`/app/scan-equip?site=${SITE_ID}`), SITE_ID)
assert.equal(parseSiteQrPayload(`/app/scan-equip?chantier=${SITE_ID}`), SITE_ID)
assert.equal(parseSiteQrPayload(`CZ-SITE|${SITE_ID}`), SITE_ID)
assert.equal(parseSiteQrPayload(`CZ-SITE:${SITE_ID}`), SITE_ID)
assert.equal(parseSiteQrPayload(`CZ-CH|${SITE_ID}`), SITE_ID)
assert.equal(parseSiteQrPayload(`climazen:site:${SITE_ID}`), SITE_ID)
assert.equal(parseSiteQrPayload(`climazen://site/${SITE_ID}`), SITE_ID)

// Ne pas prendre un QR équipement pour un site
assert.equal(parseSiteQrPayload(`https://climazen.fr/app/scan-equip?eq=${EQ_ID}`), null)
assert.equal(
  parseSiteQrPayload(`https://climazen.fr/app/scan-equip?site=${SITE_ID}&eq=${EQ_ID}`),
  null,
)
assert.equal(parseSiteQrPayload(`CZ-EQ|${EQ_ID}`), null)
assert.equal(parseSiteQrPayload(SITE_ID), null)
assert.equal(parseSiteQrPayload(''), null)

// L’équipement reste reconnu, le site URL ne vole pas l’id machine
assert.equal(
  parseEquipQrPayload(`https://climazen.fr/app/scan-equip?eq=${EQ_ID}`),
  EQ_ID,
)
assert.equal(parseEquipQrPayload(`CZ-EQ|${EQ_ID}`), EQ_ID)
assert.equal(parseEquipQrPayload(`https://climazen.fr/app/scan-equip?site=${SITE_ID}`), null)

const client: Client = {
  id: CLIENT_ID,
  typeClient: 'entreprise',
  raisonSociale: 'Syndic Azur',
  nom: '',
  prenom: '',
  nomContact: 'M. Martin',
  telephone: '',
  email: '',
  adresse: '',
  codePostal: '',
  ville: '',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const site: Site = {
  id: SITE_ID,
  clientId: CLIENT_ID,
  nom: 'Résidence Les Pins',
  adresse: '12 rue de la Mer',
  codePostal: '06400',
  ville: 'Cannes',
  statut: 'actif',
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  equipementType: '',
  equipementMarque: '',
  equipementModele: '',
  equipementNumeroSerie: '',
  fluideType: '',
  chargeNominaleKg: 0,
  detectionPermanente: false,
  avecFluideFrigorigene: false,
  equipements: [
    {
      id: EQ_ID,
      nom: 'PAC toiture',
      type: 'PAC',
      marque: 'Daikin',
      modele: 'VRV',
      numeroSerie: 'SN1',
      avecFluideFrigorigene: true,
      fluideType: 'R-32',
      chargeNominaleKg: 2,
      detectionPermanente: false,
    },
  ],
}

const data = {
  clients: [client],
  chantiers: [site],
} as AppData

const hit = findSiteById(data, SITE_ID)
assert.ok(hit)
assert.equal(hit?.site.nom, 'Résidence Les Pins')
assert.equal(hit?.client?.raisonSociale, 'Syndic Azur')
assert.equal(siteEquipementCount(hit!), 1)
assert.equal(findSiteById(data, EQ_ID), null)

const printed = siteQrPrintLines(hit!)
assert.equal(printed.title, 'Résidence Les Pins')
assert.ok(printed.lines.includes('Syndic Azur'))
assert.ok(printed.lines.some((l) => l.includes('Cannes')))
assert.ok(printed.lines.includes('QR du bâtiment'))

console.log('ok test-site-qr')
