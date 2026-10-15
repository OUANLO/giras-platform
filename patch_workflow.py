from pathlib import Path
import re

root = Path('/tmp/giras')

# 1) access-scope helpers
p = root/'src/lib/access-scope.js'
text = p.read_text()
if 'isStructureResponsible' not in text:
    text = text.replace("export const isDirectSuperior = (user, targetUsername, users = []) => {\n", "export const isDirectSuperior = (user, targetUsername, users = []) => {\n")
    insert = """
export const isStructureResponsible = (user, structureCode, structures = []) => {
  const currentUsername = normalizeUsername(user?.username)
  const currentStructure = normalizeStructure(structureCode)
  if (!currentUsername || !currentStructure) return false
  return (structures || []).some((item) => {
    const structure = normalizeStructure(item?.code_structure || item?.structure)
    const responsable = normalizeUsername(item?.responsable_structure)
    return structure && structure === currentStructure && responsable && responsable === currentUsername
  })
}

"""
    text = text.replace("export const canAccessRisk = (user, risk) => {\n", insert + "export const canAccessRisk = (user, risk) => {\n")

text = text.replace(
"export const canAccessAction = (user, action, users = [], occurrences = []) => {",
"export const canAccessAction = (user, action, users = [], occurrences = [], structures = []) => {")
text = text.replace(
"  if (responsibles.includes(currentUsername)) return true\n  return responsibles.some((responsable) => isDirectSuperior(user, responsable, users))\n}",
"  if (responsibles.includes(currentUsername)) return true\n  const actionStructure = normalizeStructure(action?.code_structure || action?.structure)\n  if (isStructureResponsible(user, actionStructure, structures)) return true\n  return responsibles.some((responsable) => isDirectSuperior(user, responsable, users))\n}")
text = text.replace(
"export const canAccessActionOccurrence = (user, occurrence, users = [], actions = []) => {",
"export const canAccessActionOccurrence = (user, occurrence, users = [], actions = [], structures = []) => {")
text = text.replace(
"  if (responsable && responsable === currentUsername) return true\n  if (responsable && isDirectSuperior(user, responsable, users)) return true\n",
"  if (responsable && responsable === currentUsername) return true\n  if (responsable && isDirectSuperior(user, responsable, users)) return true\n  const occurrenceStructure = normalizeStructure(occurrence?.code_structure || occurrence?.structure)\n  if (isStructureResponsible(user, occurrenceStructure, structures)) return true\n")
text = text.replace(
"  return canAccessAction(user, linkedAction, users, [occurrence])\n}",
"  return canAccessAction(user, linkedAction, users, [occurrence], structures)\n}")
p.write_text(text)

# 2) email templates
p = root/'src/lib/email.js'
text = p.read_text()
if 'getActionRejectionEmailTemplate' not in text:
    add = """
export function getActionRejectionEmailTemplate(user, payload = {}) {
  const rejector = escapeHtml(payload.rejectorName || payload.rejector || '-')
  const actionLabel = escapeHtml(payload.libelle_action || '-')
  const comment = escapeHtml(payload.commentaire || '-')
  const responseUrl = escapeHtml(process.env.NEXT_PUBLIC_APP_URL || '')
  const subject = `Action rejetée - ${payload.libelle_action || 'Action'}`
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <h2 style="color:#991b1b;">Bonjour ${escapeHtml(user?.prenoms || user?.nom || '')},</h2>
      <p>Votre action <strong>${actionLabel}</strong> renseignée à <strong>100%</strong> a été rejetée par <strong>${rejector}</strong>.</p>
      <p><strong>Commentaire du gestionnaire :</strong></p>
      <div style="background:#fff1f2;border:1px solid #fecdd3;padding:12px;border-radius:8px;white-space:pre-wrap;">${comment}</div>
      <p style="margin-top:12px;">Le taux d'avancement a été réinitialisé à <strong>0%</strong>. Merci de reprendre l'action, puis de saisir à nouveau 100% en répondant obligatoirement au commentaire.</p>
      ${responseUrl ? `<p><a href="${responseUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Accéder à GIRAS</a></p>` : ''}
    </div>`
  const textContent = `Bonjour ${user?.prenoms || user?.nom || ''},\n\nVotre action \"${payload.libelle_action || '-'}\" renseignée à 100% a été rejetée par ${payload.rejectorName || payload.rejector || '-'}.\n\nCommentaire du gestionnaire :\n${payload.commentaire || '-'}\n\nLe taux d'avancement a été réinitialisé à 0%. Merci de reprendre l'action puis de répondre au commentaire dans GIRAS.`
  return { subject, htmlContent, textContent }
}

export function getIndicatorRejectionEmailTemplate(user, payload = {}) {
  const rejector = escapeHtml(payload.rejectorName || payload.rejector || '-')
  const indicatorLabel = escapeHtml(payload.libelle_indicateur || '-')
  const comment = escapeHtml(payload.commentaire || '-')
  const rejectedValue = escapeHtml(payload.valeur_rejetee == null ? '-' : String(payload.valeur_rejetee))
  const responseUrl = escapeHtml(process.env.NEXT_PUBLIC_APP_URL || '')
  const subject = `Valeur d'indicateur rejetée - ${payload.libelle_indicateur || 'Indicateur'}`
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <h2 style="color:#991b1b;">Bonjour ${escapeHtml(user?.prenoms || user?.nom || '')},</h2>
      <p>La valeur saisie pour l'indicateur <strong>${indicatorLabel}</strong> a été rejetée par <strong>${rejector}</strong>.</p>
      <p><strong>Valeur rejetée :</strong> ${rejectedValue}</p>
      <p><strong>Commentaire du gestionnaire :</strong></p>
      <div style="background:#fff1f2;border:1px solid #fecdd3;padding:12px;border-radius:8px;white-space:pre-wrap;">${comment}</div>
      <p style="margin-top:12px;">La valeur de l'occurrence a été vidée. Merci de ressaisir une valeur et de répondre obligatoirement au commentaire dans GIRAS.</p>
      ${responseUrl ? `<p><a href="${responseUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Accéder à GIRAS</a></p>` : ''}
    </div>`
  const textContent = `Bonjour ${user?.prenoms || user?.nom || ''},\n\nLa valeur saisie pour l'indicateur \"${payload.libelle_indicateur || '-'}\" a été rejetée par ${payload.rejectorName || payload.rejector || '-'}.\nValeur rejetée : ${payload.valeur_rejetee == null ? '-' : payload.valeur_rejetee}\n\nCommentaire du gestionnaire :\n${payload.commentaire || '-'}\n\nLa valeur de l'occurrence a été vidée. Merci de ressaisir une valeur et de répondre dans GIRAS.`
  return { subject, htmlContent, textContent }
}

"""
    text = text + "\n" + add
