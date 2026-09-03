import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Loader2, Send, Sparkles, X } from 'lucide-react'
import { askAideAssistant, type AideMessage } from '../lib/assistantApi'
import { suggestQuestionsForPath } from '../lib/assistantKnowledge'
import {
  buildEntityCatalog,
  executeCreateOtCerfa,
  extractActionFromReply,
  extractCommercialActionFromReply,
  extractEquipementsActionFromReply,
  isCancelPhrase,
  isConfirmPhrase,
  parseCreateOtCerfaIntent,
  resolveCreateOtCerfa,
  type ResolvedCreateOtCerfa,
} from '../lib/assistantActions'
import { catalogSummaryForPrompt, isForbiddenClaim, wantsAnnulerOt, answerAnnulerOtGuide, AI_HOW_I_WORK } from '../lib/aiActionCatalog'
import {
  wantsStockPieceQuery,
  answerStockPieceQuery,
} from '../lib/assistantStockPieces'
import { buildAiPendingValidation } from '../lib/aiPendingValidation'
import {
  executeTerrainAction,
  parseTerrainIntent,
  type PendingTerrainAction,
} from '../lib/assistantTerrainActions'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { VoiceDictationButton } from './VoiceDictationButton'
import { formatOtNumero } from '../lib/ordreTravail'
import {
  aiTierUpsellMessage,
  canUseAgentActions,
  canUseChatbot,
  resolveAiTier,
  AI_TIER_LABELS,
} from '../lib/aiAccess'
import { APP_IS_BETA } from '../lib/buildStamp'
import { learnAiVocabulary, learnAiVocabularyCorrection } from '../lib/aiVocabulary'
import { applySpeechCorrections } from '../lib/speech'
import { AiLearningInfoNotice } from './AiLearningInfoNotice'

type ChatLine = AideMessage & { id: string }

function newId() {
  return crypto.randomUUID()
}

