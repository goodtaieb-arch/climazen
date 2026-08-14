import { useEffect, useMemo, useState } from 'react'
import {
  CheckSquare,
  Download,
  FileArchive,
  Loader2,
  Mail,
  Share2,
  Square,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import type { OrdreTravail } from '../lib/ordreTravail'
import {
  clientMailtoForPack,
  collectOtDocsPack,
  downloadDocsPack,
  packZipFileName,
  shareDocsPack,
  type PackDoc,
} from '../lib/docsPack'

type Props = {
  ot: OrdreTravail
  /** Compact inline (étape docs) ou panneau suite à un bouton. */
  variant?: 'card' | 'sheet'
  open?: boolean
  onClose?: () => void
  className?: string
}

const KIND_LABEL: Record<PackDoc['kind'], string> = {
  cerfa: 'CERFA',
  fiche: 'Fiche',
  rapport_ot: 'Rapport',
}

/**
 * Regroupe CERFA + fiches + rapport OT → enregistrer (ZIP) ou envoyer (share / mailto).
 */
export function DocsPackPanel({
  ot,
  variant = 'card',
  open = true,
  onClose,
  className = '',
}: Props) {
  const { data } = useStore()
  const { user } = useAuth()
  const client = data.clients.find((c) => c.id === ot.clientId)
  const [docs, setDocs] = useState<PackDoc[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'save' | 'send' | null>(null)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

  const zipName = useMemo(
    () => packZipFileName(ot.numero || ot.id.slice(0, 8), client?.raisonSociale),
    [ot.numero, ot.id, client?.raisonSociale],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    setHint('')
    void collectOtDocsPack({
      ot,
      data,
      organizationId: user?.organizationId,
    })
      .then((list) => {
        if (cancelled) return
        setDocs(list)
        setSelected(new Set(list.map((d) => d.id)))
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setError('Impossible de préparer les documents.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ot.id, ot.updatedAt, ot.rapportAction, ot.numero, data, user?.organizationId])

  const chosen = docs.filter((d) => selected.has(d.id))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === docs.length) setSelected(new Set())
    else setSelected(new Set(docs.map((d) => d.id)))
  }

  const onSave = async () => {
    if (chosen.length === 0) return
    setBusy('save')
    setError('')
    setHint('')
    try {
      await downloadDocsPack(chosen, zipName)
      setHint(
        chosen.length === 1
          ? 'PDF enregistré sur l’appareil.'
          : `ZIP enregistré (${chosen.length} docs) — dossier Téléchargements.`,
      )
    } catch (err) {
      console.error(err)
      setError('Échec de l’enregistrement.')
    } finally {
      setBusy(null)
    }
  }

  const onSend = async () => {
    if (chosen.length === 0) return
    setBusy('send')
    setError('')
    setHint('')
    try {
      const title = `Docs ${ot.numero}`
      const text = `Documents ClimaZEN — intervention ${ot.numero}`
      const shareResult = await shareDocsPack({
        docs: chosen,
        title,
        text,
        zipName,
      })
      if (shareResult === 'shared') {
        setHint('Partage ouvert — choisissez Mail, Drive, etc.')
        return
      }
      if (shareResult === 'cancelled') {
        setHint('Partage annulé.')
        return
      }
      // Fallback : télécharger + mailto (pièce jointe manuelle)
      await downloadDocsPack(chosen, zipName)
      const mail = clientMailtoForPack({
        email: client?.email,
        otNumero: ot.numero || '',
        clientName: client?.raisonSociale,
        docCount: chosen.length,
        zipName,
      })
      if (mail) {
        window.location.href = mail
        setHint(
          'Fichier(s) téléchargé(s). Joignez-les dans l’e-mail qui s’ouvre (le navigateur ne peut pas attacher automatiquement).',
        )
      } else {
        setHint(
          'Fichier(s) téléchargé(s). Ajoutez un e-mail client pour ouvrir Mail, ou joignez le ZIP manuellement.',
        )
      }
    } catch (err) {
      console.error(err)
      setError('Échec de l’envoi.')
    } finally {
      setBusy(null)
    }
  }

  if (variant === 'sheet' && !open) return null

  const body = (
    <div className={['space-y-3', className].filter(Boolean).join(' ')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Docs groupés</p>
          <h3 className="font-display text-base font-bold text-ink">
            Envoyer / enregistrer · {ot.numero || 'OT'}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            CERFA, fiche maintenance, rapport — un ZIP si plusieurs.
            {client?.email ? ` · ${client.email}` : ' · pas d’e-mail client'}
          </p>
        </div>
        {variant === 'sheet' && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Préparation des PDF…
        </p>
      ) : docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-mist/50 px-3 py-3 text-sm text-muted">
          Aucun document prêt. Générez d’abord un CERFA ou une fiche, ou renseignez le rapport
          d’action.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent"
          >
            {selected.size === docs.length ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {selected.size === docs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <ul className="space-y-1.5">
            {docs.map((d) => {
              const on = selected.has(d.id)
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => toggle(d.id)}
                    className={[
                      'flex w-full min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm',
                      on ? 'border-accent/40 bg-accent-soft/40' : 'border-line bg-white',
                    ].join(' ')}
                  >
                    {on ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-accent" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{d.label || d.fileName}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {KIND_LABEL[d.kind]} · {d.fileName}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      {hint ? <p className="text-xs font-medium text-emerald-800">{hint}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={loading || chosen.length === 0 || busy !== null}
          onClick={() => void onSave()}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold disabled:opacity-50"
        >
          {busy === 'save' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : chosen.length > 1 ? (
            <FileArchive className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {chosen.length > 1 ? 'Enregistrer le ZIP' : 'Enregistrer sur l’ordi'}
        </button>
        <button
          type="button"
          disabled={loading || chosen.length === 0 || busy !== null}
          onClick={() => void onSend()}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === 'send' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
            <Share2 className="h-4 w-4" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Envoyer au client
        </button>
      </div>
    </div>
  )

  if (variant === 'sheet') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-xl">
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">{body}</div>
  )
}

/** Bouton qui ouvre le panneau sheet. */
export function DocsPackButton({
  ot,
  className = '',
}: {
  ot: OrdreTravail
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-950',
          className,
        ].join(' ')}
      >
        <FileArchive className="h-4 w-4" /> Docs groupés
      </button>
      <DocsPackPanel ot={ot} variant="sheet" open={open} onClose={() => setOpen(false)} />
    </>
  )
}
