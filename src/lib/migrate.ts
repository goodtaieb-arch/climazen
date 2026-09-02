import { v4 as uuid } from 'uuid'
import type {
  AppData,
  CerfaDraft,
  DetecteurManuel,
  Equipement,
  ModeGestion,
  Site,
  StockItem,
  TypeTravaux,
  Voiture,
  Outillage,
} from './types'
import type { OutillageTypeId } from './outillageCatalog'
import { isOutillageTypeId } from './outillageCatalog'
import { isVoitureDocumentId } from './voitures'
import { addMonthsIso, resolveModeGestion } from './siteParc'
import { BOUTEILLE_DEFAULTS, bouteilleDefaultsForFluide } from './bouteilleDefaults'
import { purgeOrphanCerfaStock } from './stockMouvements'
import { migratePersonnelDossiers, normalizePersonnelRhAccesUserIds, normalizePersonnelRetiresUserIds } from './rhDocuments'
import { parsePointageEvents, parsePointageRegles } from './pointage'
import { resolveAppEdition } from './appEdition'

/** Ancien format plat (1 chantier = 1 équipement). */
type LegacyChantier = Partial<Site> & {
  id: string
  clientId: string
  nom?: string
  adresse?: string
  codePostal?: string
  ville?: string
  equipementType?: string
  equipementMarque?: string
  equipementModele?: string
  equipementNumeroSerie?: string
  fluideType?: string
  chargeNominaleKg?: number
  teqCO2?: number
  detectionPermanente?: boolean
  statut?: Site['statut']
  notes?: string
  createdAt?: string
  equipements?: Equipement[]
  signatureDetenteurNom?: string
  signatureDetenteurQualite?: string
  signatureDetenteurImage?: string
  signatureDetenteurAt?: string
  typeTravaux?: TypeTravaux
  detailTravaux?: string
  modeGestion?: ModeGestion
  prochaineControleEtancheite?: string
  derniereMaintenanceAt?: string
  derniereMaintenanceDate?: string
  createdByUserId?: string
  createdByName?: string
  avecFluideFrigorigene?: boolean
}

export function legacyEquipementFromFlat(c: LegacyChantier, id?: string): Equipement {
  const avecFluide = Boolean((c.fluideType || '').trim())
  return {
    id: id || uuid(),
    nom: (c.equipementType || c.nom || 'Équipement').trim() || 'Équipement',
    type: c.equipementType || '',
    marque: c.equipementMarque || '',
    modele: c.equipementModele || '',
    numeroSerie: c.equipementNumeroSerie || '',
    avecFluideFrigorigene: avecFluide,
    fluideType: c.fluideType || '',
    chargeNominaleKg: Number(c.chargeNominaleKg) || 0,
    teqCO2: c.teqCO2,
    detectionPermanente: !!c.detectionPermanente,
  }
}

