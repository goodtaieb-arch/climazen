import assert from 'node:assert/strict'
import {
  POINTAGE_CNIL_NOTICE,
  POINTAGE_HORS_INT_MENU,
  actionAutorisee,
  actionsSuivantes,
  arrondirDate,
  blankPointageRegles,
  calculerJournee,
  calculerJourneeBureau,
  calculerSemaine,
  csvEscape,
  doitAjouterPauseApresCloture,
  doitEnregistrerFinIntervention,
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
  statutOtDepuisAction,
  trajetDomicileRetenuMin,
  ventilerPauseRepas,
  repriseApresPauseRepas,
  secondesAvantAlarmePauseRepas,
  formatCompteAReboursPause,
  PAUSE_REPAS_ALARME_MIN,
  type PointageEvent,
} from '../src/lib/pointage'

assert.ok(POINTAGE_CNIL_NOTICE.includes('Aucun suivi GPS continu'))
assert.ok(POINTAGE_CNIL_NOTICE.includes('OT'))

const vide = blankPointageRegles()
assert.equal(vide.active, false)
assert.equal(vide.primePanierActive, true)
assert.equal(pointageReglesCompletes(vide), false)
assert.ok(motifsReglesIncompletes(vide).includes('Acceptation information CNIL'))
assert.equal(peutActiverPointage(vide), false)
assert.equal(pointageEstActif(vide), true)

const refuse = preparerActivation(vide, { userId: 'owner' })
assert.equal(refuse.ok, false)

const pretes = parsePointageRegles({
  ...vide,
  cnilAcceptee: true,
  heuresJour: 7,
  heuresSemaine: 35,
})
assert.equal(pointageReglesCompletes(pretes), true)
assert.equal(pointageEstActif(pretes), true)
const act = preparerActivation(pretes, { userId: 'owner', now: '2026-09-02T08:00:00.000Z' })
assert.equal(act.ok, true)
if (act.ok) {
  assert.equal(act.regles.active, true)
  assert.equal(pointageEstActif(act.regles), true)
  assert.equal(pointageEstActif({ ...act.regles, active: false }), false)
}

assert.deepEqual(actionsSuivantes(undefined), ['sortie_domicile', 'deplacement'])

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
assert.ok(actionsSuivantes(eDep).includes('intervention_en_cours'))
assert.ok(actionsSuivantes(eDep).includes('retour_domicile'))
assert.equal(actionAutorisee(eDep, 'intervention_en_cours'), true)
assert.equal(actionAutorisee(eDep, 'deplacement'), false)

const eInter = ev({ action: 'intervention_en_cours', at: '2026-09-02T08:00:00.000Z', otId: 'ot1' })
assert.ok(actionsSuivantes(eInter).includes('fin_intervention'))
assert.ok(actionsSuivantes(eInter).includes('deplacement'))
assert.ok(actionsSuivantes(eInter).includes('fournisseur'))
assert.ok(actionsSuivantes(eInter).includes('bureau'))
assert.equal(actionAutorisee(eInter, 'fin_intervention'), true)
assert.equal(actionAutorisee(eInter, 'fournisseur'), true)
assert.ok(actionsSuivantes(eInter).includes('retour_domicile'))
assert.ok(actionsSuivantes(eInter).includes('pause'))

assert.deepEqual(
  POINTAGE_HORS_INT_MENU.map((m) => m.label),
  [
    'Déplacement hors INT début de journée',
    'Bureau / atelier',
    'Fournisseur',
    'Déplacement hors INT',
    'Pause',
    'Pause repas',
    'Trajet fin',
  ],
)
assert.equal(doitAjouterPauseApresCloture(eInter, 'ot1'), true)

const eFourDuringOt = ev({ action: 'fournisseur', at: '2026-09-02T09:00:00.000Z' })
assert.ok(actionsSuivantes(eFourDuringOt).includes('intervention_en_cours'))
assert.ok(actionsSuivantes(eFourDuringOt).includes('deplacement'))

