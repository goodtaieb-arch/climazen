/**
 * Tests — Lola formateur + lectures locales (sans cloud).
 * Run: npx tsx scripts/test-lola-trainer.ts
 */
import assert from 'node:assert/strict'
import {
  wantsLookup,
  wantsHowTo,
  classifyLolaIntent,
  answerLolaLookup,
  answerLolaTrainer,
  matchLolaAction,
  trainerCatalogForPrompt,
} from '../src/lib/lolaTrainer'
import { todayIsoLocal } from '../src/lib/agenda'
import type { AppData } from '../src/lib/types'
import { emptyData } from '../src/lib/storage'
import { parseTerrainIntent } from '../src/lib/assistantTerrainActions'
import { wantsOtLookup } from '../src/lib/assistantOtLookup'

const today = todayIsoLocal()
const ym = today.slice(0, 7)
const midMonth = `${ym}-15`

const data = {
  ...emptyData(),
  clients: [
    {
      id: 'c1',
      raisonSociale: 'Frigo Sud',
      typeClient: 'entreprise',
      nom: '',
      prenom: '',
      nomContact: '',
      adresse: '',
      codePostal: '',
      ville: 'Marseille',
      telephone: '',
      email: '',
      createdAt: '',
    },
  ],
  chantiers: [
    {
      id: 's1',
      clientId: 'c1',
      nom: 'Entrepôt 13',
      adresse: '',
      codePostal: '',
      ville: '',
      createdAt: '',
    },
  ],
  devis: [
    {
      id: 'd1',
      numero: 'D-100',
      type: 'travaux',
      statut: 'brouillon',
      clientId: 'c1',
      libelle: 'Devis chambre froide Martin',
      lignes: [],
      createdAt: '',
      updatedAt: '',
    },
  ],
  detecteurs: [
    {
      id: 'det1',
      identification: 'DET-88',
      assigneeName: 'Karim Benali',
      controleDate: '2026-01-01',
      updatedAt: '',
    },
  ],
  ordresTravail: [
    {
      id: 'ot1',
      numero: '26090401',
      typeOt: 'maintenance',
      statut: 'en_cours',
      date: midMonth,
      heure: '08:00',
      action: 'Maintenance chambre froide',
      technicien: 'Thomas Roux',
      technicienUserId: 'u1',
      clientId: 'c1',
      chantierId: 's1',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ot2',
      numero: '26090402',
      typeOt: 'depanage',
      statut: 'signe',
      date: midMonth,
      heure: '10:00',
      action: 'Fait',
      technicien: 'Thomas Roux',
      technicienUserId: 'u1',
      clientId: 'c1',
      chantierId: 's1',
      createdAt: '',
      updatedAt: '',
    },
  ],
} as unknown as AppData

// Intentions
assert.equal(classifyLolaIntent('Combien d’INT restent à clôturer ce mois'), 'lookup')
assert.equal(classifyLolaIntent("Combien de or reste à effectuer de ce mois"), 'lookup')
assert.equal(wantsLookup('où est le client Dupont'), true)
assert.equal(wantsLookup('où en est le devis Martin'), true)
assert.equal(wantsHowTo('comment faire un CERFA'), true)
assert.equal(wantsHowTo('ouvre l’agenda'), true)
assert.equal(wantsLookup('ouvre l’agenda'), false)
assert.equal(classifyLolaIntent('Crée une INT pour Mr Martin'), 'action')
assert.equal(wantsLookup('Crée une INT pour Mr Martin'), false)
assert.equal(wantsHowTo('Crée une INT pour Mr Martin'), false)

// Lookup local — chiffres réels, pas « je ne sais pas »
const phraseMois =
  "Combien de or reste à effectuer de ce mois qu'on doit le clôturer afin de fin de mois"
const replyMois = answerLolaLookup(data, phraseMois)
assert.ok(replyMois, 'lookup month should answer locally')
assert.ok(/1 INT/.test(replyMois!), `should mention 1 open INT:\n${replyMois}`)
assert.ok(/\/app\/ot/.test(replyMois!), 'should point to the INT page')

const replyClient = answerLolaLookup(data, 'où est le client Frigo Sud')
assert.ok(replyClient)
assert.ok(/Frigo Sud/.test(replyClient!), replyClient || '')
assert.ok(/\/app\/clients/.test(replyClient!))

const replyDevis = answerLolaLookup(data, 'où en est le devis Martin')
assert.ok(replyDevis)
assert.ok(/Martin|D-100|devis/i.test(replyDevis!), replyDevis || '')

const replyDet = answerLolaLookup(data, 'qui a le détecteur DET-88')
assert.ok(replyDet)
assert.ok(/Karim Benali/.test(replyDet!), replyDet || '')

// Pas de lookup → pas de réponse lookup (laisse les parsers d’action)
assert.equal(answerLolaLookup(data, 'Crée une INT dépannage pour Mr Dupont'), null)

// Formateur
const cerfaHow = answerLolaTrainer('comment faire un CERFA')
assert.ok(cerfaHow)
assert.ok(/\/app\/interventions/.test(cerfaHow!))
assert.ok(/nature/i.test(cerfaHow!) || /Signatures/.test(cerfaHow!))

const agendaHow = answerLolaTrainer('ouvre l’agenda')
assert.ok(agendaHow)
assert.ok(/\/app\/agenda/.test(agendaHow!))

const absenceHow = answerLolaTrainer('comment poser des congés')
assert.ok(absenceHow)
assert.ok(/\/app\/absences/.test(absenceHow!))

assert.equal(answerLolaTrainer('Crée une INT pour Mr Martin'), null)

const matched = matchLolaAction('comment pointer en cours')
assert.ok(matched)
assert.equal(matched!.action.id, 'pointage')

assert.ok(trainerCatalogForPrompt().includes('FORMATEUR'))
assert.ok(trainerCatalogForPrompt().includes('/app/appel'))

// « qui a le détecteur » ne doit PLUS proposer une création
assert.equal(parseTerrainIntent('qui a le détecteur DET-88', data), null)
assert.ok(parseTerrainIntent('ajoute détecteur nom DET-99 validité 12/03/27', data))

// INT de Karim reste un lookup tech (pas le formateur générique)
assert.equal(wantsLookup('INT de Karim aujourd’hui'), false)
assert.equal(wantsOtLookup('INT de Karim aujourd’hui'), true)

console.log('ok — lola trainer (lookup local + formateur)')
