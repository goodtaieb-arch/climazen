import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, ChevronRight, QrCode, ScanLine } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  findEquipementById,
  parseEquipQrPayload,
  equipLabelForQr,
} from '../lib/equipementQr'
import { findSiteById, parseSiteQrPayload } from '../lib/siteQr'
import { allEquipements, equipmentLabel } from '../lib/cerfaBatch'
import { clientDisplayName } from '../lib/types'
import { isOtCloture } from '../lib/ordreTravail'
import { BarcodeScanButton } from '../components/BarcodeScanButton'

/**
 * Scan QR étiquette équipement → OT prérempli pour cette machine.
 * Scan QR du bâtiment → parc du site + ticket sans machine imposée.
 * Deep-link : /app/scan-equip?eq=… ou ?site=…
 */
export function ScanEquipementPage() {
  const { data } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const eqFromUrl = params.get('eq') || ''
  const siteFromUrl = params.get('site') || params.get('chantier') || ''
  const autoCamera = params.get('camera') === '1' || params.get('scan') === '1'
  /** ?fiche=1 → ouvrir Sites & Parc au lieu de l’OT */
  const openFicheOnly = params.get('fiche') === '1'
  const [error, setError] = useState('')
  const [resolvedMsg, setResolvedMsg] = useState('')
  const [resolvedSiteId, setResolvedSiteId] = useState(eqFromUrl ? '' : siteFromUrl)

  const siteHit = useMemo(
    () => (resolvedSiteId ? findSiteById(data, resolvedSiteId) : null),
    [data, resolvedSiteId],
  )
  const siteEqs = useMemo(
    () => (siteHit ? allEquipements(siteHit.site) : []),
    [siteHit],
  )

  const goToHit = (equipId: string) => {
    const hit = findEquipementById(data, equipId)
    if (!hit) {
      setError(
        'Équipement introuvable sur ce compte. Vérifiez que l’étiquette correspond à votre parc.',
      )
      return
    }
    setError('')
    setResolvedSiteId('')
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

  const goToSite = (siteId: string) => {
    const hit = findSiteById(data, siteId)
    if (!hit) {
      setError(
        'Site introuvable sur ce compte. Vérifiez que le QR du bâtiment correspond à votre parc.',
      )
      setResolvedSiteId('')
      return
    }
    setError('')
    setResolvedMsg('')
    setResolvedSiteId(hit.site.id)

    if (openFicheOnly) {
      navigate(`/app/chantiers?site=${encodeURIComponent(hit.site.id)}`, { replace: true })
    }
  }

  const openSiteTicket = () => {
    if (!siteHit) return
    const openOt = (data.ordresTravail || []).find(
      (o) =>
        !isOtCloture(o.statut) &&
        o.chantierId === siteHit.site.id &&
        !o.equipementId &&
        !(o.equipementIds && o.equipementIds.length > 0),
    )
    if (openOt) {
      navigate(`/app/appel?ot=${encodeURIComponent(openOt.id)}`)
      return
    }
    navigate(
      `/app/appel?client=${encodeURIComponent(siteHit.site.clientId)}&chantier=${encodeURIComponent(siteHit.site.id)}&from=scan`,
    )
  }

  useEffect(() => {
    if (eqFromUrl) {
      goToHit(eqFromUrl)
      return
    }
    if (siteFromUrl) goToSite(siteFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eqFromUrl, siteFromUrl, data.chantiers, data.ordresTravail])

  const onScan = (raw: string) => {
    const siteId = parseSiteQrPayload(raw)
    if (siteId) {
      goToSite(siteId)
      return
    }
    const id = parseEquipQrPayload(raw)
    if (!id) {
      setError('QR non reconnu — attendez un QR ClimaZEN (équipement ou bâtiment).')
      return
    }
    goToHit(id)
  }

  const hint = useMemo(
    () =>
      'Cadrez le QR collé sur la machine (INT de cet équipement) ou le QR du bâtiment (parc + ticket).',
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
          Scanner un QR
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
              Machine → INT prérempli. Bâtiment (local technique / accueil) → tout le parc et un
              ticket de panne.
            </p>
          </div>
          <BarcodeScanButton
            title="Scanner QR"
            dialogTitle="Scanner le QR ClimaZEN"
            hint="Cadrez le QR collé sur l’équipement ou le QR du bâtiment."
            autoStart={autoCamera}
            onDetected={onScan}
          />
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-danger">{error}</p> : null}
        {resolvedMsg ? (
          <p className="mt-3 text-sm font-semibold text-accent">Ouverture INT : {resolvedMsg}</p>
        ) : null}
      </div>

      {siteHit ? (
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-orange-600">
              <Building2 className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                QR du bâtiment
              </p>
              <p className="font-semibold text-ink">{siteHit.site.nom}</p>
              <p className="text-sm text-muted">
                {[
                  siteHit.client ? clientDisplayName(siteHit.client) : '',
                  [siteHit.site.codePostal, siteHit.site.ville].filter(Boolean).join(' '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              to={`/app/chantiers?site=${encodeURIComponent(siteHit.site.id)}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold active:bg-mist"
            >
              Voir le parc
            </Link>
            <button
              type="button"
              onClick={openSiteTicket}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-ink"
            >
              Ouvrir un ticket
            </button>
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted">
            {siteEqs.length} équipement{siteEqs.length > 1 ? 's' : ''}
          </p>
          {siteEqs.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Aucun équipement encore. Ouvrez un ticket ou complétez le parc.
            </p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-xl border border-line">
              {siteEqs.map((eq, idx) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => goToHit(eq.id)}
                  className={[
                    'flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left active:bg-mist',
                    idx > 0 ? 'border-t border-line' : '',
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {eq.nom?.trim() || eq.type || equipmentLabel(eq) || 'Sans libellé'}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {[eq.marque, eq.modele, eq.numeroSerie ? `SN ${eq.numeroSerie}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-line bg-mist/50 p-4 text-sm text-slate">
        <p className="font-semibold text-ink">Où est le bouton ?</p>
        <p className="mt-1">
          Accueil → <strong>Scanner QR</strong>. Impression : Sites &amp; Parc → Options du site →{' '}
          <strong>QR du bâtiment</strong> (sticker accueil) ou <strong>QR de tous</strong> (une
          étiquette par machine).
        </p>
      </div>
    </div>
  )
}
