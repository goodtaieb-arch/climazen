/**
 * Génération automatique des OT de maintenance depuis un contrat signé.
 *
 * Le dossier = client + équipements + fréquence de contrôle.
 * Chaufferie / clim / CTA ne sont que des exemples de fiches existantes :
 * s’il y a une fiche pour l’équipement on l’attache, sinon le rapport d’OT suffit.
 *
 * Calendrier imbriqué sur 12 mois (registre) :
 *  1–2, 4–5, 7–8, 10–11 → mensuelle
 *  3, 9                 → trimestrielle
 *  6                    → semestrielle
 *  12                   → annuelle
 *
 * Génération **mois par mois** : on ne crée que la visite due dans la fenêtre
 * courte (défaut : mois passé + mois courant / +1), pas toute l’année.
 * Alerte J-7 fin de mois si l’OT du mois n’est pas encore fait.
 *
 * Clé stable `contratOtKey` = contrat + site + créneau (équipements du site
 * regroupés sur un seul OT). Variante avec équipement = OT scindé manuellement.
 * Changer la date (urgence, partiel) ne recrée pas l’OT.
 */

import { addMonthsIso } from './siteParc'
import { allEquipements } from './cerfaBatch'
import {
  isContratActif,
  parseLignesEquipements,
  resolveFamilleContrat,
  resolveGenererOtAuto,
  resolveSecteurContrat,
  resolveVisitesParAn,
  type ContratMaintenance,
  type FamilleContrat,
  type LigneContratEquipement,
  type VisitesParAn,
} from './contratMaintenance'
import { docsRequisPourEquipement, inferCategorieFicheEquipement } from './equipementFiche'
import type { DocOtRequis } from './otParcours'
import type { OrdreTravail, TypeOt } from './ordreTravail'
import { isOtCloture, techIdsOt } from './ordreTravail'
import type { PostePersonnelId } from './postePersonnel'
import type { OrigineOt, StatutFacturationOt } from './chaineCommerciale'
import type { Equipement, Site } from './types'

export type NiveauVisite = 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel'

export const NIVEAU_VISITE_LABELS: Record<NiveauVisite, string> = {
  mensuel: 'Mensuelle',
  trimestriel: 'Trimestrielle',
  semestriel: 'Semestrielle',
  annuel: 'Annuelle',
}

export const NIVEAU_VISITE_SHORT: Record<NiveauVisite, string> = {
  mensuel: 'M',
  trimestriel: 'T',
  semestriel: 'S',
  annuel: 'A',
}

export function parseNiveauVisite(raw: unknown): NiveauVisite | undefined {
  const v = String(raw || '').trim()
  if (v === 'mensuel' || v === 'trimestriel' || v === 'semestriel' || v === 'annuel') {
    return v
  }
  return undefined
}

/** Niveau de fiche pour le N-ième mois d’un cycle de 12 (1 = 1re visite). */
export function niveauVisitePourMoisCycle(mois1a12: number): NiveauVisite {
  if (mois1a12 === 12) return 'annuel'
  if (mois1a12 === 6) return 'semestriel'
  if (mois1a12 === 3 || mois1a12 === 9) return 'trimestriel'
  return 'mensuel'
}

/** Mois du cycle (1–12) réellement visités selon la fréquence choisie. */
export function moisCyclePourFrequence(n: VisitesParAn): number[] {
  if (n === 12) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  if (n === 6) return [2, 4, 6, 8, 10, 12]
  if (n === 4) return [3, 6, 9, 12]
  if (n === 2) return [6, 12]
  return [12]
}

export function periodiciteDepuisVisites(n: VisitesParAn): ContratMaintenance['periodicite'] {
  if (n === 12) return 'mensuelle'
  if (n === 6 || n === 4) return 'trimestrielle'
  if (n === 2) return 'semestrielle'
  return 'annuelle'
}

