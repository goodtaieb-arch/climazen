import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, PenLine } from 'lucide-react'
import { SignaturePad } from '../components/SignaturePad'
import {
  fetchSignatureRequestPublic,
  submitSignatureRequestPublic,
  type SignatureRequestPublic,
} from '../lib/signatureDistance'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Page publique — le client signe sur son téléphone (lien SMS / e-mail).
 * Pas d’auth requise.
 */
export function SignerPage() {
  const { token = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<SignatureRequestPublic | null>(null)
  const [error, setError] = useState('')
  const [nom, setNom] = useState('')
  const [qualite, setQualite] = useState('Représentant client')
  const [image, setImage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) {
        setError('Lien invalide.')
        setLoading(false)
        return
      }
      if (!isSupabaseConfigured()) {
        setError('Service de signature indisponible pour le moment.')
        setLoading(false)
        return
      }
      const res = await fetchSignatureRequestPublic(token)
      if (cancelled) return
      if (!res.ok) {
        setError(res.error)
        setLoading(false)
        return
      }
      setInfo(res)
      setNom(res.nomPrefill || '')
      setQualite(res.qualitePrefill || 'Représentant client')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = async () => {
    if (!nom.trim()) {
      alert('Indiquez votre nom.')
      return
    }
    if (!image) {
      alert('Signez dans le cadre ci-dessous.')
      return
    }
    setBusy(true)
    try {
      const res = await submitSignatureRequestPublic({
        token,
        nom: nom.trim(),
        qualite: qualite.trim() || 'Représentant client',
        image,
      })
      if (!res.ok) {
        alert(res.error)
        return
      }
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[linear-gradient(180deg,#f0fdfa_0%,#fff_40%)] px-4 py-8">
      <div className="mb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-800">ClimaZEN</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-ink">Signature à distance</h1>
        <p className="mt-1 text-sm text-muted">Client absent — signez depuis votre téléphone.</p>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Chargement du lien…
        </p>
      ) : error ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-amber-950">{error}</p>
          <Link to="/" className="text-sm font-bold text-teal-800 underline">
            climazen.fr
          </Link>
        </div>
      ) : done ? (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-8 text-center">
          <Check className="mx-auto h-10 w-10 text-emerald-700" />
          <p className="font-display text-lg font-bold text-emerald-950">Signature enregistrée</p>
          <p className="text-sm text-emerald-900">
            Merci. Le technicien la retrouvera automatiquement sur le dossier.
          </p>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
          {(info?.clientNom || info?.siteNom) && (
            <div className="rounded-xl bg-mist/70 px-3 py-2 text-sm">
              {info.clientNom ? (
                <p>
                  <span className="text-muted">Client · </span>
                  <strong>{info.clientNom}</strong>
                </p>
              ) : null}
              {info.siteNom ? (
                <p>
                  <span className="text-muted">Site · </span>
                  <strong>{info.siteNom}</strong>
                </p>
              ) : null}
              {info.createdByName ? (
                <p className="mt-1 text-xs text-muted">Demande de {info.createdByName}</p>
              ) : null}
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Votre nom *</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="h-12 w-full rounded-xl border border-line px-3 text-base"
              placeholder="Nom de la personne qui signe"
              autoComplete="name"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">Qualité / fonction</span>
            <input
              value={qualite}
              onChange={(e) => setQualite(e.target.value)}
              className="h-12 w-full rounded-xl border border-line px-3 text-base"
              placeholder="Responsable, gérant…"
              list="signer-qualites"
            />
            <datalist id="signer-qualites">
              <option value="Représentant client" />
              <option value="Gérant / directeur" />
              <option value="Responsable technique" />
              <option value="Responsable maintenance" />
              <option value="Détenteur" />
            </datalist>
          </label>

          <SignaturePad
            label="Votre signature (doigt) *"
            value={image}
            onChange={setImage}
            height={180}
            hint="Signez dans le cadre avec le doigt, puis validez."
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => void onSubmit()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 text-sm font-extrabold text-white disabled:opacity-60"
          >
            <PenLine className="h-4 w-4" />
            {busy ? 'Envoi…' : 'Valider ma signature'}
          </button>
          <p className="text-center text-[11px] text-muted">
            En validant, vous confirmez avoir pris connaissance de l’intervention.
          </p>
        </div>
      )}
    </div>
  )
}
