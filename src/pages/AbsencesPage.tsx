import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Check, Plus, Send, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import { isBureauUi } from '../lib/uiMode'
import { dossierForUser } from '../lib/rhDocuments'
import {
  ABSENCE_MOTIF_OPTIONS,
  ABSENCE_STATUT_LABELS,
  ABSENCE_TYPE_LABELS,
  absenceConsommeSolde,
  blankDemandeAbsence,
  compterJoursOuvres,
  demandesEnAttente,
  demandesPourTech,
  soldeCongesOf,
  soldeRttOf,
  titreDemandeAbsence,
  type AbsenceStatut,
  type AbsenceType,
  type DemandeAbsence,
} from '../lib/demandesAbsence'
import { MobileFab } from '../components/MobileFab'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const STATUT_TONE: Record<AbsenceStatut, string> = {
  brouillon: 'bg-mist text-muted',
  en_attente: 'bg-amber-100 text-amber-950',
  validee: 'bg-emerald-100 text-emerald-950',
  refusee: 'bg-rose-100 text-rose-950',
  annulee: 'bg-slate-100 text-slate-600',
}

export function AbsencesPage() {
  const {
    data,
    upsertDemandeAbsence,
    soumettreDemandeAbsence,
    decideDemandeAbsence,
    annulerDemandeAbsence,
    peutVoirIdentitesRh,
  } = useStore()
  const { user, isOwner } = useAuth()
  const bureau = isBureauUi({ isOwner: Boolean(isOwner), peutVoirIdentitesRh })
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [refusId, setRefusId] = useState<string | null>(null)
  const [refusMotif, setRefusMotif] = useState('')
  const [form, setForm] = useState(() =>
    blankDemandeAbsence({
      technicienUserId: user?.id || '',
      technicienName: user?.fullName || user?.email,
      createdByUserId: user?.id,
      createdByName: user?.fullName || user?.email,
    }),
  )

  const monDossier = useMemo(
    () => dossierForUser(data.personnelDossiers, user?.id),
    [data.personnelDossiers, user?.id],
  )

  const liste = useMemo(() => {
    if (bureau) {
      return [...(data.demandesAbsence || [])].sort((a, b) =>
        (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      )
    }
    return demandesPourTech(data.demandesAbsence, user?.id)
  }, [bureau, data.demandesAbsence, user?.id])

  const enAttente = useMemo(
    () => (bureau ? demandesEnAttente(data.demandesAbsence) : []),
    [bureau, data.demandesAbsence],
  )

  useEffect(() => {
    const id = searchParams.get('id') || ''
    if (!id) return
    const dem = (data.demandesAbsence || []).find((d) => d.id === id)
    if (dem) {
      setEditId(dem.id)
      setForm({ ...blankDemandeAbsence({ technicienUserId: dem.technicienUserId }), ...dem })
      setOpen(true)
    }
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next, { replace: true })
  }, [searchParams, data.demandesAbsence, setSearchParams])

  const openCreate = () => {
    setEditId(null)
    setForm(
      blankDemandeAbsence({
        technicienUserId: user?.id || '',
        technicienName: user?.fullName || user?.email,
        createdByUserId: user?.id,
        createdByName: user?.fullName || user?.email,
        source: bureau ? 'bureau' : 'formulaire',
      }),
    )
    setOpen(true)
  }

  const startEdit = (d: DemandeAbsence) => {
    if (!bureau && d.technicienUserId !== user?.id) return
    if (!bureau && d.statut !== 'brouillon' && d.statut !== 'refusee') return
    setEditId(d.id)
    setForm({ ...blankDemandeAbsence({ technicienUserId: d.technicienUserId }), ...d })
    setOpen(true)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.dateDebut || !form.dateFin) {
      alert('Indiquez les dates de début et de fin.')
      return
    }
    if (form.dateFin < form.dateDebut) {
      alert('La date de fin doit être après (ou égale) au début.')
      return
    }
    const techId = bureau && form.technicienUserId ? form.technicienUserId : user?.id || ''
    if (!techId) {
      alert('Technicien manquant.')
      return
    }
    const jours = compterJoursOuvres(form.dateDebut, form.dateFin)
    upsertDemandeAbsence({
      ...form,
      id: editId || undefined,
      technicienUserId: techId,
      technicienName:
        form.technicienName ||
        (techId === user?.id ? user?.fullName || user?.email : form.technicienName),
      joursDemandes: jours,
      statut: editId
        ? form.statut === 'refusee'
          ? 'brouillon'
          : form.statut || 'brouillon'
        : 'brouillon',
      source: form.source || (bureau ? 'bureau' : 'formulaire'),
      createdByUserId: form.createdByUserId || user?.id,
      createdByName: form.createdByName || user?.fullName || user?.email,
    })
    setOpen(false)
    setEditId(null)
  }

  const envoyer = (id: string) => {
    soumettreDemandeAbsence(id)
  }

  const soldeCp = soldeCongesOf(monDossier)
  const soldeRtt = soldeRttOf(monDossier)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Absences & congés</h1>
          <p className="mt-1 text-muted">
            {bureau
              ? 'Validez ou refusez les demandes — une validation pose l’absence dans l’agenda.'
              : 'Remplissez la feuille, vérifiez, puis envoyez à la direction. Plus de papier.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="hidden min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink hover:bg-accent-hover md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Nouvelle demande
        </button>
      </div>

      {!bureau && (soldeCp !== undefined || soldeRtt !== undefined) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {soldeCp !== undefined ? (
            <div className="rounded-2xl border border-line bg-white px-4 py-3">
              <div className="text-[11px] font-bold uppercase text-muted">Solde congés</div>
              <div className="mt-0.5 font-display text-2xl font-bold">{soldeCp} j</div>
            </div>
          ) : null}
          {soldeRtt !== undefined ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3">
              <div className="text-[11px] font-bold uppercase text-sky-900">Solde RTT</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-sky-950">{soldeRtt} j</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {bureau && enAttente.length > 0 ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-display text-base font-bold text-amber-950">
            À valider ({enAttente.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {enAttente.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm"
              >
                <p className="font-semibold text-ink">{titreDemandeAbsence(d)}</p>
                <p className="text-xs text-muted">
                  {d.joursDemandes} j ouvrés
                  {d.motif ? ` · ${d.motif}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      decideDemandeAbsence(d.id, 'validee', {
                        userId: user?.id,
                        userName: user?.fullName || user?.email,
                      })
                    }
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f766e] px-3 text-xs font-extrabold text-white"
                  >
                    <Check className="h-3.5 w-3.5" /> Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefusId(d.id)
                      setRefusMotif('')
                    }}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-extrabold text-rose-900"
                  >
                    <X className="h-3.5 w-3.5" /> Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {open ? (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          <h2 className="font-display text-lg font-semibold sm:col-span-2">
            {editId ? 'Modifier la demande' : 'Nouvelle demande d’absence'}
          </h2>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Motif *</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as AbsenceType })}
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
              required
            >
              {ABSENCE_MOTIF_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {ABSENCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">
              Même liste que l’agenda (Absent) : vacances, CP, RTT, maladie, paternité…
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Jours (ouvrés)</span>
            <input
              readOnly
              value={compterJoursOuvres(form.dateDebut, form.dateFin)}
              className="h-11 w-full rounded-xl border border-line bg-mist/40 px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Du *</span>
            <input
              type="date"
              value={form.dateDebut}
              onChange={(e) => {
                const dateDebut = e.target.value || today()
                setForm({
                  ...form,
                  dateDebut,
                  dateFin: form.dateFin < dateDebut ? dateDebut : form.dateFin,
                  joursDemandes: compterJoursOuvres(
                    dateDebut,
                    form.dateFin < dateDebut ? dateDebut : form.dateFin,
                  ),
                })
              }}
              required
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Au *</span>
            <input
              type="date"
              value={form.dateFin}
              min={form.dateDebut}
              onChange={(e) => {
                const dateFin = e.target.value || form.dateDebut
                setForm({
                  ...form,
                  dateFin,
                  joursDemandes: compterJoursOuvres(form.dateDebut, dateFin),
                })
              }}
              required
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold">Précisions (optionnel)</span>
            <input
              value={form.motif || ''}
              onChange={(e) => setForm({ ...form, motif: e.target.value })}
              placeholder="Ex. pont du 1er mai, certificat…"
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold">Notes</span>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-line bg-white px-3 py-2"
            />
          </label>
          {!bureau && absenceConsommeSolde(form.type) === 'conges' && soldeCp !== undefined ? (
            <p className="text-xs text-muted sm:col-span-2">
              Solde CP : <strong>{soldeCp} j</strong> — demande{' '}
              {compterJoursOuvres(form.dateDebut, form.dateFin)} j
              {compterJoursOuvres(form.dateDebut, form.dateFin) > soldeCp
                ? ' (au-delà du solde — la direction tranchera).'
                : '.'}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink"
            >
              Enregistrer le brouillon
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setEditId(null)
              }}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      {refusId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            decideDemandeAbsence(refusId, 'refusee', {
              userId: user?.id,
              userName: user?.fullName || user?.email,
              motifRefus: refusMotif,
            })
            setRefusId(null)
          }}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
        >
          <h3 className="font-semibold text-rose-950">Motif du refus</h3>
          <input
            value={refusMotif}
            onChange={(e) => setRefusMotif(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-rose-200 bg-white px-3"
            placeholder="Ex. Effectif insuffisant cette semaine"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Confirmer le refus
            </button>
            <button
              type="button"
              onClick={() => setRefusId(null)}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-2">
        {liste.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-muted">
            Aucune demande — créez une feuille d’absence ou demandez à Lola (« pose mes congés du …
            au … »).
          </p>
        ) : (
          liste.map((d) => (
            <article
              key={d.id}
              className="rounded-2xl border border-line bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{titreDemandeAbsence(d)}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUT_TONE[d.statut]}`}
                    >
                      {ABSENCE_STATUT_LABELS[d.statut]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {d.joursDemandes} j ouvrés
                    {d.motif ? ` · ${d.motif}` : ''}
                    {d.motifRefus ? ` · Refus : ${d.motifRefus}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(d.statut === 'brouillon' || d.statut === 'refusee') &&
                  (bureau || d.technicienUserId === user?.id) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(d)}
                        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => envoyer(d.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Send className="h-3 w-3" /> Envoyer à la direction
                      </button>
                    </>
                  ) : null}
                  {(d.statut === 'brouillon' || d.statut === 'en_attente') &&
                  d.technicienUserId === user?.id ? (
                    <button
                      type="button"
                      onClick={() => annulerDemandeAbsence(d.id)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-muted"
                    >
                      Annuler
                    </button>
                  ) : null}
                  {bureau && d.statut === 'en_attente' ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          decideDemandeAbsence(d.id, 'validee', {
                            userId: user?.id,
                            userName: user?.fullName || user?.email,
                          })
                        }
                        className="rounded-full bg-[#0f766e] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRefusId(d.id)
                          setRefusMotif('')
                        }}
                        className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900"
                      >
                        Refuser
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <MobileFab label="Demande" hidden={open} onClick={openCreate} />
    </div>
  )
}