p.write_text(text)

# 3) actions API route: replace imports and add helpers before PUT
p = root/'src/app/api/actions/occurrences/route.js'
text = p.read_text()
text = text.replace("import { sendEmail, getActionAssignmentEmailTemplate } from '@/lib/email'\n", "import { sendEmail, getActionAssignmentEmailTemplate, getActionRejectionEmailTemplate } from '@/lib/email'\n")
if 'const parseJsonArray = (value)' not in text:
    helper = """
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
  const { data: actionData } = await supabase.from('actions').select('libelle_action').eq('code_action', occurrence?.code_action).maybeSingle()
  const { data: responsibleUser } = await supabase.from('users').select('username, nom, prenoms').eq('username', occurrence?.responsable).maybeSingle()
  const { data: rejectorUser } = await supabase.from('users').select('username, nom, prenoms').eq('username', rejectorUsername).maybeSingle()
  if (!responsibleUser?.username) return
  const rejectorName = [rejectorUser?.prenoms, rejectorUser?.nom].filter(Boolean).join(' ').trim() || rejectorUsername || '-'
  const tpl = getActionRejectionEmailTemplate(responsibleUser, {
    libelle_action: actionData?.libelle_action || occurrence?.libelle_action || 'Action',
    commentaire: comment,
    rejector: rejectorUsername,
    rejectorName,
  })
  await sendEmail({ to: responsibleUser.username, subject: tpl.subject, htmlContent: tpl.htmlContent, textContent: tpl.textContent })
}

"""
    text = text.replace("// PUT - Mettre à jour une occurrence d'action\n", helper + "\n// PUT - Mettre à jour une occurrence d'action\n")

# select old occurrence as *
text = re.sub(r"let oldOccurrence = null\n    \{\n      const \{ data, error \} = await supabase\n        \.from\('action_occurrences'\)\n        \.select\('responsable, code_action, tx_avancement, gestionnaire_conf, date_realisation, date_realisation_auto, commentaire'\)\n        \.eq\('id', body.id\)\n        \.maybeSingle\(\)\n      if \(error && \(error.message \|\| ''\)\.toLowerCase\(\)\.includes\('date_realisation'\)\) \{\n        const \{ data: d2 \} = await supabase\n          \.from\('action_occurrences'\)\n          \.select\('responsable, code_action, tx_avancement, gestionnaire_conf, commentaire'\)\n          \.eq\('id', body.id\)\n          \.maybeSingle\(\)\n        oldOccurrence = d2 \|\| null\n      \} else \{\n        oldOccurrence = data \|\| null\n      \}\n    \}", "let oldOccurrence = null\n    {\n      const { data, error } = await supabase\n        .from('action_occurrences')\n        .select('*')\n        .eq('id', body.id)\n        .maybeSingle()\n      if (error) {\n        return NextResponse.json({ error: error.message }, { status: 500 })\n      }\n      oldOccurrence = data || null\n    }", text)

