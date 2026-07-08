import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail, getActionAssignmentEmailTemplate, getActionRejectionEmailTemplate } from '@/lib/email'


const normalizeDateValue = (value) => String(value || '').slice(0, 10)
const clampProgress = (value) => {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, parsed))
}

const validateOccurrenceDates = (start, end) => {
  const s = normalizeDateValue(start)
  const e = normalizeDateValue(end)
  if (!s || !e) return 'Dates obligatoires (début, fin)'
  if (e < s) return 'La date de fin doit être ultérieure ou égale à la date de début'
  return null
}

const findOverlappingOccurrence = async (supabase, codeAction, start, end, excludeId = null) => {
  let query = supabase
    .from('action_occurrences')
    .select('id, date_debut, date_fin, archive')
    .eq('code_action', codeAction)
    .or('archive.is.null,archive.eq.false')

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) throw error

  const s = normalizeDateValue(start)
  const e = normalizeDateValue(end)
  return (data || []).find((occ) => {
    const occStart = normalizeDateValue(occ.date_debut)
    const occEnd = normalizeDateValue(occ.date_fin)
    return occStart && occEnd && s <= occEnd && e >= occStart
  }) || null
}


// GET - Récupérer les occurrences d'actions
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code_action = searchParams.get('code_action')
    const code_groupe = searchParams.get('code_groupe')
    const includeArchived = searchParams.get('include_archived') === '1'

    const supabase = createAdminClient(request)
    
    let query = supabase
      .from('action_occurrences')
      .select(`
        *,
        action:actions (
          id,
          code_action,
          libelle_action
        )
      `)
      .order('date_debut', { ascending: false })

    if (code_action) query = query.eq('code_action', code_action)
    if (!includeArchived) query = query.or('archive.is.null,archive.eq.false')

    const { data, error } = await query

    if (error) {
      console.error('Erreur requête action_occurrences:', error)
      // Si la table n'existe pas, retourner tableau vide
      if (error.code === '42P01') {
        return NextResponse.json({ occurrences: [], message: 'Table action_occurrences non créée' })
      }
      return NextResponse.json({ occurrences: [], message: error.message })
    }

    const occurrences = (data || []).map((occ) => ({
      ...occ,
      __actionCode: String(occ?.code_action ?? occ?.code_action_occ ?? occ?.action?.code_action ?? '').trim(),
      __actionId: occ?.action?.id || null,
      libelle_action: occ?.libelle_action || occ?.action?.libelle_action || null
    }))

    return NextResponse.json({ occurrences })
  } catch (error) {
    console.error('Erreur GET action_occurrences:', error)
    return NextResponse.json({ occurrences: [], message: error.message })
  }
}

