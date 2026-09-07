import assert from 'node:assert/strict'
import { parseVoiceCommand, textForSpeech } from '../src/lib/speech'
import {
  parseHandsFreeIntent,
  parsePointageVoiceIntent,
  parlerMesInterventions,
  wantsMesInterventions,
} from '../src/lib/voiceHandsFree'
import type { AppData } from '../src/lib/types'

const cases: Array<[string, string | null]> = [
  ['ouvre le stock', 'stock'],
  ['scanner la bouteille', 'scan'],
  ['qr du batiment', 'scan_equip'],
  ['qr site', 'scan_equip'],
  ['nouvel appel', 'appel'],
  ['créer un OT', 'appel'],
  ['ordres de travail', 'ot'],
  ['ouvre le GPS', 'gps'],
  ['Waze', 'gps'],
  ['CERFA', 'cerfa'],
  ['sites', 'sites'],
  ['aide', 'aide'],
  ['accueil', 'accueil'],
  ['ouvre la pointeuse', 'pointage'],
  ['temps de travail', 'pointage'],
  ['entrées de temps hors INT', 'temps_hors_int'],
  ['hors int', 'temps_hors_int'],
  ['bonjour le chat', null],
]

for (const [input, expected] of cases) {
  const got = parseVoiceCommand(input)
  assert.equal(got?.id ?? null, expected, `« ${input} » → ${got?.id ?? null}, attendu ${expected}`)
}

assert.equal(wantsMesInterventions('Quelles interventions m’ont été affectées ?'), true)
assert.equal(wantsMesInterventions('montre mes INT'), true)
assert.equal(wantsMesInterventions('ouvre le stock'), false)

assert.equal(parseHandsFreeIntent('stop').kind, 'stop')
assert.equal(parseHandsFreeIntent('quelles sont mes interventions ouvertes').kind, 'mes_int')

assert.deepEqual(parsePointageVoiceIntent('mets-moi en déplacement vers le site'), {
  action: 'deplacement',
  cible: 'ot',
})
assert.deepEqual(parsePointageVoiceIntent('déplacement vers le fournisseur'), {
  action: 'deplacement',
  cible: 'fournisseur',
})
assert.deepEqual(parsePointageVoiceIntent('je suis arrivé'), {
  action: 'intervention_en_cours',
  cible: 'ot',
})
assert.equal(parseHandsFreeIntent('mets moi en deplacement vers le site').kind, 'pointage')

const data = {
  clients: [{ id: 'c1', typeClient: 'professionnel', raisonSociale: 'Magasin Test', nom: '', prenom: '' }],
  chantiers: [{ id: 's1', clientId: 'c1', nom: 'Site Centre', ville: 'Lyon' }],
  ordresTravail: [
    {
      id: 'ot1',
      numero: '26090701',
      date: '2026-09-07',
      typeOt: 'depanage',
      action: 'Plus de froid',
      rapportAction: '',
      observations: '',
      technicien: 'Karim',
      technicienUserId: 'u1',
      clientId: 'c1',
      chantierId: 's1',
      heure: '09:00',
      statut: 'en_cours',
      createdAt: '',
      updatedAt: '',
    },
  ],
} as unknown as AppData

const oral = parlerMesInterventions(data, 'u1')
assert.ok(oral.includes('1 intervention'))
assert.ok(oral.includes('INT26090701') || oral.includes('26090701'))
assert.ok(oral.includes('Magasin Test') || oral.includes('Site Centre'))
assert.ok(parlerMesInterventions(data, 'autre').includes('aucune'))

assert.equal(textForSpeech('**Bonjour** • test'), 'Bonjour test')

console.log(`OK ${cases.length} commandes + main libre`)
