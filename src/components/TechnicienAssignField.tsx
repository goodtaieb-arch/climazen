import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import type { UserAccount } from '../lib/auth'
import { extraAssigneesFromData, mergeTeamMembers } from '../lib/teamMembers'
import { DossierCloudTechButton } from './DossierCloudTechButton'
import { dossierForUser } from '../lib/rhDocuments'

type Props = {
  technicien: string
  technicienUserId?: string
  onChange: (next: { technicien: string; technicienUserId?: string }) => void
  /** Label au-dessus du select */
  label?: string
  className?: string
}

/**
 * Affectation OT → tous les techniciens de l’équipe (comptes + dossiers + parc).
 */
export function TechnicienAssignField({
  technicien,
  technicienUserId,
  onChange,
  label = 'Technicien affecté *',
  className = '',
}: Props) {
  const { listTeam, user, organization } = useAuth()
  const { data } = useStore()
  const [remote, setRemote] = useState<UserAccount[]>([])

  useEffect(() => {
    let cancelled = false
    void listTeam()
      .then((members) => {
        if (!cancelled) setRemote(members)
      })
      .catch(() => {
        if (!cancelled) setRemote([])
      })
    return () => {
      cancelled = true
    }
  }, [listTeam, organization?.id])

  const team = useMemo(
    () =>
      mergeTeamMembers({
        user,
        remote,
        dossiers: data.personnelDossiers,
        extraAssignees: extraAssigneesFromData(data),
        retiredIds: data.personnelRetiresUserIds,
        orgId: user?.organizationId || organization?.id,
      }),
    [user, remote, data, organization?.id],
  )

  const selectValue = technicienUserId || ''

  return (
    <div className={`block text-sm ${className}`}>
      <span className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
        <Users className="h-3.5 w-3.5 text-accent" />
        {label}
      </span>
      <select
        value={selectValue}
        onChange={(e) => {
          const id = e.target.value
          if (!id) {
            onChange({ technicien: '', technicienUserId: undefined })
            return
          }
          const m = team.find((t) => t.id === id)
          const name =
            m?.signataireNom?.trim() ||
            m?.fullName?.trim() ||
            m?.email ||
            technicien ||
            ''
          onChange({ technicien: name, technicienUserId: id })
        }}
        className="h-11 w-full rounded-xl border border-line bg-white px-3"
      >
        <option value="">— Choisir un technicien —</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.fullName || m.email}
            {m.role === 'owner' ? ' (gérant)' : ''}
            {m.active === false ? ' (inactif)' : ''}
          </option>
        ))}
      </select>
      {!selectValue && technicien.trim() ? (
        <p className="mt-1 text-[11px] text-muted">
          Nom libre actuel : <strong className="font-semibold text-ink">{technicien}</strong> —
          choisissez un compte équipe pour l’affectation.
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted">
          Tous les techniciens de l’équipe. Le gérant prend l’appel, crée l’OT, puis affecte celui
          qui interviendra.
        </p>
      )}
      {selectValue ? (
        <div className="mt-2">
          <DossierCloudTechButton
            techName={team.find((t) => t.id === selectValue)?.fullName || technicien || 'Technicien'}
            lienCloudDossier={dossierForUser(data.personnelDossiers, selectValue)?.lienCloudDossier}
            racineCloud={data.operateur.lienCloudRhRacine}
            variant="link"
            label="Photos pièces — ouvrir son dossier cloud"
            hideIfMissing
          />
        </div>
      ) : null}
    </div>
  )
}
