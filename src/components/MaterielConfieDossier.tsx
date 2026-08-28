import { Car, Download, Mail, Phone, Wrench } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useStore } from '../lib/store'
import {
  grouperMaterielParFamille,
  materielConfiePourUser,
} from '../lib/attributionMateriel'
import { dossierForUser } from '../lib/rhDocuments'
import { formatDateFrCourt, voitureDocumentLabel } from '../lib/voitures'
import { ReceptionMaterielBlock } from './ReceptionMaterielBlock'

type Props = {
  userId: string
  displayName: string
  email?: string
}

export function MaterielConfieDossier({ userId, displayName, email }: Props) {
  const { data, telechargerBonRemise } = useStore()
  const { user, isOwner } = useAuth()
  const dossier = dossierForUser(data.personnelDossiers, userId)
  const lignes = materielConfiePourUser(data, userId)
  const groupes = grouperMaterielParFamille(lignes)
  const voitures = (data.voitures || []).filter((v) => v.assigneeUserId === userId)
  const bons = (data.bonsRemiseMateriel || [])
    .filter((b) => b.userId === userId)
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const canDownload = Boolean(isOwner || user?.id === userId)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-4">
        <h2 className="font-display text-lg font-semibold text-ink">Matériel confié</h2>
        <p className="mt-1 text-sm text-muted">
          Tout ce que la société a attribué à {displayName} : véhicule, téléphone, outillage. La
          réception est validée par l’opérateur (PDF chez le gérant).
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {email ? (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted" />
              {email}
            </span>
          ) : null}
          {dossier?.telephone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted" />
              {dossier.telephone}
            </span>
          ) : (
            <span className="text-xs text-muted">Téléphone RH non renseigné</span>
          )}
        </div>

        {groupes.length === 0 ? (
          <p className="mt-4 rounded-xl bg-mist px-3 py-2 text-sm text-muted">
            Aucun véhicule ni outillage attribué pour le moment.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {groupes.map((g) => (
              <section key={g.famille} className="rounded-xl border border-line">
                <header className="flex items-center gap-2 border-b border-line bg-mist/60 px-3 py-2">
                  {g.famille === 'Véhicule' ? (
                    <Car className="h-4 w-4 text-accent" />
                  ) : (
                    <Wrench className="h-4 w-4 text-accent" />
                  )}
                  <span className="text-sm font-semibold">{g.famille}</span>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {g.items.length}
                  </span>
                </header>
                <ul className="divide-y divide-line">
                  {g.items.map((it) => {
                    const voiture = it.kind === 'voiture' ? voitures.find((v) => v.id === it.itemId) : undefined
                    const outil = it.kind === 'outillage'
                      ? (data.outillages || []).find((o) => o.id === it.itemId)
                      : undefined
                    const recu = Boolean(voiture?.receptionAt || outil?.receptionAt)
                    return (
                      <li key={`${it.kind}-${it.itemId}`} className="px-3 py-2.5 text-sm">
                        <div className="font-medium">{it.label}</div>
                        {voiture?.documentsFournis?.length ? (
                          <div className="mt-1 text-xs text-muted">
                            Documents prévus :{' '}
                            {voiture.documentsFournis.map(voitureDocumentLabel).join(', ')}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs">
                          {recu ? (
                            <span className="font-semibold text-emerald-800">
                              Réceptionné le {formatDateFrCourt(voiture?.receptionAt || outil?.receptionAt)}
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-800">En attente de réception</span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <ReceptionMaterielBlock userId={userId} />

      {bons.length > 0 && canDownload ? (
        <div className="rounded-2xl border border-line bg-white p-4">
          <h3 className="font-display text-sm font-semibold">PDF officiels (gérant)</h3>
          <p className="mt-1 text-xs text-muted">
            Bons de remise et états des lieux générés à la validation. Conservez-les avec le
            dossier.
          </p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {bons.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <div className="font-medium">
                    {b.kind === 'vehicule' ? 'État des lieux véhicule' : 'Bon de remise matériel'}
                  </div>
                  <div className="text-xs text-muted">
                    {formatDateFrCourt(b.createdAt)}
                    {b.kind === 'vehicule'
                      ? ` · ${b.items[0]?.label || 'véhicule'}`
                      : ` · ${b.items.length} pièce${b.items.length > 1 ? 's' : ''}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void telechargerBonRemise(b.id)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-mist"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
