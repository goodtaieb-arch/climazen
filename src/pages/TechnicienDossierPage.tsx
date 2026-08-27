import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Copy, ExternalLink, FileText, FolderOpen, Loader2, Plus, Trash2, X } from 'lucide-react'
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
  cloudRhAccepteCheminImbrique,
  defaultPersonnelDossier,
  dossierForUser,
  estDocumentRhAdminSeulement,
  fileToDocumentScanDataUrl,
  formatCheminCloudRh,
  formatDateFr,
  labelStatutDocumentRh,
  lienDossierCloudRh,
  normalizeLienCloudRh,
  resumeAlertesDossier,
  segmentsDossierCloudRh,
  statutDocumentRh,
  TYPES_DOCUMENT_RH,
  typesAMasquer,
  typesAffichesPourDossier,
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
  lienCloud: string
  lienCloudExpire: string
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
  lienCloud: '',
  lienCloudExpire: '',
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
  const { data, upsertPersonnelDossier, upsertPersonnelDocument, deletePersonnelDocument, peutVoirIdentitesRh } =
    useStore()
  const [member, setMember] = useState<UserAccount | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<DocForm>(blankDoc)
  const [fileError, setFileError] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentRh | null>(null)
  const [cheminCopie, setCheminCopie] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const canSeeIdentite = peutVoirIdentitesRh
  const canAccess = Boolean(user && userId && (canSeeIdentite || user.id === userId))

  useEffect(() => {
    if (!canAccess || !canSeeIdentite) return
    void listTeam().then((team) => {
      setMember(team.find((m) => m.id === userId) || null)
    })
  }, [canAccess, canSeeIdentite, listTeam, userId])

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

  useEffect(() => {
    if (!formOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFormOpen(false)
        setForm(blankDoc())
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [formOpen])

  const alerts = useMemo(
    () => alertesPourDossier({ ...dossier, userName: displayName }),
    [dossier, displayName],
  )
  const resume = useMemo(
    () => resumeAlertesDossier({ ...dossier, userName: displayName }),
    [dossier, displayName],
  )
  const pieces = typesAffichesPourDossier(dossier, { inclureAdmin: canSeeIdentite })

  if (!userId) return <Navigate to="/app/equipe" replace />
  if (!user) return <Navigate to="/login" replace />
  if (!canAccess) return <Navigate to="/app" replace />

  const defaultDocType: TypeDocumentRh = canSeeIdentite ? 'cni' : 'attestation_aptitude_froid'
  const racineCloud = data.operateur.lienCloudRhRacine
  const segsTech = segmentsDossierCloudRh({ techName: displayName })
  const cheminTech = formatCheminCloudRh(segsTech)
  const hrefDossierTech = lienDossierCloudRh(racineCloud, segsTech)
  const cloudImbrique = cloudRhAccepteCheminImbrique(racineCloud)
  const segsPiece = segmentsDossierCloudRh({ techName: displayName, type: form.type })
  const cheminPiece = formatCheminCloudRh(segsPiece)
  const hrefDossierPiece = lienDossierCloudRh(racineCloud, segsPiece)

  const copierChemin = (chemin: string) => {
    void navigator.clipboard?.writeText(chemin).then(() => {
      setCheminCopie(true)
      window.setTimeout(() => setCheminCopie(false), 1600)
    })
  }

  const persistDossier = (patch?: { typesMasques?: TypeDocumentRh[] }) => {
    upsertPersonnelDossier({
      id: stored?.id,
      userId,
      userName: displayName,
      toucheFroid,
      toucheElectricite,
      conduitVehicule,
      notes,
      documents: stored?.documents,
      typesMasques: patch?.typesMasques ?? stored?.typesMasques,
    })
  }

  const persistActivite = () => persistDossier()

  const masquerType = (type: TypeDocumentRh) => {
    persistDossier({
      typesMasques: [...new Set([...(stored?.typesMasques || []), ...typesAMasquer(type)])],
    })
  }

  const openNew = (type?: TypeDocumentRh) => {
    const nextType = type || defaultDocType
    if (!canSeeIdentite && estDocumentRhAdminSeulement(nextType)) return
    setForm({ ...blankDoc(), type: nextType })
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
      lienCloud: doc.lienCloud || '',
      lienCloudExpire: doc.lienCloudExpire || '',
      fichierNom: doc.fichierNom,
      fichierDataUrl: doc.fichierDataUrl,
    })
    setFileError('')
    setFormOpen(true)
  }

  const onSaveDoc = (e: FormEvent) => {
    e.preventDefault()
    if (!canSeeIdentite && estDocumentRhAdminSeulement(form.type)) {
      setFileError('Les pièces d’identité sont réservées à l’administration.')
      return
    }
    if (form.lienCloud.trim() && !normalizeLienCloudRh(form.lienCloud)) {
      setFileError('Lien invalide — collez un lien https (Drive, OneDrive, SharePoint).')
      return
    }
    upsertPersonnelDocument(userId, displayName, {
      id: form.id,
      type: form.type,
      libelle: form.libelle,
      numero: form.numero,
      dateObtention: form.dateObtention,
      dateExpiration: form.dateExpiration,
      notes: form.notes,
      lienCloud: form.lienCloud,
      lienCloudExpire: form.lienCloudExpire,
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

  const backTo = canSeeIdentite && userId !== user.id ? '/app/equipe' : '/app/profil'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Nav3dIcon to={backTo} size={52} float delay="0.1s" className="shrink-0" />
        <div className="min-w-0">
          <Link to={backTo} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
            <ArrowLeft className="h-3.5 w-3.5" />
            {canSeeIdentite && userId !== user.id ? 'Équipe' : 'Mon profil'}
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dossier {displayName}</h1>
          <p className="mt-1 text-sm text-muted">
            {member?.email || (userId === user.id ? user.email : '')} — dates limites et alertes
            d’expiration. Les scans d’identité ne sont pas enregistrés.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-mist/60 p-4 text-sm text-slate">
        <div className="font-display font-semibold text-ink">
          {canSeeIdentite ? 'Protection des identités' : 'Attestations & habilitations'}
        </div>
        {canSeeIdentite ? (
          <p className="mt-1">
            Les pièces d’identité (CNI, passeport, Vitale, RIB…) sont visibles{' '}
            <strong>seulement par le gérant</strong> et le personnel qu’il autorise (secrétariat,
            accueil d’appels). Un technicien ne voit pas celles d’un collègue. Les scans ne sont
            pas enregistrés — type, date limite, numéro masqué, lien cloud temporaire.
          </p>
        ) : (
          <p className="mt-1">
            Ici : aptitude fluides, habilitation électrique, CACES… Les pièces d’identité sont
            gérées par l’administration. Les scans ne sont pas enregistrés.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 text-sm">
        <div className="font-display font-semibold text-ink">Dossier cloud</div>
        {racineCloud ? (
          <>
            <p className="mt-1 font-medium text-ink">{cheminTech}</p>
            <p className="mt-1 text-muted">
              {cloudImbrique
                ? 'SharePoint / OneDrive : l’app ouvre le sous-dossier du technicien.'
                : 'Google Drive : ouvrez le dossier général, puis rangez dans ce chemin (l’app ne peut pas créer les sous-dossiers toute seule).'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hrefDossierTech ? (
                <a
                  href={hrefDossierTech}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-ink hover:bg-accent-hover"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le dossier
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => copierChemin(cheminTech)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold hover:bg-mist"
              >
                <Copy className="h-3.5 w-3.5" /> {cheminCopie ? 'Chemin copié' : 'Copier le chemin'}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-muted">
            Un seul lien général, collé par le gérant dans{' '}
            {isOwner ? (
              <Link to="/app/operateur" className="font-semibold text-accent underline">
                Mon entreprise
              </Link>
            ) : (
              <strong>Mon entreprise</strong>
            )}
            . L’app classe ensuite : ClimaZEN → Dossiers techniciens → {displayName}.
          </p>
        )}
      </div>

      {resume.total > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <div className="font-display font-semibold text-ink">Alertes d’expiration</div>
          <p className="mt-1 text-muted">
            {resume.expire ? `${resume.expire} expiré${resume.expire > 1 ? 's' : ''}` : null}
            {resume.expire && resume.bientot ? ' · ' : null}
            {resume.bientot ? `${resume.bientot} bientôt` : null}
            {(resume.expire || resume.bientot) && resume.sansDate ? ' · ' : null}
            {resume.sansDate ? `${resume.sansDate} sans date limite` : null}
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
          Ça aide à proposer des pièces. Décochez si le collègue ne fait jamais ça. Rien n’est
          obligatoire : masquez une pièce avec la croix rouge.
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
          <div>
            <h2 className="font-display text-lg font-semibold">Pièces à suivre</h2>
            <p className="mt-0.5 text-xs text-muted">
              Choisissez ce que vous avez. Croix rouge = retirer de la liste. Les alertes ne
              concernent que les dates d’expiration des pièces enregistrées.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openNew()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Ajouter un document
          </button>
        </div>
        {pieces.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Aucune pièce affichée.{' '}
            <button type="button" onClick={() => openNew()} className="font-semibold text-accent hover:underline">
              Ajoutez un document
            </button>
            {(stored?.typesMasques?.length || 0) > 0 ? (
              <>
                {' '}
                ou{' '}
                <button
                  type="button"
                  onClick={() => persistDossier({ typesMasques: [] })}
                  className="font-semibold text-accent hover:underline"
                >
                  réafficher les pièces masquées
                </button>
                .
              </>
            ) : (
              '.'
            )}
          </p>
        ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {pieces.map((type) => {
            const identite = catalogDocumentRh(type).identite
            const docs = identite
              ? dossier.documents.filter((d) => catalogDocumentRh(d.type).identite)
              : dossier.documents.filter((d) => d.type === type)
            const worst: StatutDocumentRh | null = docs.length
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
              : null
            return (
              <li key={type} className="relative rounded-xl border border-line p-3 pr-10">
                {docs.length === 0 ? (
                <button
                  type="button"
                  onClick={() => masquerType(type)}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                  aria-label={`Retirer ${catalogDocumentRh(type).label} de la liste`}
                  title="Retirer de la liste"
                >
                  <X className="h-5 w-5" strokeWidth={2.5} />
                </button>
                ) : null}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{catalogDocumentRh(type).label}</div>
                    <p className="mt-0.5 text-xs text-muted">{catalogDocumentRh(type).hint}</p>
                  </div>
                  {worst ? (
                    <span className={`mr-6 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${statutClass(worst)}`}>
                      {labelStatutDocumentRh(worst)}
                    </span>
                  ) : null}
                </div>
                {docs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openNew(type)}
                    className="mt-2 inline-flex min-h-9 items-center rounded-full bg-accent px-3 text-xs font-semibold text-ink hover:bg-accent-hover"
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
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3 font-display font-semibold">
          Documents enregistrés ({dossier.documents.length})
        </div>
        {dossier.documents.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            Aucun document pour l’instant. Ajoutez seulement les pièces dont vous avez une copie.
            L’alerte se déclenche sur la date limite.
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
                      {doc.numero ? `réf. ${doc.numero} · ` : ''}
                      {doc.dateObtention ? `obtenu ${formatDateFr(doc.dateObtention)} · ` : ''}
                      {doc.dateExpiration
                        ? `limite ${formatDateFr(doc.dateExpiration)}`
                        : 'pas de date limite'}
                      {doc.scanConfirme ? ' · scan vu (non stocké)' : ''}
                    </p>
                    {doc.lienCloud ? (
                      <a
                        href={doc.lienCloud}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-ink hover:bg-accent-hover"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ouvrir la pièce
                        {doc.lienCloudExpire ? ` · lien jusqu’au ${formatDateFr(doc.lienCloudExpire)}` : ''}
                      </a>
                    ) : hrefDossierTech ? (
                      <a
                        href={
                          lienDossierCloudRh(
                            racineCloud,
                            segmentsDossierCloudRh({ techName: displayName, type: doc.type }),
                          ) || hrefDossierTech
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold hover:bg-mist"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Dossier {formatCheminCloudRh(segmentsDossierCloudRh({ techName: displayName, type: doc.type }).slice(-1))}
                      </a>
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
        annuel du détecteur sont dans Mon profil — ce n’est pas le dossier RH.
      </p>

      {formOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-3 pb-20 sm:items-center sm:pb-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rh-doc-form-title"
          onClick={() => {
            setFormOpen(false)
            setForm(blankDoc())
          }}
        >
          <form
            onSubmit={onSaveDoc}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[min(88dvh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl"
          >
            <h2 id="rh-doc-form-title" className="font-display text-lg font-semibold">
              {form.id ? 'Modifier le document' : 'Nouveau document'}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Type *</span>
                <select
                  required
                  autoFocus
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TypeDocumentRh }))}
                  className="h-12 w-full rounded-xl border border-line px-3"
                >
                  {TYPES_DOCUMENT_RH.filter(
                    (t) => canSeeIdentite || !estDocumentRhAdminSeulement(t.type),
                  ).map((t) => (
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
                label="N° / référence (4 derniers caractères)"
                value={form.numero}
                onChange={(v) => setForm((f) => ({ ...f, numero: v }))}
              />
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Classement cloud</span>
                <p className="rounded-xl bg-mist px-3 py-2 text-sm font-medium text-ink">{cheminPiece}</p>
                <p className="mt-1 text-xs text-muted">
                  Déposez le fichier dans ce sous-dossier. Lien fichier optionnel si vous voulez ouvrir
                  directement la pièce.
                </p>
                {hrefDossierPiece ? (
                  <a
                    href={hrefDossierPiece}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Ouvrir ce dossier
                  </a>
                ) : null}
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Lien fichier (optionnel)</span>
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  value={form.lienCloud}
                  onChange={(e) => {
                    setFileError('')
                    setForm((f) => ({ ...f, lienCloud: e.target.value }))
                  }}
                  className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base md:h-11 md:text-sm"
                />
              </label>
              <Field
                label="Lien valable jusqu’au (optionnel)"
                type="date"
                value={form.lienCloudExpire}
                onChange={(v) => setForm((f) => ({ ...f, lienCloudExpire: v }))}
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
              <div className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-ink">Photo / scan</span>
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
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
                      .catch((err) =>
                        setFileError(err instanceof Error ? err.message : 'Import impossible'),
                      )
                      .finally(() => setFileBusy(false))
                  }}
                />
                <button
                  type="button"
                  disabled={fileBusy}
                  onClick={() => scanInputRef.current?.click()}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent-soft/50 px-4 text-sm font-semibold text-ink shadow-sm hover:bg-accent-soft disabled:opacity-60"
                >
                  {fileBusy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Chargement…
                    </>
                  ) : (
                    <>
                      <Camera className="h-5 w-5 text-accent" />
                      {form.fichierDataUrl ? 'Changer la photo / le scan' : 'Prendre une photo ou choisir un fichier'}
                    </>
                  )}
                </button>
                <p className="mt-1.5 text-xs text-muted">
                  Aperçu pour relire la date — la photo n’est pas enregistrée (protection des
                  identités).
                </p>
                {form.fichierDataUrl?.startsWith('data:image/') ? (
                  <img
                    src={form.fichierDataUrl}
                    alt={form.fichierNom || 'scan'}
                    className="mt-2 h-24 w-auto max-w-full rounded-xl border border-line object-cover"
                  />
                ) : form.fichierNom ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink">
                    <FileText className="h-3.5 w-3.5" /> {form.fichierNom}
                  </p>
                ) : null}
                {form.fichierDataUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, fichierDataUrl: undefined, fichierNom: undefined }))
                    }
                    className="mt-2 block text-xs font-semibold text-muted hover:underline"
                  >
                    Retirer le fichier
                  </button>
                ) : null}
                {fileError ? <p className="mt-1 text-xs text-danger">{fileError}</p> : null}
              </div>
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
                  className="min-h-12 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false)
                    setForm(blankDoc())
                  }}
                  className="min-h-12 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-muted"
                >
                  Annuler
                </button>
              </div>
            </div>
          </form>
        </div>
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
