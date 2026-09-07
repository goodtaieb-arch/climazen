/**
 * Intents main libre terrain : mes INT + pointage déplacement, réponses orales.
 * Les phrases libres non reconnues partent vers Lola (Aide IA) avec TTS.
 */

import { clientDisplayName, type AppData } from './types'
import {
  formatOtNumero,
  isOtCloture,
  techIdsOt,
  TYPE_OT_LABELS,
  type OrdreTravail,
} from './ordreTravail'
import { normalizeSpeechText } from './speech'
import type { PointageAction, PointageCible } from './pointage'

export type HandsFreeIntent =
  | { kind: 'mes_int' }
  | { kind: 'pointage'; action: PointageAction; cible?: PointageCible }
  | { kind: 'stop' }
  | { kind: 'lola' }

/** « Quelles interventions m’ont été affectées ? » etc. */
export function wantsMesInterventions(raw: string): boolean {
  const t = normalizeSpeechText(raw)
  if (!t) return false
  if (/\b(stop|arrete|silence|coupe le micro)\b/.test(t)) return false
  // Après normalize : « m'ont » → « m ont »
  if (
    /\bmes\s+(interventions|int|ot|di)\b/.test(t) ||
    /\b(interventions|int|ot)\s+(m\s+ont|me\s+sont|qui\s+m|affecte)/.test(t)
  ) {
    return true
  }
  if (
    /\bquelles?\s+(sont\s+)?(mes\s+)?(interventions|int|ot)\b/.test(t) &&
    /\b(affect|attribue|assigne|ouvertes?|aujourd|aujourdhui|pour\s+moi|a\s+moi|m\s+ont|me\s+sont)\b/.test(
      t,
    )
  ) {
    return true
  }
  if (
    /\b(liste|montre|dis|donne)\b/.test(t) &&
    /\bmes\s+(interventions|int|ot)\b/.test(t)
  ) {
    return true
  }
  // « quelles interventions » sans autre contexte métier → mes INT (main libre tech)
  if (
    /\bquelles?\s+(sont\s+)?(les\s+)?(interventions|int|ot)\b/.test(t) &&
    /\b(affect|attribue|assigne|m\s+ont|pour\s+moi)\b/.test(t)
  ) {
    return true
  }
  return false
}

export function wantsStopListening(raw: string): boolean {
  const t = normalizeSpeechText(raw)
  return (
    /\b(stop|arrete|arrête|silence|coupe)\b/.test(t) &&
    /\b(ecoute|écoute|micro|main\s+libre|voix|toi)\b/.test(t)
  ) ||
    /^(stop|arrete|arrête|silence)$/.test(t)
}

/**
 * Pointage oral : déplacement site / fournisseur / bureau, en cours, trajet…
 */
