import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import type { UserAccount } from '../lib/auth'
import { Field } from './ClientsPage'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Nav3dIcon } from '../components/Nav3dIcon'
import {
  addYearsIso,
  alertesPourDossier,
  catalogDocumentRh,
  defaultPersonnelDossier,
  dossierForUser,
  fileToDocumentScanDataUrl,
  formatDateFr,
  labelStatutDocumentRh,
  resumeAlertesDossier,
  statutDocumentRh,
  TYPES_DOCUMENT_RH,
  typesRequisPourDossier,
  type DocumentRh,
  type PersonnelDossier,
  type StatutDocumentRh,
  type TypeDocumentRh,
} from '../lib/rhDocuments'

type DocForm = {
  id?: string
  type: TypeDocumentRh
  libelle: string
  numero: string
  dateObtention: string
  dateExpiration: string
  notes: string
  fichierNom?: string
  fichierDataUrl?: string
}

const blankDoc = (): DocForm => ({
  type: 'cni',
  libelle: '',
  numero: '',
  dateObtention: '',
  dateExpiration: '',
  notes: '',
})

function statutClass(statut: StatutDocumentRh) {
  if (statut === 'expire' || statut === 'manquant') return 'bg-red-100 text-red-800'
  if (statut === 'bientot') return 'bg-amber-100 text-amber-900'
  if (statut === 'sans_date') return 'bg-slate-100 text-slate-700'
  return 'bg-emerald-100 text-emerald-800'
}

