/** Contrats de maintenance — modèles types auto-remplis, modifiables, signables. */

import type { PostePersonnelId } from './postePersonnel'
import { isSecteurOt, parsePostePersonnel } from './postePersonnel'

export type StatutContrat = 'brouillon' | 'propose' | 'signe' | 'resilie' | 'expire'

export const STATUT_CONTRAT_LABELS: Record<StatutContrat, string> = {
  brouillon: 'Brouillon',
  propose: 'Proposé',
  signe: 'Signé',
  resilie: 'Résilié',
  expire: 'Expiré',
}

export type PeriodiciteContrat = 'mensuelle' | 'trimestrielle' | 'semestrielle' | 'annuelle'

export const PERIODICITE_LABELS: Record<PeriodiciteContrat, string> = {
  mensuelle: 'Mensuelle',
  trimestrielle: 'Trimestrielle',
  semestrielle: 'Semestrielle',
  annuelle: 'Annuelle',
}

export type ModeleContratId =
  | 'annuelle_clim'
  | 'semestrielle_clim'
  | 'chaufferie_12'
  | 'cta_4'
  | 'controle_etancheite'
  | 'multi_sites'

/** Famille d’équipements → fiche terrain (couleurs métier à part, via `secteur`). */
export type FamilleContrat = 'clim' | 'chaufferie' | 'cta' | 'mixte' | 'etancheite'

export const FAMILLE_CONTRAT_LABELS: Record<FamilleContrat, string> = {
  clim: 'Clim / PAC',
  chaufferie: 'Chaufferie',
  cta: 'CTA / VMC',
  mixte: 'Mixte (plusieurs équipements)',
  etancheite: 'Contrôle d’étanchéité',
}

/** Nombre de passages / an — l’utilisateur choisit, on génère les OT. */
export type VisitesParAn = 1 | 2 | 4 | 6 | 12

export const VISITES_PAR_AN_OPTIONS: {
  n: VisitesParAn
  label: string
  hint: string
}[] = [
  {
    n: 12,
    label: '12 / an',
    hint: 'Chaque mois — chaufferie : 1-2 M, 3 T, 6 S, 12 A',
  },
  { n: 6, label: '6 / an', hint: 'Tous les 2 mois (S et A inclus)' },
  { n: 4, label: '4 / an', hint: 'CTA type — trimestrielle, S, T, annuelle' },
  { n: 2, label: '2 / an', hint: 'Clim type — semestrielle + annuelle' },
  { n: 1, label: '1 / an', hint: 'Visite annuelle seule' },
]

export function parseVisitesParAn(raw: unknown): VisitesParAn | undefined {
  const n = Number(raw)
  if (n === 1 || n === 2 || n === 4 || n === 6 || n === 12) return n
  return undefined
}

/** Une ligne du dossier : un équipement, sa fréquence, éventuellement sous-traité. */
export type LigneContratEquipement = {
  siteId: string
  equipementId: string
  /** Surcharge la fréquence du contrat */
  visitesParAn?: VisitesParAn
  /** La société se fait aider par un sous-traitant sur cet équipement */
  sousTraitant?: boolean
}

