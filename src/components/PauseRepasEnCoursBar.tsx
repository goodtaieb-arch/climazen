import { useEffect, useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import {
  formatCompteAReboursPause,
  secondesAvantAlarmePauseRepas,
} from '../lib/pointage'
import {
  alarmePauseRepasDejaDeclenchee,
  demanderPermissionAlarmePauseRepas,
  marquerAlarmePauseRepasDeclenchee,
  notifierFinPauseRepas,
  preparerSonAlarmePauseRepas,
} from '../lib/pauseRepasAlarme'

type Props = {
  startedAt: string
  numeroOt?: string
  busy?: boolean
  disabled?: boolean
  onStop: () => void
}

export function PauseRepasEnCoursBar({
  startedAt,
  numeroOt,
  busy,
  disabled,
  onStop,
}: Props) {
  const [reste, setReste] = useState(() => secondesAvantAlarmePauseRepas(startedAt))

  useEffect(() => {
    preparerSonAlarmePauseRepas()
    demanderPermissionAlarmePauseRepas()
    setReste(secondesAvantAlarmePauseRepas(startedAt))
    const tick = () => {
      const s = secondesAvantAlarmePauseRepas(startedAt)
      setReste(s)
      if (s <= 0 && !alarmePauseRepasDejaDeclenchee(startedAt)) {
        marquerAlarmePauseRepasDeclenchee(startedAt)
        notifierFinPauseRepas({ numero: numeroOt })
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [startedAt, numeroOt])

  const echoe = reste <= 0

  return (
    <div
      className={[
        'space-y-2 rounded-2xl border px-3 py-3',
        echoe
          ? 'border-amber-400 bg-amber-50'
          : 'border-orange-200 bg-orange-50',
      ].join(' ')}
    >
      <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
        <UtensilsCrossed className="h-4 w-4 shrink-0" />
        Pause repas sur site
        {numeroOt ? ` · ${numeroOt}` : ''}
      </p>
      {echoe ? (
        <p className="text-xs font-semibold text-amber-950">
          1 h écoulée — alarme de fin de pause. Arrêtez pour reprendre l’INT en cours, sans
          re-pointer « Entrer ».
        </p>
      ) : (
        <p className="text-xs font-semibold text-orange-950">
          Alarme dans {formatCompteAReboursPause(reste)} (1 h). Le temps repas n’entre pas dans
          le quota.
        </p>
      )}
      <button
        type="button"
        disabled={busy || disabled}
        onClick={onStop}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white"
      >
        Arrêter la pause repas
      </button>
    </div>
  )
}
