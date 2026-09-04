import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Building2, Check, ClipboardList, Plus, Wrench } from 'lucide-react'
import {
  fetchPortailPublic,
  submitTicketPublic,
  type PortailHistoriqueItem,
  type PortailTicketItem,
} from '../lib/portailClient'
import { STATUT_OT_LABELS } from '../lib/ordreTravail'

/**
 * Portail client GMAO — maintenance passée + signalement (ticket → OT bureau).
 * Lien public : /portail/:token
 */
export function PortailClientPage() {
  const { token = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [siteNom, setSiteNom] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [historique, setHistorique] = useState<PortailHistoriqueItem[]>([])
  const [tickets, setTickets] = useState<PortailTicketItem[]>([])
  const [localisation, setLocalisation] = useState('')
  const [description, setDescription] = useState('')
  const [contactNom, setContactNom] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactTel, setContactTel] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const reload = async () => {
    if (!token) {
      setError('Lien portail invalide.')
      setLoading(false)
      return
    }
    const res = await fetchPortailPublic(token)
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }
    setSiteNom(res.data.siteNom)
    setClientNom(res.data.clientNom)
    setHistorique(res.data.historique || [])
    setTickets(res.data.tickets || [])
    setError('')
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reload()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!localisation.trim() || !description.trim()) {
      alert('Indiquez le lieu (ex. Bureau 117) et décrivez le problème.')
      return
    }
    setBusy(true)
    try {
      const res = await submitTicketPublic({
        token,
        localisation: localisation.trim(),
        description: description.trim(),
        contactNom: contactNom.trim(),
        contactEmail: contactEmail.trim(),
        contactTel: contactTel.trim(),
      })
      if (!res.ok) {
        alert(res.error)
        return
      }
      setSent(true)
      setLocalisation('')
      setDescription('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
        Chargement du portail maintenance…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-danger">{error}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-accent underline">
          Retour à l’accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-mist/30 px-4 py-8">
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20">
          <Building2 className="h-6 w-6 text-ink" />
        </div>
        <h1 className="font-display text-xl font-bold text-ink">{siteNom || 'Site'}</h1>
        {clientNom ? <p className="mt-1 text-sm text-muted">{clientNom}</p> : null}
        <p className="mt-2 text-xs text-muted">
          Suivi maintenance · signalement d’anomalie
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted" />
          <h2 className="font-display text-sm font-bold">Maintenance effectuée</h2>
        </div>
        {historique.length === 0 ? (
          <p className="text-sm text-muted">Aucune intervention clôturée pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-line">
            {historique
              .slice()
              .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
              .map((h) => (
                <li key={h.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink">{h.numero}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {h.date ? new Date(h.date).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  </div>
                  {h.localisation ? (
                    <p className="mt-0.5 text-xs font-medium text-accent">{h.localisation}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate">{h.action || 'Intervention'}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {STATUT_OT_LABELS[h.statut as keyof typeof STATUT_OT_LABELS] || h.statut}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {tickets.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted" />
            <h2 className="font-display text-sm font-bold">Vos signalements</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-xl border border-line bg-mist/30 px-3 py-2">
                <div className="font-semibold text-ink">{t.localisation}</div>
                <p className="text-xs text-slate">{t.description}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {t.statut === 'ot_cree' && t.otNumero
                    ? `Pris en charge — OT ${t.otNumero}`
                    : t.statut === 'nouveau'
                      ? 'En attente de traitement'
                      : t.statut}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-accent/30 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent" />
          <h2 className="font-display text-sm font-bold">Signaler un problème</h2>
        </div>
        <p className="mb-4 text-xs text-muted">
          Exemple : fuite dans le Bureau 117 — une intervention sera créée pour votre prestataire.
        </p>
        {sent ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="h-4 w-4 shrink-0" />
            Signalement envoyé — une intervention est créée pour votre prestataire, qui reçoit
            aussi une notification e-mail.
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Lieu / localisation</span>
            <input
              value={localisation}
              onChange={(e) => setLocalisation(e.target.value)}
              placeholder="Bureau 117, hall d’entrée…"
              className="w-full rounded-xl border border-line px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fuite d’eau, absence de froid, bruit anormal…"
              className="w-full rounded-xl border border-line px-3 py-2"
              required
            />
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-muted">Contact (optionnel)</summary>
            <div className="mt-2 space-y-2">
              <input
                value={contactNom}
                onChange={(e) => setContactNom(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-xl border border-line px-3 py-2"
              />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="E-mail"
                className="w-full rounded-xl border border-line px-3 py-2"
              />
              <input
                type="tel"
                value={contactTel}
                onChange={(e) => setContactTel(e.target.value)}
                placeholder="Téléphone"
                className="w-full rounded-xl border border-line px-3 py-2"
              />
            </div>
          </details>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-accent py-3 text-sm font-bold text-ink disabled:opacity-60"
          >
            {busy ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
        </form>
      </section>

      <p className="mt-8 text-center text-[11px] text-muted">
        Portail maintenance ClimaZEN ·{' '}
        <Link to="/" className="underline">
          climazen.fr
        </Link>
      </p>
    </div>
  )
}
