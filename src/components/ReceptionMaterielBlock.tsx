import { useMemo, useState } from 'react'
import { Car, CheckCircle2, ClipboardCheck, Wrench } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import {
  grouperMaterielParFamille,
  materielEnAttenteReception,
} from '../lib/attributionMateriel'
import { blankEtatLieux, erreurEtatLieux, voitureTitreCourt } from '../lib/voitures'
import type { VoitureEtatLieux } from '../lib/types'
import { EtatLieuxVoitureForm } from './EtatLieuxVoitureForm'

type Props = {
  userId: string
  /** Par défaut : véhicule + outillage. */
  kinds?: Array<'voiture' | 'outillage'>
}

export function ReceptionMaterielBlock({ userId, kinds }: Props) {
  const { data, validerReceptionMateriel } = useStore()
  const { user, isOwner } = useAuth()
  const wantV = !kinds || kinds.includes('voiture')
  const wantO = !kinds || kinds.includes('outillage')
  const pendingAll = materielEnAttenteReception(data, userId)
  const pending = pendingAll.filter(
    (l) => (l.kind === 'voiture' && wantV) || (l.kind === 'outillage' && wantO),
  )
  const voituresPending = wantV
    ? (data.voitures || []).filter((v) => v.assigneeUserId === userId && !v.receptionAt)
    : []
  const outilsPending = wantO
    ? (data.outillages || []).filter((o) => o.assigneeUserId === userId && !o.receptionAt)
    : []
  const groupesOutils = grouperMaterielParFamille(
    pending.filter((l) => l.kind === 'outillage'),
  )
  const isDestinataire = user?.id === userId
  const canValider = isDestinataire || isOwner

  const [etatByVoiture, setEtatByVoiture] = useState<Record<string, VoitureEtatLieux>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState('')

  const etatPour = (voitureId: string, documentsFournis?: VoitureEtatLieux['documentsRecus']) =>
    etatByVoiture[voitureId] || blankEtatLieux(documentsFournis)

  const onValiderVoiture = async (voitureId: string) => {
    const v = voituresPending.find((x) => x.id === voitureId)
    if (!v) return
    const etat = etatPour(voitureId, v.documentsFournis)
    const err = erreurEtatLieux(etat)
    if (err) {
      setError(err)
      return
    }
    setError('')
    setBusy(voitureId)
    try {
      await validerReceptionMateriel({ userId, voitureId, etatVoiture: etat })
      setDone('État des lieux enregistré — PDF généré pour le gérant.')
      setTimeout(() => setDone(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation impossible')
    } finally {
      setBusy(null)
    }
  }

  const onValiderOutils = async () => {
    if (!outilsPending.length) return
    setError('')
    setBusy('outils')
    try {
      await validerReceptionMateriel({
        userId,
        outillageIds: outilsPending.map((o) => o.id),
      })
      setDone('Bon de remise outillage enregistré — PDF généré pour le gérant.')
      setTimeout(() => setDone(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation impossible')
    } finally {
      setBusy(null)
    }
  }

  const resume = useMemo(() => {
    const nV = voituresPending.length
    const nO = outilsPending.length
    if (!nV && !nO) return ''
    const parts: string[] = []
    if (nV) parts.push(`${nV} véhicule${nV > 1 ? 's' : ''}`)
    if (nO) parts.push(`${nO} outil${nO > 1 ? 's' : ''} / téléphone`)
    return parts.join(' et ')
  }, [voituresPending.length, outilsPending.length])

  if (!pending.length) return null

  if (!canValider) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          Réception en attente
        </div>
        <p className="mt-1 text-sm text-amber-950">
          L’opérateur ou le gérant doit encore enregistrer {resume}. Pour un véhicule, un état des
          lieux et la liste des documents pris seront générés en PDF.
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-950">
          {pending.map((l) => (
            <li key={`${l.kind}-${l.itemId}`}>
              <span className="font-medium">{l.famille}</span> — {l.label}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          {isDestinataire ? 'Valider la réception du matériel' : 'Enregistrer la réception (remise en main propre)'}
        </div>
        <p className="mt-1 text-sm text-amber-950">
          {isDestinataire
            ? `La société vous a attribué ${resume}. Confirmez la prise en main. Un PDF officiel est conservé par le gérant (état des lieux + documents pour le véhicule).`
            : `Remise à l’opérateur : ${resume}. Remplissez l’état des lieux du véhicule et les documents pris, puis validez ici — pas besoin que l’opérateur se connecte. Le PDF est conservé dans ce dossier.`}
        </p>
      </div>

      {voituresPending.map((v) => (
        <div key={v.id} className="rounded-xl border border-line bg-white p-4">
          <h3 className="font-display mb-3 flex items-center gap-2 text-sm font-semibold">
            <Car className="h-4 w-4 text-accent" />
            Véhicule — {voitureTitreCourt(v)}
          </h3>
          <EtatLieuxVoitureForm
            voiture={v}
            value={etatPour(v.id, v.documentsFournis)}
            onChange={(next) => setEtatByVoiture((prev) => ({ ...prev, [v.id]: next }))}
          />
          <button
            type="button"
            disabled={busy === v.id}
            onClick={() => void onValiderVoiture(v.id)}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy === v.id
              ? 'Enregistrement…'
              : isDestinataire
                ? 'Valider l’état des lieux et les documents'
                : 'Enregistrer l’état des lieux et les documents pris'}
          </button>
        </div>
      ))}

      {outilsPending.length > 0 ? (
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="font-display mb-2 flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4 text-accent" />
            Outillage / téléphone
          </h3>
          <ul className="mb-3 space-y-2 text-sm">
            {groupesOutils.map((g) => (
              <li key={g.famille}>
                <div className="text-xs font-bold uppercase tracking-wide text-muted">{g.famille}</div>
                <ul className="mt-1 space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.itemId}>{it.label}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy === 'outils'}
            onClick={() => void onValiderOutils()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy === 'outils'
              ? 'Enregistrement…'
              : isDestinataire
                ? 'Je confirme avoir reçu cet outillage'
                : 'Enregistrer la remise de l’outillage / téléphone'}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      {done ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          {done}
        </p>
      ) : null}
    </div>
  )
}
