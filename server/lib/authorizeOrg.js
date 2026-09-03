/**
 * Autorisation multi-société — aucune action IA sans org_id vérifié côté serveur.
 */

import { verifySupabaseUser, userOrgProfile } from './supabaseServer.js'

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} [orgIdFromClient] — orgId envoyé par le client (jamais fait confiance seul)
 */
export async function authorizeOrgRequest(req, orgIdFromClient) {
  const user = await verifySupabaseUser(req)
  if (!user?.id) {
    return { ok: false, status: 401, error: 'Session requise.', code: 'unauthorized' }
  }

  const profile = await userOrgProfile(user.id)
  if (!profile?.organization_id) {
    return { ok: false, status: 403, error: 'Profil société introuvable.', code: 'no_org' }
  }

  const requested = String(orgIdFromClient || profile.organization_id).trim()
  if (requested !== profile.organization_id) {
    return {
      ok: false,
      status: 403,
      error: 'Accès refusé — données d’une autre société.',
      code: 'org_mismatch',
    }
  }

  return {
    ok: true,
    user,
    profile,
    orgId: requested,
    isOwner: profile.role === 'owner',
  }
}
