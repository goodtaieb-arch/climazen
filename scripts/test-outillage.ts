import assert from 'node:assert/strict'
import { groupOutillagesByType } from '../src/lib/outillage'
import { OUTILLAGE_CATALOG, filterOutillageCatalog, foldOutillageSearch } from '../src/lib/outillageCatalog'
import {
  ALERTE_ETALONNAGE_JOURS,
  alertesEtalonnage,
  dateFinEtalonnage,
  statutEtalonnage,
} from '../src/lib/outillageEtalonnage'
import { mergeTeamMembers } from '../src/lib/teamMembers'
import {
  grouperMaterielParFamille,
  materielConfiePourUser,
  materielEnAttenteReception,
  operateursEnAttenteReception,
  receptionPreserved,
} from '../src/lib/attributionMateriel'
import { blankEtatLieux, documentsEcart, erreurEtatLieux } from '../src/lib/voitures'
import { cycleMarqueZone, resumeMarquesCarrosserie } from '../src/lib/voitureConstat'
import type { AppData, Outillage, Voiture } from '../src/lib/types'

const items: Outillage[] = [
  {
    id: '1',
    type: 'detecteur_fuite',
    identification: 'det 123',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    type: 'detecteur_fuite',
    identification: 'des 124',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '3',
    type: 'epi_securite',
    identification: 'app-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]
const groups = groupOutillagesByType(items)
assert.equal(groups.length, 2)
assert.equal(groups[0]?.type, 'detecteur_fuite')
assert.equal(groups[0]?.items.length, 2)
assert.equal(groups[1]?.type, 'epi_securite')
assert.equal(Boolean(OUTILLAGE_CATALOG.detecteur_fuite.needsControleDate), true)
assert.equal(Boolean(OUTILLAGE_CATALOG.balance_pesee.needsControleDate), true)
assert.equal(Boolean(OUTILLAGE_CATALOG.groupe_manometrique.needsControleDate), true)
assert.equal(Boolean(OUTILLAGE_CATALOG.camera_thermique.needsControleDate), true)
assert.equal(Boolean(OUTILLAGE_CATALOG.analyseur_combustion.needsControleDate), true)
assert.equal(Boolean(OUTILLAGE_CATALOG.anemometre.needsControleDate), true)
assert.equal(Boolean(OUTILLAGE_CATALOG.pompe_vide.needsControleDate), false)
assert.equal(Boolean(OUTILLAGE_CATALOG.epi_securite.needsControleDate), false)
assert.ok(OUTILLAGE_CATALOG.analyseur_combustion.label.toLowerCase().includes('combustion'))
assert.ok(OUTILLAGE_CATALOG.camera_thermique.label.toLowerCase().includes('thermique'))
assert.equal(foldOutillageSearch('Étalonnage'), 'etalonnage')
assert.ok(filterOutillageCatalog('cam').some((t) => t.id === 'camera_thermique'))
assert.ok(filterOutillageCatalog('combu').some((t) => t.id === 'analyseur_combustion'))
assert.ok(filterOutillageCatalog('pompe').some((t) => t.id === 'pompe_vide'))
assert.equal(filterOutillageCatalog('zzzzinexistant').length, 0)

const team = mergeTeamMembers({
  user: {
    id: 'owner',
    email: 'a@x.fr',
    username: 'a@x.fr',
    fullName: 'taieb',
    createdAt: '',
    organizationId: 'org',
    role: 'owner',
    active: true,
  },
  remote: [
    {
      id: 't1',
      email: 't1@x.fr',
      username: 't1@x.fr',
      fullName: 'Tech 1',
      createdAt: '',
      organizationId: 'org',
      role: 'operateur',
      active: true,
    },
    {
      id: 't2',
      email: 't2@x.fr',
      username: 't2@x.fr',
      fullName: 'Tech 2',
      createdAt: '',
      organizationId: 'org',
      role: 'operateur',
      active: false,
    },
    {
      id: 't3',
      email: 't3@x.fr',
      username: 't3@x.fr',
      fullName: 'Tech 3',
      createdAt: '',
      organizationId: 'org',
      role: 'operateur',
      active: true,
    },
  ],
  orgId: 'org',
})
assert.equal(team.length, 4)
assert.ok(team.some((m) => m.id === 't2' && m.active === false))

const retired = mergeTeamMembers({
  remote: team,
  retiredIds: ['t2'],
  orgId: 'org',
})
assert.equal(retired.length, 3)
assert.equal(retired.some((m) => m.id === 't2'), false)

assert.equal(OUTILLAGE_CATALOG.telephone_pro.label.includes('Téléphone'), true)

const preserved = receptionPreserved(
  { assigneeUserId: 't1', receptionAt: '2026-01-01', receptionParUserId: 't1' },
  't1',
)
assert.equal(preserved.receptionAt, '2026-01-01')
const cleared = receptionPreserved(
  { assigneeUserId: 't1', receptionAt: '2026-01-01', receptionParUserId: 't1' },
  't2',
)
assert.equal(cleared.receptionAt, undefined)

const data: AppData = {
  operateur: {
    id: 'op',
    raisonSociale: 'Clima',
    adresse: '',
    siret: '',
    attestationNumero: '',
    telephone: '',
    email: '',
  },
  clients: [],
  chantiers: [],
  stock: [],
  stockMouvements: [],
  interventions: [],
  voitures: [
    {
      id: 'v1',
      matricule: 'AB-123-CD',
      marque: 'Renault',
      modele: 'Kangoo',
      assigneeUserId: 't1',
      assigneeName: 'Tech 1',
      documentsFournis: ['carte_grise', 'double_cles'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  outillages: [
    {
      id: '1',
      type: 'detecteur_fuite',
      identification: 'det 123',
      assigneeUserId: 't1',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '3',
      type: 'epi_securite',
      identification: 'app-1',
      assigneeUserId: 't1',
      receptionAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '4',
      type: 'telephone_pro',
      identification: '06 11 22 33 44',
      assigneeUserId: 't1',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
}

const confie = materielConfiePourUser(data, 't1')
assert.equal(confie.length, 4)
const familles = grouperMaterielParFamille(confie).map((g) => g.famille)
assert.equal(familles[0], 'Véhicule')
assert.equal(familles[1], 'Téléphone professionnel')
assert.ok(familles.includes('Détecteur de fuite électronique'))
assert.ok(familles.includes('EPI (lunettes, gants, masque)'))
assert.equal(familles.filter((f) => f === 'EPI (lunettes, gants, masque)').length, 1)

const pending = materielEnAttenteReception(data, 't1')
assert.equal(pending.length, 3)
assert.ok(pending.some((p) => p.kind === 'voiture'))
assert.ok(pending.some((p) => p.kind === 'outillage' && p.itemId === '1'))
assert.ok(pending.some((p) => p.itemId === '4'))
assert.equal(pending.some((p) => p.itemId === '3'), false)

const opsAttente = operateursEnAttenteReception(data)
assert.equal(opsAttente.length, 1)
assert.equal(opsAttente[0]?.userId, 't1')
assert.equal(opsAttente[0]?.n, 3)

assert.ok(erreurEtatLieux(blankEtatLieux(['carte_grise'])))
assert.equal(
  erreurEtatLieux({
    date: '2026-08-28',
    kilometrage: 42000,
    carburant: 'moitie',
    carrosserie: 'usure_normale',
    interieur: 'bon',
    pneus: 'bon',
    documentsRecus: ['carte_grise'],
  }),
  null,
)

const ecart = documentsEcart(['carte_grise', 'double_cles'], ['carte_grise'])
assert.deepEqual(ecart.manquants, ['double_cles'])
assert.deepEqual(ecart.extra, [])

const v = data.voitures?.[0] as Voiture
assert.equal(v.documentsFournis?.includes('carte_grise'), true)

let marques = cycleMarqueZone([], 'capot')
assert.equal(marques[0]?.type, 'rayure')
marques = cycleMarqueZone(marques, 'capot')
assert.equal(marques[0]?.type, 'bosse')
marques = cycleMarqueZone(marques, 'capot')
assert.equal(marques.length, 0)
marques = cycleMarqueZone([{ zone: 'toit', type: 'bosse' }], 'parechoc_av')
assert.equal(marques.length, 2)
assert.equal(resumeMarquesCarrosserie(marques), '1 bosse, 1 rayure')

assert.equal(dateFinEtalonnage('2025-08-30'), '2026-08-30')
assert.equal(statutEtalonnage('2024-01-01', new Date('2026-08-30T12:00:00')), 'expire')
assert.equal(statutEtalonnage('', new Date('2026-08-30T12:00:00')), 'sans_date')
assert.equal(statutEtalonnage('2025-09-15', new Date('2026-08-20T12:00:00')), 'bientot')
assert.equal(statutEtalonnage('2026-01-01', new Date('2026-08-20T12:00:00')), 'ok')
assert.ok(ALERTE_ETALONNAGE_JOURS === 45)

const etalAlerts = alertesEtalonnage(
  [
    {
      id: 'cam1',
      type: 'camera_thermique',
      identification: 'FLIR-1',
      controleDate: '2024-01-01',
      assigneeUserId: 't1',
      assigneeName: 'Tech 1',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'pompe1',
      type: 'pompe_vide',
      identification: 'PV-1',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  { now: new Date('2026-08-30T12:00:00') },
)
assert.equal(etalAlerts.length, 1)
assert.equal(etalAlerts[0]?.outillageId, 'cam1')
assert.equal(etalAlerts[0]?.statut, 'expire')

console.log('test-outillage: ok')
