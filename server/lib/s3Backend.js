/**
 * AWS S3 (et compatibles SigV4 : Wasabi, MinIO, Scaleway).
 */

import crypto from 'node:crypto'

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function encodeRfc3986(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function encodeKey(key) {
  return String(key || '')
    .split('/')
    .map(encodeRfc3986)
    .join('/')
}

function amzDate(d = new Date()) {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amz: iso.slice(0, 16) + 'Z', day: iso.slice(0, 8) }
}

function signingKey(secret, day, region, service) {
  const kDate = hmac(`AWS4${secret}`, day)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

function joinKey(prefix, relPath) {
  const p = String(prefix || '')
    .replace(/^\/+|\/+$/g, '')
  const r = String(relPath || '').replace(/^\/+/, '')
  return p ? `${p}/${r}` : r
}

function resolveHost(cfg) {
  const endpoint = String(cfg.s3Endpoint || '').trim()
  const bucket = String(cfg.s3Bucket || '').trim()
  const region = String(cfg.s3Region || 'eu-west-3').trim() || 'eu-west-3'
  if (endpoint) {
    const u = new URL(endpoint)
    return { host: u.host, origin: `${u.protocol}//${u.host}`, pathStyle: true, region, bucket }
  }
  return {
    host: `${bucket}.s3.${region}.amazonaws.com`,
    origin: `https://${bucket}.s3.${region}.amazonaws.com`,
    pathStyle: false,
    region,
    bucket,
  }
}

function signedHeaders({ method, host, canonicalUri, bodyHash, amz, contentType, accessKey, secretKey, region }) {
  const headers = {
    host,
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': amz.amz,
  }
  if (contentType) headers['content-type'] = contentType
  const signed = Object.keys(headers)
    .sort()
    .join(';')
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join('')
  const canonical = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signed,
    bodyHash,
  ].join('\n')
  const scope = `${amz.day}/${region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amz.amz, scope, sha256Hex(canonical)].join('\n')
  const sig = crypto
    .createHmac('sha256', signingKey(secretKey, amz.day, region, 's3'))
    .update(stringToSign, 'utf8')
    .digest('hex')
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}`
  return headers
}

export async function s3Put({ cfg, relPath, buf, contentType }) {
  const bucket = String(cfg.s3Bucket || '').trim()
  const accessKey = String(cfg.s3AccessKey || '').trim()
  const secretKey = String(cfg.s3SecretKey || '').trim()
  if (!bucket || !accessKey || !secretKey) throw new Error('S3 : bucket / clés manquants.')
  const { host, origin, pathStyle, region } = resolveHost(cfg)
  const key = joinKey(cfg.s3Prefix, relPath)
  const canonicalUri = pathStyle ? `/${encodeKey(bucket)}/${encodeKey(key)}` : `/${encodeKey(key)}`
  const url = pathStyle ? `${origin}/${encodeKey(bucket)}/${encodeKey(key)}` : `${origin}/${encodeKey(key)}`
  const amz = amzDate()
  const bodyHash = sha256Hex(buf)
  const headers = signedHeaders({
    method: 'PUT',
    host,
    canonicalUri,
    bodyHash,
    amz,
    contentType: contentType || 'application/octet-stream',
    accessKey,
    secretKey,
    region,
  })
  const up = await fetch(url, { method: 'PUT', headers, body: buf })
  if (!up.ok && up.status !== 200 && up.status !== 204) {
    const t = await up.text().catch(() => '')
    throw new Error(`S3 PUT HTTP ${up.status}${t ? ` — ${t.slice(0, 180)}` : ''}`)
  }
  return { ok: true }
}

export async function s3Get({ cfg, relPath }) {
  const bucket = String(cfg.s3Bucket || '').trim()
  const accessKey = String(cfg.s3AccessKey || '').trim()
  const secretKey = String(cfg.s3SecretKey || '').trim()
  if (!bucket || !accessKey || !secretKey) throw new Error('S3 : bucket / clés manquants.')
  const { host, origin, pathStyle, region } = resolveHost(cfg)
  const key = joinKey(cfg.s3Prefix, relPath)
  const canonicalUri = pathStyle ? `/${encodeKey(bucket)}/${encodeKey(key)}` : `/${encodeKey(key)}`
  const url = pathStyle ? `${origin}/${encodeKey(bucket)}/${encodeKey(key)}` : `${origin}/${encodeKey(key)}`
  const amz = amzDate()
  const bodyHash = sha256Hex('')
  const headers = signedHeaders({
    method: 'GET',
    host,
    canonicalUri,
    bodyHash,
    amz,
    accessKey,
    secretKey,
    region,
  })
  const get = await fetch(url, { method: 'GET', headers })
  if (!get.ok) {
    const err = new Error(`S3 GET HTTP ${get.status}`)
    err.status = get.status
    throw err
  }
  const ab = await get.arrayBuffer()
  return {
    buf: Buffer.from(ab),
    contentType: get.headers.get('content-type') || 'application/octet-stream',
  }
}

export async function s3Exists({ cfg, relPath }) {
  try {
    await s3Get({ cfg, relPath })
    return { ok: true, exists: true }
  } catch (err) {
    if (err?.status === 404) return { ok: true, exists: false }
    throw err
  }
}

export function joinS3Key(prefix, relPath) {
  return joinKey(prefix, relPath)
}
