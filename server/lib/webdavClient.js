/**
 * Client WebDAV (NAS / Nextcloud / rclone) — utilisé uniquement côté serveur.
 */

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
    throw new Error(`WebDAV PUT HTTP ${up.status}`)
  }
  return { ok: true }
}

export async function webdavGet({ base, token, relPath }) {
  const headers = authHeaders(token)
  const url = joinUrl(base, relPath)
  const get = await fetch(url, { method: 'GET', headers })
  if (!get.ok) {
    const err = new Error(`WebDAV GET HTTP ${get.status}`)
    err.status = get.status
    throw err
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
