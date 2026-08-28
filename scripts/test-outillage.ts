import assert from 'node:assert/strict'
import { groupOutillagesByType } from '../src/lib/outillage'
import { OUTILLAGE_CATALOG } from '../src/lib/outillageCatalog'
import { mergeTeamMembers } from '../src/lib/teamMembers'
import {
  grouperMaterielParFamille,
  materielConfiePourUser,
  materielEnAttenteReception,
  receptionPreserved,
} from '../src/lib/attributionMateriel'
import { blankEtatLieux, documentsEcart, erreurEtatLieux } from '../src/lib/voitures'
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
assert.equal(Boolean(OUTILLAGE_CATALOG.pompe_vide.needsControleDate), false)
assert.equal(Boolean(OUTILLAGE_CATALOG.epi_securite.needsControleDate), false)

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
  ],
}

const confie = materielConfiePourUser(data, 't1')
assert.equal(confie.length, 3)
const familles = grouperMaterielParFamille(confie).map((g) => g.famille)
assert.ok(familles.includes('Véhicule'))
assert.ok(familles.includes('Détecteur de fuite électronique'))
assert.ok(familles.includes('EPI (lunettes, gants, masque)'))
assert.equal(familles.filter((f) => f === 'EPI (lunettes, gants, masque)').length, 1)

const pending = materielEnAttenteReception(data, 't1')
assert.equal(pending.length, 2)
assert.ok(pending.some((p) => p.kind === 'voiture'))
assert.ok(pending.some((p) => p.kind === 'outillage' && p.itemId === '1'))
assert.equal(pending.some((p) => p.itemId === '3'), false)

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

console.log('test-outillage: ok')
