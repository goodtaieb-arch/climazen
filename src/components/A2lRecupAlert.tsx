import { classeSecuriteFluide, isFluideInflammableA2LOrA3, messageBouteilleRecupA2L } from '../lib/fluides'

/** Alerte visuelle récupération fluide inflammable A2L / A3. */
export function A2lRecupAlert({
  fluide,
  className = '',
}: {
  fluide: string
  className?: string
}) {
  if (!isFluideInflammableA2LOrA3(fluide)) return null
  const classe = classeSecuriteFluide(fluide) || 'A2L'
  const msg = messageBouteilleRecupA2L(fluide)
  return (
    <div
      className={[
        'rounded-xl border-2 border-red-500 bg-red-50 px-3 py-3 text-sm text-red-950',
        className,
      ].join(' ')}
      role="alert"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          ⚠ {classe}
        </span>
        <span className="font-semibold">
          Bouteille {classe} obligatoire (collerette rouge + pas de vis à gauche)
        </span>
      </div>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-red-900">
        <li>Bande / collerette rouge sur l’ogive (inflammabilité)</li>
        <li>Filetage à gauche (LH) — sens inverse des aiguilles d’une montre</li>
        <li>Pictogramme flamme + classe {classe} gravée, PH (bar), date de rééprouvage</li>
        <li>N° de série gravé + traçabilité BSFF / code-barres fluide usagé</li>
      </ul>
      {msg ? <p className="mt-2 text-[11px] text-red-800/90">{msg}</p> : null}
    </div>
  )
}

export function A2lConformiteCheckbox({
  fluide,
  checked,
  onChange,
  id = 'conforme-a2l',
}: {
  fluide: string
  checked: boolean
  onChange: (v: boolean) => void
  id?: string
}) {
  if (!isFluideInflammableA2LOrA3(fluide)) return null
  const classe = classeSecuriteFluide(fluide) || 'A2L'
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm text-ink"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
      />
      <span>
        Je confirme que la bouteille utilisée est certifiée <strong>{classe}</strong> (collerette
        rouge, pas de vis à gauche / LH, pictogramme flamme).
      </span>
    </label>
  )
}
