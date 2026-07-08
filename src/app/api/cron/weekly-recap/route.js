import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { requireAdminAccess } from '@/lib/auth'
import { sendEmail, getWeeklyRecapEmailTemplate } from '@/lib/email'
import { computePerformanceRows } from '@/lib/performance-metrics'
import { getUsersWithPendingReminderItems } from '@/lib/daily-reminder-service'
import { buildPendingValidationDigestForManager, getPendingValidationSettings, loadPendingValidationDataset } from '@/lib/pending-validation-service'

export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET || 'giras-cron-secret-2024'


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
  return new Date().toISOString().split('T')[0]
}

function isWeeklyRecapDay() {
  return new Date().getDay() === 1
}

async function hasAlreadySentThisWeek(supabase) {
  const today = new Date()
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

const toNumber = (value) => {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

const isFilled = (value) => !(value === null || value === undefined || `${value}`.trim() === '')

const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const computeRate = (num, den) => (!den ? null : (num / den) * 100)
const normalizeStructure = (value) => `${value || ''}`.trim().toUpperCase()

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

const isFalseLike = (value) => {
  if (value === false || value === null || value === undefined || value === 0) return true
  const s = String(value).trim().toLowerCase()
  return s === '' || s === 'false' || s === '0' || s === 'non'
}

const isTrueLike = (value) => !isFalseLike(value)

const getEligibleActionOccurrences = (actions, actionOccurrences, groupesActions = []) => {
  const publicProjectCodes = new Set(
    (groupesActions || [])
      .filter((projet) => {
        if (!projet) return false
        if (isTrueLike(projet.archive)) return false
        const statut = String(projet.statut || '').trim().toLowerCase()
        if (statut && statut === 'inactif') return false
        return String(projet.type_projet || 'Public').trim().toLowerCase() === 'public'
      })
      .map((projet) => String(projet.code_groupe || '').trim())
      .filter(Boolean)
  )

  const eligibleActionsByCode = new Map(
    (actions || [])
      .filter((action) => {
        if (!action) return false
        if (isTrueLike(action.archive)) return false
        const statut = String(action.statut || action.statut_act || '').trim().toLowerCase()
        if (statut && statut === 'inactif') return false
        const codeGroupe = String(action.code_groupe || '').trim()
        if (!codeGroupe || !publicProjectCodes.has(codeGroupe)) return false
        return !!String(action.code_action || '').trim()
      })
      .map((action) => [String(action.code_action || '').trim(), action])
  )

  return (actionOccurrences || [])
    .filter((occ) => {
      if (!occ) return false
      if (isTrueLike(occ.archive)) return false
      const codeAction = String(occ.code_action || occ.code_action_occ || occ.__actionCode || '').trim()
      return eligibleActionsByCode.has(codeAction)
    })
    .map((occ) => {
      const action = eligibleActionsByCode.get(String(occ.code_action || occ.code_action_occ || occ.__actionCode || '').trim())
      return {
        ...action,
        ...occ,
        code_action: occ.code_action || action.code_action,
        code_groupe: action.code_groupe,
        code_structure: occ.code_structure || action.code_structure || action.structure || null,
        responsable: occ.responsable || null,
        libelle_action: occ.libelle_action || action.libelle_action || null,
        date_debut: occ.date_debut || null,
        date_fin: occ.date_fin || null,
        date_realisation: occ.date_realisation || null,
        date_conf: occ.date_conf || null,
        tx_avancement: toNumber(occ.tx_avancement) ?? 0,
        archive: false,
        statut: action.statut || action.statut_act || 'Actif',
        __synthetic: false
      }
    })
}

const getUserIdentifiers = (user) => new Set(
  [user?.username, user?.email]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())
)

const identifierMatchesSet = (value, identifiers) => {
  if (!value || !identifiers || identifiers.size === 0) return false
  return identifiers.has(String(value).trim().toLowerCase())
}

const identifierMatchesUser = (value, user) => identifierMatchesSet(value, getUserIdentifiers(user))
const avg = (values) => {
  const valid = (values || []).filter((v) => Number.isFinite(v))
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null
}
const formatDateFr = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return `${value}`
  return d.toLocaleDateString('fr-FR')
}

const getIndicatorCible = (indicator, occurrence) => {
  const groupes = Array.isArray(indicator?.groupes) ? indicator.groupes : []
  const isRisque = indicator?.code_groupe === 'Risque' || groupes.includes('Risque')
  if (isRisque) {
    if (indicator?.sens === 'Négatif') return toNumber(indicator?.seuil1)
    return toNumber(indicator?.seuil3)
  }
  return toNumber(occurrence?.cible)
}

const isTargetReached = (value, cible, sens) => {
  const v = toNumber(value)
  const c = toNumber(cible)
  if (v === null || c === null) return false
  return sens === 'Négatif' ? v <= c : v >= c
}

const getActionDelayDays = (occurrence, today = null) => {
  const refToday = today || toDateOnly(new Date())
  const tx = toNumber(occurrence?.tx_avancement) || 0
  const isDone = tx >= 100
  const dateFin = toDateOnly(occurrence?.date_fin)
  if (!dateFin) return 0
  const dateRealisation = toDateOnly(occurrence?.date_realisation)
  const dateConfirmation = toDateOnly(occurrence?.date_conf)
  const referenceDate = isDone ? (dateRealisation || dateConfirmation || refToday) : refToday
  return Math.floor((referenceDate - dateFin) / 86400000)
}

