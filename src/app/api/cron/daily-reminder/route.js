import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { loadReminderDataset, sendDailyReminders } from '@/lib/daily-reminder-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const CRON_SECRET = process.env.CRON_SECRET || 'giras-cron-secret-2024'
const EXECUTION_LOCK_TTL_MINUTES = 15

function parseCsvParam(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function filterUsersForTest(users, searchParams) {
  const usernames = new Set(parseCsvParam(searchParams.get('users')))
  const emails = new Set(parseCsvParam(searchParams.get('emails')))
  if (!usernames.size && !emails.size) return users || []

  return (users || []).filter((user) => {
    const username = String(user?.username || '').trim().toLowerCase()
    const email = String(user?.email || user?.username || '').trim().toLowerCase()
    return usernames.has(username) || emails.has(email)
  })
}

function getTodayDateString() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

function getStartAndEndOfDay(today) {
  return {
    startOfDay: `${today}T00:00:00.000Z`,
    endOfDay: `${today}T23:59:59.999Z`
  }
}

async function hasCompletedProductionRunToday(supabase) {
  const today = getTodayDateString()
  const { startOfDay, endOfDay } = getStartAndEndOfDay(today)

  try {
    const { data, error } = await supabase
      .from('email_logs')
      .select('id, created_at, details')
      .eq('source', 'cron_quotidien')
      .eq('type_email', 'cron_daily_batch')
      .in('statut', ['terminé', 'terminé_avec_erreurs'])
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) {
      console.error('[CRON] Erreur vérification batch quotidien:', error)
      return { alreadySent: false, error: error.message }
    }

    if (data && data.length > 0) {
      return {
        alreadySent: true,
        firstEmailAt: data[0].created_at,
        batchDetails: data[0].details || null
      }
    }

    return { alreadySent: false }
  } catch (err) {
    console.error('[CRON] Exception vérification batch quotidien:', err)
    return { alreadySent: false, error: err.message }
  }
}

async function acquireExecutionLock(supabase, instanceId) {
  const today = getTodayDateString()
  const ttlCutoff = new Date(Date.now() - EXECUTION_LOCK_TTL_MINUTES * 60 * 1000).toISOString()

  try {
    const { data: existingLocks, error: checkError } = await supabase
      .from('email_logs')
      .select('id, created_at, details')
      .eq('source', 'cron_quotidien')
      .eq('type_email', 'system_lock')
      .eq('statut', 'verrouillé')
      .gte('created_at', ttlCutoff)
      .order('created_at', { ascending: false })
      .limit(1)

    if (checkError) {
      console.error('[CRON] Erreur vérification verrou:', checkError)
    }

    const activeLock = (existingLocks || [])[0]
    if (activeLock) {
      return {
        acquired: false,
        reason: 'lock_exists',
        existingLockAt: activeLock.created_at,
        existingLockId: activeLock.id
      }
    }

    const { data, error } = await supabase
      .from('email_logs')
      .insert({
        destinataire: 'SYSTEM_LOCK',
        destinataire_nom: `cron_daily_lock_${today}_${instanceId}`,
        sujet: `Verrou CRON quotidien ${today}`,
        type_email: 'system_lock',
        statut: 'verrouillé',
        source: 'cron_quotidien',
        details: {
          lock_acquired_at: new Date().toISOString(),
          date: today,
          instance: instanceId,
          ttl_minutes: EXECUTION_LOCK_TTL_MINUTES
        }
      })
      .select('id')
      .single()

    if (error) {
      console.error('[CRON] Erreur acquisition verrou:', error)
      return { acquired: false, reason: 'lock_insert_failed', error: error.message }
    }

    return { acquired: true, lockId: data?.id || null }
  } catch (err) {
    console.error('[CRON] Exception acquisition verrou:', err)
    return { acquired: false, reason: 'lock_exception', error: err.message }
  }
}

async function releaseExecutionLock(supabase, lockId, status, extraDetails = {}) {
  if (!lockId) return

  try {
    await supabase
      .from('email_logs')
      .update({
        statut: status,
        details: {
          ...extraDetails,
          released_at: new Date().toISOString()
        }
      })
      .eq('id', lockId)
  } catch (err) {
    console.error('[CRON] Impossible de libérer le verrou:', err)
  }
}

async function writeBatchLog(supabase, payload) {
  try {
    await supabase.from('email_logs').insert(payload)
  } catch (err) {
    console.error('[CRON] Impossible d\'écrire le batch log:', err)
  }
}

