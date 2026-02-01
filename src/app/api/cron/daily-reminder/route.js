import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getReminderEmailTemplate } from '@/lib/email'
import { buildPendingForUser } from '@/lib/reminder-data'

// Forcer le rendu dynamique (nécessaire pour accéder à request.headers)
export const dynamic = 'force-dynamic'

// Clé secrète pour sécuriser l'endpoint CRON
const CRON_SECRET = process.env.CRON_SECRET || 'giras-cron-secret-2024'

// La logique de sélection (actions/indicateurs) est centralisée dans src/lib/reminder-data.js

// Obtenir la date du jour au format YYYY-MM-DD
function getTodayDateString() {
  const now = new Date()
  return now.toISOString().split('T')[0] // Format: 2026-01-10
}

// Vérifier si les rappels ont déjà été envoyés aujourd'hui
async function hasAlreadySentToday(supabase) {
  const today = getTodayDateString()
  const startOfDay = `${today}T00:00:00.000Z`
  const endOfDay = `${today}T23:59:59.999Z`
  
  try {
    // Chercher un email de rappel quotidien (pas un verrou) envoyé avec succès aujourd'hui
    const { data, error } = await supabase
      .from('email_logs')
      .select('id, created_at, destinataire')
      .eq('source', 'cron_quotidien')
      .eq('statut', 'envoyé')
      .neq('type_email', 'system_lock')  // Exclure les verrous
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .limit(1)
    
    if (error) {
      console.error('[CRON] Erreur vérification doublon:', error)
      return { alreadySent: false, error: error.message }
    }
    
    if (data && data.length > 0) {
      return { 
        alreadySent: true, 
        firstEmailAt: data[0].created_at,
        firstRecipient: data[0].destinataire
      }
    }
    
    return { alreadySent: false }
  } catch (err) {
    console.error('[CRON] Exception vérification doublon:', err)
    return { alreadySent: false, error: err.message }
  }
}

// Créer un verrou pour éviter les exécutions simultanées
async function acquireLock(supabase) {
  const today = getTodayDateString()
  const lockKey = `cron_daily_lock_${today}`
  
  try {
    // D'abord vérifier si un verrou existe déjà pour aujourd'hui
    const { data: existingLock, error: checkError } = await supabase
      .from('email_logs')
      .select('id, created_at')
      .eq('destinataire_nom', lockKey)
      .eq('type_email', 'system_lock')
      .single()
    
    if (existingLock) {
      console.log(`[CRON] Verrou existant trouvé pour ${today}, créé à ${existingLock.created_at}`)
      return { acquired: false, reason: 'lock_exists', existingLockAt: existingLock.created_at }
    }
    
    // Essayer d'insérer un enregistrement de verrou unique pour aujourd'hui
    const { data, error } = await supabase
      .from('email_logs')
      .insert({
        destinataire: 'SYSTEM_LOCK',
        destinataire_nom: lockKey,
        sujet: `Verrou CRON quotidien ${today}`,
        type_email: 'system_lock',
        statut: 'verrouillé',
        source: 'cron_quotidien',
        details: { lock_acquired_at: new Date().toISOString(), date: today }
      })
      .select()
    
    if (error) {
      // Vérifier si c'est une erreur de doublon (verrou déjà pris)
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        console.log('[CRON] Verrou déjà pris pour aujourd\'hui')
        return { acquired: false, reason: 'lock_exists' }
      }
      console.error('[CRON] Erreur acquisition verrou:', error)
      // En cas d'erreur autre, on laisse passer mais on log
      return { acquired: true, warning: error.message }
    }
    
    console.log('[CRON] Verrou acquis avec succès')
    return { acquired: true, lockId: data?.[0]?.id }
  } catch (err) {
    console.error('[CRON] Exception acquisition verrou:', err)
    return { acquired: true, warning: err.message }
  }
}

