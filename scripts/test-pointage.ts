import assert from 'node:assert/strict'
import {
  POINTAGE_CNIL_NOTICE,
  actionAutorisee,
  actionsSuivantes,
  arrondirDate,
  blankPointageRegles,
  calculerJournee,
  calculerSemaine,
  csvEscape,
  exportJourneesCsv,
  formatMinutesHhMm,
  lundiIso,
  minutesEntre,
  motifsReglesIncompletes,
  parsePointageRegles,
  peutActiverPointage,
  pointageEstActif,
  pointageReglesCompletes,
  preparerActivation,
  segmentDepuisAction,
  type PointageEvent,
} from '../src/lib/pointage'

assert.ok(POINTAGE_CNIL_NOTICE.includes('Aucun suivi GPS continu'))
assert.ok(POINTAGE_CNIL_NOTICE.toLowerCase().includes('paie'))

const vide = blankPointageRegles()
assert.equal(vide.active, false)
assert.equal(pointageReglesCompletes(vide), false)
assert.ok(motifsReglesIncompletes(vide).includes('Acceptation information CNIL'))
assert.equal(peutActiverPointage(vide), false)
assert.equal(pointageEstActif(vide), false)

const refuse = preparerActivation(vide, { userId: 'owner' })
assert.equal(refuse.ok, false)

const pretes = parsePointageRegles({
  ...vide,
  cnilAcceptee: true,
  heuresJour: 7,
  heuresSemaine: 35,
})
assert.equal(pointageReglesCompletes(pretes), true)
assert.equal(pointageEstActif(pretes), false)
const act = preparerActivation(pretes, { userId: 'owner', now: '2026-09-02T08:00:00.000Z' })
assert.equal(act.ok, true)
if (act.ok) {
  assert.equal(act.regles.active, true)
  assert.equal(pointageEstActif(act.regles), true)
}

assert.deepEqual(actionsSuivantes(undefined), [
  'prise_vehicule',
  'trajet',
  'arrivee_chantier',
])
assert.equal(actionAutorisee(undefined, 'prise_vehicule'), true)
assert.equal(actionAutorisee('prise_vehicule', 'trajet'), true)
assert.equal(actionAutorisee('trajet', 'pause'), true)
assert.equal(actionAutorisee('arrivee_chantier', 'pause'), true)
assert.equal(actionAutorisee('pause', 'prise_vehicule'), false)
assert.equal(actionAutorisee('retour', 'prise_vehicule'), true)
assert.equal(segmentDepuisAction('arrivee_chantier'), 'chantier')

assert.equal(minutesEntre('2026-09-02T08:00:00.000Z', '2026-09-02T09:30:00.000Z'), 90)
assert.equal(formatMinutesHhMm(90), '1h30')
assert.equal(lundiIso('2026-09-02'), '2026-08-31')

const rounded = arrondirDate(new Date('2026-09-02T08:07:00.000Z'), 15)
assert.equal(rounded.toISOString(), '2026-09-02T08:00:00.000Z')

const ev = (partial: Partial<PointageEvent> & { action: PointageEvent['action']; at: string }): PointageEvent => ({
  id: partial.id || partial.at,
  userId: 't1',
  userName: 'Jean',
  date: partial.at.slice(0, 10),
  createdAt: partial.at,
  ...partial,
})

const dayEvents: PointageEvent[] = [
  ev({ action: 'prise_vehicule', at: '2026-09-02T06:00:00.000Z' }),
  ev({ action: 'trajet', at: '2026-09-02T06:10:00.000Z' }),
  ev({ action: 'arrivee_chantier', at: '2026-09-02T07:00:00.000Z', otId: 'ot1' }),
  ev({ action: 'pause', at: '2026-09-02T10:00:00.000Z' }),
  ev({ action: 'arrivee_chantier', at: '2026-09-02T10:30:00.000Z', otId: 'ot1' }),
  ev({ action: 'retour', at: '2026-09-02T14:00:00.000Z' }),
]

const jour = calculerJournee({
  events: dayEvents,
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(jour.ouvert, false)
assert.equal(jour.vehiculeMin, 10)
assert.equal(jour.trajetMin, 50)
assert.equal(jour.chantierMin, 180 + 210)
assert.equal(jour.pauseMin, 30)
assert.equal(jour.payeMin, 10 + 50 + 390)
assert.equal(jour.heuresSupMin, Math.max(0, jour.payeMin - 7 * 60))

const payeAvecPause = calculerJournee({
  events: dayEvents,
  userId: 't1',
  date: '2026-09-02',
  regles: { ...pretes, pauseNonPayee: false, active: true, cnilAcceptee: true },
})
assert.equal(payeAvecPause.payeMin, jour.payeMin + 30)

const auto = calculerJournee({
  events: [
    ev({ action: 'prise_vehicule', at: '2026-09-02T06:00:00.000Z' }),
    ev({ action: 'arrivee_chantier', at: '2026-09-02T07:00:00.000Z' }),
    ev({ action: 'retour', at: '2026-09-02T14:00:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: { ...pretes, pauseAutoMinutes: 30, active: true, cnilAcceptee: true },
})
assert.equal(auto.pauseMin, 0)
assert.equal(auto.pauseAutoMin, 30)
assert.equal(auto.payeMin, 60 + 420 - 30)

const csv = exportJourneesCsv([jour])
assert.ok(csv.startsWith('Date;'))
assert.ok(csv.includes('Jean'))
assert.ok(csv.includes(String(jour.payeMin)))
assert.equal(csvEscape('a;b'), '"a;b"')

const sem = calculerSemaine({
  events: dayEvents,
  userId: 't1',
  date: '2026-09-02',
  regles: { ...pretes, active: true, cnilAcceptee: true },
})
assert.equal(sem.jours.length, 7)
assert.equal(sem.payeMin, jour.payeMin)

console.log('test-pointage: ok')
