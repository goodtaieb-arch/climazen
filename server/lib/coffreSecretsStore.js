/**
 * Secrets coffre-fort — table service-role only, repli org_data.payload (héritage).
 */

import { supabaseRest } from './supabaseServer.js'

export const COFFRE_SECRET_KEYS = [
  'serveurPriveDocsUrl',
  'serveurPriveDocsToken',
  'serveurCloudDocsUrl',
  'serveurCloudDocsToken',
  'lienCloudDocsRacine',
  'coffreExcelMotDePasse',
  's3Bucket',
  's3Region',
  's3Prefix',
  's3Endpoint',
  's3AccessKey',
  's3SecretKey',
  'gdriveClientId',
  'gdriveClientSecret',
  'gdriveRefreshToken',
  'gdriveFolderId',
  'graphTenantId',
  'graphClientId',
  'graphClientSecret',
  'graphRefreshToken',
  'graphDriveId',
  'graphFolderPath',
]

export const COFFRE_PUBLIC_KEYS = ['docsDestNas', 'docsDestCloud', 'cloudProvider', 'coffreActif']

export function pickSecrets(op) {
  const out = {}
  if (!op || typeof op !== 'object') return out
  for (const k of COFFRE_SECRET_KEYS) {
    const v = op[k]
    if (v == null) continue
    const s = String(v).trim()
    if (s) out[k] = s
  }
  for (const k of COFFRE_PUBLIC_KEYS) {
    if (op[k] !== undefined) out[k] = op[k]
  }
  return out
}

export function computeCoffreActif(cfg) {
  if (!cfg) return false
  const nas = cfg.docsDestNas !== false && Boolean(String(cfg.serveurPriveDocsUrl || '').trim())
  const provider = String(cfg.cloudProvider || 'webdav')
  let cloud = false
  if (cfg.docsDestCloud === true) {
    if (provider === 's3') {
      cloud = Boolean(cfg.s3Bucket && cfg.s3AccessKey && cfg.s3SecretKey)
    } else if (provider === 'gdrive') {
      cloud = Boolean(cfg.gdriveRefreshToken && cfg.gdriveClientId && cfg.gdriveClientSecret)
    } else if (provider === 'onedrive') {
      cloud = Boolean(
        cfg.graphClientId &&
          cfg.graphClientSecret &&
          (cfg.graphRefreshToken || cfg.graphDriveId),
      )
    } else {
      cloud = Boolean(String(cfg.serveurCloudDocsUrl || '').trim())
    }
  }
  return Boolean(nas || cloud)
}

async function loadFromTable(orgId) {
  const rows = await supabaseRest(
    `organization_coffre_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=secrets,coffre_actif&limit=1`,
  )
  const row = rows?.[0]
  if (!row) return null
  const secrets = row.secrets && typeof row.secrets === 'object' ? row.secrets : {}
  return { ...secrets, coffreActif: row.coffre_actif === true || secrets.coffreActif === true }
}

async function loadFromOrgData(orgId) {
  const rows = await supabaseRest(
    `org_data?organization_id=eq.${encodeURIComponent(orgId)}&select=payload&limit=1`,
  )
  const op = rows?.[0]?.payload?.operateur || {}
  return pickSecrets(op)
}

export async function loadOrgPayload(orgId) {
  const rows = await supabaseRest(
    `org_data?organization_id=eq.${encodeURIComponent(orgId)}&select=payload,updated_at&limit=1`,
  )
  return rows?.[0] || { payload: {}, updated_at: null }
}

export async function loadCoffreConfig(orgId) {
  let tableCfg = null
  try {
    tableCfg = await loadFromTable(orgId)
  } catch {
    tableCfg = null
  }
  const payloadCfg = await loadFromOrgData(orgId)
  const merged = { ...payloadCfg, ...(tableCfg || {}) }
  if (merged.coffreActif == null) merged.coffreActif = computeCoffreActif(merged)
  return merged
}

export async function saveCoffreConfig(orgId, incoming, actorUserId) {
  const prev = await loadCoffreConfig(orgId)
  const next = { ...prev }
  const src = incoming && typeof incoming === 'object' ? incoming : {}
  for (const k of [...COFFRE_SECRET_KEYS, ...COFFRE_PUBLIC_KEYS]) {
    if (src[k] === undefined) continue
    if (k === 'docsDestNas' || k === 'docsDestCloud' || k === 'coffreActif') {
      next[k] = Boolean(src[k])
      if (k === 'docsDestNas' && src[k] === false) next[k] = false
      continue
    }
    if (k === 'cloudProvider') {
      const p = String(src[k] || 'webdav')
      next[k] = ['webdav', 'gdrive', 'onedrive', 's3'].includes(p) ? p : 'webdav'
      continue
    }
    const s = String(src[k] ?? '').trim()
    if (s) next[k] = s
    else delete next[k]
  }
  if (src.docsDestNas === false) next.docsDestNas = false
  if (src.docsDestNas === true) next.docsDestNas = true
  if (src.docsDestCloud === true) next.docsDestCloud = true
  if (src.docsDestCloud === false) next.docsDestCloud = false
  next.coffreActif = computeCoffreActif(next)
  const payload = {
    organization_id: orgId,
    secrets: pickSecrets(next),
    coffre_actif: next.coffreActif,
    updated_at: new Date().toISOString(),
    updated_by_user_id: actorUserId || null,
  }
  try {
    const existing = await supabaseRest(
      `organization_coffre_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=organization_id&limit=1`,
    )
    if (existing?.[0]) {
      await supabaseRest(`organization_coffre_secrets?organization_id=eq.${encodeURIComponent(orgId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        prefer: 'return=minimal',
      })
    } else {
      await supabaseRest('organization_coffre_secrets', {
        method: 'POST',
        body: JSON.stringify(payload),
        prefer: 'return=minimal',
      })
    }
    return { ok: true, stored: 'table', coffreActif: next.coffreActif, config: next }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'table'
    try {
      const { payload, updated_at } = await loadOrgPayload(orgId)
      const operateur = { ...(payload.operateur || {}), ...pickSecrets(next), coffreActif: next.coffreActif }
      await supabaseRest(`org_data?organization_id=eq.${encodeURIComponent(orgId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          payload: { ...payload, operateur },
          updated_at: updated_at || new Date().toISOString(),
        }),
        prefer: 'return=minimal',
      })
      return {
        ok: true,
        stored: 'payload',
        coffreActif: next.coffreActif,
        config: next,
        warning:
          'Table organization_coffre_secrets absente — jetons encore dans org_data. Exécutez supabase/org-coffre-secrets.sql.',
      }
    } catch {
      return {
        ok: false,
        error: `Coffre secrets : ${msg}. Exécutez supabase/org-coffre-secrets.sql dans Supabase.`,
        coffreActif: next.coffreActif,
        config: next,
      }
    }
  }
}

export function publicCoffreView(cfg) {
  return {
    coffreActif: computeCoffreActif(cfg),
    docsDestNas: cfg?.docsDestNas !== false,
    docsDestCloud: cfg?.docsDestCloud === true,
    cloudProvider: ['webdav', 'gdrive', 'onedrive', 's3'].includes(cfg?.cloudProvider)
      ? cfg.cloudProvider
      : 'webdav',
  }
}
