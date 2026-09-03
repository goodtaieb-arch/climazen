/**
 * Carnet contacts société — fournisseurs habituels, centres de formation, sous-traitants.
 * Pour appeler / e-mail (devis, commande…) depuis l’app ou Lola.
 */

export type ContactCarnetType =
  | 'fournisseur'
  | 'centre_formation'
  | 'sous_traitant'
  | 'autre'

export const CONTACT_CARNET_TYPE_LABELS: Record<ContactCarnetType, string> = {
  fournisseur: 'Fournisseur',
  centre_formation: 'Centre de formation',
  sous_traitant: 'Sous-traitant',
  autre: 'Autre contact',
}

export type ContactCarnet = {
  id: string
  type: ContactCarnetType
  /** Raison sociale / nom du centre / enseigne */
  nom: string
  /** Personne à joindre */
  nomContact?: string
  telephone: string
  email: string
  adresse?: string
  codePostal?: string
  ville?: string
  /** Spécialité (fluides, filtres, SST, frigoriste…) */
  specialite?: string
  notes?: string
  /** Favori = apparaît en premier */
  favori?: boolean
  createdAt: string
  updatedAt: string
}

export function blankContactCarnet(
  type: ContactCarnetType = 'fournisseur',
): Omit<ContactCarnet, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    type,
    nom: '',
    nomContact: '',
    telephone: '',
    email: '',
    adresse: '',
    codePostal: '',
    ville: '',
    specialite: '',
    notes: '',
    favori: false,
  }
}

export function parseContactCarnetType(raw: unknown): ContactCarnetType {
  const v = String(raw || '').trim()
  if (v in CONTACT_CARNET_TYPE_LABELS) return v as ContactCarnetType
  return 'autre'
}

export function contactCarnetDisplayName(c: Pick<ContactCarnet, 'nom' | 'nomContact'>): string {
  const nom = (c.nom || '').trim()
  const contact = (c.nomContact || '').trim()
  if (nom && contact) return `${nom} (${contact})`
  return nom || contact || 'Contact'
}

export function telHrefContact(raw?: string): string | null {
  const n = (raw || '').replace(/[\s.()/-]/g, '')
  if (!n) return null
  return `tel:${n}`
}

export function mailtoHrefContact(
  email?: string,
  opts?: { subject?: string; body?: string },
): string | null {
  const e = (email || '').trim()
  if (!e || !e.includes('@')) return null
  const q = new URLSearchParams()
  if (opts?.subject) q.set('subject', opts.subject)
  if (opts?.body) q.set('body', opts.body)
  const qs = q.toString()
  return qs ? `mailto:${e}?${qs}` : `mailto:${e}`
}

/** Sujets d’e-mail prêts à l’emploi (devis / commande / formation…). */
export function mailPresetsPourContact(c: Pick<ContactCarnet, 'type' | 'nom'>): {
  id: string
  label: string
  subject: string
  body: string
}[] {
  const nom = (c.nom || 'votre société').trim()
  if (c.type === 'centre_formation') {
    return [
      {
        id: 'devis_formation',
        label: 'Demande de devis formation',
        subject: `Demande de devis formation — ${nom}`,
        body: `Bonjour,\n\nNous souhaitons un devis pour une formation.\nMerci de nous rappeler.\n\nCordialement`,
      },
      {
        id: 'info',
        label: 'Demande d’information',
        subject: `Information — ${nom}`,
        body: `Bonjour,\n\nPourriez-vous nous indiquer vos prochaines sessions ?\n\nCordialement`,
      },
    ]
  }
  if (c.type === 'sous_traitant') {
    return [
      {
        id: 'demande_interv',
        label: 'Demande d’intervention',
        subject: `Demande d’intervention — ${nom}`,
        body: `Bonjour,\n\nNous aurions besoin de votre intervention.\nMerci de nous confirmer dispo et tarif.\n\nCordialement`,
      },
      {
        id: 'devis',
        label: 'Demande de devis',
        subject: `Demande de devis — ${nom}`,
        body: `Bonjour,\n\nMerci de nous établir un devis pour…\n\nCordialement`,
      },
    ]
  }
  // fournisseur / autre
  return [
    {
      id: 'devis',
      label: 'Demande de devis',
      subject: `Demande de devis — ${nom}`,
      body: `Bonjour,\n\nMerci de nous établir un devis pour la pièce / matériel suivant :\n- Référence :\n- Quantité :\n\nCordialement`,
    },
    {
      id: 'commande',
      label: 'Commande / confirmation',
      subject: `Commande — ${nom}`,
      body: `Bonjour,\n\nMerci de bien vouloir enregistrer la commande suivante :\n- Référence :\n- Quantité :\n\nCordialement`,
    },
    {
      id: 'dispo',
      label: 'Dispo / délai',
      subject: `Disponibilité — ${nom}`,
      body: `Bonjour,\n\nPouvez-vous nous confirmer la disponibilité et le délai pour…\n\nCordialement`,
    },
  ]
}

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function scoreContactMatch(c: ContactCarnet, query: string): number {
  const q = normalize(query)
  if (!q) return 0
  const hay = normalize(
    [c.nom, c.nomContact, c.specialite, c.ville, CONTACT_CARNET_TYPE_LABELS[c.type], c.notes]
      .filter(Boolean)
      .join(' '),
  )
  if (!hay) return 0
  if (hay === q) return 100
  if (hay.includes(q)) return 85
  const parts = q.split(/\s+/).filter((p) => p.length >= 2)
  if (!parts.length) return 0
  const hits = parts.filter((p) => hay.includes(p)).length
  return Math.round((hits / parts.length) * 70)
}

