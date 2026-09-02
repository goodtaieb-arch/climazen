import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Field } from './ClientsPage'
import { useAuth } from '../lib/AuthContext'
import { FACTURATION_PLATEFORMES, type Operateur } from '../lib/types'
import { fileToCompanyLogoDataUrl } from '../lib/companyLogo'
import { Nav3dIcon } from '../components/Nav3dIcon'
import { normalizeLienCloudRh } from '../lib/rhDocuments'
import { verifyCloudLinkRestricted, cloudPasteHint } from '../lib/cloudLinkGuard'
import { arborescenceDocumentsEntreprise } from '../lib/docStockage'
import { AppEditionBadge } from '../components/AppEditionBadge'
import {
  APP_EDITION_DESCRIPTIONS,
  APP_EDITION_PRICING,
  APP_EDITION_PRICING_AFTER_BETA,
  APP_EDITION_TAGLINES,
  editionHasFeature,
  type AppEdition,
} from '../lib/appEdition'
import { APP_IS_BETA } from '../lib/buildStamp'
import { labelGestionnairePieces, MAGASIN_PIECES_NAV_LABEL } from '../lib/piecesDetachees'
import { mergeTeamMembers, extraAssigneesFromData } from '../lib/teamMembers'

function withOrgDefaults(operateur: Operateur, orgName?: string | null): Operateur {
  if (operateur.raisonSociale?.trim() || !orgName?.trim()) return operateur
  return { ...operateur, raisonSociale: orgName.trim() }
}

