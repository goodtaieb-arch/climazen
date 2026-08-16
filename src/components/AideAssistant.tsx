import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Send, Sparkles, X } from 'lucide-react'
import { askAideAssistant, type AideMessage } from '../lib/assistantApi'
import { suggestQuestionsForPath } from '../lib/assistantKnowledge'

type ChatLine = AideMessage & { id: string }

function newId() {
  return crypto.randomUUID()
}

/**
 * Assistant d’aide ClimaZEN — bulle flottante dans l’app.
 * Mode guide local toujours actif ; IA cloud si GEMINI_API_KEY côté Vercel.
 */
export function AideAssistant() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState<'api' | 'local' | null>(null)
  const [lines, setLines] = useState<ChatLine[]>(() => [
    {
      id: newId(),
      role: 'assistant',
      content:
        'Bonjour — je peux vous expliquer ClimaZEN (OT, CERFA, stock, bouteilles). Posez une question ou choisissez une suggestion.',
    },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const suggestions = suggestQuestionsForPath(location.pathname)

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, open, busy])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const userLine: ChatLine = { id: newId(), role: 'user', content: q }
    const nextMessages = [...lines, userLine]
    setLines(nextMessages)
    setBusy(true)
    try {
      const { reply, source: src } = await askAideAssistant({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        pathname: location.pathname,
      })
      setSource(src)
      setLines((prev) => [...prev, { id: newId(), role: 'assistant', content: reply }])
    } catch {
      setLines((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: 'Impossible de répondre pour le moment. Réessayez dans un instant.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  // Liens rapides détectés dans les réponses
  const goIfMentioned = (content: string) => {
    if (content.includes('/app/stock')) navigate('/app/stock')
    else if (content.includes('/app/appel')) navigate('/app/appel')
    else if (content.includes('/app/ot')) navigate('/app/ot')
    else if (content.includes('/app/interventions')) navigate('/app/interventions')
    else if (content.includes('/app/operateur')) navigate('/app/operateur')
    else if (content.includes('/app/profil')) navigate('/app/profil')
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[4.75rem] right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[#0f766e] px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-teal-800 md:bottom-6"
          aria-label="Ouvrir l’assistant IA ClimaZEN"
        >
          <Sparkles className="h-5 w-5" />
          Aide IA
        </button>
      )}

      {open && (
        <div
          className="fixed inset-x-3 bottom-[4.5rem] z-40 flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-6 sm:w-[380px] md:bottom-6"
          role="dialog"
          aria-label="Assistant d’aide ClimaZEN"
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
                    ? 'Guide local (mots-clés)'
                    : 'Prêt'}{' '}
                · {location.pathname}
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

          {suggestions.length > 0 && (
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
          )}

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-line p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre question…"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
              disabled={busy}
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