export function docsRequisPourFamille(famille: FamilleContrat): DocOtRequis[] {
  if (famille === 'clim') return ['fiche_clim']
  if (famille === 'chaufferie') return ['fiche_chaufferie']
  if (famille === 'cta') return ['fiche_cta_vmc']
  if (famille === 'etancheite') return ['cerfa']
  return []
}

export function typeOtPourFamille(famille: FamilleContrat): TypeOt {
  return famille === 'etancheite' ? 'controle_etancheite' : 'maintenance'
}

export type VisiteContratPlanifiee = {
  date: string
  niveau: NiveauVisite
  slotKey: string
  cycleYear: number
  moisCycle: number
  siteId: string
  siteNom: string
  equipementId?: string
  equipementNom?: string
  visitesParAn: VisitesParAn
  sousTraitant?: boolean
  /** Clé OT regroupée site + créneau (défaut génération). */
  contratOtKey: string
  /** Clé OT scindée 1 équipement (lookup calendrier / scission). */
  contratOtKeyEquipement?: string
}

export type SiteContratRef = {
  id: string
  clientId: string
  nom: string
  agenceCode?: string
  codePostal?: string
  equipements?: Equipement[]
  equipementType?: string
  fluideType?: string
  equipementMarque?: string
  equipementModele?: string
  equipementNumeroSerie?: string
  chargeNominaleKg?: number
  teqCO2?: number
  detectionPermanente?: boolean
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Fenêtre de création OT / rappels agenda (pas toute l’année). */
export const OT_CONTRAT_HORIZON_MONTHS = 1
export const OT_CONTRAT_PAST_MONTHS = 1
/** Avertir N jours avant la fin du mois si l’OT du mois n’est pas fait. */
export const OT_CONTRAT_ALERTE_FIN_MOIS_J = 7

function addYearsIso(iso: string, years: number): string {
  return addMonthsIso(iso, years * 12) || iso
}

export function sitesCouverts(
  contrat: Pick<ContratMaintenance, 'clientId' | 'chantierIds'>,
  sites: SiteContratRef[],
): SiteContratRef[] {
  const mine = sites.filter((s) => s.clientId === contrat.clientId)
  if (!contrat.chantierIds || contrat.chantierIds.length === 0) return mine
  const set = new Set(contrat.chantierIds)
  return mine.filter((s) => set.has(s.id))
}

/** Clé OT regroupée (site + créneau) ou scindée (+ équipement). */
export function contratOtKey(opts: {
  contratId: string
  siteId: string
  slotKey: string
  equipementId?: string
}): string {
  const eq = (opts.equipementId || '').trim()
  return eq
    ? `cm-ot:${opts.contratId}:${opts.siteId}:${eq}:${opts.slotKey}`
    : `cm-ot:${opts.contratId}:${opts.siteId}:${opts.slotKey}`
}

export function contratOtSitePrefix(contratId: string, siteId: string): string {
  return `cm-ot:${contratId}:${siteId}:`
}

export function slotKeyFromContratOtKey(key: string | undefined): string | undefined {
  const m = String(key || '')
    .trim()
    .match(/:(\d{4}-\d{2})$/)
  return m ? m[1] : undefined
}

/**
 * Créneau site déjà couvert : OT regroupé OU au moins un OT scindé / legacy
 * (clé avec équipement) pour le même créneau.
 */
export function siteSlotDejaCouvert(
  existingKeys: Iterable<string>,
  opts: { contratId: string; siteId: string; slotKey: string },
): boolean {
  const siteKey = contratOtKey(opts)
  const prefix = contratOtSitePrefix(opts.contratId, opts.siteId)
  const slotSuffix = `:${opts.slotKey}`
  for (const raw of existingKeys) {
    const k = (raw || '').trim()
    if (!k) continue
    if (k === siteKey) return true
    if (k.startsWith(prefix) && k.endsWith(slotSuffix)) return true
  }
  return false
}

export type LigneContratResolue = {
  site: SiteContratRef
  equipement?: Equipement
  equipementId: string
  equipementNom: string
  visitesParAn: VisitesParAn
  sousTraitant: boolean
}

/** Lignes du dossier : équipements cochés, sinon tout le parc des sites couverts. */
export function resolveLignesContrat(
  contrat: ContratMaintenance,
  sites: SiteContratRef[],
): LigneContratResolue[] {
  const covered = sitesCouverts(contrat, sites)
  const defaultFreq = resolveVisitesParAn(contrat)
  const explicit = parseLignesEquipements(contrat.lignesEquipements)
  if (explicit.length > 0) {
    const out: LigneContratResolue[] = []
    for (const ligne of explicit) {
      const site = covered.find((s) => s.id === ligne.siteId)
      if (!site) continue
      const eqs = allEquipements(site as Site)
      const eq = eqs.find((e) => e.id === ligne.equipementId)
      out.push({
        site,
        equipement: eq,
        equipementId: ligne.equipementId,
        equipementNom: eq?.nom || eq?.type || 'Équipement',
        visitesParAn: ligne.visitesParAn || defaultFreq,
        sousTraitant: ligne.sousTraitant === true,
      })
    }
    return out
  }
  const out: LigneContratResolue[] = []
  for (const site of covered) {
    const eqs = allEquipements(site as Site)
    if (eqs.length === 0) {
      out.push({
        site,
        equipementId: '',
        equipementNom: site.nom,
        visitesParAn: defaultFreq,
        sousTraitant: false,
      })
      continue
    }
    for (const eq of eqs) {
      out.push({
        site,
        equipement: eq,
        equipementId: eq.id,
        equipementNom: eq.nom || eq.type || 'Équipement',
        visitesParAn: defaultFreq,
        sousTraitant: false,
      })
    }
  }
  return out
}

function visitesPourLigne(
  contrat: ContratMaintenance,
  ligne: LigneContratResolue,
  opts: { today: string; horizon: string; pastFloor: string; endExclusive: string },
): VisiteContratPlanifiee[] {
  const start = (contrat.dateDebut || opts.today).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return []
  const mois = moisCyclePourFrequence(ligne.visitesParAn)
  const out: VisiteContratPlanifiee[] = []
  for (let yearOffset = 0; yearOffset < 25; yearOffset++) {
    const cycleStart = addYearsIso(start, yearOffset)
    if (cycleStart >= opts.endExclusive) break
    const cycleYear = Number(cycleStart.slice(0, 4))
    for (const moisCycle of mois) {
      const date = addMonthsIso(cycleStart, moisCycle - 1)
      if (!date) continue
      if (date < start) continue
      if (date >= opts.endExclusive) continue
      if (date < opts.pastFloor || date > opts.horizon) continue
      const niveau = niveauVisitePourMoisCycle(moisCycle)
      const slotKey = `${cycleYear}-${String(moisCycle).padStart(2, '0')}`
      out.push({
        date,
        niveau,
        slotKey,
        cycleYear,
        moisCycle,
        siteId: ligne.site.id,
        siteNom: ligne.site.nom,
        equipementId: ligne.equipementId || undefined,
        equipementNom: ligne.equipementNom,
        visitesParAn: ligne.visitesParAn,
        sousTraitant: ligne.sousTraitant,
        contratOtKey: contratOtKey({
          contratId: contrat.id,
          siteId: ligne.site.id,
          slotKey,
        }),
        contratOtKeyEquipement: ligne.equipementId
          ? contratOtKey({
              contratId: contrat.id,
              siteId: ligne.site.id,
              slotKey,
              equipementId: ligne.equipementId,
            })
          : undefined,
      })
    }
  }
  return out
}

/**
 * Visites du contrat dans la fenêtre
 * [today − pastMonths, min(dateFin, today + horizonMonths)[.
 * Défaut = mois par mois (1 mois devant, 1 mois derrière pour rattrapage).
 */
export function visitesDepuisContrat(
  contrat: ContratMaintenance,
  sites: SiteContratRef[],
  opts?: { today?: string; horizonMonths?: number; pastMonths?: number },
): VisiteContratPlanifiee[] {
  const today = (opts?.today || todayIso()).slice(0, 10)
  const horizonMonths = opts?.horizonMonths ?? OT_CONTRAT_HORIZON_MONTHS
  const pastMonths = opts?.pastMonths ?? OT_CONTRAT_PAST_MONTHS
  const horizon = addMonthsIso(today, horizonMonths) || today
  const pastFloor = addMonthsIso(today, -pastMonths) || today
  const fin = (contrat.dateFin || '').slice(0, 10)
  const endExclusive = fin && fin < horizon ? fin : horizon
  const lignes = resolveLignesContrat(contrat, sites)
  const out: VisiteContratPlanifiee[] = []
  for (const ligne of lignes) {
    out.push(
      ...visitesPourLigne(contrat, ligne, {
        today,
        horizon,
        pastFloor,
        endExclusive,
      }),
    )
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.siteNom.localeCompare(b.siteNom) ||
      (a.equipementNom || '').localeCompare(b.equipementNom || ''),
  )
}

/** Bornes ISO de la fenêtre de génération OT contrat. */
export function fenetreGenerationOtContrat(opts?: {
  today?: string
  horizonMonths?: number
  pastMonths?: number
}): { today: string; start: string; endExclusive: string } {
  const today = (opts?.today || todayIso()).slice(0, 10)
  const horizonMonths = opts?.horizonMonths ?? OT_CONTRAT_HORIZON_MONTHS
  const pastMonths = opts?.pastMonths ?? OT_CONTRAT_PAST_MONTHS
  return {
    today,
    start: addMonthsIso(today, -pastMonths) || today,
    endExclusive: addMonthsIso(today, horizonMonths) || today,
  }
}

/**
 * OT auto contrat futurs hors fenêtre, non planifiés → à retirer
 * (évite de charger toute l’année dans « OT à poser »).
 */
export function otContratAutoAPruner(
  ot: Pick<
    OrdreTravail,
    'contratOtKey' | 'date' | 'heure' | 'statut' | 'technicienUserId' | 'technicienUserIds'
  >,
  endExclusive: string,
): boolean {
  if (!(ot.contratOtKey || '').trim()) return false
  if (isOtCloture(ot.statut)) return false
  if ((ot.heure || '').trim()) return false
  if (techIdsOt(ot).length > 0) return false
  const d = (ot.date || '').slice(0, 10)
  if (!d) return false
  return d >= endExclusive
}

export function pruneOtsContratHorsFenetre<T extends OrdreTravail>(
  ots: T[],
  opts?: { today?: string; horizonMonths?: number; pastMonths?: number },
): { kept: T[]; removed: T[] } {
  const { endExclusive } = fenetreGenerationOtContrat(opts)
  const kept: T[] = []
  const removed: T[] = []
  for (const ot of ots) {
    if (otContratAutoAPruner(ot, endExclusive)) removed.push(ot)
    else kept.push(ot)
  }
  return { kept, removed }
}

/** Jours restants dans le mois civil (0 = dernier jour). */
export function joursRestantsDansMois(today?: string): number {
  const iso = (today || todayIso()).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return 99
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  const last = new Date(y, mo, 0).getDate()
  return Math.max(0, last - day)
}

export type AlerteOtContratFinMois = {
  otId: string
  numero: string
  date: string
  clientId?: string
  chantierId?: string
  action: string
  joursRestants: number
  visiteNiveau?: string
}

/**
 * OT contrat du mois en cours encore ouverts, dans les N derniers jours du mois.
 */
export function alertesOtContratFinMois(
  ots: Pick<
    OrdreTravail,
    | 'id'
    | 'numero'
    | 'date'
    | 'clientId'
    | 'chantierId'
    | 'action'
    | 'statut'
    | 'contratOtKey'
    | 'visiteNiveau'
  >[],
  opts?: { today?: string; joursAvantFin?: number },
): AlerteOtContratFinMois[] {
  const today = (opts?.today || todayIso()).slice(0, 10)
  const seuil = opts?.joursAvantFin ?? OT_CONTRAT_ALERTE_FIN_MOIS_J
  const restants = joursRestantsDansMois(today)
  if (restants > seuil) return []
  const mois = today.slice(0, 7)
  const out: AlerteOtContratFinMois[] = []
  for (const ot of ots) {
    if (!(ot.contratOtKey || '').trim()) continue
    if (isOtCloture(ot.statut)) continue
    if ((ot.date || '').slice(0, 7) !== mois) continue
    out.push({
      otId: ot.id,
      numero: ot.numero,
      date: (ot.date || '').slice(0, 10),
      clientId: ot.clientId,
      chantierId: ot.chantierId,
      action: ot.action || '',
      joursRestants: restants,
      visiteNiveau: ot.visiteNiveau,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero))
}

export type OtDraftDepuisContrat = {
  date: string
  typeOt: TypeOt
  action: string
  rapportAction: string
  observations: string
  clientId: string
  chantierId: string
  equipementId?: string
  equipementIds?: string[]
  technicien: string
  secteur: PostePersonnelId
  agenceCode?: string
  heure?: string
  lienCommandeType: 'contrat'
  lienCommandeRef: string
  contratId: string
  contratOtKey: string
  visiteNiveau: NiveauVisite
  origineOt: OrigineOt
  statutFacturation: StatutFacturationOt
  mainOeuvreIncluseContrat: true
  docsRequis: DocOtRequis[]
  maintenanceParSousTraitant?: boolean
  statut: 'pret_a_planifier'
  parcoursStep: 'ot'
  interventionPartielle: false
  avancementPct: 0
}

function docsPourLigne(
  ligne: LigneContratResolue,
  contrat: ContratMaintenance,
): DocOtRequis[] {
  if (ligne.equipement) return docsRequisPourEquipement(ligne.equipement)
  if (ligne.equipementNom) {
    const fromNom = docsRequisPourEquipement({ type: '', nom: ligne.equipementNom })
    if (fromNom.length) return fromNom
  }
  return docsRequisPourFamille(resolveFamilleContrat(contrat))
}

function unionDocs(lists: DocOtRequis[][]): DocOtRequis[] {
  const seen = new Set<DocOtRequis>()
  const out: DocOtRequis[] = []
  for (const list of lists) {
    for (const d of list) {
      if (seen.has(d)) continue
      seen.add(d)
      out.push(d)
    }
  }
  return out
}

export function buildOtDraftsDepuisContrats(input: {
  contrats: ContratMaintenance[]
  sites: SiteContratRef[]
  today?: string
  horizonMonths?: number
  pastMonths?: number
}): OtDraftDepuisContrat[] {
  const drafts: OtDraftDepuisContrat[] = []
  for (const contrat of input.contrats) {
    if (!isContratActif(contrat)) continue
    if (!resolveGenererOtAuto(contrat)) continue
    const famille = resolveFamilleContrat(contrat)
    const secteur = resolveSecteurContrat(contrat)
    const typeOt = typeOtPourFamille(famille)
    const lignes = resolveLignesContrat(contrat, input.sites)
    const visites = visitesDepuisContrat(contrat, input.sites, {
      today: input.today,
      horizonMonths: input.horizonMonths,
      pastMonths: input.pastMonths,
    })
    const ligneByKey = new Map(
      lignes.map((l) => [`${l.site.id}::${l.equipementId}`, l]),
    )

    type Group = { visites: VisiteContratPlanifiee[]; lignes: LigneContratResolue[] }
    const groups = new Map<string, Group>()
    for (const v of visites) {
      const gKey = `${v.siteId}::${v.slotKey}`
      let g = groups.get(gKey)
      if (!g) {
        g = { visites: [], lignes: [] }
        groups.set(gKey, g)
      }
      g.visites.push(v)
      const ligne = ligneByKey.get(`${v.siteId}::${v.equipementId || ''}`)
      if (ligne) g.lignes.push(ligne)
    }

    for (const g of groups.values()) {
      const v0 = g.visites[0]
      if (!v0) continue
      const site = input.sites.find((s) => s.id === v0.siteId)
      const eqIds = [
        ...new Set(
          g.visites.map((v) => v.equipementId).filter((id): id is string => Boolean(id)),
        ),
      ]
      const eqNoms = [
        ...new Set(g.visites.map((v) => v.equipementNom).filter(Boolean) as string[]),
      ]
      const docs = unionDocs(
        g.lignes.length
          ? g.lignes.map((l) => docsPourLigne(l, contrat))
          : [docsRequisPourFamille(famille)],
      )
      const anySousTraitant = g.visites.some((v) => v.sousTraitant)
      const allSousTraitant =
        g.visites.length > 0 && g.visites.every((v) => v.sousTraitant)
      const nEq = eqIds.length || eqNoms.length
      const cible =
        nEq > 1
          ? `${v0.siteNom} · ${nEq} équipements`
          : [eqNoms[0] || eqIds[0], v0.siteNom].filter(Boolean).join(' · ')
      const ficheHint =
        nEq > 1
          ? `Fiches / CERFA par équipement (${NIVEAU_VISITE_LABELS[v0.niveau].toLowerCase()}).`
          : docs.length
            ? `Fiche ${NIVEAU_VISITE_LABELS[v0.niveau].toLowerCase()} (${
                g.lignes[0]?.equipement
                  ? inferCategorieFicheEquipement(g.lignes[0].equipement)
                  : 'type'
              }).`
            : 'Pas de fiche type — le rapport d’OT suffit.'

      drafts.push({
        date: v0.date,
        typeOt,
        action: `Maintenance ${NIVEAU_VISITE_LABELS[v0.niveau].toLowerCase()} — ${cible}`,
        rapportAction: '',
        observations: [
          `Contrat ${contrat.numero}`,
          contrat.titre,
          eqNoms.length ? `Équipements : ${eqNoms.join(', ')}` : '',
          ficheHint,
          nEq > 1
            ? 'Un seul OT pour tout le site — vous pouvez scinder par équipement si besoin.'
            : '',
          anySousTraitant
            ? allSousTraitant
              ? 'Équipements sous-traités : clôture tech accompagnant ou bureau + rapport ST.'
              : 'Certains équipements sont sous-traités — vérifier le détail sur l’OT.'
            : 'Date déplaçable si urgence ou reprise d’une visite partielle.',
        ]
          .filter(Boolean)
          .join('\n'),
        clientId: contrat.clientId,
        chantierId: v0.siteId,
        equipementId: eqIds[0],
        equipementIds: eqIds.length ? eqIds : undefined,
        technicien: '',
        secteur,
        agenceCode: site?.agenceCode,
        heure: '',
        lienCommandeType: 'contrat',
        lienCommandeRef: contrat.numero,
        contratId: contrat.id,
        contratOtKey: contratOtKey({
          contratId: contrat.id,
          siteId: v0.siteId,
          slotKey: v0.slotKey,
        }),
        visiteNiveau: v0.niveau,
        origineOt: allSousTraitant ? 'sous_traitance' : 'maintenance_contrat',
        statutFacturation: 'sous_contrat',
        mainOeuvreIncluseContrat: true,
        docsRequis: docs,
        maintenanceParSousTraitant: anySousTraitant || undefined,
        statut: 'pret_a_planifier',
        parcoursStep: 'ot',
        interventionPartielle: false,
        avancementPct: 0,
      })
    }
  }
  return drafts
}

/** Fusionne les brouillons : ne recrée pas un créneau déjà présent (même si la date a bougé). */
export function mergeOtsDepuisContrats<T extends { contratOtKey?: string }>(
  existing: T[],
  drafts: OtDraftDepuisContrat[],
): { toAdd: OtDraftDepuisContrat[]; skipped: number } {
  const keys = new Set(
    existing.map((o) => (o.contratOtKey || '').trim()).filter(Boolean),
  )
  const toAdd: OtDraftDepuisContrat[] = []
  let skipped = 0
  for (const d of drafts) {
    const slot = slotKeyFromContratOtKey(d.contratOtKey)
    const covered =
      keys.has(d.contratOtKey) ||
      (slot
        ? siteSlotDejaCouvert(keys, {
            contratId: d.contratId,
            siteId: d.chantierId,
            slotKey: slot,
          })
        : false)
    if (covered) {
      skipped += 1
      continue
    }
    keys.add(d.contratOtKey)
    toAdd.push(d)
  }
  return { toAdd, skipped }
}

/**
 * Scinde un OT contrat multi-équipements → 1 OT par équipement.
 * Retourne les brouillons enfants (sans id/numero) + id parent à retirer.
 */
export function scinderOtContratParEquipement(
  ot: Pick<
    OrdreTravail,
    | 'id'
    | 'contratId'
    | 'contratOtKey'
    | 'chantierId'
    | 'equipementId'
    | 'equipementIds'
    | 'date'
    | 'visiteNiveau'
    | 'action'
    | 'observations'
    | 'typeOt'
    | 'clientId'
    | 'secteur'
    | 'agenceCode'
    | 'lienCommandeRef'
    | 'origineOt'
    | 'statutFacturation'
    | 'docsRequis'
    | 'maintenanceParSousTraitant'
    | 'technicien'
    | 'heure'
  >,
  siteEquipements?: Equipement[],
): { parentId: string; children: OtDraftDepuisContrat[] } | null {
  const ids = [
    ...new Set(
      (ot.equipementIds?.length
        ? ot.equipementIds
        : ot.equipementId
          ? [ot.equipementId]
          : []
      ).filter(Boolean),
    ),
  ]
  if (ids.length <= 1 || !ot.contratId || !ot.chantierId) return null
  const slot = slotKeyFromContratOtKey(ot.contratOtKey)
  if (!slot) return null
  const niveau = parseNiveauVisite(ot.visiteNiveau) || 'mensuel'
  const children: OtDraftDepuisContrat[] = ids.map((eqId) => {
    const eq = siteEquipements?.find((e) => e.id === eqId)
    const nom = eq?.nom || eq?.type || eqId
    const docs = eq ? docsRequisPourEquipement(eq) : ot.docsRequis || []
    return {
      date: ot.date,
      typeOt: ot.typeOt,
      action: `Maintenance ${NIVEAU_VISITE_LABELS[niveau].toLowerCase()} — ${nom}`,
      rapportAction: '',
      observations: [
        ot.observations || '',
        `Scindé depuis OT multi-équipements (équipement : ${nom}).`,
      ]
        .filter(Boolean)
        .join('\n'),
      clientId: ot.clientId || '',
      chantierId: ot.chantierId!,
      equipementId: eqId,
      equipementIds: [eqId],
      technicien: ot.technicien || '',
      secteur: (ot.secteur || 'tech_cvc') as PostePersonnelId,
      agenceCode: ot.agenceCode,
      heure: ot.heure || '',
      lienCommandeType: 'contrat',
      lienCommandeRef: ot.lienCommandeRef || '',
      contratId: ot.contratId!,
      contratOtKey: contratOtKey({
        contratId: ot.contratId!,
        siteId: ot.chantierId!,
        slotKey: slot,
        equipementId: eqId,
      }),
      visiteNiveau: niveau,
      origineOt: (ot.origineOt || 'maintenance_contrat') as OrigineOt,
      statutFacturation: (ot.statutFacturation || 'sous_contrat') as StatutFacturationOt,
      mainOeuvreIncluseContrat: true,
      docsRequis: docs,
      maintenanceParSousTraitant: ot.maintenanceParSousTraitant,
      statut: 'pret_a_planifier',
      parcoursStep: 'ot',
      interventionPartielle: false,
      avancementPct: 0,
    }
  })
  return { parentId: ot.id, children }
}

export function ligneContratVide(
  siteId: string,
  equipementId: string,
  visitesParAn?: VisitesParAn,
): LigneContratEquipement {
  return { siteId, equipementId, visitesParAn, sousTraitant: false }
}