# inject workflow logic after updateData creation
needle = "    const updateData = {\n      date_debut: mergedDateDebut,\n      date_fin: mergedDateFin,\n      responsable: body.responsable,\n      modificateur: body.modificateur,\n      date_modification: new Date().toISOString()\n    }\n"
replace = needle + "\n    const workflowHistory = parseJsonArray(oldOccurrence?.validation_history)\n    const previousTx = parseFloat(oldOccurrence?.tx_avancement ?? 0) || 0\n    const nextTx = body.tx_avancement !== undefined ? (parseFloat(body.tx_avancement) || 0) : previousTx\n    const isRejectAction = body.validation_decision === 'reject'\n    const isApproveAction = body.validation_decision === 'approve'\n    const isReplyRequired = String(oldOccurrence?.validation_status || '').toLowerCase() === 'rejetee' && nextTx >= 100 && oldOccurrence?.responsable === body.modificateur\n\n    if (isRejectAction && !String(body.validation_comment || '').trim()) {\n      return NextResponse.json({ error: 'Le commentaire de rejet est obligatoire' }, { status: 400 })\n    }\n    if (isReplyRequired && !String(body.commentaire || '').trim()) {\n      return NextResponse.json({ error: 'Vous devez répondre au commentaire du gestionnaire avant de resoumettre l\'action à 100%' }, { status: 400 })\n    }\n"
text = text.replace(needle, replace)

# set comment update and workflow statuses before update
insert_before = "    // Update tolérant: si la colonne date_realisation n'existe pas, on retente sans.\n"
logic = """
    if (nextTx >= 100 && !isApproveAction && !isRejectAction) {
      updateData.validation_status = 'Terminée - non confirmée'
    }

    if (isApproveAction) {
      updateData.gestionnaire_conf = 'Oui'
      updateData.date_conf = body.date_conf || new Date().toISOString().split('T')[0]
      updateData.validation_status = 'Achevée'
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
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'rejet',
        comment: body.validation_comment,
        previous_value: previousTx,
        new_value: 0,
      }))
    } else if (isReplyRequired) {
      updateData.validation_status = 'Terminée - non confirmée'
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'reponse_responsable',
        comment: body.commentaire,
        previous_value: previousTx,
        new_value: nextTx,
      }))
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

"""
text = text.replace(insert_before, logic + insert_before)

# simplify fallback removal no commentaire
text = text.replace("const { date_realisation, date_realisation_auto, commentaire, ...fallback } = updateData", "const { date_realisation, date_realisation_auto, ...fallback } = updateData")

# add rejection email after update before responsible change email block
marker = "    // Si le responsable a changé, envoyer un email au nouveau responsable\n"
addition = """
    if (isRejectAction) {
      try {
        await sendActionRejectedEmail(supabase, data || oldOccurrence, body.validation_comment, body.modificateur)
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email rejet action:', emailError)
      }
    }

"""
text = text.replace(marker, addition + marker)
p.write_text(text)

# 4) indicators API route
p = root/'src/app/api/indicateurs/occurrences/route.js'
text = p.read_text()
text = text.replace("import { sendEmail, getIndicatorOccurrenceEmailTemplate } from '@/lib/email'", "import { sendEmail, getIndicatorOccurrenceEmailTemplate, getIndicatorRejectionEmailTemplate } from '@/lib/email'")
if 'const parseJsonArray = (value)' not in text:
    helper = """
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

const buildWorkflowEntry = ({ actor, decision, comment, previous_value = null, new_value = null, metadata = {} }) => ({
  id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  created_at: new Date().toISOString(),
  actor: actor || null,
  decision,
  comment: comment || '',
  previous_value,
  new_value,
  metadata
})

async function sendIndicatorRejectedEmail(supabase, occurrence, comment, rejectorUsername, rejectedValue) {
  const { data: indicatorData } = await supabase.from('indicateurs').select('libelle_indicateur').eq('code_indicateur', occurrence?.code_indicateur).maybeSingle()
  const { data: responsibleUser } = await supabase.from('users').select('username, nom, prenoms').eq('username', occurrence?.responsable).maybeSingle()
  const { data: rejectorUser } = await supabase.from('users').select('username, nom, prenoms').eq('username', rejectorUsername).maybeSingle()
  if (!responsibleUser?.username) return
  const rejectorName = [rejectorUser?.prenoms, rejectorUser?.nom].filter(Boolean).join(' ').trim() || rejectorUsername || '-'
  const tpl = getIndicatorRejectionEmailTemplate(responsibleUser, {
    libelle_indicateur: indicatorData?.libelle_indicateur || 'Indicateur',
    commentaire: comment,
    rejector: rejectorUsername,
    rejectorName,
    valeur_rejetee: rejectedValue,
  })
  await sendEmail({ to: responsibleUser.username, subject: tpl.subject, htmlContent: tpl.htmlContent, textContent: tpl.textContent })
}

"""
    text = text.replace("// Fonction helper pour envoyer email au responsable d'un indicateur\n", helper + "// Fonction helper pour envoyer email au responsable d'un indicateur\n")

