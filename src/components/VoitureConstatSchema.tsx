import type { VoitureMarqueCarrosserie, VoitureZoneId } from '../lib/types'
import {
  CONSTAT_VB,
  VOITURE_ZONES,
  cycleMarqueZone,
  resumeMarquesCarrosserie,
  voitureZoneLabel,
} from '../lib/voitureConstat'

type Props = {
  marques: VoitureMarqueCarrosserie[] | undefined
  onChange?: (next: VoitureMarqueCarrosserie[]) => void
  readOnly?: boolean
}

function marquePour(marques: VoitureMarqueCarrosserie[] | undefined, zone: VoitureZoneId) {
  return marques?.find((m) => m.zone === zone)?.type
}

export function VoitureConstatSchema({ marques, onChange, readOnly }: Props) {
  const list = marques || []

  const onZone = (zone: VoitureZoneId) => {
    if (readOnly || !onChange) return
    onChange(cycleMarqueZone(list, zone))
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 text-sm font-semibold text-ink">Schéma du véhicule (constat)</div>
      <p className="mb-2 text-xs text-muted">
        {readOnly
          ? list.length
            ? `Marques : ${resumeMarquesCarrosserie(list)}.`
            : 'Aucune bosse ni rayure marquée sur le schéma.'
          : 'Touchez une zone : 1er tap = rayure (✕ orange), 2e = bosse (● rouge), 3e = rien. Comme sur le constat.'}
      </p>
      <div className="mx-auto max-w-sm rounded-2xl border border-line bg-white p-3">
        <svg
          viewBox={`0 0 ${CONSTAT_VB.w} ${CONSTAT_VB.h}`}
          className="h-auto w-full"
          role="img"
          aria-label="Vue de dessus du véhicule, avant en haut"
        >
          <rect x="0" y="0" width={CONSTAT_VB.w} height={CONSTAT_VB.h} fill="#f8fafc" rx="16" />
          <text x="120" y="18" textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="sans-serif">
            AVANT
          </text>
          <text x="120" y="408" textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="sans-serif">
            ARRIÈRE
          </text>
          <text
            x="18"
            y="210"
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
            fontFamily="sans-serif"
            transform="rotate(-90 18 210)"
          >
            GAUCHE
          </text>
          <text
            x="222"
            y="210"
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
            fontFamily="sans-serif"
            transform="rotate(90 222 210)"
          >
            DROITE
          </text>

          {/* Roues */}
          <ellipse cx="48" cy="96" rx="13" ry="26" fill="#334155" />
          <ellipse cx="192" cy="96" rx="13" ry="26" fill="#334155" />
          <ellipse cx="48" cy="292" rx="13" ry="26" fill="#334155" />
          <ellipse cx="192" cy="292" rx="13" ry="26" fill="#334155" />

          {/* Silhouette */}
          <rect x="62" y="32" width="116" height="308" rx="26" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />

          {VOITURE_ZONES.map((z) => {
            const kind = marquePour(list, z.id)
            const fill = kind === 'bosse' ? '#fecaca' : kind === 'rayure' ? '#fed7aa' : '#f8fafc'
            const stroke = kind === 'bosse' ? '#b91c1c' : kind === 'rayure' ? '#c2410c' : '#64748b'
            const cx = z.x + z.w / 2
            const cy = z.y + z.h / 2
            return (
              <g
                key={z.id}
                className={readOnly ? undefined : 'cursor-pointer'}
                onClick={() => onZone(z.id)}
              >
                <rect
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  rx="6"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={kind ? 2.2 : 1.2}
                />
                <title>{z.label}</title>
                {kind === 'rayure' ? (
                  <>
                    <line
                      x1={cx - 8}
                      y1={cy - 8}
                      x2={cx + 8}
                      y2={cy + 8}
                      stroke="#c2410c"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                    <line
                      x1={cx + 8}
                      y1={cy - 8}
                      x2={cx - 8}
                      y2={cy + 8}
                      stroke="#c2410c"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </>
                ) : null}
                {kind === 'bosse' ? (
                  <circle cx={cx} cy={cy} r="7" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.2" />
                ) : null}
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="text-orange-700">✕</span> Rayure
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Bosse
          </span>
          {!readOnly ? <span>Tap = cycle</span> : null}
        </div>
      </div>
      {list.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-ink">
          {list.map((m) => (
            <li key={m.zone}>
              <span className={m.type === 'bosse' ? 'font-semibold text-red-700' : 'font-semibold text-orange-800'}>
                {m.type === 'bosse' ? 'Bosse' : 'Rayure'}
              </span>
              {' — '}
              {voitureZoneLabel(m.zone)}
            </li>
          ))}
        </ul>
      ) : null}
      {!readOnly && list.length > 0 && onChange ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 text-xs font-semibold text-muted underline"
        >
          Effacer toutes les marques
        </button>
      ) : null}
    </div>
  )
}
