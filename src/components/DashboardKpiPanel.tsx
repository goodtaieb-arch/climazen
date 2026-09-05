import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  Package,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import {
  computeDashboardKpi,
  preventifCuratifConic,
  type DashboardKpi,
} from '../lib/dashboardKpi'

function KpiCard({
  to,
  label,
  value,
  hint,
  alert,
}: {
  to: string
  label: string
  value: string | number
  hint?: string
  alert?: boolean
}) {
  return (
    <Link
      to={to}
      className={[
        'min-h-[4.5rem] rounded-2xl border px-3 py-2.5 shadow-sm active:bg-mist',
        alert ? 'border-amber-300 bg-amber-50' : 'border-line bg-white',
      ].join(' ')}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display mt-0.5 text-xl font-black text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </Link>
  )
}

function SplitBar({
  leftPct,
  leftClass,
  rightClass,
}: {
  leftPct: number
  leftClass: string
  rightClass: string
}) {
  const p = Math.max(0, Math.min(100, leftPct))
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-mist">
      {p > 0 ? <div className={leftClass} style={{ width: `${p}%` }} /> : null}
      {p < 100 ? <div className={`flex-1 ${rightClass}`} /> : null}
    </div>
  )
}

function WeekChart({ kpi }: { kpi: DashboardKpi }) {
  const max = Math.max(1, ...kpi.weeks.map((w) => w.total))
  const hasAny = kpi.weeks.some((w) => w.total > 0)
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Volume 8 semaines
      </p>
      <div className="mt-2 flex h-28 items-end gap-1">
        {kpi.weeks.map((w) => (
          <div key={w.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full flex-col justify-end overflow-hidden rounded-md bg-mist/80">
              {w.curatif > 0 ? (
                <div
                  className="w-full bg-orange-500"
                  style={{ height: `${(w.curatif / max) * 100}%` }}
                  title={`Curatif ${w.curatif}`}
                />
              ) : null}
              {w.preventif > 0 ? (
                <div
                  className="w-full bg-accent"
                  style={{ height: `${(w.preventif / max) * 100}%` }}
                  title={`Préventif ${w.preventif}`}
                />
              ) : null}
              {w.autre > 0 ? (
                <div
                  className="w-full bg-slate-400"
                  style={{ height: `${(w.autre / max) * 100}%` }}
                  title={`Autre ${w.autre}`}
                />
              ) : null}
            </div>
            <span className="text-[9px] font-semibold text-muted">{w.label}</span>
          </div>
        ))}
      </div>
      {!hasAny ? (
        <p className="mt-1 text-center text-[11px] text-muted">Pas encore d’INT sur la période.</p>
      ) : null}
    </div>
  )
}

