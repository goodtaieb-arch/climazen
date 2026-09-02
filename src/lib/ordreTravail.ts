/** Ordre de travail (OT) — n° unique aammjjxx (ex. 26081501), un seul par intervention. */

/**
 * Libellés UI — certaines sociétés disent « demande d’intervention » pour le même document.
 * On garde OT partout (n°) et on affiche les deux mots pour ne perdre personne.
 */
export const OT_LABEL = {
  /** Titre page / menu long */
  title: 'Ordres de travail',
  /** Sous-titre court sous le titre */
  alsoCalled: 'Aussi appelés demandes d’intervention',
  /** Menu / tuile compacte */
  nav: 'OT / Demandes',
  /** Explication une ligne */
  hint: 'OT = demande d’intervention — un n° unique par action terrain + docs groupés (ZIP / envoi client).',
} as const

export type TypeOt =
  | 'controle_etancheite'
  | 'maintenance'
  | 'depanage'
  | 'demantelement'
  | 'entretien'
  | 'installation'

export const TYPE_OT_LABELS: Record<TypeOt, string> = {
  controle_etancheite: 'Contrôle d’étanchéité',
  maintenance: 'Maintenance',
  depanage: 'Dépannage',
  demantelement: 'Démantèlement',
  entretien: 'Entretien',
  installation: 'Installation',
}

export type StatutOt =
  | 'brouillon'
  | 'en_cours'
  | 'en_attente_piece'
  | 'pret_a_planifier'
  | 'termine'
  | 'signe'

export const STATUT_OT_LABELS: Record<StatutOt, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  en_attente_piece: 'En attente de pièce',
  pret_a_planifier: 'Prêt à planifier',
  termine: 'Terminé',
  signe: 'Clôturé',
}

export function isOtCloture(statut: StatutOt | string | undefined): boolean {
  return statut === 'signe' || statut === 'termine'
}

