import assert from 'node:assert/strict'
import { parseVoiceCommand, textForSpeech } from '../src/lib/speech'
import {
  isDirectHandsFreeCommand,
  isWakePhrase,
  parseHandsFreeIntent,
  parsePointageVoiceIntent,
  parlerMesInterventions,
  stripWakePhrase,
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

assert.equal(isWakePhrase('dis Lola'), true)
assert.equal(isWakePhrase('Dit lola'), true)
assert.equal(isWakePhrase('hey Lola'), true)
assert.equal(isWakePhrase('Lola'), true)
assert.equal(isWakePhrase('ok Lola'), true)
assert.equal(isWakePhrase('euh dis Lola'), true)
assert.equal(isWakePhrase('ben dis Lola'), true)
assert.equal(isWakePhrase('dis moi Lola'), true)
assert.equal(isWakePhrase('dis Lola mets-moi en pause'), true)
assert.equal(isWakePhrase('mets-moi en pause'), false)
assert.equal(isWakePhrase('ouvre le stock'), false)
assert.equal(stripWakePhrase('dis Lola'), '')
assert.equal(stripWakePhrase('euh dis Lola'), '')
assert.equal(stripWakePhrase('Dis Lola, mets-moi en pause'), 'mets-moi en pause')
assert.equal(stripWakePhrase('hey lola ouvre le stock'), 'ouvre le stock')
assert.equal(stripWakePhrase('mets-moi en pause'), 'mets-moi en pause')
assert.equal(isDirectHandsFreeCommand('mets-moi en pause'), true)
assert.equal(isDirectHandsFreeCommand('bonjour le chat'), false)

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
assert.deepEqual(parsePointageVoiceIntent('mets-moi en cours d’intervention'), {
  action: 'intervention_en_cours',
  cible: 'ot',
})
assert.deepEqual(parsePointageVoiceIntent('déclenche la pause'), {
  action: 'pause',
})
assert.deepEqual(parsePointageVoiceIntent('arrête la pause'), {
  action: 'intervention_en_cours',
  cible: 'ot',
})
assert.deepEqual(parsePointageVoiceIntent('fin d’intervention'), {
  action: 'fin_intervention',
})
assert.deepEqual(parsePointageVoiceIntent('fournisseur'), {
  action: 'fournisseur',
})
assert.equal(parseHandsFreeIntent('mets moi en deplacement vers le site').kind, 'pointage')
assert.equal(parseHandsFreeIntent('que puis-je dire').kind, 'aide_pointage')
assert.equal(parseHandsFreeIntent('mets moi en cours').kind, 'pointage')
assert.equal(parseHandsFreeIntent('arrete la pause').kind, 'pointage')

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