const normalizeActionCode = (value) => String(value || '').trim()
const getOccurrenceActionCode = (occ) => normalizeActionCode(occ?.code_action || occ?.code_action_occ || occ?.__actionCode)
const getOccurrenceIndicatorCode = (occ) => String(occ?.code_indicateur || occ?.code_indicateur_occ || '').trim()
const getActionStructureCode = (action, occ) => normalizeStructure(occ?.code_structure || occ?.structure || action?.code_structure || action?.structure)

const getActionTxForOccurrence = (taches, occ) => {
  if (!occ) return 0
  const occId = String(occ?.code_occurrence || occ?.id || '').trim()
  const occTasks = (taches || []).filter((row) => String(row?.code_occurrence || '').trim() === occId)
  if (!occTasks.length) return toNumber(occ?.tx_avancement) ?? toNumber(occ?.taux_avancement) ?? 0
  const avgTx = occTasks.reduce((sum, row) => sum + (toNumber(row?.tx_avancement) ?? 0), 0) / occTasks.length
  return Math.round(avgTx * 100) / 100
}

const getActionOccurrenceProgress = (taches, occ, today = null) => {
  if (!occ) return { tx: 0, niveauAvancement: 'Non entamée', jourRetard: 0, niveauRetard: 'Pas retard', isDone: false }
  const refToday = today || new Date()
  refToday.setHours(0, 0, 0, 0)
  const tx = getActionTxForOccurrence(taches, occ)
  const isDone = tx >= 100
  const dateFin = toDateOnly(occ?.date_fin)
  const dateReal = toDateOnly(occ?.date_realisation)
  const dateConf = toDateOnly(occ?.date_conf)

  let niveauAvancement = 'Non entamée'
  if (tx === 0) niveauAvancement = 'Non entamée'
  else if (tx <= 50) niveauAvancement = 'En cours -50%'
  else if (tx < 100) niveauAvancement = 'En cours +50%'
  else if (tx >= 100 && occ?.gestionnaire_conf !== 'Oui') niveauAvancement = 'Terminée - non confirmée'
  else if (tx >= 100 && occ?.gestionnaire_conf === 'Oui') niveauAvancement = 'Achevée'

  let jourRetard = 0
  if (dateFin) {
    if (isDone) {
      const ref = dateReal || dateConf || refToday
      jourRetard = Math.floor((ref - dateFin) / 86400000)
    } else {
      jourRetard = Math.floor((refToday - dateFin) / 86400000)
    }
  }

  return { tx, niveauAvancement, jourRetard, niveauRetard: jourRetard > 0 ? 'Retard' : 'Pas retard', isDone }
}

const getIndicatorProjectCodes = (indicator) => {
  const values = []
  const pushValue = (v) => {
    if (v === null || v === undefined) return
    if (Array.isArray(v)) return v.forEach(pushValue)
    if (typeof v === 'string' && (v.includes(',') || v.includes(';'))) {
      v.split(/[;,]/).forEach(pushValue)
      return
    }
    const s = String(v).trim()
    if (s) values.push(s)
  }
  pushValue(indicator?.code_groupe)
  pushValue(indicator?.groupe)
  pushValue(indicator?.groupes)
  pushValue(indicator?.code_projet)
  return [...new Set(values)]
}

const isIndicatorOccurrenceFilled = (occurrence) => occurrence?.val_indicateur !== null && occurrence?.val_indicateur !== undefined && String(occurrence?.val_indicateur).trim() !== ''

