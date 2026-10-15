import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getPendingValidationManagers, getPendingValidationSynthesis, getPendingValidationSettings, sendPendingValidationDigests } from '@/lib/pending-validation-service'

export const dynamic = 'force-dynamic'
const CRON_SECRET = process.env.CRON_SECRET || 'giras-cron-secret-2024'

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const providedSecret = authHeader?.replace('Bearer ', '') || searchParams.get('secret')
    if (providedSecret !== CRON_SECRET) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const supabase = createAdminClient(request)
    const { dataset } = await getPendingValidationSynthesis(supabase)
    const settings = await getPendingValidationSettings(supabase)
    const users = getPendingValidationManagers(dataset)
    const results = await sendPendingValidationDigests({
      users,
      dataset,
      settings,
      supabase,
      typeEmail: 'validation_pending_digest_weekly',
      source: 'cron_validation_pending_weekly',
      mode: 'weekly'
    })
    return NextResponse.json({
      success: true,
      summary: {
        total_users: users.length,
        emails_sent: results.filter((r) => r.status === 'sent').length,
        users_skipped: results.filter((r) => r.status === 'skipped').length,
        emails_failed: results.filter((r) => r.status === 'failed').length
      },
      results
    })
  } catch (error) {
    console.error('[cron pending-validations weekly]', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
