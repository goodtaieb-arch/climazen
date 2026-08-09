import type {
  Client,
  FacturationAction,
  FacturationPlateforme,
  Operateur,
  Site,
} from './types'
import { FACTURATION_PLATEFORMES } from './types'

export type MakeFacturationPayload = {
  source: 'climazen'
  action: FacturationAction
  plateforme: FacturationPlateforme
  plateformeLabel: string
  sentAt: string
  operateur: {
    raisonSociale: string
    siret: string
    adresse: string
    telephone: string
    email: string
    attestationNumero: string
  }
  client: {
    id: string
    raisonSociale: string
    nomContact: string
    adresse: string
    codePostal: string
    ville: string
    telephone: string
    email: string
    siret: string
    notes: string
  }
  sites: {
    id: string
    nom: string
    adresse: string
    codePostal: string
    ville: string
  }[]
  /** Libellé libre pour le devis / facture Make */
  libelle?: string
  montantHt?: number
}

export type MakeFacturationResult = {
  ok: boolean
  /** Lien devis/facture si Make renvoie du JSON { devisLien, factureLien, url } */
  devisLien?: string
  factureLien?: string
  message?: string
}

function plateformeLabel(id: FacturationPlateforme) {
  return FACTURATION_PLATEFORMES.find((p) => p.id === id)?.label || id
}

export function buildMakeFacturationPayload(opts: {
  operateur: Operateur
  client: Client
  sites?: Site[]
  action?: FacturationAction
  libelle?: string
  montantHt?: number
}): MakeFacturationPayload {
  const plateforme = opts.operateur.facturationPlateforme || 'tiime'
  const action = opts.action || opts.operateur.facturationActionDefaut || 'create_devis'
  const sites = (opts.sites || []).filter((s) => s.clientId === opts.client.id)

  return {
    source: 'climazen',
    action,
    plateforme,
    plateformeLabel: plateformeLabel(plateforme),
    sentAt: new Date().toISOString(),
    operateur: {
      raisonSociale: opts.operateur.raisonSociale || '',
      siret: opts.operateur.siret || '',
      adresse: opts.operateur.adresse || '',
      telephone: opts.operateur.telephone || '',
      email: opts.operateur.email || '',
      attestationNumero: opts.operateur.attestationNumero || '',
    },
    client: {
      id: opts.client.id,
      raisonSociale: opts.client.raisonSociale || '',
      nomContact: opts.client.nomContact || '',
      adresse: opts.client.adresse || '',
      codePostal: opts.client.codePostal || '',
      ville: opts.client.ville || '',
      telephone: opts.client.telephone || '',
      email: opts.client.email || '',
      siret: opts.client.siret || '',
      notes: opts.client.notes || '',
    },
    sites: sites.map((s) => ({
      id: s.id,
      nom: s.nom,
      adresse: s.adresse,
      codePostal: s.codePostal,
      ville: s.ville,
    })),
    libelle: opts.libelle,
    montantHt: opts.montantHt,
  }
}

/**
 * Envoie le client ClimaZEN vers Make.com (webhook).
 * Make route ensuite vers Tiime / Pennylane / Sellsy… sans double saisie.
 */
export async function sendClientToMake(opts: {
  webhookUrl: string
  payload: MakeFacturationPayload
}): Promise<MakeFacturationResult> {
  const url = opts.webhookUrl.trim()
  if (!url) throw new Error('URL webhook Make non configurée (Mon entreprise).')
  if (!/^https:\/\//i.test(url)) throw new Error('L’URL webhook Make doit commencer par https://')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts.payload),
  })

  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    data = {}
  }

  if (!res.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : `Make a renvoyé une erreur (${res.status}).`,
    )
  }

  const devisLien =
    (typeof data.devisLien === 'string' && data.devisLien) ||
    (typeof data.quote_url === 'string' && data.quote_url) ||
    undefined
  const factureLien =
    (typeof data.factureLien === 'string' && data.factureLien) ||
    (typeof data.invoice_url === 'string' && data.invoice_url) ||
    (typeof data.url === 'string' && data.url) ||
    undefined

  return {
    ok: true,
    devisLien,
    factureLien,
    message:
      typeof data.message === 'string'
        ? data.message
        : `Envoyé vers Make → ${opts.payload.plateformeLabel}`,
  }
}