# create post validation_status defaults
text = text.replace("        nb_jr_retard: nb_jr_retard,\n        statut: statut\n", "        nb_jr_retard: nb_jr_retard,\n        statut: statut,\n        validation_status: body.val_indicateur != null ? 'Attente de validation' : 'Non renseigné',\n        validation_history: stringifyJsonArray([])\n")

# put logic inject after existing fetch
needle = "    // Déterminer date_saisie : si val_indicateur est maintenant renseigné et ne l'était pas avant\n"
insert = """
    const workflowHistory = parseJsonArray(existing?.validation_history)
    const previousValue = existing?.val_indicateur
    const nextValue = body.val_indicateur != null ? body.val_indicateur : existing?.val_indicateur
    const isRejectAction = body.validation_decision === 'reject'
    const isApproveAction = body.validation_decision === 'approve'
    const isReplyRequired = String(existing?.validation_status || '').toLowerCase() === 'rejetee' && body.modificateur === existing?.responsable && body.val_indicateur != null
    if (isRejectAction && !String(body.validation_comment || '').trim()) {
      return NextResponse.json({ error: 'Le commentaire de rejet est obligatoire' }, { status: 400 })
    }
    if (isReplyRequired && !String(body.commentaire || '').trim()) {
      return NextResponse.json({ error: 'Vous devez répondre au commentaire du gestionnaire avant la nouvelle soumission' }, { status: 400 })
    }

"""
text = text.replace(needle, insert + needle)

text = text.replace("      statut: body.statut,\n      commentaire: body.commentaire || null,\n", "      statut: body.statut,\n      commentaire: body.commentaire || null,\n      validation_status: body.validation_status || existing?.validation_status || null,\n")

marker = "    // Mise à jour\n"
logic = """
    if (body.val_indicateur != null && !isApproveAction && !isRejectAction) {
      updateData.validation_status = 'Attente de validation'
    }

    if (isApproveAction) {
      updateData.validation_status = 'Validé'
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'validation',
        comment: body.validation_comment || body.commentaire || '',
        previous_value: previousValue,
        new_value: nextValue,
      }))
    }

    if (isRejectAction) {
      updateData.validation_status = 'Rejetée'
      updateData.rejected_value = previousValue
      updateData.last_rejection_comment = body.validation_comment
      updateData.last_rejected_by = body.modificateur || null
      updateData.val_numerateur = null
      updateData.val_denominateur = null
      updateData.val_indicateur = null
      updateData.date_saisie = null
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'rejet',
        comment: body.validation_comment,
        previous_value: previousValue,
        new_value: null,
        metadata: { rejected_value: previousValue },
      }))
    } else if (isReplyRequired) {
      updateData.validation_status = 'Attente de validation'
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'reponse_responsable',
        comment: body.commentaire,
        previous_value: previousValue,
        new_value: nextValue,
      }))
    } else if (body.commentaire !== undefined && String(body.commentaire || '').trim()) {
      workflowHistory.push(buildWorkflowEntry({
        actor: body.modificateur,
        decision: 'commentaire',
        comment: body.commentaire,
        previous_value: previousValue,
        new_value: nextValue,
      }))
    }
    updateData.validation_history = stringifyJsonArray(workflowHistory)

"""
text = text.replace(marker, logic + marker)

# add email after update
marker = "    return NextResponse.json({ occurrence: data, message: 'Occurrence mise à jour' })\n"
addition = """
    if (isRejectAction) {
      try {
        await sendIndicatorRejectedEmail(supabase, data || existing, body.validation_comment, body.modificateur, previousValue)
      } catch (emailError) {
        console.error('[EMAIL] Erreur envoi email rejet indicateur:', emailError)
      }
    }

"""
text = text.replace(marker, addition + marker)
p.write_text(text)

