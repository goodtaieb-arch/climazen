import { jsPDF } from 'jspdf'
import { embedCompanyLogo } from './pdfLogo'
import {
  ABSENCE_STATUT_LABELS,
  ABSENCE_TYPE_LABELS,
  type AbsenceStatut,
  type DemandeAbsence,
} from './demandesAbsence'

export type AbsencePdfCompany = {
  raisonSociale?: string
  adresse?: string
  telephone?: string
  email?: string
  siret?: string
  logoImage?: string
}

function fmtDate(iso?: string) {
  const d = String(iso || '').slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso || '—'
  return `${day}/${m}/${y}`
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—'
  const date = fmtDate(iso)
  const time = iso.slice(11, 16)
  return time ? `${date} à ${time}` : date
}

function titleFor(statut: AbsenceStatut) {
  if (statut === 'validee') return 'Certificat d’absence / Congé'
  if (statut === 'refusee') return 'Demande d’absence refusée'
  return 'Feuille de demande d’absence'
}

export function absencePdfFileName(d: DemandeAbsence): string {
  const name = (d.technicienName || 'salarie').replace(/[^a-zA-Z0-9_-]/g, '_')
  const debut = d.dateDebut.slice(0, 10).replace(/-/g, '')
  const fin = d.dateFin.slice(0, 10).replace(/-/g, '')
  const prefix = d.statut === 'validee' ? 'Certificat' : 'Demande'
  return `${prefix}_Absence_${name}_${debut}-${fin}.pdf`
}

export function companyFromOperateur(op?: AbsencePdfCompany): AbsencePdfCompany {
  return {
    raisonSociale: op?.raisonSociale,
    adresse: op?.adresse,
    telephone: op?.telephone,
    email: op?.email,
    siret: op?.siret,
    logoImage: op?.logoImage,
  }
}

