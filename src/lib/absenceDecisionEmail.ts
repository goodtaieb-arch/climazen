/** Envoi auto du PDF de décision d'absence (validée/refusée) au salarié — via ClimaZEN (Resend). */

import { getSupabase, isSupabaseConfigured } from './supabase'
import { absencePdfFileName } from './absencePdf'
import { ABSENCE_TYPE_LABELS, type DemandeAbsence } from './demandesAbsence'

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function sendAbsenceDecisionEmailViaClimazen(opts: {
  to: string
  demande: DemandeAbsence
  pdf: Blob
  decidedByName?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = opts.to.trim()
  if (!to) return { ok: false, error: 'Pas d’e-mail salarié.' }
  if (opts.demande.statut !== 'validee' && opts.demande.statut !== 'refusee') {
    return { ok: false, error: 'Statut de demande invalide.' }
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Connexion cloud requise.' }
  }
  try {
    const sb = getSupabase()
    const { data: sessionData } = await sb.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return { ok: false, error: 'Session expirée — reconnectez-vous.' }

    const pdfBase64 = await blobToBase64(opts.pdf)

    const res = await fetch('/api/send-absence-decision-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        statut: opts.demande.statut,
        technicienName: opts.demande.technicienName || '',
        dateDebut: opts.demande.dateDebut,
        dateFin: opts.demande.dateFin,
        typeLabel: ABSENCE_TYPE_LABELS[opts.demande.type] || opts.demande.type,
        motifRefus: opts.demande.motifRefus || '',
        decidedByName: opts.decidedByName || opts.demande.decidedByName || '',
        pdfBase64,
        fileName: absencePdfFileName(opts.demande),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; hint?: string; error?: string }
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error:
          data.hint ||
          data.error ||
          (res.status === 503 ? 'Envoi ClimaZEN non configuré (RESEND_API_KEY sur Vercel).' : `Envoi impossible (${res.status}).`),
      }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Envoi impossible.' }
  }
}
