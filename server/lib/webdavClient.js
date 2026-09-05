/**
 * Client WebDAV (NAS / Nextcloud / rclone) — utilisé uniquement côté serveur.
 */

import { httpError } from './storageError.js'

function joinUrl(base, relPath) {
  const parts = String(relPath || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
  return `${String(base || '').replace(/\/+$/, '')}/${parts.join('/')}`
}

function authHeaders(token) {
  const headers = {}
  const t = String(token || '').trim()
  if (t) headers.Authorization = t.startsWith('Bearer ') ? t : `Bearer ${t}`
  return headers
}

export async function webdavEnsureParents(base, relPath, token) {
  const headers = authHeaders(token)
  const parts = String(relPath || '')
    .split('/')
    .filter(Boolean)
  parts.pop()
  let acc = ''
  for (const p of parts) {
    acc = acc ? `${acc}/${p}` : p
    const url = joinUrl(base, acc)
    try {
      const res = await fetch(url, { method: 'MKCOL', headers })
      if (res.status === 201 || res.status === 204 || res.status === 405 || res.status === 409) {
        continue
      }
    } catch {
      /* le PUT tentera quand même */
    }
  }
}

export async function webdavPut({ base, token, relPath, buf, contentType }) {
  const headers = authHeaders(token)
  await webdavEnsureParents(base, relPath, token)
  const url = joinUrl(base, relPath)
  const up = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: buf,
  })
  if (!up.ok && up.status !== 201 && up.status !== 204) {
      const t = await up.text().catch(() => '')
      throw httpError(`WebDAV PUT HTTP ${up.status}${t ? ` — ${t.slice(0, 120)}` : ''}`, up.status)
  }
  return { ok: true }
}

export async function webdavGet({ base, token, relPath }) {
  const headers = authHeaders(token)
  const url = joinUrl(base, relPath)
  const get = await fetch(url, { method: 'GET', headers })
  if (!get.ok) {
    throw httpError(`WebDAV GET HTTP ${get.status}`, get.status)
  }
  const ab = await get.arrayBuffer()
  return {
    buf: Buffer.from(ab),
    contentType: get.headers.get('content-type') || 'application/octet-stream',
  }
}

export async function webdavExists({ base, token, relPath }) {
  const headers = authHeaders(token)
  const url = joinUrl(base, relPath)
  try {
    const head = await fetch(url, { method: 'HEAD', headers })
    if (head.ok || head.status === 200 || head.status === 204) return { ok: true, exists: true }
    if (head.status === 404) return { ok: true, exists: false }
    if (head.status === 405 || head.status === 501) {
      /* HEAD non supporté */
    } else {
      return { ok: true, exists: false, unsupported: false, status: head.status }
    }
  } catch {
    /* HEAD → GET */
  }
  const probe = await fetch(url, { method: 'GET', headers })
  if (probe.ok) return { ok: true, exists: true }
  if (probe.status === 404) return { ok: true, exists: false }
  return {
    ok: true,
    exists: false,
    unsupported: probe.status === 405 || probe.status === 501,
    status: probe.status,
  }
}

export async function webdavPing({ base, token }) {
  const headers = {
    ...authHeaders(token),
    Depth: '0',
    'Content-Type': 'application/xml',
  }
  const url = String(base || '').replace(/\/+$/, '')
  try {
    const res = await fetch(url, { method: 'PROPFIND', headers })
    if (res.status === 401 || res.status === 403) {
      throw httpError(`WebDAV PING HTTP ${res.status}`, res.status)
    }
    if (res.status === 507) throw httpError(`WebDAV PING HTTP ${res.status}`, res.status)
    if (res.ok || res.status === 207 || res.status === 404 || res.status === 405 || res.status === 409) {
      return { ok: true }
    }
    if (res.status >= 500) throw httpError(`WebDAV PING HTTP ${res.status}`, res.status)
    return { ok: true }
  } catch (err) {
    if (err?.status) throw err
    try {
      const opt = await fetch(url, { method: 'OPTIONS', headers: authHeaders(token) })
      if (opt.status === 401 || opt.status === 403) {
        throw httpError(`WebDAV PING HTTP ${opt.status}`, opt.status)
      }
      if (opt.ok || opt.status === 200 || opt.status === 204 || opt.status === 404) return { ok: true }
    } catch (inner) {
      if (inner?.status) throw inner
    }
    throw httpError(err instanceof Error ? err.message : 'WebDAV injoignable', 0)
  }
}
