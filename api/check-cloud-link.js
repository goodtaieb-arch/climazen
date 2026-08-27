/**
 * Vercel Serverless — /api/check-cloud-link
 * Vérifie qu’un lien Drive / OneDrive / SharePoint n’est PAS public.
 * Sondage anonyme (sans cookies) : page de connexion → privé OK ;
 * contenu accessible sans compte → public → on refuse.
 */

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isAllowedHost(host) {
  if (host === 'drive.google.com' || host === 'docs.google.com') return true
  if (host === 'onedrive.live.com' || host === '1drv.ms') return true
  if (host.endsWith('.sharepoint.com') || host === 'sharepoint.com') return true
  return false
}

function isDriveHost(host) {
  return host === 'drive.google.com' || host === 'docs.google.com'
}

function normalizeHttps(raw) {
  const s = String(raw || '').trim()
  if (!s || s.length > 2000) return ''
  let u
  try {
    u = new URL(s)
  } catch {
    return ''
  }
  if (u.protocol !== 'https:') return ''
  return u.href
}

function classify(href) {
  const u = new URL(href)
  const host = u.hostname.toLowerCase()
  if (!isAllowedHost(host)) return 'invalid'
  const path = u.pathname
  const q = u.search.toLowerCase()
  const full = href.toLowerCase()
  if (host === '1drv.ms') return 'public'
  if (/guestaccesstoken|nauth=1|anonymous=true/.test(q)) return 'public'
  if (full.includes('uc?export=download') || full.includes('/uc?id=')) return 'public'
  if (/\/:[a-z]:\/g\//i.test(path)) return 'public'
  if (host.endsWith('.sharepoint.com') && (u.searchParams.has('e') || u.searchParams.has('share'))) {
    if (/\/:[a-z]:\/g\//i.test(path) || /\/:[a-z]:\/s\//i.test(path)) return 'public'
  }
  return 'needs_probe'
}

function extractGoogleDriveId(href) {
  try {
    const u = new URL(href)
    const fromQuery = u.searchParams.get('id')
    if (fromQuery && /^[\w-]{10,}$/.test(fromQuery)) return fromQuery
    const folder = u.pathname.match(/\/folders\/([\w-]{10,})/)
    if (folder?.[1]) return folder[1]
    const file = u.pathname.match(/\/file\/d\/([\w-]{10,})/)
    if (file?.[1]) return file[1]
  } catch {
    return ''
  }
  return ''
}

const PUBLIC_MARKERS =
  /anyoneWithLink|anyone with the link|toute personne disposant du lien|"visibility"\s*:\s*"anyone"|flip-entry|google-ds-entry/i

const LOGIN_MARKERS =
  /accounts\.google\.com|ServiceLogin|signin\/identifier|login\.microsoftonline\.com|you need access|you need permission|demander l.acc[eè]s|sign in to continue|connexion requise|choisissez un compte/i

const PUBLIC_MSG =
  'Ce dossier est public (« toute personne avec le lien »). Action arrêtée. Dans Drive / OneDrive : Partager → Restreint, uniquement les comptes autorisés.'

const UNVERIFIABLE_MSG =
  'Impossible de vérifier que le dossier n’est pas public. Action arrêtée.'

async function readLimited(res, max = 180000) {
  const text = await res.text()
  return text.slice(0, max)
}

async function probe(url, signal) {
  return fetch(url, {
    method: 'GET',
    redirect: 'manual',
    signal,
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; ClimaZEN-link-guard/1.0; +https://climazen.fr)',
    },
  })
}

function locationOf(res) {
  return res.headers.get('location') || ''
}

function isLoginRedirect(loc) {
  return /accounts\.google\.com|ServiceLogin|login\.microsoftonline\.com|login\.live\.com/i.test(
    loc,
  )
}

/** @returns {'restricted' | 'public' | 'unknown'} */
function verdictFromResponse(res, html, loc) {
  if (res.status === 401 || res.status === 403) return 'restricted'
  if ([301, 302, 303, 307, 308].includes(res.status) && isLoginRedirect(loc)) return 'restricted'
  if (isLoginRedirect(res.url || '') || isLoginRedirect(loc)) return 'restricted'
  if (LOGIN_MARKERS.test(html) && !PUBLIC_MARKERS.test(html)) return 'restricted'
  if (PUBLIC_MARKERS.test(html)) return 'public'
  if (res.status === 200 && html.length > 400 && !LOGIN_MARKERS.test(html)) {
    if (/drive\.google|onedrive|sharepoint|folder|fichier/i.test(html)) return 'public'
    return 'unknown'
  }
  return 'unknown'
}

async function probeGoogle(href, signal) {
  const id = extractGoogleDriveId(href)
  const targets = []
  if (id) {
    targets.push(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}`)
  }
  targets.push(href)

  let sawRestricted = false
  for (const target of targets) {
    const res = await probe(target, signal)
    const loc = locationOf(res)
    let html = ''
    if (res.status === 200) html = await readLimited(res)
    const v = verdictFromResponse(res, html, loc)
    if (v === 'public') return 'public'
    if (v === 'restricted') sawRestricted = true
  }
  return sawRestricted ? 'restricted' : 'unknown'
}

async function probeMicrosoft(href, signal) {
  const res = await probe(href, signal)
  const loc = locationOf(res)
  let html = ''
  if (res.status === 200) html = await readLimited(res)
  return verdictFromResponse(res, html, loc)
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(204).end()
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'invalid' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const href = normalizeHttps(body.url)
    if (!href) {
      return res.status(200).json({
        ok: false,
        error: 'invalid',
        message: 'Lien https invalide.',
      })
    }
    if (!isAllowedHost(hostnameOf(href))) {
      return res.status(200).json({
        ok: false,
        error: 'invalid',
        message: 'Hôte non autorisé. Uniquement Google Drive, OneDrive ou SharePoint.',
      })
    }

    const quick = classify(href)
    if (quick === 'invalid') {
      return res.status(200).json({ ok: false, error: 'invalid', message: 'Lien invalide.' })
    }
    if (quick === 'public') {
      return res.status(200).json({ ok: false, error: 'public', message: PUBLIC_MSG })
    }

    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 8000)
    try {
      const host = hostnameOf(href)
      const result = isDriveHost(host)
        ? await probeGoogle(href, ac.signal)
        : await probeMicrosoft(href, ac.signal)

      if (result === 'restricted') {
        return res.status(200).json({ ok: true, restricted: true })
      }
      if (result === 'public') {
        return res.status(200).json({ ok: false, error: 'public', message: PUBLIC_MSG })
      }
      return res.status(200).json({ ok: false, error: 'unverifiable', message: UNVERIFIABLE_MSG })
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return res.status(200).json({
      ok: false,
      error: 'unverifiable',
      message: UNVERIFIABLE_MSG,
    })
  }
}
