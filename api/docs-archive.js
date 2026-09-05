/**
 * Proxy archive documents — ClimaZEN ne stocke pas les PDF.
 * PUT/GET vers le serveur privé société (WebDAV / NAS / Nextcloud).
 * Le bureau n’ouvre jamais le NAS : l’app parle à sa place.
 */

function bad(res, status, message) {
  res.status(status).json({ ok: false, error: message, message })
}

function safeRelPath(raw) {
  const p = String(raw || '')
    .replace(/^\/+/, '')
    .trim()
  if (!p || p.length > 500) return ''
  if (p.includes('..') || p.includes('\\') || p.includes('\0')) return ''
  if (!p.startsWith('ClimaZEN/')) return ''
  return p
}

function safeBase(raw) {
  const s = String(raw || '').trim()
  if (!s || s.length > 2000) return ''
  let u
  try {
    u = new URL(s)
  } catch {
    return ''
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
  return s.replace(/\/+$/, '')
}

function joinUrl(base, relPath) {
  const parts = relPath.split('/').filter(Boolean).map(encodeURIComponent)
  return `${base}/${parts.join('/')}`
}

function authHeaders(token) {
  const headers = {}
  if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  return headers
}

/** Crée les dossiers parents (WebDAV MKCOL) pour que le PUT soit fluide. */
async function ensureParents(base, relPath, headers) {
  const parts = relPath.split('/').filter(Boolean)
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    bad(res, 405, 'POST requis')
    return
  }

  const body = req.body || {}
  const action = String(body.action || '')
  const base = safeBase(body.baseUrl)
  const relPath = safeRelPath(body.relPath)
  const token = String(body.token || '').trim()

  if (!base) {
    bad(res, 400, 'URL serveur privé invalide.')
    return
  }
  if (!relPath) {
    bad(res, 400, 'Chemin document invalide.')
    return
  }
  if (action !== 'put' && action !== 'get') {
    bad(res, 400, 'Action inconnue.')
    return
  }

  const url = joinUrl(base, relPath)
  const headers = authHeaders(token)

  try {
    if (action === 'put') {
      const b64 = String(body.contentBase64 || '')
      if (!b64 || b64.length > 14_000_000) {
        bad(res, 400, 'Fichier trop volumineux ou vide (max ~10 Mo).')
        return
      }
      const buf = Buffer.from(b64, 'base64')
      if (buf.length > 10_000_000) {
        bad(res, 400, 'Fichier trop volumineux (max 10 Mo).')
        return
      }
      await ensureParents(base, relPath, headers)
      const up = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': String(body.contentType || 'application/octet-stream'),
        },
        body: buf,
      })
      if (!up.ok && up.status !== 201 && up.status !== 204) {
        bad(
          res,
          502,
          `NAS / serveur privé HTTP ${up.status}. Vérifiez l’URL, le jeton et que le dossier ClimaZEN/Documents existe.`,
        )
        return
      }
      res.status(200).json({ ok: true, message: `Archivé hors site : ${relPath}` })
      return
    }

    const get = await fetch(url, { method: 'GET', headers })
    if (!get.ok) {
      bad(res, get.status === 404 ? 404 : 502, `Document introuvable dans l’archive (${get.status}).`)
      return
    }
    const ab = await get.arrayBuffer()
    if (ab.byteLength > 10_000_000) {
      bad(res, 400, 'Fichier trop volumineux.')
      return
    }
    const contentType = get.headers.get('content-type') || 'application/pdf'
    res.status(200).json({
      ok: true,
      contentBase64: Buffer.from(ab).toString('base64'),
      contentType,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erreur réseau'
    bad(res, 502, `Serveur privé injoignable (${msg}).`)
  }
}
