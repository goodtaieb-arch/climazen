import { jsPDF } from 'jspdf'
import { downloadBlob } from './cerfaPdf'
import { loadCerfaPdf } from './pdfStore'
import type { AppData, BonRemiseMateriel, VoitureEtatLieux } from './types'
import {
  VOITURE_CARBURANT_LABELS,
  VOITURE_CARROSSERIE_LABELS,
  VOITURE_INTERIEUR_LABELS,
  VOITURE_PNEUS_LABELS,
  documentsEcart,
  formatDateFrCourt,
  voitureDocumentLabel,
  voitureTitreCourt,
} from './voitures'

function formatDateFr(iso: string) {
  return formatDateFrCourt(iso) || iso || ''
}

export function pdfIdBonRemise(bonId: string) {
  return `remise-${bonId}`
}

export function fileNameBonRemise(
  bon: Pick<BonRemiseMateriel, 'userName' | 'createdAt' | 'id' | 'kind'>,
) {
  const who = (bon.userName || 'operateur')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const day = (bon.createdAt || '').slice(0, 10)
  const prefix = bon.kind === 'vehicule' ? 'etat-des-lieux-vehicule' : 'bon-remise'
  return `${prefix}-${who || 'operateur'}-${day || bon.id.slice(0, 8)}.pdf`
}

function ensureY(doc: jsPDF, y: number, need = 12) {
  if (y > 280 - need) {
    doc.addPage()
    return 18
  }
  return y
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineH = 5) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  for (const line of lines) {
    y = ensureY(doc, y, lineH + 2)
    doc.text(line, x, y)
    y += lineH
  }
  return y
}

