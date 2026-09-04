/**
 * Tests — accès global données (recherche libre + snapshot, pas cas par cas).
 * Run: npx tsx scripts/test-assistant-data-query.ts
 */
import assert from 'node:assert/strict'
import {
  wantsDataQuery,
  answerDataQuery,
  computeOtStats,
  normalizeOtTypos,
  buildLiveDataSnapshot,
  searchOrgData,
} from '../src/lib/assistantDataQuery'
import { todayIsoLocal } from '../src/lib/agenda'
import type { AppData } from '../src/lib/types'
import { emptyData } from '../src/lib/storage'

const today = todayIsoLocal()
const ym = today.slice(0, 7)
const midMonth = `${ym}-15`
const otherMonth = ym.endsWith('01')
  ? `${Number(ym.slice(0, 4)) - 1}-12-10`
  : `${ym.slice(0, 4)}-${String(Number(ym.slice(5, 7)) - 1).padStart(2, '0')}-10`

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
  piecesDetachees: [
    {
      id: 'p1',
      reference: 'M5-600',
      designation: 'Filtre M5',
      quantite: 12,
      emplacement: 'atelier',
      updatedAt: '',
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

const stats = computeOtStats(data, { monthYm: ym })
assert.equal(stats.open, 2, `expected 2 open this month, got ${stats.open}`)
assert.equal(stats.closed, 1)

// Recherche libre multi-domaines (pas un regex par exemple)
const hitsFrigo = searchOrgData(data, 'Frigo Sud entrepôt')
assert.ok(hitsFrigo.some((h) => h.domain === 'client'))
assert.ok(hitsFrigo.some((h) => h.domain === 'site'))

const hitsPiece = searchOrgData(data, 'filtre M5 en stock')
assert.ok(hitsPiece.some((h) => h.domain === 'piece' && /M5/i.test(h.line)))

const hitsDevis = searchOrgData(data, 'devis Martin chambre')
assert.ok(hitsDevis.some((h) => h.domain === 'devis'))

const phrase =
  "Combien de or reste à effectuer de ce mois qu'on doit le clôturer afin de fin de mois"
assert.ok(wantsDataQuery(phrase))

const snap = buildLiveDataSnapshot(data, {
  userQuery: phrase,
  maxClients: 10,
  team: [{ id: 'u1', fullName: 'Thomas Roux' }],
})
assert.ok(/DONNÉES RÉELLES/.test(snap))
assert.ok(/TOTAUX/.test(snap))
assert.ok(/RECHERCHE/.test(snap))
assert.ok(/2 ouverts/.test(snap) || /ouverts en/.test(snap))
assert.ok(/Frigo Sud/.test(snap))
assert.ok(/accès total|N’IMPORTE|IMPORTE quelle/i.test(snap))

// Snapshot pour une question totalement différente → toujours les totaux + hits
const snap2 = buildLiveDataSnapshot(data, { userQuery: 'où en est le devis Martin ?' })
assert.ok(/Devis/.test(snap2) || /devis/.test(snap2))
assert.ok(/Clients/.test(snap2))

const reply = answerDataQuery(data, phrase)
assert.ok(/2/.test(reply), `fallback reply should mention 2:\n${reply}`)

console.log('ok — assistant data query (global search)')
