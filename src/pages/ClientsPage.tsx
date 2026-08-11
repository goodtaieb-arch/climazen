import { type FormEvent, useMemo, useState, type HTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import type { Client, FacturationAction } from '../lib/types'
import { FACTURATION_PLATEFORMES } from '../lib/types'
import { allEquipements } from '../lib/cerfaBatch'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import {
  buildMakeFacturationPayload,
  copyClientPourFacturation,
  openPlateformeFacturation,
  sendClientToMake,
} from '../lib/makeFacturation'

const blank = (): Omit<Client, 'id' | 'createdAt'> => ({
  raisonSociale: '',
  nomContact: '',
  adresse: '',
  codePostal: '',
  ville: '',
  telephone: '',
  email: '',
  siret: '',
  notes: '',
})

function formatSiret(raw?: string) {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length !== 14) return (raw || '').trim()
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
}

export function ClientsPage() {
  const { data, upsertClient, deleteClient } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(blank())
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const plateformeId = data.operateur.facturationPlateforme || 'tiime'
  const plateforme =
    FACTURATION_PLATEFORMES.find((p) => p.id === plateformeId)?.label || 'Tiime'
  const webhookConfigured = Boolean(data.operateur.facturationWebhookUrl?.trim())

  const filtered = useMemo(
    () =>
      data.clients.filter((c) =>
        matchesQuery(
          [
            c.raisonSociale,
            c.nomContact,
            c.ville,
            c.telephone,
            c.email,
            c.adresse,
            c.siret,
            c.createdByName,
          ]
            .filter(Boolean)
            .join(' '),
          q,
        ),
      ),
    [data.clients, q],
  )

  const parcByClient = useMemo(() => {
    const map = new Map<string, { sites: number; equipements: number }>()
    for (const site of data.chantiers) {
      const cur = map.get(site.clientId) || { sites: 0, equipements: 0 }
      cur.sites += 1
      cur.equipements += allEquipements(site).length
      map.set(site.clientId, cur)
    }
    return map
  }, [data.chantiers])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    upsertClient({
      ...form,
      id: editId ?? undefined,
      createdByUserId: editId ? form.createdByUserId : user?.id,
      createdByName: editId
        ? form.createdByName
        : user?.fullName || user?.email || user?.username,
    })
    setForm(blank())
    setEditId(null)
    setOpen(false)
  }

  const startEdit = (c: Client) => {
    setEditId(c.id)
    setForm({
      raisonSociale: c.raisonSociale,
      nomContact: c.nomContact,
      adresse: c.adresse,
      codePostal: c.codePostal,
      ville: c.ville,
      telephone: c.telephone,
      email: c.email,
      siret: c.siret || '',
      notes: c.notes || '',
      devisLien: c.devisLien,
      factureLien: c.factureLien,
      facturationSyncedAt: c.facturationSyncedAt,
      createdByUserId: c.createdByUserId,
      createdByName: c.createdByName,
    })
    setOpen(true)
  }

  const voirFiche = (c: Client) => {
    navigate('/app/chantiers', {
      state: { search: c.raisonSociale },
    })
  }

  const nouveauSite = (c: Client) => {
    navigate('/app/chantiers', {
      state: { newSiteForClientId: c.id },
    })
  }

  const copierEtOuvrir = async (c: Client) => {
    try {
      await copyClientPourFacturation(c)
      setCopiedId(c.id)
      setTimeout(() => setCopiedId(null), 2000)
      openPlateformeFacturation(plateformeId)
    } catch {
      alert('Impossible de copier — autorisez le presse-papiers du navigateur.')
    }
  }

  const envoyerMake = async (c: Client, action?: FacturationAction) => {
    if (!webhookConfigured) {
      alert('Mode expert Make non configuré (Mon entreprise).')
      return
    }
    setSendingId(c.id)
    try {
      const payload = buildMakeFacturationPayload({
        operateur: data.operateur,
        client: c,
        sites: data.chantiers,
        action,
      })
      const result = await sendClientToMake({
        webhookUrl: data.operateur.facturationWebhookUrl || '',
        payload,
      })
      upsertClient({
        ...c,
        devisLien: result.devisLien || c.devisLien,
        factureLien: result.factureLien || c.factureLien,
        facturationSyncedAt: new Date().toISOString(),
      })
      alert(result.message || `Envoyé vers ${plateforme} via Make.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Envoi Make impossible')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Clients / détenteurs"
        subtitle="Partagés dans toute l’entreprise — un client créé par un employé est visible par tous, stocké sur le compte société."
        onAdd={() => {
          setEditId(null)
          setForm(blank())
          setOpen(true)
        }}
      />

      {webhookConfigured && (
        <p className="text-xs text-muted">
          Mode expert Make actif : icône tableur pour envoi automatique vers {plateforme}.
        </p>
      )}

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Rechercher un client, ville, téléphone…"
        testId="clients-search"
      />

      {open && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          <Field
            label="Raison sociale *"
            value={form.raisonSociale}
            onChange={(v) => setForm({ ...form, raisonSociale: v })}
            required
          />
          <Field
            label="Contact"
            value={form.nomContact}
            onChange={(v) => setForm({ ...form, nomContact: v })}
          />
          <Field
            label="Adresse"
            value={form.adresse}
            onChange={(v) => setForm({ ...form, adresse: v })}
            className="sm:col-span-2"
          />
          <Field
            label="Code postal"
            value={form.codePostal}
            onChange={(v) => setForm({ ...form, codePostal: v })}
          />
          <Field label="Ville" value={form.ville} onChange={(v) => setForm({ ...form, ville: v })} />
          <Field
            label="Téléphone"
            value={form.telephone}
            onChange={(v) => setForm({ ...form, telephone: v })}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />
          <Field
            label="Email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            type="email"
            inputMode="email"
            autoComplete="email"
          />
          <Field
            label="SIRET (facturation)"
            value={form.siret || ''}
            onChange={(v) => setForm({ ...form, siret: v })}
          />
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-line px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {/* En-tête desktop type tableau */}
        <div className="hidden rounded-xl border border-line bg-mist/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] lg:gap-3">
          <span>Client / détenteur</span>
          <span>Adresse / ville</span>
          <span>Contact direct</span>
          <span>Sites / parc</span>
          <span className="text-right">Actions</span>
        </div>

        {filtered.map((c) => {
          const parc = parcByClient.get(c.id) || { sites: 0, equipements: 0 }
          const siret = formatSiret(c.siret)
          return (
            <article
              key={c.id}
              className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:border-accent/25 hover:shadow-md"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_auto] lg:items-start lg:gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-base font-semibold text-ink">
                    {c.raisonSociale}
                  </div>
                  {siret ? (
                    <div className="mt-0.5 text-xs text-muted">SIRET : {siret}</div>
                  ) : null}
                  {c.createdByName ? (
                    <div className="mt-0.5 text-[11px] text-muted">
                      Enregistré par {c.createdByName}
                    </div>
                  ) : null}
                  {(c.devisLien || c.factureLien) && (
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                      {c.devisLien && (
                        <a
                          href={c.devisLien}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Devis
                        </a>
                      )}
                      {c.factureLien && (
                        <a
                          href={c.factureLien}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Facture
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0 text-sm text-slate">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <div className="font-medium text-ink">
                        {c.ville || '—'}
                      </div>
                      {(c.codePostal || c.adresse) && (
                        <div className="mt-0.5 text-xs text-muted">
                          {[c.codePostal, c.adresse].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 space-y-1 text-sm">
                  {c.nomContact ? (
                    <div className="flex items-center gap-1.5 text-ink">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="truncate">{c.nomContact}</span>
                    </div>
                  ) : null}
                  {c.telephone ? (
                    <a
                      href={`tel:${c.telephone.replace(/\s/g, '')}`}
                      className="flex items-center gap-1.5 text-muted hover:text-accent"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.telephone}</span>
                    </a>
                  ) : null}
                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-1.5 text-muted hover:text-accent"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </a>
                  ) : null}
                  {!c.nomContact && !c.telephone && !c.email ? (
                    <span className="text-xs text-muted">Pas de contact</span>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted" />
                    {parc.sites} site{parc.sites > 1 ? 's' : ''}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {parc.equipements} équipement{parc.equipements > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:items-end">
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => nouveauSite(c)}
                      className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-[#0f766e] px-3 text-xs font-bold text-white shadow-sm active:translate-y-px"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Nouveau site
                    </button>
                    <button
                      type="button"
                      onClick={() => voirFiche(c)}
                      className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink active:bg-mist"
                    >
                      Voir la fiche
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-0.5 lg:justify-end">
                    <button
                      type="button"
                      title={`Copier et ouvrir ${plateforme}`}
                      onClick={() => void copierEtOuvrir(c)}
                      className="touch-target grid place-items-center rounded-lg text-accent hover:bg-accent-soft"
                    >
                      <Copy className={`h-4 w-4 ${copiedId === c.id ? 'opacity-40' : ''}`} />
                    </button>
                    {webhookConfigured && (
                      <button
                        type="button"
                        title={`Make → ${plateforme} (expert)`}
                        disabled={sendingId === c.id}
                        onClick={() => void envoyerMake(c)}
                        className="touch-target grid place-items-center rounded-lg text-muted hover:bg-mist disabled:opacity-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="touch-target grid place-items-center rounded-lg text-accent hover:bg-accent-soft"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Supprimer ce client ?')) deleteClient(c.id)
                      }}
                      className="touch-target grid place-items-center rounded-lg text-danger hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
            {data.clients.length === 0
              ? 'Aucun client — ajoutez un détenteur.'
              : 'Aucun résultat pour cette recherche.'}
          </div>
        )}
      </div>

      <MobileFab
        label="Ajouter"
        hidden={open}
        onClick={() => {
          setEditId(null)
          setForm(blank())
          setOpen(true)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </div>
  )
}

export function Header({
  title,
  subtitle,
  onAdd,
}: {
  title: string
  subtitle: string
  onAdd: () => void
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
      >
        <Plus className="h-4 w-4" /> Ajouter
      </button>
    </div>
  )
}

export function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  className = '',
  step,
  inputMode,
  autoComplete,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  required?: boolean
  type?: string
  className?: string
  step?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-muted">{label}</span>
      <input
        required={required}
        type={type}
        step={step}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base md:h-11 md:text-sm"
      />
    </label>
  )
}
