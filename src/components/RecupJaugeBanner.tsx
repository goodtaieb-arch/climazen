import { jaugeRemplissageRecup, type JaugeRecupInfo } from '../lib/stockRegles'
import type { StockItem } from '../lib/types'

export function RecupJaugeBanner({ item }: { item: StockItem }) {
  const j = jaugeRemplissageRecup(item)
  if (!j) return null
  return <RecupJaugeBannerFromInfo info={j} numero={item.numeroContenant} />
}

export function RecupJaugeBannerFromInfo({
  info,
  numero,
}: {
  info: JaugeRecupInfo
  numero?: string
}) {
  if (!info.message && info.pctAutorise < 50) {
    return (
      <p className="text-xs text-muted">
        Jauge cumulée{numero ? ` ${numero}` : ''} : {info.actuelKg} / {info.maxAutoriseKg} kg max
        autorisés (80 % de {info.nominalKg} kg nominaux) — reste {info.restanteKg} kg. Même fluide,
        multi-sites OK.
      </p>
    )
  }
  if (!info.message) return null
  const cls = info.pleine
    ? 'border-red-400 bg-red-50 text-red-950'
    : 'border-amber-400 bg-amber-50 text-amber-950'
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${cls}`} role="status">
      <strong>⚠ {info.message}</strong>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full rounded-full ${info.pleine ? 'bg-red-600' : 'bg-amber-500'}`}
          style={{ width: `${info.pctAutorise}%` }}
        />
      </div>
      <p className="mt-1 opacity-90">
        {info.actuelKg} kg / {info.maxAutoriseKg} kg max (80 % de {info.nominalKg} kg) —{' '}
        {info.pctAutorise} %
      </p>
    </div>
  )
}
