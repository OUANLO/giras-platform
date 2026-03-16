import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getReminderEmailTemplate } from '@/lib/email'
import { buildPendingForUser, calculateRetard, getNiveauAvancement } from '@/lib/reminder-data'

// POST - Envoyer des emails de rappel aux utilisateurs
export async function POST(request) {
  try {
    const body = await request.json()
    const { targetUser, sendToAll, createur } = body
    
    const supabase = createAdminClient()
    
    // Récupérer les utilisateurs
    let usersToNotify = []
    
    if (sendToAll) {
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('statut', 'Actif')
      
      if (usersError) throw usersError
      usersToNotify = allUsers || []
    } else if (targetUser) {
      const { data: singleUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', targetUser)
        .single()
      
      if (userError) throw userError
      if (singleUser) usersToNotify = [singleUser]
    }

    if (usersToNotify.length === 0) {
      return NextResponse.json({ error: 'Aucun utilisateur trouvé' }, { status: 400 })
    }

    // Récupérer les données
    const { data: actions } = await supabase
      .from('actions')
      .select('*')
      .eq('statut_act', 'Actif')

    const { data: actionOccurrences } = await supabase
      .from('action_occurrences')
      .select('*')
      .neq('statut', 'Achevé')

    const { data: indicateurs } = await supabase
      .from('indicateurs')
      .select('*')
      .eq('statut', 'Actif')

    const { data: indicateurOccurrences } = await supabase
      .from('indicateur_occurrences')
      .select('*')

    const { data: groupesIndicateurs } = await supabase
      .from('groupe_indicateurs')
      .select('*')

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

    // Préparer les résultats
    const results = []
    const emailsSent = []
    const emailsFailed = []

    for (const user of usersToNotify) {
      const username = user.username

      // Construire le contenu de manière centralisée (identique au CRON)
      const { pendingActions, pendingIndicators, totalActions, totalIndicateurs } = buildPendingForUser(
        user,
        { actions, actionOccurrences, indicateurs, indicateurOccurrences, groupesIndicateurs },
        { actionFutureLimitStr, indicateurFutureLimitStr, todayStr }
      )

      // Si rien à signaler, passer à l'utilisateur suivant
      if (totalActions === 0 && totalIndicateurs === 0) {
        results.push({
          user: username,
          status: 'skipped',
          reason: 'Aucune action ni indicateur en attente'
        })
        continue
      }

      // Envoyer l'email avec le template
      try {
        const emailTemplate = getReminderEmailTemplate(user, pendingActions, pendingIndicators, totalActions, totalIndicateurs)
        
        const emailResult = await sendEmail({
          to: user.username,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.htmlContent,
          textContent: emailTemplate.textContent
        })
        
        // Archiver l'email dans email_logs
        try {
          const { error: logError } = await supabase.from('email_logs').insert({
            destinataire: user.username,
            destinataire_nom: `${user.prenoms} ${user.nom}`,
            sujet: emailTemplate.subject,
            type_email: 'rappel_manuel',
            statut: emailResult.success ? 'envoyé' : 'échec',
            message_id: emailResult.messageId || null,
            nb_actions: totalActions,
            nb_indicateurs: totalIndicateurs,
            details: { actions: pendingActions, indicateurs: pendingIndicators },
            erreur: emailResult.success ? null : emailResult.error,
            source: 'manuel',
            createur: createur || null
          })
          
          if (logError) {
            console.error('[EMAIL_LOG] Erreur insertion log:', logError)
          } else {
            console.log('[EMAIL_LOG] Email archivé pour', user.username)
          }
        } catch (logErr) {
          console.error('[EMAIL_LOG] Exception archivage:', logErr)
        }
        
        if (emailResult.success) {
          console.log(`[EMAIL] Email de rappel envoyé à ${username}`)
          
          emailsSent.push({
            user: username,
            nom: `${user.prenoms} ${user.nom}`,
            actionsCount: totalActions,
            indicateursCount: totalIndicateurs
          })

          results.push({
            user: username,
            status: 'sent',
            actions: totalActions,
            indicateurs: totalIndicateurs
          })
        } else {
          throw new Error(emailResult.error)
        }
      } catch (emailError) {
        console.error(`[EMAIL] Erreur envoi email à ${username}:`, emailError)
        
        // Archiver l'échec
        try {
          const { error: logError } = await supabase.from('email_logs').insert({
            destinataire: user.username,
            destinataire_nom: `${user.prenoms} ${user.nom}`,
            sujet: 'GIRAS - Rappel',
            type_email: 'rappel_manuel',
            statut: 'échec',
            nb_actions: pendingActions.length,
            nb_indicateurs: pendingIndicators.length,
            erreur: emailError.message,
            source: 'manuel',
            createur: createur || null
          })
          if (logError) console.error('[EMAIL_LOG] Erreur insertion échec:', logError)
        } catch (logErr) {
          console.error('[EMAIL_LOG] Exception archivage échec:', logErr)
        }
        
        emailsFailed.push({
          user: username,
          error: emailError.message
        })
        results.push({
          user: username,
          status: 'failed',
          error: emailError.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${emailsSent.length} email(s) envoyé(s)`,
      summary: {
        total: usersToNotify.length,
        sent: emailsSent.length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: emailsFailed.length
      },
      details: emailsSent,
      failed: emailsFailed
    })

  } catch (error) {
    console.error('Erreur envoi emails rappel:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de l\'envoi des emails' }, { status: 500 })
  }
}

// GET - Récupérer la synthèse des actions/indicateurs par utilisateur
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const targetUser = searchParams.get('user')
    
    const supabase = createAdminClient()
    
    // Récupérer les utilisateurs
    let query = supabase.from('users').select('*').eq('statut', 'Actif')
    if (targetUser) query = query.eq('username', targetUser)
    
    const { data: users, error: usersError } = await query
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

    // Récupérer les indicateurs et occurrences
    const { data: indicateurs } = await supabase
      .from('indicateurs')
      .select('*')
      .eq('statut', 'Actif')

    const { data: indicateurOccurrences } = await supabase
      .from('indicateur_occurrences')
      .select('*')

    // Construire la synthèse par utilisateur
    const synthesis = (users || []).map(user => {
      const username = user.username

      // Actions non achevées
      const userActionOccurrences = (actionOccurrences || []).filter(occ => occ.responsable === username)
      
      const pendingActions = userActionOccurrences.map(occ => {
        const action = (actions || []).find(a => a.code_action === occ.code_action)
        const retard = calculateRetard(occ.date_fin)
        return {
          code_groupe: action?.code_groupe || '-',
          libelle_action: action?.libelle_action || 'Action sans libellé',
          date_debut: occ.date_debut,
          date_fin: occ.date_fin,
          tx_avancement: occ.tx_avancement || 0,
          niveau_avancement: getNiveauAvancement(occ.tx_avancement || 0),
          jours_retard: retard.jours_retard,
          jours_restants: retard.jours_restants
        }
      }).filter(a => a.tx_avancement < 100)

      // Indicateurs non renseignés
      const userIndicateurs = (indicateurs || []).filter(i => i.responsable === username)
      
      const pendingIndicators = []
      for (const ind of userIndicateurs) {
        const indOccurrences = (indicateurOccurrences || []).filter(
          o => o.code_indicateur === ind.code_indicateur && 
               (o.val_indicateur === null || o.val_indicateur === undefined || o.val_indicateur === '')
        )
        
        for (const occ of indOccurrences) {
          const retard = calculateRetard(occ.date_limite_saisie)
          pendingIndicators.push({
            libelle_indicateur: ind.libelle_indicateur,
            periode: occ.periode || '-',
            date_limite: occ.date_limite_saisie || '-',
            jours_retard: retard.jours_retard,
            jours_restants: retard.jours_restants
          })
        }
      }

      return {
        username: user.username,
        nom: user.nom,
        prenoms: user.prenoms,
        email: user.username,
        structure: user.code_structure || user.structure,
        actionsNonRealisees: pendingActions.length,
        indicateursNonRenseignes: pendingIndicators.length,
        actions: pendingActions,
        indicateurs: pendingIndicators,
        hasItems: pendingActions.length > 0 || pendingIndicators.length > 0
      }
    })

    // Si sendToAll, ne garder que ceux qui ont des items
    // Sinon garder tout le monde pour voir la synthèse complète
    const filteredSynthesis = targetUser ? synthesis : synthesis.filter(s => s.hasItems)

    return NextResponse.json({ synthesis: filteredSynthesis })

  } catch (error) {
    console.error('Erreur récupération synthèse:', error)
    return NextResponse.json({ synthesis: [], error: error.message })
  }
}