# 5) actions page
p = root/'src/app/dashboard/activites/page.js'
text = p.read_text()
text = text.replace("import { canAccessAction, canAccessActionOccurrence, isPrivilegedUser, isSuperManagerUser } from '@/lib/access-scope'", "import { canAccessAction, canAccessActionOccurrence, isPrivilegedUser, isSuperManagerUser, isStructureResponsible } from '@/lib/access-scope'")
text = text.replace("  const [confirmationForm, setConfirmationForm] = useState({ date_realisation: '' })\n", "  const [confirmationForm, setConfirmationForm] = useState({ date_realisation: '', rejection_comment: '', validation_comment: '' })\n")
if 'const getOccurrenceHistory = (occ)' not in text:
    insertion = """
  const normalizeUsernameValue = (value) => String(value || '').trim().toLowerCase()
  const isDirectSuperiorOf = (targetUsername) => {
    const currentUsername = normalizeUsernameValue(user?.username)
    const target = users.find((item) => normalizeUsernameValue(item?.username) === normalizeUsernameValue(targetUsername))
    return !!currentUsername && !!target && normalizeUsernameValue(target?.superieur) === currentUsername
  }
  const isStructureManagerForCode = (structureCode) => isStructureResponsible(user, structureCode, structures)
  const canManageOccurrenceWorkflow = (occ) => {
    if (!occ) return false
    if (user?.type_utilisateur === 'Super admin' || user?.type_utilisateur === 'Gestionnaire') return true
    const action = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(occ?.code_action || occ?.code_action_occ || occ?.__actionCode))
    const structureCode = action?.code_structure || occ?.code_structure || user?.structure
    return isStructureManagerForCode(structureCode) || isDirectSuperiorOf(occ?.responsable)
  }
  const getOccurrenceHistory = (occ) => {
    if (!occ?.validation_history) return []
    try { const parsed = JSON.parse(occ.validation_history); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
  }
  const requiresResponsibleReply = (occ, nextTx) => String(occ?.validation_status || '').toLowerCase() === 'rejetee' && Number(nextTx || 0) >= 100 && occ?.responsable === user?.username

"""
    text = text.replace("  const getProjectCodeForAction = (a) => getProjectForAction(a)?.code_groupe || (isLegacyRiskAction(a) ? 'RISQUES' : a?.code_groupe)\n", insertion + "  const getProjectCodeForAction = (a) => getProjectForAction(a)?.code_groupe || (isLegacyRiskAction(a) ? 'RISQUES' : a?.code_groupe)\n")

text = text.replace("    return actions.some((action) => !action?.archive && getProjectCodeForAction(action) === projectCode && canAccessAction(user, action, users, occurrences))", "    return actions.some((action) => !action?.archive && getProjectCodeForAction(action) === projectCode && canAccessAction(user, action, users, occurrences, structures))")
text = text.replace("    return canAccessAction(user, a, users, occurrences)", "    return canAccessAction(user, a, users, occurrences, structures)")
text = text.replace("    return canAccessActionOccurrence(user, o, users, actions)", "    return canAccessActionOccurrence(user, o, users, actions, structures)")
text = text.replace("  const canEditTxAvancement = (o) => canEditOccurrence(o) || isResponsableOccurrence(o)", "  const canEditTxAvancement = (o) => canEditOccurrence(o) || isResponsableOccurrence(o) || canManageOccurrenceWorkflow(o)")

# patch handleSaveOccurrence validation
text = text.replace("  const handleSaveOccurrence = async () => {\n", "  const handleSaveOccurrence = async () => {\n    const nextTx = hasOccurrenceTaches(selectedOccurrence) ? getTxAvancementForOccurrence(selectedOccurrence) : (parseFloat(occurrenceForm.tx_avancement) || 0)\n    if (selectedOccurrence && requiresResponsibleReply(selectedOccurrence, nextTx) && !String(occurrenceForm.commentaire || '').trim()) {\n      showAlert('error', 'Vous devez répondre au commentaire du gestionnaire avant de resoumettre l\'action à 100%')\n      return\n    }\n")

# confirm function replace
text = re.sub(r"  const handleConfirmOccurrenceCompletion = async \(\) => \{.*?\n  \}\n\n  // ============ HANDLERS TACHES ============", """  const handleConfirmOccurrenceCompletion = async (decision = 'approve') => {
    if (!selectedOccurrence) return
    if (decision === 'reject' && !String(confirmationForm.rejection_comment || '').trim()) {
      showAlert('error', 'Le commentaire de rejet est obligatoire')
      return
    }
    try {
      const body = {
        id: selectedOccurrence.id,
        validation_decision: decision,
        validation_comment: decision === 'reject' ? confirmationForm.rejection_comment : confirmationForm.validation_comment,
        gestionnaire_conf: decision === 'approve' ? 'Oui' : null,
        date_conf: decision === 'approve' ? new Date().toISOString().split('T')[0] : null,
        date_realisation: decision === 'approve' ? (confirmationForm.date_realisation || selectedOccurrence.date_realisation || selectedOccurrence.date_realisation_auto || new Date().toISOString().split('T')[0]) : null,
        modificateur: user?.username
      }
      const r = await fetch('/api/actions/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        setShowConfirmationModal(false)
        setConfirmationForm({ date_realisation: '', rejection_comment: '', validation_comment: '' })
        fetchOccurrences()
        showAlert('success', decision === 'approve' ? 'Achèvement confirmé' : 'Action rejetée avec succès')
      } else {
        const err = await r.json().catch(() => ({}))
        showAlert('error', err.error || 'Erreur')
      }
    } catch {
      showAlert('error', 'Erreur de connexion')
    }
  }

  // ============ HANDLERS TACHES ============""", text, flags=re.S)