export function parseLignesEquipements(raw: unknown): LigneContratEquipement[] {
  if (!Array.isArray(raw)) return []
  const out: LigneContratEquipement[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const siteId = String(rec.siteId || '').trim()
    const equipementId = String(rec.equipementId || '').trim()
    if (!siteId || !equipementId) continue
    const key = `${siteId}::${equipementId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      siteId,
      equipementId,
      visitesParAn: parseVisitesParAn(rec.visitesParAn),
      sousTraitant: rec.sousTraitant === true,
    })
  }
  return out
}

export function parseFamilleContrat(raw: unknown): FamilleContrat | undefined {
  const v = String(raw || '').trim()
  if (
    v === 'clim' ||
    v === 'chaufferie' ||
    v === 'cta' ||
    v === 'mixte' ||
    v === 'etancheite'
  ) {
    return v
  }
  return undefined
}

export interface ModeleContratDef {
  id: ModeleContratId
  titre: string
  resume: string
  periodicite: PeriodiciteContrat
  famille: FamilleContrat
  visitesParAn: VisitesParAn
  secteur: PostePersonnelId
  /** Corps type — placeholders {{operateur}}, {{client}}, {{sites}}, {{periodicite}}, {{duree}} */
  corpsType: string
  prestations: string[]
}

export const MODELES_CONTRAT: ModeleContratDef[] = [
  {
    id: 'annuelle_clim',
    titre: 'Contrat maintenance clim / PAC',
    resume: '2 visites / an · semestrielle + annuelle (fiche clim)',
    periodicite: 'semestrielle',
    famille: 'clim',
    visitesParAn: 2,
    secteur: 'tech_cvc',
    prestations: [
      'Visite d’entretien préventive des équipements sous contrat',
      'Contrôle d’étanchéité périodique (F-Gas) selon périodicité réglementaire',
      'Nettoyage des filtres / batteries accessibles',
      'Vérification des paramètres de fonctionnement',
      'Compte-rendu d’intervention et CERFA le cas échéant',
    ],
    corpsType: `CONTRAT D’ENTRETIEN ET DE MAINTENANCE

Entre les soussignés :

L’opérateur : {{operateur}}
ci-après « le Prestataire »,

Et

Le client / détenteur : {{client}}
ci-après « le Client »,

Il a été convenu ce qui suit :

Article 1 — Objet
Le Prestataire s’engage à assurer l’entretien et la maintenance des équipements frigorifiques / climatiques situés sur le(s) site(s) : {{sites}}.

Article 2 — Prestations
Les prestations comprennent notamment :
{{prestations}}

Article 3 — Périodicité
Les interventions sont prévues selon une périodicité {{periodicite}}, aux dates convenues avec le Client.

Article 4 — Durée
Le présent contrat est conclu pour une durée de {{duree}} à compter de la date de signature, renouvelable par tacite reconduction sauf résiliation écrite un mois avant échéance.

Article 5 — Obligations
Le Prestataire réalise les interventions dans les règles de l’art et la réglementation F-Gas.
Le Client assure l’accès aux équipements et signale toute anomalie.

Article 6 — Prix
Le montant annuel / périodique est fixé à : {{prix}} (HT), payable selon les conditions habituelles du Prestataire.

Fait en deux exemplaires.
`,
  },
  {
    id: 'semestrielle_clim',
    titre: 'Contrat maintenance semestrielle clim',
    resume: '2 visites / an · sites exigeants (resto, froid alimentaire…)',
    periodicite: 'semestrielle',
    famille: 'clim',
    visitesParAn: 2,
    secteur: 'tech_cvc',
    prestations: [
      'Deux visites d’entretien préventif par an',
      'Contrôle d’étanchéité selon périodicité réglementaire',
      'Vérification des pressions / températures',
      'Contrôle des organes de sécurité',
      'Rapport d’intervention à chaque visite',
    ],
    corpsType: `CONTRAT D’ENTRETIEN SEMESTRIEL

Entre :

L’opérateur : {{operateur}}
Et le client : {{client}}

Sites couverts : {{sites}}

Le Prestataire assure une maintenance préventive à périodicité {{periodicite}} sur les équipements listés, comprenant :
{{prestations}}

Durée : {{duree}} — Prix : {{prix}} HT.

Les interventions donnent lieu à une fiche Intervention (INT) et, le cas échéant, à un CERFA.
`,
  },
  {
    id: 'chaufferie_12',
    titre: 'Contrat chaufferie (12 visites / an)',
    resume: '1 / mois · mensuelle ⊂ trimestrielle ⊂ semestrielle ⊂ annuelle',
    periodicite: 'mensuelle',
    famille: 'chaufferie',
    visitesParAn: 12,
    secteur: 'tech_cvc',
    prestations: [
      'Visite mensuelle d’exploitation (relevés, sécurité, propreté)',
      'Visite trimestrielle : manœuvres et entretien courant',
      'Visite semestrielle : mi-saison / basculement',
      'Visite annuelle : grand entretien et conformité',
      'Fiche registre P2/P3 selon le niveau du mois',
      'Compte-rendu à chaque passage',
    ],
    corpsType: `CONTRAT D’ENTRETIEN CHAUFFERIE

Entre :

L’opérateur : {{operateur}}
Et le client : {{client}}

Sites : {{sites}}

Le Prestataire assure une maintenance préventive à raison de 12 visites par an.
Le niveau de la visite suit le registre : mensuelle, trimestrielle (3e et 9e mois),
semestrielle (6e mois) et annuelle (12e mois). La fiche terrain s’ouvre
automatiquement sur le bon niveau.

Prestations :
{{prestations}}

Durée : {{duree}} — Prix : {{prix}} HT.

Chaque visite fait l’objet d’une INT ClimaZEN, affectable à un technicien
dans l’agenda. La date peut être déplacée en cas d’urgence ou de reprise
d’une intervention partielle.
`,
  },
  {
    id: 'cta_4',
    titre: 'Contrat CTA / VMC',
    resume: '4 visites / an · trimestrielle, semestrielle, T, annuelle — fréquence modifiable',
    periodicite: 'trimestrielle',
    famille: 'cta',
    visitesParAn: 4,
    secteur: 'tech_cvc',
    prestations: [
      'Visites préventives CTA / VMC selon la fréquence choisie',
      'Contrôle des bouches, filtres, turbine et organes de sécurité',
      'Fiche registre 1M / 3M / 6M / 1Y selon le niveau du passage',
      'Rapport d’intervention à chaque visite',
    ],
    corpsType: `CONTRAT D’ENTRETIEN CTA / VMC

Entre :

L’opérateur : {{operateur}}
Et le client : {{client}}

Sites : {{sites}}

Le Prestataire assure la maintenance préventive des CTA / VMC à périodicité
{{periodicite}} (fréquence choisie par le Client). Chaque visite ouvre la
fiche du niveau correspondant (mensuelle ⊂ trimestrielle ⊂ semestrielle ⊂ annuelle).

Prestations :
{{prestations}}

Durée : {{duree}} — Prix : {{prix}} HT.
`,
  },
  {
    id: 'controle_etancheite',
    titre: 'Contrat contrôle d’étanchéité périodique',
    resume: 'Focus F-Gas · contrôles réglementaires planifiés',
    periodicite: 'annuelle',
    famille: 'etancheite',
    visitesParAn: 1,
    secteur: 'tech_frigoriste',
    prestations: [
      'Contrôle d’étanchéité périodique réglementaire',
      'Détection de fuites (détecteur contrôlé)',
      'Émission du CERFA 15497 le cas échéant',
      'Traçabilité des charges et manipulations de fluide',
    ],
    corpsType: `CONTRAT DE CONTRÔLE D’ÉTANCHEITÉ

Entre {{operateur}} (Prestataire) et {{client}} (Client / détenteur).

Sites : {{sites}}

Objet : organiser les contrôles d’étanchéité périodiques (règlementation F-Gas) à périodicité {{periodicite}}.

Prestations :
{{prestations}}

Durée : {{duree}} — Prix : {{prix}} HT.
`,
  },
  {
    id: 'multi_sites',
    titre: 'Contrat multi-sites',
    resume: 'Un client, plusieurs sites — même cadre, fréquence au choix',
    periodicite: 'annuelle',
    famille: 'mixte',
    visitesParAn: 1,
    secteur: 'tech_multitechnique',
    prestations: [
      'Maintenance préventive sur chaque site listé',
      'Planning de passages coordonné',
      'Contrôles d’étanchéité selon charge / fluide',
      'Reporting consolidé par site',
    ],
    corpsType: `CONTRAT DE MAINTENANCE MULTI-SITES

Prestataire : {{operateur}}
Client : {{client}}

Sites couverts par le présent contrat :
{{sites}}

Périodicité des passages : {{periodicite}}
Durée : {{duree}}
Prix global : {{prix}} HT

Prestations communes à tous les sites :
{{prestations}}

Chaque intervention fait l’objet d’une INT ClimaZEN et des documents réglementaires associés.
`,
  },
]

export interface ContratMaintenance {
  id: string
  numero: string
  modeleId: ModeleContratId
  titre: string
  clientId: string
  /** Sites couverts — vide = tous les sites du client au moment de la signature */
  chantierIds: string[]
  periodicite: PeriodiciteContrat
  /** clim / chaufferie / CTA… — détermine la fiche terrain */
  famille?: FamilleContrat
  /** 1, 2, 4, 6 ou 12 passages / an — choix utilisateur */
  visitesParAn?: VisitesParAn
  /** Métier / couleur agenda (CVC, frigo…) */
  secteur?: PostePersonnelId
  /** false = contrat signé sans générer les OT (cas rare) */
  genererOtAuto?: boolean
  /**
   * Lignes client → équipement → fréquence.
   * Chaufferie / clim / CTA ne sont que des exemples de fiches.
   * Vide = tous les équipements des sites couverts, même fréquence.
   */
  lignesEquipements?: LigneContratEquipement[]
  /**
   * Dates de visite décalées (avancer / retarder un contrôle).
   * Clé = `siteId:slotKey` (ex. `s1:2026-03`) → date ISO effective.
   * Le créneau (slot) reste stable : pas de doublon OT.
   */
  visiteDateOverrides?: Record<string, string>
  dateDebut: string
  dateFin: string
  dureeLabel: string
  prixLabel: string
  prestations: string[]
  /** Corps du contrat (modifiable après préremplissage) */
  corps: string
  statut: StatutContrat
  signatureOperateurImage?: string
  signatureOperateurNom?: string
  signatureClientImage?: string
  signatureClientNom?: string
  signeAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export function nextNumeroContrat(
  list: Pick<ContratMaintenance, 'numero'>[],
  offset = 0,
): string {
  const year = new Date().getFullYear()
  const re = new RegExp(`^CM${year}(\\d{4})$`, 'i')
  let max = 0
  for (const c of list) {
    const m = re.exec((c.numero || '').trim())
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  return `CM${year}${String(max + 1 + Math.max(0, offset)).padStart(4, '0')}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function addYears(iso: string, years: number): string {
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}

export type FillContratContext = {
  operateur: { raisonSociale?: string; adresse?: string; siret?: string; telephone?: string }
  client: {
    raisonSociale?: string
    adresse?: string
    codePostal?: string
    ville?: string
    siret?: string
    telephone?: string
  }
  sites: { nom: string; ville?: string; adresse?: string }[]
}

export function fillCorpsContrat(
  modele: ModeleContratDef,
  ctx: FillContratContext,
  opts: { dureeLabel: string; prixLabel: string; periodicite: PeriodiciteContrat },
): string {
  const op = [
    ctx.operateur.raisonSociale,
    ctx.operateur.adresse,
    ctx.operateur.siret ? `SIRET ${ctx.operateur.siret}` : '',
    ctx.operateur.telephone,
  ]
    .filter(Boolean)
    .join(' — ')
  const cl = [
    ctx.client.raisonSociale,
    [ctx.client.adresse, ctx.client.codePostal, ctx.client.ville].filter(Boolean).join(', '),
    ctx.client.siret ? `SIRET ${ctx.client.siret}` : '',
    ctx.client.telephone,
  ]
    .filter(Boolean)
    .join(' — ')
  const sites =
    ctx.sites.length === 0
      ? '(sites à préciser)'
      : ctx.sites
          .map((s, i) => `${i + 1}. ${s.nom}${s.ville ? ` (${s.ville})` : ''}`)
          .join('\n')
  const prestations = modele.prestations.map((p) => `• ${p}`).join('\n')
  return modele.corpsType
    .replace(/\{\{operateur\}\}/g, op || '—')
    .replace(/\{\{client\}\}/g, cl || '—')
    .replace(/\{\{sites\}\}/g, sites)
    .replace(/\{\{periodicite\}\}/g, PERIODICITE_LABELS[opts.periodicite].toLowerCase())
    .replace(/\{\{duree\}\}/g, opts.dureeLabel || '1 an')
    .replace(/\{\{prix\}\}/g, opts.prixLabel || 'à convenir')
    .replace(/\{\{prestations\}\}/g, prestations)
}

export function createContratFromModele(
  modeleId: ModeleContratId,
  ctx: FillContratContext & { clientId: string; chantierIds: string[] },
  existing: Pick<ContratMaintenance, 'numero'>[],
): Omit<ContratMaintenance, 'id' | 'createdAt' | 'updatedAt'> {
  const modele = MODELES_CONTRAT.find((m) => m.id === modeleId) || MODELES_CONTRAT[0]
  const dateDebut = today()
  const dureeLabel = '1 an'
  const prixLabel = 'à convenir'
  return {
    numero: nextNumeroContrat(existing),
    modeleId: modele.id,
    titre: modele.titre,
    clientId: ctx.clientId,
    chantierIds: ctx.chantierIds,
    periodicite: modele.periodicite,
    famille: modele.famille,
    visitesParAn: modele.visitesParAn,
    secteur: modele.secteur,
    genererOtAuto: true,
    lignesEquipements: [],
    dateDebut,
    dateFin: addYears(dateDebut, 1),
    dureeLabel,
    prixLabel,
    prestations: [...modele.prestations],
    corps: fillCorpsContrat(modele, ctx, {
      dureeLabel,
      prixLabel,
      periodicite: modele.periodicite,
    }),
    statut: 'brouillon',
  }
}

/** Contrat actif (signé, non résilié / non expiré). */
export function isContratActif(c: Pick<ContratMaintenance, 'statut' | 'dateFin'>): boolean {
  if (c.statut === 'resilie' || c.statut === 'expire') return false
  if (c.statut === 'signe') {
    if (c.dateFin && c.dateFin < today()) return false
    return true
  }
  return false
}

export function contratsForClient(
  list: ContratMaintenance[] | undefined,
  clientId: string,
): ContratMaintenance[] {
  return (list || []).filter((c) => c.clientId === clientId)
}

export function contratsActifsForClient(
  list: ContratMaintenance[] | undefined,
  clientId: string,
): ContratMaintenance[] {
  return contratsForClient(list, clientId).filter(isContratActif)
}

export function resolveFamilleContrat(
  c: Pick<ContratMaintenance, 'famille' | 'modeleId'>,
): FamilleContrat {
  const parsed = parseFamilleContrat(c.famille)
  if (parsed) return parsed
  if (c.modeleId === 'chaufferie_12') return 'chaufferie'
  if (c.modeleId === 'cta_4') return 'cta'
  if (c.modeleId === 'controle_etancheite') return 'etancheite'
  if (c.modeleId === 'multi_sites') return 'mixte'
  return 'clim'
}

export function resolveVisitesParAn(
  c: Pick<ContratMaintenance, 'visitesParAn' | 'periodicite' | 'modeleId' | 'famille'>,
): VisitesParAn {
  const parsed = parseVisitesParAn(c.visitesParAn)
  if (parsed) return parsed
  if (c.modeleId === 'chaufferie_12') return 12
  if (c.modeleId === 'cta_4') return 4
  if (c.modeleId === 'annuelle_clim' || c.modeleId === 'semestrielle_clim') {
    return c.periodicite === 'annuelle' ? 1 : 2
  }
  if (c.periodicite === 'mensuelle') return 12
  if (c.periodicite === 'trimestrielle') return 4
  if (c.periodicite === 'semestrielle') return 2
  return 1
}

export function resolveSecteurContrat(
  c: Pick<ContratMaintenance, 'secteur' | 'famille' | 'modeleId'>,
): PostePersonnelId {
  const parsed = parsePostePersonnel(c.secteur)
  if (parsed && isSecteurOt(parsed)) return parsed
  const famille = resolveFamilleContrat(c)
  if (famille === 'etancheite') return 'tech_frigoriste'
  if (famille === 'mixte') return 'tech_multitechnique'
  return 'tech_cvc'
}

export function resolveGenererOtAuto(
  c: Pick<ContratMaintenance, 'genererOtAuto'>,
): boolean {
  return c.genererOtAuto !== false
}

/** Contrats signés couvrant ce site (ou tous les sites du client si chantierIds vide). */
export function contratsActifsForSite(
  list: ContratMaintenance[] | undefined,
  site: { id: string; clientId: string },
): ContratMaintenance[] {
  return (list || []).filter((c) => {
    if (!isContratActif(c) || c.clientId !== site.clientId) return false
    if (!c.chantierIds || c.chantierIds.length === 0) return true
    return c.chantierIds.includes(site.id)
  })
}
