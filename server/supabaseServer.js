/**
 * Helpers serveur — hors /api pour que Vercel ne les déploie pas comme des fonctions.
 * Importés par les routes /api/*.js.
 */
export function getSupabaseConfig() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  return { supabaseUrl, serviceKey, anonKey }
}

export async function supabaseRest(path, opts = {}) {
  const { supabaseUrl, serviceKey } = getSupabaseConfig()
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service role non configuré sur le serveur.')
  }
  const url = `${supabaseUrl}/rest/v1/${path}`
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText
    throw new Error(msg)
  }
  return data
}

export async function supabaseRpc(fn, body = {}) {
  const { supabaseUrl, serviceKey } = getSupabaseConfig()
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service role non configuré.')
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText
    throw new Error(msg)
  }
  return data
}

export async function verifySupabaseUser(req) {
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  const { supabaseUrl, anonKey } = getSupabaseConfig()
  if (!supabaseUrl || !anonKey) return null
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!r.ok) return null
  return r.json()
}

export async function userOrgProfile(userId) {
  const rows = await supabaseRest(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=organization_id,email,role,full_name&limit=1`,
  )
  return rows?.[0] || null
}
