import assert from 'node:assert/strict'
import {
  COULEUR_NON_AFFECTE,
  HORS_OT_BUREAU,
  HORS_OT_TECH,
  couleurPlanning,
  couleurSecteurTech,
  dateDansSemaine,
  dureeMinutesEffectif,
  dureeMinutesOt,
  estPourTech,
  heuresFriseJour,
  isHorsOtType,
  labelDureeMinutes,
  otSansCreneau,
  parseHeureToMinutes,
  premiereHeureLibre,
  techsLignesJour,
  timelinePlacement,
  titreDefautHorsOt,
  typesAgendaPourSaisie,
  visibleAgendaPour,
  indisposTechSurDate,
  techEstIndispo,
  premierTechIndispo,
  labelIndispoCourte,
} from '../src/lib/agendaPlanning'
import { AGENDA_TYPE_LABELS, agendaCouvreDate, isIndispoType } from '../src/lib/agenda'
import { syncTechsOt, techIdsOt } from '../src/lib/ordreTravail'

assert.equal(isHorsOtType('pause_repas'), true)
assert.equal(isHorsOtType('rdv'), false)
assert.equal(HORS_OT_TECH.includes('fournisseur'), true)
assert.equal(HORS_OT_BUREAU.includes('formation'), true)
assert.equal(HORS_OT_BUREAU.includes('hors_ot_libre'), true)
assert.equal(titreDefautHorsOt('pause_repas'), 'Pause repas')
assert.equal(titreDefautHorsOt('hors_ot_libre'), '')
assert.equal(AGENDA_TYPE_LABELS.rdv_garage, 'RDV garage')

assert.equal(otSansCreneau({ statut: 'en_cours', heure: undefined }), true)
assert.equal(otSansCreneau({ statut: 'en_cours', heure: '08:30' }), false)
assert.equal(otSansCreneau({ statut: 'signe', heure: undefined }), false)

assert.equal(estPourTech({ technicienUserId: 't1' }, 't1'), true)
assert.equal(estPourTech({ createdByUserId: 't1' }, 't1'), true)
assert.equal(estPourTech({ technicienUserId: 't2' }, 't1'), false)
assert.equal(
  estPourTech({ technicienUserId: 't1', technicienUserIds: ['t1', 't2'] }, 't2'),
  true,
)
assert.equal(
  visibleAgendaPour(
    { bureau: false, userId: 't2' },
    { technicienUserIds: ['t1', 't2'] },
  ),
  true,
)
assert.equal(
  visibleAgendaPour(
    { bureau: true, filterTechId: 't2' },
    { technicienUserId: 't1', technicienUserIds: ['t1', 't2'] },
  ),
  true,
)

assert.equal(
  visibleAgendaPour({ bureau: false, userId: 't1' }, { technicienUserId: 't1' }),
  true,
)
assert.equal(
  visibleAgendaPour({ bureau: false, userId: 't1' }, { technicienUserId: 't2' }),
  false,
)
assert.equal(
  visibleAgendaPour({ bureau: true, filterTechId: 'tous' }, { technicienUserId: 't2' }),
  true,
)
assert.equal(
  visibleAgendaPour({ bureau: true, filterTechId: 't2' }, { technicienUserId: 't2' }),
  true,
)
assert.equal(
  visibleAgendaPour({ bureau: true, filterTechId: 't2' }, { technicienUserId: 't1' }),
  false,
)

const a = couleurSecteurTech('tech-alpha')
const b = couleurSecteurTech('tech-beta')
const a2 = couleurSecteurTech('tech-alpha')
assert.equal(a.key, a2.key)
assert.equal(couleurSecteurTech('').key, COULEUR_NON_AFFECTE.key)
assert.ok(a.key)
assert.notEqual(couleurPlanning({ horsOtType: 'pause_repas' }).key, a.key)
assert.equal(couleurPlanning({ horsOtType: 'formation' }).key, 'form')
assert.equal(couleurPlanning({ technicienUserId: 'tech-alpha' }).key, a.key)
assert.equal(couleurPlanning({ secteur: 'tech_cvc' }).key, 'cvc')
assert.equal(couleurPlanning({ secteur: 'tech_frigoriste' }).key, 'frigo')
assert.equal(couleurPlanning({ secteur: 'plombier' }).key, 'plomb')
assert.equal(couleurPlanning({ secteur: 'electricien' }).key, 'elec')
assert.notEqual(
  couleurPlanning({ secteur: 'tech_cvc' }).key,
  couleurPlanning({ secteur: 'tech_frigoriste' }).key,
)
assert.equal(
  couleurPlanning({ secteur: 'tech_cvc', technicienUserId: 'tech-alpha' }).key,
  'cvc',
)

