/**
 * GET /api/cron/coffre-health
 * Vercel Cron (horaire) : ping NAS + cloud, e-mail gérant si panne > 24 h.
 * Auth : Authorization Bearer CRON_SECRET (env Vercel).
 */

import { runHealthForAllOrgs } from '../../server/lib/storageHealthCheck.js'

function authorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return true
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const q = String(req.query?.secret || '').trim()
  return token === secret || q === secret
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'GET requis' })
    return
  }
  if (!authorized(req)) {
    res.status(401).json({ ok: false, error: 'Cron non autorisé.' })
    return
  }
  try {
    const result = await runHealthForAllOrgs()
    res.status(200).json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'health'
    res.status(500).json({ ok: false, error: msg })
  }
}