function calculateUserPerformance(userRecord, dataset) {
  const { users, actions, actionOccurrences, indicateurs, indicateurOccurrences, groupesActions } = dataset
  const today = toDateOnly(new Date())
  const activeUsers = users || []
  const activeIndicators = (indicateurs || []).filter((ind) => ind && ind.archive !== true && ind.statut !== 'Inactif')
  const indicatorMap = new Map(activeIndicators.map((ind) => [String(ind.code_indicateur), ind]))
  const eligibleActionOccurrences = getEligibleActionOccurrences(actions, actionOccurrences, groupesActions)
  const eligibleIndicatorOccurrences = (indicateurOccurrences || []).filter((occ) => occ && occ.archive !== true && occ.statut !== 'Inactif' && indicatorMap.has(String(occ.code_indicateur)))

  const structureAtteinteMap = eligibleIndicatorOccurrences.reduce((acc, occ) => {
    const indicator = indicatorMap.get(String(occ.code_indicateur))
    const structureCode = normalizeStructure(indicator?.code_structure || occ?.code_structure || occ?.structure)
    if (!structureCode || !isFilled(occ.val_indicateur)) return acc
    if (!acc[structureCode]) {
      acc[structureCode] = { filledIndicatorsCount: 0, reachedTargetIndicatorsCount: 0, atteinteCible: null }
    }
    acc[structureCode].filledIndicatorsCount += 1
    const cible = getIndicatorCible(indicator, occ)
    if (isTargetReached(occ.val_indicateur, cible, indicator?.sens)) acc[structureCode].reachedTargetIndicatorsCount += 1
    return acc
  }, {})

  Object.values(structureAtteinteMap).forEach((metrics) => {
    metrics.atteinteCible = computeRate(metrics.reachedTargetIndicatorsCount, metrics.filledIndicatorsCount)
  })

  const username = userRecord.username
  const userIdentifiers = getUserIdentifiers(userRecord)
  const userStructure = normalizeStructure(userRecord.structure || userRecord.code_structure)

  const userStartedActions = eligibleActionOccurrences.filter((occ) => {
    const dateDebut = toDateOnly(occ.date_debut)
    return identifierMatchesSet(occ.responsable, userIdentifiers) && !!dateDebut && dateDebut <= today
  })
  const userDueActions = userStartedActions.filter((occ) => (
    toDateOnly(occ.date_fin) &&
    toDateOnly(occ.date_fin) < today
  ))
  const realisedActions = userDueActions.filter((occ) => (toNumber(occ.tx_avancement) || 0) >= 100)
  const realisedOnTimeActions = realisedActions.filter((occ) => getActionDelayDays(occ, today) <= 0)
  const overdueOpenActions = userStartedActions.filter((occ) => (toNumber(occ.tx_avancement) || 0) < 100 && getActionDelayDays(occ, today) > 0)
  const startedCompletedActions = userStartedActions.filter((occ) => (toNumber(occ.tx_avancement) || 0) >= 100)

  const userIndicatorOccurrences = eligibleIndicatorOccurrences.filter((occ) => {
    const indicator = indicatorMap.get(String(occ.code_indicateur))
    return identifierMatchesSet(indicator?.responsable, userIdentifiers)
  })
  const dueIndicatorOccurrences = userIndicatorOccurrences.filter((occ) => {
    const endDate = toDateOnly(occ.date_fin)
    return endDate && endDate < today
  })
  const filledDueIndicators = dueIndicatorOccurrences.filter((occ) => isFilled(occ.val_indicateur))
  const filledDueIndicatorsOnTime = filledDueIndicators.filter((occ) => {
    const dateSaisie = toDateOnly(occ.date_saisie)
    const dateLimite = toDateOnly(occ.date_limite_saisie)
    return dateSaisie && dateLimite && dateSaisie <= dateLimite
  })

  const structureAtteinte = structureAtteinteMap[userStructure] || { filledIndicatorsCount: 0, reachedTargetIndicatorsCount: 0, atteinteCible: null }

  const txRealisationAction = computeRate(realisedActions.length, userDueActions.length)
  const txRealisationActionDelai = computeRate(realisedOnTimeActions.length, userDueActions.length)
  const renseigneIndic = computeRate(filledDueIndicators.length, dueIndicatorOccurrences.length)
  const renseigneIndicDelai = computeRate(filledDueIndicatorsOnTime.length, dueIndicatorOccurrences.length)
  const atteinteCible = structureAtteinte.atteinteCible

  const ownCriteria = [txRealisationAction, txRealisationActionDelai, renseigneIndic, renseigneIndicDelai, atteinteCible]
  const scoreIndividuel = avg(ownCriteria)

  const directReports = activeUsers.filter((item) => item.superieur === username)
  const subordinateScores = directReports.map((item) => calculateUserPerformance.__cache?.get(item.username)?.scoreIndividuel).filter((value) => Number.isFinite(value))
  const scoreCollaborateur = subordinateScores.length ? subordinateScores.reduce((sum, value) => sum + value, 0) / subordinateScores.length : null

  const fullCriteria = [txRealisationAction, txRealisationActionDelai, renseigneIndic, renseigneIndicDelai, atteinteCible, scoreCollaborateur]
  const scorePerformance = avg(fullCriteria)

  return {
    scoreIndividuel,
    scoreCollaborateur,
    scorePerformance,
    actions: {
      total: userStartedActions.length,
      terminees: startedCompletedActions.length,
      termineesDansDelai: realisedOnTimeActions.length,
      enCours: Math.max(0, userStartedActions.length - startedCompletedActions.length - overdueOpenActions.length),
      enRetard: overdueOpenActions.length,
      txRealisationAction,
      txRealisationActionDelai,
      performanceAction: avg([txRealisationAction, txRealisationActionDelai])
    },
    indicateurs: {
      total: userIndicatorOccurrences.length,
      renseignes: userIndicatorOccurrences.filter((occ) => isFilled(occ.val_indicateur)).length,
      renseignesDansDelai: filledDueIndicatorsOnTime.length,
      enRetard: dueIndicatorOccurrences.filter((occ) => {
        const limit = toDateOnly(occ.date_limite_saisie || occ.date_fin)
        return !isFilled(occ.val_indicateur) && limit && today > limit
      }).length,
      atteinteCible,
      renseigneIndic,
      renseigneIndicDelai,
      performanceIndicateurs: avg([renseigneIndic, renseigneIndicDelai, atteinteCible])
    },
    collaborateurs: {
      total: directReports.length,
      scoreCollaborateur
    }
  }
}

