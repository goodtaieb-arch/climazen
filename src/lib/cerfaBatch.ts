import { v4 as uuid } from 'uuid'
import type { CerfaDraft, Client, Equipement, NatureIntervention, Operateur, Site } from './types'
import {
  equipAvecFluideFrigorigene,
  isDetecteurControleExpire,
  siteAvecFluideFrigorigene,
} from './types'
import { findEquipement } from './migrate'
import { calcTeqCO2FromFluide, controlesPeriodiquesInfo } from './fluides'

/** Tous les équipements du site (fluide + standard). */
export function allEquipements(site: Site): Equipement[] {
  if (site.equipements?.length) return site.equipements
  if ((site.equipementType || site.fluideType || site.nom || '').trim()) {
    return [
      {
        id: uuid(),
        nom: site.equipementType || site.nom || 'Équipement',
        type: site.equipementType || '',
        marque: site.equipementMarque || '',
        modele: site.equipementModele || '',
        numeroSerie: site.equipementNumeroSerie || '',
        avecFluideFrigorigene: siteAvecFluideFrigorigene(site),
        fluideType: site.fluideType || '',
        chargeNominaleKg: Number(site.chargeNominaleKg) || 0,
        teqCO2: site.teqCO2,
        detectionPermanente: !!site.detectionPermanente,
      },
    ]
  }
  return []
}

/** Équipements fluide → CERFA uniquement. */
export function equipementsForCerfa(site: Site): Equipement[] {
  const list = allEquipements(site).filter(
    (e) => equipAvecFluideFrigorigene(e) && (e.fluideType || '').trim(),
  )
  if (list.length > 0) return list
  if (siteAvecFluideFrigorigene(site) && (site.fluideType || '').trim() && !site.equipements?.length) {
    return [
      {
        id: uuid(),
        nom: site.equipementType || site.nom || 'Équipement',
        type: site.equipementType || '',
        marque: site.equipementMarque || '',
        modele: site.equipementModele || '',
        numeroSerie: site.equipementNumeroSerie || '',
        avecFluideFrigorigene: true,
        fluideType: site.fluideType || '',
        chargeNominaleKg: Number(site.chargeNominaleKg) || 0,
        teqCO2: site.teqCO2,
        detectionPermanente: !!site.detectionPermanente,
      },
    ]
  }
  return []
}

export function syncFlatFromEquipements(equipements: Equipement[]): Pick<
  Site,
  | 'equipementType'
  | 'equipementMarque'
  | 'equipementModele'
  | 'equipementNumeroSerie'
  | 'fluideType'
  | 'chargeNominaleKg'
  | 'teqCO2'
  | 'detectionPermanente'
> {
  const p = equipements[0]
  return {
    equipementType: p?.type || '',
    equipementMarque: p?.marque || '',
    equipementModele: p?.modele || '',
    equipementNumeroSerie: p?.numeroSerie || '',
    fluideType: p?.fluideType || '',
    chargeNominaleKg: Number(p?.chargeNominaleKg) || 0,
    teqCO2: p?.teqCO2,
    detectionPermanente: !!p?.detectionPermanente,
  }
}

/** Met à jour l’équipement principal depuis les champs plats (compat UI). */
export function syncEquipementsFromFlat(
  site: Pick<
    Site,
    | 'equipementType'
    | 'equipementMarque'
    | 'equipementModele'
    | 'equipementNumeroSerie'
    | 'fluideType'
    | 'chargeNominaleKg'
    | 'teqCO2'
    | 'detectionPermanente'
    | 'nom'
    | 'avecFluideFrigorigene'
  >,
  existing?: Equipement[],
): Equipement[] {
  if (Array.isArray(existing) && existing.length > 1) {
    const rest = existing.slice(1)
    const first = existing[0]
    return [
      {
        ...first,
        id: first.id || uuid(),
        nom: first.nom || site.equipementType || site.nom || 'Équipement',
        type: site.equipementType || first.type || '',
        marque: site.equipementMarque || first.marque || '',
        modele: site.equipementModele || first.modele || '',
        numeroSerie: site.equipementNumeroSerie || first.numeroSerie || '',
        avecFluideFrigorigene: first.avecFluideFrigorigene !== false,
        fluideType: site.fluideType || first.fluideType || '',
        chargeNominaleKg: Number(site.chargeNominaleKg ?? first.chargeNominaleKg) || 0,
        teqCO2: site.teqCO2 ?? first.teqCO2,
        detectionPermanente: site.detectionPermanente ?? first.detectionPermanente,
      },
      ...rest,
    ]
  }
  const prevId = existing?.[0]?.id
  const avecFluide =
    existing?.[0]?.avecFluideFrigorigene !== undefined
      ? existing[0].avecFluideFrigorigene !== false
      : site.avecFluideFrigorigene !== false
  return [
    {
      id: prevId || uuid(),
      nom: existing?.[0]?.nom || site.equipementType || site.nom || 'Équipement',
      type: site.equipementType || '',
      marque: site.equipementMarque || '',
      modele: site.equipementModele || '',
      numeroSerie: site.equipementNumeroSerie || '',
      avecFluideFrigorigene: avecFluide,
      fluideType: site.fluideType || '',
      chargeNominaleKg: Number(site.chargeNominaleKg) || 0,
      teqCO2: site.teqCO2,
      detectionPermanente: !!site.detectionPermanente,
      notes: existing?.[0]?.notes,
    },
  ]
}

