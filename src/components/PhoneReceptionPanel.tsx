import { useState } from 'react'
import { Loader2, Phone, Sparkles } from 'lucide-react'
import { analyzePhoneReception } from '../lib/aiVocabulary'
import { VoiceDictationButton } from './VoiceDictationButton'

type Props = {
  onApplyOtAction?: (action: string, localisation?: string) => void
}

/**
 * Agent d’accueil téléphonique (OpenAI) — analyse transcription et apprend le vocabulaire Supabase.
 */
export function PhoneReceptionPanel({ onApplyOtAction }: Props) {
  const [transcript, setTranscript] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyzePhoneReception>> | null>(
    null,
  )
  const [error, setError] = useState('')

  const analyze = async () => {
    const text = transcript.trim()
    if (!text || busy) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await analyzePhoneReception({ transcript: text })
      if (!res.ok) {
        setError(res.hint || res.error || 'Analyse impossible.')
        return
      }
      setResult(res)
    } catch {
      setError('Analyse impossible pour le moment.')
    } finally {
      setBusy(false)
    }
  }

  const suggested = result?.suggestedOt

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white">
          <Phone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-indigo-950">
            Agent accueil téléphone (OpenAI)
          </h2>
          <p className="mt-0.5 text-xs text-indigo-900/80">
            Collez ou dictez la transcription — l’IA repère le jargon (PAC, R-32, CERFA…) et
            mémorise les termes dans Supabase (partagé avec l’assistant site, même clé OpenAI).
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
          placeholder="Ex. « Bonjour, clim monobloc R-32 en panne au RDC, plus de froid, client Dupont site Atelier… »"
          className="min-h-[4.5rem] flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm"
        />
        <VoiceDictationButton
          value={transcript}
          onChange={setTranscript}
          replace={false}
          iconOnly
          title="Dicter l’appel"
        />
      </div>

      <button
        type="button"
        disabled={busy || !transcript.trim()}
        onClick={() => void analyze()}
        className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Analyser l’appel
      </button>

      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      {result?.ok ? (
        <div className="mt-3 space-y-2 rounded-xl border border-indigo-200 bg-white p-3 text-sm">
          {result.reply ? (
            <p>
              <span className="font-semibold text-ink">Réponse client :</span> {result.reply}
            </p>
          ) : null}
          {result.technicalSummary ? (
            <p>
              <span className="font-semibold text-ink">Synthèse tech :</span>{' '}
              {result.technicalSummary}
            </p>
          ) : null}
          {result.termsDetected?.length ? (
            <p className="text-xs text-muted">
              Termes : {result.termsDetected.join(', ')}
            </p>
          ) : null}
          {suggested?.action && onApplyOtAction ? (
            <button
              type="button"
              onClick={() =>
                onApplyOtAction(suggested.action || '', suggested.localisation || undefined)
              }
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 text-xs font-bold text-indigo-950"
            >
              Préremplir l’OT avec cette synthèse
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
