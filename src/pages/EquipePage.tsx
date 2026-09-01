import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Cloud,
  FolderOpen,
  KeyRound,
  Phone,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { generateTempPassword, type UserAccount } from '../lib/auth'
import { PasswordField } from '../components/PasswordField'
import { PASSWORD_MIN_LENGTH } from '../lib/passwordPolicy'
import { Nav3dIcon } from '../components/Nav3dIcon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DossierCloudTechButton } from '../components/DossierCloudTechButton'
import { PostePersonnelSelect } from '../components/PostePersonnelSelect'
import { useStore } from '../lib/store'
import {
  dossierForUser,
  resumeAlertesDossier,
  resumeAlertesTexte,
  defaultPersonnelDossier,
  normalizeLienCloudRh,
  normalizePersonnelRetiresUserIds,
} from '../lib/rhDocuments'
import {
  labelPostePersonnel,
  ligneNomPoste,
  parsePostePersonnel,
  posteCouvreTouteLEquipe,
  type PostePersonnelId,
} from '../lib/postePersonnel'
import { verifyCloudLinkRestricted, cloudPasteHint } from '../lib/cloudLinkGuard'
import { telHref } from '../lib/agenda'

function MemberPhoneField({
  value,
  canEdit,
  onSave,
}: {
  value?: string
  canEdit: boolean
  onSave: (next: string) => void
}) {
  const [draft, setDraft] = useState(value || '')
  useEffect(() => {
    setDraft(value || '')
  }, [value])
  const href = telHref(draft)

  if (!canEdit) {
    if (!draft.trim()) return null
    return href ? (
      <a href={href} className="text-sm font-semibold text-accent hover:underline">
        {draft}
      </a>
    ) : (
      <span className="text-sm font-semibold text-ink">{draft}</span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Phone className="h-3.5 w-3.5 text-muted" />
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="06 12 34 56 78"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== (value || '').trim()) onSave(draft)
        }}
        className="h-8 w-36 rounded-lg border border-line bg-white px-2 text-sm font-semibold text-ink"
      />
    </span>
  )
}

