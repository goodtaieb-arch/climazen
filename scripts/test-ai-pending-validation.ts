/**
 * Notifications validation IA → responsable secteur.
 */
import assert from 'node:assert/strict'
import {
  buildAiPendingValidation,
  inferSecteurFromText,
  pendingValidationsForUser,
  resolveResponsableSecteur,
} from '../src/lib/aiPendingValidation'
import type { PersonnelDossier } from '../src/lib/rhDocuments'

assert.equal(inferSecteurFromText('clim R-32 panne'), 'tech_cvc')
assert.equal(inferSecteurFromText('chambre froide fuite R-404A'), 'tech_frigoriste')

const dossiers: PersonnelDossier[] = [
  {
    id: '1',
    userId: 'u-resp-cvc',
    userName: 'Samir Responsable CVC',
    poste: 'responsable',
    metiersCouverts: ['tech_cvc'],
    toucheFroid: false,
    toucheElectricite: false,
    conduitVehicule: false,
    documents: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    userId: 'u-resp-frigo',
    userName: 'Léa Responsable Frigo',
    poste: 'pilote',
    metiersCouverts: ['tech_frigoriste'],
    toucheFroid: true,
    toucheElectricite: false,
    conduitVehicule: false,
    documents: [],
    updatedAt: new Date().toISOString(),
  },
]

const r1 = resolveResponsableSecteur(dossiers, { secteur: 'tech_cvc' })
assert.equal(r1?.userId, 'u-resp-cvc')

const r2 = resolveResponsableSecteur(dossiers, { secteur: 'tech_frigoriste' })
assert.equal(r2?.userId, 'u-resp-frigo')

const pending = buildAiPendingValidation({
  source: 'phone',
  title: 'Appel clim',
  summary: 'PAC en panne chez Dupont',
  textForInfer: 'clim monobloc plus de froid',
  dossiers,
})
assert.equal(pending.statut, 'a_valider')
assert.equal(pending.secteur, 'tech_cvc')
assert.equal(pending.assigneeUserId, 'u-resp-cvc')

const mine = pendingValidationsForUser([pending], 'u-resp-cvc')
assert.equal(mine.length, 1)
assert.equal(pendingValidationsForUser([pending], 'autre').length, 0)

console.log('ok test-ai-pending-validation')
