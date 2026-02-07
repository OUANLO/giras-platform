import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getWeeklyRecapEmailTemplate } from '@/lib/email'

// Forcer le rendu dynamique
export const dynamic = 'force-dynamic'

// Clé secrète pour sécuriser l'endpoint CRON
const CRON_SECRET = process.env.CRON_SECRET || 'giras-cron-secret-2024'

// Obtenir la date du jour au format YYYY-MM-DD
function getTodayDateString() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

// Vérifier si c'est un lundi
function isMonday() {
  return new Date().getDay() === 1
}

// Vérifier si le récap hebdo a déjà été envoyé cette semaine
async function hasAlreadySentThisWeek(supabase) {
  const today = new Date()
  // Trouver le lundi de cette semaine
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  
  const startOfWeek = monday.toISOString()
  
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .select('id, created_at')
      .eq('source', 'cron_hebdo')
      .eq('statut', 'envoyé')
      .gte('created_at', startOfWeek)
      .limit(1)
    
    if (error) {
      console.error('[CRON_HEBDO] Erreur vérification:', error)
      return { alreadySent: false }
    }
    
    return { alreadySent: data && data.length > 0, firstEmailAt: data?.[0]?.created_at }
  } catch (err) {
    console.error('[CRON_HEBDO] Exception:', err)
    return { alreadySent: false }
  }
}

// Calculer les performances d'un utilisateur
function calculateUserPerformance(username, actions, actionOccurrences, indicateurs, indicateurOccurrences) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Performance actions
  const userActionOccs = actionOccurrences.filter(o => o.responsable === username)
  const actionsTerminees = userActionOccs.filter(o => (o.tx_avancement || 0) >= 100)
  const actionsEnRetard = userActionOccs.filter(o => {
    if ((o.tx_avancement || 0) >= 100) return false
    const dateFin = new Date(o.date_fin)
    return dateFin < today
  })
  const actionsEnCours = userActionOccs.filter(o => {
    if ((o.tx_avancement || 0) >= 100) return false
    const dateFin = new Date(o.date_fin)
    return dateFin >= today
  })
  
  const txActionsTerminees = userActionOccs.length > 0 
    ? Math.round((actionsTerminees.length / userActionOccs.length) * 100) 
    : 100
  
  // Performance indicateurs
  const userIndicateurs = indicateurs.filter(i => i.responsable === username)
  const userIndicateurCodes = userIndicateurs.map(i => i.code_indicateur)
  const userIndOccs = indicateurOccurrences.filter(o => userIndicateurCodes.includes(o.code_indicateur))
  
  const indicateursRenseignes = userIndOccs.filter(o => 
    o.val_indicateur !== null && o.val_indicateur !== undefined && o.val_indicateur !== ''
  )
  const indicateursEnRetard = userIndOccs.filter(o => {
    if (o.val_indicateur !== null && o.val_indicateur !== undefined && o.val_indicateur !== '') return false
    const dateLimite = new Date(o.date_limite_saisie)
    return dateLimite < today
  })
  const indicateursAJour = userIndOccs.filter(o => {
    if (o.val_indicateur !== null && o.val_indicateur !== undefined && o.val_indicateur !== '') return true
    const dateLimite = new Date(o.date_limite_saisie)
    return dateLimite >= today
  })
  
  const txIndicateursRenseignes = userIndOccs.length > 0 
    ? Math.round((indicateursRenseignes.length / userIndOccs.length) * 100) 
    : 100
  
  // Score global
  const scoreGlobal = Math.round((txActionsTerminees + txIndicateursRenseignes) / 2)
  
  return {
    actions: {
      total: userActionOccs.length,
      terminees: actionsTerminees.length,
      enCours: actionsEnCours.length,
      enRetard: actionsEnRetard.length,
      tauxRealisation: txActionsTerminees
    },
    indicateurs: {
      total: userIndOccs.length,
      renseignes: indicateursRenseignes.length,
      aJour: indicateursAJour.length,
      enRetard: indicateursEnRetard.length,
      tauxRenseignement: txIndicateursRenseignes
    },
    scoreGlobal
  }
}

