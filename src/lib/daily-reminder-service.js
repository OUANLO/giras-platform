import { sendEmail, getReminderEmailTemplate } from '@/lib/email'
import { buildPendingForUser } from '@/lib/reminder-data'

function isFalseLike(value) {
  if (value === false || value === null || value === undefined || value === 0) return true
  const s = String(value).trim().toLowerCase()
  return s === '' || s === 'false' || s === '0' || s === 'non' || s === 'no'
}

function isTrueLike(value) {
  return !isFalseLike(value)
}

function isActionActive(action) {
  if (!action) return false
  if (isTrueLike(action.archive)) return false
  const statutAct = String(action.statut_act || '').trim().toLowerCase()
  const statut = String(action.statut || '').trim().toLowerCase()
  if (statutAct && statutAct === 'inactif') return false
  if (statut && statut === 'inactif') return false
  return !!String(action.code_action || '').trim()
}

function isOccurrenceActive(occ) {
  if (!occ) return false
  if (isTrueLike(occ.archive)) return false
  return !!String(occ?.code_action || occ?.code_action_occ || occ?.__actionCode || '').trim()
}

export function buildReminderWindowOptions() {
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const todayStr = todayDate.toISOString().split('T')[0]

  const actionFutureLimit = new Date(todayDate)
  actionFutureLimit.setDate(actionFutureLimit.getDate() + 30)
  const actionFutureLimitStr = actionFutureLimit.toISOString().split('T')[0]

  const indicateurFutureLimit = new Date(todayDate)
  indicateurFutureLimit.setDate(indicateurFutureLimit.getDate() + 10)
  const indicateurFutureLimitStr = indicateurFutureLimit.toISOString().split('T')[0]

  return { todayStr, actionFutureLimitStr, indicateurFutureLimitStr }
}

export async function loadReminderDataset(supabase) {
  const [usersRes, actionsRes, actionOccurrencesRes, indicateursRes, indicateurOccurrencesRes, groupesIndicateursRes] = await Promise.all([
    supabase.from('users').select('*').eq('statut', 'Actif'),
    supabase.from('actions').select('*'),
    supabase.from('action_occurrences').select('*'),
    supabase.from('indicateurs').select('*').eq('statut', 'Actif'),
    supabase.from('indicateur_occurrences').select('*'),
    supabase.from('groupe_indicateurs').select('*')
  ])

  if (usersRes.error) throw usersRes.error
  if (actionsRes.error) throw actionsRes.error
  if (actionOccurrencesRes.error) throw actionOccurrencesRes.error
  if (indicateursRes.error) throw indicateursRes.error
  if (indicateurOccurrencesRes.error) throw indicateurOccurrencesRes.error
  if (groupesIndicateursRes.error) throw groupesIndicateursRes.error

  const actions = (actionsRes.data || []).filter(isActionActive)
  const activeActionCodes = new Set(actions.map((row) => String(row?.code_action || '').trim()).filter(Boolean))
  const actionOccurrences = (actionOccurrencesRes.data || []).filter((occ) => {
    if (!isOccurrenceActive(occ)) return false
    const code = String(occ?.code_action || occ?.code_action_occ || occ?.__actionCode || '').trim()
    return activeActionCodes.has(code)
  })

  return {
    users: usersRes.data || [],
    actions,
    actionOccurrences,
    indicateurs: indicateursRes.data || [],
    indicateurOccurrences: indicateurOccurrencesRes.data || [],
    groupesIndicateurs: groupesIndicateursRes.data || []
  }
}

export function getPendingReminderPayloadForUser(user, dataset, windowOptions = buildReminderWindowOptions()) {
  const { pendingActions, pendingIndicators, totalActions, totalIndicateurs } = buildPendingForUser(
    user,
    dataset,
    windowOptions
  )

  return {
    pendingActions,
    pendingIndicators,
    totalActions,
    totalIndicateurs,
    hasItems: totalActions > 0 || totalIndicateurs > 0
  }
}

export function getUsersWithPendingReminderItems(dataset, windowOptions = buildReminderWindowOptions()) {
  return (dataset?.users || []).filter((user) => getPendingReminderPayloadForUser(user, dataset, windowOptions).hasItems)
}


export async function sendDailyReminders({ users = [], dataset, supabase, typeEmail, source, createur = null, runMode = 'production', windowOptions = buildReminderWindowOptions() }) {
  const results = []

  for (const user of users || []) {
    try {
      const result = await sendDailyReminderToUser({ user, dataset, supabase, typeEmail, source, createur, runMode, windowOptions })
      results.push({ user: user?.username, ...result })
    } catch (error) {
      results.push({ user: user?.username, status: 'failed', error: error?.message || 'Erreur inconnue' })
    }
  }

  return results
}

export async function sendDailyReminderToUser({ user, dataset, supabase, typeEmail, source, createur = null, runMode = 'production', windowOptions = buildReminderWindowOptions() }) {
  const payload = getPendingReminderPayloadForUser(user, dataset, windowOptions)
  const { pendingActions, pendingIndicators, totalActions, totalIndicateurs, hasItems } = payload

  if (!hasItems) {
    return {
      status: 'skipped',
      user: user.username,
      reason: 'Aucune action ni indicateur en attente',
      totalActions,
      totalIndicateurs
    }
  }

  const emailTemplate = getReminderEmailTemplate(user, pendingActions, pendingIndicators, totalActions, totalIndicateurs)
  const emailResult = await sendEmail({
    to: user.username,
    subject: emailTemplate.subject,
    htmlContent: emailTemplate.htmlContent,
    textContent: emailTemplate.textContent
  })

  await supabase.from('email_logs').insert({
    destinataire: user.username,
    destinataire_nom: `${user.prenoms} ${user.nom}`,
    sujet: emailTemplate.subject,
    type_email: typeEmail,
    statut: emailResult.success ? 'envoyé' : 'échec',
    message_id: emailResult.messageId || null,
    nb_actions: totalActions,
    nb_indicateurs: totalIndicateurs,
    details: { actions: pendingActions, indicateurs: pendingIndicators, run_mode: runMode },
    erreur: emailResult.success ? null : emailResult.error,
    source,
    createur
  })

  if (!emailResult.success) {
    throw new Error(emailResult.error || 'Échec envoi email')
  }

  return {
    status: 'sent',
    user: user.username,
    totalActions,
    totalIndicateurs,
    emailTemplate
  }
}