/** Feuille PDF visuelle (logo société) — aperçu avant envoi / validation. */
export function buildAbsencePdf(
  demande: DemandeAbsence,
  company?: AbsencePdfCompany,
  extras?: {
    forceStatut?: AbsenceStatut
    signatureSalarie?: string
    signatureDirection?: string
  },
): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const maxW = pageW - margin * 2
  const statut = extras?.forceStatut || demande.statut

  doc.setFillColor(26, 168, 150)
  doc.rect(0, 0, pageW, 32, 'F')
  doc.setFillColor(240, 253, 250)
  doc.rect(0, 32, pageW, 8, 'F')

  if (company?.logoImage) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, 5, 22, 22, 2, 2, 'F')
    embedCompanyLogo(doc, company.logoImage, { x: margin + 2, y: 7, maxW: 18, maxH: 18 })
  }

  const titleX = company?.logoImage ? margin + 26 : margin
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(titleFor(statut), titleX, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(company?.raisonSociale || 'ClimaZEN', titleX, 20)
  const contact = [company?.telephone, company?.email].filter(Boolean).join('  ·  ')
  if (contact) {
    doc.setFontSize(7.5)
    doc.text(contact, titleX, 25)
  }

  let y = 38
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  const num = `DEM-${demande.id.slice(0, 8).toUpperCase()}`
  doc.text(`Demande N° ${num}`, margin, y)
  doc.text(`Émise le ${fmtDate(demande.createdAt || demande.submittedAt)}`, margin + 58, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`Statut : ${ABSENCE_STATUT_LABELS[statut]}`, margin + 118, y)

  const lines: [string, string][] = [
    ['Salarié', demande.technicienName || '—'],
    ['Type d’absence', ABSENCE_TYPE_LABELS[demande.type] || demande.type],
    ['Date de début', fmtDate(demande.dateDebut)],
    ['Date de fin', fmtDate(demande.dateFin)],
    ['Jours ouvrés', String(demande.joursDemandes || '—')],
  ]
  if (demande.motif?.trim()) lines.push(['Motif', demande.motif])
  if (demande.notes?.trim()) lines.push(['Notes', demande.notes])

  y = 46
  let infoH = 8
  for (const [, v] of lines) {
    const wrapped = doc.splitTextToSize(String(v), maxW - 46)
    infoH += Math.max(5, wrapped.length * 4) + 0.8
  }
  infoH += 4
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.35)
  doc.roundedRect(margin, y, maxW, infoH, 2.5, 2.5, 'FD')
  doc.setFillColor(26, 168, 150)
  doc.roundedRect(margin, y, 2.4, infoH, 1, 1, 'F')

  let rowY = y + 7
  for (const [k, v] of lines) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(k, margin + 7, rowY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(15, 23, 42)
    const wrapped = doc.splitTextToSize(String(v), maxW - 46)
    doc.text(wrapped, margin + 42, rowY)
    rowY += Math.max(5, wrapped.length * 4) + 0.8
  }
  y = y + infoH + 6

  if (statut === 'brouillon' || statut === 'en_attente') {
    doc.setFillColor(255, 251, 235)
    doc.setDrawColor(217, 119, 6)
    doc.roundedRect(margin, y, maxW, 20, 2.5, 2.5, 'FD')
    doc.setFillColor(217, 119, 6)
    doc.roundedRect(margin, y, 2.4, 20, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(146, 64, 14)
    doc.text(
      statut === 'brouillon'
        ? 'Aperçu — vérifiez la feuille avant d’envoyer'
        : 'Aperçu — vérifiez la feuille avant de valider',
      margin + 7,
      y + 8,
    )
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text('Logo, dates, type et motif ci-dessus. Rien n’est enregistré tant que vous ne confirmez pas.', margin + 7, y + 14)
    y += 24
  } else if (statut === 'validee') {
    doc.setFillColor(236, 253, 245)
    doc.setDrawColor(16, 185, 129)
    doc.roundedRect(margin, y, maxW, 24, 2.5, 2.5, 'FD')
    doc.setFillColor(16, 185, 129)
    doc.roundedRect(margin, y, 2.4, 24, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(6, 95, 70)
    doc.text('Demande validée par la direction', margin + 7, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text(`Validé par : ${demande.decidedByName || 'Responsable'}`, margin + 7, y + 14)
    doc.text(`Date : ${fmtDateTime(demande.decidedAt || demande.updatedAt)}`, margin + 7, y + 19)
    y += 28
  } else if (statut === 'refusee') {
    doc.setFillColor(254, 242, 242)
    doc.setDrawColor(239, 68, 68)
    doc.roundedRect(margin, y, maxW, 24, 2.5, 2.5, 'FD')
    doc.setFillColor(239, 68, 68)
    doc.roundedRect(margin, y, 2.4, 24, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(153, 27, 27)
    doc.text('Demande refusée', margin + 7, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text(`Refusé par : ${demande.decidedByName || 'Responsable'}`, margin + 7, y + 14)
    if (demande.motifRefus?.trim()) {
      const wrapped = doc.splitTextToSize(`Motif : ${demande.motifRefus}`, maxW - 14)
      doc.text(wrapped, margin + 7, y + 19)
    }
    y += 28
  }

  y += 4
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageW - margin, y)
  y += 5
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  const foot = [company?.raisonSociale, company?.adresse, company?.siret ? `SIRET ${company.siret}` : null]
    .filter(Boolean)
    .join('  ·  ')
  if (foot) doc.text(foot, margin, y)

  const signY = pageH - 48
  const boxW = (maxW - 8) / 2
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(252, 253, 254)
  doc.roundedRect(margin, signY, boxW, 28, 2, 2, 'FD')
  doc.roundedRect(margin + boxW + 8, signY, boxW, 28, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Signature salarié', margin + 3, signY + 5)
  doc.text('Signature direction', margin + boxW + 11, signY + 5)
  if (extras?.signatureSalarie) {
    embedCompanyLogo(doc, extras.signatureSalarie, {
      x: margin + 8,
      y: signY + 8,
      maxW: 42,
      maxH: 16,
    })
  }
  if (extras?.signatureDirection) {
    embedCompanyLogo(doc, extras.signatureDirection, {
      x: margin + boxW + 16,
      y: signY + 8,
      maxW: 42,
      maxH: 16,
    })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'Document généré par ClimaZEN — vérifiez le visuel puis validez. Conforme aux informations saisies.',
    margin,
    pageH - 10,
  )

  return doc.output('blob')
}
