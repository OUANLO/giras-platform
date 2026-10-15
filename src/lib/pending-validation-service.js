import { sendEmail } from '@/lib/email'
import { createAdminClient } from '@/lib/supabase-server'
import { getPendingValidationDigestEmailTemplate } from '@/lib/email'

const DEFAULT_ACTION_DELAY_DAYS = 3
const DEFAULT_INDICATOR_DELAY_DAYS = 3

const normalize = (value) => String(value || '').trim().toLowerCase()
const normalizeUpper = (value) => String(value || '').trim().toUpperCase()
const isFilled = (value) => !(value === null || value === undefined || String(value).trim() === '')
const parseList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean)
  if (!value) return []
  return String(value)
    .split(/[;,]/)
    .map((v) => v.trim())
    .filter(Boolean)
}
const unique = (arr) => [...new Set((arr || []).filter(Boolean))]

const toDateOnly = (value) => {
  if (!value) return null
  if (value instanceof Date) {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    d.setHours(0, 0, 0, 0)
    return d
  }
  const raw = String(value).trim()
  if (!raw) return null

  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) {
    direct.setHours(0, 0, 0, 0)
    return direct
  }

  const match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (match) {
    const [, dd, mm, yyyy] = match
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0)
      return parsed
    }
  }

  return null
}

const daysBetween = (from, to = new Date()) => {
  const a = toDateOnly(from)
  const b = toDateOnly(to)
  if (!a || !b) return null
  return Math.max(0, Math.floor((b - a) / 86400000))
}

function safeEq(value, identifiers) {
  const v = normalize(value)
  return !!v && identifiers.has(v)
}


function parseJsonArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getLatestPendingIndicatorReferenceDate(occ) {
  const history = parseJsonArray(occ?.validation_history)
  const candidate = [...history]
    .reverse()
    .find((entry) => {
      const decision = normalize(entry?.decision)
      return decision.includes('commentaire') || decision.includes('reponse') || decision.includes('soumission') || decision.includes('saisie')
    })
  return occ?.date_saisie || candidate?.created_at || candidate?.date || occ?.updated_at || occ?.date_modification || occ?.created_at || null
}

function stripAccents(value) {
  return normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function isValidatedIndicatorStatus(value) {
  return stripAccents(value) === 'valide'
}

function isRejectedIndicatorStatus(value) {
  const status = stripAccents(value)
  return status === 'rejetee' || status === 'rejete'
}

function isNotFilledIndicatorStatus(value) {
  return stripAccents(value) === 'non renseigne'
}

function isPendingIndicatorValidationStatus(value, occ = null) {
  const hasSubmittedValue = !!occ && (
    isFilled(occ?.val_indicateur) ||
    isFilled(occ?.val_numerateur) ||
    isFilled(occ?.val_denominateur)
  )
  const status = normalize(value)

  // Même règle fonctionnelle que le tableau Suivi des indicateurs > Suivi :
  // dès qu'une valeur est saisie et que l'occurrence n'est ni validée ni rejetée,
  // elle doit être considérée comme en attente de validation, même si validation_status est vide.
  if (hasSubmittedValue) {
    if (isValidatedIndicatorStatus(status) || isRejectedIndicatorStatus(status) || isNotFilledIndicatorStatus(status)) return false
    return true
  }

  if (!status) return false
  return status.includes('attente') && status.includes('validation')
}

async function readSettingValue(supabase, key, fallback) {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle()
    if (error) throw error
    const n = Number(data?.setting_value)
    return Number.isFinite(n) ? n : fallback
  } catch (error) {
    return fallback
  }
}

export async function getPendingValidationSettings(supabase) {
  const client = supabase || createAdminClient()
  const [actionValidationDelayDays, indicatorValidationDelayDays] = await Promise.all([
    readSettingValue(client, 'action_validation_delay_days', DEFAULT_ACTION_DELAY_DAYS),
    readSettingValue(client, 'indicator_validation_delay_days', DEFAULT_INDICATOR_DELAY_DAYS)
  ])
  return { actionValidationDelayDays, indicatorValidationDelayDays }
}

