/**
 * Dossier RH par technicien — pièces d’identité, permis, attestations métier
 * (aptitude froid, habilitation électrique…) avec dates d’expiration.
 * Stocké dans le coffre société (AppData), pas sur le profil Auth.
 */

import { parsePostePersonnel, type PostePersonnelId } from './postePersonnel'

export const ALERTE_EXPIRATION_JOURS = 45

export type TypeDocumentRh =
  | 'cni'
  | 'passeport'
  | 'titre_sejour'
  | 'permis_conduire'
  | 'carte_vitale'
  | 'attestation_aptitude_froid'
  | 'habilitation_electrique'
  | 'visite_medicale'
  | 'sst'
  | 'caces'
  | 'travail_hauteur'
  | 'aipr'
  | 'amiante_ss4'
  | 'rib'
  | 'justificatif_domicile'
  | 'contrat_travail'
  | 'diplome'
  | 'autre'

export type StatutDocumentRh = 'ok' | 'bientot' | 'expire' | 'sans_date' | 'manquant'

export type GroupeDocumentRh = 'identite' | 'sante' | 'conduite' | 'froid' | 'elec' | 'securite' | 'admin'

export type DocumentRhCatalogItem = {
  type: TypeDocumentRh
  label: string
  hint: string
  groupe: GroupeDocumentRh
  /** Durée de validité indicative (années) — pour proposer une date d’expiration. */
  dureeIndicativeAns?: number
  /** Une pièce parmi ce groupe suffit (ex. CNI ou passeport). */
  identite?: boolean
  /** Visible seulement par le gérant et le personnel RH autorisé. */
  accesAdmin?: boolean
}

export const TYPES_DOCUMENT_RH: DocumentRhCatalogItem[] = [
  {
    type: 'cni',
    label: 'Carte d’identité',
    hint: 'CNI en cours de validité (ou passeport / titre de séjour).',
    groupe: 'identite',
    dureeIndicativeAns: 15,
    identite: true,
  },
  {
    type: 'passeport',
    label: 'Passeport',
    hint: 'Alternative à la CNI.',
    groupe: 'identite',
    dureeIndicativeAns: 10,
    identite: true,
  },
  {
    type: 'titre_sejour',
    label: 'Titre de séjour',
    hint: 'Si le technicien n’a pas de CNI française.',
    groupe: 'identite',
    identite: true,
  },
  {
    type: 'permis_conduire',
    label: 'Permis de conduire',
    hint: 'Obligatoire s’il conduit (véhicule société ou perso sur chantiers).',
    groupe: 'conduite',
  },
  {
    type: 'carte_vitale',
    label: 'Carte Vitale',
    hint: 'Carte Vitale / attestation de droits.',
    groupe: 'sante',
    accesAdmin: true,
  },
  {
    type: 'visite_medicale',
    label: 'Visite médicale (médecine du travail)',
    hint: 'Aptitude au poste — à renouveler selon le médecin du travail.',
    groupe: 'sante',
    dureeIndicativeAns: 2,
  },
  {
    type: 'attestation_aptitude_froid',
    label: 'Attestation d’aptitude fluides (F-Gas)',
    hint: 'Cat. I, II, III ou IV — obligatoire pour toute manipulation de fluide. Validité typique 5 ans.',
    groupe: 'froid',
    dureeIndicativeAns: 5,
  },
  {
    type: 'habilitation_electrique',
    label: 'Habilitation électrique',
    hint: 'B1V, BR, B2V, H0… — obligatoire dès qu’on touche à l’électrique. Recyclage typique 3 ans.',
    groupe: 'elec',
    dureeIndicativeAns: 3,
  },
  {
    type: 'sst',
    label: 'SST / PSC1',
    hint: 'Sauveteur secouriste du travail — recyclage tous les 2 ans.',
    groupe: 'securite',
    dureeIndicativeAns: 2,
  },
  {
    type: 'caces',
    label: 'CACES (nacelle / chariot)',
    hint: 'Si nacelle, PEMP ou chariot (bouteilles, toiture). Recyclage typique 5 ans.',
    groupe: 'securite',
    dureeIndicativeAns: 5,
  },
  {
    type: 'travail_hauteur',
    label: 'Travail en hauteur / harnais',
    hint: 'Toitures, échelles, EPI antichute.',
    groupe: 'securite',
    dureeIndicativeAns: 3,
  },
  {
    type: 'aipr',
    label: 'AIPR',
    hint: 'Si travaux à proximité de réseaux (voirie, terrassement).',
    groupe: 'securite',
    dureeIndicativeAns: 5,
  },
  {
    type: 'amiante_ss4',
    label: 'Amiante sous-section 4',
    hint: 'Si interventions sur matériaux susceptibles d’amiante.',
    groupe: 'securite',
    dureeIndicativeAns: 3,
  },
  {
    type: 'rib',
    label: 'RIB',
    hint: 'Coordonnées bancaires (paie).',
    groupe: 'admin',
    accesAdmin: true,
  },
  {
    type: 'justificatif_domicile',
    label: 'Justificatif de domicile',
    hint: 'Moins de 3 mois en général.',
    groupe: 'admin',
    accesAdmin: true,
  },
  {
    type: 'contrat_travail',
    label: 'Contrat de travail / DPAE',
    hint: 'Contrat, avenants, DPAE.',
    groupe: 'admin',
    accesAdmin: true,
  },
  {
    type: 'diplome',
    label: 'Diplôme / titre pro',
    hint: 'CAP, BP, mention complémentaire, titre professionnel.',
    groupe: 'admin',
  },
  {
    type: 'autre',
    label: 'Autre document',
    hint: 'Mutuelle, badge, formation incendie, etc.',
    groupe: 'admin',
  },
]

