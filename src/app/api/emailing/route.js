export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdministrationAccess } from '@/lib/auth'
import { canAccessAdminSection } from '@/lib/roles'
import { calculateRetard, getNiveauAvancement } from '@/lib/reminder-data'
import { loadReminderDataset, sendDailyReminders } from '@/lib/daily-reminder-service'


const getUserIdentifiers = (user) => new Set(
  [user?.username, user?.email]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())
)

const identifierMatches = (value, identifiers) => {
  if (!value || !identifiers || identifiers.size === 0) return false
  return identifiers.has(String(value).trim().toLowerCase())
}

const getActionRowSortValue = (row) => {
  const candidates = [row?.date_modification, row?.updated_at, row?.created_at, row?.date_realisation, row?.date_conf, row?.date_fin, row?.date_debut]
  for (const value of candidates) {
    if (!value) continue
    const ts = new Date(value).getTime()
    if (Number.isFinite(ts)) return ts
  }
  const idNum = Number(row?.id)
  return Number.isFinite(idNum) ? idNum : 0
}

const buildEffectiveActionRows = (actions, actionOccurrences) => {
  const activeActions = (actions || []).filter((action) => action && action.archive !== true && action.statut !== 'Inactif' && action.statut_act !== 'Inactif')
  const actionByCode = new Map(activeActions.map((action) => [String(action?.code_action || '').trim(), action]))
  const rows = []
  const seenOccurrenceKeys = new Set()
  const actionsWithOccurrences = new Set()

  for (const occ of actionOccurrences || []) {
    if (!occ || occ.archive === true) continue
    const code = String(occ?.code_action || occ?.code_action_occ || '').trim()
    if (!code || !actionByCode.has(code)) continue

    const action = actionByCode.get(code)
    const occurrenceKey = String(occ?.code_occurrence || occ?.id || `${code}-${getActionRowSortValue(occ)}`)
    if (seenOccurrenceKeys.has(occurrenceKey)) continue
    seenOccurrenceKeys.add(occurrenceKey)
    actionsWithOccurrences.add(code)

    rows.push({
      ...action,
      ...occ,
      code_action: code,
      code_occurrence: occ?.code_occurrence || null,
      occurrence_id: occ?.id || null,
      responsable: occ?.responsable || action?.responsable || null,
      code_groupe: action?.code_groupe || occ?.code_groupe || null,
      libelle_action: action?.libelle_action || occ?.libelle_action || null,
      date_debut: occ?.date_debut || action?.date_debut || null,
      date_fin: occ?.date_fin || action?.date_fin || null,
      tx_avancement: occ?.tx_avancement ?? action?.tx_avancement ?? 0,
      statut: action?.statut || action?.statut_act || 'Actif'
    })
  }

  for (const action of activeActions) {
    const code = String(action?.code_action || '').trim()
    if (!code || actionsWithOccurrences.has(code)) continue
    rows.push({
      ...action,
      code_action: code,
      code_occurrence: null,
      occurrence_id: null,
      responsable: action?.responsable || null,
      code_groupe: action?.code_groupe || null,
      libelle_action: action?.libelle_action || null,
      date_debut: action?.date_debut || null,
      date_fin: action?.date_fin || null,
      tx_avancement: action?.tx_avancement ?? 0,
      statut: action?.statut || action?.statut_act || 'Actif'
    })
  }

  return rows.sort((a, b) => getActionRowSortValue(b) - getActionRowSortValue(a))
}

