/**
 * Chaîne commerciale CVC / F-Gas — Devis, Commandes fournisseur, Factures (légères).
 * Runtime : stocké dans AppData (org_data.payload). SQL cible : supabase/chaine-commerciale.sql
 */

import type { OrdreTravail } from './ordreTravail'

/** Origine métier de l’OT (les 6 cas). */
export type OrigineOt =
  | 'depannage_urgence'
  | 'installation_devis'
  | 'maintenance_contrat'
  | 'garantie'
  | 'sous_traitance'
  | 'commande_materiel'

export const ORIGINE_OT_LABELS: Record<OrigineOt, string> = {
  depannage_urgence: 'Dépannage / urgence',
  installation_devis: 'Exécution devis accepté',
  maintenance_contrat: 'Visite sous contrat',
  garantie: 'Sous garantie',
  sous_traitance: 'Sous-traitance / donneur d’ordre',
  commande_materiel: 'Attente pièce fournisseur',
}

export type StatutFacturationOt =
  | 'non_facture'
  | 'sous_contrat'
  | 'devis_a_faire'
  | 'devis_regule_emis'
  | 'facture_generee'
  | 'garantie_prise_en_charge'

export const STATUT_FACTURATION_OT_LABELS: Record<StatutFacturationOt, string> = {
  non_facture: 'Non facturé',
  sous_contrat: 'Inclus contrat (0 € MO)',
  devis_a_faire: 'Devis de régule à faire',
  devis_regule_emis: 'Devis de régule émis',
  facture_generee: 'Facture générée',
  garantie_prise_en_charge: 'Garantie / avoir fabricant',
}

export type StatutDevis =
  | 'brouillon'
  | 'envoye'
  | 'accepte'
  | 'refuse'
  | 'annule'
  | 'execute'

export const STATUT_DEVIS_LABELS: Record<StatutDevis, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  annule: 'Annulé',
  execute: 'Exécuté',
}

export type TypeDevis = 'standard' | 'regularisation'

export type LigneCommerciale = {
  id: string
  designation: string
  quantite: number
  unite?: string
  prixUnitaireHt?: number
  /** Pièce / fluide hors forfait contrat */
  horsContrat?: boolean
  /** Inclus dans contrat (MO de base) */
  inclusContrat?: boolean
}

export type Devis = {
  id: string
  numero: string
  type: TypeDevis
  statut: StatutDevis
  clientId: string
  chantierId?: string
  /** OT d’urgence à l’origine d’un devis de régule */
  otOrigineId?: string
  libelle: string
  lignes: LigneCommerciale[]
  montantHt?: number
  /** Lien Make / Tiime / Pennylane */
  externeUrl?: string
  notes?: string
  accepteAt?: string
  createdAt: string
  updatedAt: string
}

export type StatutCommandeFournisseur = 'brouillon' | 'commandee' | 'recue' | 'annulee'

export const STATUT_COMMANDE_FOURNISSEUR_LABELS: Record<StatutCommandeFournisseur, string> = {
  brouillon: 'Brouillon',
  commandee: 'Commandée',
  recue: 'Reçue en stock',
  annulee: 'Annulée',
}

export type CommandeFournisseur = {
  id: string
  numero: string
  fournisseur: string
  statut: StatutCommandeFournisseur
  clientId?: string
  chantierId?: string
  /** OT en attente de cette pièce */
  otId?: string
  libelle: string
  referencePiece?: string
  /** Quantité commandée (défaut 1 à réception stock). */
  quantite?: number
  unite?: string
  prixUnitaireHt?: number
  /** Catégorie GMAO (filtre, compresseur…) */
  categorie?: string
  marque?: string
  /** Emplacement prévu à réception */
  rayonStock?: string
  seuilAlerte?: number
  notes?: string
  commandeeAt?: string
  recueAt?: string
  createdAt: string
  updatedAt: string
}

export type StatutFacture = 'brouillon' | 'emise' | 'payee' | 'annulee'

