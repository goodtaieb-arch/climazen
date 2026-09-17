/**
 * Journal d'audit — actions métier clés (statuts, décisions, signatures…),
 * pas chaque frappe clavier. Table Supabase séparée et immuable : survit même
 * si org_data est perdu/corrompu. Voir supabase/audit-log.sql.
 *
 * Toujours best-effort : une erreur d'écriture du journal ne doit jamais
 * bloquer l'action métier elle-même.
 */

import { getSupabase, isSupabaseConfigured } from './supabase'

/** Codes stables — étendre ici plutôt que d'inventer du texte libre par écran. */
export type AuditAction =
  | 'ot.statut'
  | 'ot.cree'
  | 'absence.decision'
  | 'absence.soumise'
  | 'devis.cree'
  | 'devis.statut'
  | 'commande.statut'
  | 'fiche.signee'
  | 'client.cree'

export type AuditEntityType =
  | 'ordre_travail'
  | 'demande_absence'
  | 'devis'
  | 'commande'
  | 'fiche_maintenance_clim'
  | 'fiche_maintenance_chaufferie'
  | 'fiche_maintenance_cta_vmc'
  | 'client'

export function logAudit(opts: {
  organizationId?: string | null
  actorUserId?: string
  actorName?: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  summary: string
  metadata?: Record<string, unknown>
}): void {
  if (!isSupabaseConfigured() || !opts.organizationId) return
  try {
    const sb = getSupabase()
    void sb
      .from('audit_log')
      .insert({
        organization_id: opts.organizationId,
        actor_user_id: opts.actorUserId || null,
        actor_name: opts.actorName || null,
        action: opts.action,
        entity_type: opts.entityType,
        entity_id: opts.entityId,
        summary: opts.summary.slice(0, 500),
        metadata: opts.metadata || null,
      })
      .then(({ error }) => {
        if (error) console.warn('audit_log insert', error.message)
      })
  } catch (err) {
    console.warn('audit_log insert', err instanceof Error ? err.message : err)
  }
}