function MemberCloudLinkField({
  value,
  canEdit,
  onSave,
}: {
  value?: string
  canEdit: boolean
  onSave: (next: string) => void
}) {
  const [draft, setDraft] = useState(value || '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setDraft(value || '')
    setErr('')
  }, [value])

  if (!canEdit) return null

  const commit = async () => {
    const next = draft.trim()
    if (!next) {
      setErr('')
      if ((value || '').trim()) onSave('')
      return
    }
    if (!normalizeLienCloudRh(next)) {
      setErr('Lien https (Drive, OneDrive, SharePoint)')
      return
    }
    setBusy(true)
    try {
      const check = await verifyCloudLinkRestricted(next)
      if (!check.ok) {
        setErr(check.message)
        return
      }
      setErr('')
      if (next !== (value || '').trim()) onSave(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="mt-1.5 block w-full min-w-0 max-w-xl">
      <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted">
        <Cloud className="h-3 w-3 shrink-0" />
        Lien exact du dossier de CET opérateur (privé)
      </span>
      <input
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://drive.google.com/drive/folders/…"
        value={draft}
        disabled={busy}
        onChange={(e) => {
          setDraft(e.target.value)
          setErr('')
        }}
        onBlur={() => void commit()}
        className="h-8 w-full min-w-0 rounded-lg border border-line bg-white px-2 text-xs text-ink"
      />
      {busy ? <span className="text-[11px] text-muted">Vérification du partage…</span> : null}
      {err ? (
        <span className="mt-0.5 block whitespace-pre-wrap text-[11px] text-danger">{err}</span>
      ) : null}
      {!err && !busy ? (
        <span className="mt-0.5 block text-[11px] leading-snug text-muted">
          {cloudPasteHint(draft)}
        </span>
      ) : null}
    </label>
  )
}

export function EquipePage() {
  const {
    user,
    organization,
    isOwner,
    createOperator,
    setOperatorActive,
    removeOperator,
    resetOperatorPassword,
    listTeam,
  } = useAuth()
  const {
    data,
    upsertPersonnelDossier,
    setPersonnelRhAcces,
    setPersonnelTelephone,
    setPersonnelPoste,
    setPersonnelLienCloud,
    retirePersonnel,
    peutVoirIdentitesRh,
  } = useStore()
  const detecteurs = data.detecteurs || []
  const detectorFor = (userId: string) =>
    detecteurs.find((d) => d.assigneeUserId === userId)
  const retiredIds = new Set(normalizePersonnelRetiresUserIds(data.personnelRetiresUserIds))
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [poste, setPoste] = useState<PostePersonnelId | ''>('')
  const [password, setPassword] = useState(() => generateTempPassword())
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<UserAccount[]>([])
  const [openMemberId, setOpenMemberId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<UserAccount | null>(null)
  const [createdCodes, setCreatedCodes] = useState<{
    email: string
    password: string
  } | null>(null)

  const refresh = async () => {
    try {
      const team = await listTeam()
      setMembers(team)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger l’équipe')
    }
  }

  useEffect(() => {
    if (!isOwner && !peutVoirIdentitesRh) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.organizationId, isOwner, peutVoirIdentitesRh])

  if (!isOwner && !peutVoirIdentitesRh) return <Navigate to="/app" replace />

  const visibleMembers = members.filter((m) => !retiredIds.has(m.id))

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setOk('')
    setCreatedCodes(null)
    setBusy(true)
    try {
      const { user: op } = await createOperator({ fullName, email, password })
      const parsedPoste = parsePostePersonnel(poste)
      if (telephone.trim() || parsedPoste) {
        upsertPersonnelDossier({
          userId: op.id,
          userName: op.fullName || fullName,
          telephone: telephone.trim() || undefined,
          poste: parsedPoste,
          toucheFroid: true,
          toucheElectricite: true,
          conduitVehicule: true,
        })
      }
      setCreatedCodes({ email: op.email, password })
      setOk(`Opérateur créé — connexion avec l’e-mail ${op.email}.`)
      setFullName('')
      setEmail('')
      setTelephone('')
      setPoste('')
      setPassword(generateTempPassword())
      await refresh()
      setMembers((prev) => (prev.some((m) => m.id === op.id) ? prev : [...prev, op]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const onResetPassword = async (memberId: string, memberEmail: string) => {
    if (
      !confirm(
        `Envoyer un e-mail de réinitialisation à ${memberEmail} ?`,
      )
    ) {
      return
    }
    try {
      const { email: sentTo } = await resetOperatorPassword(memberId)
      setCreatedCodes(null)
      setOk(`Lien de réinitialisation envoyé à ${sentTo}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const onConfirmDelete = async () => {
    const m = pendingDelete
    if (!m) return
    setError('')
    setOk('')
    try {
      await removeOperator(m.id)
      retirePersonnel(m.id)
      setPendingDelete(null)
      setOk(`${m.fullName} a été retiré de l’équipe.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
      setPendingDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Nav3dIcon to="/app/equipe" size={52} float delay="0.15s" className="shrink-0" />
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Équipe / Opérateurs</h1>
          <p className="mt-1 text-muted">
            Société <strong>{organization?.name}</strong>
            {isOwner
              ? ' — l’administrateur crée les accès employés et donne le droit de voir les identités.'
              : ' — dossiers RH (identités comprises), accès donné par le gérant.'}
          </p>
        </div>
      </div>

      {isOwner ? (
      <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-5 text-sm text-slate">
        <div className="font-display text-base font-semibold text-ink">Grande entreprise — coffre partagé</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Chaque employé se connecte avec l’e-mail / mot de passe que vous créez ici.</li>
          <li>
            Clients, travaux et CERFA saisis par n’importe qui sont <strong>visibles par toute l’équipe</strong>.
          </li>
          <li>
            Tout est stocké sur le <strong>compte société</strong> (employeur) — pas sur un téléphone isolé.
          </li>
          <li>
            Flux typique : le gérant prend l’appel client → crée l’OT →{' '}
            <strong>affecte un technicien</strong>. Détecteur de fuite : dans Mon profil.
          </li>
          <li>
            Choisissez le <strong>poste</strong> de chacun (tech CVC, frigoriste, plombier,
            électricien, secrétaire…). Un <strong>responsable</strong>, <strong>pilote</strong> ou{' '}
            <strong>directeur</strong> s’occupe de <strong>toute l’équipe</strong> — pas d’un seul
            métier. Tapez une ligne membre pour ouvrir dossier, photos, MDP, suppression.
          </li>
          <li>
            Astreinte week-end : le technicien peut aussi créer l’OT / CERFA lui-même — tout arrive
            dans le <strong>coffre société</strong> (visible par le gérant).
          </li>
          <li>
            Un salarié qui part : bouton <strong>Supprimer</strong> — il disparaît de l’équipe et
            ne peut plus se connecter. <strong>Désactiver</strong> = pause temporaire (toujours visible).
          </li>
          <li>
            Chaque fiche a un <strong>dossier documents</strong> (dates limites + alertes). Les
            scans d’identité ne sont pas stockés — seulement le type et la date d’expiration.
          </li>
          <li>
            Bouton <strong>Photos pièces</strong> : envoie vers le dossier{' '}
            <strong>exact de cet opérateur</strong> (Google Drive, OneDrive ou SharePoint).
            Collez son lien sous le nom. Si le partage est <strong>public</strong>, l’app{' '}
            <strong>arrête</strong> et affiche l’alerte du cloud utilisé (Drive Restreint,
            OneDrive Personnes spécifiques, ou SharePoint organisation).
          </li>
          <li>
            Les <strong>pièces d’identité</strong> (CNI, passeport, Vitale, RIB…) ne sont visibles
            que par le <strong>gérant</strong> et les personnes qu’il autorise (secrétariat,
            accueil d’appels / agent IA). Un technicien ne voit pas le dossier identité d’un
            collègue. Bouton <strong>Donner accès identités</strong> sur la fiche de la personne.
          </li>
        </ul>
      </div>
      ) : (
      <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-5 text-sm text-slate">
        <div className="font-display text-base font-semibold text-ink">Dossiers RH autorisés</div>
        <p className="mt-2">
          Le gérant vous a donné l’accès aux pièces d’identité de l’équipe (secrétariat, accueil
          d’appels). Ouvrez le dossier d’un technicien pour les dates limites. Les scans ne sont
          pas stockés dans ClimaZEN.
        </p>
      </div>
      )}

      {createdCodes && (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft/50 p-5 text-sm text-slate">
          <div className="font-display text-base font-semibold">À transmettre à l’opérateur</div>
          <ul className="mt-2 space-y-1">
            <li>
              E-mail : <strong>{createdCodes.email}</strong>
            </li>
            <li>
              Mot de passe temporaire :{' '}
              <strong className="font-mono">{createdCodes.password}</strong>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            S’il a oublié son MDP, utilisez « Reset MDP » pour lui envoyer un lien par e-mail.
          </p>
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-accent hover:underline"
            onClick={() => setCreatedCodes(null)}
          >
            Masquer
          </button>
        </div>
      )}

      {isOwner && (
      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <h2 className="font-display text-lg font-semibold sm:col-span-2">
          <UserPlus className="mr-2 inline h-5 w-5" />
          Ajouter un opérateur
        </h2>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">Nom complet *</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">E-mail (identifiant) *</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operateur@societe.fr"
            className="h-11 w-full rounded-xl border border-line px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Téléphone perso (pour le joindre)</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="06 12 34 56 78"
            className="h-11 w-full rounded-xl border border-line px-3"
          />
          <p className="mt-1 text-xs text-muted">
            Pour l’appeler. Le téléphone de société se donne dans son dossier (Équipe → Dossier).
          </p>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">Poste *</span>
          <PostePersonnelSelect required value={poste} onChange={setPoste} />
          <p className="mt-1 text-xs text-muted">
            Ce qu’il fait au quotidien. Responsable / pilote / directeur = toute l’équipe.
          </p>
        </label>
        <PasswordField
          label="Mot de passe temporaire *"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
        {ok && !createdCodes && <p className="text-sm text-accent sm:col-span-2">{ok}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60 sm:col-span-2"
        >
          {busy ? 'Création…' : 'Créer le compte opérateur'}
        </button>
      </form>
      )}

      {!isOwner && error && <p className="text-sm text-danger">{error}</p>}
      {!isOwner && ok && <p className="text-sm text-accent">{ok}</p>}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <div className="font-display font-semibold">Membres ({visibleMembers.length})</div>
          <p className="mt-0.5 text-xs text-muted">
            Une ligne par personne — appuyez pour afficher dossier, photos, identités, MDP.
          </p>
        </div>
        <ul className="divide-y divide-line">
          {visibleMembers.map((m) => {
            const dossier = dossierForUser(data.personnelDossiers, m.id)
            const effective = dossier || {
              id: '',
              ...defaultPersonnelDossier(m.id, m.fullName),
            }
            const resume = resumeAlertesDossier(effective)
            const hasRhAcces = (data.personnelRhAccesUserIds || []).includes(m.id)
            const racineCloud = data.operateur.lienCloudRhRacine
            const open = openMemberId === m.id
            const posteLabel = labelPostePersonnel(dossier?.poste)
            const couvreTous = posteCouvreTouteLEquipe(dossier?.poste)
            const tel = (dossier?.telephone || '').trim()
            return (
            <li key={m.id} className="bg-white">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenMemberId(open ? null : m.id)}
                className="flex w-full min-w-0 items-center gap-2 px-4 py-2.5 text-left hover:bg-mist/60"
              >
                {open ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-ink">
                  {ligneNomPoste({
                    nom: m.fullName,
                    poste: dossier?.poste,
                    roleOwner: m.role === 'owner',
                  })}
                </span>
                {couvreTous ? (
                  <span className="hidden shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase text-slate sm:inline">
                    Toute l’équipe
                  </span>
                ) : null}
                {m.active === false ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                    Off
                  </span>
                ) : null}
                {resume.expire ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title="Pièce expirée" />
                ) : resume.bientot ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Pièce bientôt" />
                ) : null}
                {tel ? (
                  <span className="hidden max-w-[8rem] truncate text-xs font-semibold text-muted sm:inline">
                    {tel}
                  </span>
                ) : null}
              </button>
              {open ? (
              <div className="space-y-3 border-t border-line bg-mist/30 px-4 py-3">
                <div className="text-xs leading-snug text-muted">
                  {m.role === 'owner' ? 'Compte officiel société' : 'Opérateur'}
                  {posteLabel ? ` · ${posteLabel}` : ' · poste à définir'}
                  {couvreTous ? ' · s’occupe de toute l’équipe' : ''}
                  {m.active === false ? ' · désactivé' : ''}
                  {m.role !== 'owner' && hasRhAcces ? ' · accès identités / RH' : ''}
                  {(() => {
                    const det = detectorFor(m.id)
                    return det
                      ? ` · détecteur ${det.identification}`
                      : ' · aucun détecteur attribué'
                  })()}
                  {` · ${resumeAlertesTexte(resume, { vide: !dossier })}`}
                </div>
                <span className="block break-all text-xs text-muted">
                  {m.email || m.username}
                </span>
                {isOwner ? (
                  <label className="block max-w-xs text-sm">
                    <span className="mb-1 block text-xs font-semibold text-ink">Poste</span>
                    <PostePersonnelSelect
                      compact
                      value={dossier?.poste || ''}
                      onChange={(next) => setPersonnelPoste(m.id, m.fullName, next)}
                    />
                  </label>
                ) : null}
                <MemberPhoneField
                  value={dossier?.telephone}
                  canEdit={isOwner}
                  onSave={(next) => setPersonnelTelephone(m.id, m.fullName, next)}
                />
                <div className="flex max-w-full flex-wrap gap-2">
                <Link
                  to={`/app/equipe/${m.id}`}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                    resume.expire
                      ? 'bg-red-100 text-red-800'
                      : resume.bientot
                        ? 'bg-amber-100 text-amber-900'
                        : 'border border-line text-muted hover:bg-mist',
                  ].join(' ')}
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Dossier
                  {resume.total > 0 ? ` (${resume.total})` : ''}
                </Link>
                <DossierCloudTechButton
                  techName={m.fullName}
                  lienCloudDossier={dossier?.lienCloudDossier}
                  racineCloud={racineCloud}
                  variant="compact"
                />
              {isOwner && m.role !== 'owner' && m.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => setPersonnelRhAcces(m.id, !hasRhAcces)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                    hasRhAcces
                      ? 'bg-accent-soft text-slate'
                      : 'border border-line text-muted hover:bg-mist',
                  ].join(' ')}
                  title="Autorise à voir les pièces d’identité de toute l’équipe (secrétariat, accueil d’appels)"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {hasRhAcces ? 'Identités : oui' : 'Donner accès identités'}
                </button>
              )}
              {isOwner && m.role === 'operateur' && m.id !== user?.id && (
                <>
                  <button
                    type="button"
                    onClick={() => void onResetPassword(m.id, m.email || m.username)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-mist"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Reset MDP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setOperatorActive(m.id, m.active === false).then(() => refresh())
                    }}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                      m.active === false
                        ? 'bg-accent-soft text-slate'
                        : 'border border-line text-muted hover:bg-mist',
                    ].join(' ')}
                  >
                    {m.active === false ? (
                      <>
                        <UserCheck className="h-3.5 w-3.5" /> Réactiver
                      </>
                    ) : (
                      <>
                        <UserX className="h-3.5 w-3.5" /> Désactiver
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(m)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </>
              )}
                </div>
                <MemberCloudLinkField
                  value={dossier?.lienCloudDossier}
                  canEdit={isOwner}
                  onSave={(next) => setPersonnelLienCloud(m.id, m.fullName, next)}
                />
              </div>
              ) : null}
            </li>
            )
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Retirer ${pendingDelete?.fullName || 'ce technicien'} de l’équipe ?`}
        message="Il disparaît de la liste, ne pourra plus se connecter, et ne sera plus proposé pour les OT / détecteurs. Les CERFA déjà faits restent. L’e-mail reste réservé (vous ne pourrez pas recréer le même compte)."
        confirmLabel="Supprimer de l’équipe"
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
