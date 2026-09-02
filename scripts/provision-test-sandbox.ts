#!/usr/bin/env npx tsx
/**
 * Crée / réinitialise le compte sandbox ClimaZEN (gérant + 10 opérateurs Auth + org_data).
 *
 *   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/provision-test-sandbox.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { seedSandboxData } from '../src/lib/seedSandboxData'
import {
  SANDBOX_OPERATORS,
  SANDBOX_TEST_COMPANY,
  SANDBOX_TEST_EMAIL,
  SANDBOX_TEST_FULL_NAME,
  SANDBOX_TEST_PASSWORD,
  type SandboxOperatorDef,
} from '../src/lib/sandboxAccount'

async function findUserByEmail(sb: SupabaseClient, email: string) {
  const target = email.toLowerCase()
  let page = 1
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) return null
    page += 1
  }
}

async function ensureOperatorProfile(
  sb: SupabaseClient,
  userId: string,
  orgId: string,
  op: SandboxOperatorDef,
) {
  const { data: prof, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (prof) {
    if (prof.organization_id !== orgId) {
      throw new Error(`${op.email} appartient à une autre organisation (${prof.organization_id})`)
    }
    return
  }
  const { error: insErr } = await sb.from('profiles').insert({
    id: userId,
    email: op.email.toLowerCase(),
    full_name: op.fullName,
    organization_id: orgId,
    role: 'operateur',
    active: true,
    signataire_nom: op.fullName,
    signataire_qualite: 'Opérateur attesté',
  })
  if (insErr) throw insErr
}

async function ensureOperator(
  sb: SupabaseClient,
  orgId: string,
  ownerUserId: string,
  op: SandboxOperatorDef,
): Promise<string> {
  const email = op.email.toLowerCase()
  const existing = await findUserByEmail(sb, email)

  if (existing) {
    const { error } = await sb.auth.admin.updateUserById(existing.id, {
      password: op.password,
      email_confirm: true,
      user_metadata: { full_name: op.fullName, role: 'operateur' },
    })
    if (error) throw error
    await ensureOperatorProfile(sb, existing.id, orgId, op)
    console.log('  Opérateur existant :', email)
    return existing.id
  }

  const { data: invite, error: inviteErr } = await sb
    .from('operator_invites')
    .insert({
      organization_id: orgId,
      email,
      full_name: op.fullName,
      created_by: ownerUserId,
    })
    .select('id')
    .single()
  if (inviteErr) throw inviteErr

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: op.password,
    email_confirm: true,
    user_metadata: {
      role: 'operateur',
      invite_id: invite.id,
      full_name: op.fullName,
    },
  })
  if (createErr) throw createErr

  await new Promise((r) => setTimeout(r, 500))
  await ensureOperatorProfile(sb, created.user.id, orgId, op)
  console.log('  Opérateur créé :', email)
  return created.user.id
}

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
  const existingOwner = await findUserByEmail(sb, SANDBOX_TEST_EMAIL)
  if (existingOwner) {
    userId = existingOwner.id
    console.log('Gérant existant :', SANDBOX_TEST_EMAIL)
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
    console.log('Gérant créé :', SANDBOX_TEST_EMAIL)
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

  console.log('\nOpérateurs sandbox (10 comptes connectables) :')
  const operatorUserIds: string[] = []
  for (const op of SANDBOX_OPERATORS) {
    const id = await ensureOperator(sb, orgId, userId, op)
    operatorUserIds.push(id)
  }

  const payload = seedSandboxData({ ownerUserId: userId, operatorUserIds })
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

  console.log('\n✅ Sandbox prêt (gérant + 10 opérateurs)')
  console.log('   https://climazen.fr/login')
  console.log('\n--- Gérant (owner) ---')
  console.log('   E-mail       :', SANDBOX_TEST_EMAIL)
  console.log('   Mot de passe :', SANDBOX_TEST_PASSWORD)
  console.log('\n--- Opérateurs (mot de passe commun) ---')
  console.log('   Mot de passe :', SANDBOX_OPERATORS[0].password)
  for (const op of SANDBOX_OPERATORS) {
    console.log(`   ${op.roleLabel.padEnd(16)} ${op.email}`)
  }
  console.log('\n   Sites :', payload.chantiers.length)
  console.log('   Équipe (dossiers RH) :', payload.personnelDossiers?.length || 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