export async function savePendingValidationSettings(supabase, settings = {}) {
  const client = supabase || createAdminClient()
  const rows = [
    {
      setting_key: 'action_validation_delay_days',
      setting_value: String(Math.max(0, Number(settings.actionValidationDelayDays) || 0)),
      setting_label: 'Délai limite validation/confirmation des actions (jours)',
      updated_at: new Date().toISOString()
    },
    {
      setting_key: 'indicator_validation_delay_days',
      setting_value: String(Math.max(0, Number(settings.indicatorValidationDelayDays) || 0)),
      setting_label: 'Délai limite validation des indicateurs (jours)',
      updated_at: new Date().toISOString()
    }
  ]

  try {
    for (const row of rows) {
      const { data: existing, error: readError } = await client
        .from('admin_settings')
        .select('setting_key')
        .eq('setting_key', row.setting_key)
        .maybeSingle()
      if (readError) throw readError
      if (existing?.setting_key) {
        const { error: updateError } = await client
          .from('admin_settings')
          .update({
            setting_value: row.setting_value,
            setting_label: row.setting_label,
            updated_at: row.updated_at
          })
          .eq('setting_key', row.setting_key)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await client.from('admin_settings').insert(row)
        if (insertError) throw insertError
      }
    }
    return { success: true }
  } catch (error) {
    throw new Error(`Impossible d'enregistrer les paramètres de validation: ${error.message || error}`)
  }
}

async function readFirstAvailableTable(client, tableNames = []) {
  let lastError = null
  for (const tableName of tableNames) {
    const res = await client.from(tableName).select('*')
    if (!res?.error) return res
    lastError = res.error
    const msg = String(res.error?.message || '')
    if (!msg.toLowerCase().includes('could not find the table')) {
      return res
    }
  }
  return { data: [], error: lastError }
}

export async function loadPendingValidationDataset(supabase) {
  const client = supabase || createAdminClient()
  const [
    usersRes,
    structuresRes,
    projetsRes,
    actionsRes,
    actionOccRes,
    groupesIndRes,
    indicateursRes,
    indicateurOccRes
  ] = await Promise.all([
    client.from('users').select('*').eq('statut', 'Actif'),
    client.from('structures').select('*'),
    readFirstAvailableTable(client, ['groupe_actions', 'groupes_actions']),
    client.from('actions').select('*'),
    client.from('action_occurrences').select('*'),
    client.from('groupe_indicateurs').select('*'),
    client.from('indicateurs').select('*').or('archive.is.null,archive.eq.false'),
    client.from('indicateur_occurrences').select('*').or('archive.is.null,archive.eq.false')
  ])

  const throwIf = (res, label) => {
    if (res.error) throw new Error(`${label}: ${res.error.message}`)
    return res.data || []
  }

  return {
    users: throwIf(usersRes, 'Chargement users'),
    structures: throwIf(structuresRes, 'Chargement structures'),
    groupesActions: throwIf(projetsRes, 'Chargement groupes actions'),
    actions: throwIf(actionsRes, 'Chargement actions'),
    actionOccurrences: throwIf(actionOccRes, 'Chargement occurrences actions'),
    groupesIndicateurs: throwIf(groupesIndRes, 'Chargement groupes indicateurs'),
    indicateurs: throwIf(indicateursRes, 'Chargement indicateurs'),
    indicateurOccurrences: throwIf(indicateurOccRes, 'Chargement occurrences indicateurs')
  }
}

function buildUserMaps(dataset) {
  const users = dataset?.users || []
  const userByIdentifier = new Map()
  for (const user of users) {
    for (const key of unique([user?.username, user?.email])) {
      userByIdentifier.set(normalize(key), user)
    }
  }
  return { userByIdentifier }
}

function getManagedProjectCodes(manager, dataset) {
  const identifiers = new Set(unique([manager?.username, manager?.email]).map(normalize))
  return unique((dataset?.groupesActions || [])
    .filter((group) => {
      const managers = unique([...parseList(group?.gestionnaires), ...parseList(group?.gestionnaire)])
      return managers.some((candidate) => identifiers.has(normalize(candidate)))
    })
    .map((group) => String(group?.code_groupe || '').trim())
    .filter(Boolean))
}

function getManagedIndicatorGroupCodes(manager, dataset) {
  const identifiers = new Set(unique([manager?.username, manager?.email]).map(normalize))
  return unique((dataset?.groupesIndicateurs || [])
    .filter((group) => {
      const managers = unique([...parseList(group?.gestionnaires), ...parseList(group?.gestionnaire)])
      return managers.some((candidate) => identifiers.has(normalize(candidate)))
    })
    .map((group) => String(group?.code_groupe || '').trim())
    .filter(Boolean))
}