// GET - Endpoint CRON pour envoyer les rappels quotidiens à 8h00
export async function GET(request) {
  const startTime = Date.now()
  const instanceId = Math.random().toString(36).substring(7) // ID unique pour cette instance
  
  try {
    // Vérifier l'autorisation
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    // Mode test: permet d'envoyer à nouveau dans la journée (uniquement si secret valide)
    const force = searchParams.get('force') === 'true'
    const providedSecret = authHeader?.replace('Bearer ', '') || secretParam
    
    if (providedSecret !== CRON_SECRET) {
      console.log('[CRON] Tentative non autorisée')
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const today = getTodayDateString()
    
    console.log(`[CRON][${instanceId}] Début vérification pour ${today}`)

    // ÉTAPE 1: Vérifier si les emails ont déjà été envoyés aujourd'hui (sauf si force=true)
    if (!force) {
      const checkResult = await hasAlreadySentToday(supabase)
      if (checkResult.alreadySent) {
        console.log(`[CRON][${instanceId}] Emails déjà envoyés aujourd'hui (${today}) - Premier envoi à ${checkResult.firstEmailAt}`)
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

      // ÉTAPE 2: Essayer d'acquérir un verrou pour éviter les exécutions simultanées
      const lockResult = await acquireLock(supabase)
      if (!lockResult.acquired) {
        console.log(`[CRON][${instanceId}] Exécution bloquée - verrou déjà pris pour ${today}`)
        return NextResponse.json({
          success: false,
          blocked: true,
          reason: 'lock_acquired_by_another_process',
          message: `Une autre exécution est déjà en cours ou a été effectuée aujourd'hui (${today}).`,
          date: today,
          existing_lock_at: lockResult.existingLockAt,
          instance: instanceId
        }, { status: 429 })
      }

      console.log(`[CRON][${instanceId}] Verrou acquis, démarrage des rappels quotidiens à`, new Date().toISOString())
    } else {
      console.log(`[CRON][${instanceId}] Mode force=true activé: envoi autorisé même si déjà envoyé aujourd'hui. (A utiliser uniquement pour tests)`)
    }
    
    // Récupérer tous les utilisateurs actifs
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('statut', 'Actif')
    
    if (usersError) throw usersError

    // Récupérer les actions et occurrences
    const { data: actions } = await supabase
      .from('actions')
      .select('*')
      .eq('statut_act', 'Actif')

    const { data: actionOccurrences } = await supabase
      .from('action_occurrences')
      .select('*')
      .neq('statut', 'Achevé')

    // Récupérer les indicateurs et leurs occurrences
    const { data: indicateurs } = await supabase
      .from('indicateurs')
      .select('*')
      .eq('statut', 'Actif')

    const { data: indicateurOccurrences } = await supabase
      .from('indicateur_occurrences')
      .select('*')

    // Récupérer les groupes d'indicateurs pour afficher les codes
    const { data: groupesIndicateurs } = await supabase
      .from('groupe_indicateurs')
      .select('*')

    // Statistiques
    let emailsSent = 0
    let emailsFailed = 0
    let usersSkipped = 0
    const results = []
    
    // Date du jour pour les calculs
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const todayStr = todayDate.toISOString().split('T')[0]
    
    // Limite pour les actions à débuter : 30 jours dans le futur
    const actionFutureLimit = new Date(todayDate)
    actionFutureLimit.setDate(actionFutureLimit.getDate() + 30)
    const actionFutureLimitStr = actionFutureLimit.toISOString().split('T')[0]
    
    // Limite pour les indicateurs à renseigner : 10 jours dans le futur
    const indicateurFutureLimit = new Date(todayDate)
    indicateurFutureLimit.setDate(indicateurFutureLimit.getDate() + 10)
    const indicateurFutureLimitStr = indicateurFutureLimit.toISOString().split('T')[0]

    for (const user of users || []) {
      const username = user.username

      // Construire le contenu de manière centralisée (identique à l'envoi manuel)
      const { pendingActions, pendingIndicators, totalActions, totalIndicateurs } = buildPendingForUser(
        user,
        { actions, actionOccurrences, indicateurs, indicateurOccurrences, groupesIndicateurs },
        { actionFutureLimitStr, indicateurFutureLimitStr, todayStr }
      )

      // Si rien à signaler, passer
      if (totalActions === 0 && totalIndicateurs === 0) {
        usersSkipped++
        continue
      }

      // Envoyer l'email
      try {
        const emailTemplate = getReminderEmailTemplate(user, pendingActions, pendingIndicators, totalActions, totalIndicateurs)
        
        const emailResult = await sendEmail({
          to: user.username,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.htmlContent,
          textContent: emailTemplate.textContent
        })
        
        // Archiver l'email
        try {
          const { error: logError } = await supabase.from('email_logs').insert({
            destinataire: user.username,
            destinataire_nom: `${user.prenoms} ${user.nom}`,
            sujet: emailTemplate.subject,
            type_email: 'rappel_quotidien',
            statut: emailResult.success ? 'envoyé' : 'échec',
            message_id: emailResult.messageId || null,
            nb_actions: totalActions,
            nb_indicateurs: totalIndicateurs,
            details: { actions: pendingActions, indicateurs: pendingIndicators },
            erreur: emailResult.success ? null : emailResult.error,
            source: 'cron_quotidien'
          })
          if (logError) {
            console.error('[CRON_LOG] Erreur insertion log:', logError)
          }
        } catch (logErr) {
          console.error('[CRON_LOG] Exception archivage:', logErr)
        }

        if (emailResult.success) {
          emailsSent++
          results.push({ user: username, status: 'sent' })
        } else {
          emailsFailed++
          results.push({ user: username, status: 'failed', error: emailResult.error })
        }
      } catch (error) {
        emailsFailed++
        
        // Archiver l'échec
        try {
          const { error: logError } = await supabase.from('email_logs').insert({
            destinataire: user.username,
            destinataire_nom: `${user.prenoms} ${user.nom}`,
            sujet: 'GIRAS - Rappel quotidien',
            type_email: 'rappel_quotidien',
            statut: 'échec',
            nb_actions: pendingActions.length,
            nb_indicateurs: pendingIndicators.length,
            erreur: error.message,
            source: 'cron_quotidien'
          })
          if (logError) console.error('[CRON_LOG] Erreur insertion échec:', logError)
        } catch (logErr) {
          console.error('[CRON_LOG] Exception archivage échec:', logErr)
        }
        
        results.push({ user: username, status: 'failed', error: error.message })
      }
    }

    console.log(`[CRON] Terminé: ${emailsSent} envoyés, ${emailsFailed} échoués, ${usersSkipped} ignorés`)

    const executionTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: today,
      execution_time_ms: executionTime,
      summary: {
        total_users: users?.length || 0,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        users_skipped: usersSkipped
      }
    })

  } catch (error) {
    console.error('[CRON] Erreur:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
