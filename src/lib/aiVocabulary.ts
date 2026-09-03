/**
 * Vocabulaire technique IA — client (apprentissage Supabase partagé Gemini + OpenAI).
 */

import { getSupabase, isSupabaseConfigured } from './supabase'

export type AiVocabAgent = 'gemini' | 'phone' | 'email' | 'ticket' | 'voice'

async function authHeaders(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {}
  try {
    const sb = getSupabase()
    const { data } = await sb.auth.getSession()
    const token = data.session?.access_token
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

/** Enregistre mentions techniques (fire-and-forget). */
export async function learnAiVocabulary(opts: {
  organizationId: string
  text: string
  agent: AiVocabAgent
  normalizedText?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  if (!opts.text.trim() || !opts.organizationId) return
  try {
    const headers = await authHeaders()
    if (!headers.Authorization) return
    await fetch('/api/ai-vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        action: 'learn',
        organizationId: opts.organizationId,
        text: opts.text,
        agent: opts.agent,
        normalizedText: opts.normalizedText,
        metadata: opts.metadata,
      }),
    })
  } catch {
    /* best effort */
  }
}

/** Apprend alias après correction vocale (« non plutôt R-32 »). */
export async function learnAiVocabularyCorrection(opts: {
  organizationId: string
  before: string
  after: string
  agent?: AiVocabAgent
}): Promise<void> {
  if (!opts.before.trim() || !opts.after.trim() || !opts.organizationId) return
  try {
    const headers = await authHeaders()
    if (!headers.Authorization) return
    await fetch('/api/ai-vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        action: 'correction',
        organizationId: opts.organizationId,
        before: opts.before,
        after: opts.after,
        agent: opts.agent || 'voice',
      }),
    })
  } catch {
    /* best effort */
  }
}

export type PhoneReceptionResult = {
  ok: boolean
  reply?: string
  intent?: string
  urgent?: boolean
  technicalSummary?: string
  suggestedOt?: {
    action?: string
    localisation?: string
    clientHint?: string
    siteHint?: string
    equipements?: string[]
  }
  termsDetected?: string[]
  normalized?: string
  hint?: string
  error?: string
}

/** Agent d’accueil téléphonique OpenAI — analyse transcription. */
export async function analyzePhoneReception(opts: {
  transcript: string
  callerContext?: string
}): Promise<PhoneReceptionResult> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    return { ok: false, error: 'session_required', hint: 'Connectez-vous pour utiliser l’agent téléphone.' }
  }
  const res = await fetch('/api/phone-reception', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      transcript: opts.transcript,
      callerContext: opts.callerContext,
      learn: true,
    }),
  })
  const data = (await res.json()) as PhoneReceptionResult
  if (!res.ok) {
    return { ok: false, error: data.error || `http_${res.status}`, hint: data.hint }
  }
  return data
}
