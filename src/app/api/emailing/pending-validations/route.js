export const dynamic = 'force-dynamic'
export const revalidate = 0
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdministrationAccess } from '@/lib/auth'
import { canAccessAdminSection } from '@/lib/roles'
import { getPendingValidationManagers, getPendingValidationSynthesis, sendPendingValidationDigests, getPendingValidationSettings } from '@/lib/pending-validation-service'

export async function GET(request) {
  try {
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard
    if (!canAccessAdminSection(guard, 'emailing')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const supabase = createAdminClient(request)
    const { synthesis, settings } = await getPendingValidationSynthesis(supabase)
    return NextResponse.json({ synthesis, settings, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[pending-validations][GET]', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request) {
  try {
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard
    if (!canAccessAdminSection(guard, 'emailing')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await request.json()
    const { targetUser, targetUsers, sendToAll, createur, mode = 'manual' } = body || {}
    const supabase = createAdminClient(request)
    const { dataset } = await getPendingValidationSynthesis(supabase)
    const settings = await getPendingValidationSettings(supabase)
    const managers = getPendingValidationManagers(dataset)

    let usersToNotify = []
    if (sendToAll) {
      usersToNotify = managers
    } else if (Array.isArray(targetUsers) && targetUsers.length) {
      const targets = new Set(targetUsers.map(String))
      usersToNotify = managers.filter((row) => targets.has(row.username))
    } else if (targetUser) {
      usersToNotify = managers.filter((row) => row.username === targetUser)
    }

    if (!usersToNotify.length) return NextResponse.json({ error: 'Aucun gestionnaire trouvé' }, { status: 400 })

    const results = await sendPendingValidationDigests({
      users: usersToNotify,
      dataset,
      settings,
      supabase,
      typeEmail: 'validation_pending_digest_manual',
      source: 'manuel_validation_pending',
      mode,
      createur: createur || guard?.username || null
    })

    return NextResponse.json({
      success: true,
      message: `${results.filter((r) => r.status === 'sent').length} email(s) envoyé(s)`,
      summary: {
        total: usersToNotify.length,
        sent: results.filter((r) => r.status === 'sent').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        failed: results.filter((r) => r.status === 'failed').length
      },
      results
    })
  } catch (error) {
    console.error('[pending-validations][POST]', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
