/**
 * Vercel Serverless — /api/auth/microsoft/callback
 * Réponse OAuth2 Microsoft Entra ID : échange du code et stockage du refresh_token.
 */

import { handleOauthCallback } from '../../../server/lib/cloudOauthCallback.js'

export default async function handler(req, res) {
  return handleOauthCallback('microsoft', req, res)
}
