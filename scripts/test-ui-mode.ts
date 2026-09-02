import assert from 'node:assert/strict'
import { isBureauUi, isTerrainUi, shortcutVisibleForAccess } from '../src/lib/uiMode'

const owner = { isOwner: true, peutVoirIdentitesRh: true }
const bureau = { isOwner: false, peutVoirIdentitesRh: true }
const terrain = { isOwner: false, peutVoirIdentitesRh: false }

assert.equal(isTerrainUi(owner), false)
assert.equal(isTerrainUi(bureau), false)
assert.equal(isTerrainUi(terrain), true)
assert.equal(isBureauUi(owner), true)
assert.equal(isBureauUi(bureau), true)

assert.equal(shortcutVisibleForAccess({ bureauOnly: true }, terrain), false)
assert.equal(shortcutVisibleForAccess({ bureauOnly: true }, owner), true)
assert.equal(shortcutVisibleForAccess({ bureauOnly: true }, bureau), true)
assert.equal(shortcutVisibleForAccess({ ownerOnly: true }, terrain), false)
assert.equal(shortcutVisibleForAccess({ ownerOnly: true }, owner), true)
assert.equal(shortcutVisibleForAccess({ rhTeamOnly: true }, terrain), false)
assert.equal(shortcutVisibleForAccess({ rhTeamOnly: true }, bureau), true)
assert.equal(shortcutVisibleForAccess({ proOnly: true, proFeature: 'agenda' }, owner), true)
assert.equal(
  shortcutVisibleForAccess({ proOnly: true, proFeature: 'agenda' }, { ...owner, appEdition: 'light' }),
  false,
)

assert.equal(
  shortcutVisibleForAccess({ lightHidden: true }, { ...owner, appEdition: 'light' }),
  false,
)

console.log('ok test-ui-mode')
