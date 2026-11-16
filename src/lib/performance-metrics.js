import { normalizeStructure } from '@/lib/access-scope'

export const ACTION_SCORE_WEIGHTS = {
  completion: 40,
  onTime: 25,
  delayDepth: 20,
  volume: 15,
}

export const INDICATOR_SCORE_WEIGHTS = {
  fillRate: 30,
  onTimeFill: 25,
  delayDepth: 20,
  volume: 10,
  targetAchievement: 15,
}

export const FINAL_SCORE_WEIGHTS = {
  action: 50,
  indicator: 30,
  management: 20,
}

export const DELAY_DEPTH_CAP_DAYS = 30

export const toNumber = (value) => {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export const clamp = (value, min = 0, max = 100) => {
  if (!Number.isFinite(value)) return null
  return Math.min(max, Math.max(min, value))
}

export const isFilled = (value) => value !== null && value !== undefined && `${value}`.trim() !== ''

export const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export const computeRate = (numerator, denominator) => {
  if (!denominator) return null
  return clamp((numerator / denominator) * 100)
}

export const weightedAverage = (items) => {
  const valid = (items || []).filter((item) => Number.isFinite(item?.value) && Number.isFinite(item?.weight) && item.weight > 0)
  if (!valid.length) return null
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0)
  if (!totalWeight) return null
  return clamp(valid.reduce((sum, item) => sum + (item.value * item.weight), 0) / totalWeight)
}

export const delayDepthScore = (averageDelayDays) => {
  if (!Number.isFinite(averageDelayDays)) return null
  return clamp((1 - (averageDelayDays / DELAY_DEPTH_CAP_DAYS)) * 100)
}

export const volumeScore = (volume, referenceVolume) => {
  if (!Number.isFinite(volume) || volume <= 0) return null
  if (!Number.isFinite(referenceVolume) || referenceVolume <= 0) return 100
  return clamp((volume / referenceVolume) * 100)
}

export const averagePositive = (values) => {
  const valid = (values || []).filter((value) => Number.isFinite(value) && value > 0)
  if (!valid.length) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
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

const isWithinSelectedPeriod = (occurrence, periodStart, periodEnd) => {
  if (!periodStart && !periodEnd) return true
  const startDate = toDateOnly(occurrence?.date_debut)
  const endDate = toDateOnly(occurrence?.date_fin)
  if (periodStart && (!startDate || startDate < periodStart)) return false
  if (periodEnd && (!endDate || endDate > periodEnd)) return false
  return true
}

const getEligibleActionOccurrences = (actions, actionOccurrences, groupesActions = []) => {
  const publicProjectCodes = new Set(
    (groupesActions || [])
      .filter((projet) => projet && projet.archive !== true && projet.statut === 'Actif' && `${projet.type_projet || 'Public'}`.trim() === 'Public')
      .map((projet) => String(projet.code_groupe || '').trim())
      .filter(Boolean)
  )

  const eligibleActionsByCode = new Map(
    (actions || [])
      .filter((action) => {
        if (!action || action.archive === true || action.statut === 'Inactif' || action.statut_act === 'Inactif') return false
        const codeGroupe = String(action.code_groupe || '').trim()
        return !!codeGroupe && publicProjectCodes.has(codeGroupe)
      })
      .map((action) => [String(action.code_action || '').trim(), action])
      .filter(([code]) => !!code)
  )

  return (actionOccurrences || [])
    .filter((occ) => {
      if (!occ || occ.archive === true) return false
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
        responsable: occ.responsable || action.responsable || null,
        libelle_action: occ.libelle_action || action.libelle_action || null,
        date_debut: occ.date_debut || null,
        date_fin: occ.date_fin || null,
        date_realisation: occ.date_realisation || null,
        date_conf: occ.date_conf || null,
        tx_avancement: toNumber(occ.tx_avancement) ?? 0,
        archive: false,
        statut: action.statut || action.statut_act || 'Actif',
      }
    })
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
  if (sens === 'Négatif') return v <= c
  return v >= c
}

const getActionDelayDays = (occurrence, referenceToday) => {
  const tx = toNumber(occurrence?.tx_avancement) || 0
  const isDone = tx >= 100
  const dateFin = toDateOnly(occurrence?.date_fin)
  if (!dateFin) return null

  const dateRealisation = toDateOnly(occurrence?.date_realisation)
  const dateConfirmation = toDateOnly(occurrence?.date_conf)
  const referenceDate = isDone ? (dateRealisation || dateConfirmation || referenceToday) : referenceToday
  return Math.floor((referenceDate - dateFin) / 86400000)
}

