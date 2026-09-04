/**
 * Import migration depuis une autre GMAO — Excel (.xlsx) ou CSV.
 * Remplit clients → sites → équipements sans saisie manuelle.
 */

import * as XLSX from 'xlsx'
import type { AppData, Client, Equipement, Site, TypeClient } from './types'
import { clientDisplayName, syncClientRaisonSociale } from './types'

/** Colonnes du modèle ClimaZEN (export template). */
export const GMAO_IMPORT_HEADERS = [
  'client_raison_sociale',
  'client_type',
  'client_nom',
  'client_prenom',
  'client_adresse',
  'client_code_postal',
  'client_ville',
  'client_telephone',
  'client_email',
  'client_siret',
  'site_nom',
  'site_adresse',
  'site_code_postal',
  'site_ville',
  'equipement_nom',
  'equipement_type',
  'equipement_marque',
  'equipement_modele',
  'equipement_serie',
  'fluide',
  'charge_kg',
] as const

/** Alias d’en-têtes fréquents (autres GMAO / Excel FR). */
const HEADER_ALIASES: Record<string, (typeof GMAO_IMPORT_HEADERS)[number]> = {
  client_raison_sociale: 'client_raison_sociale',
  client: 'client_raison_sociale',
  societe: 'client_raison_sociale',
  société: 'client_raison_sociale',
  raison_sociale: 'client_raison_sociale',
  'raison sociale': 'client_raison_sociale',
  nom_client: 'client_raison_sociale',
  'nom client': 'client_raison_sociale',
  detenteur: 'client_raison_sociale',
  détenteur: 'client_raison_sociale',
  client_type: 'client_type',
  type_client: 'client_type',
  type: 'client_type',
  client_nom: 'client_nom',
  nom: 'client_nom',
  client_prenom: 'client_prenom',
  prenom: 'client_prenom',
  prénom: 'client_prenom',
  client_adresse: 'client_adresse',
  adresse_client: 'client_adresse',
  adresse: 'client_adresse',
  client_code_postal: 'client_code_postal',
  code_postal: 'client_code_postal',
  cp: 'client_code_postal',
  'code postal': 'client_code_postal',
  client_ville: 'client_ville',
  ville: 'client_ville',
  client_telephone: 'client_telephone',
  telephone: 'client_telephone',
  téléphone: 'client_telephone',
  tel: 'client_telephone',
  mobile: 'client_telephone',
  client_email: 'client_email',
  email: 'client_email',
  mail: 'client_email',
  client_siret: 'client_siret',
  siret: 'client_siret',
  site_nom: 'site_nom',
  site: 'site_nom',
  chantier: 'site_nom',
  nom_site: 'site_nom',
  'nom site': 'site_nom',
  etablissement: 'site_nom',
  établissement: 'site_nom',
  site_adresse: 'site_adresse',
  adresse_site: 'site_adresse',
  site_code_postal: 'site_code_postal',
  cp_site: 'site_code_postal',
  site_ville: 'site_ville',
  ville_site: 'site_ville',
  equipement_nom: 'equipement_nom',
  equipement: 'equipement_nom',
  équipement: 'equipement_nom',
  appareil: 'equipement_nom',
  machine: 'equipement_nom',
  nom_equipement: 'equipement_nom',
  equipement_type: 'equipement_type',
  type_equipement: 'equipement_type',
  type_appareil: 'equipement_type',
  equipement_marque: 'equipement_marque',
  marque: 'equipement_marque',
  equipement_modele: 'equipement_modele',
  modele: 'equipement_modele',
  modèle: 'equipement_modele',
  equipement_serie: 'equipement_serie',
  numero_serie: 'equipement_serie',
  'n° serie': 'equipement_serie',
  'n° série': 'equipement_serie',
  serie: 'equipement_serie',
  série: 'equipement_serie',
  fluide: 'fluide',
  fluide_type: 'fluide',
  refrigerant: 'fluide',
  gaz: 'fluide',
  charge_kg: 'charge_kg',
  charge: 'charge_kg',
  'charge nominale': 'charge_kg',
  charge_nominale: 'charge_kg',
}

export type GmaoImportRow = Partial<Record<(typeof GMAO_IMPORT_HEADERS)[number], string>>

