import { useEffect, useRef, useState } from 'react'
import { Check, Link2, Mail, PenLine, Share2 } from 'lucide-react'
import { SignaturePad } from './SignaturePad'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { nomSignataireClient } from '../lib/signataireClient'
import { clientDisplayName } from '../lib/types'
import {
  createSignatureRequest,
  listCompletedSignatureRequests,
  listOpenSignatureRequests,
  mailtoSignatureLink,
  smsSignatureBody,
  type SignatureRequestRow,
} from '../lib/signatureDistance'
import { isSupabaseConfigured } from '../lib/supabase'

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
  /** OT lié (optionnel, pour le lien distant) */
  otId?: string
}

/**
 * Signature client du site — une seule fois, réutilisée sur CERFA / OT / fiches.
 * Si client absent : envoi d’un lien de signature à distance.
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
  otId,
}: Props) {
  const { data, applySiteClientSignature } = useStore()
  const { user } = useAuth()
  const site = siteId ? data.chantiers.find((c) => c.id === siteId) : undefined
  const client = site ? data.clients.find((c) => c.id === site.clientId) : undefined
  const siteHasSig = !!(site?.signatureDetenteurImage)
  const [remoteMsg, setRemoteMsg] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [openLink, setOpenLink] = useState<string | null>(null)
  const [pendingRemote, setPendingRemote] = useState<SignatureRequestRow[]>([])
  /** Mode client absent — signature à distance */
  const [clientAbsent, setClientAbsent] = useState(false)
  /** Accord explicite du client avant envoi e-mail / SMS */
  const [clientAgrees, setClientAgrees] = useState(false)
  const importedIds = useRef(new Set<string>())

  // Préremplir depuis le site si le doc n’a pas encore de signature
  useEffect(() => {
    if (!site?.signatureDetenteurImage) return
    if (!image) onImageChange(site.signatureDetenteurImage)
    const nextNom = nomSignataireClient({
      signatureNom: nom || site.signatureDetenteurNom,
      nomContact: undefined,
      raisonSociale: undefined,
    })
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

  const importCompleted = async () => {
    if (!siteId || !user?.organizationId || !isSupabaseConfigured()) return
    const rows = await listCompletedSignatureRequests({
      organizationId: user.organizationId,
      siteId,
    })
    for (const r of rows) {
      if (!r.signature_image || importedIds.current.has(r.id)) continue
      // Ne pas écraser une signature locale plus récente sans besoin — importer si pas encore d’image
      if (site?.signatureDetenteurImage && site.signatureDetenteurImage === r.signature_image) {
        importedIds.current.add(r.id)
        continue
      }
      if (site?.signatureDetenteurImage && image && image === site.signatureDetenteurImage) {
        // déjà une signature site : n’importe que si on n’a pas encore cette image
        if (site.signatureDetenteurAt && r.used_at && site.signatureDetenteurAt >= r.used_at) {
          importedIds.current.add(r.id)
          continue
        }
      }
      const nextNom = (r.signature_nom || '').trim() || 'Signataire site'
      const nextQual = (r.signature_qualite || '').trim() || 'Représentant client'
      onNomChange(nextNom)
      onQualiteChange(nextQual)
      onImageChange(r.signature_image)
      persistToSite({ nom: nextNom, qualite: nextQual, image: r.signature_image })
      importedIds.current.add(r.id)
      setRemoteMsg(`Signature reçue à distance (${nextNom}).`)
      setOpenLink(null)
      break
    }
    const open = await listOpenSignatureRequests({
      organizationId: user.organizationId,
      siteId,
    })
    setPendingRemote(open)
  }

  useEffect(() => {
    if (!siteId || !user?.organizationId || siteHasSig) return
    void importCompleted()
    const t = window.setInterval(() => void importCompleted(), 12000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void importCompleted()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, user?.organizationId, siteHasSig])

  const reuseSite = () => {
    if (!site?.signatureDetenteurImage) return
    const nextNom = nom.trim() || site.signatureDetenteurNom?.trim() || ''
    const nextQual = qualite.trim() || site.signatureDetenteurQualite || 'Représentant client'
    onImageChange(site.signatureDetenteurImage)
    if (nextNom) onNomChange(nextNom)
    onQualiteChange(nextQual)
  }

  const createRemoteLink = async (): Promise<string | null> => {
    if (!siteId) {
      alert('Site manquant — choisissez d’abord le site.')
      return null
    }
    if (!user?.organizationId) {
      alert('Connexion cloud requise pour envoyer un lien.')
      return null
    }
    if (!clientAgrees) {
      alert('Demandez d’abord l’accord du client (case à cocher).')
      return null
    }
    setRemoteBusy(true)
    setRemoteMsg('')
    try {
      const { url } = await createSignatureRequest({
        organizationId: user.organizationId,
        siteId,
        siteNom: site?.nom,
        clientId: site?.clientId,
        clientNom: client ? clientDisplayName(client) : undefined,
        otId,
        nomPrefill: nom.trim() || client?.nomContact || '',
        qualitePrefill: qualite.trim() || 'Représentant client',
        createdByName: user.fullName || user.email || user.username,
      })
      setOpenLink(url)
      setPendingRemote(
        await listOpenSignatureRequests({
          organizationId: user.organizationId,
          siteId,
        }),
      )
      setRemoteMsg('Lien prêt — envoyez-le seulement au client qui a donné son accord.')
      return url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Impossible de créer le lien.')
      return null
    } finally {
      setRemoteBusy(false)
    }
  }

  const sendByEmail = async () => {
    if (!client?.email?.trim()) {
      alert('Pas d’e-mail sur la fiche client — ajoutez-le ou utilisez SMS / WhatsApp.')
      return
    }
    const url = openLink || (await createRemoteLink())
    if (!url) return
    const mail = mailtoSignatureLink({
      email: client.email,
      url,
      siteNom: site?.nom,
      techName: user?.fullName || user?.email,
    })
    if (mail) window.location.href = mail
  }

  const sendByShareOrSms = async () => {
    const url = openLink || (await createRemoteLink())
    if (!url) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Signature ClimaZEN',
          text: smsSignatureBody({ url, siteNom: site?.nom }),
          url,
        })
        return
      } catch {
        /* annulé ou non supporté → copie */
      }
    }
    await navigator.clipboard.writeText(url)
    setRemoteMsg('Lien copié — collez-le dans un SMS ou WhatsApp au client (avec son accord).')
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
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
            <button type="button" onClick={reuseSite} className="font-bold underline">
              Appliquer
            </button>
          )}
        </div>
      ) : null}

      {!siteHasSig && siteId ? (
        <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/80 p-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={clientAbsent}
              onChange={(e) => {
                setClientAbsent(e.target.checked)
                if (!e.target.checked) {
                  setClientAgrees(false)
                  setRemoteMsg('')
                }
              }}
              className="mt-1 h-4 w-4 accent-emerald-700"
            />
            <span>
              <span className="block text-sm font-extrabold text-teal-950">Client absent</span>
              <span className="block text-[11px] text-teal-900/90">
                Pas sur place — signature à distance sur son téléphone.
              </span>
            </span>
          </label>

          {clientAbsent ? (
            <div className="space-y-2 border-t border-teal-200/80 pt-2">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-teal-300 bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={clientAgrees}
                  onChange={(e) => setClientAgrees(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-700"
                />
                <span className="text-xs font-semibold text-ink">
                  Le client est d’accord pour signer à distance (accord oral / SMS obtenu).
                  <span className="mt-0.5 block font-normal text-muted">
                    Sans cet accord, n’envoyez pas de lien par e-mail.
                  </span>
                </span>
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={remoteBusy || !clientAgrees || !isSupabaseConfigured()}
                  onClick={() => void sendByEmail()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-3 text-xs font-extrabold text-white disabled:opacity-50"
                  title={
                    !clientAgrees
                      ? 'Cochez d’abord l’accord du client'
                      : !client?.email
                        ? 'Ajoutez un e-mail sur la fiche client'
                        : undefined
                  }
                >
                  <Mail className="h-4 w-4" />
                  {remoteBusy ? 'Préparation…' : 'Envoyer le lien par e-mail'}
                </button>
                <button
                  type="button"
                  disabled={remoteBusy || !clientAgrees || !isSupabaseConfigured()}
                  onClick={() => void sendByShareOrSms()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-400 bg-white px-3 text-xs font-extrabold text-teal-950 disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" />
                  SMS / WhatsApp
                </button>
              </div>

              {!client?.email?.trim() ? (
                <p className="text-[11px] text-amber-900">
                  Pas d’e-mail sur la fiche client — utilisez SMS / WhatsApp, ou ajoutez l’e-mail
                  avant.
                </p>
              ) : null}

              {openLink ? (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(openLink)
                    setRemoteMsg('Lien copié.')
                  }}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-teal-300 bg-white px-2 text-[11px] font-bold text-teal-900"
                >
                  <Link2 className="h-3.5 w-3.5" /> Copier le lien
                </button>
              ) : null}

              {pendingRemote.length > 0 ? (
                <p className="text-[11px] font-medium text-teal-900">
                  En attente de la signature du client — cette page se met à jour toute seule.
                </p>
              ) : null}
              {remoteMsg ? (
                <p className="text-[11px] font-semibold text-teal-900">{remoteMsg}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-teal-900/80">
              Client présent : faites-le signer dans le cadre ci-dessous.
            </p>
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