function buildPendingActionRows(manager, dataset, thresholds) {
  const today = new Date()
  const managedProjectCodes = new Set(getManagedProjectCodes(manager, dataset))
  if (!managedProjectCodes.size) return []

  const actionByCode = new Map((dataset?.actions || []).map((row) => [String(row?.code_action || '').trim(), row]))

  return (dataset?.actionOccurrences || [])
    .map((occ) => {
      const codeAction = String(occ?.code_action || occ?.code_action_occ || '').trim()
      const action = actionByCode.get(codeAction)
      const projectCode = String(action?.code_groupe || occ?.code_groupe || '').trim()
      if (!projectCode || !managedProjectCodes.has(projectCode)) return null
      const tx = Number(occ?.tx_avancement || 0)
      const isPending = tx >= 100 && normalize(occ?.gestionnaire_conf) !== 'oui'
      if (!isPending) return null
      const referenceDate = occ?.date_realisation || occ?.date_modification || occ?.updated_at || occ?.created_at
      const ageDays = daysBetween(referenceDate, today)
      return {
        id: occ?.id,
        code_groupe: projectCode,
        code_action: codeAction || action?.code_action || '-',
        libelle_action: occ?.libelle_action || action?.libelle_action || '-',
        responsable: occ?.responsable || action?.responsable || '-',
        structure: occ?.code_structure || action?.code_structure || action?.structure || '-',
        date_realisation: occ?.date_realisation || null,
        date_limite: occ?.date_fin || action?.date_fin || null,
        validation_status: occ?.validation_status || 'Terminée - non confirmée',
        ageDays: Number.isFinite(ageDays) ? ageDays : 0,
        isLate: Number.isFinite(ageDays) ? ageDays > Number(thresholds?.actionValidationDelayDays || 0) : false
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.ageDays - a.ageDays)
}

function buildPendingIndicatorRows(manager, dataset, thresholds) {
  const today = new Date()
  const managedGroupCodes = new Set(getManagedIndicatorGroupCodes(manager, dataset).map((code) => String(code || '').trim()))
  if (!managedGroupCodes.size) return []

  const indicatorByCode = new Map((dataset?.indicateurs || []).map((row) => [String(row?.code_indicateur || '').trim(), row]))

  return (dataset?.indicateurOccurrences || [])
    .map((occ) => {
      const codeInd = String(occ?.code_indicateur || occ?.code_indicateur_occ || '').trim()
      const indicator = indicatorByCode.get(codeInd)
      if (!indicator) return null
      if (String(indicator?.statut || 'Actif').trim() !== 'Actif') return null
      if (indicator?.archive === true || occ?.archive === true) return null

      const groupCodes = new Set(unique([
        indicator?.code_groupe,
        indicator?.code_groupe_indicateur,
        ...parseList(indicator?.groupes),
        ...parseList(indicator?.groupes_indicateurs)
      ]).map((code) => String(code || '').trim()).filter(Boolean))
      const occurrenceGroupCodes = new Set(unique([
        occ?.code_groupe,
        occ?.code_groupe_indicateur,
        ...(Array.isArray(occ?.groupes) ? occ.groupes : parseList(occ?.groupes)),
        ...(Array.isArray(occ?.groupes_indicateurs) ? occ.groupes_indicateurs : parseList(occ?.groupes_indicateurs))
      ]).map((code) => String(code || '').trim()).filter(Boolean))
      const mergedGroupCodes = new Set([...groupCodes, ...occurrenceGroupCodes])
      const isManaged = [...mergedGroupCodes].some((code) => managedGroupCodes.has(code))
      if (!isManaged) return null

      const isPending = isPendingIndicatorValidationStatus(occ?.validation_status, occ)
      if (!isPending) return null
      const referenceDate = getLatestPendingIndicatorReferenceDate(occ)
      const ageDays = daysBetween(referenceDate, today)
      return {
        id: occ?.id,
        code_indicateur: codeInd,
        libelle_indicateur: indicator?.libelle_indicateur || '-',
        groupes: [...mergedGroupCodes].join(', ') || '-',
        responsable: indicator?.responsable || '-',
        structure: indicator?.code_structure || occ?.code_structure || '-',
        periode: occ?.periode || '-',
        date_saisie: occ?.date_saisie || null,
        valeur: isFilled(occ?.val_indicateur) ? occ?.val_indicateur : (isFilled(occ?.val_numerateur) || isFilled(occ?.val_denominateur) ? `${occ?.val_numerateur ?? '-'} / ${occ?.val_denominateur ?? '-'}` : null),
        validation_status: occ?.validation_status || 'Attente de validation',
        ageDays: Number.isFinite(ageDays) ? ageDays : 0,
        isLate: Number.isFinite(ageDays) ? ageDays > Number(thresholds?.indicatorValidationDelayDays || 0) : false
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.ageDays - a.ageDays)
}

export function buildPendingValidationDigestForManager(manager, dataset, thresholds) {
  const pendingActions = buildPendingActionRows(manager, dataset, thresholds)
  const pendingIndicators = buildPendingIndicatorRows(manager, dataset, thresholds)
  return {
    manager,
    actionThresholdDays: Number(thresholds?.actionValidationDelayDays || 0),
    indicatorThresholdDays: Number(thresholds?.indicatorValidationDelayDays || 0),
    actions: {
      total: pendingActions.length,
      late: pendingActions.filter((row) => row.isLate),
      onTime: pendingActions.filter((row) => !row.isLate)
    },
    indicators: {
      total: pendingIndicators.length,
      late: pendingIndicators.filter((row) => row.isLate),
      onTime: pendingIndicators.filter((row) => !row.isLate)
    }
  }
}

export function getPendingValidationManagers(dataset) {
  const { userByIdentifier } = buildUserMaps(dataset)
  const managerIds = new Set()

  for (const group of dataset?.groupesActions || []) {
    for (const item of [...parseList(group?.gestionnaires), ...parseList(group?.gestionnaire)]) {
      const user = userByIdentifier.get(normalize(item))
      if (user?.username) managerIds.add(user.username)
    }
  }
  for (const group of dataset?.groupesIndicateurs || []) {
    for (const item of [...parseList(group?.gestionnaires), ...parseList(group?.gestionnaire)]) {
      const user = userByIdentifier.get(normalize(item))
      if (user?.username) managerIds.add(user.username)
    }
  }

  return (dataset?.users || []).filter((user) => managerIds.has(user.username))
}

export async function getPendingValidationSynthesis(supabase) {
  const client = supabase || createAdminClient()
  const [dataset, settings] = await Promise.all([
    loadPendingValidationDataset(client),
    getPendingValidationSettings(client)
  ])
  const managers = getPendingValidationManagers(dataset)
  const synthesis = managers.map((manager) => {
    const digest = buildPendingValidationDigestForManager(manager, dataset, settings)
    return {
      username: manager.username,
      nom: manager.nom,
      prenoms: manager.prenoms,
      email: manager.email || manager.username,
      type_utilisateur: manager.type_utilisateur,
      structure: manager.code_structure || manager.structure || '-',
      actionsPending: digest.actions.total,
      actionsLate: digest.actions.late.length,
      actionsOnTime: digest.actions.onTime.length,
      indicatorsPending: digest.indicators.total,
      indicatorsLate: digest.indicators.late.length,
      indicatorsOnTime: digest.indicators.onTime.length,
      hasItems: digest.actions.total > 0 || digest.indicators.total > 0
    }
  })
  return { settings, synthesis, dataset }
}

export async function sendPendingValidationDigests({
  users,
  dataset,
  settings,
  supabase,
  typeEmail = 'validation_pending_digest',
  source = 'manuel_validation_pending',
  mode = 'manual',
  createur = null
}) {
  const client = supabase || createAdminClient()
  const results = []

  for (const user of users || []) {
    const digest = buildPendingValidationDigestForManager(user, dataset, settings)
    if ((digest.actions.total + digest.indicators.total) === 0) {
      results.push({ user: user.username, status: 'skipped', reason: 'Aucun élément en attente de validation ou confirmation' })
      continue
    }

    const template = getPendingValidationDigestEmailTemplate({ user, digest, mode })
    const emailResult = await sendEmail({
      to: user.email || user.username,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent
    })

    const status = emailResult.success ? 'envoyé' : 'échoué'
    try {
      await client.from('email_logs').insert({
        destinataire: user.email || user.username,
        destinataire_nom: `${user.prenoms || ''} ${user.nom || ''}`.trim() || user.username,
        sujet: template.subject,
        type_email: typeEmail,
        statut: status,
        source,
        createur,
        details: {
          mode,
          actions_pending: digest.actions.total,
          actions_late: digest.actions.late.length,
          actions_on_time: digest.actions.onTime.length,
          indicators_pending: digest.indicators.total,
          indicators_late: digest.indicators.late.length,
          indicators_on_time: digest.indicators.onTime.length,
          action_threshold_days: digest.actionThresholdDays,
          indicator_threshold_days: digest.indicatorThresholdDays,
          error: emailResult.success ? null : emailResult.error
        }
      })
    } catch (e) {
      console.error('[PENDING_VALIDATION_EMAIL] log error', e)
    }

    results.push({
      user: user.username,
      fullName: `${user.prenoms || ''} ${user.nom || ''}`.trim() || user.username,
      status: emailResult.success ? 'sent' : 'failed',
      error: emailResult.success ? null : emailResult.error,
      actionsPending: digest.actions.total,
      indicatorsPending: digest.indicators.total
    })
  }

  return results
}