// POST - Créer une nouvelle occurrence d'action
export async function POST(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient(request)

    // Validation
    if (!body.code_action) {
      return NextResponse.json({ error: 'Code action obligatoire' }, { status: 400 })
    }
    const dateError = validateOccurrenceDates(body.date_debut, body.date_fin)
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 })
    }
    if (!body.responsable) {
      return NextResponse.json({ error: 'Responsable obligatoire' }, { status: 400 })
    }

    const { data: actionDef, error: actionError } = await supabase
      .from('actions')
      .select('code_action, libelle_action, code_groupe, code_structure, statut_act')
      .eq('code_action', body.code_action)
      .maybeSingle()

    if (actionError) {
      return NextResponse.json({ error: actionError.message }, { status: 500 })
    }
    if (!actionDef) {
      return NextResponse.json({ error: 'Action introuvable' }, { status: 404 })
    }
    if (String(actionDef.statut_act || 'Actif').trim() !== 'Actif') {
      return NextResponse.json({ error: "Impossible de créer une occurrence pour une action inactive" }, { status: 400 })
    }

    const txAvancement = clampProgress(body.tx_avancement)
    if (Number.parseFloat(body.tx_avancement ?? 0) !== txAvancement) {
      return NextResponse.json({ error: "Le taux d'avancement doit être compris entre 0% et 100%" }, { status: 400 })
    }

    // Vérifier unicité date_debut + date_fin pour cette action
    const { data: existing } = await supabase
      .from('action_occurrences')
      .select('id')
      .eq('code_action', body.code_action)
      .eq('date_debut', body.date_debut)
      .eq('date_fin', body.date_fin)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Une occurrence avec ces mêmes dates existe déjà pour cette action' }, { status: 400 })
    }

    const overlap = await findOverlappingOccurrence(supabase, body.code_action, body.date_debut, body.date_fin)
    if (overlap) {
      return NextResponse.json({ error: "Cette période chevauche une occurrence existante de la même action" }, { status: 400 })
    }

    // Générer code_occurrence
    const { data: lastOcc } = await supabase
      .from('action_occurrences')
      .select('code_occurrence')
      .order('code_occurrence', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextCode = 1
    if (lastOcc?.code_occurrence) {
      nextCode = parseInt(lastOcc.code_occurrence) + 1
    }

    // Création
    const { data, error } = await supabase
      .from('action_occurrences')
      .insert({
        code_occurrence: nextCode,
        code_action: body.code_action,
        date_debut: body.date_debut,
        date_fin: body.date_fin,
        responsable: body.responsable,
        tx_avancement: txAvancement,
        date_realisation: body.date_realisation || null,
        date_realisation_auto: body.date_realisation || null,
        commentaire: body.commentaire || null,
        gestionnaire_conf: null,
        date_conf: null,
        createur: body.createur
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur création occurrence:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Envoyer email au responsable
    if (body.responsable) {
      try {
        // Récupérer les infos du responsable
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
          .single()

        // Récupérer les infos de l'action
        const actionData = actionDef

        // Récupérer les infos de l'assignateur (créateur)
        let assignateur = null
        if (body.createur) {
          const { data: createurUser } = await supabase
            .from('users')
            .select('username, prenoms, nom')
            .eq('username', body.createur)
            .single()
          assignateur = createurUser
        }

        if (responsableUser && actionData) {
          const emailTemplate = getActionAssignmentEmailTemplate(responsableUser, {
            libelle_action: actionData.libelle_action,
            code_groupe: actionData.code_groupe,
            code_structure: actionData.code_structure,
            date_debut: body.date_debut,
            date_fin: body.date_fin
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution d'action envoyé à ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email attribution action:', emailError)
        // Ne pas bloquer la création si l'email échoue
      }
    }

    return NextResponse.json({ occurrence: data, message: 'Occurrence créée' })
  } catch (error) {
    console.error('Erreur POST action_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur lors de la création' }, { status: 500 })
  }
}


const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const stringifyJsonArray = (value) => JSON.stringify(Array.isArray(value) ? value : [])

const updateWorkflowEntryComment = (entry, comment, previous_value = null, new_value = null) => ({
  ...entry,
  comment: comment || '',
  previous_value,
  new_value,
  updated_at: new Date().toISOString()
})

const buildWorkflowEntry = ({ actor, actor_role, decision, comment, previous_value = null, new_value = null, metadata = {} }) => ({
  id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  created_at: new Date().toISOString(),
  actor: actor || null,
  actor_role: actor_role || null,
  decision,
  comment: comment || '',
  previous_value,
  new_value,
  metadata
})

async function sendActionRejectedEmail(supabase, occurrence, comment, rejectorUsername) {
  const responsibleUsername = occurrence?.responsable || occurrence?.responsable_action || null
  if (!responsibleUsername) return

  const { data: actionData } = await supabase
    .from('actions')
    .select('libelle_action, code_groupe, code_structure')
    .eq('code_action', occurrence?.code_action)
    .maybeSingle()

  let { data: responsibleUser } = await supabase
    .from('users')
    .select('username, nom, prenoms')
    .eq('username', responsibleUsername)
    .maybeSingle()

  if (!responsibleUser?.username) {
    const { data: fallbackResponsibleUser } = await supabase
      .from('users')
      .select('username, nom, prenoms')
      .ilike('username', responsibleUsername)
      .maybeSingle()
    responsibleUser = fallbackResponsibleUser || responsibleUser
  }

  const { data: rejectorUser } = await supabase
    .from('users')
    .select('username, nom, prenoms')
    .eq('username', rejectorUsername)
    .maybeSingle()

  if (!responsibleUser?.username) return

  const projectCode = String(actionData?.code_groupe || occurrence?.code_groupe || '').trim()
  const structureCode = String(actionData?.code_structure || occurrence?.code_structure || '').trim()

  let projectLabel = projectCode
  if (projectCode) {
    const { data: project } = await supabase
      .from('projets')
      .select('code_groupe, libelle_groupe')
      .eq('code_groupe', projectCode)
      .maybeSingle()
    projectLabel = String(project?.libelle_groupe || project?.code_groupe || projectCode).trim()
  }

  let structureLabel = structureCode
  if (structureCode) {
    const { data: structure } = await supabase
      .from('structures')
      .select('code_structure, libelle_structure')
      .eq('code_structure', structureCode)
      .maybeSingle()
    structureLabel = String(structure?.libelle_structure || structure?.code_structure || structureCode).trim()
  }

  const rejectorName = [rejectorUser?.prenoms, rejectorUser?.nom].filter(Boolean).join(' ').trim() || rejectorUsername || '-'
  const tpl = getActionRejectionEmailTemplate(responsibleUser, {
    libelle_action: actionData?.libelle_action || occurrence?.libelle_action || 'Action',
    commentaire: comment,
    rejector: rejectorUsername,
    rejectorName,
    code_groupe: projectLabel || projectCode || '-',
    code_structure: structureLabel || structureCode || '-',
  })
  const emailResult = await sendEmail({ to: responsibleUser.username, subject: tpl.subject, htmlContent: tpl.htmlContent, textContent: tpl.textContent })
  if (!emailResult?.success) {
    throw new Error(emailResult?.error || 'Echec envoi email rejet action')
  }
}


async function getActionOccurrenceUserContext(supabase, occurrence, username) {
  const normalizedUsername = String(username || '').trim().toLowerCase()
  if (!occurrence || !normalizedUsername) {
    return { canManageWorkflow: false, canUnlockAchieved: false }
  }

  const { data: actorUser } = await supabase
    .from('users')
    .select('username, type_utilisateur, structure')
    .eq('username', username)
    .maybeSingle()

  if (!actorUser?.username) {
    return { canManageWorkflow: false, canUnlockAchieved: false }
  }

  const isSuperAdmin = actorUser.type_utilisateur === 'Super admin'

  const { data: linkedAction } = await supabase
    .from('actions')
    .select('code_action, code_structure, code_groupe')
    .eq('code_action', occurrence?.code_action)
    .maybeSingle()

  let canManageWorkflow = isSuperAdmin
  if (!canManageWorkflow && linkedAction?.code_groupe) {
    const { data: project } = await supabase
      .from('projets')
      .select('gestionnaire, gestionnaires, createur')
      .eq('code_groupe', linkedAction.code_groupe)
      .maybeSingle()

    const projectManagers = new Set(
      [project?.gestionnaire, project?.createur]
        .concat(Array.isArray(project?.gestionnaires) ? project.gestionnaires : String(project?.gestionnaires || '').split(/[;,]/))
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
    )
    if (projectManagers.has(normalizedUsername)) canManageWorkflow = true
  }

  if (!canManageWorkflow) {
    const structureCode = String(linkedAction?.code_structure || occurrence?.code_structure || actorUser?.structure || '').trim()
    if (structureCode) {
      const { data: managedStructure } = await supabase
        .from('structures')
        .select('code_structure, responsable_structure')
        .eq('code_structure', structureCode)
        .eq('responsable_structure', actorUser.username)
        .maybeSingle()
      if (managedStructure?.code_structure) canManageWorkflow = true
    }
  }

  if (!canManageWorkflow && occurrence?.responsable) {
    const { data: responsibleUser } = await supabase
      .from('users')
      .select('username, superieur')
      .eq('username', occurrence.responsable)
      .maybeSingle()
    if (String(responsibleUser?.superieur || '').trim().toLowerCase() == normalizedUsername) {
      canManageWorkflow = true
    }
  }

  return {
    canManageWorkflow,
    canUnlockAchieved: canManageWorkflow,
  }
}

// PUT - Mettre à jour une occurrence d'action
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient(request)

    if (!body.id) {
      return NextResponse.json({ error: 'ID obligatoire' }, { status: 400 })
    }

    if (body.tx_avancement !== undefined) {
      const clamped = clampProgress(body.tx_avancement)
      if (Number.parseFloat(body.tx_avancement ?? 0) !== clamped) {
        return NextResponse.json({ error: "Le taux d'avancement doit être compris entre 0% et 100%" }, { status: 400 })
      }
      body.tx_avancement = clamped
    }

    // Récupérer l'ancienne occurrence pour comparer
    // NB: on inclut date_realisation si elle existe dans le schéma.
    // Si la colonne n'existe pas, Supabase renverra une erreur "column ... does not exist".
    // Dans ce cas, on relira sans cette colonne.
    let oldOccurrence = null
    {
      const { data, error } = await supabase
        .from('action_occurrences')
        .select('*')
        .eq('id', body.id)
        .maybeSingle()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      oldOccurrence = data || null
    }

    const actorContext = await getActionOccurrenceUserContext(supabase, oldOccurrence, body.modificateur)
    const achievedLocked = String(oldOccurrence?.validation_status || '').toLowerCase() === 'achevée' && String(oldOccurrence?.gestionnaire_conf || '').toLowerCase() === 'oui'

    // Une validation peut être envoyée deux fois côté UI si la fenêtre de confirmation
    // et l'alerte de succès se succèdent rapidement. Dans ce cas, l'occurrence est
    // déjà "Achevée" au moment du second PUT. On laisse passer uniquement cette
    // requête de validation idempotente pour éviter l'erreur parasite affichée après
    // le succès, tout en conservant le verrouillage des modifications ordinaires.
    const isApproveDecisionRequest = body.validation_decision === 'approve' && body.gestionnaire_conf === 'Oui'
    const isUnlockRequest = achievedLocked && body.gestionnaire_conf === null && body.validation_decision === undefined && body.tx_avancement === undefined && body.commentaire === undefined && body.date_realisation === undefined && body.responsable === undefined && body.date_debut === undefined && body.date_fin === undefined
    const isIdempotentApproveRequest = achievedLocked && isApproveDecisionRequest && body.tx_avancement === undefined && body.responsable === undefined && body.date_debut === undefined && body.date_fin === undefined

    if (achievedLocked && !actorContext.canUnlockAchieved && !isUnlockRequest && !isIdempotentApproveRequest) {
      return NextResponse.json({ error: "Cette action est en statut Achevée. Seul un gestionnaire ou un super administrateur peut retirer ce statut pour autoriser à nouveau les modifications." }, { status: 403 })
    }

    if (achievedLocked && actorContext.canUnlockAchieved && !isUnlockRequest && !isIdempotentApproveRequest) {
      return NextResponse.json({ error: "Cette action est en statut Achevée. Retirez d'abord ce statut avant de modifier le taux, les commentaires ou les autres informations." }, { status: 400 })
    }

    const mergedDateDebut = body.date_debut ?? oldOccurrence?.date_debut
    const mergedDateFin = body.date_fin ?? oldOccurrence?.date_fin
    const dateError = validateOccurrenceDates(mergedDateDebut, mergedDateFin)
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 })
    }

    if ((body.date_debut !== undefined || body.date_fin !== undefined) && oldOccurrence?.code_action) {
      const overlap = await findOverlappingOccurrence(supabase, oldOccurrence.code_action, mergedDateDebut, mergedDateFin, body.id)
      if (overlap) {
        return NextResponse.json({ error: "Cette période chevauche une occurrence existante de la même action" }, { status: 400 })
      }
    }

    const updateData = {
      date_debut: mergedDateDebut,
      date_fin: mergedDateFin,
      responsable: body.responsable,
      modificateur: body.modificateur,
      date_modification: new Date().toISOString()
    }

    const workflowHistory = parseJsonArray(oldOccurrence?.validation_history)
    const previousTx = parseFloat(oldOccurrence?.tx_avancement ?? 0) || 0
    const nextTx = body.tx_avancement !== undefined ? (parseFloat(body.tx_avancement) || 0) : previousTx
    const isRejectAction = body.validation_decision === 'reject'
    const isApproveAction = body.validation_decision === 'approve'
    const isWorkflowDecision = isRejectAction || isApproveAction
    const isResponsibleActor = oldOccurrence?.responsable === body.modificateur
    const hasOutstandingRejection = String(oldOccurrence?.validation_status || '').toLowerCase() === 'rejetee' || !!String(oldOccurrence?.last_rejection_comment || '').trim()
    const isReplyRequired = !isWorkflowDecision && hasOutstandingRejection && nextTx >= 100
    const isPendingResponsibleCommentEdit = !isWorkflowDecision && isResponsibleActor && nextTx >= 100 && String(oldOccurrence?.validation_status || '').toLowerCase() === 'terminée - non confirmée'

    if (isRejectAction && !String(body.validation_comment || '').trim()) {
      return NextResponse.json({ error: 'Le commentaire de rejet est obligatoire' }, { status: 400 })
    }
    if (isReplyRequired && !String(body.commentaire || '').trim()) {
      return NextResponse.json({ error: "Vous devez répondre au commentaire du gestionnaire avant de resoumettre l'action à 100%" }, { status: 400 })
    }

    if (body.commentaire !== undefined) {
      updateData.commentaire = body.commentaire
    }

    const effectiveTx = body.tx_avancement !== undefined ? (parseFloat(body.tx_avancement) || 0) : (parseFloat(oldOccurrence?.tx_avancement) || 0)
    const defaultRealisationDate = oldOccurrence?.date_realisation_auto || oldOccurrence?.date_realisation || new Date().toISOString().split('T')[0]
    const requestedRealisationDate = body.date_realisation === '' ? null : (body.date_realisation || undefined)

    // Ne mettre à jour tx_avancement que si fourni
    if (body.tx_avancement !== undefined) {
      updateData.tx_avancement = body.tx_avancement
    }

    // Gestion de la date réelle / automatique de réalisation
    if (body.tx_avancement !== undefined || body.date_realisation !== undefined || body.gestionnaire_conf !== undefined) {
      if (effectiveTx < 100) {
        if (body.tx_avancement !== undefined && effectiveTx < 100) {
          updateData.date_realisation = null
        }
      } else {
        if (!oldOccurrence?.date_realisation_auto) {
          updateData.date_realisation_auto = defaultRealisationDate
        }
        updateData.date_realisation = requestedRealisationDate || oldOccurrence?.date_realisation || defaultRealisationDate
      }
    }

    // Gérer la confirmation gestionnaire
    if (body.gestionnaire_conf !== undefined) {
      updateData.gestionnaire_conf = body.gestionnaire_conf
      if (body.gestionnaire_conf === 'Oui') {
        updateData.date_conf = body.date_conf || new Date().toISOString().split('T')[0]
        updateData.validation_status = 'Achevée'
      } else {
        updateData.date_conf = null
        if (String(oldOccurrence?.validation_status || '').toLowerCase() === 'achevée') {
          updateData.validation_status = nextTx >= 100 ? 'Terminée - non confirmée' : (nextTx > 50 ? 'En cours +50%' : nextTx > 0 ? 'En cours -50%' : 'Non entamée')
        }
      }
    }


    if (nextTx >= 100 && !isApproveAction && !isRejectAction && body.gestionnaire_conf !== 'Oui') {
      updateData.validation_status = 'Terminée - non confirmée'
    }

    if (isApproveAction) {
      updateData.gestionnaire_conf = 'Oui'
      updateData.date_conf = body.date_conf || new Date().toISOString().split('T')[0]
      updateData.validation_status = 'Achevée'
      updateData.last_rejection_comment = null
      updateData.last_rejected_by = null
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'validation',
        comment: body.validation_comment || body.commentaire || '',
        previous_value: previousTx,
        new_value: nextTx,
      }))
    }

    if (isRejectAction) {
      updateData.tx_avancement = 0
      updateData.gestionnaire_conf = null
      updateData.date_conf = null
      updateData.date_realisation = null
      updateData.validation_status = 'Rejetée'
      updateData.last_rejection_comment = body.validation_comment
      updateData.last_rejected_by = body.modificateur || null
      updateData.commentaire = ''
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'rejet',
        comment: body.validation_comment,
        previous_value: previousTx,
        new_value: 0,
      }))
    } else if (isReplyRequired) {
      updateData.validation_status = 'Terminée - non confirmée'
      updateData.last_rejection_comment = null
      updateData.last_rejected_by = null
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'reponse_responsable',
        comment: body.commentaire,
        previous_value: previousTx,
        new_value: nextTx,
      }))
    } else if (isPendingResponsibleCommentEdit && body.commentaire !== undefined && String(body.commentaire || '').trim()) {
      const lastIndex = workflowHistory.length - 1
      const lastEntry = lastIndex >= 0 ? workflowHistory[lastIndex] : null
      if (lastEntry && lastEntry.actor === body.modificateur && ['reponse_responsable', 'commentaire'].includes(String(lastEntry.decision || ''))) {
        workflowHistory[lastIndex] = updateWorkflowEntryComment(lastEntry, body.commentaire, previousTx, nextTx)
      } else {
        workflowHistory.push(buildWorkflowEntry({
          actor: body.modificateur,
          decision: 'reponse_responsable',
          comment: body.commentaire,
          previous_value: previousTx,
          new_value: nextTx,
        }))
      }
    } else if (body.commentaire !== undefined && String(body.commentaire || '').trim()) {
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: nextTx >= 100 ? 'commentaire' : 'mise_a_jour',
        comment: body.commentaire,
        previous_value: previousTx,
        new_value: nextTx,
      }))
    }

    updateData.validation_history = stringifyJsonArray(workflowHistory)

    // Update tolérant: si la colonne date_realisation n'existe pas, on retente sans.
    let data = null
    {
      const { data: d1, error } = await supabase
        .from('action_occurrences')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single()
      if (error && (error.message || '').toLowerCase().includes('date_realisation')) {
        const { date_realisation, date_realisation_auto, ...fallback } = updateData
        const { data: d2, error: e2 } = await supabase
          .from('action_occurrences')
          .update(fallback)
          .eq('id', body.id)
          .select()
          .single()
        if (e2) {
          console.error('Erreur update occurrence:', e2)
          return NextResponse.json({ error: e2.message }, { status: 500 })
        }
        data = d2
      } else if (error) {
        console.error('Erreur update occurrence:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        data = d1
      }
    }


    if (isRejectAction) {
      try {
        const occurrenceCode = parseInt(data?.code_occurrence || oldOccurrence?.code_occurrence || body.code_occurrence || 0)
        if (occurrenceCode) {
          const { error: tasksResetError } = await supabase
            .from('taches')
            .update({
              tx_avancement: 0,
              modificateur: body.modificateur,
              date_modification: new Date().toISOString()
            })
            .eq('code_occurrence', occurrenceCode)
          if (tasksResetError) {
            console.error('[WORKFLOW] Erreur remise à 0 des tâches après rejet:', tasksResetError)
            return NextResponse.json({ error: tasksResetError.message }, { status: 500 })
          }
        }
      } catch (taskResetException) {
        console.error('[WORKFLOW] Exception remise à 0 des tâches après rejet:', taskResetException)
        return NextResponse.json({ error: taskResetException.message || 'Erreur lors de la remise à 0 des tâches' }, { status: 500 })
      }
    }

    if (isRejectAction) {
      try {
        await sendActionRejectedEmail(supabase, data || oldOccurrence, body.validation_comment, body.modificateur)
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email rejet action:', emailError)
        return NextResponse.json({ error: `Le rejet a été enregistré mais l'email automatique au responsable n'a pas pu être envoyé : ${emailError.message || 'Erreur email'}` }, { status: 500 })
      }
    }

    // Si le responsable a changé, envoyer un email au nouveau responsable
    if (body.responsable && oldOccurrence && body.responsable !== oldOccurrence.responsable) {
      try {
        const { data: responsableUser } = await supabase
          .from('users')
          .select('username, prenoms, nom')
          .eq('username', body.responsable)
          .single()

        const { data: actionData } = await supabase
          .from('actions')
          .select('libelle_action, code_groupe, code_structure')
          .eq('code_action', oldOccurrence.code_action)
          .single()

        // Récupérer les infos de l'assignateur (modificateur)
        let assignateur = null
        if (body.modificateur) {
          const { data: modifUser } = await supabase
            .from('users')
            .select('username, prenoms, nom')
            .eq('username', body.modificateur)
            .single()
          assignateur = modifUser
        }

        if (responsableUser && actionData) {
          const emailTemplate = getActionAssignmentEmailTemplate(responsableUser, {
            libelle_action: actionData.libelle_action,
            code_groupe: actionData.code_groupe,
            code_structure: actionData.code_structure,
            date_debut: body.date_debut || data.date_debut,
            date_fin: body.date_fin || data.date_fin
          }, assignateur)

          await sendEmail({
            to: responsableUser.username,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
          })

          console.log(`[EMAIL] Email d'attribution d'action envoyé au nouveau responsable ${responsableUser.username}`)
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email changement responsable action:', emailError)
      }
    }

    // Si l'action atteint 100% et n'était pas à 100% avant, et pas encore confirmée
    // Envoyer un email à tous les gestionnaires
    const newTx = body.tx_avancement !== undefined ? body.tx_avancement : data.tx_avancement
    const oldTx = oldOccurrence?.tx_avancement || 0
    const wasNotConfirmed = oldOccurrence?.gestionnaire_conf !== 'Oui'
    
    if (newTx >= 100 && oldTx < 100 && wasNotConfirmed) {
      try {
        // Récupérer les infos de l'action
        const { data: actionData } = await supabase
          .from('actions')
          .select('libelle_action, code_groupe, code_structure')
          .eq('code_action', oldOccurrence.code_action)
          .single()

        if (actionData) {
          // Récupérer tous les gestionnaires (type_utilisateur = 'Gestionnaire')
          const { data: gestionnaires } = await supabase
            .from('users')
            .select('username, prenoms, nom')
            .eq('type_utilisateur', 'Gestionnaire')

          if (gestionnaires && gestionnaires.length > 0) {
            // Importer le template
            const { getActionPendingConfirmationEmailTemplate } = await import('@/lib/email')
            
            for (const gestionnaire of gestionnaires) {
              const emailTemplate = getActionPendingConfirmationEmailTemplate(gestionnaire, {
                libelle_action: actionData.libelle_action,
                code_groupe: actionData.code_groupe,
                responsable: body.responsable || data.responsable,
                date_fin: body.date_fin || data.date_fin
              })

              await sendEmail({
                to: gestionnaire.username,
                subject: emailTemplate.subject,
                htmlContent: emailTemplate.htmlContent,
                textContent: emailTemplate.textContent
              })

              console.log(`[EMAIL] Email de confirmation envoyé au gestionnaire ${gestionnaire.username}`)
            }
          }
        }
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email aux gestionnaires:', emailError)
      }
    }

    return NextResponse.json({ occurrence: data, message: 'Occurrence mise à jour' })
  } catch (error) {
    console.error('Erreur PUT action_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur' }, { status: 500 })
  }
}

// DELETE - Supprimer une occurrence d'action
export async function DELETE(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient(request)

    if (!body.id) {
      return NextResponse.json({ error: 'ID obligatoire' }, { status: 400 })
    }

    // Supprimer d'abord les tâches liées
    const { data: occurrence } = await supabase
      .from('action_occurrences')
      .select('code_occurrence')
      .eq('id', body.id)
      .single()

    if (occurrence) {
      await supabase
        .from('taches')
        .delete()
        .eq('code_occurrence', occurrence.code_occurrence)
    }

    // Supprimer l'occurrence
    const { error } = await supabase
      .from('action_occurrences')
      .delete()
      .eq('id', body.id)

    if (error) {
      console.error('Erreur delete occurrence:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Occurrence supprimée' })
  } catch (error) {
    console.error('Erreur DELETE action_occurrences:', error)
    return NextResponse.json({ error: error.message || 'Erreur' }, { status: 500 })
  }
}
