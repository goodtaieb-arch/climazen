import { type FormEvent, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Field } from './ClientsPage'
import { DetecteursParc } from '../components/DetecteursParc'
import { useAuth } from '../lib/AuthContext'
import { FACTURATION_PLATEFORMES } from '../lib/types'
import type { UserAccount } from '../lib/auth'
import { fileToCompanyLogoDataUrl } from '../lib/companyLogo'

/** Réglages société — réservé à l’administrateur (pas d’accès employé). */
export function OperateurPage() {
  const { data, setOperateur, resetDemo } = useStore()
  const { user, organization, isOwner, listTeam } = useAuth()

  const [form, setForm] = useState(data.operateur)
  const [saved, setSaved] = useState(false)
  const [expertMake, setExpertMake] = useState(Boolean(data.operateur.facturationWebhookUrl?.trim()))
  const [team, setTeam] = useState<UserAccount[]>([])

  useEffect(() => {
    setForm(data.operateur)
    setExpertMake(Boolean(data.operateur.facturationWebhookUrl?.trim()))
  }, [data.operateur])

  useEffect(() => {
    if (!isOwner) return
    void listTeam().then(setTeam)
  }, [isOwner, listTeam, user?.organizationId])

  if (!isOwner) {
    return <Navigate to="/app/profil" replace />
  }

  const onSubmitCompany = (e: FormEvent) => {
    e.preventDefault()
    setOperateur({
      ...form,
      facturationWebhookUrl: expertMake ? form.facturationWebhookUrl : '',
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const persistLogo = (logoImage: string | undefined) => {
    const next = {
      ...data.operateur,
      ...form,
      logoImage,
      facturationWebhookUrl: expertMake ? form.facturationWebhookUrl : '',
    }
    setForm(next)
    setOperateur(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Mon entreprise</h1>
        <p className="mt-1 text-muted">
          Compte administrateur · {organization?.name || 'Société'} — cadre [1], logo, facturation.
          Les signatures personnelles sont hors de cette page (chaque opérateur a la sienne).
        </p>
      </div>

      <form
        onSubmit={onSubmitCompany}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <h2 className="font-display text-lg font-semibold sm:col-span-2">
          Cadre [1] — Opérateur (société)
        </h2>
        <Field
          label="Raison sociale *"
          value={form.raisonSociale}
          onChange={(v) => setForm({ ...form, raisonSociale: v })}
          required
          className="sm:col-span-2"
        />
        <Field
          label="Adresse"
          value={form.adresse}
          onChange={(v) => setForm({ ...form, adresse: v })}
          className="sm:col-span-2"
        />
        <Field label="SIRET" value={form.siret} onChange={(v) => setForm({ ...form, siret: v })} />
        <Field
          label="N° attestation capacité"
          value={form.attestationNumero}
          onChange={(v) => setForm({ ...form, attestationNumero: v })}
        />
        <Field
          label="Téléphone"
          value={form.telephone}
          onChange={(v) => setForm({ ...form, telephone: v })}
        />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />

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
              <label className="cursor-pointer rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-hover">
                {form.logoImage ? 'Changer le logo' : 'Ajouter un logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    void fileToCompanyLogoDataUrl(file)
                      .then((logoImage) => persistLogo(logoImage))
                      .catch((err) =>
                        alert(err instanceof Error ? err.message : 'Import impossible'),
                      )
                  }}
                />
              </label>
              {form.logoImage && (
                <button
                  type="button"
                  onClick={() => persistLogo(undefined)}
                  className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-mist"
                >
                  Retirer
                </button>
              )}
            </div>
          </div>
          {saved && form.logoImage && (
            <p className="mt-2 text-sm text-accent">Logo enregistré.</p>
          )}
        </div>

        <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
          <h2 className="font-display mb-1 text-base font-semibold">Facturation (simple)</h2>
          <p className="mb-3 text-sm text-muted">
            Pour l’utilisateur standard : sur un client, <strong>copier les infos</strong> puis{' '}
            <strong>ouvrir Tiime</strong> (ou Pennylane…) — sans configurer Make.
          </p>
        </div>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Logiciel de facturation (défaut : Tiime)</span>
          <select
            value={form.facturationPlateforme || 'tiime'}
            onChange={(e) =>
              setForm({
                ...form,
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
              onChange={(e) => setExpertMake(e.target.checked)}
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
                <span className="mb-1 block text-muted">URL webhook Make (https://…)</span>
                <input
                  type="url"
                  placeholder="https://hook.eu1.make.com/…"
                  value={form.facturationWebhookUrl || ''}
                  onChange={(e) => setForm({ ...form, facturationWebhookUrl: e.target.value })}
                  className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted">Action Make par défaut</span>
                <select
                  value={form.facturationActionDefaut || 'create_devis'}
                  onChange={(e) =>
                    setForm({
                      ...form,
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

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
          >
            Enregistrer la société
          </button>
          {saved && <span className="text-sm text-accent">Enregistré</span>}
        </div>
      </form>

      <DetecteursParc team={team} />

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
