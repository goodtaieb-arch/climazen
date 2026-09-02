/**
 * PDF Devis & Commandes fournisseur — jspdf (même famille que fiches / bon remise).
 */

import { jsPDF } from 'jspdf'
import { downloadBlob } from './cerfaPdf'
import {
  STATUT_COMMANDE_FOURNISSEUR_LABELS,
  STATUT_DEVIS_LABELS,
  type CommandeFournisseur,
  type Devis,
} from './chaineCommerciale'
import { formatOtNumero } from './ordreTravail'
import { embedCompanyLogo } from './pdfLogo'

export type CommercialPdfCompany = {
  raisonSociale?: string
  adresse?: string
  telephone?: string
  email?: string
  siret?: string
  logoImage?: string
}

const ACCENT: [number, number, number] = [26, 168, 150]
const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]

function fmtDate(iso?: string) {
  const d = (iso || '').slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso || '—'
  return `${day}/${m}/${y}`
}

function euro(n?: number) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function ensureY(doc: jsPDF, y: number, need = 12) {
  if (y > 280 - need) {
    doc.addPage()
    return 18
  }
  return y
}

function writeLine(doc: jsPDF, label: string, value: string, y: number) {
  y = ensureY(doc, y, 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(label, 18, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...INK)
  const lines = doc.splitTextToSize(value || '—', 120) as string[]
  doc.text(lines[0] || '—', 70, y)
  for (let i = 1; i < lines.length; i++) {
    y += 5
    y = ensureY(doc, y, 6)
    doc.text(lines[i], 70, y)
  }
  return y + 7
}

function header(
  doc: jsPDF,
  company: CommercialPdfCompany,
  title: string,
  subtitle: string,
) {
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, 18, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(subtitle, 18, 22)
  if (company.logoImage) {
    // Logo sur bandeau (fond blanc pour lisibilité)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(158, 4, 40, 20, 2, 2, 'F')
    embedCompanyLogo(doc, company.logoImage, { x: 160, y: 6, maxW: 36, maxH: 16 })
  }
  doc.setTextColor(...INK)
  doc.setFontSize(9)
  const co = company.raisonSociale || 'ClimaZEN'
  doc.setFont('helvetica', 'bold')
  doc.text(co, 18, 38)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  let y = 44
  const bits = [company.adresse, company.telephone, company.email, company.siret]
    .map((x) => (x || '').trim())
    .filter(Boolean)
  if (bits.length) {
    doc.text(bits.join(' · '), 18, y)
    y += 8
  } else {
    y += 2
  }
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.4)
  doc.line(18, y, 192, y)
  return y + 10
}

export function fileNameDevis(devis: Pick<Devis, 'numero' | 'id'>) {
  return `devis-${(devis.numero || devis.id).replace(/\s+/g, '')}.pdf`
}

export function fileNameCommande(cmd: Pick<CommandeFournisseur, 'numero' | 'id'>) {
  return `commande-${(cmd.numero || cmd.id).replace(/\s+/g, '')}.pdf`
}

export type DevisPdfContext = {
  company: CommercialPdfCompany
  clientNom?: string
  siteNom?: string
  otNumero?: string
}