export function parsePointageVoiceIntent(
  raw: string,
): { action: PointageAction; cible?: PointageCible } | null {
  const t = normalizeSpeechText(raw)
  if (!t) return null

  if (
    /\b(fin\s+de\s+journee|fin\s+de\s+journée|arrive\s+(a|à)\s+la\s+maison|je\s+suis\s+(rentre|rentré|arrive|arrivé)\s+(chez|a\s+la\s+maison))\b/.test(
      t,
    )
  ) {
    return { action: 'fin_journee' }
  }
  if (/\b(retour\s+(domicile|maison)|trajet\s+fin|je\s+rentre)\b/.test(t)) {
    return { action: 'retour_domicile', cible: 'domicile' }
  }
  if (
    /\b(sortie\s+(domicile|maison)|trajet\s+debut|trajet\s+début|je\s+pars\s+(du\s+)?(domicile|maison))\b/.test(
      t,
    )
  ) {
    return { action: 'sortie_domicile', cible: 'domicile' }
  }
  if (
    /\b(intervention\s+en\s+cours|je\s+suis\s+(arrive|arrivé)|arrive\s+sur\s+(site|chantier)|commence\s+(l['’])?intervention)\b/.test(
      t,
    )
  ) {
    return { action: 'intervention_en_cours', cible: 'ot' }
  }
  if (/\bpause\s+repas\b/.test(t)) return { action: 'pause_repas' }
  if (/\b(pause|je\s+fais\s+une\s+pause)\b/.test(t) && !/\brepas\b/.test(t)) {
    return { action: 'pause' }
  }

  const deplacement =
    /\b(deplacement|déplacement|en\s+route|je\s+(pars|roule)|mets?\s*-?\s*moi\s+(en\s+)?deplacement|mettre\s+en\s+deplacement)\b/.test(
      t,
    ) || /\ben\s+deplacement\b/.test(t)
  if (!deplacement) return null

  if (/\bfournisseur\b/.test(t)) return { action: 'deplacement', cible: 'fournisseur' }
  if (/\b(bureau|atelier)\b/.test(t)) return { action: 'deplacement', cible: 'bureau' }
  if (/\bhors\s+(int|ot|intervention)\b/.test(t)) {
    return { action: 'deplacement', cible: 'hors_ot' }
  }
  // Par défaut : vers le site / INT
  return { action: 'deplacement', cible: 'ot' }
}

export function parseHandsFreeIntent(raw: string): HandsFreeIntent {
  if (wantsStopListening(raw)) return { kind: 'stop' }
  if (wantsMesInterventions(raw)) return { kind: 'mes_int' }
  const punch = parsePointageVoiceIntent(raw)
  if (punch) return { kind: 'pointage', ...punch }
  return { kind: 'lola' }
}

export function interventionsAffecteesAuTech(
  data: AppData,
  userId: string | undefined | null,
): OrdreTravail[] {
  if (!userId) return []
  return (data.ordresTravail || [])
    .filter((o) => !isOtCloture(o.statut) && techIdsOt(o).includes(userId))
    .sort(
      (a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        (a.heure || '').localeCompare(b.heure || '') ||
        (a.numero || '').localeCompare(b.numero || ''),
    )
}

/** Phrase orale courte pour le tech au volant. */
export function parlerMesInterventions(
  data: AppData,
  userId: string | undefined | null,
): string {
  const list = interventionsAffecteesAuTech(data, userId)
  if (!list.length) {
    return 'Tu n’as aucune intervention ouverte affectée pour le moment.'
  }
  const parts = list.slice(0, 5).map((o, i) => {
    const site = data.chantiers?.find((s) => s.id === o.chantierId)
    const client = data.clients?.find((c) => c.id === o.clientId)
    const where =
      [client ? clientDisplayName(client) : '', site?.nom || site?.ville]
        .filter(Boolean)
        .join(', ') || 'lieu à préciser'
    const type = TYPE_OT_LABELS[o.typeOt] || 'intervention'
    const heure = (o.heure || '').slice(0, 5)
    return `${i + 1}. ${formatOtNumero(o.numero)}, ${type}${heure ? ` à ${heure.replace(':', ' heures ')}` : ''}, chez ${where}`
  })
  const more = list.length > 5 ? ` Et ${list.length - 5} de plus.` : ''
  return `Tu as ${list.length} intervention${list.length > 1 ? 's' : ''} affectée${list.length > 1 ? 's' : ''}. ${parts.join('. ')}.${more}`
}

export function parlerPointageConfirme(
  action: PointageAction,
  cible?: PointageCible,
): string {
  if (action === 'deplacement') {
    if (cible === 'fournisseur') return 'OK. Tu es en déplacement vers le fournisseur.'
    if (cible === 'bureau') return 'OK. Tu es en déplacement vers le bureau.'
    if (cible === 'hors_ot') return 'OK. Déplacement hors intervention enregistré.'
    return 'OK. Tu es en déplacement vers le site.'
  }
  if (action === 'intervention_en_cours') return 'OK. Intervention en cours.'
  if (action === 'sortie_domicile') return 'OK. Trajet début de journée.'
  if (action === 'retour_domicile') return 'OK. Trajet de retour.'
  if (action === 'fin_journee') return 'OK. Journée terminée. Bonne route.'
  if (action === 'pause_repas') return 'OK. Pause repas.'
  if (action === 'pause') return 'OK. Pause.'
  return 'OK. Pointage enregistré.'
}

/** INT ouverte la plus pertinente pour un déplacement site (aujourd’hui d’abord). */
export function choisirOtPourDeplacement(
  data: AppData,
  userId: string | undefined | null,
  todayIso: string,
): OrdreTravail | null {
  const list = interventionsAffecteesAuTech(data, userId)
  if (!list.length) return null
  const today = list.filter((o) => (o.date || '').slice(0, 10) === todayIso)
  const pool = today.length ? today : list
  const withHeure = pool.filter((o) => o.heure)
  if (withHeure.length) {
    return [...withHeure].sort((a, b) => (a.heure || '').localeCompare(b.heure || ''))[0]
  }
  return pool[0]
}