/** Réglages société — réservé à l’administrateur (pas d’accès employé). */
export function OperateurPage() {
  const { data, setOperateur, setCompanyLogo, resetDemo, loading, appEdition, setAppEdition } =
    useStore()
  const { organization, isOwner, refreshUser, user, listTeam } = useAuth()

  const [form, setForm] = useState(() => withOrgDefaults(data.operateur, organization?.name))
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; fullName: string }>>([])
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  const [expertMake, setExpertMake] = useState(Boolean(data.operateur.facturationWebhookUrl?.trim()))
  const [editionBusy, setEditionBusy] = useState(false)
  const [editionMsg, setEditionMsg] = useState('')

  const patchForm = (patch: Partial<Operateur> | ((prev: Operateur) => Operateur)) => {
    setDirty(true)
    setForm((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
  }

  // Ne pas écraser la saisie en cours
  useEffect(() => {
    if (loading || dirty) return
    setForm(withOrgDefaults(data.operateur, organization?.name))
    setExpertMake(Boolean(data.operateur.facturationWebhookUrl?.trim()))
  }, [data.operateur, organization?.name, loading, dirty])

  useEffect(() => {
    if (!isOwner) return
    void listTeam()
      .then((remote) => {
        const merged = mergeTeamMembers({
          user,
          remote,
          dossiers: data.personnelDossiers,
          extraAssignees: extraAssigneesFromData(data),
          retiredIds: data.personnelRetiresUserIds,
          orgId: user?.organizationId,
        })
        setTeamMembers(
          merged
            .filter((m) => m.active !== false)
            .map((m) => ({ id: m.id, fullName: m.fullName || m.email })),
        )
      })
      .catch(() => undefined)
  }, [
    isOwner,
    listTeam,
    user,
    data.personnelDossiers,
    data.personnelRetiresUserIds,
    data.outillages,
    data.voitures,
    data.ordresTravail,
    user?.organizationId,
  ])

  if (!isOwner) {
    return <Navigate to="/app/profil" replace />
  }

  const switchEdition = async (next: AppEdition) => {
    if (next === appEdition) return
    setEditionBusy(true)
    setEditionMsg('')
    try {
      setAppEdition(next)
      setEditionMsg(next === 'pro' ? 'Édition Pro activée.' : 'Édition Light activée.')
      setTimeout(() => setEditionMsg(''), 2500)
    } catch (err) {
      setEditionMsg(err instanceof Error ? err.message : 'Changement impossible')
    } finally {
      setEditionBusy(false)
    }
  }

  const onSubmitCompany = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    const racine = (form.lienCloudRhRacine || '').trim()
    if (racine && !normalizeLienCloudRh(racine)) {
      setFormError('Lien cloud RH invalide — collez un lien https (Drive, OneDrive, SharePoint).')
      return
    }
    if (racine) {
      const check = await verifyCloudLinkRestricted(racine)
      if (!check.ok) {
        setFormError(check.message)
        return
      }
    }
    const docsCloud = (form.lienCloudDocsRacine || '').trim()
    if (docsCloud && !normalizeLienCloudRh(docsCloud)) {
      setFormError('Lien cloud Documents invalide — https Drive / OneDrive / SharePoint.')
      return
    }
    if (docsCloud) {
      const check = await verifyCloudLinkRestricted(docsCloud)
      if (!check.ok) {
        setFormError(`Documents : ${check.message}`)
        return
      }
    }
    const prive = (form.serveurPriveDocsUrl || '').trim()
    if (prive) {
      try {
        const u = new URL(prive)
        if (u.protocol !== 'https:' && u.protocol !== 'http:') {
          setFormError('Serveur privé : URL http(s) requise.')
          return
        }
      } catch {
        setFormError('Serveur privé : URL invalide.')
        return
      }
    }
    if (form.docsStockageMode === 'prive' && !prive) {
      setFormError('Mode serveur privé : renseignez l’URL de base du serveur.')
      return
    }
    if (form.docsStockageMode === 'cloud' && !docsCloud && !racine) {
      setFormError('Mode cloud : renseignez le lien Documents (ou le dossier cloud RH).')
      return
    }
    setSaving(true)
    try {
      await setOperateur({
        ...form,
        facturationWebhookUrl: expertMake ? form.facturationWebhookUrl : '',
        lienCloudRhRacine: normalizeLienCloudRh(form.lienCloudRhRacine) || '',
        lienCloudDocsRacine: normalizeLienCloudRh(form.lienCloudDocsRacine) || '',
        serveurPriveDocsUrl: prive,
        serveurPriveDocsToken: (form.serveurPriveDocsToken || '').trim() || undefined,
        docsStockageMode: form.docsStockageMode || 'telechargement',
      })
      setDirty(false)
      void refreshUser().catch(() => undefined)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const persistLogo = async (logoImage: string | undefined) => {
    setLogoBusy(true)
    setFormError('')
    try {
      await setCompanyLogo(logoImage)
      setForm((f) => {
        const next = { ...f }
        if (logoImage) next.logoImage = logoImage
        else delete next.logoImage
        return next
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible d’enregistrer le logo')
    } finally {
      setLogoBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Nav3dIcon to="/app/operateur" size={52} float delay="0.2s" className="shrink-0" />
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Mon entreprise</h1>
          <p className="mt-1 text-muted">
            {appEdition === 'light'
              ? 'Identification société, attestation de capacité, logo et liens pour sauvegarder vos documents. Étalonnages et détecteur : Mon profil.'
              : `Compte administrateur · ${organization?.name || 'Société'} — cadre [1], logo, attestation, facturation. Signature, détecteur et matériel perso : dans Mon profil.`}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold">Édition ClimaZEN</h2>
              <AppEditionBadge edition={appEdition} />
            </div>
            <p className="mt-1 text-sm text-muted">{APP_EDITION_TAGLINES[appEdition]}</p>
            <p className="mt-2 text-sm text-slate">{APP_EDITION_DESCRIPTIONS[appEdition]}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={editionBusy || appEdition === 'light'}
            onClick={() => void switchEdition('light')}
            className={[
              'rounded-xl border px-4 py-3 text-left text-sm transition',
              appEdition === 'light'
                ? 'border-teal-400 bg-teal-50 font-semibold text-teal-950'
                : 'border-line bg-white hover:bg-mist',
            ].join(' ')}
          >
            <span className="font-bold">Light</span>
            <span className="mt-0.5 block text-xs font-semibold text-teal-800">
              {APP_EDITION_PRICING.light.price} {APP_EDITION_PRICING.light.priceSuffix}
            </span>
            <span className="mt-1 block text-xs text-muted">{APP_EDITION_DESCRIPTIONS.light}</span>
          </button>
          <button
            type="button"
            disabled={editionBusy || appEdition === 'pro'}
            onClick={() => void switchEdition('pro')}
            className={[
              'rounded-xl border px-4 py-3 text-left text-sm transition',
              appEdition === 'pro'
                ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-950'
                : 'border-line bg-white hover:bg-mist',
            ].join(' ')}
          >
            <span className="font-bold">Pro</span>
            <span className="mt-0.5 block text-xs font-semibold text-indigo-800">
              {APP_IS_BETA
                ? `${APP_EDITION_PRICING.pro.price} ${APP_EDITION_PRICING.pro.priceSuffix} (payant après bêta)`
                : 'Abonnement payant'}
            </span>
            <span className="mt-1 block text-xs text-muted">{APP_EDITION_DESCRIPTIONS.pro}</span>
          </button>
        </div>
        {editionMsg ? <p className="mt-3 text-sm font-semibold text-accent">{editionMsg}</p> : null}
        {APP_IS_BETA ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <strong>Version bêta :</strong> Light gratuite pour toujours. Pro gratuite pendant la
            bêta — {APP_EDITION_PRICING_AFTER_BETA.toLowerCase()}
          </p>
        ) : null}
        {appEdition === 'light' ? (
          <p className="mt-3 text-xs text-muted">
            Besoin d’équipe, agenda ou pointeuse ? Passez à <strong>Pro</strong> quand vous
            embauchez — vos clients, OT et CERFA restent en place.
          </p>
        ) : null}
      </section>

      {editionHasFeature(appEdition, 'stock_pieces') ? (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Magasin pièces détachées</h2>
          <p className="mt-1 text-sm text-muted">
            {labelGestionnairePieces({
              magasinierUserId: form.magasinierUserId,
              magasinierName: teamMembers.find((m) => m.id === form.magasinierUserId)?.fullName,
            })}
            . Sans magasinier, le bureau (secrétariat, gérant) gère le stock GMAO.
          </p>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">Magasinier (optionnel)</span>
            <select
              value={form.magasinierUserId || ''}
              onChange={(e) => {
                const magasinierUserId = e.target.value || undefined
                patchForm({ magasinierUserId })
              }}
              className="w-full max-w-md rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">— Bureau / gérant —</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted">
            Choisissez un membre avec le poste « Magasinier » dans Équipe, ou toute personne de
            confiance.             Stock :{' '}
            <Link to="/app/stock-pieces" className="font-semibold text-accent underline">
              {MAGASIN_PIECES_NAV_LABEL}
            </Link>
          </p>
        </section>
      ) : null}

      {editionHasFeature(appEdition, 'pointage') ? (
        <Link
          to="/app/pointage"
          className="block rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
        >
          <span className="font-bold">Pointeuse / temps de travail</span>
          <span className="mt-0.5 block text-xs">
            Paramétrer les règles d’heures (obligatoire) puis activer. Horodatage + GPS ponctuel,
            pas de tracking. Export paie / facturation.
          </span>
        </Link>
      ) : null}

      {loading && (
        <p className="rounded-xl border border-line bg-mist px-4 py-3 text-sm text-muted">
          Chargement des données société…
        </p>
      )}

      <form
        onSubmit={(e) => void onSubmitCompany(e)}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <h2 className="font-display text-lg font-semibold sm:col-span-2">
          {appEdition === 'light' ? 'Identification société (cadre CERFA [1])' : 'Cadre [1] — Opérateur (société)'}
        </h2>
        {appEdition === 'light' ? (
          <p className="text-sm text-muted sm:col-span-2">
            Raison sociale, SIRET et n° d’attestation de capacité — requis sur vos CERFA. Complétez
            aussi les liens cloud ci-dessous pour ranger attestations et PDF générés.
          </p>
        ) : null}
        <Field
          label="Raison sociale *"
          value={form.raisonSociale}
          onChange={(v) => patchForm({ raisonSociale: v })}
          required
          className="sm:col-span-2"
        />
        <Field
          label="Adresse"
          value={form.adresse}
          onChange={(v) => patchForm({ adresse: v })}
          className="sm:col-span-2"
        />
        <Field label="SIRET" value={form.siret} onChange={(v) => patchForm({ siret: v })} />
        <Field
          label="N° attestation capacité"
          value={form.attestationNumero}
          onChange={(v) => patchForm({ attestationNumero: v })}
        />
        <Field
          label="Téléphone"
          value={form.telephone}
          onChange={(v) => patchForm({ telephone: v })}
        />
        <Field label="Email" value={form.email} onChange={(v) => patchForm({ email: v })} />
        <Field
          label="E-mail alertes tickets client (optionnel)"
          value={form.ticketNotificationEmail || ''}
          onChange={(v) => patchForm({ ticketNotificationEmail: v || undefined })}
        />
        <p className="-mt-2 text-xs text-muted">
          Portail GMAO : à chaque signalement client, un OT est créé et un e-mail part ici (ou
          l’e-mail société + gérant).
        </p>

        <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
          <h2 className="font-display mb-1 text-base font-semibold">
            {appEdition === 'light' ? 'Dossier cloud société' : 'Dossier cloud RH'}
          </h2>
          <p className="mb-3 text-sm text-muted">
            {appEdition === 'light' ? (
              <>
                Classement Google Drive, OneDrive ou SharePoint pour vos pièces administratives
                (attestation de capacité, assurances…). Les PDF ClimaZEN peuvent aussi y être
                rangés via la section Documents ci-dessous.
              </>
            ) : (
              <>
                Un classement (Google Drive, OneDrive ou SharePoint). Le bouton{' '}
                <strong>Photos pièces</strong> n’ouvre que le lien{' '}
                <strong>exact de chaque opérateur</strong> (collé dans Équipe), et seulement s’il n’est{' '}
                <strong>pas public</strong>. L’alerte dépend du cloud collé.
              </>
            )}
          </p>
          <Field
            label="Lien du dossier général"
            value={form.lienCloudRhRacine || ''}
            onChange={(v) => patchForm({ lienCloudRhRacine: v })}
          />
          <p className="mt-1.5 text-xs text-muted">{cloudPasteHint(form.lienCloudRhRacine)}</p>
          <p className="mt-1.5 text-xs text-muted">
            Créez une fois cette arborescence dans le cloud, puis rangez chaque pièce dans le bon
            sous-dossier. Les scans ne sont pas stockés dans ClimaZEN.
          </p>
        </div>

        <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
          <h2 className="font-display mb-1 text-base font-semibold">
            Documents générés (PDF)
          </h2>
          <p className="mb-3 text-sm text-muted">
            Logo société sur les PDF + enregistrement vers le cloud ou le serveur privé de
            l’entreprise. Une copie reste aussi sur ClimaZEN (compte organisation).
          </p>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block font-semibold text-ink">Destination d’enregistrement</span>
            <select
              value={form.docsStockageMode || 'telechargement'}
              onChange={(e) =>
                patchForm({
                  docsStockageMode: e.target.value as Operateur['docsStockageMode'],
                })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3"
            >
              <option value="telechargement">Téléchargement local (+ copie ClimaZEN)</option>
              <option value="cloud">Cloud (Drive / OneDrive / SharePoint)</option>
              <option value="prive">Serveur privé société (WebDAV / NAS / Nextcloud)</option>
            </select>
          </label>
          <Field
            label="Lien dossier Documents (cloud)"
            value={form.lienCloudDocsRacine || ''}
            onChange={(v) => patchForm({ lienCloudDocsRacine: v })}
          />
          <p className="mt-1.5 text-xs text-muted">
            {cloudPasteHint(form.lienCloudDocsRacine) ||
              'Si vide, repli sur le dossier cloud RH. Créez l’arborescence ci-dessous dans ce dossier.'}
          </p>
          <Field
            label="URL base serveur privé"
            value={form.serveurPriveDocsUrl || ''}
            onChange={(v) => patchForm({ serveurPriveDocsUrl: v })}
            className="mt-3"
          />
          <p className="mt-1.5 text-xs text-muted">
            Ex. https://nas.votre-societe.fr/remote.php/dav/files/user/ClimaZEN/Documents — CORS
            doit autoriser climazen.fr pour l’upload automatique.
          </p>
          <Field
            label="Jeton serveur privé (optionnel)"
            value={form.serveurPriveDocsToken || ''}
            onChange={(v) => patchForm({ serveurPriveDocsToken: v || undefined })}
            className="mt-3"
          />
          <div className="mt-3 rounded-xl border border-dashed border-line bg-mist/40 p-3">
            <p className="text-xs font-bold uppercase text-muted">
              Arborescence à créer sur votre entreprise
            </p>
            <pre className="mt-2 overflow-x-auto whitespace-pre text-[11px] leading-relaxed text-ink">
              {arborescenceDocumentsEntreprise().join('\n')}
            </pre>
            <p className="mt-2 text-xs text-muted">
              Créez ces dossiers une fois (cloud ou NAS). ClimaZEN propose le chemin exact à
              chaque enregistrement (ex. ClimaZEN/Documents/2026/Devis/…).
            </p>
          </div>
        </div>

        <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
          <h2 className="font-display mb-1 text-base font-semibold">
            Destinations CERFA [13]
          </h2>
          <p className="mb-3 text-sm text-muted">
            Distributeurs / dépôts proposés dans le menu « Installation de destination » (Climalife,
            Gazechim, Dépôt…). Une ligne = une destination. Les saisies libres sur une fiche sont
            aussi mémorisées automatiquement.
          </p>
          <textarea
            rows={4}
            value={(form.destinationsInstallation || []).join('\n')}
            onChange={(e) =>
              patchForm({
                destinationsInstallation: e.target.value
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean),
              })
            }
            placeholder={'Climalife\nGazechim\nWestfalen\nDépôt atelier'}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1.5 text-xs text-muted">
            Les destinations par défaut (Climalife, Gazechim, Westfalen, Dépôt, Destruction / BSFF)
            restent toujours proposées, même si cette liste est vide.
          </p>
        </div>

        <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
          <h2 className="font-display mb-1 text-base font-semibold">Logo de la société</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {form.logoImage ? (
              <img
                src={form.logoImage}
                alt="Logo société"
                className="h-14 max-w-[10rem] rounded-lg border border-line bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-14 w-28 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
                Aucun logo
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label
                className={[
                  'cursor-pointer rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover',
                  logoBusy ? 'opacity-60' : '',
                ].join(' ')}
              >
                {logoBusy ? 'Enregistrement…' : form.logoImage ? 'Changer le logo' : 'Ajouter un logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={logoBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    void fileToCompanyLogoDataUrl(file)
                      .then((logoImage) => persistLogo(logoImage))
                      .catch((err) =>
                        setFormError(err instanceof Error ? err.message : 'Import impossible'),
                      )
                  }}
                />
              </label>
              {form.logoImage && (
                <button
                  type="button"
                  disabled={logoBusy}
                  onClick={() => void persistLogo(undefined)}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-mist disabled:opacity-60"
                >
                  Retirer
                </button>
              )}
            </div>
          </div>
        </div>

        {editionHasFeature(appEdition, 'chaine_commerciale') ? (
        <>
        <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
          <h2 className="font-display mb-1 text-base font-semibold">Facturation (simple)</h2>
          <p className="mb-3 text-sm text-muted">
            Pour l’utilisateur standard : sur un client, <strong>copier les infos</strong> puis{' '}
            <strong>ouvrir Tiime</strong> (ou Pennylane…) — sans configurer Make.
          </p>
        </div>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-ink">Logiciel de facturation (défaut : Tiime)</span>
          <select
            value={form.facturationPlateforme || 'tiime'}
            onChange={(e) =>
              patchForm({
                facturationPlateforme: e.target.value as typeof form.facturationPlateforme,
              })
            }
            className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
          >
            {FACTURATION_PLATEFORMES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2 rounded-xl border border-line bg-foam/60 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={expertMake}
              onChange={(e) => {
                setDirty(true)
                setExpertMake(e.target.checked)
              }}
            />
            <span>
              <span className="font-semibold text-ink">Mode expert — Make.com</span>
              <span className="mt-0.5 block text-muted">
                Automatiser la création devis/facture (webhook). Réservé aux utilisateurs à l’aise
                avec Make.
              </span>
            </span>
          </label>

          {expertMake && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="text-xs text-muted sm:col-span-2">
                Scénario Make : Custom webhook → module {form.facturationPlateforme || 'tiime'} →
                créer client / devis / facture.
              </p>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">URL webhook Make (https://…)</span>
                <input
                  type="url"
                  placeholder="https://hook.eu1.make.com/…"
                  value={form.facturationWebhookUrl || ''}
                  onChange={(e) => patchForm({ facturationWebhookUrl: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-semibold text-ink">Action Make par défaut</span>
                <select
                  value={form.facturationActionDefaut || 'create_devis'}
                  onChange={(e) =>
                    patchForm({
                      facturationActionDefaut: e.target
                        .value as typeof form.facturationActionDefaut,
                    })
                  }
                  className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
                >
                  <option value="create_client">Créer / mettre à jour le client</option>
                  <option value="create_devis">Créer un devis</option>
                  <option value="create_facture">Créer une facture</option>
                </select>
              </label>
            </div>
          )}
        </div>
        </>
        ) : null}

        {formError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-2">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la société'}
          </button>
          {saved && (
            <span className="text-sm text-accent">
              {dirty ? 'Modifications non enregistrées' : 'Enregistré dans le cloud'}
            </span>
          )}
          {dirty && !saved && (
            <span className="text-sm text-amber-700">Pensez à enregistrer la société</span>
          )}
        </div>
      </form>

      <button
        type="button"
        onClick={() => {
          if (confirm('Réinitialiser les données de démo ?')) resetDemo()
        }}
        className="text-sm text-muted underline hover:text-ink"
      >
        Réinitialiser les données de démonstration
      </button>
    </div>
  )
}