const getIndicatorDelayDays = (occurrence, referenceToday) => {
  const deadline = toDateOnly(occurrence?.date_limite_saisie) || toDateOnly(occurrence?.date_fin)
  if (!deadline) return null
  const entryDate = isFilled(occurrence?.val_indicateur) ? (toDateOnly(occurrence?.date_saisie) || referenceToday) : referenceToday
  return Math.floor((entryDate - deadline) / 86400000)
}

export function computePerformanceRows({
  users = [],
  actions = [],
  actionOccurrences = [],
  groupesActions = [],
  indicateurs = [],
  indicatorOccurrences = [],
  periodStart = null,
  periodEnd = null,
}) {
  const today = toDateOnly(new Date())
  const activeUsers = (users || []).filter(Boolean)
  const activeIndicators = (indicateurs || []).filter((ind) => ind && ind.archive !== true && ind.statut !== 'Inactif')
  const indicatorMap = new Map(activeIndicators.map((ind) => [String(ind.code_indicateur), ind]))
  const eligibleActionOccurrences = getEligibleActionOccurrences(actions, actionOccurrences, groupesActions)
    .filter((occ) => isWithinSelectedPeriod(occ, periodStart, periodEnd))
  const eligibleIndicatorOccurrences = (indicatorOccurrences || []).filter((occ) => {
    if (!occ || occ.archive === true || occ.statut === 'Inactif') return false
    if (!indicatorMap.has(String(occ.code_indicateur))) return false
    return isWithinSelectedPeriod(occ, periodStart, periodEnd)
  })

  const structureMetricsMap = {}
  eligibleIndicatorOccurrences.forEach((occ) => {
    const indicator = indicatorMap.get(String(occ.code_indicateur))
    const structureCode = normalizeStructure(indicator?.code_structure || occ?.code_structure || occ?.structure)
    if (!structureCode) return

    const dueDate = toDateOnly(occ.date_fin)
    const isDue = !!dueDate && dueDate < today
    const valueFilled = isFilled(occ.val_indicateur)
    const dateSaisie = toDateOnly(occ.date_saisie)
    const dateLimite = toDateOnly(occ.date_limite_saisie) || dueDate
    const delayDays = getIndicatorDelayDays(occ, today)

    if (!structureMetricsMap[structureCode]) {
      structureMetricsMap[structureCode] = {
        totalIndicatorsVolume: 0,
        dueIndicatorsCount: 0,
        filledDueIndicatorsCount: 0,
        filledDueIndicatorsOnTimeCount: 0,
        reachedTargetIndicatorsCount: 0,
        delayValues: [],
        scoreSaisieEchues: null,
        scoreSaisieDelai: null,
        scoreRetardSaisie: null,
        scoreVolumeIndicateurs: null,
        scoreAtteinteCibles: null,
        indicatorScore: null,
      }
    }

    const metrics = structureMetricsMap[structureCode]
    metrics.totalIndicatorsVolume += 1
    if (!isDue) return

    metrics.dueIndicatorsCount += 1
    if (valueFilled) {
      metrics.filledDueIndicatorsCount += 1
      if (dateSaisie && dateLimite && dateSaisie <= dateLimite) {
        metrics.filledDueIndicatorsOnTimeCount += 1
      }
      const cible = getIndicatorCible(indicator, occ)
      if (isTargetReached(occ.val_indicateur, cible, indicator?.sens)) {
        metrics.reachedTargetIndicatorsCount += 1
      }
    }

    if (Number.isFinite(delayDays) && delayDays > 0) {
      metrics.delayValues.push(delayDays)
    }
  })

  const avgIndicatorVolume = activeUsers.length
    ? Object.values(structureMetricsMap).reduce((sum, item) => sum + (item.totalIndicatorsVolume || 0), 0) / Math.max(Object.keys(structureMetricsMap).length, 1)
    : 0

  Object.values(structureMetricsMap).forEach((metrics) => {
    metrics.scoreSaisieEchues = computeRate(metrics.filledDueIndicatorsCount, metrics.dueIndicatorsCount)
    metrics.scoreSaisieDelai = computeRate(metrics.filledDueIndicatorsOnTimeCount, metrics.dueIndicatorsCount)
    metrics.averageDelayDays = averagePositive(metrics.delayValues)
    metrics.scoreRetardSaisie = metrics.dueIndicatorsCount ? delayDepthScore(metrics.averageDelayDays) : null
    metrics.scoreVolumeIndicateurs = volumeScore(metrics.totalIndicatorsVolume, avgIndicatorVolume)
    metrics.scoreAtteinteCibles = computeRate(metrics.reachedTargetIndicatorsCount, metrics.filledDueIndicatorsCount)
    metrics.indicatorScore = weightedAverage([
      { value: metrics.scoreSaisieEchues, weight: INDICATOR_SCORE_WEIGHTS.fillRate },
      { value: metrics.scoreSaisieDelai, weight: INDICATOR_SCORE_WEIGHTS.onTimeFill },
      { value: metrics.scoreRetardSaisie, weight: INDICATOR_SCORE_WEIGHTS.delayDepth },
      { value: metrics.scoreVolumeIndicateurs, weight: INDICATOR_SCORE_WEIGHTS.volume },
      { value: metrics.scoreAtteinteCibles, weight: INDICATOR_SCORE_WEIGHTS.targetAchievement },
    ])
  })

  const userActionVolumeMap = new Map()
  activeUsers.forEach((user) => {
    const identifiers = getUserIdentifiers(user)
    const allAssignedActions = eligibleActionOccurrences.filter((occ) => identifierMatchesSet(occ.responsable, identifiers))
    userActionVolumeMap.set(user.username, allAssignedActions.length)
  })
  const avgActionVolume = activeUsers.length
    ? Array.from(userActionVolumeMap.values()).reduce((sum, value) => sum + value, 0) / activeUsers.length
    : 0

  const baseRows = activeUsers.map((user) => {
    const identifiers = getUserIdentifiers(user)
    const structureCode = normalizeStructure(user.structure || user.code_structure)
    const assignedActions = eligibleActionOccurrences.filter((occ) => identifierMatchesSet(occ.responsable, identifiers))
    const dueActions = assignedActions.filter((occ) => {
      const endDate = toDateOnly(occ.date_fin)
      return endDate && endDate < today
    })
    const realisedDueActions = dueActions.filter((occ) => (toNumber(occ.tx_avancement) || 0) >= 100)
    const realisedOnTimeActions = realisedDueActions.filter((occ) => {
      const delay = getActionDelayDays(occ, today)
      return Number.isFinite(delay) && delay <= 0
    })
    const actionDelayValues = dueActions
      .map((occ) => getActionDelayDays(occ, today))
      .filter((delay) => Number.isFinite(delay) && delay > 0)

    const scoreActionsRealisees = computeRate(realisedDueActions.length, dueActions.length)
    const actionsMetricsAvailable = Number.isFinite(scoreActionsRealisees)
    const scoreActionsDansDelai = actionsMetricsAvailable ? computeRate(realisedOnTimeActions.length, dueActions.length) : null
    const scoreRetardActions = actionsMetricsAvailable ? delayDepthScore(averagePositive(actionDelayValues)) : null
    const scoreVolumeActions = actionsMetricsAvailable ? volumeScore(assignedActions.length, avgActionVolume) : null
    const actionComponents = [
      scoreActionsRealisees,
      scoreActionsDansDelai,
      scoreRetardActions,
      scoreVolumeActions,
    ]
    const actionScore = actionsMetricsAvailable && !actionComponents.every((value) => !Number.isFinite(value))
      ? weightedAverage([
          { value: scoreActionsRealisees, weight: ACTION_SCORE_WEIGHTS.completion },
          { value: scoreActionsDansDelai, weight: ACTION_SCORE_WEIGHTS.onTime },
          { value: scoreRetardActions, weight: ACTION_SCORE_WEIGHTS.delayDepth },
          { value: scoreVolumeActions, weight: ACTION_SCORE_WEIGHTS.volume },
        ])
      : null

    const structureIndicatorMetrics = structureMetricsMap[structureCode] || {}
    const indicatorsMetricsAvailable = Number.isFinite(structureIndicatorMetrics.scoreSaisieEchues)
    const scoreSaisieDelai = indicatorsMetricsAvailable ? (structureIndicatorMetrics.scoreSaisieDelai ?? null) : null
    const scoreRetardSaisie = indicatorsMetricsAvailable ? (structureIndicatorMetrics.scoreRetardSaisie ?? null) : null
    const scoreVolumeIndicateurs = indicatorsMetricsAvailable ? (structureIndicatorMetrics.scoreVolumeIndicateurs ?? null) : null
    const scoreAtteinteCibles = indicatorsMetricsAvailable ? (structureIndicatorMetrics.scoreAtteinteCibles ?? null) : null
    const indicatorComponents = [
      structureIndicatorMetrics.scoreSaisieEchues ?? null,
      scoreSaisieDelai,
      scoreRetardSaisie,
      scoreVolumeIndicateurs,
      scoreAtteinteCibles,
    ]
    const indicatorScore = indicatorsMetricsAvailable && !indicatorComponents.every((value) => !Number.isFinite(value))
      ? structureIndicatorMetrics.indicatorScore ?? weightedAverage([
          { value: structureIndicatorMetrics.scoreSaisieEchues, weight: INDICATOR_SCORE_WEIGHTS.fillRate },
          { value: scoreSaisieDelai, weight: INDICATOR_SCORE_WEIGHTS.onTimeFill },
          { value: scoreRetardSaisie, weight: INDICATOR_SCORE_WEIGHTS.delayDepth },
          { value: scoreVolumeIndicateurs, weight: INDICATOR_SCORE_WEIGHTS.volume },
          { value: scoreAtteinteCibles, weight: INDICATOR_SCORE_WEIGHTS.targetAchievement },
        ])
      : null
    const coreScore = [actionScore, indicatorScore].every((value) => !Number.isFinite(value))
      ? null
      : weightedAverage([
          { value: actionScore, weight: FINAL_SCORE_WEIGHTS.action },
          { value: indicatorScore, weight: FINAL_SCORE_WEIGHTS.indicator },
        ])

    return {
      ...user,
      code_structure: structureCode || user.structure || user.code_structure || '',
      email: user.username,
      dueActionsCount: dueActions.length,
      realisedActionsCount: realisedDueActions.length,
      realisedOnTimeActionsCount: realisedOnTimeActions.length,
      actionDelayAverageDays: dueActions.length ? averagePositive(actionDelayValues) : null,
      actionVolumeCount: assignedActions.length,
      scoreActionsRealisees,
      scoreActionsDansDelai,
      scoreRetardActions,
      scoreVolumeActions,
      actionScore,
      dueIndicatorsCount: structureIndicatorMetrics.dueIndicatorsCount || 0,
      filledDueIndicatorsCount: structureIndicatorMetrics.filledDueIndicatorsCount || 0,
      filledDueIndicatorsOnTimeCount: structureIndicatorMetrics.filledDueIndicatorsOnTimeCount || 0,
      reachedTargetIndicatorsCount: structureIndicatorMetrics.reachedTargetIndicatorsCount || 0,
      indicatorDelayAverageDays: structureIndicatorMetrics.averageDelayDays ?? null,
      indicatorVolumeCount: structureIndicatorMetrics.totalIndicatorsVolume || 0,
      scoreSaisieEchues: structureIndicatorMetrics.scoreSaisieEchues ?? null,
      scoreSaisieDelai,
      scoreRetardSaisie,
      scoreVolumeIndicateurs,
      scoreAtteinteCibles,
      indicatorScore,
      coreScore,
      managementScore: null,
      scorePerformance: coreScore,
    }
  })

  const rowsByUsername = new Map(baseRows.map((row) => [row.username, row]))

  const getDirectReports = (manager) => {
    const identifiers = getUserIdentifiers(manager)
    return baseRows.filter((row) => row.username !== manager.username && identifierMatchesSet(row.superieur, identifiers))
  }

  const scoreMemo = new Map()
  const managementMemo = new Map()

  const computeFinalScore = (username, stack = new Set()) => {
    if (scoreMemo.has(username)) return scoreMemo.get(username)
    const row = rowsByUsername.get(username)
    if (!row) return null
    if (stack.has(username)) return row.coreScore
    stack.add(username)

    const directReports = getDirectReports(row)
    let managementScore = null
    if (directReports.length) {
      const subordinateScores = directReports
        .map((report) => computeFinalScore(report.username, new Set(stack)))
        .filter(Number.isFinite)
      managementScore = subordinateScores.length
        ? subordinateScores.reduce((sum, value) => sum + value, 0) / subordinateScores.length
        : null
    }

    const scoreInputs = [row.actionScore, row.indicatorScore, managementScore]
    const finalScore = scoreInputs.every((value) => !Number.isFinite(value))
      ? null
      : weightedAverage([
          { value: row.actionScore, weight: FINAL_SCORE_WEIGHTS.action },
          { value: row.indicatorScore, weight: FINAL_SCORE_WEIGHTS.indicator },
          { value: managementScore, weight: FINAL_SCORE_WEIGHTS.management },
        ])

    managementMemo.set(username, managementScore)
    scoreMemo.set(username, finalScore)
    return finalScore
  }

  return baseRows.map((row) => {
    const subordinates = getDirectReports(row)
    const managementScore = computeFinalScore(row.username) !== null ? managementMemo.get(row.username) ?? null : null
    return {
      ...row,
      subordinateCount: subordinates.length,
      managementScore,
      scorePerformance: computeFinalScore(row.username),
      subordinates: subordinates.map((item) => `${item.nom || ''} ${item.prenoms || ''}`.trim()).filter(Boolean),
    }
  }).sort((a, b) => {
    if (!Number.isFinite(a.scorePerformance) && !Number.isFinite(b.scorePerformance)) return 0
    if (!Number.isFinite(a.scorePerformance)) return 1
    if (!Number.isFinite(b.scorePerformance)) return -1
    if (b.scorePerformance !== a.scorePerformance) return b.scorePerformance - a.scorePerformance
    return `${a.nom || ''} ${a.prenoms || ''}`.localeCompare(`${b.nom || ''} ${b.prenoms || ''}`, 'fr')
  })
}
