/**
 * Génération automatique des OT de maintenance depuis un contrat signé.
 *
 * Calendrier imbriqué sur 12 mois (registre) :
 *  1–2, 4–5, 7–8, 10–11 → mensuelle
 *  3, 9                 → trimestrielle
 *  6                    → semestrielle
 *  12                   → annuelle
 *
 * L’utilisateur choisit seulement le nombre de passages / an
 * (12 chaufferie, 4 CTA, 2 clim, 1 annuelle…). On ne crée que
 * les mois correspondants, avec le bon niveau de fiche.
 *
 * Clé stable `contratOtKey` = un créneau (contrat + site + année de cycle + mois).
 * Changer la date (urgence, partiel à reprendre) ne recrée pas l’OT.
 */

import { addMonthsIso } from './siteParc'
import {
  isContratActif,
  resolveFamilleContrat,
  resolveGenererOtAuto,
  resolveSecteurContrat,
  resolveVisitesParAn,
  type ContratMaintenance,
  type FamilleContrat,
  type VisitesParAn,
} from './contratMaintenance'
import type { DocOtRequis } from './otParcours'
import type { TypeOt } from './ordreTravail'
import type { PostePersonnelId } from './postePersonnel'
import type { OrigineOt, StatutFacturationOt } from './chaineCommerciale'

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
  return ['fiche_clim', 'fiche_chaufferie', 'fiche_cta_vmc']
}

export function typeOtPourFamille(famille: FamilleContrat): TypeOt {
  return famille === 'etancheite' ? 'controle_etancheite' : 'maintenance'
}

export type VisiteContratPlanifiee = {
  date: string
  niveau: NiveauVisite
  /** Année du cycle (dateDebut + N ans) + mois 1–12 */
  slotKey: string
  cycleYear: number
  moisCycle: number
  siteId: string
  siteNom: string
  contratOtKey: string
}

export type SiteContratRef = {
  id: string
  clientId: string
  nom: string
  agenceCode?: string
  codePostal?: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addYearsIso(iso: string, years: number): string {
  return addMonthsIso(iso, years * 12) || iso
}

function sitesCouverts(
  contrat: Pick<ContratMaintenance, 'clientId' | 'chantierIds'>,
  sites: SiteContratRef[],
): SiteContratRef[] {
  const mine = sites.filter((s) => s.clientId === contrat.clientId)
  if (!contrat.chantierIds || contrat.chantierIds.length === 0) return mine
  const set = new Set(contrat.chantierIds)
  return mine.filter((s) => set.has(s.id))
}

export function contratOtKey(opts: {
  contratId: string
  siteId: string
  slotKey: string
}): string {
  return `cm-ot:${opts.contratId}:${opts.siteId}:${opts.slotKey}`
}

/**
 * Toutes les visites du contrat dans la fenêtre
 * [today − pastMonths, min(dateFin, today + horizonMonths)[.
 */
export function visitesDepuisContrat(
  contrat: ContratMaintenance,
  sites: SiteContratRef[],
  opts?: { today?: string; horizonMonths?: number; pastMonths?: number },
): VisiteContratPlanifiee[] {
  const today = (opts?.today || todayIso()).slice(0, 10)
  const horizonMonths = opts?.horizonMonths ?? 14
  const pastMonths = opts?.pastMonths ?? 1
  const start = (contrat.dateDebut || today).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return []

  const freq = resolveVisitesParAn(contrat)
  const mois = moisCyclePourFrequence(freq)
  const covered = sitesCouverts(contrat, sites)
  if (covered.length === 0) return []

  const horizon = addMonthsIso(today, horizonMonths) || today
  const pastFloor = addMonthsIso(today, -pastMonths) || today
  const fin = (contrat.dateFin || '').slice(0, 10)
  const endExclusive = fin && fin < horizon ? fin : horizon

  const out: VisiteContratPlanifiee[] = []
  for (let yearOffset = 0; yearOffset < 25; yearOffset++) {
    const cycleStart = addYearsIso(start, yearOffset)
    if (cycleStart >= endExclusive) break
    const cycleYear = Number(cycleStart.slice(0, 4))
    for (const moisCycle of mois) {
      const date = addMonthsIso(cycleStart, moisCycle - 1)
      if (!date) continue
      if (date < start) continue
      if (date >= endExclusive) continue
      if (date < pastFloor || date > horizon) continue
      const niveau = niveauVisitePourMoisCycle(moisCycle)
      const slotKey = `${cycleYear}-${String(moisCycle).padStart(2, '0')}`
      for (const site of covered) {
        out.push({
          date,
          niveau,
          slotKey,
          cycleYear,
          moisCycle,
          siteId: site.id,
          siteNom: site.nom,
          contratOtKey: contratOtKey({
            contratId: contrat.id,
            siteId: site.id,
            slotKey,
          }),
        })
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.siteNom.localeCompare(b.siteNom))
}

export type OtDraftDepuisContrat = {
  date: string
  typeOt: TypeOt
  action: string
  rapportAction: string
  observations: string
  clientId: string
  chantierId: string
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
  statut: 'pret_a_planifier'
  parcoursStep: 'ot'
  interventionPartielle: false
  avancementPct: 0
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
    const docs = docsRequisPourFamille(famille)
    const typeOt = typeOtPourFamille(famille)
    const visites = visitesDepuisContrat(contrat, input.sites, {
      today: input.today,
      horizonMonths: input.horizonMonths,
      pastMonths: input.pastMonths,
    })
    for (const v of visites) {
      const site = input.sites.find((s) => s.id === v.siteId)
      drafts.push({
        date: v.date,
        typeOt,
        action: `Maintenance ${NIVEAU_VISITE_LABELS[v.niveau].toLowerCase()} — ${v.siteNom}`,
        rapportAction: '',
        observations: [
          `Contrat ${contrat.numero}`,
          contrat.titre,
          `Fiche ${NIVEAU_VISITE_LABELS[v.niveau].toLowerCase()} (registre imbriqué).`,
          'Date déplaçable si urgence ou reprise d’une visite partielle.',
        ]
          .filter(Boolean)
          .join('\n'),
        clientId: contrat.clientId,
        chantierId: v.siteId,
        technicien: '',
        secteur,
        agenceCode: site?.agenceCode,
        heure: '',
        lienCommandeType: 'contrat',
        lienCommandeRef: contrat.numero,
        contratId: contrat.id,
        contratOtKey: v.contratOtKey,
        visiteNiveau: v.niveau,
        origineOt: 'maintenance_contrat',
        statutFacturation: 'sous_contrat',
        mainOeuvreIncluseContrat: true,
        docsRequis: docs,
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
    if (keys.has(d.contratOtKey)) {
      skipped += 1
      continue
    }
    keys.add(d.contratOtKey)
    toAdd.push(d)
  }
  return { toAdd, skipped }
}
