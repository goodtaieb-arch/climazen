/**
 * Logo société dans les PDF jspdf (data URL PNG/JPEG).
 */

import type { jsPDF } from 'jspdf'

export function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | null {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
  if (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/webp')) return 'PNG'
  if (dataUrl.startsWith('data:image')) return 'PNG'
  return null
}

/** Dessine le logo en haut à droite. Retourne true si ok. */
export function embedCompanyLogo(
  doc: jsPDF,
  dataUrl: string | undefined,
  opts?: { x?: number; y?: number; maxW?: number; maxH?: number },
): boolean {
  if (!dataUrl?.startsWith('data:image')) return false
  const fmt = imageFormatFromDataUrl(dataUrl)
  if (!fmt) return false
  const maxW = opts?.maxW ?? 36
  const maxH = opts?.maxH ?? 16
  const x = opts?.x ?? doc.internal.pageSize.getWidth() - maxW - 14
  const y = opts?.y ?? 8
  try {
    doc.addImage(dataUrl, fmt, x, y, maxW, maxH)
    return true
  } catch {
    try {
      doc.addImage(dataUrl, 'PNG', x, y, maxW, maxH)
      return true
    } catch {
      return false
    }
  }
}