// POST - Envoyer des emails de rappel aux utilisateurs
export async function POST(request) {
  try {
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard
    if (!canAccessAdminSection(guard, 'emailing')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await request.json()
    const { targetUser, targetUsers, sendToAll, createur } = body
    
    const supabase = createAdminClient(request)
    const reminderDataset = await loadReminderDataset(supabase)

    let usersToNotify = []
    if (sendToAll) {
      usersToNotify = reminderDataset.users
    } else if (Array.isArray(targetUsers) && targetUsers.length > 0) {
      const uniqueTargets = [...new Set(targetUsers.filter(Boolean))]
      usersToNotify = reminderDataset.users.filter((user) => uniqueTargets.includes(user.username))
    } else if (targetUser) {
      usersToNotify = reminderDataset.users.filter((user) => user.username === targetUser)
    }

    if (usersToNotify.length === 0) {
      return NextResponse.json({ error: 'Aucun utilisateur trouvé' }, { status: 400 })
    }

    // Préparer les résultats via le même orchestrateur que le CRON
    const results = await sendDailyReminders({
      users: usersToNotify,
      dataset: reminderDataset,
      supabase,
      typeEmail: 'rappel_manuel',
      source: 'manuel',
      createur: createur || null
    })
    const emailsSent = []
    const emailsFailed = []

    for (const entry of results) {
      const currentUser = usersToNotify.find((u) => u.username === entry.user)
      if (entry.status === 'sent') {
        console.log(`[EMAIL] Email de rappel envoyé à ${entry.user}`)
        emailsSent.push({
          user: entry.user,
          nom: currentUser ? `${currentUser.prenoms} ${currentUser.nom}` : entry.user,
          actionsCount: entry.totalActions,
          indicateursCount: entry.totalIndicateurs
        })
      } else if (entry.status === 'failed') {
        console.error(`[EMAIL] Erreur envoi email à ${entry.user}:`, entry.error)
        emailsFailed.push({ user: entry.user, error: entry.error })
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
    const guard = requireAdministrationAccess(request)
    if (guard instanceof NextResponse) return guard
    if (!canAccessAdminSection(guard, 'emailing')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const targetUser = searchParams.get('user')
    
    const supabase = createAdminClient(request)
    
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
      .or('archive.is.null,archive.eq.false')

    // Récupérer les indicateurs et occurrences
    const { data: indicateurs } = await supabase
      .from('indicateurs')
      .select('*')
      .eq('statut', 'Actif')

    const { data: indicateurOccurrences } = await supabase
      .from('indicateur_occurrences')
      .select('*')

    const actionMap = new Map((actions || []).map((action) => [String(action.code_action || ''), action]))
    const effectiveActionRows = buildEffectiveActionRows(actions, actionOccurrences)

    // Construire la synthèse par utilisateur
    const synthesis = (users || []).map(user => {
      const userIdentifiers = getUserIdentifiers(user)

      // Actions non achevées
      const pendingActions = effectiveActionRows
        .filter((occ) => identifierMatches(occ.responsable, userIdentifiers))
        .map((occ) => {
          const action = actionMap.get(String(occ.code_action || '').trim())
          const dateDebut = occ?.date_debut || action?.date_debut || null
          const dateFin = occ?.date_fin || action?.date_fin || null
          const retard = calculateRetard(dateFin)
          const txAvancement = Number.isFinite(Number(occ.tx_avancement)) ? Number(occ.tx_avancement) : 0
          return {
            code_groupe: occ?.code_groupe || action?.code_groupe || '-',
            libelle_action: occ?.libelle_action || action?.libelle_action || 'Action sans libellé',
            date_debut: dateDebut,
            date_fin: dateFin,
            tx_avancement: txAvancement,
            niveau_avancement: getNiveauAvancement(txAvancement),
            jours_retard: retard.jours_retard,
            jours_restants: retard.jours_restants
          }
        })
        .filter((a) => a.tx_avancement < 100)

      // Indicateurs non renseignés
      const userIndicateurs = (indicateurs || []).filter((i) => identifierMatches(i.responsable, userIdentifiers))

      const pendingIndicators = []
      for (const ind of userIndicateurs) {
        const indOccurrences = (indicateurOccurrences || []).filter(
          (o) => o.code_indicateur === ind.code_indicateur && (o.val_indicateur === null || o.val_indicateur === undefined || o.val_indicateur === '')
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
