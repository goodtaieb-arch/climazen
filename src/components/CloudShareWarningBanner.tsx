import { useMemo, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import {
  collectCloudKinds,
  orderedCloudSetupSteps,
  type CloudKind,
} from '../lib/cloudLinkGuard'

/** Une fois fermé sur cet appareil, le bandeau post-MAJ ne revient pas. */
const DISMISS_KEY = 'climazen_dismiss_cloud_share_v132'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Avertissement après la MAJ : ce qu’il faut faire dans Drive / OneDrive / SharePoint.
 * Le cloud déjà collé (s’il y en a un) est affiché en premier.
 */
export function CloudShareWarningBanner() {
  const { user, isOwner } = useAuth()
  const { data } = useStore()
  const [hidden, setHidden] = useState(wasDismissed)

  const kinds = useMemo<CloudKind[]>(() => {
    return collectCloudKinds([
      data.operateur.lienCloudRhRacine,
      ...(data.personnelDossiers || []).map((d) => d.lienCloudDossier),
    ])
  }, [data.operateur.lienCloudRhRacine, data.personnelDossiers])

  const steps = useMemo(() => orderedCloudSetupSteps(kinds), [kinds])

  if (!user || hidden) return null

  const onDismiss = () => {
    markDismissed()
    setHidden(true)
  }

  const detected =
    kinds.length === 1
      ? steps.find((s) => s.kind === kinds[0])?.title
      : kinds.length > 1
        ? steps
            .filter((s) => kinds.includes(s.kind))
            .map((s) => s.title)
            .join(' / ')
        : null

  return (
    <div
      className="mb-4 rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-ink">
            Après la mise à jour — à faire dans votre cloud
          </p>
          {detected ? (
            <p className="mt-1 font-semibold">Cloud détecté : {detected}.</p>
          ) : (
            <p className="mt-1 font-semibold">Google Drive, OneDrive ou SharePoint.</p>
          )}
          <p className="mt-1 text-amber-950/90">
            {isOwner
              ? 'Photos pièces n’ouvre le dossier que s’il n’est pas public. Passez le partage en privé, puis collez le lien exact de chaque opérateur dans Équipe (sous son nom).'
              : 'Si Photos pièces ne s’ouvre pas, le dossier n’est pas privé. Demandez au gérant de corriger le partage, puis de coller le lien exact dans Équipe.'}
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            {steps.map((s) => (
              <li key={s.kind}>
                <strong>{s.title}</strong>
                {kinds.includes(s.kind) ? (
                  <span className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                    vous
                  </span>
                ) : null}
                {' — '}
                {s.body}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {isOwner ? (
              <Link
                to="/app/equipe"
                className="inline-flex min-h-10 items-center rounded-full bg-amber-500 px-4 text-xs font-bold text-amber-950 hover:bg-amber-600"
              >
                Ouvrir Équipe
              </Link>
            ) : (
              <Link
                to="/app/profil"
                className="inline-flex min-h-10 items-center rounded-full bg-amber-500 px-4 text-xs font-bold text-amber-950 hover:bg-amber-600"
              >
                Mon dossier cloud
              </Link>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-10 items-center rounded-full border border-amber-400 bg-white px-4 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              J’ai compris
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="touch-target -mr-1 -mt-1 shrink-0 rounded-full p-1 text-amber-800 hover:bg-amber-200"
          aria-label="Fermer l’avertissement cloud"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
