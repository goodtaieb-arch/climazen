import assert from 'node:assert/strict'
import {
  COULEUR_NON_AFFECTE,
  HORS_OT_BUREAU,
  HORS_OT_TECH,
  couleurPlanning,
  couleurSecteurTech,
  estPourTech,
  isHorsOtType,
  otSansCreneau,
  titreDefautHorsOt,
  typesAgendaPourSaisie,
  visibleAgendaPour,
} from '../src/lib/agendaPlanning'
import { AGENDA_TYPE_LABELS } from '../src/lib/agenda'

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

const typesTech = typesAgendaPourSaisie({ bureau: false })
assert.equal(typesTech.includes('pause_repas'), true)
assert.equal(typesTech.includes('formation'), false)
const typesBureau = typesAgendaPourSaisie({ bureau: true })
assert.equal(typesBureau.includes('formation'), true)
assert.equal(typesBureau.includes('hors_ot_libre'), true)

console.log('test-agenda-planning: ok')
