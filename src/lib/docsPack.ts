/** Pack de documents OT — CERFA, fiches, rapport → ZIP / partage. */

import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import { buildCerfaPdf, downloadBlob } from './cerfaPdf'
import { buildFicheMaintenanceClimPdf } from './ficheMaintenanceClimPdf'
import type { FicheMaintenanceClim } from './ficheMaintenanceClim'
import { loadCerfaPdf } from './pdfStore'
import { TYPE_OT_LABELS, formatOtAvancement, isOtCloture, type OrdreTravail } from './ordreTravail'
import type { AppData, CerfaDraft, Client, Chantier } from './types'
import { mailtoHref } from './agenda'
import { allEquipements } from './cerfaBatch'

export type PackDocKind = 'cerfa' | 'fiche' | 'rapport_ot' | 'rapport_annuel'

export type PackDoc = {
  id: string
  kind: PackDocKind
  label: string
  fileName: string
  blob: Blob
  /** Id source (intervention / fiche) pour lecture / suppression. */
  sourceId?: string
  /** Suppression possible (CERFA / fiche). Rapport OT = exclusion du lot seulement. */
  canDelete?: boolean
}

function safeName(raw: string, fallback = 'doc'): string {
  const s = (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s.slice(0, 80) || fallback
}

function interventionsForOt(data: AppData, ot: OrdreTravail): CerfaDraft[] {
  const num = (ot.numero || '').trim()
  return (data.interventions || []).filter((i) => {
    if (ot.interventionId && i.id === ot.interventionId) return true
    if (i.ordreTravailId && i.ordreTravailId === ot.id) return true
    if (num && i.numeroIntervention === num) return true
    if (num && (i.numeroIntervention || '').startsWith(`${num}-`)) return true
    return false
  })
}

function fichesForOt(data: AppData, ot: OrdreTravail): FicheMaintenanceClim[] {
  const fiches = data.fichesMaintenanceClim || []
  const num = (ot.numero || '').trim()
  const byId = ot.ficheMaintenanceId
    ? fiches.filter((f) => f.id === ot.ficheMaintenanceId)
    : []
  const byNum = num
    ? fiches.filter(
        (f) =>
          f.numero === num ||
          (f.numero || '').startsWith(`${num}-`) ||
          (f.numero || '') === num,
      )
    : []
  const map = new Map<string, FicheMaintenanceClim>()
  for (const f of [...byId, ...byNum]) map.set(f.id, f)
  // Aussi fiches du même site + date proches si liées par numéro vide mais OT id in notes? skip — stick to explicit links
  return [...map.values()]
}

async function buildRapportOtPdf(
  ot: OrdreTravail,
  opts: {
    client?: Client
    site?: Chantier
    operateur?: Pick<
      AppData['operateur'],
      | 'raisonSociale'
      | 'adresse'
      | 'telephone'
      | 'email'
      | 'siret'
      | 'attestationNumero'
      | 'logoImage'
    >
    equipLabels?: string[]
    clientSignNom?: string
  },
): Promise<Blob> {
  const { client, site, operateur, equipLabels = [], clientSignNom } = opts
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const maxW = pageW - margin * 2
  const ACCENT: [number, number, number] = [15, 118, 110]
  const INK: [number, number, number] = [15, 23, 42]
  const MUTED: [number, number, number] = [100, 116, 139]
  const LINE: [number, number, number] = [226, 232, 240]
  const SOFT: [number, number, number] = [240, 253, 250]
  let y = 0

  const fmtDate = (iso: string) => {
    const d = (iso || '').slice(0, 10)
    const [yy, mm, dd] = d.split('-')
    if (!yy || !mm || !dd) return iso || '—'
    return `${dd}/${mm}/${yy}`
  }

  const imageFormat = (dataUrl: string): 'PNG' | 'JPEG' | null => {
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
    if (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/webp')) return 'PNG'
    if (dataUrl.startsWith('data:image')) return 'PNG'
    return null
  }

  const embedImage = async (
    dataUrl: string | undefined,
    x: number,
    yy: number,
    w: number,
    h: number,
  ) => {
    if (!dataUrl?.startsWith('data:image')) return false
    const fmt = imageFormat(dataUrl)
    if (!fmt) return false
    try {
      doc.addImage(dataUrl, fmt, x, yy, w, h)
      return true
    } catch {
      try {
        doc.addImage(dataUrl, 'PNG', x, yy, w, h)
        return true
      } catch {
        return false
      }
    }
  }

  const ensureSpace = (need: number) => {
    // Réserver la zone signatures en bas (~52 mm) sur la dernière page utile
    if (y + need > pageH - 58) {
      doc.addPage()
      doc.setFillColor(...ACCENT)
      doc.rect(0, 0, pageW, 3, 'F')
      y = 12
    }
  }

  const drawSection = (title: string, body: string) => {
    ensureSpace(22)
    doc.setFillColor(...SOFT)
    doc.roundedRect(margin, y, maxW, 7, 1.2, 1.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ACCENT)
    doc.text(title, margin + 3, y + 4.8)
    y += 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(body?.trim() || '—', maxW)
    ensureSpace(lines.length * 4.2 + 6)
    doc.text(lines, margin, y)
    y += lines.length * 4.2 + 6
  }

  // ——— En-tête société + logo ———
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setFillColor(...SOFT)
  doc.rect(0, 30, pageW, 9, 'F')

  const logo = operateur?.logoImage
  let titleX = margin
  if (logo) {
    // Fond blanc derrière le logo pour lisibilité
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin - 1, 4, 22, 22, 2, 2, 'F')
    const ok = await embedImage(logo, margin, 5, 20, 20)
    if (ok) titleX = margin + 24
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Rapport d’intervention', titleX, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const companyLine = operateur?.raisonSociale || 'ClimaZEN'
  doc.text(companyLine, titleX, 19)
  const companyMeta = [
    operateur?.telephone,
    operateur?.email,
    operateur?.siret ? `SIRET ${operateur.siret}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ')
  if (companyMeta) {
    doc.setFontSize(7.5)
    doc.text(companyMeta, titleX, 25)
  }

  y = 37
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`OT ${ot.numero || '—'}`, margin, y)
  doc.text(fmtDate(ot.date), margin + 48, y)
  doc.text(TYPE_OT_LABELS[ot.typeOt] || ot.typeOt || '—', margin + 78, y)
  doc.text(`Technicien : ${ot.technicien || '—'}`, margin + 120, y)
  y = 46

  // ——— Carte infos client / site ———
  const siteAdresse = [site?.adresse, [site?.codePostal, site?.ville].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const infoRows: [string, string][] = [
    ['Client', client?.raisonSociale || '—'],
    [
      'Contact',
      [client?.nomContact, client?.telephone, client?.email].filter(Boolean).join(' · ') || '—',
    ],
    ['Site', site?.nom || '—'],
    ['Adresse', siteAdresse || client?.adresse || '—'],
  ]
  if (equipLabels.length) {
    infoRows.push(['Équipement(s)', equipLabels.join('\n')])
  }

  let infoH = 8
  for (const [, v] of infoRows) {
    const wrapped = doc.splitTextToSize(String(v), maxW - 40)
    infoH += Math.max(4.4, wrapped.length * 3.8) + 0.8
  }
  infoH += 2
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, maxW, infoH, 2, 2, 'FD')
  doc.setFillColor(...ACCENT)
  doc.roundedRect(margin, y, 2.2, infoH, 1, 1, 'F')

  let iy = y + 5.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('Client & intervention', margin + 5, iy)
  iy += 5.5
  for (const [k, v] of infoRows) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(k, margin + 5, iy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    const wrapped = doc.splitTextToSize(String(v), maxW - 40)
    doc.text(wrapped, margin + 36, iy)
    iy += Math.max(4.4, wrapped.length * 3.8) + 0.8
  }
  y = y + infoH + 6

  drawSection('Demande / action', ot.action || '—')
  drawSection('Rapport d’action (réalisé)', ot.rapportAction || ot.action || '—')
  const avancement = isOtCloture(ot.statut)
    ? 'Terminé (100 %)'
    : formatOtAvancement(ot) || (ot.interventionPartielle ? `${ot.avancementPct || 0} %` : '')
  if (avancement) {
    const visites = (ot.visitesPresence || [])
      .map((v) => `${fmtDate(v.date)} · ${v.avancementPct} %${v.signatureClientImage ? ' · présence signée' : ''}`)
      .join('\n')
    drawSection(
      'Avancement',
      visites
        ? `${avancement}${ot.interventionPartielle ? ' — intervention partielle' : ''}\n${visites}`
        : `${avancement}${ot.interventionPartielle ? ' — intervention partielle (chantier en cours)' : ''}`,
    )
  }
  if (ot.observations?.trim()) {
    drawSection('Observations', ot.observations)
  }

  // ——— Cases de signature en bas de page ———
  const boxW = (maxW - 6) / 2
  const boxH = 36
  const sigY = pageH - 52
  if (y > sigY - 4) {
    doc.addPage()
    doc.setFillColor(...ACCENT)
    doc.rect(0, 0, pageW, 3, 'F')
  }
  const sy = Math.max(y + 2, sigY)

  doc.setFillColor(...SOFT)
  doc.roundedRect(margin, sy - 8, maxW, 7, 1.2, 1.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('Validation & signatures', margin + 3, sy - 3.2)

  const drawSignBox = async (
    x: number,
    title: string,
    img?: string,
    name?: string,
    qualite?: string,
  ) => {
    doc.setDrawColor(...LINE)
    doc.setFillColor(255, 255, 255)
    doc.setLineWidth(0.35)
    doc.roundedRect(x, sy, boxW, boxH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(title, x + 3, sy + 4.5)
    // Zone signature
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.2)
    doc.roundedRect(x + 3, sy + 7, boxW - 6, 18, 1.2, 1.2, 'S')
    await embedImage(img, x + 5, sy + 8, boxW - 10, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK)
    if (name) doc.text(name, x + 3, sy + boxH - 5.5)
    if (qualite) {
      doc.setFontSize(6.5)
      doc.setTextColor(...MUTED)
      doc.text(qualite, x + 3, sy + boxH - 2)
    }
  }

  await drawSignBox(
    margin,
    'Signature technicien',
    ot.signatureTechnicienImage,
    ot.technicien || '—',
    'Opérateur attesté',
  )
  await drawSignBox(
    margin + boxW + 6,
    'Signature client / détenteur',
    ot.signatureClientImage,
    clientSignNom || client?.nomContact || client?.raisonSociale || '—',
    'Représentant client',
  )

  // Pied de page
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.2)
  doc.line(margin, pageH - 9, pageW - margin, pageH - 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  const foot = [
    operateur?.raisonSociale,
    operateur?.attestationNumero ? `Attestation ${operateur.attestationNumero}` : '',
    operateur?.siret ? `SIRET ${operateur.siret}` : '',
    'Document généré avec ClimaZEN',
  ]
    .filter(Boolean)
    .join('  ·  ')
  doc.text(foot, margin, pageH - 5)

  return doc.output('blob')
}

/**
 * Collecte tous les PDF liés à un OT (CERFA stockés ou régénérés, fiches, rapport).
 */
export async function collectOtDocsPack(opts: {
  ot: OrdreTravail
  data: AppData
  organizationId?: string | null
  includeRapportOt?: boolean
}): Promise<PackDoc[]> {
  const { ot, data, organizationId, includeRapportOt = true } = opts
  const client = data.clients.find((c) => c.id === ot.clientId)
  const site = data.chantiers.find((c) => c.id === ot.chantierId)
  const out: PackDoc[] = []
  const usedNames = new Set<string>()

  const uniqueName = (base: string) => {
    let name = base
    let n = 2
    while (usedNames.has(name.toLowerCase())) {
      name = base.replace(/\.pdf$/i, `-${n}.pdf`)
      n += 1
    }
    usedNames.add(name.toLowerCase())
    return name
  }

  const intervList = interventionsForOt(data, ot)
  for (const draft of intervList) {
    let blob: Blob | null = null
    let fileName = `CERFA-${safeName(draft.numeroIntervention || draft.id.slice(0, 8))}.pdf`
    const stored = await loadCerfaPdf(draft.id, organizationId)
    if (stored?.blob) {
      blob = stored.blob
      if (stored.fileName) fileName = stored.fileName
    } else {
      try {
        blob = await buildCerfaPdf({
          draft,
          client: (client || {
            id: '',
            raisonSociale: '',
            nomContact: '',
            adresse: '',
            codePostal: '',
            ville: '',
            telephone: '',
            email: '',
            createdAt: '',
          }) as Client,
          chantier: (site || {
            id: '',
            clientId: '',
            nom: '',
            adresse: '',
            codePostal: '',
            ville: '',
            statut: 'actif',
            createdAt: '',
            equipementType: '',
            equipementMarque: '',
            equipementModele: '',
            equipementNumeroSerie: '',
            fluideType: '',
            chargeNominaleKg: 0,
            detectionPermanente: false,
          }) as Chantier,
        })
        fileName = `CERFA-15497-04-${safeName(draft.dateIntervention || ot.date || 'doc')}-${safeName(draft.numeroIntervention || draft.id.slice(0, 8))}.pdf`
      } catch (err) {
        console.error('ClimaZEN: pack CERFA', draft.id, err)
      }
    }
    if (!blob) continue
    const eq = site ? allEquipements(site).find((e) => e.id === draft.equipementId) : undefined
    const eqLabel =
      eq
        ? [eq.nom || eq.type, eq.marque, eq.modele, eq.numeroSerie ? `SN ${eq.numeroSerie}` : '']
            .filter(Boolean)
            .join(' · ')
        : draft.fluideType || draft.id.slice(0, 8)
    out.push({
      id: `cerfa-${draft.id}`,
      kind: 'cerfa',
      label: `CERFA ${draft.numeroIntervention || ''} · ${eqLabel}`.trim(),
      fileName: uniqueName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`),
      blob,
      sourceId: draft.id,
      canDelete: true,
    })
  }

  for (const fiche of fichesForOt(data, ot)) {
    try {
      const blob = await buildFicheMaintenanceClimPdf(fiche, {
        raisonSociale: data.operateur?.raisonSociale,
        adresse: data.operateur?.adresse,
        telephone: data.operateur?.telephone,
        email: data.operateur?.email,
        siret: data.operateur?.siret,
        logoImage: data.operateur?.logoImage,
      })
      const eq = site ? allEquipements(site).find((e) => e.id === fiche.equipementId) : undefined
      const eqLabel =
        eq
          ? [eq.nom || eq.type, eq.marque, eq.modele].filter(Boolean).join(' · ')
          : [fiche.marqueModele, fiche.numeroSerie].filter(Boolean).join(' · ') ||
            fiche.id.slice(0, 8)
      const fileName = uniqueName(
        `Fiche-maintenance-${safeName(fiche.numero || fiche.id.slice(0, 8))}-${safeName(eqLabel)}.pdf`,
      )
      out.push({
        id: `fiche-${fiche.id}`,
        kind: 'fiche',
        label: `Fiche maintenance · ${eqLabel}`.trim(),
        fileName,
        blob,
        sourceId: fiche.id,
        canDelete: true,
      })
    } catch (err) {
      console.error('ClimaZEN: pack fiche', fiche.id, err)
    }
  }

  const hasRapport =
    includeRapportOt &&
    !!(ot.rapportAction?.trim() || ot.action?.trim() || ot.signatureTechnicienImage || ot.signatureClientImage)
  if (hasRapport) {
    try {
      const eqIds =
        ot.equipementIds && ot.equipementIds.length > 0
          ? ot.equipementIds
          : ot.equipementId
            ? [ot.equipementId]
            : []
      const equipLabels = eqIds
        .map((eqId) => {
          const eq = site ? allEquipements(site).find((e) => e.id === eqId) : undefined
          if (!eq) return ''
          return [eq.nom || eq.type, eq.marque, eq.modele, eq.numeroSerie ? `N° ${eq.numeroSerie}` : '']
            .filter(Boolean)
            .join(' · ')
        })
        .filter(Boolean)
      const blob = await buildRapportOtPdf(ot, {
        client,
        site,
        operateur: data.operateur,
        equipLabels,
        clientSignNom:
          site?.signatureDetenteurNom || client?.nomContact || client?.raisonSociale || '',
      })
      out.push({
        id: `rapport-${ot.id}`,
        kind: 'rapport_ot',
        label: 'Rapport OT',
        fileName: uniqueName(`Rapport-OT-${safeName(ot.numero || ot.id.slice(0, 8))}.pdf`),
        blob,
        sourceId: ot.id,
        canDelete: false,
      })
    } catch (err) {
      console.error('ClimaZEN: pack rapport OT', err)
    }
  }

  return out
}

