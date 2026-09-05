/**
 * Proxy archive (héritage) — plus d’URL / jeton dans le corps.
 * Délègue à /api/documents (JWT + secrets serveur).
 */

import { handleDocumentsPost } from '../server/lib/documentsHandler.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST requis', message: 'POST requis' })
    return
  }
  const body = req.body || {}
  if (body.baseUrl || body.token) {
    /* ignorés volontairement — plus de SSRF ni de fuite de jetons */
  }
  await handleDocumentsPost(req, res)
}