export type GmaoImportPreview = {
  rows: GmaoImportRow[]
  clients: number
  sites: number
  equipements: number
  errors: string[]
  warnings: string[]
}

export type GmaoImportApplyResult = {
  clientsCreated: number
  clientsUpdated: number
  sitesCreated: number
  sitesUpdated: number
  equipementsAdded: number
  errors: string[]
}

function normalizeHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function cell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v).trim()
}

function mapHeaders(rawHeaders: string[]): Map<number, (typeof GMAO_IMPORT_HEADERS)[number]> {
  const map = new Map<number, (typeof GMAO_IMPORT_HEADERS)[number]>()
  rawHeaders.forEach((h, i) => {
    const n = normalizeHeader(h)
    const raw = String(h || '').trim().toLowerCase()
    const key =
      HEADER_ALIASES[n] ||
      HEADER_ALIASES[raw] ||
      ((GMAO_IMPORT_HEADERS as readonly string[]).includes(n)
        ? (n as (typeof GMAO_IMPORT_HEADERS)[number])
        : undefined)
    if (key) map.set(i, key)
  })
  return map
}

function sheetToRows(sheet: XLSX.WorkSheet): GmaoImportRow[] {
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]
  if (!aoa.length) return []

  const headerRow = (aoa[0] || []).map((h) => cell(h))
  const colMap = mapHeaders(headerRow)
  if (colMap.size === 0) {
    throw new Error(
      'Aucune colonne reconnue. Téléchargez le modèle ClimaZEN ou renommez les colonnes (client, site, équipement…).',
    )
  }

  const rows: GmaoImportRow[] = []
  for (let r = 1; r < aoa.length; r++) {
    const line = aoa[r] || []
    const row: GmaoImportRow = {}
    let any = false
    for (const [idx, key] of colMap) {
      const v = cell(line[idx])
      if (v) {
        row[key] = v
        any = true
      }
    }
    if (any) rows.push(row)
  }
  return rows
}

/** Parse un fichier .xlsx / .xls / .csv → lignes normalisées. */
export async function parseGmaoImportFile(file: File): Promise<GmaoImportRow[]> {
  const buf = await file.arrayBuffer()
  const name = file.name.toLowerCase()
  const wb = XLSX.read(buf, {
    type: 'array',
    codepage: name.endsWith('.csv') ? 65001 : undefined,
  })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Fichier vide.')
  return sheetToRows(wb.Sheets[sheetName])
}

