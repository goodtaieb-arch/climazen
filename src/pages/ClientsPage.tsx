import { type FormEvent, useMemo, useState } from 'react'
import { ExternalLink, FileSpreadsheet, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Client, FacturationAction } from '../lib/types'
import { FACTURATION_PLATEFORMES } from '../lib/types'
import { SearchField, matchesQuery } from '../components/SearchField'
import { buildMakeFacturationPayload, sendClientToMake } from '../lib/makeFacturation'

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

export function ClientsPage() {
  const { data, upsertClient, deleteClient } = useStore()
  const [form, setForm] = useState(blank())
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)

  const plateforme =
    FACTURATION_PLATEFORMES.find((p) => p.id === data.operateur.facturationPlateforme)?.label ||
    'Tiime'
  const webhookConfigured = Boolean(data.operateur.facturationWebhookUrl?.trim())

  const filtered = useMemo(
    () =>
      data.clients.filter((c) =>
        matchesQuery(
          [c.raisonSociale, c.nomContact, c.ville, c.telephone, c.email, c.adresse, c.siret]
            .filter(Boolean)
            .join(' '),
          q,
        ),
      ),
    [data.clients, q],
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    upsertClient({ ...form, id: editId ?? undefined })
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
    })
    setOpen(true)
  }

  const envoyerFacturation = async (c: Client, action?: FacturationAction) => {
    if (!webhookConfigured) {
      alert(
        'Configurez d’abord l’URL webhook Make dans Mon entreprise → Facturation (Make → Tiime, Pennylane…).',
      )
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
      alert(result.message || `Client envoyé vers ${plateforme} via Make.`)
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
        subtitle="Cadre [2] du CERFA — prérempli sur chaque intervention. Envoi vers facturation sans double saisie."
        onAdd={() => {
          setEditId(null)
          setForm(blank())
          setOpen(true)
        }}
      />

      {!webhookConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-slate">
          Pour créer un devis / facture sans ressaisir : allez dans{' '}
          <strong>Mon entreprise</strong>, section Facturation, collez votre webhook Make et choisissez{' '}
          {plateforme} (ou Pennylane, Sellsy…).
        </div>
      )}

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Rechercher un client, ville, téléphone…"
        testId="clients-search"
      />

      {open && (
        <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
          <Field label="Raison sociale *" value={form.raisonSociale} onChange={(v) => setForm({ ...form, raisonSociale: v })} required />
          <Field label="Contact" value={form.nomContact} onChange={(v) => setForm({ ...form, nomContact: v })} />
          <Field label="Adresse" value={form.adresse} onChange={(v) => setForm({ ...form, adresse: v })} className="sm:col-span-2" />
          <Field label="Code postal" value={form.codePostal} onChange={(v) => setForm({ ...form, codePostal: v })} />
          <Field label="Ville" value={form.ville} onChange={(v) => setForm({ ...form, ville: v })} />
          <Field label="Téléphone" value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="SIRET (facturation)" value={form.siret || ''} onChange={(v) => setForm({ ...form, siret: v })} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover">
              Enregistrer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-5 py-2.5 text-sm">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-mist/80 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Ville</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Contact</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{c.raisonSociale}</div>
                  <div className="text-xs text-muted sm:hidden">{c.ville}</div>
                  {(c.devisLien || c.factureLien) && (
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
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
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">{c.ville}</td>
                <td className="hidden px-4 py-3 md:table-cell">{c.nomContact || c.telephone}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    title={`Envoyer vers ${plateforme} (Make)`}
                    disabled={sendingId === c.id}
                    onClick={() => void envoyerFacturation(c)}
                    className="rounded-lg p-2 text-accent hover:bg-accent-soft disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => startEdit(c)} className="rounded-lg p-2 text-accent hover:bg-accent-soft">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Supprimer ce client ?')) deleteClient(c.id)
                    }}
                    className="rounded-lg p-2 text-danger hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  {data.clients.length === 0
                    ? 'Aucun client — ajoutez un détenteur.'
                    : 'Aucun résultat pour cette recherche.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
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
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  required?: boolean
  type?: string
  className?: string
  step?: string
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-muted">{label}</span>
      <input
        type={type}
        step={step}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
      />
    </label>
  )
}
