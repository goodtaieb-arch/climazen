import { jsPDF } from 'jspdf'
import {
  FICHE_MAINT_SECTIONS,
  type FicheMaintCheckId,
  type FicheMaintenanceClim,
} from './ficheMaintenanceClim'

const ACCENT: [number, number, number] = [26, 168, 150]
const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]
const SOFT: [number, number, number] = [240, 253, 250]

export type FicheMaintPdfCompany = {
  raisonSociale?: string
  adresse?: string
  telephone?: string
  email?: string
  siret?: string
  logoImage?: string
}

function fmtDate(iso: string) {
  const d = iso.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso || '—'
  return `${day}/${m}/${y}`
}

function val(n: number | null | undefined, unit = '') {
  if (n == null || Number.isNaN(Number(n)) || n === 0) return '—'
  return `${n} ${unit}`.trim()
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' | null {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
  if (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/webp')) return 'PNG'
  if (dataUrl.startsWith('data:image')) return 'PNG'
  return null
}

async function embedImage(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!dataUrl?.startsWith('data:image')) return false
  const fmt = imageFormat(dataUrl)
  if (!fmt) return false
  try {
    doc.addImage(dataUrl, fmt, x, y, w, h)
    return true
  } catch {
    try {
      doc.addImage(dataUrl, 'PNG', x, y, w, h)
      return true
    } catch {
      return false
    }
  }
}

function checkBox(doc: jsPDF, x: number, y: number, checked: boolean) {
  const s = 3.6
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.35)
  if (checked) {
    doc.setFillColor(...ACCENT)
    doc.roundedRect(x, y - 3.1, s, s, 0.4, 0.4, 'FD')
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.55)
    doc.line(x + 0.8, y - 1.3, x + 1.5, y - 0.5)
    doc.line(x + 1.5, y - 0.5, x + 2.9, y - 2.4)
  } else {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y - 3.1, s, s, 0.4, 0.4, 'FD')
  }
  doc.setLineWidth(0.2)
  doc.setDrawColor(...LINE)
}

function resultPill(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  active: boolean,
): number {
  doc.setFont('helvetica', active ? 'bold' : 'normal')
  doc.setFontSize(8)
  const w = doc.getTextWidth(label) + 8
  if (active) {
    doc.setFillColor(...ACCENT)
    doc.roundedRect(x, y - 3.8, w, 6, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255)
  } else {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, y - 3.8, w, 6, 1.5, 1.5, 'FD')
    doc.setTextColor(...MUTED)
  }
  doc.text(label, x + 4, y)
  doc.setTextColor(...INK)
  return w + 3
}

