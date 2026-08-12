/** Contrats de maintenance clim — modèles types auto-remplis, modifiables, signables. */

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
  | 'controle_etancheite'
  | 'multi_sites'

export interface ModeleContratDef {
  id: ModeleContratId
  titre: string
  resume: string
  periodicite: PeriodiciteContrat
  /** Corps type — placeholders {{operateur}}, {{client}}, {{sites}}, {{periodicite}}, {{duree}} */
  corpsType: string
  prestations: string[]
}

export const MODELES_CONTRAT: ModeleContratDef[] = [
  {
    id: 'annuelle_clim',
    titre: 'Contrat maintenance annuelle clim / PAC',
    resume: '1 visite / an · entretien + contrôle d’étanchéité',
    periodicite: 'annuelle',
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
    titre: 'Contrat maintenance semestrielle',
    resume: '2 visites / an · sites exigeants (resto, froid alimentaire…)',
    periodicite: 'semestrielle',
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

Les interventions donnent lieu à un ordre de travail (OT) et, le cas échéant, à un CERFA.
`,
  },
  {
    id: 'controle_etancheite',
    titre: 'Contrat contrôle d’étanchéité périodique',
    resume: 'Focus F-Gas · contrôles réglementaires planifiés',
    periodicite: 'annuelle',
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
    resume: 'Un client, plusieurs sites — même cadre contractuel',
    periodicite: 'annuelle',
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

Chaque intervention fait l’objet d’un OT ClimaZEN et des documents réglementaires associés.
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
