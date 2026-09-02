import assert from 'node:assert/strict'
import {
  POINTAGE_CNIL_NOTICE,
  actionAutorisee,
  actionsSuivantes,
  arrondirDate,
  blankPointageRegles,
  calculerJournee,
  calculerJourneeBureau,
  calculerSemaine,
  csvEscape,
  exportJourneesCsv,
  formatMinutesHhMm,
  lundiIso,
  minutesEntre,
  motifsReglesIncompletes,
  normaliserAction,
  parsePointageRegles,
  pointageModePourUser,
  peutActiverPointage,
  pointageEstActif,
  pointageReglesCompletes,
  preparerActivation,
  segmentDepuisAction,
  type PointageEvent,
} from '../src/lib/pointage'

assert.ok(POINTAGE_CNIL_NOTICE.includes('Aucun suivi GPS continu'))
assert.ok(POINTAGE_CNIL_NOTICE.includes('OT'))

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

assert.deepEqual(actionsSuivantes(undefined), ['deplacement'])

const ev = (
  partial: Partial<PointageEvent> & { action: PointageEvent['action']; at: string },
): PointageEvent => ({
  id: partial.id || partial.at,
  userId: 't1',
  userName: 'Jean',
  date: partial.at.slice(0, 10),
  createdAt: partial.at,
  ...partial,
})

const eDep = ev({
  action: 'deplacement',
  at: '2026-09-02T07:00:00.000Z',
  otId: 'ot1',
  cible: 'ot',
})
assert.deepEqual(actionsSuivantes(eDep), ['intervention_en_cours', 'fournisseur', 'bureau'])
assert.equal(actionAutorisee(eDep, 'intervention_en_cours'), true)
assert.equal(actionAutorisee(eDep, 'deplacement'), false)

const eInter = ev({ action: 'intervention_en_cours', at: '2026-09-02T08:00:00.000Z', otId: 'ot1' })
assert.deepEqual(actionsSuivantes(eInter), ['fin_intervention', 'pause'])
assert.equal(actionAutorisee(eInter, 'fin_intervention'), true)

const eFinInter = ev({ action: 'fin_intervention', at: '2026-09-02T11:00:00.000Z', otId: 'ot1' })
assert.deepEqual(actionsSuivantes(eFinInter), [
  'deplacement',
  'fournisseur',
  'bureau',
  'fin_journee',
  'pause',
])

assert.equal(normaliserAction('trajet'), 'deplacement')
assert.equal(normaliserAction('arrivee_chantier'), 'intervention_en_cours')
assert.equal(segmentDepuisAction('intervention_en_cours'), 'intervention')
assert.equal(segmentDepuisAction('fin_intervention'), null)

assert.equal(minutesEntre('2026-09-02T08:00:00.000Z', '2026-09-02T09:30:00.000Z'), 90)
assert.equal(formatMinutesHhMm(90), '1h30')
assert.equal(lundiIso('2026-09-02'), '2026-08-31')

const rounded = arrondirDate(new Date('2026-09-02T08:07:00.000Z'), 15)
assert.equal(rounded.toISOString(), '2026-09-02T08:00:00.000Z')

/** Journée type : OT1 → fournisseur → OT2 → fin. */
const dayEvents: PointageEvent[] = [
  ev({ action: 'deplacement', at: '2026-09-02T07:00:00.000Z', otId: 'ot1', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-02T08:00:00.000Z', otId: 'ot1' }),
  ev({ action: 'fin_intervention', at: '2026-09-02T11:00:00.000Z', otId: 'ot1' }),
  ev({ action: 'deplacement', at: '2026-09-02T11:05:00.000Z', cible: 'fournisseur' }),
  ev({ action: 'fournisseur', at: '2026-09-02T11:30:00.000Z' }),
  ev({ action: 'deplacement', at: '2026-09-02T12:00:00.000Z', otId: 'ot2', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-02T13:00:00.000Z', otId: 'ot2' }),
  ev({ action: 'fin_intervention', at: '2026-09-02T16:00:00.000Z', otId: 'ot2' }),
  ev({ action: 'fin_journee', at: '2026-09-02T16:05:00.000Z' }),
]

const jour = calculerJournee({
  events: dayEvents,
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(jour.ouvert, false)
assert.equal(jour.deplacementMin, 60 + 25 + 60)
assert.equal(jour.interventionMin, 180 + 180)
assert.equal(jour.fournisseurMin, 30)
assert.equal(jour.trajetMin, jour.deplacementMin)
assert.equal(jour.chantierMin, jour.interventionMin)
assert.equal(jour.payeMin, jour.deplacementMin + jour.interventionMin + jour.fournisseurMin)
assert.equal(jour.heuresSupMin, Math.max(0, jour.payeMin - 7 * 60))
assert.equal(jour.segments.filter((s) => s.otId === 'ot1').length, 2)
assert.equal(jour.segments.filter((s) => s.otId === 'ot2').length, 2)

const payeAvecPause = calculerJournee({
  events: [
    ...dayEvents.slice(0, 3),
    ev({ action: 'pause', at: '2026-09-02T10:00:00.000Z' }),
    ev({ action: 'intervention_en_cours', at: '2026-09-02T10:30:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_intervention', at: '2026-09-02T11:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_journee', at: '2026-09-02T11:05:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: { ...pretes, pauseNonPayee: false, active: true, cnilAcceptee: true },
})
assert.equal(payeAvecPause.pauseMin, 30)

const auto = calculerJournee({
  events: [
    ev({ action: 'deplacement', at: '2026-09-02T07:00:00.000Z', otId: 'ot1', cible: 'ot' }),
    ev({ action: 'intervention_en_cours', at: '2026-09-02T08:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_intervention', at: '2026-09-02T14:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_journee', at: '2026-09-02T14:05:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: { ...pretes, pauseAutoMinutes: 30, active: true, cnilAcceptee: true },
})
assert.equal(auto.pauseMin, 0)
assert.equal(auto.pauseAutoMin, 30)
assert.equal(auto.payeMin, 60 + 360 - 30)

const csv = exportJourneesCsv([jour])
assert.ok(csv.startsWith('Date;'))
assert.ok(csv.includes('Jean'))
assert.ok(csv.includes(String(jour.payeMin)))
assert.ok(csv.includes('Intervention OT'))
assert.equal(csvEscape('a;b'), '"a;b"')

const sem = calculerSemaine({
  events: dayEvents,
  userId: 't1',
  date: '2026-09-02',
  regles: { ...pretes, active: true, cnilAcceptee: true },
})
assert.equal(sem.jours.length, 7)
assert.equal(sem.payeMin, jour.payeMin)

assert.equal(pointageModePourUser({ poste: 'secretaire' }), 'bureau')
assert.equal(pointageModePourUser({ poste: 'tech_cvc' }), 'terrain')
assert.equal(pointageModePourUser({ peutVoirIdentitesRh: true }), 'bureau')
assert.equal(pointageModePourUser({}), 'terrain')

const bureauJour = calculerJourneeBureau(
  {
    id: 'b1',
    userId: 's1',
    userName: 'Alice',
    date: '2026-09-02',
    heureDebut: '08:00',
    heureFin: '17:00',
    heurePauseDebut: '12:00',
    heurePauseFin: '13:00',
    updatedAt: '2026-09-02T17:00:00.000Z',
  },
  pretes,
)
assert.equal(bureauJour.bureauMin, 8 * 60)
assert.equal(bureauJour.pauseMin, 60)
assert.equal(bureauJour.payeMin, 8 * 60)
assert.equal(bureauJour.deplacementMin, 0)

console.log('test-pointage: ok')