function welcomeForTier(tier: ReturnType<typeof resolveAiTier>): string {
  if (tier === 'none') {
    return `Bonjour — l’assistant IA n’est pas inclus dans l’édition Light gratuite pendant la version bêta.

${aiTierUpsellMessage('none') ?? ''}

À la sortie de la bêta : chatbot d’aide gratuit, Agent IA (OT, CERFA, agenda…) en option payante.`
  }
  if (tier === 'chatbot') {
    return `Bonjour — je suis le ${AI_TIER_LABELS.chatbot} ClimaZEN (guide et questions sur l’app).

Pour créer des OT, CERFA, agenda ou stock par la voix, passez à l’${AI_TIER_LABELS.agent}.`
  }
  return (
    'Intelligence ClimaZEN — je propose, vous validez.\n\n' +
    AI_HOW_I_WORK +
    '\n\nJe peux notamment :\n' +
    catalogSummaryForPrompt() +
    '\n\nExemples :\n' +
    '• « Combien de filtre M5 en stock ? »\n' +
    '• « Préviens-moi quand le compresseur arrive »\n' +
    '• « Crée un OT pour Mr Martin, site Atelier »\n' +
    '• « Agenda RDV demain 14h »\n\n' +
    'Interdit : supprimer un OT. Pour corriger : retirer (croix rouge) ou déplacer.'
  )
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
    upsertDevis,
    upsertCommandeFournisseur,
    upsertPieceDetachee,
    upsertPieceVeille,
    upsertAiPendingValidation,
    appEdition,
  } = useStore()
  const { user } = useAuth()
  const organizationId = user?.organizationId
  const aiTier = resolveAiTier({ appEdition, aiPlan: data.aiPlan })
  const chatbotOk = canUseChatbot(aiTier)
  const agentOk = canUseAgentActions(aiTier)
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
      content: welcomeForTier(
        resolveAiTier({ appEdition: 'light', aiPlan: undefined }),
      ),
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

  useEffect(() => {
    if (!open) return
    setLines([
      {
        id: newId(),
        role: 'assistant',
        content: welcomeForTier(aiTier),
      },
    ])
    setPendingCreate(null)
    setPendingTerrain(null)
    setSource(null)
    setInput('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aiTier])

  const pushAssistant = (content: string) => {
    setLines((prev) => [...prev, { id: newId(), role: 'assistant', content }])
  }

  /** Notifie le responsable du secteur — validation humaine hors chat. */
  const notifyResponsable = (opts: {
    title: string
    summary: string
    kind?: import('../lib/aiPendingValidation').AiPendingKind
    source?: import('../lib/aiPendingValidation').AiPendingSource
    textForInfer?: string
  }) => {
    const pending = buildAiPendingValidation({
      source: opts.source || 'assistant',
      kind: opts.kind,
      title: opts.title,
      summary: opts.summary,
      textForInfer: opts.textForInfer || `${opts.title} ${opts.summary}`,
      dossiers: data.personnelDossiers,
      retiresUserIds: data.personnelRetiresUserIds,
      notifyEmailFallback: data.operateur.email || undefined,
    })
    upsertAiPendingValidation(pending)
    if (pending.assigneeName) {
      pushAssistant(
        `Notification envoyée au responsable secteur${
          pending.secteur ? ` (${pending.secteur})` : ''
        } : ${pending.assigneeName}. Il valide sur Accueil.`,
      )
    } else {
      pushAssistant(
        `Notification créée pour validation humaine (aucun responsable secteur trouvé — visible du gérant sur Accueil).`,
      )
    }
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
    notifyResponsable({
      title: `Proposition OT — ${resolved.resolved.summary.split('\n')[0] || 'OT'}`,
      summary: resolved.resolved.summary,
      kind: 'ot',
      textForInfer: `${intent.actionText} ${intent.clientQuery} ${intent.siteQuery} ${intent.typeOt}`,
    })
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
        upsertDevis,
        upsertCommandeFournisseur,
        upsertPieceDetachee,
        upsertPieceVeille,
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
    if (!chatbotOk) return
    const rawInput = text
    setInput('')
    const userLine: ChatLine = { id: newId(), role: 'user', content: q }
    setLines((prev) => [...prev, userLine])

    if (organizationId) {
      const corrected = applySpeechCorrections(rawInput)
      if (corrected && corrected !== rawInput.trim()) {
        void learnAiVocabularyCorrection({
          organizationId,
          before: rawInput,
          after: corrected,
          agent: 'voice',
        })
      }
      void learnAiVocabulary({
        organizationId,
        text: q,
        agent: 'openai',
      })
    }

    setBusy(true)
    try {
      if ((pendingCreate || pendingTerrain) && isConfirmPhrase(q)) {
        if (!agentOk) {
          pushAssistant(aiTierUpsellMessage(aiTier, APP_IS_BETA) ?? '')
          setPendingCreate(null)
          setPendingTerrain(null)
          return
        }
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

      // Annuler OT = supprimer → interdit ; expliquer retirer / déplacer
      if (wantsAnnulerOt(q)) {
        setSource('local')
        setPendingCreate(null)
        setPendingTerrain(null)
        pushAssistant(answerAnnulerOtGuide(q))
        return
      }

      // Lecture stock pièces / arrivée (temps réel, sans écriture)
      if (wantsStockPieceQuery(q)) {
        setSource('local')
        setPendingCreate(null)
        setPendingTerrain(null)
        pushAssistant(answerStockPieceQuery(data, q))
        return
      }

      // Comment tu marches ?
      if (
        /comment\s+(tu|vous)\s+(marche|fonctionne|travaille)|ce\s+que\s+tu\s+(fais|peux)|comment\s+lola/i.test(
          q,
        )
      ) {
        setSource('local')
        pushAssistant(AI_HOW_I_WORK + '\n\nExemples : « combien de filtre M5 ? » · « préviens-moi quand le M5 arrive » · « crée un OT… »')
        return
      }

      // 1) Actions terrain (détecteur, bouteille, fiche, agenda) — Agent IA uniquement
      const terrain = parseTerrainIntent(q, data)
      if (terrain) {
        if (!agentOk) {
          pushAssistant(aiTierUpsellMessage(aiTier, APP_IS_BETA) ?? '')
          return
        }
        setSource('local')
        setPendingCreate(null)
        setPendingTerrain(terrain)
        pushAssistant(terrain.summary)
        notifyResponsable({
          title: `Proposition ${terrain.kind}`,
          summary: terrain.summary,
          kind:
            terrain.kind === 'devis'
              ? 'devis'
              : terrain.kind === 'commande' ||
                  terrain.kind === 'piece' ||
                  terrain.kind === 'piece_veille'
                ? 'commande'
                : terrain.kind === 'agenda'
                  ? 'agenda'
                  : terrain.kind === 'client'
                    ? 'client'
                    : 'autre',
          textForInfer: q,
        })
        return
      }

      // 2) OT + CERFA — Agent IA uniquement
      const localIntent = parseCreateOtCerfaIntent(q)
      if (localIntent) {
        if (!agentOk) {
          pushAssistant(aiTierUpsellMessage(aiTier, APP_IS_BETA) ?? '')
          return
        }
        setSource('local')
        tryProposeFromIntent(localIntent)
        return
      }

      // 3) Guide / Gemini
      const nextMessages = [...lines, userLine]
      const { reply, source: src } = await askAideAssistant({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        pathname: location.pathname,
        entityCatalog: agentOk ? buildEntityCatalog(data) : undefined,
        chatbotOnly: !agentOk,
        organizationId,
      })
      setSource(src)

      const geminiEquips = agentOk ? extractEquipementsActionFromReply(reply) : null
      if (geminiEquips) {
        const cleaned = stripActionJson(reply)
        if (cleaned) pushAssistant(cleaned)
        setPendingCreate(null)
        setPendingTerrain(geminiEquips)
        pushAssistant(geminiEquips.summary)
        notifyResponsable({
          title: 'Proposition équipements',
          summary: geminiEquips.summary,
          kind: 'autre',
          textForInfer: q,
        })
        return
      }

      const commercial = agentOk ? extractCommercialActionFromReply(reply) : null
      if (commercial) {
        const cleaned = stripActionJson(reply)
        if (cleaned) pushAssistant(cleaned)
        setPendingCreate(null)
        setPendingTerrain(commercial)
        pushAssistant(commercial.summary)
        notifyResponsable({
          title: `Proposition ${commercial.kind}`,
          summary: commercial.summary,
          kind:
            commercial.kind === 'devis'
              ? 'devis'
              : commercial.kind === 'commande' || commercial.kind === 'piece'
                ? 'commande'
                : 'autre',
          textForInfer: q,
        })
        return
      }

      const geminiIntent = agentOk ? extractActionFromReply(reply) : null
      if (geminiIntent) {
        const cleaned = stripActionJson(reply)
        if (cleaned) pushAssistant(cleaned)
        tryProposeFromIntent(geminiIntent)
        return
      }

      // L’IA a parfois dit « c’est fait » sans rien créer → ne pas laisser croire
      if (isForbiddenClaim(reply)) {
        const retry = agentOk ? parseTerrainIntent(q, data) : null
        if (retry) {
          setPendingCreate(null)
          setPendingTerrain(retry)
          pushAssistant(
            `Rien n’a encore été enregistré dans l’app.\n\n${retry.summary}`,
          )
          return
        }
        pushAssistant(
          `${stripActionJson(reply)}\n\n⚠️ Rien n’a encore été enregistré. Reformulez clairement puis validez avec « oui » (validation humaine obligatoire).`,
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
    else if (content.includes('/app/devis')) navigate('/app/devis')
    else if (content.includes('/app/commandes')) navigate('/app/commandes')
    else if (content.includes('/app/stock-pieces')) navigate('/app/stock-pieces')
  }

  const tierSubtitle =
    aiTier === 'agent'
      ? source === 'api'
        ? 'Intelligence A→Z · OpenAI · validation humaine'
        : source === 'local'
          ? 'Intelligence A→Z · guide + actions'
          : 'Intelligence A→Z · validation obligatoire'
      : aiTier === 'chatbot'
        ? 'Chatbot · guide ClimaZEN'
        : 'Non activé · édition Light'

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
              <p className="truncate text-[11px] text-white/80">{tierSubtitle}</p>
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
            {chatbotOk ? <AiLearningInfoNotice variant="compact" /> : null}
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

          {!chatbotOk ? (
            <div className="space-y-3 border-t border-line bg-amber-50 px-4 py-4">
              <p className="text-sm text-slate">
                L’assistant IA n’est pas inclus dans votre offre Light gratuite pendant la bêta.
              </p>
              <Link
                to="/contact"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white hover:bg-teal-800"
              >
                Activer l’Agent IA
              </Link>
              <p className="text-[11px] text-muted">
                À la sortie de la bêta : chatbot gratuit · Agent IA en option payante.
              </p>
            </div>
          ) : (
            <>
          {hasPending && agentOk ? (
            <div className="space-y-2 border-t border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Validation humaine obligatoire — rien n’est écrit sans votre OK
              </p>
              <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void send('oui')}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0f766e] px-3 text-xs font-extrabold text-white disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Oui, valider
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
            </div>
          ) : null}

          {suggestions.length > 0 && !hasPending && chatbotOk ? (
            <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
              {suggestions
                .filter((s) => agentOk || !/\b(cr[eé]e|ajoute|nouveau|ot\b|cerfa)/i.test(s))
                .map((s) => (
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
              placeholder={
                agentOk
                  ? 'Ex. devis Dupont… / commande pièce… / OT…'
                  : 'Question sur l’app ClimaZEN…'
              }
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
          {!agentOk && chatbotOk ? (
            <p className="border-t border-line px-3 pb-3 text-center text-[11px] text-muted">
              <Link to="/contact" onClick={() => setOpen(false)} className="font-semibold text-accent underline">
                Passer à l’Agent IA
              </Link>
              {' '}
              — création OT/CERFA et actions terrain
            </p>
          ) : null}
            </>
          )}
        </div>
      )}
    </>
  )
}
