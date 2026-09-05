/** Chemins coffre : uniquement sous ClimaZEN/, pas de traversal. */

export const MAX_DOCUMENT_BYTES = 10_000_000
export const COPIE_SECOURS_RELPATH = 'ClimaZEN/Documents/Secours/climazen-donnees.xlsx.enc'

export function safeRelPath(raw) {
  const p = String(raw || '')
    .replace(/^\/+/, '')
    .trim()
  if (!p || p.length > 500) return ''
  if (p.includes('..') || p.includes('\\') || p.includes('\0')) return ''
  if (!p.startsWith('ClimaZEN/')) return ''
  return p
}

export function fileNameOf(relPath) {
  const parts = String(relPath || '')
    .split('/')
    .filter(Boolean)
  return parts[parts.length - 1] || 'document'
}

export function parentSegments(relPath) {
  const parts = String(relPath || '')
    .split('/')
    .filter(Boolean)
  parts.pop()
  return parts
}

export function mimeOf(relPath, fallback = 'application/octet-stream') {
  const name = fileNameOf(relPath).toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (name.endsWith('.enc')) return 'application/octet-stream'
  return fallback
}
