import type { Voiture, VoitureCarburant, VoitureDocumentId, VoitureEtatLieux } from '../lib/types'
import {
  VOITURE_CARBURANT_LABELS,
  VOITURE_CARROSSERIE_LABELS,
  VOITURE_DOCUMENTS,
  VOITURE_INTERIEUR_LABELS,
  VOITURE_PNEUS_LABELS,
  voitureTitreCourt,
} from '../lib/voitures'
import { VoitureConstatSchema } from './VoitureConstatSchema'
import { Field } from '../pages/ClientsPage'

type Props = {
  voiture: Voiture
  value: VoitureEtatLieux
  onChange: (next: VoitureEtatLieux) => void
  error?: string
}

function RadioRow<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string
  label: string
  value: T | undefined
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1.5 block text-sm font-semibold text-ink">{label} *</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={[
              'inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-xs font-semibold',
              value === opt.id
                ? 'border-accent bg-accent/20 text-ink'
                : 'border-line bg-white text-muted hover:bg-mist',
            ].join(' ')}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function EtatLieuxVoitureForm({ voiture, value, onChange, error }: Props) {
  const fournis = new Set(voiture.documentsFournis || [])
  const recus = new Set(value.documentsRecus || [])

  const toggleDoc = (id: VoitureDocumentId) => {
    const next = recus.has(id)
      ? value.documentsRecus.filter((x) => x !== id)
      : [...value.documentsRecus, id]
    onChange({ ...value, documentsRecus: next })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <p className="text-sm text-muted sm:col-span-2">
        État des lieux de <span className="font-semibold text-ink">{voitureTitreCourt(voiture)}</span>
        {' — '}cochez les documents pris avec le véhicule (carte grise, clés, badge…).
      </p>
      <Field
        label="Date de l’état des lieux *"
        type="date"
        value={value.date}
        onChange={(date) => onChange({ ...value, date })}
        required
      />
      <Field
        label="Kilométrage (compteur) *"
        type="number"
        inputMode="numeric"
        value={value.kilometrage ?? ''}
        onChange={(v) =>
          onChange({
            ...value,
            kilometrage: v === '' ? undefined : Number(v),
          })
        }
        required
      />
      <RadioRow
        name={`${voiture.id}-carburant`}
        label="Niveau de carburant"
        value={value.carburant}
        options={(Object.keys(VOITURE_CARBURANT_LABELS) as VoitureCarburant[]).map((id) => ({
          id,
          label: VOITURE_CARBURANT_LABELS[id],
        }))}
        onChange={(carburant) => onChange({ ...value, carburant })}
      />
      <RadioRow
        name={`${voiture.id}-carrosserie`}
        label="Carrosserie"
        value={value.carrosserie}
        options={(Object.keys(VOITURE_CARROSSERIE_LABELS) as (keyof typeof VOITURE_CARROSSERIE_LABELS)[]).map(
          (id) => ({ id, label: VOITURE_CARROSSERIE_LABELS[id] }),
        )}
        onChange={(carrosserie) => onChange({ ...value, carrosserie })}
      />
      <RadioRow
        name={`${voiture.id}-interieur`}
        label="Intérieur"
        value={value.interieur}
        options={(Object.keys(VOITURE_INTERIEUR_LABELS) as (keyof typeof VOITURE_INTERIEUR_LABELS)[]).map(
          (id) => ({ id, label: VOITURE_INTERIEUR_LABELS[id] }),
        )}
        onChange={(interieur) => onChange({ ...value, interieur })}
      />
      <RadioRow
        name={`${voiture.id}-pneus`}
        label="Pneus"
        value={value.pneus}
        options={(Object.keys(VOITURE_PNEUS_LABELS) as (keyof typeof VOITURE_PNEUS_LABELS)[]).map((id) => ({
          id,
          label: VOITURE_PNEUS_LABELS[id],
        }))}
        onChange={(pneus) => onChange({ ...value, pneus })}
      />

      <VoitureConstatSchema
        marques={value.marquesCarrosserie}
        onChange={(marquesCarrosserie) => onChange({ ...value, marquesCarrosserie })}
      />

      <div className="sm:col-span-2">
        <div className="mb-1.5 text-sm font-semibold text-ink">Documents pris avec le véhicule *</div>
        {fournis.size > 0 ? (
          <p className="mb-2 text-xs text-muted">
            Le gérant a indiqué ces papiers / accessoires à la remise — décochez si vous ne les
            prenez pas.
          </p>
        ) : (
          <p className="mb-2 text-xs text-muted">
            Cochez tout ce que vous emportez (carte grise, assurance, clés, badge…).
          </p>
        )}
        <ul className="space-y-1.5">
          {VOITURE_DOCUMENTS.map((d) => (
            <li key={d.id}>
              <label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={recus.has(d.id)}
                  onChange={() => toggleDoc(d.id)}
                />
                <span>
                  {d.label}
                  {fournis.has(d.id) ? (
                    <span className="ml-1 text-[11px] font-semibold uppercase text-accent">
                      indiqué par le gérant
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {recus.has('autre') ? (
          <div className="mt-2">
            <Field
              label="Précisez l’autre document / accessoire"
              value={value.documentsAutre || ''}
              onChange={(documentsAutre) => onChange({ ...value, documentsAutre })}
            />
          </div>
        ) : null}
      </div>

      <Field
        label="Dommages / chocs constatés"
        value={value.dommages || ''}
        onChange={(dommages) => onChange({ ...value, dommages })}
        className="sm:col-span-2"
      />
      <Field
        label="Observations"
        value={value.observations || ''}
        onChange={(observations) => onChange({ ...value, observations })}
        className="sm:col-span-2"
      />
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-2">
          {error}
        </p>
      ) : null}
    </div>
  )
}