export function TechnicienDossierPage() {
  const { userId } = useParams()
  const { user, isOwner, listTeam } = useAuth()
  const { data, upsertPersonnelDossier, upsertPersonnelDocument, deletePersonnelDocument } =
    useStore()
  const [member, setMember] = useState<UserAccount | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<DocForm>(blankDoc)
  const [fileError, setFileError] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentRh | null>(null)

  const canAccess = Boolean(user && userId && (isOwner || user.id === userId))

  useEffect(() => {
    if (!canAccess || !isOwner) return
    void listTeam().then((team) => {
      setMember(team.find((m) => m.id === userId) || null)
    })
  }, [canAccess, isOwner, listTeam, userId])

  const stored = dossierForUser(data.personnelDossiers, userId)
  const displayName =
    member?.fullName ||
    (userId === user?.id ? user?.fullName : '') ||
    stored?.userName ||
    'Technicien'
  const dossier: PersonnelDossier = useMemo(
    () =>
      stored || {
        id: '',
        ...defaultPersonnelDossier(userId || '', displayName),
      },
    [stored, userId, displayName],
  )

  const [toucheFroid, setToucheFroid] = useState(dossier.toucheFroid)
  const [toucheElectricite, setToucheElectricite] = useState(dossier.toucheElectricite)
  const [conduitVehicule, setConduitVehicule] = useState(dossier.conduitVehicule)
  const [notes, setNotes] = useState(dossier.notes || '')

  useEffect(() => {
    setToucheFroid(dossier.toucheFroid)
    setToucheElectricite(dossier.toucheElectricite)
    setConduitVehicule(dossier.conduitVehicule)
    setNotes(dossier.notes || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored?.id, stored?.updatedAt, displayName])

  const alerts = useMemo(
    () => alertesPourDossier({ ...dossier, userName: displayName }),
    [dossier, displayName],
  )
  const resume = useMemo(
    () => resumeAlertesDossier({ ...dossier, userName: displayName }),
    [dossier, displayName],
  )
  const requis = typesRequisPourDossier(dossier)

  if (!userId) return <Navigate to="/app/equipe" replace />
  if (!user) return <Navigate to="/login" replace />
  if (!canAccess) return <Navigate to="/app" replace />

  const persistActivite = () => {
    upsertPersonnelDossier({
      id: stored?.id,
      userId,
      userName: displayName,
      toucheFroid,
      toucheElectricite,
      conduitVehicule,
      notes,
      documents: stored?.documents,
    })
  }

  const openNew = (type?: TypeDocumentRh) => {
    setForm({ ...blankDoc(), type: type || 'cni' })
    setFileError('')
    setFormOpen(true)
  }

  const openEdit = (doc: DocumentRh) => {
    setForm({
      id: doc.id,
      type: doc.type,
      libelle: doc.libelle || '',
      numero: doc.numero || '',
      dateObtention: doc.dateObtention || '',
      dateExpiration: doc.dateExpiration || '',
      notes: doc.notes || '',
      fichierNom: doc.fichierNom,
      fichierDataUrl: doc.fichierDataUrl,
    })
    setFileError('')
    setFormOpen(true)
  }

  const onSaveDoc = (e: FormEvent) => {
    e.preventDefault()
    upsertPersonnelDocument(userId, displayName, {
      id: form.id,
      type: form.type,
      libelle: form.libelle,
      numero: form.numero,
      dateObtention: form.dateObtention,
      dateExpiration: form.dateExpiration,
      notes: form.notes,
      fichierNom: form.fichierNom,
      fichierDataUrl: form.fichierDataUrl,
    })
    if (!stored) {
      upsertPersonnelDossier({
        userId,
        userName: displayName,
        toucheFroid,
        toucheElectricite,
        conduitVehicule,
        notes,
      })
    }
    setFormOpen(false)
    setForm(blankDoc())
  }

  const proposerExpiration = () => {
    const years = catalogDocumentRh(form.type).dureeIndicativeAns
    if (!years || !form.dateObtention) return
    setForm((f) => ({ ...f, dateExpiration: addYearsIso(f.dateObtention, years) }))
  }

  const backTo = isOwner && userId !== user.id ? '/app/equipe' : '/app/profil'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Nav3dIcon to={backTo} size={52} float delay="0.1s" className="shrink-0" />
        <div className="min-w-0">
          <Link to={backTo} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
            <ArrowLeft className="h-3.5 w-3.5" />
            {isOwner && userId !== user.id ? 'Équipe' : 'Ma signature'}
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dossier {displayName}</h1>
          <p className="mt-1 text-sm text-muted">
            {member?.email || (userId === user.id ? user.email : '')} — pièces d’identité, permis,
            aptitude froid, habilitation électrique, avec date limite et alerte.
          </p>
        </div>
      </div>

      {resume.total > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <div className="font-display font-semibold text-ink">Alertes documents</div>
          <p className="mt-1 text-muted">
            {resume.expire ? `${resume.expire} expiré${resume.expire > 1 ? 's' : ''}` : null}
            {resume.expire && (resume.bientot || resume.manquant) ? ' · ' : null}
            {resume.bientot ? `${resume.bientot} bientôt` : null}
            {(resume.expire || resume.bientot) && resume.manquant ? ' · ' : null}
            {resume.manquant ? `${resume.manquant} manquant${resume.manquant > 1 ? 's' : ''}` : null}
            {resume.sansDate ? ` · ${resume.sansDate} sans date` : null}
          </p>
          <ul className="mt-2 space-y-1">
            {alerts.slice(0, 8).map((a) => (
              <li key={`${a.type}-${a.documentId || 'miss'}`} className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statutClass(a.statut)}`}>
                  {labelStatutDocumentRh(a.statut)}
                </span>
                <span className="font-medium text-ink">{a.label}</span>
                {a.dateExpiration ? (
                  <span className="text-muted">limite {formatDateFr(a.dateExpiration)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-lg font-semibold">Activité du poste</h2>
        <p className="mt-1 text-sm text-muted">
          Ça détermine les pièces obligatoires. Décochez si le collègue ne fait jamais ça.
        </p>
        <div className="mt-3 grid gap-2 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={toucheFroid}
              onChange={(e) => setToucheFroid(e.target.checked)}
            />
            <span>
              <strong>Froid / fluides</strong> — attestation d’aptitude F-Gas (cat. I à IV) obligatoire.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={toucheElectricite}
              onChange={(e) => setToucheElectricite(e.target.checked)}
            />
            <span>
              <strong>Électricité</strong> — habilitation (BR, B1V…) obligatoire pour tout ce qui touche
              au tableau / raccordement.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={conduitVehicule}
              onChange={(e) => setConduitVehicule(e.target.checked)}
            />
            <span>
              <strong>Conduite</strong> — permis de conduire si véhicule société ou perso pour les
              chantiers.
            </span>
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-semibold text-ink">Notes RH</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-line px-3 py-2"
            placeholder="Catégorie aptitude, niveau d’habilitation prévu…"
          />
        </label>
        <button
          type="button"
          onClick={persistActivite}
          className="mt-3 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
        >
          Enregistrer l’activité
        </button>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Pièces à jour</h2>
          <button
            type="button"
            onClick={() => openNew()}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Ajouter un document
          </button>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {requis.map((type) => {
            const identite = catalogDocumentRh(type).identite
            const docs = identite
              ? dossier.documents.filter((d) => catalogDocumentRh(d.type).identite)
              : dossier.documents.filter((d) => d.type === type)
            const worst: StatutDocumentRh = docs.length
              ? docs
                  .map((d) => statutDocumentRh(d))
                  .sort((a, b) => {
                    const order: Record<StatutDocumentRh, number> = {
                      expire: 0,
                      manquant: 1,
                      bientot: 2,
                      sans_date: 3,
                      ok: 4,
                    }
                    return order[a] - order[b]
                  })[0]
              : 'manquant'
            return (
              <li key={type} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{catalogDocumentRh(type).label}</div>
                    <p className="mt-0.5 text-xs text-muted">{catalogDocumentRh(type).hint}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${statutClass(worst)}`}>
                    {labelStatutDocumentRh(worst)}
                  </span>
                </div>
                {docs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openNew(type)}
                    className="mt-2 text-xs font-semibold text-accent hover:underline"
                  >
                    Ajouter
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    {docs
                      .map((d) =>
                        d.dateExpiration ? `limite ${formatDateFr(d.dateExpiration)}` : 'sans date',
                      )
                      .join(' · ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3 font-display font-semibold">
          Documents enregistrés ({dossier.documents.length})
        </div>
        {dossier.documents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            Aucun document pour l’instant. Ajoutez au minimum : identité, carte Vitale, visite
            médicale, aptitude froid, habilitation électrique, permis.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {dossier.documents.map((doc) => {
              const st = statutDocumentRh(doc)
              return (
                <li key={doc.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted" />
                      <span className="font-medium">
                        {catalogDocumentRh(doc.type).label}
                        {doc.libelle ? ` — ${doc.libelle}` : ''}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statutClass(st)}`}>
                        {labelStatutDocumentRh(st)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {doc.numero ? `n° ${doc.numero} · ` : ''}
                      {doc.dateObtention ? `obtenu ${formatDateFr(doc.dateObtention)} · ` : ''}
                      {doc.dateExpiration
                        ? `limite ${formatDateFr(doc.dateExpiration)}`
                        : 'pas de date limite'}
                    </p>
                    {doc.fichierDataUrl ? (
                      doc.fichierDataUrl.startsWith('data:image/') ? (
                        <a href={doc.fichierDataUrl} target="_blank" rel="noreferrer">
                          <img
                            src={doc.fichierDataUrl}
                            alt={doc.fichierNom || 'scan'}
                            className="mt-2 h-16 rounded-lg border border-line object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={doc.fichierDataUrl}
                          download={doc.fichierNom || 'document.pdf'}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent"
                        >
                          <FileText className="h-3.5 w-3.5" /> {doc.fichierNom || 'Fichier'}
                        </a>
                      )
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(doc)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(doc)}
                      className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-mist"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">
        Autres pièces utiles selon les chantiers : SST, CACES nacelle, travail en hauteur, AIPR,
        amiante SS4, RIB, contrat, diplôme. L’attestation de capacité société et le contrôle
        annuel du détecteur restent dans Mon entreprise — ce n’est pas le dossier individuel.
      </p>

      {formOpen && (
        <form
          onSubmit={onSaveDoc}
          className="grid gap-3 rounded-2xl border border-accent/40 bg-white p-5 sm:grid-cols-2"
        >
          <h2 className="font-display text-lg font-semibold sm:col-span-2">
            {form.id ? 'Modifier le document' : 'Nouveau document'}
          </h2>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Type *</span>
            <select
              required
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TypeDocumentRh }))}
              className="h-12 w-full rounded-xl border border-line px-3"
            >
              {TYPES_DOCUMENT_RH.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">{catalogDocumentRh(form.type).hint}</span>
          </label>
          <Field
            label="Précision (cat. I, BR, CACES…)"
            value={form.libelle}
            onChange={(v) => setForm((f) => ({ ...f, libelle: v }))}
          />
          <Field
            label="N° / référence"
            value={form.numero}
            onChange={(v) => setForm((f) => ({ ...f, numero: v }))}
          />
          <Field
            label="Date d’obtention"
            type="date"
            value={form.dateObtention}
            onChange={(v) => setForm((f) => ({ ...f, dateObtention: v }))}
          />
          <div>
            <Field
              label="Date limite / expiration"
              type="date"
              value={form.dateExpiration}
              onChange={(v) => setForm((f) => ({ ...f, dateExpiration: v }))}
            />
            {catalogDocumentRh(form.type).dureeIndicativeAns && form.dateObtention ? (
              <button
                type="button"
                onClick={proposerExpiration}
                className="mt-1 text-xs font-semibold text-accent hover:underline"
              >
                Proposer +{catalogDocumentRh(form.type).dureeIndicativeAns} ans
              </button>
            ) : (
              <p className="mt-1 text-xs text-muted">
                L’alerte se déclenche 45 jours avant cette date, puis le jour J.
              </p>
            )}
          </div>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Photo / scan</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={fileBusy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setFileError('')
                setFileBusy(true)
                void fileToDocumentScanDataUrl(file)
                  .then(({ dataUrl, nom }) => {
                    setForm((f) => ({ ...f, fichierDataUrl: dataUrl, fichierNom: nom }))
                  })
                  .catch((err) => setFileError(err instanceof Error ? err.message : 'Import impossible'))
                  .finally(() => setFileBusy(false))
              }}
              className="block w-full text-sm"
            />
            {form.fichierDataUrl?.startsWith('data:image/') ? (
              <img
                src={form.fichierDataUrl}
                alt=""
                className="mt-2 h-20 rounded-lg border border-line object-cover"
              />
            ) : form.fichierNom ? (
              <p className="mt-1 text-xs text-muted">{form.fichierNom}</p>
            ) : null}
            {fileError ? <p className="mt-1 text-xs text-danger">{fileError}</p> : null}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setForm(blankDoc())
              }}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-muted"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Supprimer ce document ?"
        message={
          pendingDelete
            ? `${catalogDocumentRh(pendingDelete.type).label} sera retiré du dossier.`
            : ''
        }
        onConfirm={() => {
          if (pendingDelete) deletePersonnelDocument(userId, pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
