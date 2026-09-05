import assert from 'node:assert/strict'
import { routeAllowedInEdition } from '../src/lib/appEdition'
import { shortcutVisibleForAccess } from '../src/lib/uiMode'

assert.equal(routeAllowedInEdition('/app/temps-hors-int', 'light'), false)
assert.equal(routeAllowedInEdition('/app/temps-hors-int', 'pro'), true)

assert.equal(
  shortcutVisibleForAccess(
    { proOnly: true, proFeature: 'pointage' },
    { isOwner: false, peutVoirIdentitesRh: false, appEdition: 'pro' },
  ),
  true,
)
assert.equal(
  shortcutVisibleForAccess(
    { proOnly: true, proFeature: 'pointage' },
    { isOwner: false, peutVoirIdentitesRh: false, appEdition: 'light' },
  ),
  false,
)

console.log('ok test-temps-hors-int')