function normKey(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseTypeClient(raw?: string): TypeClient {
  const t = normKey(raw || '')
  if (/particulier|perso|mr|mme|madame|monsieur/.test(t)) return 'particulier'
  return 'entreprise'
}

function parseChargeKg(raw?: string): number | undefined {
  if (!raw?.trim()) return undefined
  const n = Number(String(raw).replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function previewGmaoImport(rows: GmaoImportRow[]): GmaoImportPreview {
  const errors: string[] = []
  const warnings: string[] = []
  const clientKeys = new Set<string>()
  const siteKeys = new Set<string>()
  let equipements = 0

  rows.forEach((row, i) => {
    const line = i + 2
    const clientLabel =
      row.client_raison_sociale ||
      [row.client_prenom, row.client_nom].filter(Boolean).join(' ')
    if (!clientLabel?.trim()) {
      errors.push(`Ligne ${line} : client manquant.`)
      return
    }
    const ck = normKey(clientLabel)
    clientKeys.add(ck)

    const siteNom = row.site_nom?.trim()
    if (!siteNom) {
      warnings.push(`Ligne ${line} : pas de site — client seul sera importé.`)
      return
    }
    siteKeys.add(`${ck}::${normKey(siteNom)}`)

    if (
      row.equipement_nom ||
      row.equipement_type ||
      row.equipement_marque ||
      row.equipement_serie ||
      row.fluide
    ) {
      equipements += 1
    }
  })

  if (!rows.length) errors.push('Aucune ligne de données.')

  return {
    rows,
    clients: clientKeys.size,
    sites: siteKeys.size,
    equipements,
    errors,
    warnings: warnings.slice(0, 20),
  }
}

type UpsertClientFn = (c: Omit<Client, 'id' | 'createdAt'> & { id?: string }) => string
type UpsertChantierFn = (c: Omit<Site, 'id' | 'createdAt'> & { id?: string }) => string

/**
 * Applique l’import sur le store (upserts incrémentaux — ne remplace pas les
 * interventions ni le stock).
 */
export function applyGmaoImport(
  rows: GmaoImportRow[],
  data: AppData,
  opts: {
    upsertClient: UpsertClientFn
    upsertChantier: UpsertChantierFn
    userId?: string
    userName?: string
  },
): GmaoImportApplyResult {
  const result: GmaoImportApplyResult = {
    clientsCreated: 0,
    clientsUpdated: 0,
    sitesCreated: 0,
    sitesUpdated: 0,
    equipementsAdded: 0,
    errors: [],
  }

  /** clientKey → id */
  const clientIdByKey = new Map<string, string>()
  for (const c of data.clients || []) {
    clientIdByKey.set(normKey(clientDisplayName(c)), c.id)
    if (c.raisonSociale) clientIdByKey.set(normKey(c.raisonSociale), c.id)
  }

  /** clientId::siteKey → site */
  const siteByKey = new Map<string, Site>()
  for (const s of data.chantiers || []) {
    siteByKey.set(`${s.clientId}::${normKey(s.nom)}`, s)
  }

  /** Accumule équipements par site avant upsert */
  type AccSite = {
    clientId: string
    existingId?: string
    nom: string
    adresse: string
    codePostal: string
    ville: string
    equipements: Equipement[]
  }
  const sitesAcc = new Map<string, AccSite>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const line = i + 2
    try {
      let clientLabel =
        row.client_raison_sociale?.trim() ||
        [row.client_prenom, row.client_nom].filter(Boolean).join(' ').trim()
      if (!clientLabel) {
        result.errors.push(`Ligne ${line} : client manquant.`)
        continue
      }

      const typeClient = parseTypeClient(row.client_type)
      const ck = normKey(clientLabel)
      let clientId = clientIdByKey.get(ck)

      const clientPatch = syncClientRaisonSociale({
        typeClient,
        raisonSociale: clientLabel,
        nom: row.client_nom || '',
        prenom: row.client_prenom || '',
        nomContact: row.client_nom
          ? [row.client_prenom, row.client_nom].filter(Boolean).join(' ')
          : '',
        adresse: row.client_adresse || '',
        codePostal: row.client_code_postal || '',
        ville: row.client_ville || '',
        telephone: row.client_telephone || '',
        email: row.client_email || '',
        siret: row.client_siret || undefined,
        createdByUserId: opts.userId,
        createdByName: opts.userName,
      })

      if (clientId) {
        const existing = (data.clients || []).find((c) => c.id === clientId)
        opts.upsertClient({
          ...existing,
          ...clientPatch,
          id: clientId,
          adresse: clientPatch.adresse || existing?.adresse || '',
          codePostal: clientPatch.codePostal || existing?.codePostal || '',
          ville: clientPatch.ville || existing?.ville || '',
          telephone: clientPatch.telephone || existing?.telephone || '',
          email: clientPatch.email || existing?.email || '',
        })
        result.clientsUpdated += 1
      } else {
        clientId = opts.upsertClient(clientPatch)
        clientIdByKey.set(ck, clientId)
        result.clientsCreated += 1
      }

      const siteNom = row.site_nom?.trim()
      if (!siteNom) continue

      const sk = `${clientId}::${normKey(siteNom)}`
      let acc = sitesAcc.get(sk)
      if (!acc) {
        const existing = siteByKey.get(sk)
        acc = {
          clientId,
          existingId: existing?.id,
          nom: siteNom,
          adresse: row.site_adresse || existing?.adresse || row.client_adresse || '',
          codePostal: row.site_code_postal || existing?.codePostal || row.client_code_postal || '',
          ville: row.site_ville || existing?.ville || row.client_ville || '',
          equipements: [...(existing?.equipements || [])],
        }
        sitesAcc.set(sk, acc)
      } else {
        if (row.site_adresse) acc.adresse = row.site_adresse
        if (row.site_code_postal) acc.codePostal = row.site_code_postal
        if (row.site_ville) acc.ville = row.site_ville
      }

      const eqNom =
        row.equipement_nom?.trim() ||
        [row.equipement_type, row.equipement_marque, row.equipement_modele]
          .filter(Boolean)
          .join(' ')
          .trim()
      if (!eqNom && !row.fluide && !row.equipement_serie) continue

      const fluide = row.fluide?.trim() || ''
      const charge = parseChargeKg(row.charge_kg)
      const serie = row.equipement_serie?.trim() || ''

      const dup = acc.equipements.find(
        (e) =>
          (serie && normKey(e.numeroSerie) === normKey(serie)) ||
          (!serie && normKey(e.nom) === normKey(eqNom || 'Équipement')),
      )
      if (dup) {
        dup.type = row.equipement_type || dup.type
        dup.marque = row.equipement_marque || dup.marque
        dup.modele = row.equipement_modele || dup.modele
        if (serie) dup.numeroSerie = serie
        if (fluide) {
          dup.fluideType = fluide
          dup.avecFluideFrigorigene = true
        }
        if (charge != null) dup.chargeNominaleKg = charge
        continue
      }

      const eq: Equipement = {
        id: crypto.randomUUID(),
        nom: eqNom || 'Équipement',
        type: row.equipement_type || '',
        marque: row.equipement_marque || '',
        modele: row.equipement_modele || '',
        numeroSerie: serie,
        avecFluideFrigorigene: Boolean(fluide),
        fluideType: fluide,
        chargeNominaleKg: charge ?? 0,
        detectionPermanente: false,
      }
      acc.equipements.push(eq)
      result.equipementsAdded += 1
    } catch (err) {
      result.errors.push(
        `Ligne ${line} : ${err instanceof Error ? err.message : 'erreur'}`,
      )
    }
  }

  for (const acc of sitesAcc.values()) {
    const first = acc.equipements[0]
    const payload = {
      id: acc.existingId,
      clientId: acc.clientId,
      nom: acc.nom,
      adresse: acc.adresse,
      codePostal: acc.codePostal,
      ville: acc.ville,
      statut: 'actif' as const,
      equipements: acc.equipements,
      equipementType: first?.type || '',
      equipementMarque: first?.marque || '',
      equipementModele: first?.modele || '',
      equipementNumeroSerie: first?.numeroSerie || '',
      fluideType: first?.fluideType || '',
      chargeNominaleKg: first?.chargeNominaleKg ?? 0,
      detectionPermanente: first?.detectionPermanente ?? false,
      avecFluideFrigorigene: acc.equipements.some((e) => e.avecFluideFrigorigene !== false && e.fluideType),
      createdByUserId: opts.userId,
      createdByName: opts.userName,
    }
    opts.upsertChantier(payload)
    if (acc.existingId) result.sitesUpdated += 1
    else result.sitesCreated += 1
  }

  // Évite de compter plusieurs fois le même client mis à jour
  // (déjà incrémenté ligne à ligne — acceptable pour feedback UI)

  return result
}

/** Télécharge un modèle Excel vide avec en-têtes + 1 exemple. */
export function downloadGmaoImportTemplate() {
  const example = [
    GMAO_IMPORT_HEADERS as unknown as string[],
    [
      'Dupont Clim SARL',
      'entreprise',
      '',
      '',
      '12 rue des Lilas',
      '06000',
      'Nice',
      '0493000000',
      'contact@dupont-clim.fr',
      '12345678900012',
      'Siège - Atelier',
      '12 rue des Lilas',
      '06000',
      'Nice',
      'Clim RDC',
      'split',
      'Daikin',
      'FTXM35',
      'SN123',
      'R-32',
      '1.2',
    ],
    [
      'Martin',
      'particulier',
      'Martin',
      'Albert',
      '5 av. Foch',
      '06100',
      'Nice',
      '0612345678',
      '',
      '',
      'Maison',
      '5 av. Foch',
      '06100',
      'Nice',
      'PAC',
      'PAC',
      'Mitsubishi',
      '',
      '',
      'R-410A',
      '2.5',
    ],
  ]
  const ws = XLSX.utils.aoa_to_sheet(example)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Import ClimaZEN')
  XLSX.writeFile(wb, 'climazen-modele-import-gmao.xlsx')
}
