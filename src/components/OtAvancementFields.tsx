import {
  clampAvancementPct,
  formatOtAvancement,
  otAvancementPct,
  presenceValideeLeJour,
  type OrdreTravail,
  type VisitePresenceOt,
} from '../lib/ordreTravail'

function fmtDateFr(iso: string) {
  const d = (iso || '').slice(0, 10)
  if (!d) return '—'
  const [y, m, j] = d.split('-')
  return j && m && y ? `${j}/${m}/${y}` : d
}

type Props = {
  form: Pick<
    OrdreTravail,
    'date' | 'statut' | 'interventionPartielle' | 'avancementPct' | 'visitesPresence'
  >
  disabled?: boolean
  onChange: (patch: {
    interventionPartielle: boolean
    avancementPct: number
  }) => void
}

export function OtAvancementFields({ form, disabled, onChange }: Props) {
  const pct = otAvancementPct(form)
  const partielle = Boolean(form.interventionPartielle) || (pct > 0 && pct < 100)
  const visites: VisitePresenceOt[] = form.visitesPresence || []
  const dateJour = (form.date || '').slice(0, 10)
  const presenceJour = presenceValideeLeJour(form, dateJour)
  const badge = formatOtAvancement({ ...form, interventionPartielle: partielle })

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Avancement (plusieurs jours)</p>
        {badge ? (
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-950">
            {badge} réalisé
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Maintenance / réparation sur plusieurs passages : indiquez le % fait, puis faites signer le
        client pour valider la <strong>présence du jour</strong> — sans clôturer l’OT.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          disabled={disabled}
          checked={partielle}
          onChange={(e) => {
            const on = e.target.checked
            onChange({
              interventionPartielle: on,
              avancementPct: on ? Math.max(pct, 10) : pct >= 100 ? 100 : pct,
            })
          }}
        />
        <span>
          <span className="font-semibold text-ink">Intervention partielle</span>
          <span className="mt-0.5 block text-xs text-muted">
            Le chantier continue. Signature client obligatoire à chaque passage.
          </span>
        </span>
      </label>
      {(partielle || pct > 0) && (
        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between font-semibold text-ink">
            <span>Pourcentage d’avancement</span>
            <span className="tabular-nums text-amber-950">{pct} %</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            value={pct}
            onChange={(e) =>
              onChange({
                interventionPartielle: clampAvancementPct(e.target.value) < 100,
                avancementPct: clampAvancementPct(e.target.value),
              })
            }
            className="w-full accent-[#0f766e]"
          />
          <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-muted">
            <span>0 %</span>
            <span>50 %</span>
            <span>100 %</span>
          </div>
        </label>
      )}
      {presenceJour ? (
        <p className="rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-900">
          Présence du {fmtDateFr(dateJour)} déjà signée par le client.
        </p>
      ) : null}
      {visites.length > 0 ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Passages</p>
          <ul className="mt-1 space-y-1">
            {[...visites]
              .slice()
              .reverse()
              .map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs text-ink"
                >
                  <span>
                    {fmtDateFr(v.date)} · {clampAvancementPct(v.avancementPct)} %
                    {v.note ? ` — ${v.note.slice(0, 80)}` : ''}
                  </span>
                  <span className="font-semibold text-emerald-800">
                    {v.signatureClientImage ? 'Présence signée' : 'Sans signature'}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
