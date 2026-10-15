import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getPendingValidationManagers, getPendingValidationSynthesis, getPendingValidationSettings, sendPendingValidationDigests } from '@/lib/pending-validation-service'

export const dynamic = 'force-dynamic'
const CRON_SECRET = process.env.CRON_PENDING_VALIDATIONS_SECRET || process.env.CRON_SECRET || 'giras-rappel-quotidien-2024'
export const revalidate = 0

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const providedSecret = authHeader?.replace('Bearer ', '') || searchParams.get('secret')
    const isTestMode = ['true', '1', 'yes'].includes(String(searchParams.get('test') || '').toLowerCase())
    const isForceMode = ['true', '1', 'yes'].includes(String(searchParams.get('force') || '').toLowerCase())
    const requestedEmails = String(searchParams.get('emails') || '')
      .split(/[;,]/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    if (providedSecret !== CRON_SECRET) return NextResponse.json({ error: 'Non autorisé' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    const now = new Date()
    const hours = now.getUTCHours()
    const minutes = now.getUTCMinutes()
    const isScheduledWindow = hours === 8 && minutes >= 30 && minutes < 40

    const supabase = createAdminClient(request)

    if (!isTestMode && !isForceMode && !isScheduledWindow) {
      return NextResponse.json({
        success: false,
        blocked: true,
        reason: 'outside_schedule',
        message: "Les mails 'Validations et confirmations en attente' ne sont envoyés automatiquement qu'à 08h30.",
        now_utc: now.toISOString()
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }

    if (!isTestMode && !isForceMode) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString()
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString()
      const { data: existingLogs, error: logError } = await supabase
        .from('email_logs')
        .select('id, created_at')
        .eq('source', 'cron_pending_validations_daily')
        .gte('created_at', start)
        .lt('created_at', end)
        .limit(1)
      if (logError) throw logError
      if ((existingLogs || []).length > 0) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'already_sent_today',
          message: "Les mails de validations en attente ont déjà été envoyés aujourd'hui.",
          sent_at: existingLogs[0]?.created_at || null
        }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
      }
    }
    const { dataset } = await getPendingValidationSynthesis(supabase)
    const settings = await getPendingValidationSettings(supabase)
    let users = getPendingValidationManagers(dataset)
    if (requestedEmails.length) {
      const emailSet = new Set(requestedEmails)
      users = users.filter((row) => emailSet.has(String(row?.email || row?.username || '').trim().toLowerCase()))
    }
    if (!users.length) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: requestedEmails.length ? 'no_matching_targets' : 'no_targets',
        message: requestedEmails.length ? 'Aucune adresse ciblée ne correspond à un gestionnaire à notifier.' : 'Aucun gestionnaire à notifier.'
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }
    const results = await sendPendingValidationDigests({
      users,
      dataset,
      settings,
      supabase,
      typeEmail: 'validation_pending_digest_daily',
      source: 'cron_pending_validations_daily',
      mode: isTestMode ? 'test' : 'daily'
    })
    return NextResponse.json({
      success: true,
      summary: {
        total_users: users.length,
        emails_sent: results.filter((r) => r.status === 'sent').length,
        users_skipped: results.filter((r) => r.status === 'skipped').length,
        emails_failed: results.filter((r) => r.status === 'failed').length
      },
      results,
      testMode: isTestMode,
      generatedAt: new Date().toISOString()
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[cron pending-validations daily]', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