export type Facture = {
  id: string
  numero: string
  statut: StatutFacture
  clientId: string
  /** Client payeur si différent (sous-traitance) */
  clientPayeurId?: string
  chantierId?: string
  otId?: string
  devisId?: string
  libelle: string
  montantHt?: number
  externeUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export function nextNumeroDevis(
  list: Pick<Devis, 'numero'>[],
  type: TypeDevis = 'standard',
): string {
  const year = new Date().getFullYear()
  const prefix = type === 'regularisation' ? `DR${year}` : `DV${year}`
  let max = 0
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i')
  for (const d of list) {
    const m = re.exec((d.numero || '').trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export function nextNumeroCommande(list: Pick<CommandeFournisseur, 'numero'>[]): string {
  const year = new Date().getFullYear()
  const prefix = `CF${year}`
  let max = 0
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i')
  for (const c of list) {
    const m = re.exec((c.numero || '').trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export function nextNumeroFacture(list: Pick<Facture, 'numero'>[]): string {
  const year = new Date().getFullYear()
  const prefix = `FA${year}`
  let max = 0
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i')
  for (const f of list) {
    const m = re.exec((f.numero || '').trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export function blankDevis(
  clientId: string,
  opts?: Partial<Devis> & { type?: TypeDevis },
): Omit<Devis, 'id' | 'createdAt' | 'updatedAt' | 'numero'> & { numero?: string } {
  return {
    type: opts?.type || 'standard',
    statut: 'brouillon',
    clientId,
    chantierId: opts?.chantierId,
    otOrigineId: opts?.otOrigineId,
    libelle: opts?.libelle || (opts?.type === 'regularisation' ? 'Devis de régularisation' : 'Devis'),
    lignes: opts?.lignes || [],
    montantHt: opts?.montantHt,
    externeUrl: opts?.externeUrl,
    notes: opts?.notes,
  }
}

/** Infère l’origine commerciale depuis les liens déjà présents (rétrocompat v107). */
export function inferOrigineOt(o: Partial<OrdreTravail>): OrigineOt {
  if (o.origineOt) return o.origineOt
  if (o.sousGarantie) return 'garantie'
  if (o.clientPayeurId) return 'sous_traitance'
  if (o.commandeFournisseurId) return 'commande_materiel'
  if (o.devisId || o.lienCommandeType === 'devis') return 'installation_devis'
  if (o.lienCommandeType === 'devis_regule') return 'depannage_urgence'
  if (o.contratId || o.lienCommandeType === 'contrat') return 'maintenance_contrat'
  if (o.typeOt === 'depanage') return 'depannage_urgence'
  return 'depannage_urgence'
}

export function inferStatutFacturation(o: Partial<OrdreTravail>): StatutFacturationOt {
  if (o.statutFacturation) return o.statutFacturation
  if (o.sousGarantie) return 'garantie_prise_en_charge'
  if (o.factureId) return 'facture_generee'
  if (o.devisId && o.lienCommandeType === 'devis_regule') return 'devis_regule_emis'
  if (o.contratId || o.lienCommandeType === 'contrat') return 'sous_contrat'
  if (o.lienCommandeType === 'devis_regule') return 'devis_a_faire'
  return 'non_facture'
}

export function otsPourDevis(
  ordres: OrdreTravail[] | undefined,
  devisId: string,
): OrdreTravail[] {
  return (ordres || []).filter((o) => o.devisId === devisId)
}

/** Libellé liste OT : origine + lien commercial. */
export function formatOtCommercialBadge(o: {
  origineOt?: OrigineOt | string
  lienCommandeType?: string
  lienCommandeRef?: string
  statutFacturation?: StatutFacturationOt | string
}): string | null {
  const parts: string[] = []
  if (o.origineOt && o.origineOt !== 'depannage_urgence') {
    parts.push(ORIGINE_OT_LABELS[o.origineOt as OrigineOt] || String(o.origineOt))
  }
  if (o.lienCommandeRef?.trim()) parts.push(o.lienCommandeRef.trim())
  else if (o.statutFacturation && o.statutFacturation !== 'non_facture') {
    parts.push(
      STATUT_FACTURATION_OT_LABELS[o.statutFacturation as StatutFacturationOt] ||
        String(o.statutFacturation),
    )
  }
  return parts.length ? parts.join(' · ') : null
}
