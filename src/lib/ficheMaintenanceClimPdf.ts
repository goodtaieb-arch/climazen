import { jsPDF } from 'jspdf'
import {
  FICHE_MAINT_SECTIONS,
  type FicheMaintCheckId,
  type FicheMaintenanceClim,
} from './ficheMaintenanceClim'

function fmtDate(iso: string) {
  const d = iso.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso || '____/____/______'
  return `${day}/${m}/${y}`
}

function val(n: number | null | undefined, unit = '') {
  if (n == null || Number.isNaN(Number(n))) return `_______ ${unit}`.trim()
  return `${n} ${unit}`.trim()
}

function box(doc: jsPDF, x: number, y: number, checked: boolean) {
  doc.setDrawColor(40)
  doc.rect(x, y - 3.2, 3.4, 3.4)
  if (checked) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('X', x + 0.7, y - 0.5)
    doc.setFont('helvetica', 'normal')
  }
}

async function embedPng(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!dataUrl?.startsWith('data:image')) return
  try {
    doc.addImage(dataUrl, 'PNG', x, y, w, h)
  } catch {
    /* ignore */
  }
}

export async function buildFicheMaintenanceClimPdf(fiche: FicheMaintenanceClim): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 12
  const maxW = pageW - margin * 2
  let y = 12

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 14) {
      doc.addPage()
      y = 14
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Fiche de Maintenance Climatisation / PAC', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Intervention N° : ${fiche.numero || '_________________'}`, margin, y)
  doc.text(`Date : ${fmtDate(fiche.date)}`, margin + 78, y)
  y += 5
  doc.text(`Technicien : ${fiche.technicien || '_________________'}`, margin, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Informations client & matériel', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const info = [
    `Client / Raison sociale : ${fiche.clientNom || '—'}`,
    `Adresse du chantier : ${fiche.adresse || '—'}`,
    `Marque / Modèle : ${fiche.marqueModele || '—'}`,
    `N° de série : ${fiche.numeroSerie || '—'}    |    Fluide : ${fiche.fluide || '—'}`,
  ]
  for (const line of info) {
    const lines = doc.splitTextToSize(line, maxW)
    doc.text(lines, margin, y)
    y += lines.length * 4 + 1
  }
  y += 2

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
    ensureSpace(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(sec.title, margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const it of sec.items) {
      ensureSpace(7)
      const checked = !!fiche.checks[it.id]
      box(doc, margin, y, checked)
      let label = it.label
      const v = valueFor(it.id)
      if (v) label = `${label} : ${v}`
      const lines = doc.splitTextToSize(label, maxW - 6)
      doc.text(lines, margin + 5, y)
      y += Math.max(4.5, lines.length * 3.6) + 0.8
    }
    y += 2
  }

  ensureSpace(40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Validation & signatures', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Observations / Pièces à prévoir :', margin, y)
  y += 4
  const obs = doc.splitTextToSize(fiche.observations || '—', maxW)
  doc.text(obs, margin, y)
  y += Math.max(8, obs.length * 3.6) + 3

  const resLabel =
    fiche.resultat === 'conforme'
      ? 'Conforme'
      : fiche.resultat === 'reserves'
        ? 'Réserve(s)'
        : fiche.resultat === 'non_conforme'
          ? 'Non conforme'
          : '—'
  doc.text(`Résultat global : ${resLabel}`, margin, y)
  y += 4
  box(doc, margin, y, fiche.resultat === 'conforme')
  doc.text('Conforme', margin + 5, y)
  box(doc, margin + 32, y, fiche.resultat === 'reserves')
  doc.text('Réserve(s)', margin + 37, y)
  box(doc, margin + 68, y, fiche.resultat === 'non_conforme')
  doc.text('Non conforme', margin + 73, y)
  y += 10

  doc.text('Signature technicien', margin, y)
  doc.text('Signature client', margin + 95, y)
  y += 2
  await embedPng(doc, fiche.signatureTechnicienImage, margin, y, 42, 18)
  await embedPng(doc, fiche.signatureClientImage, margin + 95, y, 42, 18)
  doc.setDrawColor(180)
  doc.rect(margin, y, 42, 18)
  doc.rect(margin + 95, y, 42, 18)

  return doc.output('blob')
}