export function packZipFileName(otNumero: string, clientName?: string): string {
  const parts = ['ClimaZEN', safeName(otNumero, 'INT')]
  if (clientName?.trim()) parts.push(safeName(clientName))
  return `${parts.join('-')}-docs.zip`
}

export async function zipDocsPack(docs: PackDoc[]): Promise<Blob> {
  const zip = new JSZip()
  for (const d of docs) {
    zip.file(d.fileName, d.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function downloadDocsPack(docs: PackDoc[], zipName: string): Promise<void> {
  if (docs.length === 0) return
  if (docs.length === 1) {
    downloadBlob(docs[0].blob, docs[0].fileName)
    return
  }
  const zipBlob = await zipDocsPack(docs)
  downloadBlob(zipBlob, zipName)
}

/** Web Share API (fichiers) si dispo — sinon false. */
export async function shareDocsPack(opts: {
  docs: PackDoc[]
  title: string
  text?: string
  zipName: string
}): Promise<'shared' | 'unsupported' | 'cancelled' | 'error'> {
  const { docs, title, text, zipName } = opts
  if (docs.length === 0) return 'error'

  const files: File[] = []
  if (docs.length === 1) {
    files.push(new File([docs[0].blob], docs[0].fileName, { type: 'application/pdf' }))
  } else {
    const zipBlob = await zipDocsPack(docs)
    files.push(new File([zipBlob], zipName, { type: 'application/zip' }))
  }

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
  }
  const data: ShareData = { files, title, text }
  if (typeof nav.share !== 'function') return 'unsupported'
  try {
    if (typeof nav.canShare === 'function' && !nav.canShare(data)) return 'unsupported'
    await nav.share(data)
    return 'shared'
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === 'AbortError') return 'cancelled'
    console.error('ClimaZEN: share docs', err)
    return 'error'
  }
}

export function clientMailtoForPack(opts: {
  email?: string
  otNumero: string
  clientName?: string
  docCount: number
  zipName: string
}): string | null {
  const subject = `Documents intervention ${opts.otNumero}${opts.clientName ? ` — ${opts.clientName}` : ''}`
  const body = [
    `Bonjour,`,
    ``,
    `Veuillez trouver ci-joint les documents de l’intervention ${opts.otNumero} (${opts.docCount} fichier${opts.docCount > 1 ? 's' : ''} : ${opts.zipName}).`,
    ``,
    `Cordialement,`,
  ].join('\n')
  return mailtoHref(opts.email, subject, body)
}

export function packAnnuelZipFileName(year: number, orgName?: string): string {
  const parts = ['ClimaZEN', 'CERFA', String(year)]
  if (orgName?.trim()) parts.push(safeName(orgName))
  return `${parts.join('-')}-lot-annuel.zip`
}

/**
 * Lot annuel pour bureau de contrôle : CERFA sélectionnés (+ rapport fluides optionnel).
 */
export async function collectCerfaAnnuelPack(opts: {
  drafts: CerfaDraft[]
  data: AppData
  organizationId?: string | null
  year: number
  includeRapportAnnuel?: boolean
}): Promise<PackDoc[]> {
  const { drafts, data, organizationId, year, includeRapportAnnuel = true } = opts
  const out: PackDoc[] = []
  const usedNames = new Set<string>()

  const uniqueName = (base: string) => {
    let name = base
    let n = 2
    while (usedNames.has(name.toLowerCase())) {
      name = base.replace(/\.pdf$/i, `-${n}.pdf`)
      n += 1
    }
    usedNames.add(name.toLowerCase())
    return name
  }

  for (const draft of drafts) {
    const client = data.clients.find((c) => c.id === draft.clientId)
    const site = data.chantiers.find((c) => c.id === draft.chantierId)
    let blob: Blob | null = null
    let fileName = `CERFA-${safeName(draft.numeroIntervention || draft.dateIntervention || draft.id.slice(0, 8))}.pdf`
    const stored = await loadCerfaPdf(draft.id, organizationId)
    if (stored?.blob) {
      blob = stored.blob
      if (stored.fileName) fileName = stored.fileName
    } else {
      try {
        blob = await buildCerfaPdf({
          draft,
          client: (client || {
            id: '',
            raisonSociale: '',
            nomContact: '',
            adresse: '',
            codePostal: '',
            ville: '',
            telephone: '',
            email: '',
            createdAt: '',
          }) as Client,
          chantier: (site || {
            id: '',
            clientId: '',
            nom: '',
            adresse: '',
            codePostal: '',
            ville: '',
            statut: 'actif',
            createdAt: '',
            equipementType: '',
            equipementMarque: '',
            equipementModele: '',
            equipementNumeroSerie: '',
            fluideType: '',
            chargeNominaleKg: 0,
            detectionPermanente: false,
          }) as Chantier,
        })
        fileName = `CERFA-15497-04-${safeName(draft.dateIntervention || String(year))}-${safeName(draft.numeroIntervention || draft.id.slice(0, 8))}.pdf`
      } catch (err) {
        console.error('ClimaZEN: pack annuel CERFA', draft.id, err)
      }
    }
    if (!blob) continue
    const siteLabel = site?.nom || client?.raisonSociale || ''
    out.push({
      id: `cerfa-${draft.id}`,
      kind: 'cerfa',
      label: `CERFA ${draft.numeroIntervention || ''} · ${draft.dateIntervention || ''}${siteLabel ? ` · ${siteLabel}` : ''}`.trim(),
      fileName: uniqueName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`),
      blob,
    })
  }

  if (includeRapportAnnuel) {
    try {
      const { buildRapportAnnuelGaz } = await import('./rapportAnnuelGaz')
      const { buildRapportAnnuelGazPdf, rapportAnnuelFilename } = await import('./rapportAnnuelGazPdf')
      const rapport = buildRapportAnnuelGaz(data, year)
      const blob = await buildRapportAnnuelGazPdf(rapport)
      out.push({
        id: `rapport-annuel-${year}`,
        kind: 'rapport_annuel',
        label: `Rapport annuel fluides ${year}`,
        fileName: uniqueName(rapportAnnuelFilename(year)),
        blob,
      })
    } catch (err) {
      console.error('ClimaZEN: pack rapport annuel', err)
    }
  }

  return out
}

export function annuelMailtoForPack(opts: {
  email?: string
  year: number
  docCount: number
  zipName: string
  orgName?: string
}): string | null {
  const subject = `Lot annuel CERFA ${opts.year}${opts.orgName ? ` — ${opts.orgName}` : ''} (contrôle / attestation)`
  const body = [
    `Bonjour,`,
    ``,
    `Veuillez trouver ci-joint le lot annuel ${opts.year} pour contrôle / rapport d’attestation de capacité.`,
    `Contenu : ${opts.docCount} fichier${opts.docCount > 1 ? 's' : ''} (${opts.zipName}).`,
    ``,
    `Cordialement,`,
  ].join('\n')
  return mailtoHref(opts.email, subject, body)
}
