/** Pack de documents OT — CERFA, fiches, rapport → ZIP / partage. */

import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import { buildCerfaPdf, downloadBlob } from './cerfaPdf'
import { buildFicheMaintenanceClimPdf } from './ficheMaintenanceClimPdf'
import type { FicheMaintenanceClim } from './ficheMaintenanceClim'
import { loadCerfaPdf } from './pdfStore'
import { TYPE_OT_LABELS, type OrdreTravail } from './ordreTravail'
import type { AppData, CerfaDraft, Client, Chantier } from './types'
import { mailtoHref } from './agenda'

export type PackDocKind = 'cerfa' | 'fiche' | 'rapport_ot' | 'rapport_annuel'

export type PackDoc = {
  id: string
  kind: PackDocKind
  label: string
  fileName: string
  blob: Blob
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
  client?: Client,
  site?: Chantier,
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 16
  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Rapport d’intervention — ClimaZEN', margin, y)
  y += 10
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const lines = [
    `N° OT : ${ot.numero || '—'}`,
    `Type : ${TYPE_OT_LABELS[ot.typeOt] || ot.typeOt}`,
    `Date : ${ot.date || '—'}`,
    `Client : ${client?.raisonSociale || '—'}`,
    `Site : ${site?.nom || '—'}`,
    `Technicien : ${ot.technicien || '—'}`,
  ]
  for (const line of lines) {
    doc.text(line, margin, y)
    y += 7
  }
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('Action / demande', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const action = doc.splitTextToSize(ot.action || '—', 180)
  doc.text(action, margin, y)
  y += action.length * 5 + 6
  doc.setFont('helvetica', 'bold')
  doc.text('Rapport d’action', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const rapport = doc.splitTextToSize(ot.rapportAction || '—', 180)
  doc.text(rapport, margin, y)
  y += rapport.length * 5 + 6
  if (ot.observations?.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.text('Observations', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const obs = doc.splitTextToSize(ot.observations, 180)
    doc.text(obs, margin, y)
    y += obs.length * 5 + 8
  }
  const addSig = async (label: string, dataUrl?: string) => {
    if (!dataUrl?.startsWith('data:image')) return
    if (y > 240) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin, y)
    y += 4
    try {
      const fmt = dataUrl.includes('jpeg') || dataUrl.includes('jpg') ? 'JPEG' : 'PNG'
      doc.addImage(dataUrl, fmt, margin, y, 70, 28)
      y += 34
    } catch {
      y += 4
    }
  }
  await addSig('Signature technicien', ot.signatureTechnicienImage)
  await addSig('Signature client', ot.signatureClientImage)
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
    out.push({
      id: `cerfa-${draft.id}`,
      kind: 'cerfa',
      label: `CERFA ${draft.numeroIntervention || ''}`.trim(),
      fileName: uniqueName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`),
      blob,
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
      const fileName = uniqueName(
        `Fiche-maintenance-${safeName(fiche.numero || fiche.id.slice(0, 8))}.pdf`,
      )
      out.push({
        id: `fiche-${fiche.id}`,
        kind: 'fiche',
        label: `Fiche maintenance ${fiche.numero || ''}`.trim(),
        fileName,
        blob,
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
      const blob = await buildRapportOtPdf(ot, client, site)
      out.push({
        id: `rapport-${ot.id}`,
        kind: 'rapport_ot',
        label: 'Rapport OT',
        fileName: uniqueName(`Rapport-OT-${safeName(ot.numero || ot.id.slice(0, 8))}.pdf`),
        blob,
      })
    } catch (err) {
      console.error('ClimaZEN: pack rapport OT', err)
    }
  }

  return out
}

export function packZipFileName(otNumero: string, clientName?: string): string {
  const parts = ['ClimaZEN', safeName(otNumero, 'OT')]
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