export function migrateSite(raw: LegacyChantier): Site {
  const equipements =
    Array.isArray(raw.equipements) && raw.equipements.length > 0
      ? raw.equipements.map((e) => ({
          id: e.id || uuid(),
          nom: e.nom || e.type || 'Équipement',
          type: e.type || '',
          marque: e.marque || '',
          modele: e.modele || '',
          numeroSerie: e.numeroSerie || '',
          avecFluideFrigorigene: e.avecFluideFrigorigene !== false,
          fluideType: e.fluideType || '',
          chargeNominaleKg: Number(e.chargeNominaleKg) || 0,
          teqCO2: e.teqCO2,
          detectionPermanente: !!e.detectionPermanente,
          notes: e.notes,
        }))
      : [legacyEquipementFromFlat(raw)]

  const primary = equipements[0]
  const typeTravaux = raw.typeTravaux
  const modeGestion = resolveModeGestion({
    modeGestion: raw.modeGestion,
    typeTravaux,
  })
  const derniereMaintenanceDate = raw.derniereMaintenanceDate
  const prochaineControleEtancheite =
    raw.prochaineControleEtancheite ||
    (derniereMaintenanceDate ? addMonthsIso(derniereMaintenanceDate, 12) : undefined)

  return {
    id: raw.id,
    clientId: raw.clientId,
    nom: raw.nom || 'Site',
    adresse: raw.adresse || '',
    codePostal: raw.codePostal || '',
    ville: raw.ville || '',
    equipements,
    statut: raw.statut || 'actif',
    notes: raw.notes,
    createdAt: raw.createdAt || new Date().toISOString(),
    createdByUserId: raw.createdByUserId,
    createdByName: raw.createdByName,
    signatureDetenteurNom: raw.signatureDetenteurNom,
    signatureDetenteurQualite: raw.signatureDetenteurQualite,
    // Plus d’image mémorisée sur le site — signature à chaque intervention
    signatureDetenteurImage: undefined,
    signatureDetenteurAt: undefined,
    typeTravaux,
    detailTravaux: raw.detailTravaux,
    modeGestion,
    prochaineControleEtancheite,
    derniereMaintenanceAt: raw.derniereMaintenanceAt,
    derniereMaintenanceDate,
    avecFluideFrigorigene:
      raw.avecFluideFrigorigene ??
      equipements.some((e) => e.avecFluideFrigorigene !== false),
    equipementType: raw.equipementType || primary?.type || '',
    equipementMarque: raw.equipementMarque || primary?.marque || '',
    equipementModele: raw.equipementModele || primary?.modele || '',
    equipementNumeroSerie: raw.equipementNumeroSerie || primary?.numeroSerie || '',
    fluideType: raw.fluideType || primary?.fluideType || '',
    chargeNominaleKg: Number(raw.chargeNominaleKg ?? primary?.chargeNominaleKg) || 0,
    teqCO2: raw.teqCO2 ?? primary?.teqCO2,
    detectionPermanente: raw.detectionPermanente ?? primary?.detectionPermanente ?? false,
  }
}

export function findEquipement(site: Site | undefined, equipementId?: string): Equipement | undefined {
  if (!site?.equipements?.length) return undefined
  if (equipementId) {
    const found = site.equipements.find((e) => e.id === equipementId)
    if (found) return found
  }
  return site.equipements?.[0]
}

export function migrateIntervention(raw: CerfaDraft & { equipementId?: string }, sites: Site[]): CerfaDraft {
  const site = sites.find((s) => s.id === raw.chantierId)
  const equipementId = raw.equipementId || site?.equipements?.[0]?.id || ''
  return {
    ...raw,
    equipementId,
  }
}

function migrateDetecteurs(data: AppData): DetecteurManuel[] {
  const raw = Array.isArray(data.detecteurs) ? data.detecteurs : []
  if (raw.length > 0) {
    return raw.map((d) => ({
      id: d.id || crypto.randomUUID(),
      identification: (d.identification || '').trim(),
      controleDate: d.controleDate || '',
      assigneeUserId: d.assigneeUserId || undefined,
      assigneeName: d.assigneeName || undefined,
      notes: d.notes || undefined,
      updatedAt: d.updatedAt || new Date().toISOString(),
    }))
  }
  const id = data.operateur?.detecteurIdentification?.trim()
  if (!id) return []
  return [
    {
      id: crypto.randomUUID(),
      identification: id,
      controleDate: data.operateur.detecteurControleDate || '',
      updatedAt: new Date().toISOString(),
    },
  ]
}

function migrateVoitures(data: AppData): Voiture[] {
  const raw = Array.isArray(data.voitures) ? data.voitures : []
  return raw.map((v) => ({
    id: v.id || crypto.randomUUID(),
    matricule: (v.matricule || '').trim().toUpperCase(),
    marque: (v.marque || '').trim(),
    modele: v.modele?.trim() || undefined,
    controleTechniqueDate: v.controleTechniqueDate || undefined,
    assuranceDate: v.assuranceDate || undefined,
    assigneeUserId: v.assigneeUserId || undefined,
    assigneeName: v.assigneeName || undefined,
    receptionAt: v.receptionAt || undefined,
    receptionParUserId: v.receptionParUserId || undefined,
    documentsFournis: Array.isArray(v.documentsFournis)
      ? v.documentsFournis.filter(isVoitureDocumentId)
      : undefined,
    etatReception: v.etatReception,
    notes: v.notes || undefined,
    updatedAt: v.updatedAt || new Date().toISOString(),
  }))
}