assert.equal(dateDansSemaine('2026-09-01', ['2026-08-31', '2026-09-01']), true)
assert.equal(dateDansSemaine(undefined, ['2026-09-01']), true)
assert.equal(dateDansSemaine('2026-09-10', ['2026-09-01']), false)

const postes: Record<string, string | undefined> = {
  t1: 'tech_cvc',
  t2: 'tech_frigoriste',
  sec: 'secretaire',
}
const lignes = techsLignesJour({
  team: [
    { id: 't1', role: 'operateur' },
    { id: 't2', role: 'operateur' },
    { id: 'sec', role: 'operateur' },
  ],
  posteOf: (id) => postes[id],
  taskTechIds: ['t1'],
})
assert.deepEqual(lignes, ['t1', 't2'])
assert.deepEqual(
  techsLignesJour({
    team: [
      { id: 't1', role: 'operateur' },
      { id: 't2', role: 'operateur' },
    ],
    posteOf: (id) => postes[id],
    taskTechIds: [],
    filterSecteur: 'tech_cvc',
  }),
  ['t1'],
)
assert.deepEqual(
  techsLignesJour({
    team: [
      { id: 't1', role: 'operateur' },
      { id: 't2', role: 'operateur' },
    ],
    posteOf: (id) => postes[id],
    taskTechIds: ['t2'],
    filterTechId: 't2',
  }),
  ['t2'],
)
// Filtre un seul tech (planning semaine d’un tech) — ignore les autres même avec tâches
assert.deepEqual(
  techsLignesJour({
    team: [
      { id: 't1', role: 'operateur' },
      { id: 't2', role: 'operateur' },
    ],
    posteOf: (id) => postes[id],
    taskTechIds: ['t1', 't2'],
    filterTechId: 't1',
  }),
  ['t1'],
)

const agences: Record<string, string | undefined> = { t1: '06', t2: '13' }
assert.deepEqual(
  techsLignesJour({
    team: [
      { id: 't1', role: 'operateur' },
      { id: 't2', role: 'operateur' },
    ],
    posteOf: (id) => postes[id],
    taskTechIds: [],
    filterAgenceCodes: ['06'],
    agenceOf: (id) => agences[id],
  }),
  ['t1'],
)
assert.deepEqual(
  techsLignesJour({
    team: [
      { id: 't1', role: 'operateur' },
      { id: 't2', role: 'operateur' },
    ],
    posteOf: (id) => postes[id],
    taskTechIds: ['t2'],
    filterAgenceCodes: ['06'],
    agenceOf: (id) => agences[id],
  }),
  ['t1'],
)
// Sans filtre région : un tech hors liste « always » avec tâche reste visible
assert.deepEqual(
  techsLignesJour({
    team: [
      { id: 't1', role: 'operateur' },
      { id: 't2', role: 'operateur' },
    ],
    posteOf: (id) => postes[id],
    taskTechIds: ['t2'],
    filterAgenceCodes: [],
    agenceOf: (id) => agences[id],
  }),
  ['t1', 't2'],
)

assert.deepEqual(techIdsOt({ technicienUserId: 't1' }), ['t1'])
assert.deepEqual(techIdsOt({ technicienUserIds: ['t2', 't1'], technicienUserId: 't1' }), [
  't2',
  't1',
])
assert.deepEqual(
  syncTechsOt({
    technicienUserIds: ['t1', 't2'],
    noms: { t1: 'Jean', t2: 'Marc' },
  }),
  { technicienUserIds: ['t1', 't2'], technicienUserId: 't1', technicien: 'Jean + Marc' },
)

