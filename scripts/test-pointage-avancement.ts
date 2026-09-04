import assert from 'node:assert/strict'
import {
  STATUT_LIVE_OT_LABELS,
  avancementTechVsPlanning,
  blocsPlanifiesDuTech,
  isoToMinutesLocal,
  labelAvancementTech,
  nowMarkerPct,
  planifieMinutes,
  statutLiveOtPourTech,
} from '../src/lib/pointageAvancement'
import { calculerJournee, type PointageEvent } from '../src/lib/pointage'
import type { OrdreTravail } from '../src/lib/ordreTravail'

const ev = (
  partial: Partial<PointageEvent> & { action: PointageEvent['action']; at: string },
): PointageEvent => ({
  id: partial.id || partial.at,
  userId: 't1',
  userName: 'Amélie',
  date: partial.at.slice(0, 10),
  createdAt: partial.at,
  ...partial,
})

assert.equal(STATUT_LIVE_OT_LABELS.en_deplacement, 'En déplacement')
assert.equal(STATUT_LIVE_OT_LABELS.planifie, 'Planifié')
assert.equal(isoToMinutesLocal(new Date(2026, 8, 3, 8, 30).toISOString()), 8 * 60 + 30)

const ots = [
  {
    id: 'ot1',
    date: '2026-09-03',
    heure: '08:00',
    dureeMinutes: 240,
    technicienUserId: 't1',
    statut: 'pret_a_planifier',
    action: 'Maintenance',
    numero: '26090301',
  },
] as unknown as OrdreTravail[]

const blocs = blocsPlanifiesDuTech(ots, { userId: 't1', date: '2026-09-03' })
assert.equal(blocs.length, 1)
assert.equal(planifieMinutes(blocs), 240)

const matin = new Date(2026, 8, 3, 7, 0, 0)
const retardNow = new Date(2026, 8, 3, 8, 30, 0)
const midi = new Date(2026, 8, 3, 13, 0, 0)

const planifie = statutLiveOtPourTech({
  otId: 'ot1',
  heure: '18:00',
  dureeMinutes: 240,
  events: [],
  userId: 't1',
  date: '2026-09-03',
  now: matin,
})
assert.equal(planifie.statut, 'planifie')

const retard = statutLiveOtPourTech({
  otId: 'ot1',
  heure: '08:00',
  dureeMinutes: 240,
  events: [],
  userId: 't1',
  date: '2026-09-03',
  now: retardNow,
})
assert.equal(retard.statut, 'en_retard')

const enRoute = statutLiveOtPourTech({
  otId: 'ot1',
  heure: '08:00',
  dureeMinutes: 240,
  events: [
    ev({
      action: 'deplacement',
      at: '2026-09-03T07:40:00.000Z',
      otId: 'ot1',
      cible: 'ot',
    }),
  ],
  userId: 't1',
  date: '2026-09-03',
  now: retardNow,
})
assert.equal(enRoute.statut, 'en_deplacement')

const events: PointageEvent[] = [
  ev({ action: 'sortie_domicile', at: '2026-09-03T07:00:00.000Z', cible: 'domicile' }),
  ev({ action: 'deplacement', at: '2026-09-03T07:20:00.000Z', otId: 'ot1', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-03T08:00:00.000Z', otId: 'ot1' }),
]
const journee = calculerJournee({
  events,
  userId: 't1',
  date: '2026-09-03',
  now: '2026-09-03T10:00:00.000Z',
})
const live = statutLiveOtPourTech({
  otId: 'ot1',
  heure: '08:00',
  dureeMinutes: 240,
  events,
  userId: 't1',
  date: '2026-09-03',
  now: midi,
  journee,
})
assert.equal(live.statut, 'en_cours')
assert.equal(live.pctRempli, 50)

const av = avancementTechVsPlanning({
  userId: 't1',
  date: '2026-09-03',
  events,
  blocs,
  now: '2026-09-03T10:00:00.000Z',
  journee,
})
assert.equal(av.planifieMin, 240)
assert.equal(av.interventionMin, 120)
assert.equal(av.pctOtFait, 50)
assert.ok(av.porteAPorteMin > 0)
assert.ok(labelAvancementTech(av).includes('Plan'))
assert.ok(labelAvancementTech(av).includes('Réel'))

assert.equal(nowMarkerPct('2026-09-03', midi), ((13 - 7) / 12) * 100)
assert.equal(nowMarkerPct('2026-09-02', midi), null)

const viaStatut = statutLiveOtPourTech({
  otId: 'ot1',
  otStatut: 'en_cours',
  heure: '08:00',
  dureeMinutes: 240,
  events: [],
  userId: 't1',
  date: '2026-09-03',
  now: midi,
})
assert.equal(viaStatut.statut, 'en_cours')

const autreOt: PointageEvent[] = [
  ev({ action: 'intervention_en_cours', at: '2026-09-03T08:00:00.000Z', otId: 'ot2' }),
]
const pasCeluiLa = statutLiveOtPourTech({
  otId: 'ot1',
  otStatut: 'en_cours',
  heure: '08:00',
  dureeMinutes: 60,
  events: autreOt,
  userId: 't1',
  date: '2026-09-03',
  now: midi,
})
assert.equal(pasCeluiLa.statut, 'planifie')

const avSansEvents = avancementTechVsPlanning({
  userId: 't1',
  date: '2026-09-03',
  events: [],
  blocs,
  now: '2026-09-03T10:00:00.000Z',
  otStatuts: ['en_cours'],
})
assert.equal(avSansEvents.statutLabel, 'En cours')
assert.equal(avSansEvents.enRetard, false)

console.log('test-pointage-avancement: ok')
