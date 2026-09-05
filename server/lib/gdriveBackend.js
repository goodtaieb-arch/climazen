/**
 * Google Drive API — refresh token (collé par le gérant), jamais exposé au bureau.
 */

function encodeQ(name) {
  return String(name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function gdriveAccessToken(cfg) {
  const clientId = String(cfg.gdriveClientId || '').trim()
  const clientSecret = String(cfg.gdriveClientSecret || '').trim()
  const refresh = String(cfg.gdriveRefreshToken || '').trim()
  if (!clientId || !clientSecret || !refresh) {
    throw new Error('Google Drive : client id / secret / refresh token manquants.')
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refresh,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(`Google Drive token HTTP ${res.status}`)
  }
  return data.access_token
}

async function driveFindChild(token, parentId, name, folder) {
  const q = [
    `'${parentId}' in parents`,
    `name = '${encodeQ(name)}'`,
    'trashed = false',
    folder
      ? "mimeType = 'application/vnd.google-apps.folder'"
      : "mimeType != 'application/vnd.google-apps.folder'",
  ].join(' and ')
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Google Drive list HTTP ${res.status}`)
  return data.files?.[0] || null
}

async function driveMkFolder(token, parentId, name) {
  const existing = await driveFindChild(token, parentId, name, true)
  if (existing?.id) return existing.id
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.id) throw new Error(`Google Drive MKDIR HTTP ${res.status}`)
  return data.id
}

async function driveEnsurePath(token, rootId, relPath) {
  const parts = String(relPath || '')
    .split('/')
    .filter(Boolean)
  const fileName = parts.pop()
  let parent = rootId
  for (const p of parts) {
    parent = await driveMkFolder(token, parent, p)
  }
  return { parentId: parent, fileName }
}

export async function gdrivePut({ cfg, relPath, buf, contentType }) {
  const token = await gdriveAccessToken(cfg)
  const root = String(cfg.gdriveFolderId || 'root').trim() || 'root'
  const { parentId, fileName } = await driveEnsurePath(token, root, relPath)
  const existing = await driveFindChild(token, parentId, fileName, false)
  const mime = contentType || 'application/octet-stream'
  if (existing?.id) {
    const up = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mime,
        },
        body: buf,
      },
    )
    if (!up.ok) throw new Error(`Google Drive PATCH HTTP ${up.status}`)
    return { ok: true }
  }
  const meta = JSON.stringify({ name: fileName, parents: [parentId] })
  const boundary = `cz_${Date.now().toString(16)}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--`)
  const body = Buffer.concat([head, buf, tail])
  const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!up.ok) throw new Error(`Google Drive POST HTTP ${up.status}`)
  return { ok: true }
}

export async function gdriveGet({ cfg, relPath }) {
  const token = await gdriveAccessToken(cfg)
  const root = String(cfg.gdriveFolderId || 'root').trim() || 'root'
  const parts = String(relPath || '')
    .split('/')
    .filter(Boolean)
  const fileName = parts.pop()
  let parent = root
  for (const p of parts) {
    const folder = await driveFindChild(token, parent, p, true)
    if (!folder?.id) {
      const err = new Error('Google Drive GET HTTP 404')
      err.status = 404
      throw err
    }
    parent = folder.id
  }
  const file = await driveFindChild(token, parent, fileName, false)
  if (!file?.id) {
    const err = new Error('Google Drive GET HTTP 404')
    err.status = 404
    throw err
  }
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    const err = new Error(`Google Drive GET HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  const ab = await res.arrayBuffer()
  return {
    buf: Buffer.from(ab),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  }
}

export async function gdriveExists({ cfg, relPath }) {
  try {
    await gdriveGet({ cfg, relPath })
    return { ok: true, exists: true }
  } catch (err) {
    if (err?.status === 404) return { ok: true, exists: false }
    throw err
  }
}