const CATALOG_BY_TYPE = new Map(TYPES_DOCUMENT_RH.map((item) => [item.type, item]))

export function catalogDocumentRh(type: TypeDocumentRh): DocumentRhCatalogItem {
  return CATALOG_BY_TYPE.get(type) || TYPES_DOCUMENT_RH[TYPES_DOCUMENT_RH.length - 1]
}

export function labelDocumentRh(type: TypeDocumentRh): string {
  return catalogDocumentRh(type).label
}

export interface DocumentRh {
  id: string
  type: TypeDocumentRh
  /** Précision : Cat. I, BR, CACES 3A… */
  libelle?: string
  numero?: string
  /** YYYY-MM-DD */
  dateObtention?: string
  /** YYYY-MM-DD — vide = pas de date limite connue */
  dateExpiration?: string
  fichierNom?: string
  /** Photo / scan — jamais persisté (protection identités). Aperçu formulaire seulement. */
  fichierDataUrl?: string
  /** Une copie papier / photo a été vue, sans être stockée. */
  scanConfirme?: boolean
  /** Lien https vers le fichier dans le cloud société (Drive, OneDrive, SharePoint…). */
  lienCloud?: string
  /** Fin de validité du lien de partage (lien temporaire). */
  lienCloudExpire?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PersonnelDossier {
  id: string
  userId: string
  userName: string
  /** Poste métier (tech CVC, secrétaire, directeur…) — catalogue `postePersonnel`. */
  poste?: PostePersonnelId
  /** Portable pro — visible dans Équipe à côté du nom / e-mail */
  telephone?: string
  /** Manipulation fluides — aptitude F-Gas obligatoire */
  toucheFroid: boolean
  /** Travail sur parties électriques */
  toucheElectricite: boolean
  /** Conduit pour se rendre sur chantier */
  conduitVehicule: boolean
  notes?: string
  documents: DocumentRh[]
  /** Types masqués par la secrétaire (croix) — pas d’obligation, pas d’alerte « manquant ». */
  typesMasques?: TypeDocumentRh[]
  /**
   * Lien https du dossier cloud de CE technicien (Drive / OneDrive / SharePoint).
   * Prioritaire sur le dossier général société : un bouton ouvre directement ses photos de pièces.
   */
  lienCloudDossier?: string
  updatedAt: string
}

export function defaultPersonnelDossier(
  userId: string,
  userName: string,
  now = new Date().toISOString(),
): Omit<PersonnelDossier, 'id'> {
  return {
    userId,
    userName,
    poste: undefined,
    telephone: undefined,
    toucheFroid: true,
    toucheElectricite: true,
    conduitVehicule: true,
    documents: [],
    lienCloudDossier: undefined,
    updatedAt: now,
  }
}

export function maskNumeroRh(numero?: string): string | undefined {
  const raw = (numero || '').trim()
  if (!raw) return undefined
  if (/^[…*]/.test(raw)) return raw
  const compact = raw.replace(/\s+/g, '')
  const tail = compact.slice(-4)
  return `…${tail}`
}

export const LABEL_GROUPE_RH: Record<GroupeDocumentRh, string> = {
  identite: 'Identité',
  sante: 'Santé',
  conduite: 'Conduite',
  froid: 'Froid F-Gas',
  elec: 'Électricité',
  securite: 'Sécurité',
  admin: 'Administratif',
}

export const CLOUD_RH_RACINE = 'ClimaZEN'
export const CLOUD_RH_TECHNICIENS = 'Dossiers techniciens'

export function nomDossierCloudSafe(raw: string): string {
  return (raw || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Technicien'
}

export function labelGroupeRh(groupe: GroupeDocumentRh): string {
  return LABEL_GROUPE_RH[groupe] || groupe
}

/** ClimaZEN → Dossiers techniciens → Tech 1 → Identité */
export function segmentsDossierCloudRh(opts: {
  techName: string
  type?: TypeDocumentRh
}): string[] {
  const tech = nomDossierCloudSafe(opts.techName)
  const segs = [CLOUD_RH_RACINE, CLOUD_RH_TECHNICIENS, tech]
  if (opts.type) segs.push(labelGroupeRh(catalogDocumentRh(opts.type).groupe))
  return segs
}

export function formatCheminCloudRh(segments: string[]): string {
  return segments.join(' → ')
}

export function cloudRhAccepteCheminImbrique(raw?: string): boolean {
  const href = normalizeLienCloudRh(raw)
  if (!href) return false
  try {
    const u = new URL(href)
    const host = u.hostname.toLowerCase()
    if (host.includes('sharepoint.com') && !u.pathname.includes(':')) return true
    if (host.includes('onedrive.live.com') && u.pathname.includes('/Documents')) return true
    return false
  } catch {
    return false
  }
}

/** SharePoint / OneDrive chemin : on peut ouvrir le sous-dossier. Drive : dossier général seulement. */
export function lienDossierCloudRh(baseUrl: string | undefined, segments: string[]): string | undefined {
  const base = normalizeLienCloudRh(baseUrl)
  if (!base) return undefined
  if (!cloudRhAccepteCheminImbrique(base)) return base
  try {
    const u = new URL(base)
    const extra = segments.map((s) => encodeURIComponent(s).replace(/%20/g, '%20')).join('/')
    u.pathname = `${u.pathname.replace(/\/+$/, '')}/${extra}`
    return u.href
  } catch {
    return base
  }
}

/**
 * Dossier EXACT de cet opérateur (jamais le dossier général société).
 * Sans lien collé sur SA fiche → undefined (le bouton n’ouvre rien).
 */
export function hrefDossierCloudTech(opts: {
  racineCloud?: string
  lienCloudDossier?: string
  techName: string
  type?: TypeDocumentRh
}): string | undefined {
  return normalizeLienCloudRh(opts.lienCloudDossier)
}

/** Lien https uniquement — Drive / OneDrive / SharePoint. Rejette javascript: et data:. */
export function normalizeLienCloudRh(raw?: string): string | undefined {
  const s = (raw || '').trim()
  if (!s) return undefined
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  if (s.length > 2000) return undefined
  return url.href
}

export function sanitizeDocumentRh(doc: DocumentRh): DocumentRh {
  const hadFile = Boolean(doc.fichierDataUrl || doc.fichierNom || doc.scanConfirme)
  return {
    ...doc,
    numero: maskNumeroRh(doc.numero),
    fichierDataUrl: undefined,
    fichierNom: undefined,
    scanConfirme: hadFile || undefined,
    lienCloud: normalizeLienCloudRh(doc.lienCloud),
    lienCloudExpire: (doc.lienCloudExpire || '').trim() || undefined,
  }
}

export function sanitizePersonnelDossiers(list?: PersonnelDossier[]): PersonnelDossier[] {
  return migratePersonnelDossiers(list).map((d) => ({
    ...d,
    documents: (d.documents || []).map(sanitizeDocumentRh),
  }))
}

export function migratePersonnelDossiers(list?: PersonnelDossier[]): PersonnelDossier[] {
  const byUser = new Map<string, PersonnelDossier>()
  for (const raw of list || []) {
    if (!raw || typeof raw !== 'object') continue
    const userId = String(raw.userId || '').trim()
    if (!userId) continue
    const documents = Array.isArray(raw.documents)
      ? raw.documents
          .filter((d): d is DocumentRh => Boolean(d && d.id && d.type))
          .map(sanitizeDocumentRh)
      : []
    const next: PersonnelDossier = {
      id: raw.id || userId,
      userId,
      userName: String(raw.userName || '').trim() || 'Technicien',
      poste: parsePostePersonnel(raw.poste),
      telephone: String(raw.telephone || '').trim() || undefined,
      toucheFroid: raw.toucheFroid !== false,
      toucheElectricite: raw.toucheElectricite !== false,
      conduitVehicule: raw.conduitVehicule !== false,
      notes: raw.notes || undefined,
      documents,
      typesMasques: Array.isArray(raw.typesMasques)
        ? raw.typesMasques.filter((t): t is TypeDocumentRh => Boolean(t))
        : [],
      lienCloudDossier: normalizeLienCloudRh(raw.lienCloudDossier),
      updatedAt: raw.updatedAt || '',
    }
    const prev = byUser.get(userId)
    if (!prev || (next.updatedAt || '') >= (prev.updatedAt || '')) {
      byUser.set(userId, next)
    }
  }
  return [...byUser.values()]
}

export function dossierForUser(
  dossiers: PersonnelDossier[] | undefined,
  userId: string | undefined | null,
): PersonnelDossier | undefined {
  if (!userId) return undefined
  return (dossiers || []).find((d) => d.userId === userId)
}

export function daysUntilIso(dateIso: string, now = new Date()): number | null {
  const raw = (dateIso || '').trim()
  if (!raw) return null
  const d = new Date(`${raw.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date(now)
  today.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export function statutDocumentRh(
  doc: Pick<DocumentRh, 'dateExpiration'>,
  now = new Date(),
): Exclude<StatutDocumentRh, 'manquant'> {
  const days = daysUntilIso(doc.dateExpiration || '', now)
  if (days == null) return 'sans_date'
  if (days < 0) return 'expire'
  if (days <= ALERTE_EXPIRATION_JOURS) return 'bientot'
  return 'ok'
}

export function typesIdentiteRh(): TypeDocumentRh[] {
  return TYPES_DOCUMENT_RH.filter((t) => t.identite).map((t) => t.type)
}

/** CNI, passeport, Vitale, RIB… — pas pour un technicien qui consulte un collègue. */
export function estDocumentRhAdminSeulement(type: TypeDocumentRh): boolean {
  const item = catalogDocumentRh(type)
  return Boolean(item.identite || item.accesAdmin)
}

export type RhAccessActor = {
  userId: string
  isOwner: boolean
}

export function normalizePersonnelRhAccesUserIds(ids?: string[] | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids || []) {
    const id = String(raw || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Comptes retirés de l’équipe (départ) — plus listés, plus d’affectation. */
export function normalizePersonnelRetiresUserIds(ids?: string[] | null): string[] {
  return normalizePersonnelRhAccesUserIds(ids)
}

/** Gérant, ou employé (secrétariat / accueil appels) autorisé par le gérant. */
export function peutVoirIdentitesRh(
  actor: RhAccessActor | undefined | null,
  accesUserIds?: string[] | null,
): boolean {
  if (!actor?.userId) return false
  if (actor.isOwner) return true
  return normalizePersonnelRhAccesUserIds(accesUserIds).includes(actor.userId)
}

export function scopePersonnelDossiersForViewer(
  list: PersonnelDossier[] | undefined,
  actor: RhAccessActor,
  accesUserIds?: string[] | null,
): PersonnelDossier[] {
  const all = migratePersonnelDossiers(list)
  if (peutVoirIdentitesRh(actor, accesUserIds)) return all
  const own = all.find((d) => d.userId === actor.userId)
  if (!own) return []
  return [
    {
      ...own,
      documents: (own.documents || []).filter((d) => !estDocumentRhAdminSeulement(d.type)),
      typesMasques: (own.typesMasques || []).filter((t) => !estDocumentRhAdminSeulement(t)),
    },
  ]
}

export function applyPersonnelRhScopeToAppData<T extends {
  personnelDossiers?: PersonnelDossier[]
  personnelRhAccesUserIds?: string[]
  personnelRetiresUserIds?: string[]
}>(data: T, actor: RhAccessActor): T {
  const acces = normalizePersonnelRhAccesUserIds(data.personnelRhAccesUserIds)
  return {
    ...data,
    personnelRhAccesUserIds: acces,
    personnelRetiresUserIds: normalizePersonnelRetiresUserIds(data.personnelRetiresUserIds),
    personnelDossiers: scopePersonnelDossiersForViewer(data.personnelDossiers, actor, acces),
  }
}

/** Un tech sans accès RH ne doit pas écraser les identités / dossiers des autres. */
export function mergePersonnelDossiersSansAccesIdentite(params: {
  previous?: PersonnelDossier[]
  incoming?: PersonnelDossier[]
  actorUserId: string
}): PersonnelDossier[] {
  const prev = migratePersonnelDossiers(params.previous)
  const incoming = migratePersonnelDossiers(params.incoming)
  const incomingOwn = incoming.find((d) => d.userId === params.actorUserId)
  const prevOwn = prev.find((d) => d.userId === params.actorUserId)
  const others = prev.filter((d) => d.userId !== params.actorUserId)
  if (!incomingOwn) return sanitizePersonnelDossiers(prev)

  const identiteDocs = (prevOwn?.documents || []).filter((d) => estDocumentRhAdminSeulement(d.type))
  const workDocs = (incomingOwn.documents || []).filter((d) => !estDocumentRhAdminSeulement(d.type))
  const identiteMasques = (prevOwn?.typesMasques || []).filter((t) => estDocumentRhAdminSeulement(t))
  const workMasques = (incomingOwn.typesMasques || []).filter((t) => !estDocumentRhAdminSeulement(t))
  const base = prevOwn || {
    ...defaultPersonnelDossier(incomingOwn.userId, incomingOwn.userName),
    id: incomingOwn.id,
  }
  const mergedOwn: PersonnelDossier = {
    ...base,
    ...incomingOwn,
    id: prevOwn?.id || incomingOwn.id,
    userId: params.actorUserId,
    documents: [...identiteDocs, ...workDocs],
    typesMasques: [...new Set([...identiteMasques, ...workMasques])],
    updatedAt: incomingOwn.updatedAt || prevOwn?.updatedAt || new Date().toISOString(),
  }
  return sanitizePersonnelDossiers([...others, mergedOwn])
}

export function protectPersonnelRhOnSave<T extends {
  personnelDossiers?: PersonnelDossier[]
  personnelRhAccesUserIds?: string[]
  personnelRetiresUserIds?: string[]
}>(params: { previous: T; incoming: T; actor: RhAccessActor }): {
  personnelDossiers: PersonnelDossier[]
  personnelRhAccesUserIds: string[]
  personnelRetiresUserIds: string[]
} {
  const prevAcces = normalizePersonnelRhAccesUserIds(params.previous.personnelRhAccesUserIds)
  const prevRetires = normalizePersonnelRetiresUserIds(params.previous.personnelRetiresUserIds)
  if (params.actor.isOwner) {
    return {
      personnelRhAccesUserIds: normalizePersonnelRhAccesUserIds(
        params.incoming.personnelRhAccesUserIds,
      ),
      personnelRetiresUserIds: normalizePersonnelRetiresUserIds(
        params.incoming.personnelRetiresUserIds,
      ),
      personnelDossiers: sanitizePersonnelDossiers(params.incoming.personnelDossiers),
    }
  }
  if (peutVoirIdentitesRh(params.actor, prevAcces)) {
    return {
      personnelRhAccesUserIds: prevAcces,
      personnelRetiresUserIds: prevRetires,
      personnelDossiers: sanitizePersonnelDossiers(params.incoming.personnelDossiers),
    }
  }
  return {
    personnelRhAccesUserIds: prevAcces,
    personnelRetiresUserIds: prevRetires,
    personnelDossiers: mergePersonnelDossiersSansAccesIdentite({
      previous: params.previous.personnelDossiers,
      incoming: params.incoming.personnelDossiers,
      actorUserId: params.actor.userId,
    }),
  }
}

/** Suggestions selon l’activité — jamais obligatoires. */
export function typesSuggeresPourDossier(
  dossier: Pick<PersonnelDossier, 'toucheFroid' | 'toucheElectricite' | 'conduitVehicule'> | undefined,
): TypeDocumentRh[] {
  const d = dossier || defaultPersonnelDossier('', '')
  const suggested: TypeDocumentRh[] = ['cni', 'carte_vitale', 'visite_medicale']
  if (d.conduitVehicule) suggested.push('permis_conduire')
  if (d.toucheFroid) suggested.push('attestation_aptitude_froid')
  if (d.toucheElectricite) suggested.push('habilitation_electrique')
  return suggested
}

/** @deprecated utiliser typesSuggeresPourDossier */
export function typesRequisPourDossier(
  dossier: Pick<PersonnelDossier, 'toucheFroid' | 'toucheElectricite' | 'conduitVehicule'> | undefined,
): TypeDocumentRh[] {
  return typesSuggeresPourDossier(dossier)
}

export function typesAMasquer(type: TypeDocumentRh): TypeDocumentRh[] {
  return catalogDocumentRh(type).identite ? typesIdentiteRh() : [type]
}

/** Cartes affichées : suggestions non masquées + types déjà enregistrés. */
export function typesAffichesPourDossier(
  dossier: PersonnelDossier,
  opts?: { inclureAdmin?: boolean },
): TypeDocumentRh[] {
  const masked = new Set(dossier.typesMasques || [])
  const docs = dossier.documents || []
  const hasIdentite = docs.some((d) => catalogDocumentRh(d.type).identite)
  const out: TypeDocumentRh[] = []
  const seen = new Set<TypeDocumentRh>()
  const push = (type: TypeDocumentRh) => {
    const key = catalogDocumentRh(type).identite ? 'cni' : type
    if (seen.has(key)) return
    seen.add(key)
    out.push(key)
  }
  for (const type of typesSuggeresPourDossier(dossier)) {
    if (catalogDocumentRh(type).identite) {
      if (masked.has('cni') && !hasIdentite) continue
    } else if (masked.has(type) && !docs.some((d) => d.type === type)) {
      continue
    }
    push(type)
  }
  for (const doc of docs) push(doc.type)
  if (opts?.inclureAdmin === false) {
    return out.filter((t) => !estDocumentRhAdminSeulement(t))
  }
  return out
}

export type AlerteDocumentRh = {
  userId: string
  userName: string
  documentId?: string
  type: TypeDocumentRh
  label: string
  statut: StatutDocumentRh
  dateExpiration?: string
  daysUntil?: number | null
  libelle?: string
}

export function alertesPourDossier(
  dossier: PersonnelDossier,
  now = new Date(),
): AlerteDocumentRh[] {
  const alerts: AlerteDocumentRh[] = []
  for (const doc of dossier.documents || []) {
    const statut = statutDocumentRh(doc, now)
    if (statut !== 'ok') {
      const days = daysUntilIso(doc.dateExpiration || '', now)
      alerts.push({
        userId: dossier.userId,
        userName: dossier.userName,
        documentId: doc.id,
        type: doc.type,
        label: doc.libelle?.trim()
          ? `${labelDocumentRh(doc.type)} — ${doc.libelle.trim()}`
          : labelDocumentRh(doc.type),
        statut,
        dateExpiration: doc.dateExpiration,
        daysUntil: days,
        libelle: doc.libelle,
      })
    }
    const lienDays = daysUntilIso(doc.lienCloudExpire || '', now)
    if (lienDays != null && lienDays <= ALERTE_EXPIRATION_JOURS) {
      alerts.push({
        userId: dossier.userId,
        userName: dossier.userName,
        documentId: `${doc.id}-lien`,
        type: doc.type,
        label: `Lien cloud — ${labelDocumentRh(doc.type)}`,
        statut: lienDays < 0 ? 'expire' : 'bientot',
        dateExpiration: doc.lienCloudExpire,
        daysUntil: lienDays,
      })
    }
  }
  const order: Record<StatutDocumentRh, number> = {
    expire: 0,
    manquant: 1,
    bientot: 2,
    sans_date: 3,
    ok: 4,
  }
  return alerts.sort((a, b) => order[a.statut] - order[b.statut])
}

export function alertesEquipe(
  dossiers: PersonnelDossier[] | undefined,
  opts?: { userId?: string | null; now?: Date },
): AlerteDocumentRh[] {
  const list = dossiers || []
  const scoped = opts?.userId ? list.filter((d) => d.userId === opts.userId) : list
  return scoped.flatMap((d) => alertesPourDossier(d, opts?.now))
}

export function resumeAlertesDossier(dossier: PersonnelDossier | undefined, now = new Date()) {
  if (!dossier) {
    return { expire: 0, bientot: 0, manquant: 0, sansDate: 0, total: 0 }
  }
  const alerts = alertesPourDossier(dossier, now)
  const expire = alerts.filter((a) => a.statut === 'expire').length
  const bientot = alerts.filter((a) => a.statut === 'bientot').length
  const manquant = alerts.filter((a) => a.statut === 'manquant').length
  const sansDate = alerts.filter((a) => a.statut === 'sans_date').length
  return { expire, bientot, manquant, sansDate, total: alerts.length }
}

export function resumeAlertesTexte(
  resume: ReturnType<typeof resumeAlertesDossier>,
  opts?: { vide?: boolean },
): string {
  if (resume.total === 0) return opts?.vide ? 'dossier vide' : 'documents à jour'
  const parts: string[] = []
  if (resume.expire) parts.push(`${resume.expire} expiré${resume.expire > 1 ? 's' : ''}`)
  if (resume.bientot) parts.push(`${resume.bientot} bientôt`)
  if (resume.sansDate) parts.push(`${resume.sansDate} sans date limite`)
  return parts.join(' · ')
}

export function formatDateFr(iso?: string): string {
  const raw = (iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return iso?.trim() || '—'
  const [y, m, d] = raw.split('-')
  return `${d}/${m}/${y}`
}

export function addYearsIso(iso: string, years: number): string {
  const raw = (iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  const d = new Date(`${raw}T12:00:00`)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

export function labelStatutDocumentRh(statut: StatutDocumentRh): string {
  if (statut === 'expire') return 'Expiré'
  if (statut === 'bientot') return 'Expire bientôt'
  if (statut === 'manquant') return 'Manquant'
  if (statut === 'sans_date') return 'Sans date limite'
  return 'Valide'
}

/** Compresse une photo de pièce (JPEG) pour rester dans le coffre société. */
export function fileToDocumentScanDataUrl(file: File): Promise<{ dataUrl: string; nom: string }> {
  return new Promise((resolve, reject) => {
    const nom = file.name || 'document'
    if (file.type === 'application/pdf') {
      if (file.size > 400 * 1024) {
        reject(new Error('PDF trop lourd (max 400 Ko). Prenez une photo du document.'))
        return
      }
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Lecture du PDF impossible.'))
      reader.onload = () => resolve({ dataUrl: String(reader.result || ''), nom })
      reader.readAsDataURL(file)
      return
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choisissez une photo (JPG, PNG, WebP) ou un PDF léger.'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image trop lourde (max 8 Mo).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lecture de l’image impossible.'))
    reader.onload = () => {
      const src = String(reader.result || '')
      const img = new Image()
      img.onerror = () => reject(new Error('Image illisible.'))
      img.onload = () => {
        const max = 1280
        let w = img.width
        let h = img.height
        const ratio = Math.min(max / w, max / h, 1)
        w = Math.max(1, Math.round(w * ratio))
        h = Math.max(1, Math.round(h * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas indisponible.'))
          return
        }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.72), nom })
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}