const eFinInter = ev({ action: 'fin_intervention', at: '2026-09-02T11:00:00.000Z', otId: 'ot1' })
assert.ok(actionsSuivantes(eFinInter).includes('deplacement'))
assert.ok(actionsSuivantes(eFinInter).includes('retour_domicile'))
assert.ok(actionsSuivantes(eFinInter).includes('fin_journee'))
assert.equal(doitEnregistrerFinIntervention(eInter, 'ot1'), true)
assert.equal(doitEnregistrerFinIntervention(eFinInter, 'ot1'), false)
assert.equal(doitAjouterPauseApresCloture(eFinInter, 'ot1'), false)
assert.equal(doitAjouterPauseApresCloture(eFourDuringOt, 'ot1'), false)
assert.equal(doitEnregistrerFinIntervention(eFourDuringOt, 'ot1'), true)
assert.equal(doitEnregistrerFinIntervention(undefined, 'ot1'), false)
assert.equal(
  doitEnregistrerFinIntervention(
    ev({ action: 'deplacement', at: '2026-09-02T11:10:00.000Z', otId: 'ot2', cible: 'ot' }),
    'ot1',
  ),
  false,
)
assert.equal(
  doitEnregistrerFinIntervention(
    ev({ action: 'retour_domicile', at: '2026-09-02T17:00:00.000Z', cible: 'domicile' }),
    'ot1',
  ),
  false,
)

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
assert.equal(jour.trajetMatinMin, 60)
assert.equal(jour.travailMin, 180 + 25 + 30 + 60 + 180)
assert.equal(jour.trajetRetenuMin, 30)
assert.equal(jour.abattementDomicileMin, 30)
assert.equal(jour.payeMin, jour.travailMin + jour.trajetRetenuMin)
assert.equal(jour.heuresSupMin, Math.max(0, jour.travailMin - 7 * 60))
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
assert.ok(!payeAvecPause.travailMin || payeAvecPause.payeMin === payeAvecPause.travailMin + payeAvecPause.trajetRetenuMin)

