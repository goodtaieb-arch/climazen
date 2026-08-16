import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, PenLine } from 'lucide-react'
import { SignaturePad } from './SignaturePad'
import { useAuth } from '../lib/AuthContext'

type Props = {
  nom: string
  qualite: string
  image: string
  onNomChange: (v: string) => void
  onQualiteChange: (v: string) => void
  onImageChange: (v: string) => void
  height?: number
  label?: string
}

/**
 * Signature intervenant — préremplie automatiquement depuis « Ma signature ».
 */
export function IntervenantSignature({
  nom,
  qualite,
  image,
  onNomChange,
  onQualiteChange,
  onImageChange,
  height = 140,
  label = 'Signature intervenant',
}: Props) {
  const { user } = useAuth()
  const profileImg = user?.signatureImage || ''
  const profileNom = user?.signataireNom || user?.fullName || user?.email || ''
  const profileQual =
    user?.signataireQualite ||
    (user?.role === 'owner' ? 'Responsable / gérant' : 'Opérateur attesté')

  // Auto dès que le profil est chargé
  useEffect(() => {
    if (profileImg && !image) onImageChange(profileImg)
    if (profileNom && !nom.trim()) onNomChange(profileNom)
    if (profileQual && !qualite.trim()) onQualiteChange(profileQual)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileImg, profileNom, profileQual, user?.id])

  const usingProfile = !!(profileImg && image && image === profileImg)

  return (
    <div className="rounded-xl border border-line bg-mist/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">{label}</h3>
        <Link to="/app/profil" className="text-xs font-medium text-accent hover:underline">
          Ma signature
        </Link>
      </div>

      {profileImg ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <Check className="h-4 w-4 shrink-0" />
          <span>Signature enregistrée — appliquée automatiquement.</span>
        </div>
      ) : (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">
          Aucune signature en profil. Enregistrez-la une fois dans{' '}
          <Link to="/app/profil" className="font-semibold underline">
            Ma signature
          </Link>
          .
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Nom *</span>
          <input
            value={nom}
            onChange={(e) => onNomChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Qualité</span>
          <input
            value={qualite}
            onChange={(e) => onQualiteChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
          />
        </label>
      </div>

      {usingProfile || (image && profileImg) ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink">Aperçu</p>
          <img
            src={image || profileImg}
            alt="Signature intervenant"
            className="h-28 w-full rounded-xl border border-line bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => {
              if (profileImg) onImageChange(profileImg)
            }}
            className="text-xs font-semibold text-muted underline"
          >
            Réappliquer ma signature profil
          </button>
        </div>
      ) : image ? (
        <div className="space-y-2">
          <img
            src={image}
            alt="Signature intervenant"
            className="h-28 w-full rounded-xl border border-line bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => onImageChange('')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted underline"
          >
            <PenLine className="h-3.5 w-3.5" /> Modifier
          </button>
        </div>
      ) : (
        <SignaturePad
          label="Signature manuscrite *"
          value={image}
          onChange={onImageChange}
          height={height}
          hint="Ou enregistrez-la une fois dans Ma signature pour l’auto-remplissage."
        />
      )}
    </div>
  )
}
