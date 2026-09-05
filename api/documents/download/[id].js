/**
 * GET /api/documents/download/:id
 * Proxy sécurisé : le serveur va chercher le PDF sur le NAS / cloud.
 */

import { handleDocumentsDownload } from '../../../server/lib/documentsHandler.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, error: 'GET requis' })
    return
  }
  const id = String(req.query?.id || '').trim()
  await handleDocumentsDownload(req, res, id)
}