# open confirmation modal init comment fields maybe locate button open? search handle maybe not. just when setting show modal no default maybe okay. ensure selectedOccurrence when opening maybe set state elsewhere impossible. Good enough.

# add history UI block in occurrence modal
old = "          <div><label className=\"block text-sm font-medium mb-1\">Commentaire</label><textarea value={occurrenceForm.commentaire || ''} onChange={e => setOccurrenceForm({...occurrenceForm, commentaire: e.target.value})} className=\"w-full px-3 py-2 rounded-lg border text-sm\" rows={2} disabled={selectedOccurrence && !canEditTxAvancement(selectedOccurrence)} /></div>\n"
new = old + """
          {selectedOccurrence && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700">Statut du workflow</span>
                <span className="px-2 py-1 rounded-full text-[11px] font-medium bg-white border">{selectedOccurrence.validation_status || calculateOccurrenceFields(selectedOccurrence).niveauAvancement}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Historique des échanges</p>
                <div className="max-h-44 overflow-y-auto space-y-2">
                  {getOccurrenceHistory(selectedOccurrence).length === 0 ? <p className="text-xs text-gray-500">Aucun échange pour le moment.</p> : getOccurrenceHistory(selectedOccurrence).map((item) => (
                    <div key={item.id} className="rounded-lg bg-white border border-gray-200 p-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-gray-700">{item.actor || '-'}</span>
                        <span className="text-[10px] text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '-'}</span>
                      </div>
                      <p className="text-[11px] text-gray-600">{item.comment || 'Sans commentaire'}</p>
                      {(item.previous_value != null || item.new_value != null) && <p className="mt-1 text-[10px] text-gray-500">Valeur : {item.previous_value ?? '-'} → {item.new_value ?? '-'}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
"""
text = text.replace(old, new)

# change warning text
text = text.replace("              En tant que responsable, vous pouvez uniquement modifier le taux d'avancement.", "              En tant que responsable, supérieur hiérarchique direct ou responsable de structure autorisé, vous pouvez mettre à jour le taux d'avancement et commenter.")

# patch confirmation modal buttons and textarea
old = """          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowConfirmationModal(false)}>Fermer</Button>
            <Button onClick={handleConfirmOccurrenceCompletion}>Confirmer</Button>
          </div>
"""
new = """          <div>
            <label className="block text-sm font-medium mb-1">Commentaire du gestionnaire</label>
            <textarea value={confirmationForm.validation_comment || ''} onChange={e => setConfirmationForm({ ...confirmationForm, validation_comment: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} placeholder="Commentaire optionnel en cas de validation" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Commentaire obligatoire en cas de rejet</label>
            <textarea value={confirmationForm.rejection_comment || ''} onChange={e => setConfirmationForm({ ...confirmationForm, rejection_comment: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" rows={3} placeholder="Précisez le motif du rejet" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowConfirmationModal(false)}>Fermer</Button>
            <Button variant="danger" onClick={() => handleConfirmOccurrenceCompletion('reject')}>Rejeter</Button>
            <Button onClick={() => handleConfirmOccurrenceCompletion('approve')}>Valider</Button>
          </div>
"""
text = text.replace(old, new)
p.write_text(text)

# 6) indicators page
p = root/'src/app/dashboard/indicateurs/page.js'
text = p.read_text()
text = text.replace("import { canAccessIndicator, canAccessIndicatorOccurrence, isPrivilegedUser } from '@/lib/access-scope'", "import { canAccessIndicator, canAccessIndicatorOccurrence, isPrivilegedUser, isStructureResponsible } from '@/lib/access-scope'")
text = text.replace("  const [occurrenceForm, setOccurrenceForm] = useState({})\n", "  const [occurrenceForm, setOccurrenceForm] = useState({})\n  const [validationForm, setValidationForm] = useState({ rejection_comment: '', validation_comment: '' })\n")
if 'const isStructureManagerForCode = (structureCode)' not in text:
    insert = """
  const normalizeUsernameValue = (value) => String(value || '').trim().toLowerCase()
  const isDirectSuperiorOf = (targetUsername) => {
    const currentUsername = normalizeUsernameValue(user?.username)
    const target = users.find((item) => normalizeUsernameValue(item?.username) === normalizeUsernameValue(targetUsername))
    return !!currentUsername && !!target && normalizeUsernameValue(target?.superieur) === currentUsername
  }
  const isStructureManagerForCode = (structureCode) => isStructureResponsible(user, structureCode, structures)
  const canManageIndicatorWorkflow = (occ, ind) => {
    const structureCode = ind?.code_structure || occ?.code_structure || user?.structure
    return ['Gestionnaire', 'Super admin'].includes(user?.type_utilisateur) || isStructureManagerForCode(structureCode) || isDirectSuperiorOf(occ?.responsable || ind?.responsable)
  }
  const getIndicatorWorkflowHistory = (occ) => {
    if (!occ?.validation_history) return []
    try { const parsed = JSON.parse(occ.validation_history); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
  }
  const requiresIndicatorReply = (occ) => String(occ?.validation_status || '').toLowerCase() === 'rejetee' && occ?.responsable === user?.username

"""
    text = text.replace("  const canEditGroupe = (g) => {\n", insert + "  const canEditGroupe = (g) => {\n")