export type MaintenanceCerfaInput = {
  site: Site
  client: Client
  operateur: Operateur
  dateIntervention: string
  userId?: string
  userName?: string
  signataireNom: string
  signataireQualite: string
  signatureOperateurImage: string
  detecteurIdentification?: string
  detecteurControleDate?: string
  natures?: NatureIntervention[]
  /** Si fourni : seulement ces équipements (maintenance partielle / sélection). */
  equipementIds?: string[]
}

/** Prépare une fiche CERFA par équipement (maintenance validée). */
export function buildMaintenanceCerfaDrafts(input: MaintenanceCerfaInput): CerfaDraft[] {
  let equipements = equipementsForCerfa(input.site)
  if (input.equipementIds?.length) {
    const wanted = new Set(input.equipementIds)
    equipements = equipements.filter((e) => wanted.has(e.id))
  }
  if (equipements.length === 0) {
    throw new Error('Sélectionnez au moins un équipement fluide du site.')
  }
  if (!input.signatureOperateurImage) {
    throw new Error('Signature opérateur obligatoire — enregistrez-la dans Mon profil.')
  }
  if (!input.detecteurIdentification?.trim()) {
    throw new Error(
      'Détecteur de fuite obligatoire pour le CERFA. Enregistrez-le dans Mon profil (parc détecteurs).',
    )
  }
  if (!input.detecteurControleDate?.trim()) {
    throw new Error('Date de contrôle du détecteur manquante (contrôle annuel < 1 an).')
  }
  if (isDetecteurControleExpire(input.detecteurControleDate)) {
    throw new Error(
      `Détecteur « ${input.detecteurIdentification} » : contrôle expiré (> 1 an). Impossible de générer le CERFA.`,
    )
  }

  const natures: NatureIntervention[] = input.natures?.length
    ? input.natures
    : ['entretien_reparation', 'controle_etancheite_periodique']

  const now = new Date().toISOString()
  return equipements.map((eq) => {
    const charge = Number(eq.chargeNominaleKg) || 0
    const teq = eq.teqCO2 ?? calcTeqCO2FromFluide(charge, eq.fluideType) ?? undefined
    const ctrl = controlesPeriodiquesInfo({
      fluideCode: eq.fluideType,
      chargeKg: charge,
      teqCO2: teq || 0,
      detectionPermanente: !!eq.detectionPermanente,
    })
    return {
      id: uuid(),
      clientId: input.client.id,
      chantierId: input.site.id,
      equipementId: eq.id,
      dateIntervention: input.dateIntervention,
      operateur: input.operateur,
      natures,
      detecteurIdentification: input.detecteurIdentification,
      detecteurControleDate: input.detecteurControleDate,
      detectionPermanente: !!eq.detectionPermanente,
      fluideType: eq.fluideType,
      quantiteTotaleKg: charge,
      teqCO2: teq,
      periodiciteControle: ctrl.obligatoire ? ctrl.periodeSuggeree || undefined : undefined,
      fuiteConstatee: false,
      manipulations: [],
      observations: input.site.detailTravaux
        ? `Maintenance validée — ${input.site.detailTravaux}`
        : 'Maintenance validée — équipements repris du site (sans resaisie).',
      signatureOperateur: input.signataireNom,
      signatureOperateurQualite: input.signataireQualite,
      signatureOperateurImage: input.signatureOperateurImage,
      signatureDetenteur:
        input.site.signatureDetenteurNom?.trim() ||
        input.client.nomContact?.trim() ||
        '',
      signatureDetenteurQualite: input.site.signatureDetenteurQualite || 'Détenteur',
      signatureDetenteurImage: undefined,
      createdByUserId: input.userId,
      createdByName: input.userName,
      status: 'brouillon',
      createdAt: now,
      updatedAt: now,
    }
  })
}

export function equipmentLabel(eq: Equipement) {
  return [eq.nom || eq.type, eq.marque, eq.modele].filter(Boolean).join(' · ') || 'Équipement'
}

/** Normalise un libellé équipement pour comparaison d’unicité. */
export function normalizeEquipNom(nom: string): string {
  return nom.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Libellé utilisé pour l’unicité (nom, sinon type). */
export function equipNomKey(eq: Pick<Equipement, 'nom' | 'type'>): string {
  return normalizeEquipNom(eq.nom || eq.type || '')
}

/**
 * Cherche un doublon de nom sur le même site (hors `excludeId`).
 * Comparaison insensible à la casse / espaces.
 */
export function findDuplicateEquipNom(
  equipements: Pick<Equipement, 'id' | 'nom' | 'type'>[],
  nom: string,
  excludeId?: string,
): Pick<Equipement, 'id' | 'nom' | 'type'> | undefined {
  const key = normalizeEquipNom(nom)
  if (!key) return undefined
  return equipements.find((e) => e.id !== excludeId && equipNomKey(e) === key)
}

/** Vérifie qu’aucun nom n’est dupliqué dans la liste — renvoie le premier conflit. */
export function findFirstDuplicateEquipNom(
  equipements: Pick<Equipement, 'id' | 'nom' | 'type'>[],
): { a: string; b: string; nom: string } | null {
  const seen = new Map<string, string>()
  for (const eq of equipements) {
    const key = equipNomKey(eq)
    if (!key) continue
    const prev = seen.get(key)
    if (prev) {
      return { a: prev, b: eq.id, nom: (eq.nom || eq.type || '').trim() }
    }
    seen.set(key, eq.id)
  }
  return null
}

export { findEquipement }