export async function GET(request) {
  const startTime = Date.now()
  const instanceId = Math.random().toString(36).substring(7)
  let lockId = null
  let supabase = null

  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    const testMode = searchParams.get('test') === 'true'
    const force = searchParams.get('force') === 'true' || testMode
    const providedSecret = authHeader?.replace('Bearer ', '') || secretParam

    if (providedSecret !== CRON_SECRET) {
      console.log('[CRON] Tentative non autorisée')
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    supabase = createAdminClient(request)
    const today = getTodayDateString()

    console.log(`[CRON][${instanceId}] Début vérification pour ${today}`)

    if (!force) {
      const checkResult = await hasCompletedProductionRunToday(supabase)
      if (checkResult.alreadySent) {
        console.log(`[CRON][${instanceId}] Batch quotidien déjà finalisé aujourd'hui (${today}) à ${checkResult.firstEmailAt}`)
        return NextResponse.json({
          success: false,
          blocked: true,
          reason: 'already_sent_today',
          message: `Les rappels quotidiens ont déjà été envoyés aujourd'hui (${today}).`,
          first_email_at: checkResult.firstEmailAt,
          date: today,
          instance: instanceId
        }, { status: 429 })
      }

      const lockResult = await acquireExecutionLock(supabase, instanceId)
      if (!lockResult.acquired) {
        console.log(`[CRON][${instanceId}] Exécution bloquée - verrou actif`) 
        return NextResponse.json({
          success: false,
          blocked: true,
          reason: 'lock_acquired_by_another_process',
          message: `Une autre exécution du rappel quotidien est déjà en cours.`,
          date: today,
          existing_lock_at: lockResult.existingLockAt,
          instance: instanceId
        }, { status: 429 })
      }

      lockId = lockResult.lockId || null
      console.log(`[CRON][${instanceId}] Verrou acquis, démarrage des rappels quotidiens à ${new Date().toISOString()}`)
    } else {
      console.log(`[CRON][${instanceId}] Mode force/test activé: aucun blocage global de journée.`)
    }

    const reminderDataset = await loadReminderDataset(supabase)
    const targetedUsers = filterUsersForTest(reminderDataset.users, searchParams)

    if (testMode && (searchParams.get('users') || searchParams.get('emails')) && !targetedUsers.length) {
      if (lockId) {
        await releaseExecutionLock(supabase, lockId, 'libéré', { result: 'no_matching_test_user', instance: instanceId })
      }
      return NextResponse.json({
        success: false,
        error: 'Aucun utilisateur de test correspondant aux paramètres users/emails.'
      }, { status: 400 })
    }

    const usersToProcess = testMode ? targetedUsers : (reminderDataset.users || [])
    const results = await sendDailyReminders({
      users: usersToProcess,
      dataset: reminderDataset,
      supabase,
      typeEmail: 'rappel_quotidien',
      source: 'cron_quotidien',
      runMode: testMode ? 'test' : 'production'
    })

    let emailsSent = 0
    let emailsFailed = 0
    let usersSkipped = 0

    for (const entry of results) {
      if (entry.status === 'sent') {
        emailsSent++
        console.log(`[CRON] Email envoyé à ${entry.user} (${entry.totalActions} actions, ${entry.totalIndicateurs} indicateurs)`)
      } else if (entry.status === 'failed') {
        emailsFailed++
        console.error(`[CRON] Erreur envoi à ${entry.user}:`, entry.error)
      } else if (entry.status === 'skipped') {
        usersSkipped++
      }
    }

    const executionTime = Date.now() - startTime
    const summary = {
      total_users: usersToProcess.length || 0,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
      users_skipped: usersSkipped
    }

    if (!testMode) {
      await writeBatchLog(supabase, {
        destinataire: 'SYSTEM_BATCH',
        destinataire_nom: `cron_daily_batch_${today}`,
        sujet: `Batch CRON quotidien ${today}`,
        type_email: 'cron_daily_batch',
        statut: emailsFailed > 0 ? 'terminé_avec_erreurs' : 'terminé',
        source: 'cron_quotidien',
        nb_actions: 0,
        nb_indicateurs: 0,
        details: {
          mode: 'production',
          date: today,
          instance: instanceId,
          summary,
          execution_time_ms: executionTime
        }
      })
    }

    if (lockId) {
      await releaseExecutionLock(supabase, lockId, 'libéré', {
        result: 'completed',
        mode: testMode ? 'test' : 'production',
        summary,
        instance: instanceId
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: today,
      execution_time_ms: executionTime,
      mode: testMode ? 'test' : 'production',
      summary,
      results
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    })
  } catch (error) {
    console.error('[CRON] Erreur:', error)

    if (supabase && lockId) {
      await releaseExecutionLock(supabase, lockId, 'erreur', {
        result: 'failed',
        error: error?.message || 'Erreur inconnue',
        instance: instanceId
      })
    }

    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