export function findContactsCarnet(
  list: ContactCarnet[] | undefined,
  query: string,
  opts?: { type?: ContactCarnetType; limit?: number },
): ContactCarnet[] {
  const scored = (list || [])
    .filter((c) => !opts?.type || c.type === opts.type)
    .map((c) => ({ c, score: scoreContactMatch(c, query) }))
    .filter((x) => (query.trim() ? x.score >= 40 : true))
    .sort((a, b) => {
      if (Boolean(a.c.favori) !== Boolean(b.c.favori)) return a.c.favori ? -1 : 1
      return b.score - a.score || a.c.nom.localeCompare(b.c.nom, 'fr')
    })
  return scored.slice(0, opts?.limit ?? 20).map((x) => x.c)
}

export function wantsCarnetContactQuery(raw: string): boolean {
  const n = normalize(raw)
  if (!n) return false
  const ask =
    /\b(contact|telephone|tel|mail|email|appeler|appelle|joindre|ecrire|fournisseur|sous[- ]?trait\w*|formation|carnet|annuaire)\b/.test(
      n,
    )
  if (!ask) return false
  return (
    /\b(fournisseur|sous[- ]?trait\w*|formation|daikin|mitsubishi|contact|tel|telephone|mail|email|devis|commande)\b/.test(
      n,
    ) || /\b(qui|quel|trouve|cherche|donne)\b/.test(n)
  )
}

export function answerCarnetContactQuery(
  list: ContactCarnet[] | undefined,
  raw: string,
): string {
  const n = normalize(raw)
  let type: ContactCarnetType | undefined
  if (/\bfournisseur/.test(n)) type = 'fournisseur'
  else if (/\bsous[- ]?trait/.test(n)) type = 'sous_traitant'
  else if (/\bformation/.test(n)) type = 'centre_formation'

  const q = n
    .replace(
      /\b(contact|telephone|tel|mail|email|appeler|appelle|joindre|ecrire|fournisseur|sous[- ]?trait\w*|centre de formation|formation|carnet|annuaire|de|du|des|le|la|les|pour|qui|quel|trouve|cherche|donne|moi)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()

  // Si on a un type (ex. « téléphone sous-traitant ») sans nom précis → lister ce type.
  const hits = findContactsCarnet(list, q, { type, limit: 8 })
  if (!hits.length) {
    return [
      `Aucun contact trouvé dans le carnet${type ? ` (${CONTACT_CARNET_TYPE_LABELS[type]})` : ''}.`,
      `Ajoutez-les dans Carnet (/app/carnet) : fournisseurs, centres de formation, sous-traitants.`,
      `Ensuite : « contact Daikin », « téléphone sous-traitant », « mail formation ».`,
    ].join('\n')
  }

  const lines = [`Carnet contacts${type ? ` — ${CONTACT_CARNET_TYPE_LABELS[type]}` : ''} :`, ``]
  for (const c of hits) {
    const bits = [
      CONTACT_CARNET_TYPE_LABELS[c.type],
      c.telephone ? `☎ ${c.telephone}` : null,
      c.email ? `✉ ${c.email}` : null,
      c.specialite || null,
    ].filter(Boolean)
    lines.push(`• ${contactCarnetDisplayName(c)} — ${bits.join(' · ')}`)
  }
  lines.push(
    ``,
    `Ouvrez /app/carnet pour appeler ou envoyer un e-mail (devis / commande).`,
  )
  return lines.join('\n')
}

/** Contexte Lola / OpenAI. */
export function buildCarnetContactsCatalog(
  list: ContactCarnet[] | undefined,
  max = 40,
): string {
  const items = [...(list || [])]
    .sort((a, b) => {
      if (Boolean(a.favori) !== Boolean(b.favori)) return a.favori ? -1 : 1
      return a.nom.localeCompare(b.nom, 'fr')
    })
    .slice(0, max)
  const lines = [
    'Carnet contacts société (fournisseurs, formation, sous-traitants) — pour appeler / e-mail devis ou commande :',
  ]
  if (!items.length) {
    lines.push('• (carnet vide — à remplir dans /app/carnet)')
    return lines.join('\n')
  }
  for (const c of items) {
    lines.push(
      `• [${CONTACT_CARNET_TYPE_LABELS[c.type]}] ${c.nom}${
        c.nomContact ? ` / ${c.nomContact}` : ''
      } · tel=${c.telephone || '—'} · mail=${c.email || '—'}${
        c.specialite ? ` · ${c.specialite}` : ''
      }`,
    )
  }
  return lines.join('\n')
}
