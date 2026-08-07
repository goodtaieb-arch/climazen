import { type FormEvent, useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { Field } from './ClientsPage'
import { SignaturePad } from '../components/SignaturePad'
import { useAuth } from '../lib/AuthContext'

export function OperateurPage() {
  const { data, setOperateur, resetDemo } = useStore()
  const { user, organization, isOwner, saveMySignature } = useAuth()

  const [form, setForm] = useState(data.operateur)
  const [signNom, setSignNom] = useState(user?.signataireNom || user?.fullName || '')
  const [signQualite, setSignQualite] = useState(
    user?.signataireQualite || (isOwner ? 'Responsable / gérant' : 'Opérateur attesté'),
  )
  const [signImage, setSignImage] = useState(user?.signatureImage || '')
  const [saved, setSaved] = useState(false)

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
