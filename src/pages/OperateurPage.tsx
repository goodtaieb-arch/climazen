import { type FormEvent, useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { Field } from './ClientsPage'
import { SignaturePad } from '../components/SignaturePad'
import { PasswordField } from '../components/PasswordField'
import { useAuth } from '../lib/AuthContext'
import { FACTURATION_PLATEFORMES } from '../lib/types'

export function OperateurPage() {
  const { data, setOperateur, resetDemo } = useStore()
  const { user, organization, isOwner, saveMySignature, updatePassword } = useAuth()

  const [form, setForm] = useState(data.operateur)
  const [signNom, setSignNom] = useState(user?.signataireNom || user?.fullName || '')
  const [signQualite, setSignQualite] = useState(
    user?.signataireQualite || (isOwner ? 'Responsable / gérant' : 'Opérateur attesté'),
  )
  const [signImage, setSignImage] = useState(user?.signatureImage || '')
  const [saved, setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdOk, setPwdOk] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)

  useEffect(() => {
    setForm(data.operateur)
  }, [data.operateur])

  useEffect(() => {
    setSignNom(user?.signataireNom || user?.fullName || '')
    setSignQualite(
      user?.signataireQualite || (user?.role === 'owner' ? 'Responsable / gérant' : 'Opérateur attesté'),
    )
    setSignImage(user?.signatureImage || '')
  }, [user?.id, user?.signataireNom, user?.signataireQualite, user?.signatureImage, user?.fullName, user?.role])

  const onSubmitCompany = (e: FormEvent) => {
    e.preventDefault()
    if (!isOwner) return
    setOperateur(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const onSubmitSignature = (e: FormEvent) => {
    e.preventDefault()
    void saveMySignature({
      signataireNom: signNom,
      signataireQualite: signQualite,
      signatureImage: signImage || undefined,
    }).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwdError('')
    setPwdOk('')
    if (newPassword.length < 6) {
      setPwdError('Mot de passe : au moins 6 caractères.')
      return
    }
    if (newPassword !== newPassword2) {
      setPwdError('Les mots de passe ne correspondent pas.')
      return
    }
    setPwdBusy(true)
    try {
      await updatePassword(newPassword)
      setPwdOk('Mot de passe mis à jour. Reconnectez-vous sur le téléphone avec ce nouveau MDP.')
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
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {isOwner ? 'Mon entreprise' : 'Ma signature'}
        </h1>
        <p className="mt-1 text-muted">
          {isOwner
            ? `Compte officiel · ${organization?.name || 'Société'} — cadre [1] partagé avec toute l’équipe.`
            : `Opérateur chez ${organization?.name || 'la société'} — votre signature perso sur les CERFA.`}
        </p>
      </div>

      {isOwner ? (
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
            <h2 className="font-display mb-1 text-base font-semibold">Détecteur manuel [5]</h2>
            <p className="mb-3 text-sm text-muted">
              Réf. + date de contrôle (annuel) — préremplies sur chaque CERFA d’étanchéité.
            </p>
          </div>
          <Field
            label="Identification / réf. détecteur"
            value={form.detecteurIdentification || ''}
            onChange={(v) => setForm({ ...form, detecteurIdentification: v })}
          />
          <Field
            label="Contrôlé le"
            type="date"
            value={form.detecteurControleDate || ''}
            onChange={(v) => setForm({ ...form, detecteurControleDate: v })}
          />

          <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
            <h2 className="font-display mb-1 text-base font-semibold">
              Facturation (Make → Tiime, Pennylane…)
            </h2>
            <p className="mb-3 text-sm text-muted">
              Évite de ressaisir le client : ClimaZEN envoie les données à Make, qui crée le devis /
              facture sur la plateforme que vous utilisez déjà.
            </p>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-muted">
              <li>
                Sur Make.com : scénario avec module <strong>Custom webhook</strong> → module Tiime /
                Pennylane / Sellsy…
              </li>
              <li>Collez l’URL du webhook ci-dessous.</li>
              <li>
                Sur un client ClimaZEN : bouton « Envoyer vers facturation » — plus de double saisie.
              </li>
            </ol>
          </div>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Plateforme utilisée</span>
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
                  {p.label} — {p.makeHint}
                </option>
              ))}
            </select>
          </label>
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
            <span className="mb-1 block text-muted">Action par défaut</span>
            <select
              value={form.facturationActionDefaut || 'create_devis'}
              onChange={(e) =>
                setForm({
                  ...form,
                  facturationActionDefaut: e.target.value as typeof form.facturationActionDefaut,
                })
              }
              className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
            >
              <option value="create_client">Créer / mettre à jour le client</option>
              <option value="create_devis">Créer un devis</option>
              <option value="create_facture">Créer une facture</option>
            </select>
          </label>

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
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">
          <div className="font-display text-base font-semibold text-ink">
            {data.operateur.raisonSociale || organization?.name || 'Société'}
          </div>
          <p className="mt-1">
            Les infos cadre [1] sont gérées par le compte officiel. Vous remplissez les CERFA ; ils
            apparaissent sur le compte de la boîte.
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmitSignature}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h2 className="font-display mb-1 text-base font-semibold">Ma signature</h2>
          <p className="mb-3 text-sm text-muted">
            Enregistrez votre signature une fois — elle sera appliquée sur vos CERFA.
          </p>
        </div>
        <Field label="Nom du signataire" value={signNom} onChange={setSignNom} />
        <Field label="Qualité / fonction" value={signQualite} onChange={setSignQualite} />
        <div className="sm:col-span-2">
          <SignaturePad
            label="Signature manuscrite (doigt / stylet)"
            value={signImage || undefined}
            onChange={(v) => setSignImage(v || '')}
            height={180}
            hint="Signez ici, puis cliquez Enregistrer."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover"
          >
            Enregistrer ma signature
          </button>
          {saved && <span className="text-sm text-accent">Signature enregistrée</span>}
        </div>
      </form>

      <form
        onSubmit={(e) => void onChangePassword(e)}
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h2 className="font-display mb-1 text-base font-semibold">Changer mon mot de passe</h2>
          <p className="mb-3 text-sm text-muted">
            Utile pour synchroniser ordi et téléphone — sans attendre l’e-mail de reset.
          </p>
        </div>
        <PasswordField
          label="Nouveau mot de passe *"
          autoComplete="new-password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordField
          label="Confirmer *"
          autoComplete="new-password"
          required
          minLength={6}
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

      {isOwner && (
        <button
          type="button"
          onClick={() => {
            if (confirm('Réinitialiser les données de démo ?')) resetDemo()
          }}
          className="text-sm text-muted underline hover:text-ink"
        >
          Réinitialiser les données de démonstration
        </button>
      )}
    </div>
  )
}