text = text.replace("  const canEditOcc = (occ, ind) => isAdmin() || canEditInd(ind)", "  const canEditOcc = (occ, ind) => isAdmin() || canEditInd(ind) || canManageIndicatorWorkflow(occ, ind)")
text = text.replace("  const canSaisir = (occ, ind) => canEditOcc(occ, ind) || isResp(ind)", "  const canSaisir = (occ, ind) => canEditOcc(occ, ind) || isResp(ind) || isDirectSuperiorOf(occ?.responsable || ind?.responsable) || isStructureManagerForCode(ind?.code_structure || occ?.code_structure)")

text = text.replace("  const handleOpenOccModal = (occ) => { const ind = indicateurs.find(i => i.code_indicateur === occ.code_indicateur); setSelectedIndicateur(ind); setSelectedOccurrence(occ); let cible = occ.cible; if (isRisque(ind)) cible = ind.sens === 'Négatif' ? ind.seuil1 : ind.seuil3; setOccurrenceForm({ ...occ, cible, periodicite: ind?.periodicite, annee: occ.annee || new Date(occ.date_debut).getFullYear() }); setShowOccurrenceModal(true) }", "  const handleOpenOccModal = (occ) => { const ind = indicateurs.find(i => i.code_indicateur === occ.code_indicateur); setSelectedIndicateur(ind); setSelectedOccurrence(occ); let cible = occ.cible; if (isRisque(ind)) cible = ind.sens === 'Négatif' ? ind.seuil1 : ind.seuil3; setOccurrenceForm({ ...occ, cible, periodicite: ind?.periodicite, annee: occ.annee || new Date(occ.date_debut).getFullYear() }); setValidationForm({ rejection_comment: '', validation_comment: '' }); setShowOccurrenceModal(true) }")

text = text.replace("  const handleSaveOcc = async () => { \n", "  const handleSaveOcc = async () => { \n    if (selectedOccurrence && requiresIndicatorReply(selectedOccurrence) && !String(occurrenceForm.commentaire || '').trim()) { showAlert('error', 'Vous devez répondre au commentaire du gestionnaire avant la nouvelle soumission'); return }\n")
text = text.replace("      const payload = { ...occurrenceForm, modificateur: user?.username }\n", "      const payload = { ...occurrenceForm, modificateur: user?.username, validation_status: occurrenceForm.val_indicateur != null ? 'Attente de validation' : occurrenceForm.validation_status }\n")

if 'const handleIndicatorValidationDecision' not in text:
    addfn = """
  const handleIndicatorValidationDecision = async (decision) => {
    if (!selectedOccurrence) return
    if (decision === 'reject' && !String(validationForm.rejection_comment || '').trim()) {
      showAlert('error', 'Le commentaire de rejet est obligatoire')
      return
    }
    try {
      const payload = {
        ...selectedOccurrence,
        id: selectedOccurrence.id,
        modificateur: user?.username,
        validation_decision: decision,
        validation_comment: decision === 'reject' ? validationForm.rejection_comment : validationForm.validation_comment,
      }
      const r = await fetch('/api/indicateurs/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (r.ok) {
        showAlert('success', decision === 'reject' ? 'Valeur rejetée' : 'Valeur validée', async () => {
          setValidationForm({ rejection_comment: '', validation_comment: '' })
          setShowOccurrenceModal(false)
          fetchOccurrences()
          if (showOccurrencesListModal && selectedIndicateur) { const rr = await fetch(`/api/indicateurs/occurrences?code_indicateur=${selectedIndicateur.code_indicateur}`); if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || []) }
        })
      } else {
        const err = await r.json().catch(() => ({}))
        showAlert('error', err.error || 'Erreur')
      }
    } catch {
      showAlert('error', 'Erreur')
    }
  }

"""
    text = text.replace("  const handleDelOcc = (occ) => { ", addfn + "  const handleDelOcc = (occ) => { ")