/** Tous les comptes tech de l’OT (principal + co-intervenants). */
export function techIdsOt(ot: {
  technicienUserId?: string
  technicienUserIds?: string[]
}): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of [...(ot.technicienUserIds || []), ot.technicienUserId]) {
    const id = String(raw || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function syncTechsOt(opts: {
  technicienUserIds: string[]
  noms?: Record<string, string>
  technicien?: string
}): { technicienUserIds: string[]; technicienUserId?: string; technicien: string } {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const raw of opts.technicienUserIds) {
    const id = String(raw || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  const names = ids
    .map((id) => (opts.noms && opts.noms[id]) || '')
    .filter(Boolean)
  return {
    technicienUserIds: ids,
    technicienUserId: ids[0],
    technicien: names.join(' + ') || (opts.technicien || '').trim(),
  }
}

export function labelTechsOt(
  ot: { technicien?: string; technicienUserIds?: string[] },
  fallback = '',
): string {
  const n = (ot.technicien || '').trim()
  if (n) return n
  const count = (ot.technicienUserIds || []).filter(Boolean).length
  if (count > 1) return `${count} techs`
  return fallback
}

/** Passage terrain (un jour) — signature client = preuve de présence, même si le chantier n’est pas fini. */
export type VisitePresenceOt = {
  id: string
  date: string
  avancementPct: number
  note?: string
  signatureClientImage?: string
  signatureTechnicienImage?: string
  createdAt: string
}

export function clampAvancementPct(n: unknown): number {
  const v = Math.round(Number(n) || 0)
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, v))
}

export function otAvancementPct(
  ot: Pick<OrdreTravail, 'avancementPct' | 'statut'>,
): number {
  if (isOtCloture(ot.statut)) return 100
  return clampAvancementPct(ot.avancementPct)
}

export function formatOtAvancement(
  ot: Pick<OrdreTravail, 'avancementPct' | 'statut' | 'interventionPartielle'>,
): string | null {
  if (isOtCloture(ot.statut)) return null
  const pct = otAvancementPct(ot)
  if (!ot.interventionPartielle && pct <= 0) return null
  return `${pct} %`
}

export function lastVisitePresence(
  ot: Pick<OrdreTravail, 'visitesPresence'>,
): VisitePresenceOt | undefined {
  const list = ot.visitesPresence || []
  return list.length ? list[list.length - 1] : undefined
}

export function presenceValideeLeJour(
  ot: Pick<OrdreTravail, 'visitesPresence'>,
  date: string,
): boolean {
  const d = (date || '').slice(0, 10)
  return (ot.visitesPresence || []).some(
    (v) => v.date === d && Boolean(v.signatureClientImage),
  )
}

/** Une présence par jour : met à jour le passage du jour ou en ajoute un. */
export function upsertVisitePresence(
  visites: VisitePresenceOt[] | undefined,
  visite: Omit<VisitePresenceOt, 'id' | 'createdAt'> & { id?: string },
): VisitePresenceOt[] {
  const next: VisitePresenceOt = {
    id: visite.id || crypto.randomUUID(),
    date: (visite.date || '').slice(0, 10),
    avancementPct: clampAvancementPct(visite.avancementPct),
    note: (visite.note || '').trim() || undefined,
    signatureClientImage: visite.signatureClientImage,
    signatureTechnicienImage: visite.signatureTechnicienImage,
    createdAt: new Date().toISOString(),
  }
  const prev = [...(visites || [])]
  const idx = prev.findIndex((v) => v.date === next.date)
  if (idx >= 0) {
    prev[idx] = {
      ...next,
      id: prev[idx].id,
      createdAt: prev[idx].createdAt,
    }
    return prev
  }
  return [...prev, next]
}

/** Étapes du parcours appel client → intervention. */
export const PARCOURS_APPEL_STEPS = [
  { id: 'ot', label: 'Appel / OT', hint: 'Décrire la demande' },
  { id: 'client', label: 'Client', hint: 'Qui appelle' },
  { id: 'site', label: 'Site', hint: 'Où intervenir' },
  { id: 'equipement', label: 'Équipement', hint: 'Sur place' },
  { id: 'docs', label: 'Intervention', hint: 'CERFA / fiche' },
] as const

export type ParcoursAppelStepId = (typeof PARCOURS_APPEL_STEPS)[number]['id']

/**
 * Lien commercial de l’OT — devis, contrat, commande, ou devis de régule
 * (après dépannage d’urgence). Pas un module de facturation : juste le rattachement.
 */
export type LienCommandeType =
  | 'aucun'
  | 'contrat'
  | 'devis'
  | 'devis_regule'
  | 'commande'

export const LIEN_COMMANDE_LABELS: Record<LienCommandeType, string> = {
  aucun: 'Aucune (libre)',
  contrat: 'Contrat maintenance',
  devis: 'Devis',
  devis_regule: 'Devis de régule',
  commande: 'Commande',
}

export function formatLienCommande(o: {
  lienCommandeType?: LienCommandeType | string
  lienCommandeRef?: string
}): string | null {
  const t = (o.lienCommandeType || 'aucun') as LienCommandeType
  if (!t || t === 'aucun') return null
  const label = LIEN_COMMANDE_LABELS[t] || t
  const ref = (o.lienCommandeRef || '').trim()
  return ref ? `${label} · ${ref}` : label
}

export interface OrdreTravail {
  id: string
  /** Format aammjjxx — ex. 26081501. Unique pour toute l’intervention (multi-équipements / multi-jours). */
  numero: string
  date: string
  typeOt: TypeOt
  /** Description de l’action / mission (panne, installation…) */
  action: string
  /** Rapport d’action (ce qui a été fait) */
  rapportAction: string
  observations: string
  clientId?: string
  chantierId?: string
  /** Équipement principal (compat) */
  equipementId?: string
  /** Plusieurs équipements traités sur le même OT */
  equipementIds?: string[]
  /** Nom affiché du / des techniciens (ex. « Jean + Marc ») */
  technicien: string
  /** Compte principal (1er de la liste) — rétrocompat */
  technicienUserId?: string
  /** Tous les techs sur l’OT en même temps */
  technicienUserIds?: string[]
  /**
   * Métier / équipe de l’OT (CVC, frigoriste, plombier…) — couleur agenda.
   * Indépendant du tech affecté : on voit la spécialité demandée.
   */
  secteur?: import('./postePersonnel').PostePersonnelId
  /** Agence / département du chantier (75, 06, 13…). */
  agenceCode?: string
  /** Heure de passage prévue (HH:mm) — planning agenda. Sans heure = pas encore calé. */
  heure?: string
  /** Durée prévue sur le planning (minutes). Défaut 60 si absent. */
  dureeMinutes?: number
  /** Lien CERFA si généré avec fluide */
  interventionId?: string
  /** Lien fiche maintenance clim / rapport sans CERFA */
  ficheMaintenanceId?: string
  /** Lien fiche maintenance chaufferie P2/P3 */
  ficheChaufferieId?: string
  /** Lien fiche maintenance CTA / VMC */
  ficheCtaVmcId?: string
  /**
   * Rattachement commercial (v107+) — type libre + réf. texte.
   * Préférer devisId / contratId / commandeFournisseurId quand disponibles.
   */
  lienCommandeType?: LienCommandeType
  /** N° devis, n° commande, ou libellé (ex. « Devis Tiime #452 ») */
  lienCommandeRef?: string
  /** Contrat maintenance (visite préventive) */
  contratId?: string
  /**
   * Créneau auto (contrat + site + année de cycle + mois).
   * Stable si on déplace la date (urgence / reprise partielle).
   */
  contratOtKey?: string
  /** Niveau de fiche du passage : mensuel ⊂ trimestriel ⊂ semestriel ⊂ annuel */
  visiteNiveau?: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel'
  /** Devis d’origine (accepté) ou devis de régule — 1 devis → N OT */
  devisId?: string
  /** Commande fournisseur (pièce en attente) */
  commandeFournisseurId?: string
  /** OT créé depuis un ticket portail client */
  ticketClient?: boolean
  ticketClientId?: string
  /** Lieu signalé par le client (ex. Bureau 117) */
  localisationClient?: string
  /** Facture générée depuis cet OT */
  factureId?: string
  /** Les 6 origines métier CVC */
  origineOt?: import('./chaineCommerciale').OrigineOt
  /** Suivi facturation / régule */
  statutFacturation?: import('./chaineCommerciale').StatutFacturationOt
  /** Sous garantie constructeur / installateur */
  sousGarantie?: boolean
  /** Client payeur (donneur d’ordre) si ≠ client site — sous-traitance */
  clientPayeurId?: string
  /** MO de base incluse dans le contrat (0 €) */
  mainOeuvreIncluseContrat?: boolean
  /** Équipement suivi avec un sous-traitant */
  maintenanceParSousTraitant?: boolean
  /** Le tech ClimaZEN accompagne le sous-traitant sur site */
  techAccompagneSousTraitant?: boolean
  /** Rapport livré par le sous-traitant (clôture bureau) */
  rapportSousTraitant?: string
  /** Le tech a mis à jour le registre de sécurité */
  registreSecuriteConfirme?: boolean
  /**
   * Fiches que le bureau a cochées pour le tech (maintenance).
   * CERFA s’ajoute tout seul si le tech touche au gaz — voir `toucheGaz`.
   */
  docsRequis?: Array<'cerfa' | 'fiche_clim' | 'fiche_chaufferie' | 'fiche_cta_vmc'>
  /**
   * Le tech a-t-il touché au gaz / fluide ?
   * undefined = on s’aligne sur les équipements fluide.
   * false = pas de gaz (CERFA accessible, pas exigé).
   */
  toucheGaz?: boolean
  signatureTechnicienImage?: string
  signatureClientImage?: string
  statut: StatutOt
  /**
   * Chantier sur plusieurs jours : pas encore terminé.
   * La signature client reste obligatoire (présence), sans clôturer l’OT.
   */
  interventionPartielle?: boolean
  /** 0–100 — dernier avancement déclaré. */
  avancementPct?: number
  /** Signatures de présence par jour de passage. */
  visitesPresence?: VisitePresenceOt[]
  /** Étape parcours guidé (reprise) */
  parcoursStep?: ParcoursAppelStepId
  createdByUserId?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
}

export function blankOrdreTravail(): Omit<OrdreTravail, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    numero: '',
    date: new Date().toISOString().slice(0, 10),
    typeOt: 'depanage',
    action: '',
    rapportAction: '',
    observations: '',
    technicien: '',
    technicienUserId: undefined,
    technicienUserIds: [],
    secteur: undefined,
    agenceCode: undefined,
    statut: 'brouillon',
    parcoursStep: 'ot',
    lienCommandeType: 'aucun',
    lienCommandeRef: '',
    contratId: undefined,
    devisId: undefined,
    commandeFournisseurId: undefined,
    factureId: undefined,
    origineOt: 'depannage_urgence',
    statutFacturation: 'non_facture',
    sousGarantie: false,
    clientPayeurId: undefined,
    mainOeuvreIncluseContrat: false,
    interventionPartielle: false,
    avancementPct: 0,
    visitesPresence: [],
    docsRequis: [],
    toucheGaz: undefined,
    maintenanceParSousTraitant: false,
    techAccompagneSousTraitant: false,
    rapportSousTraitant: '',
    registreSecuriteConfirme: false,
    heure: undefined,
  }
}

