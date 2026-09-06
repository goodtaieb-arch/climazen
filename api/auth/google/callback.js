/**
 * Vercel Serverless — /api/auth/google/callback
 * Réponse OAuth2 Google Drive : échange du code et stockage du refresh_token.
 */

import { handleOauthCallback } from '../../../server/lib/cloudOauthCallback.js'

export default async function handler(req, res) {
  return handleOauthCallback('google', req, res)
}
