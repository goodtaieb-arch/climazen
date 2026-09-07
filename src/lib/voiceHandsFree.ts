/**
 * Intents main libre terrain : mes INT + toutes les actions pointeuse du tech.
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
import {
  normaliserAction,
  eventsDuJour,
  type PointageAction,
  type PointageCible,
  type PointageEvent,
} from './pointage'

export type HandsFreeIntent =
  | { kind: 'mes_int' }
  | { kind: 'pointage'; action: PointageAction; cible?: PointageCible }
  | { kind: 'aide_pointage' }
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
    (/\b(stop|arrete|arrête|silence|coupe)\b/.test(t) &&
      /\b(ecoute|écoute|micro|main\s+libre|voix|toi)\b/.test(t)) ||
    /^(stop|arrete|arrête|silence)$/.test(t)
  )
}

export function wantsAidePointage(raw: string): boolean {
  const t = normalizeSpeechText(raw)
  return (
    /\b(que\s+puis[- ]je|quoi\s+dire|aide\s+(pointage|pointeuse)|commandes?\s+(pointage|vocales?)|que\s+je\s+peux\s+(dire|pointer))\b/.test(
      t,
    ) || /\bcomment\s+(pointer|faire\s+(une\s+)?pause)\b/.test(t)
  )
}

/** Phrases d’aide lues à voix haute. */
export const AIDE_POINTAGE_VOIX = [
  'Tu peux dire : mets-moi en déplacement vers le site.',
  'Je suis arrivé, ou mets-moi en cours d’intervention.',
  'Pause, ou pause repas — puis arrête la pause pour reprendre.',
  'Fin d’intervention, fournisseur, bureau, trajet début, trajet fin, fin de journée.',
  'Ou demande : quelles interventions m’ont été affectées ?',
].join(' ')

/**
 * Pointage oral — même palette que les boutons manuels du tech.
 * Ordre important : fin de pause avant démarrage pause.
 */
