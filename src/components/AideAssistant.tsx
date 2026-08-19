import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, Loader2, Send, Sparkles, X } from 'lucide-react'
import { askAideAssistant, type AideMessage } from '../lib/assistantApi'
import { suggestQuestionsForPath } from '../lib/assistantKnowledge'
import {
  buildEntityCatalog,
  executeCreateOtCerfa,
  extractActionFromReply,
  extractEquipementsActionFromReply,
  isCancelPhrase,
  isConfirmPhrase,
  parseCreateOtCerfaIntent,
  resolveCreateOtCerfa,
  type ResolvedCreateOtCerfa,
} from '../lib/assistantActions'
import {
  executeTerrainAction,
  parseTerrainIntent,
  type PendingTerrainAction,
} from '../lib/assistantTerrainActions'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { VoiceDictationButton } from './VoiceDictationButton'
import { formatOtNumero } from '../lib/ordreTravail'

type ChatLine = AideMessage & { id: string }

function newId() {
  return crypto.randomUUID()
}

function stripActionJson(reply: string): string {
  return reply
    .replace(/```(?:json)?\s*\{[\s\S]*?"action"\s*:\s*"propose_create_[^"]+"[\s\S]*?\}\s*```/gi, '')
    .replace(/\{[\s\S]*?"action"\s*:\s*"propose_create_[^"]+"[\s\S]*?\}/g, '')
    .trim()
}

/**
 * Assistant ClimaZEN — OT/CERFA, agenda, bouteilles, fiches, détecteurs (avec confirmation).
 */
export function AideAssistant() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    data,
    createOtForAction,
    upsertIntervention,
    upsertClient,
    upsertChantier,
    upsertDetecteur,
    upsertStock,
    upsertFicheMaintenanceClim,
    upsertAgendaEvent,
  } = useStore()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState<'api' | 'local' | null>(null)
  const [pendingCreate, setPendingCreate] = useState<ResolvedCreateOtCerfa | null>(null)
  const [pendingTerrain, setPendingTerrain] = useState<PendingTerrainAction | null>(null)
  const [lines, setLines] = useState<ChatLine[]>(() => [
    {
      id: newId(),
      role: 'assistant',
      content:
        'Bonjour — je peux préparer OT, CERFA, clients, agenda, bouteilles, fiches et détecteurs. Vous validez ensuite.\n\nExemples :\n• « Crée un client Monsieur Albert Dupont, tél 06 15 53 38 54, mail …, adresse … Nice »\n• « Crée une OT pour Mr Martin, site Atelier, contrôle d’étanchéité clim RDC et le CERFA »\n• « Agenda RDV demain 14h pour Mr Martin site Atelier »\n• « Ajoute un détecteur de fuite nom 3 XXXX3, validité 15/03/26 »',
    },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const suggestions = suggestQuestionsForPath(location.pathname)
  const hasPending = Boolean(pendingCreate || pendingTerrain)

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, open, busy, pendingCreate, pendingTerrain])

  useEffect(() => {
    const openFromVoice = () => setOpen(true)
    window.addEventListener('climazen:open-aide', openFromVoice)
    return () => window.removeEventListener('climazen:open-aide', openFromVoice)
  }, [])

  const pushAssistant = (content: string) => {
    setLines((prev) => [...prev, { id: newId(), role: 'assistant', content }])
  }

  const tryProposeFromIntent = (intent: ReturnType<typeof parseCreateOtCerfaIntent>) => {
    if (!intent) return false
    const resolved = resolveCreateOtCerfa(data, intent)
    if (!resolved.ok) {
      pushAssistant(resolved.message)
      setPendingCreate(null)
      return true
    }
    setPendingTerrain(null)
    setPendingCreate(resolved.resolved)
    pushAssistant(resolved.resolved.summary)
    return true
  }

  const runCreate = () => {
    if (!pendingCreate) return
    try {
      const result = executeCreateOtCerfa(pendingCreate, {
        createOtForAction,
        upsertClient,
        upsertChantier,
        upsertIntervention,
        data,
        technicien: user?.fullName || user?.email || '',
        userId: user?.id,
        userName: user?.fullName || user?.email,
      })
      setPendingCreate(null)
      pushAssistant(
        `${result.message}\n\n${formatOtNumero(result.otNumero)} — vérifiez puis signez / générez le PDF.`,
      )
      setOpen(false)
      navigate(result.navigateTo)
    } catch (err) {
      pushAssistant(err instanceof Error ? err.message : 'Création impossible.')
    }
  }

  const runTerrain = async () => {
    if (!pendingTerrain) return
    try {
      const result = await executeTerrainAction(pendingTerrain, {
        data,
        userId: user?.id,
        userName: user?.fullName || user?.email,
        upsertClient,
        upsertChantier,
        upsertDetecteur,
        upsertStock,
        upsertFicheMaintenanceClim,
        upsertAgendaEvent,
      })
      setPendingTerrain(null)
      pushAssistant(result.message)
      setOpen(false)
      navigate(result.navigateTo)
    } catch (err) {
      pushAssistant(err instanceof Error ? err.message : 'Création impossible.')
    }
  }

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const userLine: ChatLine = { id: newId(), role: 'user', content: q }
    setLines((prev) => [...prev, userLine])
    setBusy(true)
    try {
      if ((pendingCreate || pendingTerrain) && isConfirmPhrase(q)) {
        if (pendingCreate) runCreate()
        else await runTerrain()
        return
      }
      if ((pendingCreate || pendingTerrain) && isCancelPhrase(q)) {
        setPendingCreate(null)
        setPendingTerrain(null)
        pushAssistant('Création annulée.')
        return
      }

      // 1) Actions terrain (détecteur, bouteille, fiche, agenda)
      const terrain = parseTerrainIntent(q)
      if (terrain) {
        setSource('local')
        setPendingCreate(null)
        setPendingTerrain(terrain)
        pushAssistant(terrain.summary)
        return
      }

      // 2) OT + CERFA
      const localIntent = parseCreateOtCerfaIntent(q)
      if (localIntent) {
        setSource('local')
        tryProposeFromIntent(localIntent)
        return
      }

      // 3) Guide / Gemini
      const nextMessages = [...lines, userLine]
      const { reply, source: src } = await askAideAssistant({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        pathname: location.pathname,
        entityCatalog: buildEntityCatalog(data),
      })
      setSource(src)

      const geminiEquips = extractEquipementsActionFromReply(reply)
      if (geminiEquips) {
        const cleaned = stripActionJson(reply)
        if (cleaned) pushAssistant(cleaned)
        setPendingCreate(null)
        setPendingTerrain(geminiEquips)
        pushAssistant(geminiEquips.summary)
        return
      }

      const geminiIntent = extractActionFromReply(reply)
      if (geminiIntent) {
        const cleaned = stripActionJson(reply)
        if (cleaned) pushAssistant(cleaned)
        tryProposeFromIntent(geminiIntent)
        return
      }

      // Gemini a parfois dit « c’est fait » sans rien créer → ne pas laisser croire
      const falseDone =
        /\bc['’]?est fait\b|\bont bien [eé]t[eé] cr[eé][eé]s?\b|\bont [eé]t[eé] cr[eé][eé]s?\b/i.test(
          reply,
        )
      if (falseDone) {
        const retry = parseTerrainIntent(q)
        if (retry) {
          setPendingCreate(null)
          setPendingTerrain(retry)
          pushAssistant(
            `Rien n’a encore été enregistré dans l’app.\n\n${retry.summary}`,
          )
          return
        }
        pushAssistant(
          `${stripActionJson(reply)}\n\n⚠️ Rien n’a encore été enregistré dans l’app. Reformulez clairement (ex. « crée 2 clim monobloc salon et chambre chez Dupont ») puis validez avec « oui ».`,
        )
        return
      }

      pushAssistant(reply)
    } catch {
      pushAssistant('Impossible de répondre pour le moment. Réessayez dans un instant.')
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  const goIfMentioned = (content: string) => {
    if (content.includes('/app/stock')) navigate('/app/stock')
    else if (content.includes('/app/appel')) navigate('/app/appel')
    else if (content.includes('/app/ot')) navigate('/app/ot')
    else if (content.includes('/app/interventions')) navigate('/app/interventions')
    else if (content.includes('/app/operateur')) navigate('/app/operateur')
    else if (content.includes('/app/profil')) navigate('/app/profil')
    else if (content.includes('/app/fiche-maintenance')) navigate('/app/fiche-maintenance-clim')
    else if (content.includes('/app/agenda')) navigate('/app/agenda')
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-x-3 top-[4.25rem] z-40 flex max-h-[min(72vh,560px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:top-16 sm:w-[400px] md:top-20"
          role="dialog"
          aria-label="Assistant ClimaZEN"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line bg-[#0f766e] px-4 py-3 text-white">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-bold">
                <Sparkles className="h-4 w-4 shrink-0" />
                Assistant ClimaZEN
              </div>
              <p className="truncate text-[11px] text-white/80">
                {source === 'api'
                  ? 'IA cloud (Gemini)'
                  : source === 'local'
                    ? 'Guide + actions locales'
                    : 'Prêt'}{' '}
                · OT · CERFA · agenda · stock · fiches
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 hover:bg-white/15"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {lines.map((m) => (
              <div
                key={m.id}
                className={[
                  'max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-snug',
                  m.role === 'user'
                    ? 'ml-auto bg-[#0f766e] text-white'
                    : 'bg-mist text-ink',
                ].join(' ')}
              >
                {m.content}
                {m.role === 'assistant' && /\/app\//.test(m.content) && (
                  <button
                    type="button"
                    onClick={() => goIfMentioned(m.content)}
                    className="mt-2 block text-xs font-semibold text-accent underline"
                  >
                    Ouvrir la page mentionnée
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-mist px-3 py-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Réflexion…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {hasPending ? (
            <div className="flex gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void send('oui')}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0f766e] px-3 text-xs font-extrabold text-white disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Oui, créer
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send('non')}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          ) : null}

          {suggestions.length > 0 && !hasPending ? (
            <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(s)}
                  className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-slate hover:bg-mist disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex. ajoute détecteur… / crée OT…"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
              disabled={busy}
            />
            <VoiceDictationButton
              value={input}
              onChange={setInput}
              replace
              iconOnly
              title="Dicter la demande"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0f766e] text-white disabled:opacity-50"
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
