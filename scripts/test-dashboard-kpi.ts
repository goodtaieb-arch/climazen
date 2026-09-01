import assert from 'node:assert/strict'
import { blankOrdreTravail, type OrdreTravail } from '../src/lib/ordreTravail'
import {
  bucketOt,
  computeDashboardKpi,
  pct,
  preventifCuratifConic,
} from '../src/lib/dashboardKpi'
import type { AppData } from '../src/lib/types'
import type { AgendaEvent } from '../src/lib/agenda'
import type { ContratMaintenance } from '../src/lib/contratMaintenance'

const TODAY = '2026-09-01'

function ot(partial: Partial<OrdreTravail> & Pick<OrdreTravail, 'id'>): OrdreTravail {
  return {
    ...blankOrdreTravail(),
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

function data(partial: Partial<AppData> = {}): AppData {
  return {
    operateur: { raisonSociale: 'Test', adresse: '', codePostal: '', ville: '', telephone: '', email: '', siret: '', attestationCapacite: '' },
    clients: [],
    chantiers: [],
    stock: [],
    stockMouvements: [],
    interventions: [],
    ...partial,
  } as AppData
}

assert.equal(bucketOt(ot({ id: '1', typeOt: 'depanage' })), 'curatif')
assert.equal(bucketOt(ot({ id: '2', typeOt: 'maintenance' })), 'preventif')
assert.equal(bucketOt(ot({ id: '3', typeOt: 'entretien' })), 'preventif')
assert.equal(bucketOt(ot({ id: '4', typeOt: 'controle_etancheite' })), 'preventif')
assert.equal(
  bucketOt(ot({ id: '5', typeOt: 'depanage', contratId: 'c1', origineOt: 'maintenance_contrat' })),
  'preventif',
)
assert.equal(bucketOt(ot({ id: '6', typeOt: 'installation' })), 'autre')
assert.equal(pct(1, 4), 25)
assert.equal(pct(0, 0), 0)

const mix = computeDashboardKpi({
  today: TODAY,
  isOwner: true,
  data: data({
    ordresTravail: [
      ot({ id: 'p1', typeOt: 'maintenance', statut: 'signe', date: '2026-08-20' }),
      ot({ id: 'p2', typeOt: 'entretien', statut: 'termine', date: '2026-08-25' }),
      ot({
        id: 'c1',
        typeOt: 'depanage',
        statut: 'en_cours',
        date: '2026-08-10',
        technicien: 'Luc',
        technicienUserId: 'tech-luc',
      }),
      ot({ id: 'i1', typeOt: 'installation', statut: 'signe', date: '2026-08-28' }),
    ],
  }),
})
assert.equal(mix.preventif, 2)
assert.equal(mix.curatif, 1)
assert.equal(mix.autre, 1)
assert.equal(mix.preventifPct, 67)
assert.equal(mix.otOuverts, 1)
assert.equal(mix.otEnRetard, 1)
assert.equal(mix.otCloturesMois, 0)
assert.ok(mix.visitesFait30j >= 2)
assert.equal(mix.chargeParTech[0]?.name, 'Luc')
assert.equal(mix.chargeParTech[0]?.ouverts, 1)
assert.equal(mix.weeks.length, 8)
assert.ok(mix.weeks.reduce((s, w) => s + w.total, 0) >= 4)

const weekOfClosed = mix.weeks.find((w) => w.preventif > 0)
assert.ok(weekOfClosed)

const agendaRetard: AgendaEvent = {
  id: 'ag1',
  title: 'Maintenance contrat',
  date: '2026-08-01',
  type: 'maintenance',
  contratId: 'ct1',
  statut: 'a_faire',
  createdAt: '',
  updatedAt: '',
}
const agendaDue: AgendaEvent = {
  id: 'ag2',
  title: 'Visite J-20',
  date: '2026-09-20',
  type: 'rappel_appel',
  contratId: 'ct1',
  statut: 'a_faire',
  createdAt: '',
  updatedAt: '',
}
const ownerAgenda = computeDashboardKpi({
  today: TODAY,
  isOwner: true,
  data: data({ agendaEvents: [agendaRetard, agendaDue] }),
})
assert.equal(ownerAgenda.visitesRetard, 1)
assert.equal(ownerAgenda.visitesDue30j, 1)

const techAgenda = computeDashboardKpi({
  today: TODAY,
  isOwner: false,
  userId: 'tech-luc',
  data: data({
    agendaEvents: [agendaRetard, agendaDue],
    ordresTravail: [
      ot({
        id: 'c1',
        typeOt: 'depanage',
        statut: 'en_cours',
        date: TODAY,
        technicienUserId: 'tech-luc',
      }),
      ot({
        id: 'other',
        typeOt: 'maintenance',
        statut: 'en_cours',
        date: TODAY,
        technicienUserId: 'autre',
      }),
    ],
  }),
})
assert.equal(techAgenda.scope, 'moi')
assert.equal(techAgenda.curatif, 1)
assert.equal(techAgenda.preventif, 0)
assert.equal(techAgenda.otOuverts, 1)
assert.equal(techAgenda.visitesRetard, 0)
assert.equal(techAgenda.chargeParTech.length, 0)

const contrats = computeDashboardKpi({
  today: TODAY,
  isOwner: true,
  data: data({
    contratsMaintenance: [
      { id: 'ct1', statut: 'signe', dateFin: '2027-01-01' } as ContratMaintenance,
      { id: 'ct2', statut: 'brouillon' } as ContratMaintenance,
    ],
    chantiers: [
      {
        id: 's1',
        statut: 'actif',
        modeGestion: 'contrat',
        nom: 'A',
        clientId: 'x',
        adresse: '',
        codePostal: '',
        ville: '',
        equipementType: '',
        equipementMarque: '',
        equipementModele: '',
        equipementNumeroSerie: '',
        fluideType: '',
        chargeNominaleKg: 0,
        detectionPermanente: false,
        createdAt: '',
      },
    ],
  }),
})
assert.equal(contrats.contratsActifs, 1)
assert.equal(contrats.sitesSousContrat, 1)

assert.ok(preventifCuratifConic({ preventifPct: 40, curatifPct: 60 }).includes('40%'))
assert.ok(preventifCuratifConic({ preventifPct: 0, curatifPct: 0 }).includes('#d7e4e7'))

const clotureMois = computeDashboardKpi({
  today: TODAY,
  isOwner: true,
  data: data({
    ordresTravail: [
      ot({ id: 'm1', typeOt: 'depanage', statut: 'signe', date: '2026-09-01' }),
      ot({ id: 'm2', typeOt: 'depanage', statut: 'signe', date: '2026-08-31' }),
    ],
  }),
})
assert.equal(clotureMois.otCloturesMois, 1)
assert.equal(clotureMois.otCloturesSemaine, 2)

console.log('ok test-dashboard-kpi')
