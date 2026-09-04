/**
 * Tests — lecture OT / bilan mois (cas « combien d’OT à clôturer ce mois »).
 * Run: npx tsx scripts/test-assistant-data-query.ts
 */
import assert from 'node:assert/strict'
import {
  wantsDataQuery,
  answerDataQuery,
  computeOtStats,
  normalizeOtTypos,
  buildLiveDataSnapshot,
} from '../src/lib/assistantDataQuery'
import { todayIsoLocal } from '../src/lib/agenda'
import type { AppData } from '../src/lib/types'
import { emptyData } from '../src/lib/storage'

const today = todayIsoLocal()
const ym = today.slice(0, 7)
const midMonth = `${ym}-15`
const otherMonth = ym.endsWith('01') ? `${Number(ym.slice(0, 4)) - 1}-12-10` : `${ym.slice(0, 4)}-${String(Number(ym.slice(5, 7)) - 1).padStart(2, '0')}-10`

assert.ok(wantsDataQuery('Combien de or reste à effectuer de ce mois qu’on doit le clôturer afin de fin de mois'))
assert.ok(wantsDataQuery('Combien d’OT restent à clôturer ce mois ?'))
assert.ok(wantsDataQuery('bilan fin de mois OT ouverts'))
assert.equal(wantsDataQuery('bonjour comment ça va'), false)

assert.ok(/OT/i.test(normalizeOtTypos('Combien de or reste')))

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
      ville: '',
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
      statut: 'brouillon',
      date: today,
      heure: '14:00',
      action: 'Fuite R-32',
      technicien: 'Thomas Roux',
      technicienUserId: 'u1',
      clientId: 'c1',
      chantierId: 's1',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ot3',
      numero: '26090403',
      typeOt: 'entretien',
      statut: 'signe',
      date: midMonth,
      heure: '10:00',
      action: 'Entretien fait',
      technicien: 'Thomas Roux',
      technicienUserId: 'u1',
      clientId: 'c1',
      chantierId: 's1',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'ot4',
      numero: '25120101',
      typeOt: 'maintenance',
      statut: 'en_cours',
      date: otherMonth,
      heure: '09:00',
      action: 'Hors mois',
      technicien: 'Autre',
      technicienUserId: 'u2',
      clientId: 'c1',
      chantierId: 's1',
      createdAt: '',
      updatedAt: '',
    },
  ],
} as unknown as AppData

const stats = computeOtStats(data, {
  period: { kind: 'month', label: 'mois', monthYm: ym },
})
assert.equal(stats.open, 2, `expected 2 open this month, got ${stats.open}`)
assert.equal(stats.closed, 1)
assert.equal(stats.total, 3)

const phrase =
  "Combien de or reste à effectuer de ce mois qu'on doit le clôturer afin de fin de mois"
assert.ok(wantsDataQuery(phrase))
const reply = answerDataQuery(data, phrase)
assert.ok(/2/.test(reply), `reply should mention 2 open OTs:\n${reply}`)
assert.ok(/26090401|OT26090401/.test(reply))
assert.ok(/26090402|OT26090402/.test(reply))
assert.ok(!/aucun OT ouvert pour ce mois/i.test(reply))
assert.ok(/Thomas Roux/.test(reply))

const snap = buildLiveDataSnapshot(data, { userQuery: phrase, maxClients: 10 })
assert.ok(/DONNÉES RÉELLES/.test(snap))
assert.ok(/2 ouverts/.test(snap) || /ouverts à clôturer/.test(snap))
assert.ok(/Frigo Sud/.test(snap))

console.log('ok — assistant data query')
