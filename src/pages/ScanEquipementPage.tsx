import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QrCode, ScanLine } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  findEquipementById,
  parseEquipQrPayload,
  equipLabelForQr,
} from '../lib/equipementQr'
import { clientDisplayName } from '../lib/types'
import { BarcodeScanButton } from '../components/BarcodeScanButton'

/**
 * Scan QR étiquette équipement → ouvre le site / équipement dans Sites & Parc.
 * Aussi deep-link : /app/scan-equip?eq=…
 */
export function ScanEquipementPage() {
  const { data } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const eqFromUrl = params.get('eq') || ''
  const autoCamera = params.get('camera') === '1' || params.get('scan') === '1'
  const [error, setError] = useState('')
  const [resolvedMsg, setResolvedMsg] = useState('')

  const goToHit = (equipId: string) => {
    const hit = findEquipementById(data, equipId)
    if (!hit) {
      setError(
        'Équipement introuvable sur ce compte. Vérifiez que l’étiquette correspond à votre parc.',
      )
      return
    }
    setError('')
    setResolvedMsg(
      `${equipLabelForQr(hit.equip)} — ${hit.site.nom}${
        hit.client ? ` · ${clientDisplayName(hit.client)}` : ''
      }`,
    )
    navigate(
      `/app/chantiers?site=${encodeURIComponent(hit.site.id)}&equipement=${encodeURIComponent(hit.equip.id)}`,
      { replace: true },
    )
  }

  useEffect(() => {
    if (!eqFromUrl) return
    goToHit(eqFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eqFromUrl, data.chantiers])

  const onScan = (raw: string) => {
    const id = parseEquipQrPayload(raw)
    if (!id) {
      setError('QR non reconnu — attendez un QR ClimaZEN équipement.')
      return
    }
    goToHit(id)
  }

  const hint = useMemo(
    () =>
      'Cadrez le QR collé sur l’équipement. Ou ouvrez directement le lien de l’étiquette.',
    [],
  )

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link to="/app" className="text-sm font-semibold text-accent hover:underline">
          ← Accueil
        </Link>
        <h1 className="font-display mt-1 flex items-center gap-2 text-2xl font-bold">
          <ScanLine className="h-7 w-7 text-accent" />
          Scanner un équipement
        </h1>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <QrCode className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">QR étiquette ClimaZEN</p>
            <p className="text-sm text-muted">
              Imprimé depuis Sites &amp; Parc → équipement → Étiquette QR.
            </p>
          </div>
          <BarcodeScanButton
            title="Scanner QR équipement"
            dialogTitle="Scanner l’étiquette équipement"
            hint="Cadrez le QR ClimaZEN collé sur l’équipement."
            autoStart={autoCamera}
            onDetected={onScan}
          />
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
        {resolvedMsg ? (
          <p className="mt-3 text-sm font-semibold text-accent">Ouverture : {resolvedMsg}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-mist/50 p-4 text-sm text-slate">
        <p className="font-semibold text-ink">Astuce terrain</p>
        <p className="mt-1">
          Sur l’accueil, utilisez « Scanner équipement », ou dites « scan équipement » au micro.
        </p>
      </div>
    </div>
  )
}