export function parsePointageVoiceIntent(
  raw: string,
): { action: PointageAction; cible?: PointageCible } | null {
  const t = normalizeSpeechText(raw)
  if (!t) return null

  // —— Fin / reprise de pause (avant « pause » tout court)
  if (
    /\b(arrete|arreter|stop|fin|termine|terminer|coupe)\b.{0,24}\bpause\b/.test(t) ||
    /\bpause\b.{0,16}\b(finie|terminee|stop|arretee)\b/.test(t) ||
    /\b(reprend|reprendre|reprise)\b.{0,20}\b(pause|int|intervention|travail|cours)\b/.test(t) ||
    /\breprend(s|re)?\s+(l[e' ]*)?(int|intervention)\b/.test(t)
  ) {
    return { action: 'intervention_en_cours', cible: 'ot' }
  }

  // —— Intervention en cours / arrivée / mets-moi en cours
  if (
    /\b(intervention\s+)?en\s+cours(\s+d?\s*intervention)?\b/.test(t) ||
    /\bmets?\s*-?\s*moi\s+en\s+(cours|intervention)\b/.test(t) ||
    /\b(mettre|met)\s+en\s+(cours|intervention)\b/.test(t) ||
    /\bje\s+suis\s+(arrive|arrivee)\b/.test(t) ||
    /\barrive\s+sur\s+(le\s+)?(site|chantier)\b/.test(t) ||
    /\bcommence\s+(l[e' ]*)?(intervention|int)\b/.test(t) ||
    /\bje\s+commence(\s+l[e' ]*intervention)?\b/.test(t) ||
    /\bentree\s+(sur\s+)?(site|chantier|int)\b/.test(t)
  ) {
    return { action: 'intervention_en_cours', cible: 'ot' }
  }

  // —— Fin d’intervention
  if (
    /\bfin\s+(d[e' ]*)?(intervention|int)\b/.test(t) ||
    /\b(intervention|int)\s+(terminee|finie|cloturee)\b/.test(t) ||
    /\bj[e']?\s*(ai\s+)?fini(\s+l[e' ]*intervention)?\b/.test(t) ||
    /\bje\s+quitte\s+(le\s+)?(site|chantier)\b/.test(t)
  ) {
    return { action: 'fin_intervention' }
  }

  // —— Pause repas (avant pause simple)
  if (
    /\bpause\s*(repas|dej|dejeuner|midi)\b/.test(t) ||
    /\b(repas|dejeuner)\b.{0,12}\bpause\b/.test(t)
  ) {
    return { action: 'pause_repas' }
  }

  // —— Pause (déclenche / lance / mets-moi en pause)
  if (
    /\b(declenche|lance|demarre|start)\b.{0,12}\bpause\b/.test(t) ||
    /\bmets?\s*-?\s*moi\s+en\s+pause\b/.test(t) ||
    /\b(mettre|met)\s+en\s+pause\b/.test(t) ||
    /\bje\s+fais\s+une\s+pause\b/.test(t) ||
    /\bpause\b/.test(t)
  ) {
    return { action: 'pause' }
  }

  // —— Fin de journée / trajet domicile
  if (
    /\b(fin\s+de\s+journee|arrive\s+(a\s+)?(la\s+)?maison|je\s+suis\s+(rentre|arrive)\s+(chez|a\s+la\s+maison))\b/.test(
      t,
    )
  ) {
    return { action: 'fin_journee' }
  }
  if (/\b(retour\s+(domicile|maison)|trajet\s+fin|je\s+rentre)\b/.test(t)) {
    return { action: 'retour_domicile', cible: 'domicile' }
  }
  if (
    /\b(sortie\s+(domicile|maison)|trajet\s+debut|je\s+pars\s+(du\s+)?(domicile|maison)|debut\s+de\s+journee)\b/.test(
      t,
    )
  ) {
    return { action: 'sortie_domicile', cible: 'domicile' }
  }

  // —— Fournisseur / bureau (actions hors OT, comme les boutons manuels)
  if (/\b(chez\s+(le\s+)?)?fournisseur\b/.test(t) && !/\bdeplacement\b/.test(t)) {
    return { action: 'fournisseur' }
  }
  if (/\b(bureau|atelier)\b/.test(t) && !/\bdeplacement\b/.test(t) && !/\ben\s+route\b/.test(t)) {
    return { action: 'bureau' }
  }

  // —— Déplacement
  const deplacement =
    /\b(deplacement|en\s+route|je\s+(pars|roule)|mets?\s*-?\s*moi\s+(en\s+)?deplacement|mettre\s+en\s+deplacement|en\s+deplacement)\b/.test(
      t,
    )
  if (deplacement) {
    if (/\bfournisseur\b/.test(t)) return { action: 'deplacement', cible: 'fournisseur' }
    if (/\b(bureau|atelier)\b/.test(t)) return { action: 'deplacement', cible: 'bureau' }
    if (/\bhors\s+(int|ot|intervention)\b/.test(t)) {
      return { action: 'deplacement', cible: 'hors_ot' }
    }
    return { action: 'deplacement', cible: 'ot' }
  }

  // Fournisseur / bureau après « en route chez… »
  if (/\ben\s+route\b.{0,20}\bfournisseur\b/.test(t)) {
    return { action: 'deplacement', cible: 'fournisseur' }
  }
  if (/\ben\s+route\b.{0,20}\b(bureau|atelier|site|chantier)\b/.test(t)) {
    const cible: PointageCible = /\b(bureau|atelier)\b/.test(t) ? 'bureau' : 'ot'
    return { action: 'deplacement', cible }
  }

  return null
}

export function parseHandsFreeIntent(raw: string): HandsFreeIntent {
  if (wantsStopListening(raw)) return { kind: 'stop' }
  if (wantsAidePointage(raw)) return { kind: 'aide_pointage' }
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
  if (action === 'fin_intervention') return 'OK. Fin d’intervention enregistrée.'
  if (action === 'sortie_domicile') return 'OK. Trajet début de journée.'
  if (action === 'retour_domicile') return 'OK. Trajet de retour.'
  if (action === 'fin_journee') return 'OK. Journée terminée. Bonne route.'
  if (action === 'pause_repas') return 'OK. Pause repas.'
  if (action === 'pause') return 'OK. Pause.'
  if (action === 'fournisseur') return 'OK. Chez le fournisseur.'
  if (action === 'bureau') return 'OK. Bureau / atelier.'
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

/**
 * OT à reprendre après pause / pause repas, ou dernière INT pointée.
 */
export function otIdDepuisDernierPointage(
  events: PointageEvent[],
  opts: { userId: string; date: string },
  last?: PointageEvent,
): { otId: string; chantierId?: string } | undefined {
  const cur = last
  if (cur?.otId) {
    const n = normaliserAction(cur.action)
    if (
      n === 'pause' ||
      n === 'pause_repas' ||
      n === 'intervention_en_cours' ||
      n === 'deplacement' ||
      n === 'fin_intervention'
    ) {
      return { otId: cur.otId, chantierId: cur.chantierId }
    }
  }
  const list = eventsDuJour(events, opts)
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]
    const en = normaliserAction(e.action)
    if (en === 'fin_journee' || en === 'retour_domicile') break
    if (
      e.otId &&
      (en === 'intervention_en_cours' ||
        en === 'deplacement' ||
        en === 'pause' ||
        en === 'pause_repas')
    ) {
      return { otId: e.otId, chantierId: e.chantierId }
    }
  }
  return undefined
}