/** Natures CERFA suggérées selon le type d’OT. */
export function naturesCerfaPourTypeOt(typeOt: TypeOt): string[] {
  if (typeOt === 'demantelement') return ['demantelement']
  if (typeOt === 'controle_etancheite') return ['controle_etancheite_periodique']
  if (typeOt === 'maintenance') return ['entretien_reparation', 'controle_etancheite_periodique']
  return ['entretien_reparation']
}

/**
 * N° OT « de base » : enlève préfixe OT et suffixe historique -1, -2…
 * (anciens CERFA multi-équipements). Le n° OT reste unique par intervention.
 */
export function otBaseNumero(raw?: string | null): string {
  let v = (raw || '').trim()
  if (!v) return ''
  v = v.replace(/^OT\s*/i, '')
  return v.replace(/-\d+$/, '')
}

/**
 * Affichage utilisateur : OT26081702 (toujours avec le préfixe OT).
 * Accepte un n° brut ou déjà préfixé.
 */
export function formatOtNumero(raw?: string | null): string {
  const base = otBaseNumero(raw)
  return base ? `OT${base}` : ''
}

/** True si deux n° désignent la même intervention OT (avec ou sans suffixe -N). */
export function sameOtNumero(a?: string | null, b?: string | null): boolean {
  const ba = otBaseNumero(a)
  const bb = otBaseNumero(b)
  if (!ba || !bb) return false
  return ba === bb
}

