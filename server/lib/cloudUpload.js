/**
 * Upload réel d'un document généré (PDF…) vers Google Drive ou OneDrive/SharePoint,
 * avec création automatique de l'arborescence de dossiers ClimaZEN si absente.
 *
 * Contrairement à cloudWriteTest.js (fichier texte jetable, pour « Tester la
 * connexion »), ce module écrit le vrai fichier binaire et le laisse en place,
 * dans un dossier nommé et retrouvable (pas la racine du Drive).
 */

import { readError, resolveGraphFolder } from './cloudWriteTest.js'

function escapeDriveQueryValue(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

async function findOrCreateGoogleFolder(accessToken, name, parentId) {
  const q = `name='${escapeDriveQueryValue(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (listRes.ok) {
    const data = await listRes.json().catch(() => ({}))
    const found = data?.files?.[0]
    if (found?.id) return found.id
  }
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    },
  )
  if (!createRes.ok) {
    const detail = await readError(createRes)
    throw new Error(`Google Drive : création du dossier « ${name} » impossible — ${detail}`)
  }
  const created = await createRes.json().catch(() => ({}))
  const id = String(created?.id || '')
  if (!id) throw new Error(`Google Drive : création du dossier « ${name} » — réponse invalide.`)
  return id
}

/** Crée (si besoin) toute la chaîne de dossiers et retourne l'id du dernier. */
export async function ensureGoogleFolderPath(accessToken, segments, rootFolderId) {
  let parentId = rootFolderId || 'root'
  for (const segment of segments) {
    parentId = await findOrCreateGoogleFolder(accessToken, segment, parentId)
  }
  return parentId
}

export async function uploadGoogleFile(accessToken, { folderId, fileName, contentType, buffer }) {
  const boundary = `climazen-${Math.random().toString(36).slice(2)}`
  const metadata = {
    name: fileName,
    mimeType: contentType,
    ...(folderId ? { parents: [folderId] } : {}),
  }
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    'utf8',
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  const body = Buffer.concat([head, buffer, tail])

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
    return { ok: false, message: `Google Drive : envoi du fichier refusé (${res.status}).`, detail }
  }
  const created = await res.json().catch(() => ({}))
  return { ok: true, fileId: String(created?.id || ''), url: String(created?.webViewLink || '') }
}

// ---------------------------------------------------------------------------
// Microsoft Graph (OneDrive / SharePoint)
// ---------------------------------------------------------------------------

async function graphChildrenUrl(loc) {
  return loc.driveId
    ? `https://graph.microsoft.com/v1.0/drives/${loc.driveId}/items/${loc.itemId}/children`
    : `https://graph.microsoft.com/v1.0/me/drive/root/children`
}

async function findOrCreateGraphFolder(accessToken, name, loc) {
  const listUrl = `${await graphChildrenUrl(loc)}?$select=id,name,folder&$top=200`
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (listRes.ok) {
    const data = await listRes.json().catch(() => ({}))
    const found = (data?.value || []).find((it) => it?.folder && it?.name === name)
    if (found?.id) return { driveId: loc.driveId, itemId: found.id }
  }
  const createRes = await fetch(await graphChildrenUrl(loc), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
  })
  if (createRes.ok) {
    const created = await createRes.json().catch(() => ({}))
    return { driveId: loc.driveId, itemId: String(created?.id || '') }
  }
  // 409 = créé entre-temps (concurrence) → le retrouver plutôt qu'échouer.
  if (createRes.status === 409) {
    const retryRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (retryRes.ok) {
      const data = await retryRes.json().catch(() => ({}))
      const found = (data?.value || []).find((it) => it?.folder && it?.name === name)
      if (found?.id) return { driveId: loc.driveId, itemId: found.id }
    }
  }
  const detail = await readError(createRes)
  throw new Error(`OneDrive / SharePoint : création du dossier « ${name} » impossible — ${detail}`)
}

/**
 * Crée (si besoin) toute la chaîne de dossiers et retourne son emplacement.
 * `rootLoc` : {} = racine du OneDrive connecté, ou {driveId,itemId} résolu depuis un lien partagé.
 */
export async function ensureGraphFolderPath(accessToken, segments, rootLoc) {
  let loc = rootLoc || {}
  for (const segment of segments) {
    loc = await findOrCreateGraphFolder(accessToken, segment, loc)
  }
  return loc
}

export async function uploadMicrosoftFile(accessToken, { folderLoc, fileName, contentType, buffer }) {
  const uploadUrl = folderLoc?.itemId
    ? `https://graph.microsoft.com/v1.0/drives/${folderLoc.driveId}/items/${folderLoc.itemId}:/${encodeURIComponent(fileName)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fileName)}:/content`

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
    body: buffer,
  })
  if (!res.ok) {
    const detail = await readError(res)
    return { ok: false, message: `OneDrive / SharePoint : envoi du fichier refusé (${res.status}).`, detail }
  }
  const created = await res.json().catch(() => ({}))
  return {
    ok: true,
    fileId: String(created?.id || ''),
    url: String(created?.webUrl || created?.['@microsoft.graph.downloadUrl'] || ''),
  }
}

export { resolveGraphFolder }
