import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import type { UserAccount } from '../lib/auth'
import { extraAssigneesFromData, mergeTeamMembers } from '../lib/teamMembers'
import { DossierCloudTechButton } from './DossierCloudTechButton'
import { dossierForUser } from '../lib/rhDocuments'
import {
  isPosteBureau,
  isPosteTerrain,
  optionLabelAvecPoste,
  posteCouvreTouteLEquipe,
} from '../lib/postePersonnel'
import { labelAgence, parseAgenceCode } from '../lib/agences'
import { syncTechsOt } from '../lib/ordreTravail'

type NextTechs = {
  technicien: string
  technicienUserId?: string
  technicienUserIds?: string[]
}

type Props = {
  technicien: string
  technicienUserId?: string
  technicienUserIds?: string[]
  onChange: (next: NextTechs) => void
  label?: string
  className?: string
  /** Plusieurs techs en même temps sur l’OT */
  multi?: boolean
  /** Agence de l’OT : on met ces techs en tête (on peut quand même en prendre un d’ailleurs) */
  highlightAgence?: string
}

export function TechnicienAssignField({
  technicien,
  technicienUserId,
  technicienUserIds,
  onChange,
  label = 'Technicien affecté *',
  className = '',
  multi = false,
  highlightAgence,
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

  const selectedIds = useMemo(() => {
    const ids = [...(technicienUserIds || [])]
    if (technicienUserId && !ids.includes(technicienUserId)) ids.unshift(technicienUserId)
    return ids.filter(Boolean)
  }, [technicienUserIds, technicienUserId])

  const agenceOf = (id: string) =>
    parseAgenceCode(dossierForUser(data.personnelDossiers, id)?.agenceCode)

  const grouped = useMemo(() => {
    const highlight = parseAgenceCode(highlightAgence)
    const local: typeof team = []
    const ailleurs: typeof team = []
    const bureau: typeof team = []
    const autres: typeof team = []
    for (const m of team) {
      const poste = dossierForUser(data.personnelDossiers, m.id)?.poste
      if (isPosteBureau(poste) || posteCouvreTouteLEquipe(poste) || m.role === 'owner') {
        bureau.push(m)
        continue
      }
      if (isPosteTerrain(poste)) {
        if (highlight && agenceOf(m.id) === highlight) local.push(m)
        else ailleurs.push(m)
        continue
      }
      autres.push(m)
    }
    return { local, ailleurs, bureau, autres, highlight }
  }, [team, data.personnelDossiers, highlightAgence])

  const emit = (ids: string[]) => {
    const noms: Record<string, string> = {}
    for (const m of team) {
      noms[m.id] = m.signataireNom?.trim() || m.fullName?.trim() || m.email || ''
    }
    onChange(syncTechsOt({ technicienUserIds: ids, noms, technicien }))
  }

  const optionFor = (m: (typeof team)[number]) => {
    const poste = dossierForUser(data.personnelDossiers, m.id)?.poste
    const ag = labelAgence(agenceOf(m.id))
    return (
      <option key={m.id} value={m.id}>
        {optionLabelAvecPoste({
          nom: m.fullName || m.email,
          poste,
          roleOwner: m.role === 'owner',
          inactif: m.active === false,
        })}
        {ag ? ` · ${ag}` : ''}
      </option>
    )
  }

  const checkFor = (m: (typeof team)[number]) => {
    const poste = dossierForUser(data.personnelDossiers, m.id)?.poste
    const ag = labelAgence(agenceOf(m.id))
    const on = selectedIds.includes(m.id)
    return (
      <label
        key={m.id}
        className={[
          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
          on ? 'bg-emerald-50' : '',
        ].join(' ')}
      >
        <input
          type="checkbox"
          checked={on}
          onChange={() => {
            emit(on ? selectedIds.filter((id) => id !== m.id) : [...selectedIds, m.id])
          }}
        />
        <span className="min-w-0">
          <span className="font-semibold text-ink">{m.fullName || m.email}</span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {optionLabelAvecPoste({
              nom: '',
              poste,
              roleOwner: m.role === 'owner',
            }).replace(/^ · /, '')}
            {ag ? ` · ${ag}` : ''}
          </span>
        </span>
      </label>
    )
  }

  if (multi) {
    return (
      <div className={`block text-sm ${className}`}>
        <span className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
          <Users className="h-3.5 w-3.5 text-accent" />
          {label}
        </span>
        <p className="mb-2 text-[11px] text-muted">
          Plusieurs techs en même temps. Un responsable peut envoyer un tech d’une autre
          région.
        </p>
        <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-line bg-white p-2">
          {grouped.local.length > 0 ? (
            <div>
              <p className="px-2 text-[10px] font-bold uppercase text-emerald-800">
                Agence {grouped.highlight}
              </p>
              {grouped.local.map(checkFor)}
            </div>
          ) : null}
          {grouped.ailleurs.length > 0 ? (
            <div>
              <p className="px-2 text-[10px] font-bold uppercase text-muted">
                Autre région (renfort)
              </p>
              {grouped.ailleurs.map(checkFor)}
            </div>
          ) : null}
          {grouped.autres.length > 0 ? (
            <div>
              <p className="px-2 text-[10px] font-bold uppercase text-muted">Poste à définir</p>
              {grouped.autres.map(checkFor)}
            </div>
          ) : null}
          {grouped.bureau.length > 0 ? (
            <div>
              <p className="px-2 text-[10px] font-bold uppercase text-muted">Bureau</p>
              {grouped.bureau.map(checkFor)}
            </div>
          ) : null}
        </div>
        {selectedIds.length > 0 ? (
          <p className="mt-1 text-[11px] text-muted">
            {selectedIds.length} tech{selectedIds.length > 1 ? 's' : ''} ·{' '}
            {technicien || 'noms à jour'}
          </p>
        ) : technicien.trim() ? (
          <p className="mt-1 text-[11px] text-muted">
            Nom libre : <strong>{technicien}</strong>
          </p>
        ) : null}
        {selectedIds[0] ? (
          <div className="mt-2">
            <DossierCloudTechButton
              techName={
                team.find((t) => t.id === selectedIds[0])?.fullName || technicien || 'Technicien'
              }
              lienCloudDossier={
                dossierForUser(data.personnelDossiers, selectedIds[0])?.lienCloudDossier
              }
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
            onChange({ technicien: '', technicienUserId: undefined, technicienUserIds: [] })
            return
          }
          emit([id])
        }}
        className="h-11 w-full rounded-xl border border-line bg-white px-3"
      >
        <option value="">— Choisir un technicien —</option>
        {grouped.local.length > 0 ? (
          <optgroup label={`Agence ${grouped.highlight}`}>{grouped.local.map(optionFor)}</optgroup>
        ) : null}
        {grouped.ailleurs.length > 0 ? (
          <optgroup label={grouped.highlight ? 'Autre région' : 'Terrain'}>
            {grouped.ailleurs.map(optionFor)}
          </optgroup>
        ) : null}
        {grouped.bureau.length > 0 ? (
          <optgroup label="Bureau / toute l’équipe">{grouped.bureau.map(optionFor)}</optgroup>
        ) : null}
        {grouped.autres.length > 0 ? (
          <optgroup label="Poste à définir">{grouped.autres.map(optionFor)}</optgroup>
        ) : null}
      </select>
      {!selectValue && technicien.trim() ? (
        <p className="mt-1 text-[11px] text-muted">
          Nom libre actuel : <strong className="font-semibold text-ink">{technicien}</strong>
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted">
          Un tech d’une autre région peut être envoyé en renfort.
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
