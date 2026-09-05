/**
 * POST /api/documents
 * { action: put|get|exists|backup-excel|save-config|config, relPath?, contentBase64? }
 * Authorization: Bearer <session Supabase>
 * Aucun jeton NAS / cloud dans le corps.
 */

import { handleDocumentsPost } from '../../server/lib/documentsHandler.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method === 'GET') {
    const { handleDocumentsDownload } = await import('../../server/lib/documentsHandler.js')
    const id = String(req.query?.id || '').trim()
    if (id) {
      await handleDocumentsDownload(req, res, id)
      return
    }
    req.body = { action: 'config' }
    await handleDocumentsPost(req, res)
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST requis' })
    return
  }
  await handleDocumentsPost(req, res)
}
