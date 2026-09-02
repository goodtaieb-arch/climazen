import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, PenLine } from 'lucide-react'
import { useStore } from '../lib/store'
import { PasswordField } from '../components/PasswordField'
import { VoituresParc } from '../components/VoituresParc'
import { OutillageParc } from '../components/OutillageParc'
import { useAuth } from '../lib/AuthContext'
import { PASSWORD_HINT, validatePasswordStrength } from '../lib/passwordPolicy'
import { Nav3dIcon } from '../components/Nav3dIcon'
import { DossierCloudTechButton } from '../components/DossierCloudTechButton'
import {
  defaultPersonnelDossier,
  dossierForUser,
  resumeAlertesDossier,
} from '../lib/rhDocuments'
import { cloudPasteHint } from '../lib/cloudLinkGuard'

/**
 * Espace perso : outillage, détecteur, véhicule, mot de passe.
 * Signature CERFA → dossier Équipe (propre à l’opérateur).
 */
export function ProfilPage() {
  const { data, peutVoirIdentitesRh } = useStore()
  const { user, organization, isOwner, updatePassword } = useAuth()
  const ownDossier = dossierForUser(data.personnelDossiers, user?.id)
  const ownResume = resumeAlertesDossier(
    ownDossier ||
      (user ? { id: '', ...defaultPersonnelDossier(user.id, user.fullName || 'Technicien') } : undefined),
  )

  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdOk, setPwdOk] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)

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
          <h1 className="font-display text-3xl font-bold tracking-tight">Mon profil</h1>
          <p className="mt-1 text-muted">
            {organization?.name || data.operateur.raisonSociale || 'Société'} — outillage terrain,
            détecteur de fuite, véhicule de service. Votre matériel perso, pas le cadre société.
          </p>
        </div>
      </div>

      {user && (
        <Link
          to={`/app/equipe/${user.id}`}
          className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent-soft/30 p-5 transition hover:border-accent"
        >
          <FolderOpen className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
          <div>
            <div className="font-display flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
              Mon dossier Équipe
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                <PenLine className="h-3 w-3" /> Signature
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              Signature CERFA personnelle, documents, matériel confié
              {isOwner || peutVoirIdentitesRh
                ? ' — CNI, permis, aptitude froid…'
                : ' — aptitude froid, habilitation…'}{' '}
              Dates limites et alertes. La signature n’est visible que par vous.
            </p>
            {ownResume.expire || ownResume.bientot || ownResume.sansDate ? (
              <p className="mt-2 text-sm font-semibold text-amber-800">
                {ownResume.expire ? `${ownResume.expire} expiré${ownResume.expire > 1 ? 's' : ''}` : ''}
                {ownResume.expire && ownResume.bientot ? ' · ' : ''}
                {ownResume.bientot ? `${ownResume.bientot} bientôt` : ''}
                {(ownResume.expire || ownResume.bientot) && ownResume.sansDate ? ' · ' : ''}
                {ownResume.sansDate ? `${ownResume.sansDate} sans date limite` : ''}
              </p>
            ) : user.signatureImage ? (
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                Signature enregistrée · ouvrir le dossier →
              </p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-accent">
                Enregistrer ma signature dans mon dossier →
              </p>
            )}
          </div>
        </Link>
      )}

      {user ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-5">
          <div className="font-display text-base font-semibold text-ink">Photos de pièces</div>
          <p className="mt-1 text-sm text-muted">
            Ouvre <strong>votre</strong> dossier cloud exact (collé par le gérant dans Équipe).
            Si le dossier est public, l’app n’ouvre rien — l’alerte dépend du cloud (Google Drive,
            OneDrive ou SharePoint).
          </p>
          <div className="mt-3">
            <DossierCloudTechButton
              techName={user.fullName || 'Technicien'}
              lienCloudDossier={ownDossier?.lienCloudDossier}
              label="Ouvrir mon dossier cloud"
            />
            <p className="mt-2 text-sm text-muted">
              {ownDossier?.lienCloudDossier
                ? cloudPasteHint(ownDossier.lienCloudDossier)
                : 'Le gérant colle le lien exact de votre dossier dans Équipe (sous votre nom) : Google Drive, OneDrive ou SharePoint, en partage privé.'}
            </p>
          </div>
        </div>
      ) : null}

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

      <OutillageParc />

      <VoituresParc />

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
