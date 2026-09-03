import { type FormEvent, useMemo, useState } from 'react'
import {
  BookUser,
  Mail,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { SearchField, matchesQuery } from '../components/SearchField'
import { MobileFab } from '../components/MobileFab'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field } from './ClientsPage'
import {
  CONTACT_CARNET_TYPE_LABELS,
  blankContactCarnet,
  contactCarnetDisplayName,
  mailPresetsPourContact,
  mailtoHrefContact,
  parseContactCarnetType,
  telHrefContact,
  type ContactCarnet,
  type ContactCarnetType,
} from '../lib/carnetContacts'

type FiltreType = 'tous' | ContactCarnetType

export function CarnetContactsPage() {
  const { data, upsertContactCarnet, deleteContactCarnet } = useStore()
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState<FiltreType>('tous')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blankContactCarnet())
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const list = data.contactsCarnet || []

  const filtered = useMemo(() => {
    return [...list]
      .filter((c) => (filtre === 'tous' ? true : c.type === filtre))
      .filter((c) =>
        matchesQuery(
          [c.nom, c.nomContact, c.telephone, c.email, c.ville, c.specialite, c.notes]
            .filter(Boolean)
            .join(' '),
          q,
        ),
      )
      .sort((a, b) => {
        if (Boolean(a.favori) !== Boolean(b.favori)) return a.favori ? -1 : 1
        return a.nom.localeCompare(b.nom, 'fr')
      })
  }, [list, filtre, q])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.nom.trim()) {
      alert('Indiquez le nom (raison sociale / enseigne).')
      return
    }
    if (!form.telephone.trim() && !form.email.trim()) {
      alert('Ajoutez au moins un téléphone ou un e-mail.')
      return
    }
    upsertContactCarnet({
      ...form,
      id: editId ?? undefined,
      type: parseContactCarnetType(form.type),
    })
    setForm(blankContactCarnet(form.type))
    setEditId(null)
    setOpen(false)
  }

  const startEdit = (c: ContactCarnet) => {
    setEditId(c.id)
    setForm({
      type: c.type,
      nom: c.nom,
      nomContact: c.nomContact || '',
      telephone: c.telephone || '',
      email: c.email || '',
      adresse: c.adresse || '',
      codePostal: c.codePostal || '',
      ville: c.ville || '',
      specialite: c.specialite || '',
      notes: c.notes || '',
      favori: Boolean(c.favori),
    })
    setOpen(true)
  }

  const toggleFavori = (c: ContactCarnet) => {
    upsertContactCarnet({
      type: c.type,
      nom: c.nom,
      nomContact: c.nomContact,
      telephone: c.telephone,
      email: c.email,
      adresse: c.adresse,
      codePostal: c.codePostal,
      ville: c.ville,
      specialite: c.specialite,
      notes: c.notes,
      favori: !c.favori,
      id: c.id,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-800">
            <BookUser className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">Carnet contacts</h1>
            <p className="mt-1 text-muted">
              Fournisseurs habituels, centres de formation, sous-traitants — pour appeler ou
              envoyer un e-mail (devis, commande…).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditId(null)
            setForm(blankContactCarnet(filtre === 'tous' ? 'fournisseur' : filtre))
            setOpen(true)
          }}
          className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['tous', 'Tous'],
            ['fournisseur', 'Fournisseurs'],
            ['centre_formation', 'Formation'],
            ['sous_traitant', 'Sous-traitants'],
            ['autre', 'Autres'],
          ] as const
        ).map(([id, label]) => {
          const on = filtre === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFiltre(id)}
              className={[
                'min-h-10 rounded-xl border px-3 text-sm font-semibold',
                on ? 'border-sky-400 bg-sky-50 text-sky-950' : 'border-line bg-white text-ink',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Rechercher un fournisseur, formation, sous-traitant…"
        testId="carnet-search"
      />

      {open && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 block text-sm font-semibold text-ink">Type</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CONTACT_CARNET_TYPE_LABELS) as ContactCarnetType[]).map((id) => {
                const on = form.type === id
                return (
                  <label
                    key={id}
                    className={[
                      'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold',
                      on ? 'border-sky-400 bg-sky-50 text-sky-950' : 'border-line bg-white',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="contactType"
                      checked={on}
                      onChange={() => setForm({ ...form, type: id })}
                      className="accent-sky-700"
                    />
                    {CONTACT_CARNET_TYPE_LABELS[id]}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <Field
            label="Nom / raison sociale *"
            value={form.nom}
            onChange={(v) => setForm({ ...form, nom: v })}
            required
          />
          <Field
            label="Personne à joindre"
            value={form.nomContact || ''}
            onChange={(v) => setForm({ ...form, nomContact: v })}
          />
          <Field
            label="Téléphone"
            value={form.telephone}
            onChange={(v) => setForm({ ...form, telephone: v })}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />
          <Field
            label="E-mail"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            type="email"
            autoComplete="email"
          />
          <Field
            label="Spécialité"
            value={form.specialite || ''}
            onChange={(v) => setForm({ ...form, specialite: v })}
            className="sm:col-span-2"
          />
          <Field
            label="Adresse"
            value={form.adresse || ''}
            onChange={(v) => setForm({ ...form, adresse: v })}
            className="sm:col-span-2"
          />
          <Field
            label="Code postal"
            value={form.codePostal || ''}
            onChange={(v) => setForm({ ...form, codePostal: v })}
            inputMode="numeric"
          />
          <Field
            label="Ville"
            value={form.ville || ''}
            onChange={(v) => setForm({ ...form, ville: v })}
          />
          <label className="sm:col-span-2 block text-sm">
            <span className="mb-1 block font-semibold text-ink">Notes</span>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-ink"
            />
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={Boolean(form.favori)}
              onChange={(e) => setForm({ ...form, favori: e.target.checked })}
              className="accent-amber-500"
            />
            Favori (en haut de liste)
          </label>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              className="min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              {editId ? 'Enregistrer' : 'Ajouter au carnet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setEditId(null)
                setForm(blankContactCarnet())
              }}
              className="min-h-12 rounded-full border border-line bg-white px-5 text-sm font-semibold"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {filtered.map((c) => {
          const tel = telHrefContact(c.telephone)
          const mail = mailtoHrefContact(c.email)
          const presets = mailPresetsPourContact(c)
          return (
            <li
              key={c.id}
              className="rounded-2xl border border-line bg-white p-4 shadow-sm"
              data-testid={`carnet-card-${c.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.favori ? (
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden />
                    ) : null}
                    <h2 className="truncate text-lg font-bold text-ink">
                      {contactCarnetDisplayName(c)}
                    </h2>
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {CONTACT_CARNET_TYPE_LABELS[c.type]}
                    </span>
                  </div>
                  {c.specialite ? (
                    <p className="mt-0.5 text-sm text-muted">{c.specialite}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-ink">
                    {c.telephone ? <span className="mr-3">☎ {c.telephone}</span> : null}
                    {c.email ? <span>✉ {c.email}</span> : null}
                  </p>
                  {(c.ville || c.adresse) && (
                    <p className="mt-1 text-xs text-muted">
                      {[c.adresse, c.codePostal, c.ville].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {c.notes ? <p className="mt-2 text-xs text-muted">{c.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFavori(c)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold"
                    title="Favori"
                  >
                    <Star
                      className={[
                        'h-3.5 w-3.5',
                        c.favori ? 'fill-amber-400 text-amber-500' : 'text-muted',
                      ].join(' ')}
                    />
                    Favori
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDelete({ id: c.id, name: contactCarnetDisplayName(c) })
                    }
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {tel ? (
                  <a
                    href={tel}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white"
                  >
                    <Phone className="h-4 w-4" /> Appeler
                  </a>
                ) : null}
                {mail ? (
                  <a
                    href={mail}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold"
                  >
                    <Mail className="h-4 w-4" /> E-mail
                  </a>
                ) : null}
                {presets.map((p) => {
                  const href = mailtoHrefContact(c.email, {
                    subject: p.subject,
                    body: p.body,
                  })
                  if (!href) return null
                  return (
                    <a
                      key={p.id}
                      href={href}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-950"
                    >
                      <Mail className="h-4 w-4" /> {p.label}
                    </a>
                  )
                })}
              </div>
            </li>
          )
        })}
        {!filtered.length && (
          <li className="rounded-2xl border border-dashed border-line bg-white/80 p-8 text-center text-sm text-muted">
            {list.length === 0
              ? 'Carnet vide — ajoutez vos fournisseurs, centres de formation et sous-traitants.'
              : 'Aucun contact ne correspond à la recherche.'}
          </li>
        )}
      </ul>

      <MobileFab
        onClick={() => {
          setEditId(null)
          setForm(blankContactCarnet(filtre === 'tous' ? 'fournisseur' : filtre))
          setOpen(true)
        }}
        label="Ajouter un contact"
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Supprimer ce contact ?"
        message={
          pendingDelete
            ? `« ${pendingDelete.name} » sera retiré du carnet (synchro société).`
            : ''
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (pendingDelete) deleteContactCarnet(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
