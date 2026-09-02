#!/usr/bin/env npx tsx
/**
 * Crée / réinitialise le compte sandbox ClimaZEN (Supabase Auth + org_data).
 *
 *   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/provision-test-sandbox.ts
 */

import { createClient } from '@supabase/supabase-js'
import { seedSandboxData } from '../src/lib/seedSandboxData'
import {
  SANDBOX_TEST_COMPANY,
  SANDBOX_TEST_EMAIL,
  SANDBOX_TEST_FULL_NAME,
  SANDBOX_TEST_PASSWORD,
} from '../src/lib/sandboxAccount'

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Variables requises : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const sb = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let userId: string
  const { data: listData, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw listErr
  const existing = listData.users.find((u) => u.email?.toLowerCase() === SANDBOX_TEST_EMAIL)
  if (existing) {
    userId = existing.id
    console.log('Utilisateur existant :', SANDBOX_TEST_EMAIL)
    const { error } = await sb.auth.admin.updateUserById(userId, {
      password: SANDBOX_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: SANDBOX_TEST_FULL_NAME, company_name: SANDBOX_TEST_COMPANY },
    })
    if (error) throw error
  } else {
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: SANDBOX_TEST_EMAIL,
      password: SANDBOX_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: SANDBOX_TEST_FULL_NAME,
        company_name: SANDBOX_TEST_COMPANY,
      },
    })
    if (createErr) throw createErr
    userId = created.user.id
    console.log('Utilisateur créé :', SANDBOX_TEST_EMAIL)
  }

  await new Promise((r) => setTimeout(r, 2000))

  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()
  if (profErr) throw profErr
  if (!profile?.organization_id) {
    throw new Error('Profil / organisation introuvable — exécutez supabase/fix-auth-trigger.sql')
  }

  const orgId = profile.organization_id
  const payload = seedSandboxData(userId)
  payload.appEdition = 'pro'

  const { error: orgErr } = await sb.from('org_data').upsert({
    organization_id: orgId,
    payload,
    updated_at: new Date().toISOString(),
  })
  if (orgErr) throw orgErr

  await sb.from('organizations').update({ name: SANDBOX_TEST_COMPANY }).eq('id', orgId)

  for (const site of payload.chantiers.filter((s) => s.portailToken)) {
    const { error } = await sb.from('site_portals').upsert(
      {
        token: site.portailToken!,
        organization_id: orgId,
        site_id: site.id,
        site_nom: site.nom,
        client_nom: payload.clients.find((c) => c.id === site.clientId)?.raisonSociale || '',
        actif: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    )
    if (error) console.warn('site_portals (table absente ?)', error.message)
  }

  console.log('\n✅ Sandbox prêt')
  console.log('   https://climazen.fr/login')
  console.log('   E-mail   :', SANDBOX_TEST_EMAIL)
  console.log('   Mot de passe :', SANDBOX_TEST_PASSWORD)
  console.log('   Sites    :', payload.chantiers.length)
  console.log('   Équipe   :', payload.personnelDossiers?.length || 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
