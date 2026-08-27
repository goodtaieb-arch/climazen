import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { useStore } from '../lib/store'
import { Field } from './ClientsPage'
import { SignaturePad } from '../components/SignaturePad'
import { PasswordField } from '../components/PasswordField'
import { DetecteursParc } from '../components/DetecteursParc'
import { useAuth } from '../lib/AuthContext'
import { PASSWORD_HINT, validatePasswordStrength } from '../lib/passwordPolicy'
import { Nav3dIcon } from '../components/Nav3dIcon'
import {
  defaultPersonnelDossier,
  dossierForUser,
  resumeAlertesDossier,
} from '../lib/rhDocuments'

/**
 * Espace personnel opérateur : signature (obligatoire pour CERFA) + MDP.
 * Invisible / non modifiable par l’administrateur.
 */
export function ProfilPage() {
  const { data, peutVoirIdentitesRh } = useStore()
  const { user, organization, isOwner, saveMySignature, updatePassword } = useAuth()
  const ownDossier = dossierForUser(data.personnelDossiers, user?.id)
  const ownResume = resumeAlertesDossier(
    ownDossier ||
      (user ? { id: '', ...defaultPersonnelDossier(user.id, user.fullName || 'Technicien') } : undefined),
  )

  const [signNom, setSignNom] = useState(user?.signataireNom || user?.fullName || '')
  const [signQualite, setSignQualite] = useState(
    user?.signataireQualite || (isOwner ? 'Responsable / gérant' : 'Opérateur attesté'),
  )
  const [signImage, setSignImage] = useState(user?.signatureImage || '')
  const [saved, setSaved] = useState(false)
  const [signError, setSignError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdOk, setPwdOk] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)

  useEffect(() => {
    setSignNom(user?.signataireNom || user?.fullName || '')
    setSignQualite(
      user?.signataireQualite || (user?.role === 'owner' ? 'Responsable / gérant' : 'Opérateur attesté'),
    )
    setSignImage(user?.signatureImage || '')
  }, [user?.id, user?.signataireNom, user?.signataireQualite, user?.signatureImage, user?.fullName, user?.role])

  const onSubmitSignature = (e: FormEvent) => {
    e.preventDefault()
    setSignError('')
    if (!signNom.trim()) {
      setSignError('Indiquez le nom du signataire.')
      return
    }
    if (!signImage) {
      setSignError('Tracez votre signature manuscrite — obligatoire pour valider un CERFA.')
      return
    }
    void saveMySignature({
      signataireNom: signNom.trim(),
      signataireQualite: signQualite.trim() || 'Opérateur attesté',
      signatureImage: signImage,
    }).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwdError('')
    setPwdOk('')
    const pwdErr = validatePasswordStrength(newPassword)
    if (pwdErr) {
      setPwdError(pwdErr)
      return
    }
    if (newPassword !== newPassword2) {
      setPwdError('Les mots de passe ne correspondent pas.')
      return
    }
    setPwdBusy(true)
    try {
      await updatePassword(newPassword)
      setPwdOk('Mot de passe mis à jour.')
      setNewPassword('')
      setNewPassword2('')
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Impossible de changer le mot de passe')
    } finally {
      setPwdBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Nav3dIcon to="/app/profil" size={52} float delay="0.2s" className="shrink-0" />
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Ma signature</h1>
          <p className="mt-1 text-muted">
            {organization?.name || data.operateur.raisonSociale || 'Société'} — signature{' '}
            <strong>personnelle</strong>, visible seulement par vous. Sans elle, le CERFA ne peut pas
            être validé.
          </p>
        </div>
      </div>

      {user && (
        <Link
          to={`/app/equipe/${user.id}`}
          className="flex items-start gap-3 rounded-2xl border border-line bg-white p-5 transition hover:border-accent"
        >
          <FolderOpen className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
          <div>
            <div className="font-display text-base font-semibold text-ink">Mon dossier documents</div>
            <p className="mt-1 text-sm text-muted">
              {isOwner || peutVoirIdentitesRh
                ? 'CNI, permis, carte Vitale, aptitude froid, habilitation électrique… dates limites et alertes d’expiration. Les identités restent dans l’administration.'
                : 'Aptitude froid, habilitation électrique, CACES… dates limites et alertes. Les pièces d’identité sont gérées par l’administration.'}
            </p>
            {ownResume.expire || ownResume.bientot || ownResume.sansDate ? (
              <p className="mt-2 text-sm font-semibold text-amber-800">
                {ownResume.expire ? `${ownResume.expire} expiré${ownResume.expire > 1 ? 's' : ''}` : ''}
                {ownResume.expire && ownResume.bientot ? ' · ' : ''}
                {ownResume.bientot ? `${ownResume.bientot} bientôt` : ''}
                {(ownResume.expire || ownResume.bientot) && ownResume.sansDate ? ' · ' : ''}
                {ownResume.sansDate ? `${ownResume.sansDate} sans date limite` : ''}
              </p>
            ) : ownDossier ? (
              <p className="mt-2 text-sm font-semibold text-emerald-800">Documents à jour</p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-accent">Ouvrir le dossier →</p>
            )}
          </div>
        </Link>
      )}

      {!isOwner && (
        <div className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">
          <div className="font-display text-base font-semibold text-ink">
            {data.operateur.raisonSociale || organization?.name || 'Société'}
          </div>
          <p className="mt-1">
            Les infos entreprise (SIRET, attestation, logo…) sont gérées uniquement par
            l’administrateur. Vous n’y avez pas accès.
          </p>
        </div>
      )}

      {/* Détecteur : opérateur = le sien ; gérant = rappel vers Mon entreprise */}
      {!isOwner ? (
        <DetecteursParc />
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5 text-sm">
          <h2 className="font-display text-base font-semibold text-ink">Parc détecteurs</h2>
          <p className="mt-1 text-muted">
            Ajoutez et affectez les détecteurs dans{' '}
            <Link to="/app/operateur" className="font-semibold text-accent underline">
              Mon entreprise
            </Link>
            .
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmitSignature}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h2 className="font-display mb-1 text-base font-semibold">Signature opérateur (CERFA)</h2>
          <p className="mb-3 text-sm text-muted">
            Enregistrez-la une fois — elle sera appliquée sur vos fiches. L’administrateur ne peut
            pas la consulter ni la modifier.
          </p>
        </div>
        <Field label="Nom du signataire *" value={signNom} onChange={setSignNom} required />
        <Field label="Qualité / fonction *" value={signQualite} onChange={setSignQualite} required />
        <div className="sm:col-span-2">
          <SignaturePad
            label="Signature manuscrite (doigt / stylet) *"
            value={signImage || undefined}
            onChange={(v) => setSignImage(v || '')}
            height={180}
            hint="Signez ici, puis cliquez Enregistrer."
          />
        </div>
        {signError && <p className="text-sm text-danger sm:col-span-2">{signError}</p>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
          >
            Enregistrer ma signature
          </button>
          {saved && <span className="text-sm text-accent">Signature enregistrée</span>}
          {signImage && !saved && (
            <span className="text-xs text-muted">Signature présente sur ce compte</span>
          )}
        </div>
      </form>

      <form
        onSubmit={(e) => void onChangePassword(e)}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h2 className="font-display mb-1 text-base font-semibold">Changer mon mot de passe</h2>
          <p className="mb-3 text-sm text-muted">
            Utile pour synchroniser ordi et téléphone. {PASSWORD_HINT}
          </p>
        </div>
        <PasswordField
          label="Nouveau mot de passe *"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordField
          label="Confirmer *"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword2}
          onChange={(e) => setNewPassword2(e.target.value)}
        />
        {pwdError && <p className="text-sm text-danger sm:col-span-2">{pwdError}</p>}
        {pwdOk && <p className="text-sm text-accent sm:col-span-2">{pwdOk}</p>}
        <button
          type="submit"
          disabled={pwdBusy}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60 sm:col-span-2"
        >
          {pwdBusy ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </div>
  )
}