# display status in list modal
text = text.replace("<td className=\"px-2 py-1.5 text-center\"><StBadge s={occ.statut}/></td>", "<td className=\"px-2 py-1.5 text-center\"><StBadge s={occ.validation_status || occ.statut}/></td>")

# add workflow block and buttons near bottom before footer in occurrence modal
old = "            <div><label className=\"block text-xs font-medium text-gray-700 mb-1\">Commentaire</label><textarea value={occurrenceForm.commentaire||''} onChange={e=>setOccurrenceForm({...occurrenceForm,commentaire:e.target.value})} disabled={ro} rows={2} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`}/></div>\n            <div className=\"flex justify-end gap-2 pt-4 mt-4 border-t\"><Button variant=\"secondary\" onClick={()=>setShowOccurrenceModal(false)}>Fermer</Button>{!ro&&periodeEchue&&<Button onClick={handleSaveOcc}>Enregistrer</Button>}</div>\n"
new = """            <div><label className="block text-xs font-medium text-gray-700 mb-1">Commentaire</label><textarea value={occurrenceForm.commentaire||''} onChange={e=>setOccurrenceForm({...occurrenceForm,commentaire:e.target.value})} disabled={ro} rows={2} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`}/></div>
            {selectedOccurrence && <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-gray-700">Statut de validation</span><span className="px-2 py-1 rounded-full text-[11px] bg-white border">{selectedOccurrence.validation_status || 'Non renseigné'}</span></div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Historique des échanges</p>
                <div className="max-h-40 overflow-y-auto space-y-2">{getIndicatorWorkflowHistory(selectedOccurrence).length===0?<p className="text-xs text-gray-500">Aucun échange pour le moment.</p>:getIndicatorWorkflowHistory(selectedOccurrence).map(item=><div key={item.id} className="rounded-lg border bg-white p-2"><div className="flex items-center justify-between gap-2 mb-1"><span className="text-[11px] font-semibold text-gray-700">{item.actor||'-'}</span><span className="text-[10px] text-gray-500">{item.created_at?new Date(item.created_at).toLocaleString('fr-FR'):'-'}</span></div><p className="text-[11px] text-gray-600">{item.comment||'Sans commentaire'}</p>{(item.previous_value!=null||item.new_value!=null)&&<p className="mt-1 text-[10px] text-gray-500">Valeur : {item.previous_value ?? '-'} → {item.new_value ?? '-'}</p>}{item.metadata?.rejected_value!=null&&<p className="mt-1 text-[10px] text-red-600">Valeur rejetée : {item.metadata.rejected_value}</p>}</div>)}</div>
              </div>
              {canManageIndicatorWorkflow(selectedOccurrence, ind) && selectedOccurrence.val_indicateur != null && (
                <>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Commentaire de validation</label><textarea value={validationForm.validation_comment||''} onChange={e=>setValidationForm({...validationForm,validation_comment:e.target.value})} rows={2} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Optionnel si vous validez"/></div>
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Commentaire obligatoire en cas de rejet</label><textarea value={validationForm.rejection_comment||''} onChange={e=>setValidationForm({...validationForm,rejection_comment:e.target.value})} rows={3} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="Précisez le motif du rejet"/></div>
                </>
              )}
            </div>}
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t"><Button variant="secondary" onClick={()=>setShowOccurrenceModal(false)}>Fermer</Button>{selectedOccurrence && canManageIndicatorWorkflow(selectedOccurrence, ind) && selectedOccurrence.val_indicateur != null && <Button variant="danger" onClick={()=>handleIndicatorValidationDecision('reject')}>Rejeter</Button>}{selectedOccurrence && canManageIndicatorWorkflow(selectedOccurrence, ind) && selectedOccurrence.val_indicateur != null && <Button onClick={()=>handleIndicatorValidationDecision('approve')}>Valider</Button>}{!ro&&periodeEchue&&<Button onClick={handleSaveOcc}>Enregistrer</Button>}</div>
"""
text = text.replace(old, new)
p.write_text(text)

# 7) migration file
mig = root/'scripts/migration-v206-occurrence-validation-workflow.sql'
mig.write_text("""
-- Workflow de validation/rejet pour actions et indicateurs
alter table if exists action_occurrences
  add column if not exists validation_status text,
  add column if not exists validation_history jsonb default '[]'::jsonb,
  add column if not exists last_rejection_comment text,
  add column if not exists last_rejected_by text;

alter table if exists indicateur_occurrences
  add column if not exists validation_status text,
  add column if not exists validation_history jsonb default '[]'::jsonb,
  add column if not exists last_rejection_comment text,
  add column if not exists last_rejected_by text,
  add column if not exists rejected_value numeric;
""")
