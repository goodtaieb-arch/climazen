/**
 * Microsoft Graph — OneDrive / SharePoint.
 * Refresh token (délégué) ou client credentials + drive id.
 */

async function graphToken(cfg) {
  const tenant = String(cfg.graphTenantId || 'common').trim() || 'common'
  const clientId = String(cfg.graphClientId || '').trim()
  const clientSecret = String(cfg.graphClientSecret || '').trim()
  const refresh = String(cfg.graphRefreshToken || '').trim()
  if (!clientId || !clientSecret) {
    throw new Error('OneDrive / Graph : client id / secret manquants.')
  }
  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`
  const params = refresh
    ? {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default offline_access Files.ReadWrite',
      }
    : {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(`Graph token HTTP ${res.status}`)
  }
  return data.access_token
}

function itemPath(cfg, relPath) {
  const folder = String(cfg.graphFolderPath || '')
    .replace(/^\/+|\/+$/g, '')
  const rel = String(relPath || '').replace(/^\/+/, '')
  const full = folder ? `${folder}/${rel}` : rel
  const encoded = full
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  const driveId = String(cfg.graphDriveId || '').trim()
  if (driveId) {
    return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encoded}`
  }
  return `https://graph.microsoft.com/v1.0/me/drive/root:/${encoded}`
}

export async function onedrivePut({ cfg, relPath, buf, contentType }) {
  const token = await graphToken(cfg)
  const base = itemPath(cfg, relPath)
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': contentType || 'application/octet-stream',
  }
  if (buf.length <= 4_000_000) {
    const up = await fetch(`${base}:/content`, { method: 'PUT', headers, body: buf })
    if (!up.ok && up.status !== 201 && up.status !== 200) {
      throw new Error(`Graph PUT HTTP ${up.status}`)
    }
    return { ok: true }
  }
  const session = await fetch(`${base}:/createUploadSession`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: { '@microsoft.graph.conflictBehavior': 'replace' },
    }),
  })
  const sess = await session.json().catch(() => ({}))
  if (!session.ok || !sess.uploadUrl) {
    throw new Error(`Graph upload session HTTP ${session.status}`)
  }
  const chunk = 327680 * 10
  let offset = 0
  while (offset < buf.length) {
    const end = Math.min(offset + chunk, buf.length)
    const part = buf.subarray(offset, end)
    const put = await fetch(sess.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(part.length),
        'Content-Range': `bytes ${offset}-${end - 1}/${buf.length}`,
      },
      body: part,
    })
    if (!put.ok && put.status !== 202 && put.status !== 201 && put.status !== 200) {
      throw new Error(`Graph chunk HTTP ${put.status}`)
    }
    offset = end
  }
  return { ok: true }
}

export async function onedriveGet({ cfg, relPath }) {
  const token = await graphToken(cfg)
  const res = await fetch(`${itemPath(cfg, relPath)}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  })
  if (!res.ok) {
    const err = new Error(`Graph GET HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  const ab = await res.arrayBuffer()
  return {
    buf: Buffer.from(ab),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  }
}

export async function onedriveExists({ cfg, relPath }) {
  try {
    const token = await graphToken(cfg)
    const res = await fetch(itemPath(cfg, relPath), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return { ok: true, exists: true }
    if (res.status === 404) return { ok: true, exists: false }
    return { ok: true, exists: false, status: res.status }
  } catch (err) {
    if (err?.status === 404) return { ok: true, exists: false }
    throw err
  }
}
