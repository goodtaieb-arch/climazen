/**
 * « Tester la connexion et les droits » — écriture réelle d’un fichier
 * test-climazen.txt dans le Drive / OneDrive / SharePoint visé, puis nettoyage.
 * Un lien valide ne suffit pas : c’est le droit Éditeur qui est vérifié ici.
 */

export const TEST_FILE_NAME = 'test-climazen.txt'

export function testFileContent(now = new Date()) {
  return [
    'Test ClimaZEN — vérification des droits d’écriture.',
    `Date : ${now.toISOString()}`,
    'Ce fichier est créé puis supprimé automatiquement.',
    '',
  ].join('\n')
}

/** Dossier Google Drive visé par un lien collé (dossier, fichier ou ?id=). */
export function extractGoogleDriveFolderId(href) {
  const raw = String(href || '').trim()
  if (!raw) return ''
  let u
  try {
    u = new URL(raw)
  } catch {
    return ''
  }
  const fromQuery = u.searchParams.get('id')
  if (fromQuery && /^[\w-]{10,}$/.test(fromQuery)) return fromQuery
  const folder = u.pathname.match(/\/folders\/([\w-]{10,})/)
  if (folder?.[1]) return folder[1]
  const file = u.pathname.match(/\/file\/d\/([\w-]{10,})/)
  if (file?.[1]) return file[1]
  const drive = u.pathname.match(/\/drive\/u\/\d+\/folders\/([\w-]{10,})/)
  if (drive?.[1]) return drive[1]
  return ''
}

/** Identifiant de partage Microsoft Graph (`/shares/{id}`) pour une URL OneDrive / SharePoint. */
export function graphShareId(href) {
  const raw = String(href || '').trim()
  if (!raw) return ''
  return `u!${Buffer.from(raw, 'utf8').toString('base64url')}`
}

export function detectCloudProviderFromUrl(href) {
  const raw = String(href || '').trim()
  if (!raw) return ''
  let host = ''
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return ''
  }
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'google'
  if (host === 'onedrive.live.com' || host === '1drv.ms') return 'microsoft'
  if (host === 'sharepoint.com' || host.endsWith('.sharepoint.com')) return 'microsoft'
  return ''
}

async function readError(res) {
  const text = await res.text().catch(() => '')
  try {
    const json = JSON.parse(text)
    return String(
      json?.error?.message || json?.error_description || json?.error || text || res.statusText,
    ).slice(0, 300)
  } catch {
    return String(text || res.statusText).slice(0, 300)
  }
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

export async function runGoogleWriteTest(opts) {
  const { accessToken, folderId } = opts
  const boundary = `climazen-${Math.random().toString(36).slice(2)}`
  const metadata = {
    name: TEST_FILE_NAME,
    mimeType: 'text/plain',
    ...(folderId ? { parents: [folderId] } : {}),
  }
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    testFileContent(),
    `--${boundary}--`,
    '',
  ].join('\r\n')

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )
  if (!res.ok) {
    const detail = await readError(res)
    if (res.status === 404 && folderId) {
      return {
        ok: false,
        message:
          'Google Drive : dossier introuvable pour ClimaZEN. Partagez-le en mode Éditeur avec notre compte de service, ou reconnectez Google Drive et choisissez un dossier créé par ClimaZEN.',
        detail,
      }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message:
          'Google Drive : droit d’écriture refusé. Le dossier doit être partagé en mode Éditeur (pas Lecteur).',
        detail,
      }
    }
    return { ok: false, message: `Google Drive : écriture refusée (${res.status}).`, detail }
  }

  const created = await res.json().catch(() => ({}))
  const fileId = String(created?.id || '')
  const cleaned = await deleteGoogleFile(accessToken, fileId)
  return {
    ok: true,
    fileId,
    cleaned,
    message: cleaned
      ? `Google Drive : écriture OK — ${TEST_FILE_NAME} a été créé puis supprimé. Les droits sont bons.`
      : `Google Drive : écriture OK — ${TEST_FILE_NAME} a été créé (suppression automatique impossible, retirez-le à la main).`,
  }
}

async function deleteGoogleFile(accessToken, fileId) {
  if (!fileId) return false
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    )
    return res.ok || res.status === 204
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Microsoft Graph (OneDrive / SharePoint)
// ---------------------------------------------------------------------------

/** Résout le dossier ciblé par un lien de partage → { driveId, itemId }. */
async function resolveGraphFolder(accessToken, shareUrl) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${graphShareId(shareUrl)}/driveItem?$select=id,name,folder,parentReference`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    return { ok: false, status: res.status, detail: await readError(res) }
  }
  const item = await res.json().catch(() => ({}))
  const driveId = String(item?.parentReference?.driveId || '')
  const itemId = String(item?.id || '')
  if (!driveId || !itemId) {
    return { ok: false, status: 0, detail: 'Réponse Microsoft Graph incomplète.' }
  }
  if (!item?.folder) {
    return { ok: false, status: 0, detail: 'Le lien pointe vers un fichier, pas vers un dossier.' }
  }
  return { ok: true, driveId, itemId }
}

export async function runMicrosoftWriteTest(opts) {
  const { accessToken, shareUrl } = opts
  let uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(TEST_FILE_NAME)}:/content`
  let deleteBase = 'https://graph.microsoft.com/v1.0/me/drive/items'

  if (shareUrl) {
    const folder = await resolveGraphFolder(accessToken, shareUrl)
    if (!folder.ok) {
      if (folder.status === 401 || folder.status === 403) {
        return {
          ok: false,
          message:
            'OneDrive / SharePoint : accès refusé sur ce lien. Le compte connecté doit être Éditeur du dossier.',
          detail: folder.detail,
        }
      }
      return {
        ok: false,
        message:
          'OneDrive / SharePoint : dossier introuvable depuis ce lien. Vérifiez le lien et le partage en mode Éditeur.',
        detail: folder.detail,
      }
    }
    uploadUrl = `https://graph.microsoft.com/v1.0/drives/${folder.driveId}/items/${folder.itemId}:/${encodeURIComponent(TEST_FILE_NAME)}:/content`
    deleteBase = `https://graph.microsoft.com/v1.0/drives/${folder.driveId}/items`
  }

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    },
    body: testFileContent(),
  })
  if (!res.ok) {
    const detail = await readError(res)
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message:
          'OneDrive / SharePoint : droit d’écriture refusé. Le dossier doit être partagé en mode Éditeur (pas Lecture seule).',
        detail,
      }
    }
    return {
      ok: false,
      message: `OneDrive / SharePoint : écriture refusée (${res.status}).`,
      detail,
    }
  }

  const created = await res.json().catch(() => ({}))
  const itemId = String(created?.id || '')
  const cleaned = await deleteGraphItem(accessToken, deleteBase, itemId)
  return {
    ok: true,
    fileId: itemId,
    cleaned,
    message: cleaned
      ? `OneDrive / SharePoint : écriture OK — ${TEST_FILE_NAME} a été créé puis supprimé. Les droits sont bons.`
      : `OneDrive / SharePoint : écriture OK — ${TEST_FILE_NAME} a été créé (suppression automatique impossible, retirez-le à la main).`,
  }
}

async function deleteGraphItem(accessToken, deleteBase, itemId) {
  if (!itemId) return false
  try {
    const res = await fetch(`${deleteBase}/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return res.ok || res.status === 204
  } catch {
    return false
  }
}
