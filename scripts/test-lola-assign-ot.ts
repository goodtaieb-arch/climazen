/**
 * Lola — affecter N INT / tech, secteur conservé, validation Accueil.
 * Run: npx tsx scripts/test-lola-assign-ot.ts
 */
import assert from 'node:assert/strict'
import {
  applyAssignOtSlots,
  parseAssignOtsIntent,
  planAssignOts,
  wantsAssignOts,
} from '../src/lib/lolaAssignOt'
import {
  buildAiPendingValidation,
  groupPendingByTech,
  pendingValidationsForUser,
} from '../src/lib/aiPendingValidation'
import { blankOrdreTravail, type OrdreTravail } from '../src/lib/ordreTravail'
import type { PersonnelDossier } from '../src/lib/rhDocuments'
import type { AppData } from '../src/lib/types'

assert.equal(
  wantsAssignOts('affecte a chaque tech 2 inter et fait pas bouger le tech de son secteur'),
  true,
)
assert.equal(wantsAssignOts('Pose 2 INT par technicien'), true)
assert.equal(wantsAssignOts('répartis les interventions à chaque tech'), true)
assert.equal(wantsAssignOts('Crée une INT pour Mr Martin'), false)
assert.equal(wantsAssignOts('Combien d’INT ce mois'), false)
assert.equal(wantsAssignOts('remplis l’agenda avec les ordres'), true)
assert.equal(wantsAssignOts('planifie les INT sur l’agenda'), true)
assert.equal(wantsAssignOts('mets les interventions à l’agenda'), true)
assert.equal(wantsAssignOts('Agenda RDV demain 14h pour Mr Martin'), false)

const fillAgenda = parseAssignOtsIntent('remplis l’agenda avec les ordres', '2026-09-07')
assert.ok(fillAgenda)
assert.equal(fillAgenda!.perTech, 12)
assert.equal(fillAgenda!.dateIso, '2026-09-07')

const demain = parseAssignOtsIntent('planifie les INT demain sur l’agenda', '2026-09-07')
assert.ok(demain)
assert.equal(demain!.dateIso, '2026-09-08')
assert.equal(demain!.perTech, 12)

const intent = parseAssignOtsIntent(
  'affecte a chaque tech 2 inter sans bouger le tech de son secteur',
  '2026-09-07',
)
assert.ok(intent)
assert.equal(intent!.perTech, 2)
assert.equal(intent!.keepSecteur, true)
assert.equal(intent!.dateIso, '2026-09-07')

const dossiers: PersonnelDossier[] = [
  {
    id: 'd0',
    userId: 'u-resp',
    userName: 'Samir Responsable',
    poste: 'responsable',
    metiersCouverts: ['tech_cvc', 'tech_frigoriste'],
    toucheFroid: false,
    toucheElectricite: false,
    conduitVehicule: false,
    documents: [],
    updatedAt: '',
  },
  {
    id: 'd1',
    userId: 'tech-cvc-a',
    userName: 'Karim CVC',
    poste: 'tech_cvc',
    toucheFroid: false,
    toucheElectricite: true,
    conduitVehicule: true,
    documents: [],
    updatedAt: '',
  },
  {
    id: 'd2',
    userId: 'tech-cvc-b',
    userName: 'Samir CVC',
    poste: 'tech_cvc',
    toucheFroid: false,
    toucheElectricite: true,
    conduitVehicule: true,
    documents: [],
    updatedAt: '',
  },
  {
    id: 'd3',
    userId: 'tech-frigo',
    userName: 'Léa Frigo',
    poste: 'tech_frigoriste',
    toucheFroid: true,
    toucheElectricite: false,
    conduitVehicule: true,
    documents: [],
    updatedAt: '',
  },
]

