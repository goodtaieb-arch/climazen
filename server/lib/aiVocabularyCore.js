/**
 * Extraction + apprentissage vocabulaire technique (froid / clim / CERFA).
 * Collecte UNIQUEMENT du jargon métier — jamais les données confidentielles brutes.
 * Partagé : OpenAI (site + accueil téléphone), tickets, e-mails, voix.
 */

import { supabaseRpc } from './supabaseServer.js'

/** @typedef {'gemini'|'openai'|'phone'|'email'|'ticket'|'voice'|'manual'|'seed'} AiVocabSource */

export const AI_LEARNING_INFO_FR =
  'ClimaZEN apprend uniquement le vocabulaire technique (PAC, R-32, CERFA…) pour mieux comprendre votre métier. Les données confidentielles (noms, téléphones, adresses, e-mails, SIRET…) ne sont pas enregistrées pour cet apprentissage.'

const FLUID_RE = /\bR[-\s]?(\d{2,3}[a-z]?)\b/gi
const FLUID_WORD_RE = /\b(erre|air)\s+(\d{3})\b/gi

const KEYWORD_TERMS = [
  { re: /\bCERFA\s*15497\b/i, canonical: 'CERFA 15497', domain: 'reglementaire' },
  { re: /\bCERFA\b/i, canonical: 'CERFA 15497', domain: 'reglementaire' },
  { re: /\bF[-\s]?Gas\b/i, canonical: 'F-Gas', domain: 'reglementaire' },
  { re: /\bPAC\b/i, canonical: 'PAC', domain: 'equipement' },
  { re: /\bVRV\b/i, canonical: 'VRV', domain: 'equipement' },
  { re: /\bCTA\b/i, canonical: 'CTA', domain: 'equipement' },
  { re: /\bVMC\b/i, canonical: 'VMC', domain: 'equipement' },
  { re: /\bGWP\b/i, canonical: 'GWP', domain: 'reglementaire' },
  { re: /\bA2L\b/i, canonical: 'A2L', domain: 'reglementaire' },
  { re: /\bmonobloc\b/i, canonical: 'monobloc', domain: 'equipement' },
  { re: /\bsplit\b/i, canonical: 'split', domain: 'equipement' },
  { re: /\bgroupe\s+froid\b/i, canonical: 'groupe froid', domain: 'equipement' },
  { re: /\bchambre\s+froide\b/i, canonical: 'chambre froide', domain: 'equipement' },
  { re: /\bcontr[oô]le\s+(?:d[''']?)?étanchéité\b/i, canonical: "contrôle d'étanchéité", domain: 'metier' },
  { re: /\bcharge\s+(de\s+)?fluide\b/i, canonical: 'charge fluide', domain: 'metier' },
  { re: /\bcompresseur\b/i, canonical: 'compresseur', domain: 'equipement' },
  { re: /\bd[ée]tendeur\b/i, canonical: 'détendeur', domain: 'equipement' },
  { re: /\béchangeur\b/i, canonical: 'échangeur', domain: 'equipement' },
  { re: /\b(?:OT|ordre\s+de\s+travail)\b/i, canonical: 'OT', domain: 'metier' },
  { re: /\bclim\b/i, canonical: 'climatisation', domain: 'metier' },
  { re: /\bpompe\s+[àa]\s+chaleur\b/i, canonical: 'PAC', domain: 'equipement' },
]

/**
 * Retire e-mails, tél, SIRET, adresses approximatives, civilités+noms
 * avant tout journal d’apprentissage.
 * @param {string} text
 */
export function anonymizeForLearning(text) {
  let out = String(text || '')
  if (!out.trim()) return ''

  out = out.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
  out = out.replace(
    /(?:\+33|0033|0)\s*[1-9](?:[\s./-]?\d{2}){4}|\+\d{1,3}[\s./-]?\d[\d\s./-]{6,14}\d/g,
    '[tel]',
  )
  out = out.replace(/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/g, '[siret]')
  out = out.replace(/\b\d{3}\s?\d{3}\s?\d{3}\b/g, '[siren]')
  out = out.replace(/\b\d{5}\b/g, '[cp]')
  out = out.replace(
    /\b\d{1,4}\s*(?:bis|ter)?\s*(?:rue|av\.?|avenue|bd|boulevard|impasse|all[ée]e|chemin|place|route)\s+[A-Za-zÀ-ÿ0-9'’\-]{1,40}(?:\s+[A-Za-zÀ-ÿ0-9'’\-]{1,40}){0,4}/gi,
    '[adresse]',
  )
  out = out.replace(
    /\b(?:m\.|mr|mme|madame|monsieur|mlle)\s+[A-Za-zÀ-ÿ'’\-]{2,40}(?:\s+[A-Za-zÀ-ÿ'’\-]{2,40})?/gi,
    '[client]',
  )
  out = out.replace(
    /\b(?:client|chez|pour)\s+[A-Za-zÀ-ÿ'’\-]{2,40}(?:\s+[A-Za-zÀ-ÿ'’\-]{2,40})?/gi,
    (m) => {
      const head = m.split(/\s+/)[0]
      return `${head} [client]`
    },
  )

  return out.replace(/\s{2,}/g, ' ').trim().slice(0, 4000)
}

/**
 * Métadonnées sans champs sensibles.
 * @param {object} [metadata]
 */
export function sanitizeLearningMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {}
  const allowed = ['intent', 'agent', 'source', 'urgent', 'termsFromModel', 'pathname', 'termsCount']
  /** @type {Record<string, unknown>} */
  const out = { anonymized: true }
  for (const k of allowed) {
    if (metadata[k] !== undefined) out[k] = metadata[k]
  }
  return out
}

/**
 * @param {string} text
 * @returns {Array<{ canonical: string, alias?: string, domain: string }>}
 */
export function extractTechnicalMentions(text) {
  const raw = String(text || '')
  if (!raw.trim()) return []

  /** @type {Map<string, { canonical: string, alias?: string, domain: string }>} */
  const found = new Map()

  const add = (canonical, alias, domain = 'metier') => {
    const key = canonical.toLowerCase()
    if (!found.has(key)) {
      found.set(key, { canonical, alias: alias && alias !== canonical ? alias : undefined, domain })
    } else if (alias && alias !== canonical) {
      const prev = found.get(key)
      if (!prev.alias) prev.alias = alias
    }
  }

  for (const m of raw.matchAll(FLUID_RE)) {
    const code = m[1].toUpperCase()
    const canonical = `R-${code.replace(/^R/i, '')}`
    add(canonical, m[0].trim(), 'fluide')
  }

  for (const m of raw.matchAll(FLUID_WORD_RE)) {
    const canonical = `R-${m[2]}`
    add(canonical, m[0].trim(), 'fluide')
  }

  for (const kw of KEYWORD_TERMS) {
    if (kw.re.test(raw)) {
      add(kw.canonical, undefined, kw.domain)
      kw.re.lastIndex = 0
    }
  }

  return [...found.values()]
}

/**
 * @param {string} before
 * @param {string} after
 */
export function extractCorrectionPair(before, after) {
  const b = String(before || '').trim()
  const a = String(after || '').trim()
  if (!b || !a || b === a) return null

  const termsBefore = extractTechnicalMentions(b)
  const termsAfter = extractTechnicalMentions(a)
  if (!termsAfter.length) return null

  const lastAfter = termsAfter[termsAfter.length - 1]
  const aliasFromBefore = termsBefore.find((t) => t.canonical !== lastAfter.canonical)
  if (aliasFromBefore) {
    return {
      canonical: lastAfter.canonical,
      alias: aliasFromBefore.alias || aliasFromBefore.canonical,
      domain: lastAfter.domain,
    }
  }

  const bWords = b.split(/\s+/).filter(Boolean)
  const aWords = a.split(/\s+/).filter(Boolean)
  if (bWords.length >= 2 && aWords.length >= 1) {
    const maybeAlias = bWords.slice(-3).join(' ')
    const maybeCanon = aWords.slice(-2).join(' ')
    const canonTerms = extractTechnicalMentions(maybeCanon)
    if (canonTerms.length) {
      return {
        canonical: canonTerms[0].canonical,
        alias: maybeAlias,
        domain: canonTerms[0].domain,
      }
    }
  }

  return null
}

/**
 * @param {string|null|undefined} orgId
 * @param {number} [limit]
 */
export async function fetchVocabularyContext(orgId, limit = 80) {
  if (!orgId) return ''
  try {
    const ctx = await supabaseRpc('get_ai_vocabulary_context', {
      p_org_id: orgId,
      p_limit: limit,
    })
    return typeof ctx === 'string' ? ctx : ''
  } catch (err) {
    console.warn('fetchVocabularyContext', err instanceof Error ? err.message : err)
    return ''
  }
}

/**
 * Apprend UNIQUEMENT les termes techniques. Le journal stocke une version anonymisée.
 * @param {object} opts
 * @param {string} opts.orgId
 * @param {string} opts.text
 * @param {AiVocabSource} opts.agent
 * @param {string} [opts.normalizedText]
 * @param {object} [opts.metadata]
 */
export async function learnFromText({ orgId, text, agent, normalizedText, metadata }) {
  if (!orgId || !text?.trim()) return { learned: 0, terms: [], anonymized: true }

  const mentions = extractTechnicalMentions(text)
  let learned = 0

  for (const m of mentions) {
    try {
      await supabaseRpc('learn_ai_technical_term', {
        p_org_id: orgId,
        p_canonical: m.canonical,
        p_domain: m.domain,
        p_definition: null,
        p_alias: m.alias || null,
        p_source: agent,
      })
      learned += 1
    } catch (err) {
      console.warn('learn_ai_technical_term', m.canonical, err instanceof Error ? err.message : err)
    }
  }

  const safeText = anonymizeForLearning(text)
  const safeNorm = anonymizeForLearning(normalizedText || normalizeTechnicalText(text))
  const journalText =
    mentions.length > 0
      ? `Vocabulaire: ${mentions.map((m) => m.canonical).join(', ')}. Contexte: ${safeText.slice(0, 500)}`
      : safeText
  const safeMeta = sanitizeLearningMetadata({
    ...(metadata || {}),
    termsCount: mentions.length,
  })

  try {
    await supabaseRpc('log_ai_agent_interaction', {
      p_org_id: orgId,
      p_agent: agent,
      p_raw_text: journalText.slice(0, 4000),
      p_normalized_text: (mentions.length ? journalText : safeNorm).slice(0, 4000),
      p_terms_found: mentions,
      p_metadata: safeMeta,
    })
  } catch (err) {
    console.warn('log_ai_agent_interaction', err instanceof Error ? err.message : err)
  }

  return { learned, terms: mentions, anonymized: true }
}

/**
 * @param {object} opts
 * @param {string} opts.orgId
 * @param {string} opts.before
 * @param {string} opts.after
 * @param {AiVocabSource} opts.agent
 */
export async function learnFromCorrection({ orgId, before, after, agent }) {
  const pair = extractCorrectionPair(before, after)
  if (!pair || !orgId) return null
  try {
    await supabaseRpc('learn_ai_technical_term', {
      p_org_id: orgId,
      p_canonical: pair.canonical,
      p_domain: pair.domain,
      p_definition: null,
      p_alias: pair.alias,
      p_source: agent,
    })
    return pair
  } catch (err) {
    console.warn('learnFromCorrection', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * @param {string} text
 */
export function normalizeTechnicalText(text) {
  let out = String(text || '')
  const replacements = [
    [/\bR\s*32\b/gi, 'R-32'],
    [/\bR\s*134\s*a?\b/gi, 'R-134a'],
    [/\bR\s*410\s*A?\b/gi, 'R-410A'],
    [/\bR\s*407\s*C?\b/gi, 'R-407C'],
    [/\bcerfa\b/gi, 'CERFA 15497'],
    [/\bpompe\s+[àa]\s+chaleur\b/gi, 'PAC'],
  ]
  for (const [re, rep] of replacements) {
    out = out.replace(re, rep)
  }
  return out
}
