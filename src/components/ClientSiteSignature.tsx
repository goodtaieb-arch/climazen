import { useEffect, useRef, useState } from 'react'
import { Link2, Mail, MessageSquare, PenLine, Share2 } from 'lucide-react'
import { SignaturePad } from './SignaturePad'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/AuthContext'
import { nomSignataireClient } from '../lib/signataireClient'
import { clientDisplayName } from '../lib/types'
import {
  createSignatureRequest,
  listCompletedSignatureRequests,
  listOpenSignatureRequests,
  sendSignatureEmailViaClimazen,
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
  /** OT lié (optionnel, pour le lien distant) */
  otId?: string
  /** true = lien distant envoyé, signature pas encore reçue */
  onAwaitingRemoteChange?: (awaiting: boolean) => void
}

/**
 * Signature client pour l’intervention en cours uniquement.
 * Jamais de réutilisation d’une ancienne signature site / OT.
 * Nom / qualité peuvent être préremplis — le trait de signature non.
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
  otId,
  onAwaitingRemoteChange,
}: Props) {
  const { data, applySiteClientSignature } = useStore()
  const { user } = useAuth()
  const site = siteId ? data.chantiers.find((c) => c.id === siteId) : undefined
  const client = site ? data.clients.find((c) => c.id === site.clientId) : undefined
  const [remoteMsg, setRemoteMsg] = useState('')
  const [remoteBusy, setRemoteBusy] = useState(false)
  const [openLink, setOpenLink] = useState<string | null>(null)
  const [pendingRemote, setPendingRemote] = useState<SignatureRequestRow[]>([])
  const [clientAbsent, setClientAbsent] = useState(false)
  const [clientAgrees, setClientAgrees] = useState(false)
  const importedIds = useRef(new Set<string>())
  const nomPrefillDone = useRef(false)
  /** Ne prendre que les signatures distantes de cette session / cette INT */
  const sessionStartedAt = useRef(new Date().toISOString())

  const awaitingRemote = clientAbsent && !image

  useEffect(() => {
    nomPrefillDone.current = false
    sessionStartedAt.current = new Date().toISOString()
    importedIds.current = new Set()
  }, [siteId, otId])

  useEffect(() => {
    onAwaitingRemoteChange?.(awaitingRemote)
  }, [awaitingRemote, onAwaitingRemoteChange])

  // Préremplir nom / qualité seulement — JAMAIS l’image
  useEffect(() => {
    if (!site) return
    if (!nomPrefillDone.current && !nom.trim()) {
      const nextNom = nomSignataireClient({
        signatureNom: site.signatureDetenteurNom,
        nomContact: client?.nomContact,
        raisonSociale: client?.raisonSociale,
      })
      if (nextNom && nextNom !== 'Signataire site') {
        onNomChange(nextNom)
      }
      nomPrefillDone.current = true
    }
    if ((!qualite.trim() || qualite === 'Détenteur') && site.signatureDetenteurQualite) {
      onQualiteChange(site.signatureDetenteurQualite)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId])

  /** Mémorise seulement nom / qualité sur le site — pas le trait (signature à chaque fois). */
  const persistNameOnly = (next: { nom: string; qualite: string }) => {
    if (!siteId) return
    const typed = next.nom.trim()
    if (!typed || typed === 'Signataire site') return
    applySiteClientSignature({
      siteId,
      signatureDetenteur: typed,
      signatureDetenteurQualite: next.qualite.trim() || 'Représentant client',
      signatureDetenteurImage: '',
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
      // Uniquement la signature de CET OT, ou créée pendant cette session
      if (otId) {
        if (r.ot_id !== otId) continue
      } else if (!r.created_at || r.created_at < sessionStartedAt.current) {
        continue
      }
      const nextNom = (r.signature_nom || '').trim()
      const nextQual = (r.signature_qualite || '').trim() || 'Représentant client'
      if (nextNom) onNomChange(nextNom)
      onQualiteChange(nextQual)
      onImageChange(r.signature_image)
      if (nextNom) persistNameOnly({ nom: nextNom, qualite: nextQual })
      importedIds.current.add(r.id)
      setRemoteMsg(
        nextNom ? `Signature reçue à distance (${nextNom}).` : 'Signature reçue à distance.',
      )
      setOpenLink(null)
      break
    }
    const open = await listOpenSignatureRequests({
      organizationId: user.organizationId,
      siteId,
    })
    setPendingRemote(
      otId ? open.filter((r) => !r.ot_id || r.ot_id === otId) : open,
    )
  }

  useEffect(() => {
    if (!siteId || !user?.organizationId || image) return
    void importCompleted()
    const ms = pendingRemote.length > 0 || openLink || clientAbsent ? 4000 : 12000
    const timer = window.setInterval(() => void importCompleted(), ms)
    const onVis = () => {
      if (document.visibilityState === 'visible') void importCompleted()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, otId, user?.organizationId, image, clientAbsent, pendingRemote.length, openLink])

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
    setRemoteBusy(true)
    setRemoteMsg('')
    try {
      const result = await sendSignatureEmailViaClimazen({
        email: client.email,
        url,
        siteNom: site?.nom,
        techName: user?.fullName || user?.email,
      })
      if (!result.ok) {
        alert(result.error)
        return
      }
      setRemoteMsg(`E-mail envoyé par ClimaZEN (${result.from}) à ${client.email.trim()}.`)
    } finally {
      setRemoteBusy(false)
    }
  }

  const sendByShareOrSms = async () => {
    const url = openLink || (await createRemoteLink())
    if (!url) return
    const body = smsSignatureBody({ url, siteNom: site?.nom })
    const tel = (client?.telephone || '').replace(/[\s.\-()]/g, '')

    if (tel) {
      const isApple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
      const href = isApple
        ? `sms:${tel}&body=${encodeURIComponent(body)}`
        : `sms:${tel}?body=${encodeURIComponent(body)}`
      window.location.href = href
      setRemoteMsg(
        'SMS ouvert avec le lien. Envoyez-le, puis attendez que le client signe — ne cliquez pas encore sur « Clôturer signé ».',
      )
      return
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Signature ClimaZEN',
          text: body,
          url,
        })
        setRemoteMsg(
          'Lien partagé. Dès que le client signe sur son téléphone, la signature apparaît ici automatiquement — ensuite seulement « Clôturer signé ».',
        )
        return
      } catch {
        /* annulé → copie */
      }
    }

    await navigator.clipboard.writeText(url)
    setRemoteMsg(
      'Lien copié. Collez-le dans un SMS / WhatsApp au client. Attendez sa signature avant de clôturer l’INT.',
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
      <div>
        <h3 className="font-display text-sm font-semibold">Signature client / site</h3>
        <p className="mt-0.5 text-xs text-muted">
          À signer à chaque intervention — aucune ancienne signature n’est reprise. Indiquez le{' '}
          <strong className="font-semibold text-ink">nom de la personne qui signe</strong> (pas la
          raison sociale).
        </p>
      </div>

      {!image && siteId ? (
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
                >
                  <Mail className="h-4 w-4" />
                  {remoteBusy ? 'Envoi…' : 'Envoyer par ClimaZEN'}
                </button>
                <button
                  type="button"
                  disabled={remoteBusy || !clientAgrees || !isSupabaseConfigured()}
                  onClick={() => void sendByShareOrSms()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-400 bg-white px-3 text-xs font-extrabold text-teal-950 disabled:opacity-50"
                >
                  {client?.telephone?.trim() ? (
                    <MessageSquare className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  {client?.telephone?.trim() ? 'Envoyer par SMS' : 'SMS / WhatsApp'}
                </button>
              </div>

              {client?.email?.trim() ? (
                <p className="text-[11px] text-teal-900/80">
                  L’e-mail part de <strong className="font-semibold">contact@climazen.fr</strong> via
                  ClimaZEN (pas votre boîte perso).
                </p>
              ) : (
                <p className="text-[11px] text-amber-900">
                  Pas d’e-mail sur la fiche client — utilisez SMS / WhatsApp, ou ajoutez l’e-mail
                  avant.
                </p>
              )}

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

              <ol className="list-decimal space-y-1 rounded-xl border border-teal-300 bg-white px-3 py-2 pl-7 text-[11px] text-teal-950">
                <li>Cochez l’accord du client, puis SMS ou e-mail.</li>
                <li>Le client ouvre le lien et signe sur son téléphone.</li>
                <li>La signature arrive ici toute seule (gardez la page ouverte).</li>
                <li>Seulement après : bouton « Clôturer signé ».</li>
              </ol>

              {awaitingRemote ? (
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-950">
                  En attente de la signature à distance — ne cliquez pas encore sur « Clôturer
                  signé », sinon le message « Signature client requise » apparaît.
                </p>
              ) : null}

              {pendingRemote.length > 0 && !image ? (
                <p className="text-[11px] font-medium text-teal-900">
                  Lien envoyé — en attente du client. Cette page se met à jour toute seule.
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
            value={nom === 'Signataire site' ? '' : nom}
            onChange={(e) => {
              nomPrefillDone.current = true
              onNomChange(e.target.value)
            }}
            onBlur={() => {
              if (nom.trim() && nom.trim() !== 'Signataire site') {
                persistNameOnly({ nom, qualite })
              }
            }}
            className="h-11 w-full rounded-xl border border-line bg-white px-3"
            placeholder="Nom de la personne qui signe (pas la société)"
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Qualité / fonction</span>
          <input
            value={qualite}
            onChange={(e) => onQualiteChange(e.target.value)}
            onBlur={() => {
              if (nom.trim() && nom.trim() !== 'Signataire site') {
                persistNameOnly({ nom, qualite })
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

      {image ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink">Signature client (cette intervention)</p>
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
            <PenLine className="h-3.5 w-3.5" /> Effacer et resignature
          </button>
        </div>
      ) : (
        <SignaturePad
          label="Signature client (tactile) *"
          value={image}
          onChange={(v) => {
            onImageChange(v)
            if (v && nom.trim()) persistNameOnly({ nom, qualite })
          }}
          height={height}
          hint="Faites signer le client pour cette intervention uniquement — non enregistrée pour la suivante."
        />
      )}
    </div>
  )
}
