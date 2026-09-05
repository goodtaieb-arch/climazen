import { useState } from 'react'
import { Loader2, Phone, Sparkles } from 'lucide-react'
import { analyzePhoneReception } from '../lib/aiVocabulary'
import { VoiceDictationButton } from './VoiceDictationButton'
import { useStore } from '../lib/store'
import { buildAiPendingValidation } from '../lib/aiPendingValidation'
import { fetchTelephonyConfig } from '../lib/telephony'
import { AiLearningInfoNotice } from './AiLearningInfoNotice'

type Props = {
  onApplyOtAction?: (action: string, localisation?: string) => void
}

/**
 * Agent d’accueil téléphonique (IA Cloud : OpenAI et/ou Claude) — analyse + notif responsable.
 * Non affiché sur le dossier INT : l’Aide IA permanente couvre déjà ça.
 */
export function PhoneReceptionPanel({ onApplyOtAction }: Props) {
  const { data, upsertAiPendingValidation } = useStore()
  const [transcript, setTranscript] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyzePhoneReception>> | null>(
    null,
  )
  const [error, setError] = useState('')
  const [notifMsg, setNotifMsg] = useState('')

  const analyze = async () => {
    const text = transcript.trim()
    if (!text || busy) return
    setBusy(true)
    setError('')
    setResult(null)
    setNotifMsg('')
    try {
      const res = await analyzePhoneReception({ transcript: text })
      if (!res.ok) {
        setError(res.hint || res.error || 'Analyse impossible.')
        return
      }
      setResult(res)

      const tel = await fetchTelephonyConfig().catch(() => null)
      const summary =
        res.technicalSummary ||
        res.suggestedOt?.action ||
        res.reply ||
        'Proposition Lola à valider'
      const pending = buildAiPendingValidation({
        source: 'phone',
        kind: 'ot',
        title: `Appel Lola — ${res.intent || 'demande'}`,
        summary,
        textForInfer: text,
        clientHint: res.suggestedOt?.clientHint,
        siteHint: res.suggestedOt?.siteHint,
        callerHint: text.slice(0, 240),
        dossiers: data.personnelDossiers,
        retiresUserIds: data.personnelRetiresUserIds,
        notifyEmailFallback:
          tel?.config?.managerNotifyEmail || data.operateur.email || undefined,
      })
      upsertAiPendingValidation(pending)
      setNotifMsg(
        pending.assigneeName
          ? `Notification → responsable ${pending.assigneeName}${
              pending.secteur ? ` (secteur ${pending.secteur})` : ''
            }. Validation sur Accueil.`
          : `Notification créée pour le gérant (e-mail ${pending.notifyEmail || 'Mon entreprise'}). Validation sur Accueil.`,
      )
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
            Aide appel (IA)
          </h2>
          <p className="mt-0.5 text-xs text-indigo-900/80">
            Collez ou dictez la transcription — Lola propose (Cloud : OpenAI et/ou Claude), le
            responsable du secteur valide sur Accueil. Elle peut aussi répondre sur le stock
            pièces (« est-ce arrivé ? », « préviens-moi quand… »).
          </p>
          <AiLearningInfoNotice variant="compact" className="mt-2" />
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
      {notifMsg ? <p className="mt-2 text-sm font-semibold text-amber-900">{notifMsg}</p> : null}

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
              Préremplir l’INT avec cette synthèse
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