const typesTech = typesAgendaPourSaisie({ bureau: false })
assert.equal(typesTech.includes('pause_repas'), true)
assert.equal(typesTech.includes('formation'), false)
const typesBureau = typesAgendaPourSaisie({ bureau: true })
assert.equal(typesBureau.includes('formation'), true)
assert.equal(typesBureau.includes('hors_ot_libre'), true)
assert.equal(typesBureau.includes('vacances'), true)
assert.equal(HORS_OT_BUREAU.includes('conge'), true)
assert.equal(HORS_OT_BUREAU.includes('maladie'), true)
assert.equal(HORS_OT_BUREAU.includes('rtt'), true)
assert.equal(isIndispoType('vacances'), true)
assert.equal(isIndispoType('rtt'), true)
assert.equal(isIndispoType('rdv'), false)
assert.equal(titreDefautHorsOt('vacances'), 'Absent')
assert.equal(titreDefautHorsOt('rtt'), 'Absent')
assert.equal(agendaCouvreDate({ date: '2026-08-01', dateFin: '2026-08-05' }, '2026-08-03'), true)
assert.equal(agendaCouvreDate({ date: '2026-08-01', dateFin: '2026-08-05' }, '2026-08-06'), false)
assert.equal(agendaCouvreDate({ date: '2026-08-01' }, '2026-08-01'), true)
assert.equal(agendaCouvreDate({ date: '2026-08-01' }, '2026-08-02'), false)

const absences = [
  {
    id: 'a1',
    title: 'Congés août',
    date: '2026-08-10',
    dateFin: '2026-08-20',
    type: 'vacances' as const,
    statut: 'a_faire' as const,
    technicienUserId: 't1',
    createdAt: '',
    updatedAt: '',
  },
]
assert.equal(techEstIndispo(absences, 't1', '2026-08-15'), true)
assert.equal(techEstIndispo(absences, 't1', '2026-08-21'), false)
assert.equal(techEstIndispo(absences, 't2', '2026-08-15'), false)
assert.equal(indisposTechSurDate(absences, 't1', '2026-08-12').length, 1)
assert.equal(labelIndispoCourte(absences[0]), 'Congés août')
assert.equal(AGENDA_TYPE_LABELS.vacances, 'Vacances')
assert.equal(AGENDA_TYPE_LABELS.rtt, 'RTT')
const block = premierTechIndispo(absences, ['t2', 't1'], '2026-08-12')
assert.equal(block?.techId, 't1')
assert.equal(premierTechIndispo(absences, ['t2'], '2026-08-12'), null)

assert.equal(premiereHeureLibre({ occupied: [], dureeMinutes: 60 }), 8)
assert.equal(
  premiereHeureLibre({
    occupied: [{ heure: '08:00', dureeMinutes: 60 }],
    dureeMinutes: 60,
  }),
  9,
)
assert.equal(
  premiereHeureLibre({
    occupied: [
      { heure: '08:00', dureeMinutes: 240 },
      { heure: '12:00', dureeMinutes: 60 },
    ],
    dureeMinutes: 60,
  }),
  13,
)

assert.equal(parseHeureToMinutes('08:30'), 8 * 60 + 30)
assert.equal(parseHeureToMinutes(''), null)
assert.equal(dureeMinutesEffectif(undefined), 60)
assert.equal(dureeMinutesEffectif(90), 90)
assert.equal(dureeMinutesOt({ visiteNiveau: 'mensuel' }), 120)
assert.equal(dureeMinutesOt({ visiteNiveau: 'trimestriel' }), 180)
assert.equal(dureeMinutesOt({ visiteNiveau: 'semestriel' }), 240)
assert.equal(dureeMinutesOt({ visiteNiveau: 'annuel' }), 300)
assert.equal(dureeMinutesOt({ visiteNiveau: 'mensuel', dureeMinutes: 60 }), 120)
assert.equal(dureeMinutesOt({ visiteNiveau: 'mensuel', dureeMinutes: 90 }), 90)
assert.equal(dureeMinutesOt({}), 60)
assert.equal(labelDureeMinutes(300), '5 h')
assert.equal(labelDureeMinutes(90), '1 h 30')
assert.equal(labelDureeMinutes(120), '2 h')
assert.deepEqual(heuresFriseJour()[0], 7)
assert.deepEqual(heuresFriseJour().at(-1), 18)

const place = timelinePlacement('09:00', 60)
assert.ok(place)
assert.equal(Math.round(place!.leftPct), Math.round(((9 - 7) * 60 / 720) * 100))
assert.equal(Math.round(place!.widthPct), Math.round((60 / 720) * 100))
const place2h = timelinePlacement('07:00', 120)
assert.ok(place2h)
assert.equal(Math.round(place2h!.widthPct), Math.round((120 / 720) * 100))
const place5h = timelinePlacement('07:00', 300)
assert.ok(place5h)
assert.equal(Math.round(place5h!.widthPct), Math.round((300 / 720) * 100))
assert.equal(timelinePlacement(undefined, 60), null)
const early = timelinePlacement('06:00', 120)
assert.ok(early?.clippedStart)

console.log('test-agenda-planning: ok')
