import assert from 'node:assert/strict'
import {
  computeCoffreActifFromPartial,
  extractCoffreSecrets,
  preserveCoffreSecrets,
  stripCoffreSecrets,
} from '../src/lib/coffreSecrets'
import { coffreDestinationsVoulues } from '../src/lib/docStockage'
import {
  chiffrerCopieSecoursBuffer,
  dechiffrerCopieSecoursBuffer,
  magicBytesMatch,
} from '../server/lib/documentCrypto.js'
import { safeRelPath } from '../server/lib/coffrePath.js'
import { resolveStorageDestinations } from '../server/lib/storageService.js'

const op = {
  serveurPriveDocsUrl: 'https://nas.exemple.fr/dav',
  serveurPriveDocsToken: 'secret-nas',
  coffreExcelMotDePasse: 'motdepasse1',
  docsDestNas: true,
  docsDestCloud: false,
}

assert.equal(computeCoffreActifFromPartial(op), true)
const stripped = stripCoffreSecrets(op)
assert.equal(stripped.serveurPriveDocsToken, undefined)
assert.equal(stripped.serveurPriveDocsUrl, undefined)
assert.equal(stripped.coffreExcelMotDePasse, undefined)
assert.equal(stripped.coffreActif, true)
assert.equal(stripped.docsDestNas, true)

const extracted = extractCoffreSecrets(op)
assert.equal(extracted.serveurPriveDocsToken, 'secret-nas')

const preserved = preserveCoffreSecrets({
  previous: op,
  incoming: { docsDestNas: true, raisonSociale: 'SARL' },
})
assert.equal(preserved.serveurPriveDocsToken, 'secret-nas')
assert.equal(preserved.raisonSociale, 'SARL')

assert.deepEqual(coffreDestinationsVoulues({ coffreActif: true, docsDestNas: true }), ['nas'])
assert.deepEqual(
  coffreDestinationsVoulues({ docsDestNas: false, docsDestCloud: true }),
  ['cloud'],
)

assert.equal(safeRelPath('ClimaZEN/Documents/Secours/climazen-donnees.xlsx.enc'), 'ClimaZEN/Documents/Secours/climazen-donnees.xlsx.enc')
assert.equal(safeRelPath('../etc/passwd'), '')
assert.equal(safeRelPath('Documents/x.pdf'), '')

const dests = resolveStorageDestinations({
  docsDestNas: true,
  serveurPriveDocsUrl: 'https://nas.exemple.fr/dav',
  serveurPriveDocsToken: 't',
  docsDestCloud: true,
  cloudProvider: 's3',
  s3Bucket: 'coffre',
  s3AccessKey: 'AKI',
  s3SecretKey: 'SECRET',
  s3Region: 'eu-west-3',
})
assert.equal(dests.length, 2)
assert.equal(dests[0].id, 'nas')
assert.equal(dests[1].kind, 's3')

const gdrive = resolveStorageDestinations({
  docsDestNas: false,
  docsDestCloud: true,
  cloudProvider: 'gdrive',
  gdriveClientId: 'id',
  gdriveClientSecret: 'sec',
  gdriveRefreshToken: 'rt',
  gdriveFolderId: 'root',
})
assert.equal(gdrive.length, 1)
assert.equal(gdrive[0].kind, 'gdrive')

const pwd = 'secret-societe-99'
const plain = Buffer.from([1, 2, 3, 4, 5, 9])
const enc = chiffrerCopieSecoursBuffer(plain, pwd)
assert.equal(magicBytesMatch(enc), true)
const dec = dechiffrerCopieSecoursBuffer(enc, pwd)
assert.deepEqual([...dec], [1, 2, 3, 4, 5, 9])

console.log('test-coffre-secrets: ok')