export async function buildFicheMaintenanceClimPdf(
  fiche: FicheMaintenanceClim,
  company?: FicheMaintPdfCompany,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const maxW = pageW - margin * 2
  let y = 0

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 16) {
      doc.addPage()
      // thin top bar on following pages
      doc.setFillColor(...ACCENT)
      doc.rect(0, 0, pageW, 3, 'F')
      y = 12
    }
  }

  // Header band
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setFillColor(...SOFT)
  doc.rect(0, 28, pageW, 10, 'F')

  const logo = company?.logoImage
  let titleX = margin
  if (logo) {
    const ok = await embedImage(doc, logo, margin, 5, 18, 18)
    if (ok) titleX = margin + 22
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Fiche de Maintenance Climatisation / PAC', titleX, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const companyLine = company?.raisonSociale || 'ClimaZEN'
  doc.text(companyLine, titleX, 18)
  if (company?.telephone || company?.email) {
    doc.setFontSize(7.5)
    doc.text([company.telephone, company.email].filter(Boolean).join('  ·  '), titleX, 23)
  }

  y = 34
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`Intervention N° ${fiche.numero || '—'}`, margin, y)
  doc.text(`Date ${fmtDate(fiche.date)}`, margin + 62, y)
  doc.text(`Technicien ${fiche.technicien || '—'}`, margin + 110, y)
  y = 42

  // Client / matériel card
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  const infoTop = y
  const infoLines = [
    ['Client', fiche.clientNom || '—'],
    ['Adresse', fiche.adresse || '—'],
    ['Marque / Modèle', fiche.marqueModele || '—'],
    ['N° de série', fiche.numeroSerie || '—'],
    [
      'Fluide',
      [
        fiche.fluide || '—',
        fiche.quantiteFluideKg != null && Number(fiche.quantiteFluideKg) > 0
          ? `${fiche.quantiteFluideKg} kg`
          : null,
      ]
        .filter(Boolean)
        .join('  ·  '),
    ],
  ]
  let infoH = 6
  for (const [, v] of infoLines) {
    const wrapped = doc.splitTextToSize(String(v), maxW - 38)
    infoH += Math.max(4.2, wrapped.length * 3.6) + 0.6
  }
  infoH += 3
  doc.roundedRect(margin, infoTop, maxW, infoH, 2, 2, 'FD')
  doc.setFillColor(...ACCENT)
  doc.roundedRect(margin, infoTop, 2.2, infoH, 1, 1, 'F')

  y = infoTop + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('Informations client & matériel', margin + 5, y)
  y += 5
  for (const [k, v] of infoLines) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(`${k}`, margin + 5, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    const wrapped = doc.splitTextToSize(String(v), maxW - 38)
    doc.text(wrapped, margin + 36, y)
    y += Math.max(4.2, wrapped.length * 3.6) + 0.6
  }
  y = infoTop + infoH + 5

  const valueFor = (id: FicheMaintCheckId): string | null => {
    if (id === 'fr_souffle') return val(fiche.tempSouffleC, '°C')
    if (id === 'fr_repris') return val(fiche.tempReprisC, '°C')
    if (id === 'fr_delta') return val(fiche.deltaTC, '°C')
    if (id === 'fr_pression') return val(fiche.pressionBpBar, 'bar')
    if (id === 'el_tension') return val(fiche.tensionV, 'V')
    if (id === 'el_intensite') return val(fiche.intensiteA, 'A')
    return null
  }

  for (const sec of FICHE_MAINT_SECTIONS) {
    ensureSpace(14)
    doc.setFillColor(...SOFT)
    doc.roundedRect(margin, y - 3.5, maxW, 7, 1.2, 1.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ACCENT)
    doc.text(sec.title, margin + 3, y + 0.8)
    y += 7
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    for (const it of sec.items) {
      ensureSpace(7)
      const checked = !!fiche.checks[it.id]
      checkBox(doc, margin + 1, y, checked)
      let label = it.label
      const v = valueFor(it.id)
      if (v && v !== '—') label = `${label}  ·  ${v}`
      else if (it.hasValue) label = `${label}  ·  —`
      const lines = doc.splitTextToSize(label, maxW - 10)
      if (!checked) doc.setTextColor(...MUTED)
      else doc.setTextColor(...INK)
      doc.text(lines, margin + 7, y)
      doc.setTextColor(...INK)
      y += Math.max(4.4, lines.length * 3.5) + 0.7
    }
    y += 2.5
  }

  ensureSpace(48)
  doc.setFillColor(...SOFT)
  doc.roundedRect(margin, y - 3.5, maxW, 7, 1.2, 1.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('Validation & signatures', margin + 3, y + 0.8)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Observations / pièces à prévoir', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  const obs = doc.splitTextToSize(fiche.observations?.trim() || 'Aucune observation.', maxW)
  doc.text(obs, margin, y)
  y += Math.max(6, obs.length * 3.6) + 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Résultat global', margin, y)
  y += 6
  let rx = margin
  rx += resultPill(doc, rx, y, 'Conforme', fiche.resultat === 'conforme')
  rx += resultPill(doc, rx, y, 'Réserve(s)', fiche.resultat === 'reserves')
  resultPill(doc, rx, y, 'Non conforme', fiche.resultat === 'non_conforme')
  y += 10

  const boxW = (maxW - 6) / 2
  const boxH = 28
  ensureSpace(boxH + 8)

  const drawSignBox = async (x: number, title: string, img?: string, name?: string) => {
    doc.setDrawColor(...LINE)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(title, x + 3, y + 4.5)
    await embedImage(doc, img, x + 4, y + 7, boxW - 8, 14)
    if (name) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...INK)
      doc.text(name, x + 3, y + boxH - 2.5)
    }
  }

  await drawSignBox(margin, 'Signature technicien', fiche.signatureTechnicienImage, fiche.technicien)
  await drawSignBox(
    margin + boxW + 6,
    'Signature client',
    fiche.signatureClientImage,
    fiche.clientNom,
  )
  y += boxH + 6

  // Footer
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.2)
  doc.line(margin, pageH - 10, pageW - margin, pageH - 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  const foot = [
    company?.raisonSociale,
    company?.siret ? `SIRET ${company.siret}` : '',
    'Document généré avec ClimaZEN — hors CERFA 15497-04',
  ]
    .filter(Boolean)
    .join('  ·  ')
  doc.text(foot, margin, pageH - 6)

  return doc.output('blob')
}