function migrateOutillages(data: AppData, detecteurs: DetecteurManuel[]): Outillage[] {
  const raw = Array.isArray(data.outillages) ? data.outillages : []
  const migrated = raw.map((o) => ({
    id: o.id || crypto.randomUUID(),
    type: (isOutillageTypeId(o.type) ? o.type : 'autre') as OutillageTypeId,
    identification: (o.identification || '').trim(),
    marque: o.marque?.trim() || undefined,
    modele: o.modele?.trim() || undefined,
    controleDate: o.controleDate || undefined,
    assigneeUserId: o.assigneeUserId || undefined,
    assigneeName: o.assigneeName || undefined,
    receptionAt: o.receptionAt || undefined,
    receptionParUserId: o.receptionParUserId || undefined,
    notes: o.notes || undefined,
    updatedAt: o.updatedAt || new Date().toISOString(),
  }))

  const hasDetecteurOutillage = migrated.some((o) => o.type === 'detecteur_fuite')
  if (!hasDetecteurOutillage) {
    for (const d of detecteurs) {
      if (!d.identification?.trim()) continue
      migrated.push({
        id: d.id || uuid(),
        type: 'detecteur_fuite',
        identification: d.identification.trim(),
        marque: undefined,
        modele: undefined,
        controleDate: d.controleDate || undefined,
        assigneeUserId: d.assigneeUserId,
        assigneeName: d.assigneeName,
        receptionAt: undefined,
        receptionParUserId: undefined,
        notes: d.notes,
        updatedAt: d.updatedAt || new Date().toISOString(),
      })
    }
  }

  return migrated
}

/**
 * Ancien type unique « regenere » = recyclé site OU régénéré usine.
 * Si origineClientId → recyclé site ; sinon → régénéré distributeur.
 * Capacité manquante (récup / recyclé) → défaut 12,5 kg.
 */
function migrateStockItem(s: StockItem): StockItem {
  let next = s
  if (next.contenantType === 'regenere' && next.origineClientId) {
    next = { ...next, contenantType: 'recycle' }
  }
  if (
    (next.contenantType === 'recuperation' || next.contenantType === 'recycle') &&
    !(Number(next.capaciteMaxKg) > 0)
  ) {
    const defs = bouteilleDefaultsForFluide(next.fluide || '')
    next = {
      ...next,
      capaciteMaxKg: defs.capaciteMaxKg || BOUTEILLE_DEFAULTS.capaciteMaxKg,
    }
  }
  return next
}

export function migrateAppData(data: AppData): AppData {
  const sites = (data.chantiers || []).map((c) => migrateSite(c as unknown as LegacyChantier))
  const interventions = (data.interventions || []).map((i) => migrateIntervention(i, sites))
  const detecteurs = migrateDetecteurs(data)
  const voitures = migrateVoitures(data)
  const outillages = migrateOutillages(data, detecteurs)
  return purgeOrphanCerfaStock({
    ...data,
    appEdition: resolveAppEdition(data.appEdition),
    chantiers: sites,
    interventions,
    detecteurs,
    voitures,
    outillages,
    bonsRemiseMateriel: data.bonsRemiseMateriel || [],
    stock: (data.stock || []).map(migrateStockItem),
    fichesMaintenanceClim: data.fichesMaintenanceClim || [],
    fichesMaintenanceChaufferie: data.fichesMaintenanceChaufferie || [],
    fichesMaintenanceCtaVmc: data.fichesMaintenanceCtaVmc || [],
    ordresTravail: data.ordresTravail || [],
    contratsMaintenance: data.contratsMaintenance || [],
    devis: data.devis || [],
    commandesFournisseur: data.commandesFournisseur || [],
    factures: data.factures || [],
    agendaEvents: data.agendaEvents || [],
    pointageRegles: data.pointageRegles
      ? parsePointageRegles(data.pointageRegles)
      : undefined,
    pointageEvents: parsePointageEvents(data.pointageEvents),
    personnelDossiers: migratePersonnelDossiers(data.personnelDossiers),
    personnelRhAccesUserIds: normalizePersonnelRhAccesUserIds(data.personnelRhAccesUserIds),
    personnelRetiresUserIds: normalizePersonnelRetiresUserIds(data.personnelRetiresUserIds),
    deletedEntityIds: data.deletedEntityIds || {
      clients: [],
      chantiers: [],
      stock: [],
      stockMouvements: [],
    },
  })
}
