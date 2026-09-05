import assert from 'node:assert/strict'
import {
  chiffrerCopieSecours,
  dechiffrerCopieSecours,
  magicBytesMatch,
  motDePasseExcelValide,
} from '../src/lib/documentCrypto'
import {
  QUEUE_RETRY_MS,
  isDueForRetry,
  matchQueuedItem,
  mergeQueueDests,
  queueItemStillPending,
} from '../src/lib/documentQueue'
import { coffreDestinationsVoulues } from '../src/lib/docStockage'

assert.equal(QUEUE_RETRY_MS, 15 * 60 * 1000)
assert.equal(motDePasseExcelValide('court'), false)
assert.equal(motDePasseExcelValide('motdepasse1'), true)

assert.deepEqual(coffreDestinationsVoulues({}), ['nas'])
assert.deepEqual(coffreDestinationsVoulues({ docsDestNas: false, docsDestCloud: true }), ['cloud'])
assert.deepEqual(
  coffreDestinationsVoulues({ docsDestNas: true, docsDestCloud: true }),
  ['nas', 'cloud'],
)

const dests = mergeQueueDests({ failed: ['nas'], okDests: ['cloud'] })
assert.equal(dests.nas, 'pending')
assert.equal(dests.cloud, 'ok')
assert.equal(queueItemStillPending(dests), true)
assert.equal(queueItemStillPending({ nas: 'ok', cloud: 'ok' }), false)

const now = Date.parse('2026-09-05T12:00:00.000Z')
assert.equal(isDueForRetry({ lastTryAt: '2026-09-05T11:50:00.000Z' }, now), false)
assert.equal(isDueForRetry({ lastTryAt: '2026-09-05T11:44:59.000Z' }, now), true)
assert.equal(isDueForRetry({ lastTryAt: '2026-09-05T11:40:00.000Z' }, now), true)

assert.equal(
  matchQueuedItem(
    {
      relPath: 'ClimaZEN/Documents/Clients/ACME/CERFA/CERFA-15497-04-2026-09-05.pdf',
      fileName: 'CERFA-15497-04-2026-09-05.pdf',
    },
    { fileName: 'CERFA-15497-04-2026-09-05.pdf' },
  ),
  true,
)
assert.equal(
  matchQueuedItem(
    {
      relPath: 'ClimaZEN/Documents/Clients/ACME/CERFA/CERFA-15497-04-2026-09-05-abcd1234.pdf',
      fileName: 'CERFA-15497-04-2026-09-05-abcd1234.pdf',
    },
    { needle: 'abcd1234' },
  ),
  true,
)
assert.equal(
  matchQueuedItem(
    { relPath: 'ClimaZEN/Documents/2026/CERFA/autre.pdf', fileName: 'autre.pdf' },
    { fileName: 'CERFA-15497-04-2026-09-05.pdf' },
  ),
  false,
)

const pwd = 'secret-societe-99'
const plain = new Blob([Uint8Array.from([1, 2, 3, 4, 5, 9])], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})
const enc = await chiffrerCopieSecours(plain, pwd)
const encBuf = await enc.arrayBuffer()
assert.equal(magicBytesMatch(encBuf), true)
assert.notEqual(encBuf.byteLength, 6)
const dec = await dechiffrerCopieSecours(enc, pwd)
const decBytes = new Uint8Array(await dec.arrayBuffer())
assert.deepEqual([...decBytes], [1, 2, 3, 4, 5, 9])

let threw = false
try {
  await dechiffrerCopieSecours(enc, 'mauvais-mot-de-passe')
} catch {
  threw = true
}
assert.equal(threw, true)

console.log('test-coffre-resilience: ok')