function writeEtatVoiture(doc: jsPDF, opts: {
  etat: VoitureEtatLieux
  fournis?: string[]
  y: number
  w: number
}) {
  const { etat, fournis, w } = opts
  let y = opts.y
  const max = w - 36

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  y = ensureY(doc, y, 10)
  doc.text('État des lieux du véhicule', 18, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const rows: [string, string][] = [
    ['Date', formatDateFr(etat.date)],
    [
      'Kilométrage',
      etat.kilometrage != null ? `${etat.kilometrage.toLocaleString('fr-FR')} km` : '—',
    ],
    ['Carburant', etat.carburant ? VOITURE_CARBURANT_LABELS[etat.carburant] : '—'],
    ['Carrosserie', etat.carrosserie ? VOITURE_CARROSSERIE_LABELS[etat.carrosserie] : '—'],
    ['Intérieur', etat.interieur ? VOITURE_INTERIEUR_LABELS[etat.interieur] : '—'],
    ['Pneus', etat.pneus ? VOITURE_PNEUS_LABELS[etat.pneus] : '—'],
  ]
  for (const [k, v] of rows) {
    y = ensureY(doc, y, 6)
    doc.setFont('helvetica', 'bold')
    doc.text(`${k} :`, 18, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v, 52, y)
    y += 6
  }

  y += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  y = ensureY(doc, y, 10)
  doc.text('Documents pris avec le véhicule', 18, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const recus = etat.documentsRecus || []
  if (recus.length === 0) {
    y = writeWrapped(doc, 'Aucun document déclaré pris par l’opérateur.', 18, y, max)
  } else {
    for (const id of recus) {
      const extra = id === 'autre' && etat.documentsAutre ? ` — ${etat.documentsAutre}` : ''
      y = writeWrapped(doc, `• ${voitureDocumentLabel(id)}${extra}`, 18, y, max, 5.5)
    }
  }

  const fournisIds = (fournis || []) as import('./types').VoitureDocumentId[]
  if (fournisIds.length) {
    y += 3
    doc.setFont('helvetica', 'bold')
    y = ensureY(doc, y, 8)
    doc.text('Documents indiqués par la société à la remise', 18, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    for (const id of fournisIds) {
      y = writeWrapped(doc, `• ${voitureDocumentLabel(id)}`, 18, y, max, 5.5)
    }
    const ecart = documentsEcart(fournisIds, recus)
    if (ecart.manquants.length) {
      y += 2
      y = writeWrapped(
        doc,
        `Écart — non pris par l’opérateur : ${ecart.manquants.map(voitureDocumentLabel).join(', ')}`,
        18,
        y,
        max,
      )
    }
    if (ecart.extra.length) {
      y = writeWrapped(
        doc,
        `Écart — pris en plus : ${ecart.extra.map(voitureDocumentLabel).join(', ')}`,
        18,
        y,
        max,
      )
    }
  }

  if (etat.dommages) {
    y += 3
    doc.setFont('helvetica', 'bold')
    y = ensureY(doc, y, 8)
    doc.text('Dommages / chocs constatés', 18, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    y = writeWrapped(doc, etat.dommages, 18, y, max)
  }
  if (etat.observations) {
    y += 3
    doc.setFont('helvetica', 'bold')
    y = ensureY(doc, y, 8)
    doc.text('Observations', 18, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    y = writeWrapped(doc, etat.observations, 18, y, max)
  }

  return y
}

export function buildBonRemiseMaterielPdf(opts: {
  bon: BonRemiseMateriel
  data: AppData
  signatureImage?: string
}): Blob {
  const { bon, data, signatureImage } = opts
  const op = data.operateur
  const vehicule = bon.kind === 'vehicule'
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(
    vehicule ? 'ÉTAT DES LIEUX VÉHICULE' : 'BON DE REMISE DE MATÉRIEL',
    w / 2,
    y,
    { align: 'center' },
  )
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    vehicule
      ? 'Réception du véhicule — documents pris avec — exemplaire gérant'
      : 'Document officiel — à conserver par le gérant',
    w / 2,
    y,
    { align: 'center' },
  )
  y += 12

  doc.setFont('helvetica', 'bold')
  doc.text('Société', 18, y)
  doc.setFont('helvetica', 'normal')
  y += 6
  doc.text(op.raisonSociale || '—', 18, y)
  y += 5
  if (op.adresse) {
    y = writeWrapped(doc, op.adresse, 18, y, w - 36, 5)
  }
  const siret = op.siret ? `SIRET ${op.siret}` : ''
  const att = op.attestationNumero ? `Attestation ${op.attestationNumero}` : ''
  if (siret || att) {
    y = ensureY(doc, y, 6)
    doc.text([siret, att].filter(Boolean).join('  ·  '), 18, y)
    y += 8
  } else y += 3

  doc.setFont('helvetica', 'bold')
  doc.text('Opérateur destinataire', 18, y)
  doc.setFont('helvetica', 'normal')
  y += 6
  doc.text(bon.userName || '—', 18, y)
  y += 5
  doc.text(`Date de réception : ${formatDateFr(bon.createdAt)}`, 18, y)
  y += 5
  if (bon.createdByUserId && bon.createdByUserId !== bon.userId && bon.createdByName) {
    y = writeWrapped(
      doc,
      `Enregistré par le gérant (${bon.createdByName}) lors de la remise en main propre.`,
      18,
      y,
      w - 36,
      5,
    )
    y += 3
  } else {
    y += 5
  }

  const voiture = bon.voitureId
    ? (data.voitures || []).find((v) => v.id === bon.voitureId)
    : undefined

  if (vehicule && voiture) {
    doc.setFont('helvetica', 'bold')
    doc.text('Véhicule remis', 18, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    y = writeWrapped(doc, voitureTitreCourt(voiture), 18, y, w - 36)
    const meta = [
      voiture.controleTechniqueDate
        ? `Contrôle technique : ${formatDateFr(voiture.controleTechniqueDate)}`
        : null,
      voiture.assuranceDate ? `Assurance jusqu’au ${formatDateFr(voiture.assuranceDate)}` : null,
    ].filter(Boolean)
    if (meta.length) {
      y = writeWrapped(doc, meta.join('  ·  '), 18, y, w - 36)
    }
    y += 4
  } else {
    doc.setFont('helvetica', 'bold')
    doc.text('Matériel remis par la société', 18, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const item of bon.items) {
      y = writeWrapped(doc, `• [${item.famille}]  ${item.label}`, 18, y, w - 36, 6)
    }
    y += 4
  }

  if (vehicule && bon.etatVoiture) {
    y = writeEtatVoiture(doc, {
      etat: bon.etatVoiture,
      fournis: voiture?.documentsFournis,
      y,
      w,
    })
    y += 6
  }

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const attestation = vehicule
    ? 'Je soussigné(e), opérateur, certifie avoir pris possession du véhicule décrit ci-dessus, ' +
      'avoir constaté son état et avoir reçu les documents / accessoires listés. ' +
      'Je m’engage à en prendre soin et à le restituer en fin de mission ou sur demande du gérant.'
    : 'Je soussigné(e), opérateur, certifie avoir reçu en bon état le matériel listé ci-dessus, ' +
      'mis à disposition par la société pour l’exercice de mes fonctions. Je m’engage à en ' +
      'prendre soin et à le restituer en fin de mission ou sur demande du gérant.'
  y = writeWrapped(doc, attestation, 18, y, w - 36, 5)
  y += 8

  y = ensureY(doc, y, 40)
  doc.text(`Fait le ${formatDateFr(bon.createdAt)}`, 18, y)
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Signature de l’opérateur', 18, y)
  y += 4

  if (signatureImage?.startsWith('data:image')) {
    try {
      const fmt = signatureImage.includes('image/jpeg') ? 'JPEG' : 'PNG'
      y = ensureY(doc, y, 28)
      doc.addImage(signatureImage, fmt, 18, y, 50, 22)
      y += 26
    } catch {
      y += 8
      doc.setFont('helvetica', 'italic')
      doc.text('(signature enregistrée au profil)', 18, y)
    }
  } else {
    y += 8
    doc.setFont('helvetica', 'italic')
    doc.text('Validé dans ClimaZEN (réception confirmée sur l’app).', 18, y)
  }

  y = Math.max(y + 12, 270)
  y = ensureY(doc, y, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Réf. ${bon.id}  ·  ClimaZEN  ·  exemplaire gérant`, 18, y)

  return doc.output('blob')
}

export function downloadBonRemisePdf(blob: Blob, fileName: string) {
  downloadBlob(blob, fileName)
}

export async function telechargerBonRemise(opts: {
  bon: BonRemiseMateriel
  data: AppData
  organizationId?: string | null
  signatureImage?: string
}) {
  const { bon, data, organizationId, signatureImage } = opts
  const stored = await loadCerfaPdf(pdfIdBonRemise(bon.id), organizationId)
  if (stored?.blob) {
    downloadBonRemisePdf(stored.blob, bon.fileName || stored.fileName)
    return
  }
  const blob = buildBonRemiseMaterielPdf({ bon, data, signatureImage })
  downloadBonRemisePdf(blob, bon.fileName || fileNameBonRemise(bon))
}
