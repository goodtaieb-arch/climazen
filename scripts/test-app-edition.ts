import assert from 'node:assert/strict'
import {
  APP_EDITION_DESCRIPTIONS,
  applyPendingEditionIfNeeded,
  editionHasFeature,
  filterLinksByEdition,
  resolveAppEdition,
  routeAllowedInEdition,
  stashPendingEdition,
  consumePendingEdition,
} from '../src/lib/appEdition'
import { shortcutVisibleForAccess } from '../src/lib/uiMode'

assert.equal(resolveAppEdition(undefined), 'pro')
assert.equal(resolveAppEdition('light'), 'light')
assert.equal(resolveAppEdition('pro'), 'pro')

assert.equal(editionHasFeature('pro', 'equipe'), true)
assert.equal(editionHasFeature('light', 'equipe'), false)
assert.equal(editionHasFeature('light', 'pointage'), false)
assert.equal(editionHasFeature('light', 'agenda'), false)

assert.equal(routeAllowedInEdition('/app/clients', 'light'), true)
assert.equal(routeAllowedInEdition('/app/equipe', 'light'), false)
assert.equal(routeAllowedInEdition('/app/equipe/u1', 'light'), false)
assert.equal(routeAllowedInEdition('/app/pointage', 'light'), false)
assert.equal(routeAllowedInEdition('/app/agenda', 'light'), false)
assert.equal(routeAllowedInEdition('/app/equipe', 'pro'), true)

const links = [
  { to: '/app/clients', label: 'Clients' },
  { to: '/app/equipe', label: 'Équipe' },
]
assert.deepEqual(filterLinksByEdition(links, 'light').map((l) => l.to), ['/app/clients'])

stashPendingEdition('light')
assert.equal(consumePendingEdition(), 'light')
assert.equal(consumePendingEdition(), null)

const boot = applyPendingEditionIfNeeded({})
assert.equal(boot.appEdition, 'pro')
assert.equal(boot.changed, false)

stashPendingEdition('light')
const boot2 = applyPendingEditionIfNeeded({})
assert.equal(boot2.appEdition, 'light')
assert.equal(boot2.changed, true)

assert.equal(
  shortcutVisibleForAccess({ proOnly: true, proFeature: 'equipe' }, {
    isOwner: true,
    peutVoirIdentitesRh: true,
    appEdition: 'light',
  }),
  false,
)
assert.equal(
  shortcutVisibleForAccess({ bureauOnly: true }, {
    isOwner: true,
    peutVoirIdentitesRh: true,
    appEdition: 'light',
  }),
  true,
)

assert.ok(APP_EDITION_DESCRIPTIONS.light.includes('CERFA'))

console.log('ok test-app-edition')