export function buildDevisPdf(devis: Devis, ctx: DevisPdfContext): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = header(doc, ctx.company, 'DEVIS', devis.numero)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text(devis.libelle || 'Devis', 18, y)
  y += 10

  y = writeLine(doc, 'Statut', STATUT_DEVIS_LABELS[devis.statut] || devis.statut, y)
  y = writeLine(doc, 'Type', devis.type === 'regularisation' ? 'Régularisation' : 'Standard', y)
  y = writeLine(doc, 'Client', ctx.clientNom || '—', y)
  y = writeLine(doc, 'Site', ctx.siteNom || '—', y)
  y = writeLine(
    doc,
    'Lien OT',
    devis.otOrigineId
      ? ctx.otNumero
        ? `Oui — ${formatOtNumero(ctx.otNumero)}`
        : 'Oui (OT lié)'
      : 'Non — devis commercial',
    y,
  )
  y = writeLine(doc, 'Date', fmtDate(devis.updatedAt || devis.createdAt), y)
  y = writeLine(doc, 'Montant HT', euro(devis.montantHt), y)

  y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  y = ensureY(doc, y, 10)
  doc.text('Lignes', 18, y)
  y += 6

  const lignes = devis.lignes?.length
    ? devis.lignes
    : [
        {
          id: '1',
          designation: devis.libelle || 'Prestation',
          quantite: 1,
          prixUnitaireHt: devis.montantHt,
        },
      ]

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(18, y - 4, 174, 8, 1, 1, 'F')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Désignation', 20, y)
  doc.text('Qté', 130, y)
  doc.text('P.U. HT', 148, y)
  doc.text('Total', 172, y, { align: 'right' })
  y += 8

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let total = 0
  for (const l of lignes) {
    const q = Number(l.quantite) || 0
    const pu = Number(l.prixUnitaireHt) || 0
    const lineTotal = q * pu
    total += lineTotal
    y = ensureY(doc, y, 10)
    const des = doc.splitTextToSize(l.designation || '—', 105) as string[]
    doc.text(des[0] || '—', 20, y)
    doc.text(String(q), 130, y)
    doc.text(euro(pu), 148, y)
    doc.text(euro(lineTotal || undefined), 192, y, { align: 'right' })
    y += 5
    for (let i = 1; i < des.length; i++) {
      y = ensureY(doc, y, 6)
      doc.text(des[i], 20, y)
      y += 5
    }
    y += 2
  }

  y += 4
  doc.setDrawColor(...LINE)
  doc.line(130, y, 192, y)
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Total HT', 130, y)
  doc.text(euro(devis.montantHt ?? total), 192, y, { align: 'right' })

  if (devis.notes?.trim()) {
    y += 12
    y = ensureY(doc, y, 20)
    doc.setFontSize(10)
    doc.text('Notes', 18, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    const notes = doc.splitTextToSize(devis.notes.trim(), 174) as string[]
    for (const line of notes) {
      y = ensureY(doc, y, 6)
      doc.text(line, 18, y)
      y += 5
    }
  }

  y = Math.max(y + 16, 250)
  y = ensureY(doc, y, 20)
  doc.setDrawColor(...LINE)
  doc.line(18, y, 90, y)
  doc.line(120, y, 192, y)
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Signature client', 18, y + 5)
  doc.text('Signature société', 120, y + 5)

  return doc.output('blob')
}

export type CommandePdfContext = {
  company: CommercialPdfCompany
  clientNom?: string
  siteNom?: string
  otNumero?: string
}

export function buildCommandePdf(cmd: CommandeFournisseur, ctx: CommandePdfContext): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = header(doc, ctx.company, 'COMMANDE FOURNISSEUR', cmd.numero)

  const dest =
    cmd.destination === 'stock' || (!cmd.otId && cmd.destination !== 'ot')
      ? 'Stock / magasin pièces'
      : ctx.otNumero
        ? `Ordre de travail ${formatOtNumero(ctx.otNumero)}`
        : 'Ordre de travail'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text(cmd.libelle || 'Commande', 18, y)
  y += 10

  y = writeLine(doc, 'Statut', STATUT_COMMANDE_FOURNISSEUR_LABELS[cmd.statut] || cmd.statut, y)
  y = writeLine(doc, 'Destination', dest, y)
  y = writeLine(doc, 'Fournisseur', cmd.fournisseur || '—', y)
  y = writeLine(doc, 'Réf. pièce', cmd.referencePiece || '—', y)
  y = writeLine(doc, 'Quantité', `${cmd.quantite ?? 1}${cmd.unite ? ` ${cmd.unite}` : ''}`, y)
  y = writeLine(doc, 'P.U. HT', euro(cmd.prixUnitaireHt), y)
  y = writeLine(doc, 'Client', ctx.clientNom || '—', y)
  y = writeLine(doc, 'Site', ctx.siteNom || '—', y)
  y = writeLine(doc, 'Date', fmtDate(cmd.updatedAt || cmd.createdAt || cmd.commandeeAt), y)
  if (cmd.rayonStock) y = writeLine(doc, 'Rayon stock', cmd.rayonStock, y)
  if (cmd.notes?.trim()) y = writeLine(doc, 'Notes', cmd.notes.trim(), y)

  y += 10
  doc.setFillColor(240, 253, 250)
  doc.roundedRect(18, y, 174, 22, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...ACCENT)
  doc.text(
    cmd.destination === 'stock' || !cmd.otId
      ? 'À réception → entrée magasin pièces'
      : 'À réception → débloque l’OT en attente de pièce',
    22,
    y + 9,
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(`Document généré le ${fmtDate(new Date().toISOString())}`, 22, y + 16)

  return doc.output('blob')
}

export function downloadDevisPdf(devis: Devis, ctx: DevisPdfContext) {
  downloadBlob(buildDevisPdf(devis, ctx), fileNameDevis(devis))
}

export function downloadCommandePdf(cmd: CommandeFournisseur, ctx: CommandePdfContext) {
  downloadBlob(buildCommandePdf(cmd, ctx), fileNameCommande(cmd))
}