// GET - Endpoint CRON pour envoyer le récap hebdomadaire (chaque lundi à 8h30)
export async function GET(request) {
  const startTime = Date.now()
  
  try {
    // Vérifier l'autorisation
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    const forceParam = searchParams.get('force') // Pour tester hors lundi
    const providedSecret = authHeader?.replace('Bearer ', '') || secretParam
    
    if (providedSecret !== CRON_SECRET) {
      console.log('[CRON_HEBDO] Tentative non autorisée')
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier si c'est un lundi (sauf si force=true)
    if (!isMonday() && forceParam !== 'true') {
      console.log('[CRON_HEBDO] Pas un lundi, récap non envoyé')
      return NextResponse.json({ 
        success: false, 
        blocked: true,
        reason: 'not_monday',
        message: 'Le récap hebdomadaire n\'est envoyé que le lundi.',
        day: new Date().toLocaleDateString('fr-FR', { weekday: 'long' })
      }, { status: 200 })
    }

    const supabase = createAdminClient()
    const today = getTodayDateString()
    
    // Vérifier si déjà envoyé cette semaine
    const checkResult = await hasAlreadySentThisWeek(supabase)
    if (checkResult.alreadySent && forceParam !== 'true') {
      console.log(`[CRON_HEBDO] Récap déjà envoyé cette semaine`)
      return NextResponse.json({ 
        success: false, 
        blocked: true,
        reason: 'already_sent_this_week',
        message: 'Le récap hebdomadaire a déjà été envoyé cette semaine.',
        first_email_at: checkResult.firstEmailAt
      }, { status: 429 })
    }

    console.log('[CRON_HEBDO] Démarrage du récap hebdomadaire à', new Date().toISOString())
    
    // Récupérer les données
    const { data: users } = await supabase.from('users').select('*').eq('statut', 'Actif')
    const { data: actions } = await supabase.from('actions').select('*')
    const { data: actionOccurrences } = await supabase.from('action_occurrences').select('*')
    const { data: indicateurs } = await supabase.from('indicateurs').select('*')
    const { data: indicateurOccurrences } = await supabase.from('indicateur_occurrences').select('*')
    
    let emailsSent = 0
    let emailsFailed = 0
    let usersSkipped = 0

    for (const user of users || []) {
      const username = user.username
      
      // Calculer les performances
      const performance = calculateUserPerformance(
        username, 
        actions || [], 
        actionOccurrences || [], 
        indicateurs || [], 
        indicateurOccurrences || []
      )
      
      // Si l'utilisateur n'a rien (pas d'actions ni d'indicateurs), passer
      if (performance.actions.total === 0 && performance.indicateurs.total === 0) {
        usersSkipped++
        continue
      }
      
      try {
        const emailTemplate = getWeeklyRecapEmailTemplate(user, performance)
        
        const emailResult = await sendEmail({
          to: username,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.htmlContent,
          textContent: emailTemplate.textContent
        })
        
        // Archiver
        await supabase.from('email_logs').insert({
          destinataire: username,
          destinataire_nom: `${user.prenoms} ${user.nom}`,
          sujet: emailTemplate.subject,
          type_email: 'recap_hebdo',
          statut: emailResult.success ? 'envoyé' : 'échec',
          message_id: emailResult.messageId || null,
          details: { performance },
          erreur: emailResult.success ? null : emailResult.error,
          source: 'cron_hebdo'
        })
        
        if (emailResult.success) {
          emailsSent++
        } else {
          emailsFailed++
        }
      } catch (error) {
        emailsFailed++
        console.error(`[CRON_HEBDO] Erreur pour ${username}:`, error)
      }
    }

    const executionTime = Date.now() - startTime
    console.log(`[CRON_HEBDO] Terminé: ${emailsSent} envoyés, ${emailsFailed} échoués, ${usersSkipped} ignorés`)

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
    console.error('[CRON_HEBDO] Erreur:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST - Envoi manuel du récap hebdomadaire depuis l'interface admin
export async function POST(request) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { targetUser, sendToAll, createur } = body
    
    const supabase = createAdminClient()
    const today = getTodayDateString()
    
    console.log('[RECAP_HEBDO_MANUEL] Démarrage envoi manuel à', new Date().toISOString())
    
    // Récupérer les utilisateurs cibles
    let users = []
    if (sendToAll) {
      const { data } = await supabase.from('users').select('*').eq('statut', 'Actif')
      users = data || []
    } else if (targetUser) {
      const { data } = await supabase.from('users').select('*').eq('username', targetUser).single()
      if (data) users = [data]
    }
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'Aucun utilisateur trouvé' }, { status: 400 })
    }
    
    // Récupérer les données
    const { data: actions } = await supabase.from('actions').select('*')
    const { data: actionOccurrences } = await supabase.from('action_occurrences').select('*')
    const { data: indicateurs } = await supabase.from('indicateurs').select('*')
    const { data: indicateurOccurrences } = await supabase.from('indicateur_occurrences').select('*')
    
    let emailsSent = 0
    let emailsFailed = 0
    let usersSkipped = 0
    const results = []

    for (const user of users) {
      const username = user.username
      
      // Calculer les performances
      const performance = calculateUserPerformance(
        username, 
        actions || [], 
        actionOccurrences || [], 
        indicateurs || [], 
        indicateurOccurrences || []
      )
      
      // Si l'utilisateur n'a rien (pas d'actions ni d'indicateurs), passer
      if (performance.actions.total === 0 && performance.indicateurs.total === 0) {
        usersSkipped++
        results.push({ user: username, status: 'skipped', reason: 'Aucune donnée' })
        continue
      }
      
      try {
        const emailTemplate = getWeeklyRecapEmailTemplate(user, performance)
        
        const emailResult = await sendEmail({
          to: username,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.htmlContent,
          textContent: emailTemplate.textContent
        })
        
        // Archiver
        await supabase.from('email_logs').insert({
          destinataire: username,
          destinataire_nom: `${user.prenoms} ${user.nom}`,
          sujet: emailTemplate.subject,
          type_email: 'recap_hebdo_manuel',
          statut: emailResult.success ? 'envoyé' : 'échec',
          message_id: emailResult.messageId || null,
          details: { performance },
          erreur: emailResult.success ? null : emailResult.error,
          source: 'manuel_hebdo',
          createur: createur || null
        })
        
        if (emailResult.success) {
          emailsSent++
          results.push({ user: username, status: 'sent', score: performance.scoreGlobal })
        } else {
          emailsFailed++
          results.push({ user: username, status: 'failed', error: emailResult.error })
        }
      } catch (error) {
        emailsFailed++
        results.push({ user: username, status: 'failed', error: error.message })
        console.error(`[RECAP_HEBDO_MANUEL] Erreur pour ${username}:`, error)
      }
    }

    const executionTime = Date.now() - startTime
    console.log(`[RECAP_HEBDO_MANUEL] Terminé: ${emailsSent} envoyés, ${emailsFailed} échoués, ${usersSkipped} ignorés`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
      summary: {
        total_users: users.length,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        users_skipped: usersSkipped
      },
      results
    })

  } catch (error) {
    console.error('[RECAP_HEBDO_MANUEL] Erreur:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
