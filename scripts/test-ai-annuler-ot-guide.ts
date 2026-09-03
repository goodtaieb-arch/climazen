import assert from 'node:assert/strict'
import {
  wantsAnnulerOt,
  answerAnnulerOtGuide,
  AI_ANNULER_OT_GUIDE,
} from '../src/lib/aiActionCatalog'

assert.equal(wantsAnnulerOt('anulle l\'OT de Julie garnier'), true)
assert.equal(wantsAnnulerOt('annule lot de Julie'), true)
assert.equal(wantsAnnulerOt('supprime l OT 26090202'), true)
assert.equal(wantsAnnulerOt('annuler'), false)
assert.equal(wantsAnnulerOt('non'), false)
assert.equal(wantsAnnulerOt('crée un OT dépannage'), false)
assert.equal(wantsAnnulerOt('combien de filtre M5'), false)

const reply = answerAnnulerOtGuide('anulle l\'OT de Julie garnier')
assert.ok(reply.includes('ne peux pas annuler'))
assert.ok(/supprim/i.test(reply))
assert.ok(/retirer|croix rouge|déplacer|deplacer/i.test(reply))
assert.ok(reply.includes('Julie'))
assert.ok(AI_ANNULER_OT_GUIDE.includes('retirer'))

console.log('test-ai-annuler-ot-guide: ok')