const pauseSeule = calculerJournee({
  events: [
    ev({ action: 'deplacement', at: '2026-09-02T07:00:00.000Z', otId: 'ot1', cible: 'ot' }),
    ev({ action: 'intervention_en_cours', at: '2026-09-02T07:20:00.000Z', otId: 'ot1' }),
    ev({ action: 'pause', at: '2026-09-02T10:00:00.000Z' }),
    ev({ action: 'intervention_en_cours', at: '2026-09-02T10:45:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_intervention', at: '2026-09-02T12:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'pause', at: '2026-09-02T12:00:00.000Z', note: 'Pause auto après clôture INT — non payée' }),
    ev({ action: 'fin_journee', at: '2026-09-02T13:00:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(pauseSeule.pauseMin, 45 + 60)
assert.equal(pauseSeule.travailMin, 160 + 75)
assert.equal(pauseSeule.payeMin, pauseSeule.travailMin + pauseSeule.trajetRetenuMin)

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
assert.equal(auto.trajetMatinMin, 60)
assert.equal(auto.travailMin, 360)
assert.equal(auto.trajetRetenuMin, 30)
assert.equal(auto.abattementDomicileMin, 30)
assert.equal(auto.payeMin, 360 - 30 + 30)
assert.equal(auto.heuresSupMin, 0)

const csv = exportJourneesCsv([jour])
assert.ok(csv.startsWith('Date;'))
assert.ok(csv.includes('Jean'))
assert.ok(csv.includes(String(jour.payeMin)))
assert.ok(csv.includes('Intervention OT'))
assert.equal(csvEscape('a;b'), '"a;b"')
assert.ok(csv.includes('Porte-à-porte'))

const eSortie = ev({ action: 'sortie_domicile', at: '2026-09-02T06:45:00.000Z', cible: 'domicile' })
assert.equal(actionAutorisee(undefined, 'sortie_domicile'), true)
assert.ok(actionsSuivantes(eSortie).includes('deplacement'))
assert.equal(statutOtDepuisAction('deplacement', 'ot'), 'en_deplacement')
assert.equal(statutOtDepuisAction('intervention_en_cours'), 'en_cours')
assert.equal(statutOtDepuisAction('sortie_domicile'), null)
assert.equal(segmentDepuisAction('sortie_domicile'), 'trajet_domicile')
assert.equal(segmentDepuisAction('pause_repas'), 'pause_repas')

const homeEvents: PointageEvent[] = [
  ev({ action: 'sortie_domicile', at: '2026-09-02T07:00:00.000Z', cible: 'domicile' }),
  ev({ action: 'deplacement', at: '2026-09-02T07:20:00.000Z', otId: 'ot1', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-02T08:00:00.000Z', otId: 'ot1' }),
  ev({ action: 'fin_intervention', at: '2026-09-02T12:00:00.000Z', otId: 'ot1' }),
  ev({ action: 'retour_domicile', at: '2026-09-02T12:10:00.000Z', cible: 'domicile' }),
  ev({ action: 'fin_journee', at: '2026-09-02T13:00:00.000Z' }),
]
const home = calculerJournee({
  events: homeEvents,
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(home.ouvert, false)
assert.equal(home.porteAPorteMin, 6 * 60)
assert.equal(home.trajetMatinMin, 60)
assert.equal(home.retourMin, 50)
assert.equal(home.interventionMin, 4 * 60)
assert.equal(home.travailMin, 4 * 60)
assert.equal(home.deplacementMin, 60 + 50)
assert.equal(home.abattementDomicileMin, 30 + 30)
assert.equal(home.trajetRetenuMin, 30 + 20)
assert.equal(home.payeMin, home.travailMin + home.trajetRetenuMin)
assert.equal(home.heuresSupMin, 0)
assert.ok(home.departDomicileIso?.startsWith('2026-09-02T07:00'))
assert.ok(home.retourDomicileIso?.startsWith('2026-09-02T13:00'))

const mix: PointageEvent[] = [
  ev({ action: 'sortie_domicile', at: '2026-09-02T07:00:00.000Z', cible: 'domicile' }),
  ev({ action: 'fournisseur', at: '2026-09-02T07:40:00.000Z' }),
  ev({ action: 'deplacement', at: '2026-09-02T08:10:00.000Z', otId: 'ot1', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-02T08:30:00.000Z', otId: 'ot1' }),
  ev({ action: 'fin_intervention', at: '2026-09-02T10:00:00.000Z', otId: 'ot1' }),
  ev({ action: 'deplacement', at: '2026-09-02T10:00:00.000Z', cible: 'hors_ot' }),
  ev({ action: 'fournisseur', at: '2026-09-02T10:25:00.000Z' }),
  ev({ action: 'deplacement', at: '2026-09-02T10:40:00.000Z', otId: 'ot2', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-02T11:00:00.000Z', otId: 'ot2' }),
  ev({ action: 'fin_intervention', at: '2026-09-02T12:00:00.000Z', otId: 'ot2' }),
  ev({ action: 'retour_domicile', at: '2026-09-02T12:00:00.000Z', cible: 'domicile' }),
  ev({ action: 'fin_journee', at: '2026-09-02T12:45:00.000Z' }),
]
const mixJour = calculerJournee({
  events: mix,
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(mixJour.trajetMatinMin, 40)
assert.equal(mixJour.retourMin, 45)
assert.equal(mixJour.horsOtMin, 25)
assert.equal(mixJour.abattementDomicileMin, 30 + 30)
assert.equal(mixJour.trajetRetenuMin, 10 + 15)
assert.equal(mixJour.travailMin, 30 + 20 + 90 + 25 + 15 + 20 + 60)
assert.equal(mixJour.payeMin, mixJour.travailMin + mixJour.trajetRetenuMin)
const mixCsv = exportJourneesCsv([mixJour])
assert.ok(mixCsv.includes('Déplacement hors OT'))
assert.ok(mixCsv.includes('Franchise domicile'))
assert.ok(mixCsv.includes('Travail (min)'))

const courtTrajet: PointageEvent[] = [
  ev({ action: 'deplacement', at: '2026-09-02T07:00:00.000Z', otId: 'ot1', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-02T07:15:00.000Z', otId: 'ot1' }),
  ev({ action: 'fin_intervention', at: '2026-09-02T11:15:00.000Z', otId: 'ot1' }),
  ev({ action: 'retour_domicile', at: '2026-09-02T11:15:00.000Z', cible: 'domicile' }),
  ev({ action: 'fin_journee', at: '2026-09-02T11:25:00.000Z' }),
]
const court = calculerJournee({
  events: courtTrajet,
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(court.trajetMatinMin, 15)
assert.equal(trajetDomicileRetenuMin(court.trajetMatinMin), 0)
assert.equal(court.retourMin, 10)
assert.equal(trajetDomicileRetenuMin(court.retourMin), 0)
assert.equal(court.travailMin, 4 * 60)
assert.equal(court.payeMin, 4 * 60)
assert.equal(court.heuresSupMin, 0)

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
assert.equal(bureauJour.pauseRepasMin, 0)
assert.equal(bureauJour.primePanier, false)
assert.equal(bureauJour.payeMin, 8 * 60)
assert.equal(bureauJour.deplacementMin, 0)

assert.deepEqual(ventilerPauseRepas(49), {
  repasMin: 0,
  pauseNonPayeeMin: 49,
  primePanier: false,
})
assert.deepEqual(ventilerPauseRepas(50), {
  repasMin: 50,
  pauseNonPayeeMin: 0,
  primePanier: true,
})
assert.deepEqual(ventilerPauseRepas(60), {
  repasMin: 60,
  pauseNonPayeeMin: 0,
  primePanier: true,
})
assert.deepEqual(ventilerPauseRepas(80), {
  repasMin: 60,
  pauseNonPayeeMin: 20,
  primePanier: true,
})

const repasEvents = [
  ev({ action: 'deplacement', at: '2026-09-02T07:00:00.000Z', otId: 'ot1', cible: 'ot' }),
  ev({ action: 'intervention_en_cours', at: '2026-09-02T07:30:00.000Z', otId: 'ot1' }),
  ev({ action: 'pause_repas', at: '2026-09-02T12:00:00.000Z' }),
]

const repasOk = calculerJournee({
  events: [
    ...repasEvents,
    ev({ action: 'intervention_en_cours', at: '2026-09-02T12:55:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_intervention', at: '2026-09-02T16:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_journee', at: '2026-09-02T16:05:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(repasOk.pauseRepasMin, 55)
assert.equal(repasOk.pauseMin, 0)
assert.equal(repasOk.primePanier, true)
assert.equal(repasOk.travailMin, 270 + 185)
assert.equal(repasOk.payeMin, repasOk.travailMin + repasOk.trajetRetenuMin)
assert.equal(repasOk.segments.filter((s) => s.kind === 'pause_repas').length, 1)
assert.equal(repasOk.segments.filter((s) => s.kind === 'pause').length, 0)

const repasCourt = calculerJournee({
  events: [
    ...repasEvents,
    ev({ action: 'intervention_en_cours', at: '2026-09-02T12:40:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_intervention', at: '2026-09-02T16:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_journee', at: '2026-09-02T16:05:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(repasCourt.pauseRepasMin, 0)
assert.equal(repasCourt.pauseMin, 40)
assert.equal(repasCourt.primePanier, false)
assert.equal(repasCourt.travailMin, 270 + 200)

const repasLong = calculerJournee({
  events: [
    ...repasEvents,
    ev({ action: 'intervention_en_cours', at: '2026-09-02T13:20:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_intervention', at: '2026-09-02T16:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_journee', at: '2026-09-02T16:05:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: act.ok ? act.regles : pretes,
})
assert.equal(repasLong.pauseRepasMin, 60)
assert.equal(repasLong.pauseMin, 20)
assert.equal(repasLong.primePanier, true)
assert.equal(repasLong.travailMin, 270 + 160)
assert.equal(repasLong.segments.filter((s) => s.kind === 'pause_repas')[0]?.minutes, 60)
assert.equal(repasLong.segments.filter((s) => s.kind === 'pause')[0]?.minutes, 20)

const repasSansPrime = calculerJournee({
  events: [
    ...repasEvents,
    ev({ action: 'intervention_en_cours', at: '2026-09-02T12:55:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_intervention', at: '2026-09-02T16:00:00.000Z', otId: 'ot1' }),
    ev({ action: 'fin_journee', at: '2026-09-02T16:05:00.000Z' }),
  ],
  userId: 't1',
  date: '2026-09-02',
  regles: { ...(act.ok ? act.regles : pretes), primePanierActive: false },
})
assert.equal(repasSansPrime.pauseRepasMin, 55)
assert.equal(repasSansPrime.primePanier, false)

const csvRepas = exportJourneesCsv([repasOk])
assert.ok(csvRepas.includes('Pause repas (min)'))
assert.ok(csvRepas.includes('Prime panier'))
assert.ok(csvRepas.includes('oui'))

assert.equal(PAUSE_REPAS_ALARME_MIN, 60)
assert.equal(
  secondesAvantAlarmePauseRepas('2026-09-02T12:00:00.000Z', Date.parse('2026-09-02T12:00:00.000Z')),
  3600,
)
assert.equal(
  secondesAvantAlarmePauseRepas('2026-09-02T12:00:00.000Z', Date.parse('2026-09-02T13:00:00.000Z')),
  0,
)
assert.equal(formatCompteAReboursPause(125), '2 min 05 s')

assert.deepEqual(
  repriseApresPauseRepas(
    [
      ev({ action: 'intervention_en_cours', at: '2026-09-02T10:00:00.000Z', otId: 'ot1' }),
      ev({ action: 'pause_repas', at: '2026-09-02T12:00:00.000Z' }),
    ],
    { userId: 't1', date: '2026-09-02' },
  ),
  { otId: 'ot1', chantierId: undefined },
)
assert.deepEqual(
  repriseApresPauseRepas(
    [
      ev({
        action: 'intervention_en_cours',
        at: '2026-09-02T10:00:00.000Z',
        otId: 'ot9',
        chantierId: 's9',
      }),
      ev({
        action: 'pause_repas',
        at: '2026-09-02T12:00:00.000Z',
        otId: 'ot9',
        chantierId: 's9',
      }),
    ],
    { userId: 't1', date: '2026-09-02' },
  ),
  { otId: 'ot9', chantierId: 's9' },
)
assert.equal(
  repriseApresPauseRepas(
    [ev({ action: 'pause_repas', at: '2026-09-02T12:00:00.000Z' })],
    { userId: 't1', date: '2026-09-02' },
  ),
  undefined,
)
assert.ok(actionAutorisee(ev({ action: 'pause_repas', at: '2026-09-02T12:00:00.000Z' }), 'intervention_en_cours'))

console.log('test-pointage: ok')