function ot(partial: Partial<OrdreTravail> & { id: string; numero: string }): OrdreTravail {
  return {
    ...blankOrdreTravail(),
    date: '2026-09-07',
    statut: 'pret_a_planifier',
    heure: '',
    technicien: '',
    technicienUserId: undefined,
    technicienUserIds: [],
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const data = {
  clients: [
    { id: 'c1', raisonSociale: 'Dupont Clim', typeClient: 'entreprise' },
    { id: 'c2', raisonSociale: 'Frigo Sud', typeClient: 'entreprise' },
  ],
  chantiers: [
    { id: 's1', nom: 'Atelier', clientId: 'c1' },
    { id: 's2', nom: 'Chambre froide', clientId: 'c2' },
  ],
  personnelDossiers: dossiers,
  personnelRetiresUserIds: [],
  agendaEvents: [],
  ordresTravail: [
    ot({ id: 'ot1', numero: '26090701', typeOt: 'depanage', action: 'PAC panne', secteur: 'tech_cvc', clientId: 'c1', chantierId: 's1' }),
    ot({ id: 'ot2', numero: '26090702', typeOt: 'maintenance', action: 'Entretien CVC', secteur: 'tech_cvc', clientId: 'c1', chantierId: 's1' }),
    ot({ id: 'ot3', numero: '26090703', typeOt: 'entretien', action: 'Visite CVC', secteur: 'tech_cvc', clientId: 'c1', chantierId: 's1' }),
    ot({ id: 'ot4', numero: '26090704', typeOt: 'controle_etancheite', action: 'Étanchéité CVC', secteur: 'tech_cvc', clientId: 'c1', chantierId: 's1' }),
    ot({ id: 'ot5', numero: '26090705', typeOt: 'depanage', action: 'Chambre froide', secteur: 'tech_frigoriste', clientId: 'c2', chantierId: 's2' }),
    ot({ id: 'ot6', numero: '26090706', typeOt: 'maintenance', action: 'Groupe froid', secteur: 'tech_frigoriste', clientId: 'c2', chantierId: 's2' }),
    ot({ id: 'ot7', numero: '26090707', typeOt: 'entretien', action: 'Frigo 3', secteur: 'tech_frigoriste', clientId: 'c2', chantierId: 's2' }),
  ],
} as unknown as AppData

const team = [
  { id: 'tech-cvc-a', fullName: 'Karim CVC' },
  { id: 'tech-cvc-b', fullName: 'Samir CVC' },
  { id: 'tech-frigo', fullName: 'Léa Frigo' },
]

const plan = planAssignOts({ data, team, intent: intent! })
assert.equal(plan.ok, true)
if (!plan.ok) throw new Error(plan.message)

assert.equal(plan.slots.length, 6) // 2 par tech × 3 techs
const byTech = new Map<string, typeof plan.slots>()
for (const s of plan.slots) {
  const list = byTech.get(s.techUserId) || []
  list.push(s)
  byTech.set(s.techUserId, list)
}
assert.equal(byTech.get('tech-cvc-a')?.length, 2)
assert.equal(byTech.get('tech-cvc-b')?.length, 2)
assert.equal(byTech.get('tech-frigo')?.length, 2)

for (const s of byTech.get('tech-cvc-a') || []) {
  assert.equal(s.secteur, 'tech_cvc')
  assert.ok(s.heure)
}
for (const s of byTech.get('tech-frigo') || []) {
  assert.equal(s.secteur, 'tech_frigoriste')
}

// Pas de mix secteur
assert.equal(
  plan.slots.some((s) => s.techUserId.startsWith('tech-cvc') && s.secteur === 'tech_frigoriste'),
  false,
)

const applied = applyAssignOtSlots(data.ordresTravail, plan.slots)
assert.equal(applied.applied, 6)
const karim = applied.ots.filter((o) => o.technicienUserId === 'tech-cvc-a')
assert.equal(karim.length, 2)
assert.ok(karim.every((o) => (o.heure || '').trim()))
assert.ok(karim.every((o) => o.secteur === 'tech_cvc'))
assert.ok(karim.every((o) => o.updatedAt))

const lea = applied.ots.filter((o) => o.technicienUserId === 'tech-frigo')
assert.equal(lea.length, 2)
assert.ok(lea.every((o) => o.secteur === 'tech_frigoriste'))

// Date d’ouverture ancienne → l’agenda du jour demandé (pas la date d’origine)
const oldPool = {
  ...data,
  ordresTravail: (data.ordresTravail || []).map((o) => ({ ...o, date: '2026-08-01' })),
}
const planToday = planAssignOts({
  data: oldPool,
  team,
  intent: { perTech: 2, dateIso: '2026-09-07', keepSecteur: true },
})
assert.equal(planToday.ok, true)
if (planToday.ok) {
  assert.ok(planToday.slots.every((s) => s.date === '2026-09-07'))
  const placed = applyAssignOtSlots(oldPool.ordresTravail, planToday.slots)
  assert.ok(placed.ots.filter((o) => o.heure).every((o) => o.date === '2026-09-07'))
}

// INT déjà calée sur un autre tech : ne pas voler
const busy = applyAssignOtSlots(
  [
    ot({
      id: 'ot1',
      numero: '26090701',
      heure: '08:00',
      technicienUserId: 'autre',
      technicienUserIds: ['autre'],
      technicien: 'Autre',
      secteur: 'tech_cvc',
    }),
  ],
  [
    {
      otId: 'ot1',
      otNumero: '26090701',
      otAction: 'x',
      techUserId: 'tech-cvc-a',
      techName: 'Karim',
      secteur: 'tech_cvc',
      date: '2026-09-07',
      heure: '09:00',
      dureeMinutes: 60,
    },
  ],
)
assert.equal(busy.ots[0].technicienUserId, 'autre')
assert.equal(busy.ots[0].heure, '08:00')

const pendingList = plan.slots.map((slot) =>
  buildAiPendingValidation({
    source: 'assistant',
    kind: 'agenda',
    title: `${slot.otNumero} → ${slot.techName}`,
    summary: slot.otAction,
    secteur: slot.secteur,
    dossiers,
    batchId: 'batch-1',
    techUserId: slot.techUserId,
    techName: slot.techName,
    otId: slot.otId,
    proposal: { type: 'assign_ot', slot },
  }),
)
const grouped = groupPendingByTech(pendingList)
assert.equal(grouped.groups.length, 3)
assert.equal(grouped.others.length, 0)
assert.ok(grouped.groups.every((g) => g.items.length === 2))

const mine = pendingValidationsForUser(pendingList, 'tech-cvc-a')
assert.equal(mine.length, 0) // ciblé responsable, pas le tech
assert.equal(pendingValidationsForUser(pendingList, 'u-resp').length, 6)

console.log('ok test-lola-assign-ot')
