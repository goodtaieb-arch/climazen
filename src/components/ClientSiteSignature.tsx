import { useEffect } from 'react'
import { Check, PenLine } from 'lucide-react'
import { SignaturePad } from './SignaturePad'
import { useStore } from '../lib/store'
import { nomSignataireClient } from '../lib/signataireClient'

type Props = {
  siteId?: string
  nom: string
  qualite: string
  image: string
  onNomChange: (v: string) => void
  onQualiteChange: (v: string) => void
  onImageChange: (v: string) => void
  /** Hauteur du pad si nouvelle signature */
  height?: number
  /** Si true, enregistre immédiatement sur le site (tous docs) */
  autosaveSite?: boolean
}

/**
 * Signature client du site — une seule fois, réutilisée sur CERFA / OT / fiches.
 * Le nom / qualité sont libres (technicien de site, responsable, etc.).
 */
export function ClientSiteSignature({
  siteId,
  nom,
  qualite,
  image,
  onNomChange,
  onQualiteChange,
  onImageChange,
  height = 160,
  autosaveSite = true,
}: Props) {
  const { data, applySiteClientSignature } = useStore()
  const site = siteId ? data.chantiers.find((c) => c.id === siteId) : undefined
  const siteHasSig = !!(site?.signatureDetenteurImage)

  // Préremplir depuis le site si le doc n’a pas encore de signature
  useEffect(() => {
    if (!site?.signatureDetenteurImage) return
    if (!image) onImageChange(site.signatureDetenteurImage)
    const nextNom = nomSignataireClient({
      signatureNom: nom || site.signatureDetenteurNom,
      nomContact: undefined,
      raisonSociale: undefined,
    })
    // Toujours préférer le nom enregistré sur le site s’il n’est pas vide
    if (!nom.trim() && site.signatureDetenteurNom?.trim()) {
      onNomChange(site.signatureDetenteurNom.trim())
    } else if (nextNom && !nom.trim()) {
      onNomChange(nextNom)
    }
    if ((!qualite.trim() || qualite === 'Détenteur') && site.signatureDetenteurQualite) {
      onQualiteChange(site.signatureDetenteurQualite)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, site?.signatureDetenteurImage, site?.signatureDetenteurAt])

  const persistToSite = (next: { nom: string; qualite: string; image: string }) => {
    if (!autosaveSite || !siteId || !next.image) return
    const personName = next.nom.trim()
    applySiteClientSignature({
      siteId,
      signatureDetenteur: personName || 'Signataire site',
      signatureDetenteurQualite: next.qualite.trim() || 'Représentant client',
      signatureDetenteurImage: next.image,
    })
  }

  const reuseSite = () => {
    if (!site?.signatureDetenteurImage) return
    const nextNom = nom.trim() || site.signatureDetenteurNom?.trim() || ''
    const nextQual = qualite.trim() || site.signatureDetenteurQualite || 'Représentant client'
    onImageChange(site.signatureDetenteurImage)
    if (nextNom) onNomChange(nextNom)
    onQualiteChange(nextQual)
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-4 space-y-3">
      <div>
        <h3 className="font-display text-sm font-semibold">Signature client / site</h3>
        <p className="mt-0.5 text-xs text-muted">
          Une seule signature pour tous les documents de ce site. Indiquez le{' '}
          <strong className="font-semibold text-ink">nom de la personne qui signe</strong> (pas la
          raison sociale).
        </p>
      </div>

      {siteHasSig ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            Signature déjà enregistrée sur le site
            {site?.signatureDetenteurNom ? ` (${site.signatureDetenteurNom})` : ''} — réutilisée
            automatiquement.
          </span>
          {!image && (
            <button
              type="button"
              onClick={reuseSite}
              className="font-bold underline"
            >
              Appliquer
            </button>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Nom du signataire *</span>
          <input
            value={nom}
            onChange={(e) => {
              onNomChange(e.target.value)
              if (image) {
                persistToSite({ nom: e.target.value, qualite, image })
              }
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            placeholder="Nom de la personne qui signe (pas la société)"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Qualité / fonction</span>
          <input
            value={qualite}
            onChange={(e) => {
              onQualiteChange(e.target.value)
              if (image) {
                persistToSite({ nom, qualite: e.target.value, image })
              }
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            placeholder="Technicien site, responsable, gérant…"
            list="climazen-signataire-qualites"
          />
          <datalist id="climazen-signataire-qualites">
            <option value="Technicien de site" />
            <option value="Responsable maintenance" />
            <option value="Responsable technique" />
            <option value="Gérant / directeur" />
            <option value="Détenteur" />
            <option value="Représentant client" />
          </datalist>
        </label>
      </div>

      {image && siteHasSig && image === site?.signatureDetenteurImage ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink">Aperçu signature site</p>
          <img
            src={image}
            alt="Signature client"
            className="h-28 w-full rounded-xl border border-line bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => onImageChange('')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted underline"
          >
            <PenLine className="h-3.5 w-3.5" /> Nouvelle signature (remplace pour tous les docs)
          </button>
        </div>
      ) : (
        <SignaturePad
          label={siteHasSig ? 'Nouvelle signature client *' : 'Signature client (tactile) *'}
          value={image}
          onChange={(v) => {
            onImageChange(v)
            if (v) persistToSite({ nom, qualite, image: v })
          }}
          height={height}
          hint="Faites signer une fois — valable pour CERFA, OT et fiches de ce site."
        />
      )}
    </div>
  )
}