function buildRecapContext(user, dataset) {
  const { users, structures, actions, actionOccurrences, taches, indicateurs, indicateurOccurrences, groupesActions, groupesIndicateurs, perfCache } = dataset
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const structureMap = new Map((structures || []).map((s) => [normalizeStructure(s.code_structure), s]))
  const userMap = new Map((users || []).map((u) => [String(u.username || '').trim().toLowerCase(), u]))
  const resolveUserByIdentifier = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return null
    return userMap.get(normalized) || (users || []).find((candidate) => identifierMatchesUser(value, candidate)) || null
  }
  const projetMap = new Map((groupesActions || []).map((g) => [String(g.code_groupe || '').trim(), g]))
  const groupeIndMap = new Map((groupesIndicateurs || []).map((g) => [String(g.code_groupe || '').trim(), g]))
  const indicatorMap = new Map((indicateurs || []).filter((ind) => ind && ind.archive !== true && ind.statut !== 'Inactif').map((ind) => [String(ind.code_indicateur || ''), ind]))
  const eligibleActionOccurrences = getEligibleActionOccurrences(actions, actionOccurrences, groupesActions)
  const eligibleIndicatorOccurrences = (indicateurOccurrences || []).filter((o) => o && o.archive !== true && o.statut !== 'Inactif' && indicatorMap.has(String(o.code_indicateur)))

  const directReports = (users || []).filter((u) => u.superieur === user.username)
  const managedStructureCodes = new Set(
    (structures || [])
      .filter((s) => identifierMatchesUser(s.responsable_structure, user))
      .map((s) => normalizeStructure(s.code_structure))
      .filter(Boolean)
  )
  const isStructureResponsible = managedStructureCodes.size > 0

  let audienceType = 'personal'
  let scopeUsers = [user]
  let scoreUsers = [user]
  let scopeStructureCodes = new Set([normalizeStructure(user.structure || user.code_structure)].filter(Boolean))

  if (user.type_utilisateur === 'Super manager') {
    audienceType = 'super_manager'
    scopeUsers = users || []
    scoreUsers = users || []
    scopeStructureCodes = new Set(
      [
        ...(structures || []).map((s) => normalizeStructure(s.code_structure)),
        ...(users || []).map((u) => normalizeStructure(u.structure || u.code_structure)),
        ...eligibleActionOccurrences.map((o) => getActionStructureCode(o, o)),
        ...eligibleIndicatorOccurrences.map((o) => normalizeStructure(indicatorMap.get(String(o.code_indicateur))?.code_structure || o?.code_structure || o?.structure))
      ].filter(Boolean)
    )
  } else if (isStructureResponsible) {
    audienceType = 'structure_responsible'
    scopeUsers = (users || []).filter((u) => managedStructureCodes.has(normalizeStructure(u.structure || u.code_structure)))
    scoreUsers = scopeUsers
    scopeStructureCodes = managedStructureCodes
  } else if (directReports.length > 0) {
    audienceType = 'direct_manager'
    scopeUsers = [user, ...directReports]
    scoreUsers = directReports
    scopeStructureCodes = new Set(scopeUsers.map((u) => normalizeStructure(u.structure || u.code_structure)).filter(Boolean))
  }

  const scopeUserIdentifiers = new Set(scopeUsers.flatMap((u) => [u?.username, u?.email]).filter(Boolean).map((value) => String(value).trim().toLowerCase()))

  const actionOccurrencesInScope = eligibleActionOccurrences.filter((occ) => {
    const dateDebut = toDateOnly(occ?.date_debut)
    if (!dateDebut || dateDebut > today) return false
    if (audienceType === 'super_manager') return true
    if (audienceType === 'structure_responsible') return scopeStructureCodes.has(getActionStructureCode(occ, occ))
    return identifierMatchesSet(occ.responsable, scopeUserIdentifiers)
  })

  const indicatorOccurrencesInScope = eligibleIndicatorOccurrences.filter((occ) => {
    const indicator = indicatorMap.get(String(occ.code_indicateur))
    if (!indicator) return false
    if (audienceType === 'super_manager') return true
    if (audienceType === 'structure_responsible') {
      const sc = normalizeStructure(indicator?.code_structure || occ?.code_structure || occ?.structure)
      return scopeStructureCodes.has(sc)
    }
    return identifierMatchesSet(indicator?.responsable, scopeUserIdentifiers)
  })

  const buildActionStats = (occurrences, usersSubset = scopeUsers) => {
    const rows = occurrences || []
    const enrichedRows = rows.map((occ) => {
      const progress = getActionOccurrenceProgress(taches, occ, today)
      const dateDebut = toDateOnly(occ?.date_debut)
      const dateFin = toDateOnly(occ?.date_fin)
      const started = !!dateDebut && dateDebut <= today
      const isDone = !!progress?.isDone
      const isLate = !isDone && !!dateFin && today > dateFin
      const isStartedActive = started && !isDone && (!dateFin || dateFin >= today)
      return { occ, progress, dateDebut, dateFin, started, isDone, isLate, isStartedActive }
    })

    const relevantRows = enrichedRows.filter((row) => row.started)
    const total = relevantRows.length
    const termineesRows = relevantRows.filter((row) => row.isDone)
    const terminees = termineesRows.length
    const termineesDansDelai = termineesRows.filter(({ occ }) => {
      const dateFin = toDateOnly(occ?.date_fin)
      const dateRealisation = toDateOnly(occ?.date_realisation)
      const dateConf = toDateOnly(occ?.date_conf)
      const ref = dateRealisation || dateConf
      return dateFin && ref && ref <= dateFin
    }).length
    const enRetardRows = relevantRows.filter((row) => row.isLate)
    const enRetard = enRetardRows.length
    const enCoursRows = relevantRows.filter((row) => row.isStartedActive)
    const enCours = enCoursRows.length

    const performanceValues = (usersSubset || [])
      .map((u) => perfCache.get(u.username)?.actionScore ?? null)
      .filter((value) => Number.isFinite(value))

    return {
      total,
      terminees,
      termineesDansDelai,
      enCours,
      enRetard,
      performanceAction: avg(performanceValues)
    }
  }

  const buildIndicatorStats = (occurrences, usersSubset = scopeUsers) => {
    const total = occurrences.length
    const renseignesRows = occurrences.filter((occ) => isFilled(occ.val_indicateur))
    const renseignes = renseignesRows.length
    const renseignesDansDelai = renseignesRows.filter((occ) => {
      const ds = toDateOnly(occ.date_saisie)
      const dl = toDateOnly(occ.date_limite_saisie || occ.date_fin)
      return ds && dl && ds <= dl
    }).length
    const enRetard = occurrences.filter((occ) => {
      const limit = toDateOnly(occ.date_limite_saisie || occ.date_fin)
      return !isFilled(occ.val_indicateur) && limit && today > limit
    }).length
    const indicatorValues = (usersSubset || [])
      .map((u) => perfCache.get(u.username)?.indicatorScore ?? null)
      .filter((value) => Number.isFinite(value))
    const atteinteValues = (usersSubset || [])
      .map((u) => perfCache.get(u.username)?.scoreAtteinteCibles ?? null)
      .filter((value) => Number.isFinite(value))

    return {
      total,
      renseignes,
      renseignesDansDelai,
      enRetard,
      atteinteCible: avg(atteinteValues),
      performanceIndicateurs: avg(indicatorValues)
    }
  }

  const globalActions = buildActionStats(actionOccurrencesInScope, scoreUsers)
  const globalIndicators = buildIndicatorStats(indicatorOccurrencesInScope, scoreUsers)

  const scoreRows = scopeUsers.map((u) => ({
    username: u.username,
    nomComplet: `${u.nom || ''} ${u.prenoms || ''}`.trim(),
    email: u.username,
    structure: normalizeStructure(u.structure || u.code_structure),
    actionScore: perfCache.get(u.username)?.actionScore ?? null,
    indicatorScore: perfCache.get(u.username)?.indicatorScore ?? null,
    scorePerformance: perfCache.get(u.username)?.scorePerformance ?? null
  })).filter((row) => Number.isFinite(row.scorePerformance) || Number.isFinite(row.actionScore) || Number.isFinite(row.indicatorScore))

  const scoreUsernames = new Set((scoreUsers || []).map((u) => String(u?.username || '').trim().toLowerCase()).filter(Boolean))
  const globalScore = avg(
    scoreRows
      .filter((row) => scoreUsernames.has(String(row.username || '').trim().toLowerCase()))
      .map((row) => row.scorePerformance)
      .filter((value) => Number.isFinite(value))
  )

  const structureScores = Array.from(scopeStructureCodes).map((code) => {
    const label = structureMap.get(code)?.libelle_structure || code
    const rows = scoreRows.filter((row) => normalizeStructure(row.structure) === code && scoreUsernames.has(String(row.username || '').trim().toLowerCase()) && Number.isFinite(row.scorePerformance))
    if (!rows.length) return null
    return { code_structure: code, libelle_structure: label, scorePerformance: avg(rows.map((r) => r.scorePerformance)) }
  }).filter(Boolean)

  const actionByStructure = Array.from(scopeStructureCodes).map((code) => {
    const rows = actionOccurrencesInScope.filter((occ) => getActionStructureCode(occ, occ) === code)
    const structureUsers = scoreUsers.filter((u) => normalizeStructure(u.structure || u.code_structure) === code)
    const stats = buildActionStats(rows, structureUsers)
    if (!stats.total && !Number.isFinite(stats.performanceAction)) return null
    return { code_structure: code, libelle_structure: structureMap.get(code)?.libelle_structure || code, stats }
  }).filter(Boolean)

  const indicatorByStructure = Array.from(scopeStructureCodes).map((code) => {
    const occs = indicatorOccurrencesInScope.filter((occ) => normalizeStructure(indicatorMap.get(String(occ.code_indicateur))?.code_structure || occ?.code_structure || occ?.structure) === code)
    const structureUsers = scoreUsers.filter((u) => normalizeStructure(u.structure || u.code_structure) === code)
    const stats = buildIndicatorStats(occs, structureUsers)
    if (!stats.total && !Number.isFinite(stats.performanceIndicateurs)) return null
    return { code_structure: code, libelle_structure: structureMap.get(code)?.libelle_structure || code, stats }
  }).filter(Boolean)


  const activeStartedActionsByStructure = Array.from(scopeStructureCodes).map((code) => {
    const rows = actionOccurrencesInScope
      .filter((occ) => getActionStructureCode(occ, occ) === code)
      .map((occ) => {
        const progress = getActionOccurrenceProgress(taches, occ, today)
        const dateDebut = toDateOnly(occ?.date_debut)
        const dateFin = toDateOnly(occ?.date_fin)
        if (!dateDebut || dateDebut > today || progress?.isDone) return null
        if (dateFin && dateFin < today) return null
        const actionCode = getOccurrenceActionCode(occ)
        const projetCode = String(occ?.code_groupe || '').trim()
        const responsibleUser = resolveUserByIdentifier(occ?.responsable)
        return {
          projet: projetMap.get(projetCode)?.libelle_groupe || projetCode || '-',
          action: occ?.libelle_action || actionCode || '-',
          dates: `${formatDateFr(occ?.date_debut)} au ${formatDateFr(occ?.date_fin)}`,
          avancement: `${Math.round(toNumber(progress?.tx) || 0)}%`,
          joursRestants: dateFin ? Math.max(0, Math.floor((dateFin - today) / 86400000)) : null,
          responsable: `${responsibleUser?.nom || ''} ${responsibleUser?.prenoms || ''}`.trim() || occ?.responsable || '-',
          email: responsibleUser?.username || responsibleUser?.email || '-',
          __sort: getActionRowSortValue(occ)
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aRemain = Number.isFinite(a.joursRestants) ? a.joursRestants : Number.POSITIVE_INFINITY
        const bRemain = Number.isFinite(b.joursRestants) ? b.joursRestants : Number.POSITIVE_INFINITY
        return aRemain - bRemain || b.__sort - a.__sort
      })
      .map(({ __sort, ...row }) => row)
    if (!rows.length) return null
    return { code_structure: code, libelle_structure: structureMap.get(code)?.libelle_structure || code, rows }
  }).filter(Boolean)

  const lateActionsByStructure = Array.from(scopeStructureCodes).map((code) => {
    const rows = actionOccurrencesInScope
      .filter((occ) => getActionStructureCode(occ, occ) === code)
      .map((occ) => {
        const progress = getActionOccurrenceProgress(taches, occ, today)
        if (!(progress?.jourRetard > 0) || progress?.isDone) return null
        const actionCode = getOccurrenceActionCode(occ)
        const projetCode = String(occ?.code_groupe || '').trim()
        const responsibleUser = resolveUserByIdentifier(occ?.responsable)
        return {
          projet: projetMap.get(projetCode)?.libelle_groupe || projetCode || '-',
          action: occ?.libelle_action || actionCode || '-',
          dates: `${formatDateFr(occ?.date_debut)} au ${formatDateFr(occ?.date_fin)}`,
          avancement: `${Math.round(toNumber(progress?.tx) || 0)}%`,
          joursRetard: progress?.jourRetard || 0,
          responsable: `${responsibleUser?.nom || ''} ${responsibleUser?.prenoms || ''}`.trim() || occ?.responsable || '-',
          email: responsibleUser?.username || responsibleUser?.email || '-',
          __sort: getActionRowSortValue(occ)
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.joursRetard - a.joursRetard || b.__sort - a.__sort)
      .map(({ __sort, ...row }) => row)
    if (!rows.length) return null
    return { code_structure: code, libelle_structure: structureMap.get(code)?.libelle_structure || code, rows }
  }).filter(Boolean)

  const lateIndicatorsByStructure = Array.from(scopeStructureCodes).map((code) => {
    const rows = indicatorOccurrencesInScope
      .filter((occ) => normalizeStructure(indicatorMap.get(String(occ.code_indicateur))?.code_structure || occ?.code_structure || occ?.structure) === code)
      .map((occ) => {
        const indicator = indicatorMap.get(String(occ.code_indicateur))
        const deadline = toDateOnly(occ?.date_limite_saisie || occ?.date_fin)
        if (!deadline || isFilled(occ?.val_indicateur) || !(today > deadline)) return null
        const daysLate = Math.floor((today - deadline) / 86400000)
        if (!(daysLate > 0)) return null
        const responsibleUser = resolveUserByIdentifier(indicator?.responsable)
        const groupeCode = String(indicator?.code_groupe || '').trim()
        return {
          groupe: groupeIndMap.get(groupeCode)?.libelle_groupe || groupeCode || '-',
          indicateur: indicator?.libelle_indicateur || indicator?.code_indicateur || '-',
          periode: occ?.periode || occ?.mois || occ?.trimestre || occ?.semestre || occ?.annee || '-',
          dateLimite: formatDateFr(deadline),
          joursRetard: daysLate,
          responsable: `${responsibleUser?.nom || ''} ${responsibleUser?.prenoms || ''}`.trim() || indicator?.responsable || '-',
          email: responsibleUser?.username || responsibleUser?.email || '-'
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.joursRetard - a.joursRetard)
    if (!rows.length) return null
    return { code_structure: code, libelle_structure: structureMap.get(code)?.libelle_structure || code, rows }
  }).filter(Boolean)

  const selfRow = perfCache.get(user.username) || null
  const personalActionOccurrences = actionOccurrencesInScope.filter((occ) => identifierMatchesUser(occ?.responsable, user))
  const personalIndicatorOccurrences = indicatorOccurrencesInScope.filter((occ) => {
    const indicator = indicatorMap.get(String(occ.code_indicateur))
    return identifierMatchesUser(indicator?.responsable, user)
  })
  const selfPerformance = {
    scorePerformance: selfRow?.scorePerformance ?? null,
    actions: {
      ...buildActionStats(personalActionOccurrences, [user]),
      performanceAction: selfRow?.actionScore ?? null,
    },
    indicateurs: {
      ...buildIndicatorStats(personalIndicatorOccurrences, [user]),
      atteinteCible: selfRow?.scoreAtteinteCibles ?? null,
      performanceIndicateurs: selfRow?.indicatorScore ?? null,
    }
  }

  return {
    audienceType,
    personalPerformance: selfPerformance,
    globalScore,
    structureScores,
    actionGlobal: globalActions,
    actionByStructure,
    indicatorGlobal: globalIndicators,
    indicatorByStructure,
    activeStartedActionsByStructure,
    lateActionsByStructure,
    lateIndicatorsByStructure,
    scopeStructureCodes: Array.from(scopeStructureCodes),
    managedStructureCodes: Array.from(managedStructureCodes),
    teamScores: audienceType === 'direct_manager' ? scoreRows : [],
    hasContent: globalActions.total > 0 || globalIndicators.total > 0 || Number.isFinite(globalScore) || activeStartedActionsByStructure.length > 0 || lateActionsByStructure.length > 0 || lateIndicatorsByStructure.length > 0
  }
}
async function loadDataset(supabase) {
  const [
    usersRes,
    structuresRes,
    actionsRes,
    actionOccurrencesRes,
    tachesRes,
    indicateursRes,
    indicateurOccurrencesRes,
    groupesIndicateursRes
  ] = await Promise.all([
    supabase.from('users').select('*').eq('statut', 'Actif'),
    supabase.from('structures').select('*'),
    supabase.from('actions').select('*'),
    supabase.from('action_occurrences').select('*'),
    supabase.from('taches').select('*'),
    supabase.from('indicateurs').select('*'),
    supabase.from('indicateur_occurrences').select('*'),
    supabase.from('groupe_indicateurs').select('*')
  ])

  let groupesActionsRes = await supabase.from('groupe_actions').select('*')
  if (groupesActionsRes?.error) {
    console.warn('[RECAP_HEBDO] Lecture groupe_actions échouée, tentative sur groupes_actions :', groupesActionsRes.error)
    groupesActionsRes = await supabase.from('groupes_actions').select('*')
  }

  const users = usersRes.data || []
  const actions = actionsRes.data || []
  const actionOccurrences = actionOccurrencesRes.data || []
  const taches = tachesRes.data || []
  const indicateurs = indicateursRes.data || []
  const indicateurOccurrences = indicateurOccurrencesRes.data || []
  const structures = structuresRes.data || []
  const groupesActions = groupesActionsRes.data || []
  const groupesIndicateurs = groupesIndicateursRes.data || []

  const dataset = {
    users,
    structures,
    actions,
    actionOccurrences,
    taches,
    indicateurs,
    indicateurOccurrences,
    groupesActions,
    groupesIndicateurs
  }

  const performanceRows = computePerformanceRows({
    users,
    actions,
    actionOccurrences,
    groupesActions,
    indicateurs,
    indicatorOccurrences: indicateurOccurrences,
  })
  const perfCache = new Map(performanceRows.map((row) => [row.username, row]))

  return {
    ...dataset,
    perfCache,
    performanceRows
  }
}


function getEligibleWeeklyRecapUsers(dataset) {
  const priorityRoles = new Set(['Super admin', 'Super manager', 'Manager'])
  const pendingReminderUsers = new Set((getUsersWithPendingReminderItems(dataset) || []).map((user) => String(user?.username || '').trim().toLowerCase()))
  const structureResponsibles = new Set(
    (dataset?.structures || [])
      .map((structure) => [structure?.responsable_structure, structure?.email])
      .flat()
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
  )

  return (dataset?.users || []).filter((candidate) => {
    const username = String(candidate?.username || '').trim().toLowerCase()
    const email = String(candidate?.email || '').trim().toLowerCase()
    return priorityRoles.has(candidate?.type_utilisateur) || pendingReminderUsers.has(username) || structureResponsibles.has(username) || structureResponsibles.has(email)
  })
}

async function sendWeeklyRecapForUsers({ users, dataset, pendingValidationDataset, pendingValidationSettings, supabase, typeEmail, source, createur = null }) {
  let emailsSent = 0
  let emailsFailed = 0
  let usersSkipped = 0
  const results = []

  for (const user of users) {
    try {
      const context = buildRecapContext(user, dataset)
      const canEmbedValidationDigest = user?.type_utilisateur === 'Super manager' || user?.type_utilisateur === 'Manager'
      if (canEmbedValidationDigest && pendingValidationDataset && pendingValidationSettings) {
        const digest = buildPendingValidationDigestForManager(user, pendingValidationDataset, pendingValidationSettings)
        if ((digest?.actions?.total || 0) + (digest?.indicators?.total || 0) > 0) {
          context.pendingValidationDigest = digest
        }
      }
      if (!context.hasContent) {
        usersSkipped++
        results.push({ user: user.username, fullName: `${user.prenoms || ''} ${user.nom || ''}`.trim(), status: 'skipped', reason: 'Aucun contenu à envoyer pour cet utilisateur' })
        continue
      }

      const emailTemplate = getWeeklyRecapEmailTemplate(user, context)
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
        details: { audienceType: context.audienceType, personalPerformance: context.personalPerformance },
        erreur: emailResult.success ? null : emailResult.error,
        source,
        createur
      })

      if (emailResult.success) {
        emailsSent++
        results.push({ user: user.username, fullName: `${user.prenoms || ''} ${user.nom || ''}`.trim(), status: 'sent', audienceType: context.audienceType, score: context.personalPerformance?.scorePerformance ?? null })
      } else {
        emailsFailed++
        results.push({ user: user.username, fullName: `${user.prenoms || ''} ${user.nom || ''}`.trim(), status: 'failed', error: emailResult.error })
      }
    } catch (error) {
      emailsFailed++
      results.push({ user: user.username, fullName: `${user.prenoms || ''} ${user.nom || ''}`.trim(), status: 'failed', error: error.message })
      console.error('[RECAP_HEBDO] Erreur pour', user.username, error)
    }
  }

  return { emailsSent, emailsFailed, usersSkipped, results }
}

export async function GET(request) {
  const startTime = Date.now()
  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')
    const testMode = searchParams.get('test') === 'true'
    const forceParam = searchParams.get('force') || (testMode ? 'true' : null)
    const providedSecret = authHeader?.replace('Bearer ', '') || secretParam

    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (!isWeeklyRecapDay() && forceParam !== 'true') {
      return NextResponse.json({ success: false, blocked: true, reason: 'not_monday', message: 'Le récap hebdomadaire n\'est envoyé automatiquement que le lundi.', day: new Date().toLocaleDateString('fr-FR', { weekday: 'long' }), test_hint: 'Pour un test manuel hors lundi, appelez la route avec ?test=true et le secret CRON.' }, { status: 200 })
    }

    const supabase = createAdminClient(request)
    const today = getTodayDateString()
    const checkResult = await hasAlreadySentThisWeek(supabase)
    if (checkResult.alreadySent && forceParam !== 'true') {
      return NextResponse.json({ success: false, blocked: true, reason: 'already_sent_this_week', message: 'Le récap hebdomadaire a déjà été envoyé cette semaine.', first_email_at: checkResult.firstEmailAt }, { status: 429 })
    }

    const [dataset, pendingValidationDataset, pendingValidationSettings] = await Promise.all([
      loadDataset(supabase),
      loadPendingValidationDataset(supabase),
      getPendingValidationSettings(supabase)
    ])
    const eligibleUsers = getEligibleWeeklyRecapUsers(dataset)
    const usersToProcess = testMode ? filterUsersForTest(eligibleUsers, searchParams) : eligibleUsers

    if (testMode && (searchParams.get('users') || searchParams.get('emails')) && !usersToProcess.length) {
      return NextResponse.json({ success: false, error: 'Aucun utilisateur de test correspondant aux paramètres users/emails.' }, { status: 400 })
    }

    const sendResult = await sendWeeklyRecapForUsers({
      users: usersToProcess,
      dataset,
      pendingValidationDataset,
      pendingValidationSettings,
      supabase,
      typeEmail: 'recap_hebdo',
      source: 'cron_hebdo'
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: today,
      execution_time_ms: Date.now() - startTime,
      summary: {
        total_users: usersToProcess.length,
        emails_sent: sendResult.emailsSent,
        emails_failed: sendResult.emailsFailed,
        users_skipped: sendResult.usersSkipped,
        test_mode: testMode
      },
      test: testMode ? {
        enabled: true,
        targeted_users: usersToProcess.map((user) => user.username),
        targeted_emails: usersToProcess.map((user) => user.email || user.username)
      } : null
    })
  } catch (error) {
    console.error('[CRON_HEBDO] Erreur:', error)
    return NextResponse.json({ success: false, error: error.message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}

export async function POST(request) {
  const startTime = Date.now()
  try {
    const guard = requireAdminAccess(request)
    if (guard instanceof NextResponse) return guard

    const body = await request.json()
    const { targetUser, targetUsers, sendToAll, createur } = body
    const supabase = createAdminClient(request)
    const [dataset, pendingValidationDataset, pendingValidationSettings] = await Promise.all([
      loadDataset(supabase),
      loadPendingValidationDataset(supabase),
      getPendingValidationSettings(supabase)
    ])

    let users = []
    if (sendToAll) {
      users = dataset.users
    } else if (Array.isArray(targetUsers) && targetUsers.length > 0) {
      const uniqueTargets = [...new Set(targetUsers.filter(Boolean))]
      users = dataset.users.filter((item) => uniqueTargets.includes(item.username))
    } else if (targetUser) {
      const target = dataset.users.find((item) => item.username === targetUser)
      if (target) users = [target]
    }
    if (!users.length) {
      return NextResponse.json({ error: 'Aucun utilisateur trouvé' }, { status: 400 })
    }

    const sendResult = await sendWeeklyRecapForUsers({
      users,
      dataset,
      pendingValidationDataset,
      pendingValidationSettings,
      supabase,
      typeEmail: 'recap_hebdo_manuel',
      source: 'manuel_hebdo',
      createur: createur || null
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - startTime,
      summary: {
        total_users: users.length,
        emails_sent: sendResult.emailsSent,
        emails_failed: sendResult.emailsFailed,
        users_skipped: sendResult.usersSkipped
      },
      results: sendResult.results
    })
  } catch (error) {
    console.error('[RECAP_HEBDO_MANUEL] Erreur:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
