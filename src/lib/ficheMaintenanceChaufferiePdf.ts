import { jsPDF } from 'jspdf'
import {
  PERIODES_CHAUFFERIE,
  sectionsForPeriode,
  type FicheMaintenanceChaufferie,
} from './ficheMaintenanceChaufferie'

const ACCENT: [number, number, number] = [26, 168, 150]
const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]

export type FicheChauffPdfCompany = {
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
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${n}${unit ? ` ${unit}` : ''}`.trim()
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
}

function ensureSpace(doc: jsPDF, y: number, need: number, margin: number, pageH: number) {
  if (y + need < pageH - margin) return y
  doc.addPage()
  return margin
}

export async function buildFicheMaintenanceChaufferiePdf(
  fiche: FicheMaintenanceChaufferie,
  company?: FicheChauffPdfCompany,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const maxW = pageW - margin * 2
  let y = margin

  const periodeMeta = PERIODES_CHAUFFERIE.find((p) => p.id === fiche.periode)

  // Header
  doc.setFillColor(...ACCENT)
  doc.roundedRect(margin, y, maxW, 18, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Fiche maintenance chaufferie P2/P3', margin + 4, y + 7)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Visite ${periodeMeta?.label || fiche.periode} — ${periodeMeta?.hint || ''}`,
    margin + 4,
    y + 13,
  )
  y += 24

  if (company?.logoImage) {
    await embedImage(doc, company.logoImage, pageW - margin - 28, margin, 26, 14)
  }

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(company?.raisonSociale || 'ClimaZEN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const companyLine = [company?.adresse, company?.telephone, company?.siret]
    .filter(Boolean)
    .join(' · ')
  if (companyLine) {
    doc.text(companyLine.slice(0, 110), margin, y)
    y += 5
  }

  doc.setTextColor(...INK)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`N° ${fiche.numero || '—'}  ·  ${fmtDate(fiche.date)}  ·  ${fiche.technicien || '—'}`, margin, y)
  y += 7

  const info = [
    `Client : ${fiche.clientNom || '—'}`,
    `Adresse : ${fiche.adresse || '—'}`,
    `Équipement : ${fiche.marqueModele || '—'}  ·  SN : ${fiche.numeroSerie || '—'}`,
    `Énergie : ${fiche.energie || '—'}`,
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  for (const line of info) {
    y = ensureSpace(doc, y, 5, margin, pageH)
    doc.text(line.slice(0, 115), margin, y)
    y += 4.5
  }
  y += 3

  const m = fiche.mesures || {}
  const measureBlocks: { title: string; lines: string[] }[] = [
    {
      title: 'Températures (°C)',
      lines: [
        `Chaudière dép./ret. : ${val(m.tempDepChaudiereC)} / ${val(m.tempRetChaudiereC)}`,
        `Éch. prim. ent./sortie : ${val(m.tempEchPrimEntreeC)} / ${val(m.tempEchPrimSortieC)}`,
        `Éch. sec. ent./sortie : ${val(m.tempEchSecEntreeC)} / ${val(m.tempEchSecSortieC)}`,
        `Chauffage dép./ret. : ${val(m.tempDepChauffageC)} / ${val(m.tempRetChauffageC)}`,
        `ECS dép. / bouclage : ${val(m.tempDepEcsC)} / ${val(m.tempBouclageEcsC)}`,
      ],
    },
    {
      title: 'Pressions & chimie',
      lines: [
        `Réseau froid/chaud : ${val(m.pressionReseauFroidBar, 'bar')} / ${val(m.pressionReseauChaudBar, 'bar')}`,
        `ΔP échangeur : ${val(m.deltaPEchangeurBar, 'bar')}`,
        `Eau brute / traitée : ${val(m.pressionEauBruteBar, 'bar')} / ${val(m.pressionEauTraiteeBar, 'bar')}`,
        `TH brute / adoucie / réseau : ${val(m.thEauBrute, '°f')} / ${val(m.thEauAdoucie, '°f')} / ${val(m.thEauReseau, '°f')}`,
        `pH circuit : ${val(m.phCircuit)}  ·  Sel adoucisseur : ${
          m.niveauSelConforme == null ? '—' : m.niveauSelConforme ? 'Conforme' : 'Appoint'
        }`,
      ],
    },
  ]
  if (fiche.periode === 'semestriel' || fiche.periode === 'annuel') {
    measureBlocks.push({
      title: 'Semestriel',
      lines: [`Prégonflage vase : ${val(m.vasePregonflageBar, 'bar')}`],
    })
  }
  if (fiche.periode === 'annuel') {
    measureBlocks.push({
      title: 'Combustion',
      lines: [
        `CO₂ ${val(m.combustionCo2Pct, '%')} · O₂ ${val(m.combustionO2Pct, '%')} · Rendement ${val(m.combustionRendementPct, '%')}`,
        `CO ambiant ${val(m.combustionCoAmbiantPpm, 'ppm')} · CO fumées ${val(m.combustionCoFumeesPpm, 'ppm')}`,
      ],
    })
  }

  for (const block of measureBlocks) {
    y = ensureSpace(doc, y, 18, margin, pageH)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ACCENT)
    doc.text(block.title, margin, y)
    y += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    for (const line of block.lines) {
      y = ensureSpace(doc, y, 5, margin, pageH)
      doc.text(line, margin, y)
      y += 4
    }
    y += 2
  }

  const sections = sectionsForPeriode(fiche.periode)
  for (const sec of sections) {
    y = ensureSpace(doc, y, 10, margin, pageH)
    doc.setDrawColor(...LINE)
    doc.setFillColor(240, 253, 250)
    doc.roundedRect(margin, y - 4, maxW, 7, 1, 1, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(sec.title, margin + 2, y)
    y += 6

    for (const it of sec.items) {
      const lines = doc.splitTextToSize(it.label, maxW - 8)
      const h = Math.max(5, lines.length * 3.6)
      y = ensureSpace(doc, y, h + 2, margin, pageH)
      checkBox(doc, margin, y, !!fiche.checks[it.id])
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...INK)
      doc.text(lines, margin + 6, y)
      y += h
    }
    y += 2
  }

  y = ensureSpace(doc, y, 28, margin, pageH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(
    `Résultat : ${
      fiche.resultat === 'conforme'
        ? 'Conforme'
        : fiche.resultat === 'reserves'
          ? 'Avec réserves'
          : fiche.resultat === 'non_conforme'
            ? 'Non conforme'
            : '—'
    }`,
    margin,
    y,
  )
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const obs = doc.splitTextToSize(`Observations : ${fiche.observations || '—'}`, maxW)
  doc.text(obs, margin, y)
  y += obs.length * 4 + 8

  y = ensureSpace(doc, y, 32, margin, pageH)
  const sigW = (maxW - 8) / 2
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Signature technicien', margin, y)
  doc.text('Signature client / détenteur', margin + sigW + 8, y)
  y += 2
  doc.setDrawColor(...LINE)
  doc.roundedRect(margin, y, sigW, 22, 1, 1, 'S')
  doc.roundedRect(margin + sigW + 8, y, sigW, 22, 1, 1, 'S')
  await embedImage(doc, fiche.signatureTechnicienImage, margin + 2, y + 1, sigW - 4, 20)
  await embedImage(doc, fiche.signatureClientImage, margin + sigW + 10, y + 1, sigW - 4, 20)

  return doc.output('blob')
}