/** Clé jour aammjj (ex. 260815) — fuseau Europe/Paris (terrain FR). */
export function otDayKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const yy = parts.find((p) => p.type === 'year')?.value ?? '00'
  const mm = parts.find((p) => p.type === 'month')?.value ?? '01'
  const jj = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${yy}${mm}${jj}`
}

/**
 * Max séquentiel xx du jour pour aammjjxx
 * (ignore suffixe -N ; ignore anciens OT2026xxxx / INT-YYYY-NNNN).
 */
function maxSeqDay(dayKey: string, values: (string | undefined)[]): number {
  const re = new RegExp(`^${dayKey}(\\d{2,})(?:-\\d+)?$`)
  let max = 0
  for (const raw of values) {
    const v = otBaseNumero(raw)
    const m = re.exec(v)
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  return max
}

/**
 * Prochain n° OT unique.
 * Format stocké : aammjjxx — ex. 26081501 (année, mois, jour, séquence du jour).
 * Affichage : OT26081501 via formatOtNumero().
 * Un seul n° par intervention, même multi-équipements / multi-jours.
 */
export function nextNumeroOt(
  data: {
    ordresTravail?: Pick<OrdreTravail, 'numero'>[]
    interventions?: { numeroIntervention?: string }[]
    fichesMaintenanceClim?: { numero?: string }[]
    fichesMaintenanceChaufferie?: { numero?: string }[]
    fichesMaintenanceCtaVmc?: { numero?: string }[]
  },
  offset = 0,
): string {
  const dayKey = otDayKey()
  const values = [
    ...(data.ordresTravail || []).map((o) => o.numero),
    ...(data.interventions || []).map((i) => i.numeroIntervention),
    ...(data.fichesMaintenanceClim || []).map((f) => f.numero),
    ...(data.fichesMaintenanceChaufferie || []).map((f) => f.numero),
    ...(data.fichesMaintenanceCtaVmc || []).map((f) => f.numero),
  ]
  // Dédupliquer par n° de base pour ne pas compter 2× le même OT (multi-CERFA)
  const unique = [...new Set(values.map((v) => otBaseNumero(v)).filter(Boolean))]
  const next = maxSeqDay(dayKey, unique) + 1 + Math.max(0, offset)
  return `${dayKey}${String(next).padStart(2, '0')}`
}

/** Déduit l’étape à reprendre selon ce qui est déjà renseigné. */
export function inferParcoursStep(ot: OrdreTravail): ParcoursAppelStepId {
  if (ot.parcoursStep === 'docs') return 'docs'
  if (!ot.action?.trim()) return 'ot'
  if (!ot.clientId) return 'client'
  if (!ot.chantierId) return 'site'
  if (!ot.equipementId && !(ot.equipementIds && ot.equipementIds.length > 0)) return 'equipement'
  return 'docs'
}