export function DashboardKpiPanel() {
  const { data, peutVoirIdentitesRh } = useStore()
  const { user, isOwner } = useAuth()

  const kpi = useMemo(
    () =>
      computeDashboardKpi({
        data,
        isOwner,
        userId: user?.id,
      }),
    [data, isOwner, user?.id],
  )

  const empty = kpi.totalClasses === 0 && kpi.visitesDue30j === 0 && kpi.visitesRetard === 0
  const title = isOwner ? 'Pilotage société' : 'Mon activité'
  const showRh = isOwner || peutVoirIdentitesRh || Boolean(user?.id)

  return (
    <section
      className="rounded-3xl border border-line bg-white p-4 shadow-sm sm:p-5"
      aria-label={title}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <p className="text-xs text-muted">
            Préventif (contrat / entretien) vs curatif (dépannage)
          </p>
        </div>
        {kpi.otOuverts > 0 ? (
          <p className="text-xs font-semibold text-muted">
            Avancement INT ouvertes {kpi.avgAvancementOuverts} %
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-3">
          <div
            className="relative h-[5.5rem] w-[5.5rem] shrink-0 rounded-full"
            style={{ background: preventifCuratifConic(kpi) }}
            aria-hidden
          >
            <div className="absolute inset-[1.15rem] grid place-items-center rounded-full bg-white">
              <span className="font-display text-sm font-black text-ink">
                {kpi.preventif + kpi.curatif > 0 ? `${kpi.preventifPct} %` : '—'}
              </span>
            </div>
          </div>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="font-semibold text-ink">Préventif</span>
              <span className="text-muted">
                {kpi.preventif} · {kpi.preventifPct} %
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="font-semibold text-ink">Curatif</span>
              <span className="text-muted">
                {kpi.curatif} · {kpi.curatifPct} %
              </span>
            </li>
            {kpi.autre > 0 ? (
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                <span className="font-semibold text-ink">Autre</span>
                <span className="text-muted">{kpi.autre}</span>
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <SplitBar leftPct={kpi.preventifPct} leftClass="bg-accent" rightClass="bg-orange-500" />
          <p className="mt-1.5 text-[11px] text-muted">
            {empty
              ? 'Les graphiques se remplissent dès les premiers INT.'
              : `${kpi.preventif} visites / entretiens · ${kpi.curatif} dépannages`}
          </p>
        </div>
      </div>

      {isOwner ? (
        <div className="mt-4 rounded-2xl border border-line bg-mist/40 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Maintenances contrat — 30 j
          </p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white">
            {kpi.visitesFait30j + kpi.visitesDue30j + kpi.visitesRetard === 0 ? (
              <div className="w-full bg-mist" />
            ) : (
              <>
                {kpi.visitesFait30j > 0 ? (
                  <div
                    className="bg-emerald-500"
                    style={{
                      width: `${(100 * kpi.visitesFait30j) / (kpi.visitesFait30j + kpi.visitesDue30j + kpi.visitesRetard)}%`,
                    }}
                  />
                ) : null}
                {kpi.visitesDue30j > 0 ? (
                  <div
                    className="bg-accent"
                    style={{
                      width: `${(100 * kpi.visitesDue30j) / (kpi.visitesFait30j + kpi.visitesDue30j + kpi.visitesRetard)}%`,
                    }}
                  />
                ) : null}
                {kpi.visitesRetard > 0 ? (
                  <div
                    className="bg-rose-500"
                    style={{
                      width: `${(100 * kpi.visitesRetard) / (kpi.visitesFait30j + kpi.visitesDue30j + kpi.visitesRetard)}%`,
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold">
            <span className="text-emerald-700">Fait {kpi.visitesFait30j}</span>
            <span className="text-teal-800">Dû J-30 {kpi.visitesDue30j}</span>
            <span className={kpi.visitesRetard ? 'text-rose-700' : 'text-muted'}>
              Retard {kpi.visitesRetard}
            </span>
            <span className="text-muted">Avancement {kpi.preventifAvancementPct} %</span>
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <WeekChart kpi={kpi} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          to="/app/ot"
          label="INT ouvertes"
          value={kpi.otOuverts}
          hint={kpi.avgAvancementOuverts ? `${kpi.avgAvancementOuverts} % avancés` : undefined}
        />
        <KpiCard
          to="/app/ot"
          label="En retard"
          value={kpi.otEnRetard}
          hint="Date dépassée ou pièce"
          alert={kpi.otEnRetard > 0}
        />
        <KpiCard
          to="/app/agenda"
          label="Visites J-30"
          value={isOwner ? kpi.visitesDue30j + kpi.visitesRetard : kpi.otCloturesSemaine}
          hint={
            isOwner
              ? kpi.visitesRetard
                ? `${kpi.visitesRetard} en retard`
                : 'À prendre / dues'
              : 'Clôturés cette semaine'
          }
          alert={isOwner && kpi.visitesRetard > 0}
        />
        <KpiCard
          to="/app/interventions"
          label="CERFA brouillons"
          value={kpi.cerfaBrouillons}
          alert={kpi.cerfaBrouillons > 0}
        />
      </div>

      <details className="mt-3 rounded-2xl border border-dashed border-line bg-mist/30 px-3 py-2">
        <summary className="cursor-pointer list-none text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          Plus d’indicateurs
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCard
            to="/app/ot"
            label="Clôturés (mois)"
            value={kpi.otCloturesMois}
            hint={`${kpi.otCloturesSemaine} cette semaine`}
          />
          {isOwner ? (
            <KpiCard
              to="/app/contrats"
              label="Contrats actifs"
              value={kpi.contratsActifs}
              hint={`${kpi.sitesSousContrat} sites sous contrat`}
            />
          ) : null}
          <KpiCard
            to="/app/stock"
            label="Stock fluides"
            value={`${kpi.stockKg}`}
            hint="kg restants"
          />
          <KpiCard
            to={isOwner ? '/app/equipe' : user?.id ? `/app/equipe/${user.id}` : '/app/equipe'}
            label="Étalonnage"
            value={kpi.etalonnageAlertes}
            hint="Bientôt / expiré"
            alert={kpi.etalonnageAlertes > 0}
          />
          {showRh ? (
            <KpiCard
              to={isOwner || peutVoirIdentitesRh ? '/app/equipe' : `/app/equipe/${user?.id || ''}`}
              label="Docs RH"
              value={kpi.rhAlertes}
              hint="Bientôt / expirés"
              alert={kpi.rhAlertes > 0}
            />
          ) : null}
        </div>
        {isOwner && kpi.chargeParTech.length > 0 ? (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <Wrench className="h-3.5 w-3.5" /> Charge par tech (INT ouvertes)
            </p>
            <ul className="mt-1.5 space-y-1">
              {kpi.chargeParTech.map((t) => (
                <li key={t.key} className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-ink">{t.name}</span>
                  <span className="font-bold text-ink">{t.ouverts}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <ClipboardList className="h-3 w-3" /> INT
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Agenda contrat
          </span>
          <span className="inline-flex items-center gap-1">
            <FileCheck2 className="h-3 w-3" /> CERFA
          </span>
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3" /> Stock
          </span>
          {kpi.otEnRetard > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-800">
              <AlertTriangle className="h-3 w-3" /> Retards
            </span>
          ) : null}
        </p>
      </details>
    </section>
  )
}
