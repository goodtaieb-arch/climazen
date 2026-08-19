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
import { isOtCloture } from '../lib/ordreTravail'
import { BarcodeScanButton } from '../components/BarcodeScanButton'

/**
 * Scan QR étiquette équipement → ouvre l’OT (Client appelle) déjà prérempli.
 * Aussi deep-link : /app/scan-equip?eq=…
 */
export function ScanEquipementPage() {
  const { data } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const eqFromUrl = params.get('eq') || ''
  const autoCamera = params.get('camera') === '1' || params.get('scan') === '1'
  /** ?fiche=1 → ouvrir Sites & Parc au lieu de l’OT */
  const openFicheOnly = params.get('fiche') === '1'
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

    if (openFicheOnly) {
      navigate(
        `/app/chantiers?site=${encodeURIComponent(hit.site.id)}&equipement=${encodeURIComponent(hit.equip.id)}`,
        { replace: true },
      )
      return
    }

    // Reprendre un OT déjà ouvert sur ce site / équipement
    const openOt = (data.ordresTravail || []).find(
      (o) =>
        !isOtCloture(o.statut) &&
        o.chantierId === hit.site.id &&
        (o.equipementId === hit.equip.id ||
          (o.equipementIds || []).includes(hit.equip.id)),
    )
    if (openOt) {
      navigate(`/app/appel?ot=${encodeURIComponent(openOt.id)}`, { replace: true })
      return
    }

    navigate(
      `/app/appel?client=${encodeURIComponent(hit.site.clientId)}&chantier=${encodeURIComponent(hit.site.id)}&equipement=${encodeURIComponent(hit.equip.id)}&from=scan`,
      { replace: true },
    )
  }

  useEffect(() => {
    if (!eqFromUrl) return
    goToHit(eqFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eqFromUrl, data.chantiers, data.ordresTravail])

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
      'Cadrez le QR collé sur l’équipement → l’OT s’ouvre prêt à remplir (CERFA / rapport).',
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
              Sur place : scan → OT prérempli (client, site, équipement) pour CERFA / signature.
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
          <p className="mt-3 text-sm font-semibold text-accent">Ouverture OT : {resolvedMsg}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-mist/50 p-4 text-sm text-slate">
        <p className="font-semibold text-ink">Où est le bouton ?</p>
        <p className="mt-1">
          Accueil → <strong>Scanner QR</strong> (cercle) ou « Scanner équipement ». La caméra
          s’ouvre tout de suite.
        </p>
      </div>
    </div>
  )
}
