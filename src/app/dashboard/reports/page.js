'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, RefreshCw, ShieldAlert, Activity, BarChart3, CheckCircle2, AlertTriangle, Layers, Loader2, RotateCcw, Shield, Target, TrendingDown } from 'lucide-react'
import jsPDF from 'jspdf'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RePieChart, Pie, Cell } from 'recharts'
import { Button, SearchableSelect } from '@/components/ui'
import { calculateCriticite, calculateImpactNet, getNiveauCriticite } from '@/lib/risk-metrics'
import { calculateProbabiliteIndex } from '@/lib/probabilite-utils'
import { computePlanRiskStats, toDateOnly as toDateOnlyRisk } from '@/lib/risques-plan-stats'
import { isPrivilegedUser, normalizeStructure } from '@/lib/access-scope'
import { computePerformanceRows } from '@/lib/performance-metrics'

export const dynamic = 'force-dynamic'

const CARD_CLASS = 'rounded-[24px] border border-slate-200 bg-white shadow-sm'
const SUBCARD_CLASS = 'rounded-[18px] border border-slate-200 bg-slate-50/70'
const SECTION_TITLE_CLASS = 'text-xl md:text-2xl font-bold text-[#1f3763]'
const PIE_COLORS = ['#1d4ed8', '#059669', '#d97706', '#dc2626']
const moisList = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']

const normalizeLoose = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[_/]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const periodSortValue = (period) => {
  if (!period?.annee) return -1
  const year = Number(period.annee) || 0
  const month = Number(period.mois) || 0
  const quarter = Number(period.trimestre) || 0
  const semester = Number(period.semestre) || 0
  return year * 10000 + month * 100 + quarter * 10 + semester
}

const buildPeriodAliases = (period) => {
  if (!period) return []
  const aliases = new Set()
  const year = String(period.annee || '').trim()
  const semester = String(period.semestre || '').trim()
  const quarter = String(period.trimestre || '').trim()
  const monthNum = Number(period.mois) || 0
  const monthLabel = monthNum ? moisList[monthNum - 1] : ''

  ;[period.libelle_periode, period.periode, period.libelle].filter(Boolean).forEach((value) => aliases.add(normalizeLoose(value)))
  if (year) aliases.add(normalizeLoose(year))
  if (year && semester) {
    aliases.add(normalizeLoose(`S${semester}-${year}`))
    aliases.add(normalizeLoose(`Semestre ${semester} ${year}`))
    aliases.add(normalizeLoose(`${year} Semestre ${semester}`))
  }
  if (year && quarter) {
    aliases.add(normalizeLoose(`T${quarter}-${year}`))
    aliases.add(normalizeLoose(`Trimestre ${quarter} ${year}`))
    aliases.add(normalizeLoose(`${year} Trimestre ${quarter}`))
  }
  if (year && monthNum) {
    const mm = String(monthNum).padStart(2, '0')
    aliases.add(normalizeLoose(`M${mm}-${year}`))
    aliases.add(normalizeLoose(`${monthLabel}-${year}`))
    aliases.add(normalizeLoose(`${monthLabel} ${year}`))
    aliases.add(normalizeLoose(`${year} ${monthLabel}`))
  }
  return [...aliases].filter(Boolean)
}

const buildScopePeriod = (scope) => ({
  annee: scope?.riskYear || '',
  semestre: scope?.riskSemester ? String(scope.riskSemester).replace(/^S/, '') : '',
  trimestre: scope?.riskTrimester ? String(scope.riskTrimester).replace(/^T/, '') : '',
  mois: scope?.riskMonth ? String(scope.riskMonth) : '',
})

const findMatchingPeriod = (periodes = [], periodScope = {}) => {
  const year = String(periodScope.annee || '').trim()
  const semester = String(periodScope.semestre || '').replace(/^Semestre\s*/i, '').replace(/^S/i, '').trim()
  const quarter = String(periodScope.trimestre || '').replace(/^Trimestre\s*/i, '').replace(/^T/i, '').trim()
  const monthRaw = String(periodScope.mois || '').trim()
  const monthIndex = monthRaw ? (Number.isFinite(Number(monthRaw)) ? Number(monthRaw) : moisList.findIndex((m) => normalizeLoose(m) === normalizeLoose(monthRaw)) + 1) : 0

  if (!year) return null

  const candidates = (periodes || []).filter((period) => String(period?.annee || '').trim() == year)
  if (monthIndex) return candidates.find((period) => Number(period?.mois || 0) === monthIndex) || null
  if (quarter) return candidates.find((period) => String(period?.trimestre || '').trim() == quarter) || null
  if (semester) return candidates.find((period) => String(period?.semestre || '').trim() == semester) || null
  return candidates.find((period) => !period?.semestre && !period?.trimestre && !period?.mois) || candidates.sort((a, b) => periodSortValue(b) - periodSortValue(a))[0] || null
}

const matchPeriodString = (value, period) => {
  const normalized = normalizeLoose(value)
  if (!normalized || !period) return false
  return buildPeriodAliases(period).includes(normalized)
}

const getPreviousComparablePeriod = (periodes = [], selectedPeriod = null) => {
  if (!selectedPeriod?.annee) return null
  const mode = selectedPeriod?.mois ? 'mois' : selectedPeriod?.trimestre ? 'trimestre' : selectedPeriod?.semestre ? 'semestre' : 'annee'
  return [...(periodes || [])]
    .filter((period) => {
      if (!period?.annee) return false
      if (mode === 'mois') return !!period?.mois
      if (mode === 'trimestre') return !!period?.trimestre && !period?.mois
      if (mode === 'semestre') return !!period?.semestre && !period?.trimestre && !period?.mois
      return !period?.semestre && !period?.trimestre && !period?.mois
    })
    .sort((a, b) => periodSortValue(b) - periodSortValue(a))
    .find((period) => periodSortValue(period) < periodSortValue(selectedPeriod)) || null
}


const toNumber = (value) => {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

const isFilled = (value) => !(value === null || value === undefined || `${value}`.trim() === '')
const avg = (values = []) => {
  const valid = values.filter((value) => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}
const computeRate = (num, den) => (!den ? null : (num / den) * 100)

const toDateOnly = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const normalizeUsername = (value) => String(value || '').trim().toLowerCase()
const getUserIdentifiers = (user) => new Set([user?.username, user?.email].filter(Boolean).map(normalizeUsername))
const identifierMatchesSet = (value, identifiers) => !!value && identifiers?.has(normalizeUsername(value))
const unique = (values = []) => [...new Set(values.filter(Boolean))]

const isFalseLike = (value) => {
  if (value === false || value === null || value === undefined || value === 0) return true
  const normalized = String(value).trim().toLowerCase()
  return normalized === '' || normalized === 'false' || normalized === '0' || normalized === 'non'
}
const isTrueLike = (value) => !isFalseLike(value)

const formatPct = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}%` : 'N/A')
const formatDateFr = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('fr-FR')
}

const formatDateRange = (start, end) => {
  if (!start && !end) return '-'
  if (start && end) return `Du ${formatDateFr(start)} au ${formatDateFr(end)}`
  if (start) return `À partir du ${formatDateFr(start)}`
  return `Jusqu'au ${formatDateFr(end)}`
}

const getIndicatorProjectCodes = (indicator) => {
  const values = []
  const pushValue = (value) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) return value.forEach(pushValue)
    if (typeof value === 'string' && (value.includes(',') || value.includes(';'))) {
      value.split(/[;,]/).forEach(pushValue)
      return
    }
    const normalized = String(value).trim()
    if (normalized) values.push(normalized)
  }
  pushValue(indicator?.code_groupe)
  pushValue(indicator?.groupe)
  pushValue(indicator?.groupes)
  pushValue(indicator?.code_projet)
  return unique(values)
}

const getOccurrenceActionCode = (occ) => String(occ?.code_action || occ?.code_action_occ || occ?.__actionCode || '').trim()
const getActionStructureCode = (action, occ) => normalizeStructure(occ?.code_structure || occ?.structure || action?.code_structure || action?.structure || '')

const getActionDelayDays = (occurrence, today = null) => {
  const currentDay = today || toDateOnly(new Date())
  const tx = toNumber(occurrence?.tx_avancement) || 0
  const isDone = tx >= 100
  const dateFin = toDateOnly(occurrence?.date_fin)
  if (!dateFin) return 0
  const dateRealisation = toDateOnly(occurrence?.date_realisation)
  const dateConfirmation = toDateOnly(occurrence?.date_conf)
  const referenceDate = isDone ? (dateRealisation || dateConfirmation || currentDay) : currentDay
  return Math.floor((referenceDate - dateFin) / 86400000)
}

const getActionProgressLabel = (occurrence) => {
  const tx = toNumber(occurrence?.tx_avancement) || 0
  if (tx === 0) return 'Non entamée'
  if (tx <= 50) return 'En cours -50%'
  if (tx < 100) return 'En cours +50%'
  if (tx >= 100 && occurrence?.gestionnaire_conf !== 'Oui') return 'Terminée - non confirmée'
  return 'Achevée'
}

const getIndicatorTarget = (indicator, occurrence) => {
  const directTarget = toNumber(occurrence?.cible)
  if (directTarget !== null) return directTarget
  const projectCodes = getIndicatorProjectCodes(indicator)
  const isRiskIndicator = projectCodes.some((code) => String(code || '').trim().toLowerCase() === 'risque')
  if (isRiskIndicator) {
    const sens = String(indicator?.sens || '').trim().toLowerCase()
    return sens === 'négatif' || sens === 'negatif' ? toNumber(indicator?.seuil1) : toNumber(indicator?.seuil3)
  }
  return toNumber(indicator?.cible)
}

const isTargetReached = (value, target, sens) => {
  const numericValue = toNumber(value)
  const numericTarget = toNumber(target)
  if (numericValue === null || numericTarget === null) return false
  const normalizedSens = String(sens || '').trim().toLowerCase()
  return normalizedSens === 'négatif' || normalizedSens === 'negatif' ? numericValue <= numericTarget : numericValue >= numericTarget
}

const buildPerformanceRows = ({ users = [], actions = [], actionOccurrences = [], groupesActions = [], indicateurs = [], indicatorOccurrences = [], selectedStructureCodes = [] }) => {
  const structureSet = new Set((selectedStructureCodes || []).map((value) => normalizeStructure(value)).filter(Boolean))
  const rows = computePerformanceRows({
    users,
    actions,
    actionOccurrences,
    groupesActions,
    indicateurs,
    indicatorOccurrences,
  })
  if (!structureSet.size) return rows
  return rows.filter((row) => structureSet.has(normalizeStructure(row.code_structure)))
}


const buildActionSection = ({ structures = [], users = [], groupesActions = [], actions = [], actionOccurrences = [], performanceRows = [], selectedStructureCodes = [], selectedProjectCodes = [] }) => {
  const today = toDateOnly(new Date())
  const structureLabelMap = new Map((structures || []).map((item) => [normalizeStructure(item?.code_structure), item?.libelle_structure || item?.code_structure]))
  const usersMap = new Map((users || []).map((user) => [normalizeUsername(user?.username), user]))
  const structureSet = new Set((selectedStructureCodes || []).map((value) => normalizeStructure(value)))
  const projectSet = new Set((selectedProjectCodes || []).map((value) => String(value).trim()))

  const publicProjectCodes = new Set(
    (groupesActions || [])
      .filter((project) => project && !isTrueLike(project.archive) && String(project?.type_projet || 'Public').trim().toLowerCase() === 'public')
      .map((project) => String(project?.code_groupe || '').trim())
      .filter(Boolean)
  )

  const actionMap = new Map(
    (actions || [])
      .filter((action) => action && !isTrueLike(action.archive) && String(action?.statut || action?.statut_act || 'Actif').trim() !== 'Inactif')
      .map((action) => [String(action?.code_action || '').trim(), action])
  )

  const rows = (actionOccurrences || [])
    .filter((occ) => occ && !isTrueLike(occ.archive))
    .map((occ) => {
      const action = actionMap.get(getOccurrenceActionCode(occ))
      if (!action) return null
      const projectCode = String(action?.code_groupe || '').trim()
      if (!publicProjectCodes.has(projectCode)) return null
      if (projectSet.size > 0 && !projectSet.has(projectCode)) return null
      const structureCode = getActionStructureCode(action, occ)
      if (structureSet.size > 0 && !structureSet.has(structureCode)) return null
      const responsable = usersMap.get(normalizeUsername(occ.responsable)) || null
      const tx = toNumber(occ.tx_avancement) || 0
      const daysLate = getActionDelayDays(occ, today)
      return {
        ...occ,
        __action: action,
        __structure: structureCode,
        __projectCode: projectCode,
        __projectLabel: (groupesActions || []).find((project) => String(project?.code_groupe || '').trim() === projectCode)?.libelle_groupe || projectCode,
        __responsable: responsable,
        __daysLate: daysLate,
        __done: tx >= 100,
        __tx: tx,
      }
    })
    .filter(Boolean)

  const getPerformanceAction = (structureCode = null) => {
    const values = (performanceRows || [])
      .filter((row) => !structureCode || normalizeStructure(row.code_structure) === normalizeStructure(structureCode))
      .map((row) => row.actionScore)
      .filter(Number.isFinite)
    return values.length ? avg(values) : null
  }

  const buildStats = (items) => {
    const total = items.length
    const terminees = items.filter((item) => item.__tx >= 100).length
    const termineesDansDelai = items.filter((item) => item.__tx >= 100 && item.date_realisation && toDateOnly(item.date_realisation) && toDateOnly(item.date_fin) && toDateOnly(item.date_fin) >= toDateOnly(item.date_realisation)).length
    const enCours = items.filter((item) => item.__tx < 100).length
    const enRetard = items.filter((item) => item.__tx < 100 && item.__daysLate > 0).length
    return { total, terminees, termineesDansDelai, enCours, enRetard }
  }

  const globalStats = { ...buildStats(rows), performanceAction: getPerformanceAction() }

  const byStructure = unique(rows.map((row) => row.__structure)).map((structureCode) => {
    const items = rows.filter((row) => row.__structure === structureCode)
    return {
      code: structureCode,
      label: structureLabelMap.get(structureCode) || structureCode,
      ...buildStats(items),
      performanceAction: getPerformanceAction(structureCode),
    }
  }).filter((item) => item.total > 0).sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))

  const delayedByStructure = byStructure.map((structure) => ({
    code: structure.code,
    label: structure.label,
    rows: rows
      .filter((row) => row.__structure === structure.code && row.__tx < 100 && row.__daysLate > 0)
      .sort((a, b) => (b.__daysLate - a.__daysLate) || (String(a.__projectLabel || '').localeCompare(String(b.__projectLabel || ''), 'fr', { sensitivity: 'base' })))
  })).filter((entry) => entry.rows.length > 0)

  return { globalStats, byStructure, delayedByStructure, hasData: rows.length > 0 }
}

const buildIndicatorSection = ({ structures = [], users = [], indicateurs = [], indicatorOccurrences = [], performanceRows = [], selectedStructureCodes = [], selectedGroupCodes = [] }) => {
  const today = toDateOnly(new Date())
  const structureLabelMap = new Map((structures || []).map((item) => [normalizeStructure(item?.code_structure), item?.libelle_structure || item?.code_structure]))
  const usersMap = new Map((users || []).map((user) => [normalizeUsername(user?.username), user]))
  const structureSet = new Set((selectedStructureCodes || []).map((value) => normalizeStructure(value)))
  const groupSet = new Set((selectedGroupCodes || []).map((value) => String(value).trim()))

  const indicatorMap = new Map(
    (indicateurs || [])
      .filter((indicator) => indicator && !isTrueLike(indicator.archive) && String(indicator?.statut || 'Actif').trim() !== 'Inactif')
      .map((indicator) => [String(indicator?.code_indicateur || '').trim(), indicator])
  )

  const rows = (indicatorOccurrences || [])
    .filter((occ) => occ && !isTrueLike(occ.archive))
    .map((occ) => {
      const indicator = indicatorMap.get(String(occ?.code_indicateur || occ?.code_indicateur_occ || '').trim())
      if (!indicator) return null
      const structureCode = normalizeStructure(occ?.code_structure || indicator?.code_structure || occ?.structure || indicator?.structure || '')
      if (structureSet.size > 0 && !structureSet.has(structureCode)) return null
      const groups = getIndicatorProjectCodes(indicator)
      if (groupSet.size > 0 && !groups.some((group) => groupSet.has(String(group).trim()))) return null
      const dateLimite = toDateOnly(occ.date_limite_saisie || occ.date_fin)
      const dateSaisie = toDateOnly(occ.date_saisie)
      const isFilledOccurrence = isFilled(occ.val_indicateur)
      return {
        ...occ,
        __indicator: indicator,
        __structure: structureCode,
        __groups: groups,
        __filled: isFilledOccurrence,
        __late: !isFilledOccurrence && dateLimite && today > dateLimite,
        __filledOnTime: isFilledOccurrence && dateSaisie && dateLimite && dateSaisie <= dateLimite,
        __targetReached: isTargetReached(occ.val_indicateur, getIndicatorTarget(indicator, occ), indicator?.sens),
        __responsable: usersMap.get(normalizeUsername(indicator?.responsable)) || null,
      }
    })
    .filter(Boolean)

  const getPerformanceIndicators = (structureCode = null) => {
    const values = (performanceRows || [])
      .filter((row) => !structureCode || normalizeStructure(row.code_structure) === normalizeStructure(structureCode))
      .map((row) => row.indicatorScore)
      .filter(Number.isFinite)
    return values.length ? avg(values) : null
  }

  const buildStats = (items) => {
    const total = items.length
    const renseignes = items.filter((item) => item.__filled).length
    const renseignesDansDelai = items.filter((item) => item.__filledOnTime).length
    const enRetard = items.filter((item) => item.__late).length
    const atteints = items.filter((item) => item.__targetReached).length
    return {
      total,
      renseignes,
      renseignesDansDelai,
      enRetard,
      txAtteinte: computeRate(atteints, renseignes),
    }
  }

  const globalStats = { ...buildStats(rows), performanceIndicateurs: getPerformanceIndicators() }

  const byStructure = unique(rows.map((row) => row.__structure)).map((structureCode) => {
    const items = rows.filter((row) => row.__structure === structureCode)
    return {
      code: structureCode,
      label: structureLabelMap.get(structureCode) || structureCode,
      ...buildStats(items),
      performanceIndicateurs: getPerformanceIndicators(structureCode),
    }
  }).filter((item) => item.total > 0).sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))

  const delayedByStructure = byStructure.map((structure) => ({
    code: structure.code,
    label: structure.label,
    rows: rows
      .filter((row) => row.__structure === structure.code && row.__late)
      .sort((a, b) => {
        const lateA = Math.max(0, Math.floor(((today || new Date()) - toDateOnly(a.date_limite_saisie || a.date_fin)) / 86400000))
        const lateB = Math.max(0, Math.floor(((today || new Date()) - toDateOnly(b.date_limite_saisie || b.date_fin)) / 86400000))
        return lateB - lateA
      })
  })).filter((entry) => entry.rows.length > 0)

  return { globalStats, byStructure, delayedByStructure, hasData: rows.length > 0 }
}

const buildRiskSection = ({ structures = [], periodes = [], risques = [], probabilites = [], planMaitrise = [], riskPlanRows = [], indicatorOccurrences = [], processus = [], selectedStructureCodes = [], riskPeriod = null, riskTypeCriticite = 'Nette' }) => {
  const structureSet = new Set((selectedStructureCodes || []).map((value) => normalizeStructure(value)).filter(Boolean))
  const useBrute = String(riskTypeCriticite || 'Nette').trim() === 'Brute'
  const allPeriodes = [...(periodes || [])]
  const risquesProbabilites = [...(probabilites || [])]
  const occurrences = [...(indicatorOccurrences || [])]

  let filtered = (risques || [])
    .filter((risk) => risk && !isTrueLike(risk.archive) && String(risk?.statut || 'Actif').trim() === 'Actif')
    .filter((risk) => !structureSet.size || structureSet.has(normalizeStructure(risk?.code_structure || risk?.structure)))

  const getPeriodeKeyRisques = () => {
    if (!riskPeriod?.annee) return null
    const annee = String(riskPeriod.annee)
    if (riskPeriod.mois) return `${riskPeriod.mois}-${annee}`
    if (riskPeriod.trimestre) {
      const num = String(riskPeriod.trimestre).match(/(\d+)/)?.[1]
      return num ? `T${num}-${annee}` : null
    }
    if (riskPeriod.semestre) {
      const num = String(riskPeriod.semestre).match(/(\d+)/)?.[1]
      return num ? `S${num}-${annee}` : null
    }
    return annee
  }

  const getPeriodeDateDebut = (periode) => {
    if (!periode?.annee) return new Date(0)
    const annee = parseInt(periode.annee, 10)
    if (periode.mois) {
      const moisNum = typeof periode.mois === 'number' ? periode.mois : moisList.indexOf(periode.mois) + 1
      return new Date(annee, moisNum - 1, 1)
    }
    if (periode.trimestre) {
      const trimNum = typeof periode.trimestre === 'number' ? periode.trimestre : parseInt(String(periode.trimestre).replace(/\D/g, ''), 10)
      return new Date(annee, (trimNum - 1) * 3, 1)
    }
    if (periode.semestre) {
      const semNum = typeof periode.semestre === 'number' ? periode.semestre : parseInt(String(periode.semestre).replace(/\D/g, ''), 10)
      return new Date(annee, (semNum - 1) * 6, 1)
    }
    return new Date(annee, 0, 1)
  }

  const findSelectedPeriodeFromForm = (form) => {
    if (!form?.annee) return null
    const annee = parseInt(form.annee, 10)
    return allPeriodes.find((p) => {
      if (p.annee !== annee) return false
      if (form.mois) {
        const moisNum = typeof form.mois === 'string' && Number.isNaN(parseInt(form.mois, 10))
          ? moisList.indexOf(form.mois) + 1
          : parseInt(form.mois, 10)
        return p.mois === moisNum && !p.semestre && !p.trimestre
      }
      if (form.trimestre) {
        const trimNum = parseInt(String(form.trimestre).replace(/\D/g, ''), 10)
        return p.trimestre === trimNum && !p.semestre && !p.mois
      }
      if (form.semestre) {
        const semNum = parseInt(String(form.semestre).replace(/\D/g, ''), 10)
        return p.semestre === semNum && !p.trimestre && !p.mois
      }
      return !p.semestre && !p.trimestre && !p.mois
    }) || null
  }

  const getPreviousPeriodeForAttenuation = () => {
    const selected = findSelectedPeriodeFromForm(riskPeriod)
    if (!selected) return null
    const selectedStart = getPeriodeDateDebut(selected)
    const selectedMode = selected?.mois ? 'mois' : selected?.trimestre ? 'trimestre' : selected?.semestre ? 'semestre' : 'annee'
    const matchesType = (p) => {
      if (selectedMode === 'mois') return !!p?.mois && !p?.trimestre && !p?.semestre
      if (selectedMode === 'trimestre') return !!p?.trimestre && !p?.semestre && !p?.mois
      if (selectedMode === 'semestre') return !!p?.semestre && !p?.trimestre && !p?.mois
      return !!p?.annee && !p?.semestre && !p?.trimestre && !p?.mois
    }
    const candidates = allPeriodes
      .filter((p) => matchesType(p) && getPeriodeDateDebut(p) < selectedStart)
      .sort((a, b) => getPeriodeDateDebut(b) - getPeriodeDateDebut(a))
    return candidates[0] || null
  }

  const buildPeriodLabel = (period) => period?.libelle_periode || period?.periode || period?.libelle || 'Période non définie'

  const getNiveauCriticiteNum = (score) => {
    if (!score || score < 1) return null
    if (score <= 3) return 1
    if (score <= 7) return 2
    if (score <= 11) return 3
    return 4
  }

  const calculateTauxAttenuation = (criticiteComparaison, criticiteActuelle) => {
    if (!criticiteComparaison || !criticiteActuelle) return null
    const tauxTable = {
      '1-1': 100, '1-2': -50, '1-3': -75, '1-4': -100,
      '2-1': 100, '2-2': 0, '2-3': -50, '2-4': -100,
      '3-1': 100, '3-2': 50, '3-3': 0, '3-4': -100,
      '4-1': 100, '4-2': 75, '4-3': 50, '4-4': -100,
    }
    const key = `${criticiteComparaison}-${criticiteActuelle}`
    return tauxTable[key] !== undefined ? tauxTable[key] : null
  }

  const calculateProbabilite = (valIndicateur, seuils, sens) => {
    if (valIndicateur === null || valIndicateur === undefined || valIndicateur === '') return ''
    if (!seuils?.seuil1) return ''
    const val = parseFloat(valIndicateur)
    const s1 = parseFloat(seuils.seuil1)
    const s2 = parseFloat(seuils.seuil2)
    const s3 = parseFloat(seuils.seuil3)
    if ([val, s1, s2, s3].some((n) => Number.isNaN(n))) return ''
    if (sens === 'Positif') {
      if (val >= s3) return 1
      if (val >= s2) return 2
      if (val >= s1) return 3
      return 4
    }
    if (val <= s1) return 1
    if (val <= s2) return 2
    if (val <= s3) return 3
    return 4
  }

  const getRisqueProbabilite = (risque, periodeKey) => {
    const isQualitatif = risque.qualitatif === 'Oui' || !risque.code_indicateur
    let indicOcc = null
    let storedProba = null
    if (isQualitatif) {
      const rp = risquesProbabilites.find((p) => String(p?.code_risque || '').trim() === String(risque?.code_risque || '').trim() && String(p?.periode || '').trim() === String(periodeKey || '').trim())
      storedProba = rp?.probabilite ?? null
    } else {
      indicOcc = occurrences.find((o) => String(o?.code_indicateur || '').trim() === String(risque?.code_indicateur || '').trim() && String(o?.periode || '').trim() === String(periodeKey || '').trim())
      const rp = risquesProbabilites.find((p) => String(p?.code_risque || '').trim() === String(risque?.code_risque || '').trim() && String(p?.periode || '').trim() === String(periodeKey || '').trim())
      storedProba = rp?.probabilite || null
    }
    const valInd = isQualitatif ? null : indicOcc?.val_indicateur
    const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''
    const seuils = {
      seuil1: risque.indicateur?.seuil1 || risque.indicateur?.seuil_1,
      seuil2: risque.indicateur?.seuil2 || risque.indicateur?.seuil_2,
      seuil3: risque.indicateur?.seuil3 || risque.indicateur?.seuil_3,
    }
    const calculatedProba = (!isQualitatif && hasValInd) ? calculateProbabilite(valInd, seuils, risque.indicateur?.sens) : ''
    const probDisplay = calculatedProba || storedProba || ''
    const hasProb = probDisplay !== '' && probDisplay !== null && probDisplay !== undefined
    return { probDisplay, hasProb }
  }

  const calculateAttenuation = (efficacite_contr) => {
    if (efficacite_contr === 1) return -3
    if (efficacite_contr === 2) return -2
    if (efficacite_contr === 3) return -1
    return 0
  }

  const calculateImpactNetDashboard = (impactBrut, efficacite_contr) => {
    const attenuation = calculateAttenuation(efficacite_contr)
    return Math.max(1, (impactBrut || 1) + attenuation)
  }

  const periodeKey = getPeriodeKeyRisques()
  const selectedPeriod = findSelectedPeriodeFromForm(riskPeriod)
  const selectedPeriodLabel = buildPeriodLabel(selectedPeriod)

  if (!periodeKey) {
    return {
      periodLabel: selectedPeriodLabel,
      selectedTypeCriticite: useBrute ? 'Brute' : 'Nette',
      totalRisques: '-',
      evalues: '-',
      nonEvalues: '-',
      tauxSuivi: '-',
      tauxMaitrise: null,
      tauxAttenuation: 'N/A',
      repartitionCriticite: [],
      criticalProcessRates: [],
      planStats: { total: '-', realisees: '-', nonRealisees: '-', tauxRealisation: '-', enRetard: '-', retardMoyen: 0, parAvancement: [], topRetardStructures: [], allRetardStructures: [], totalRetards: 0, maxRetardStructures: 1 },
      hasData: false,
    }
  }

  const extractNumber = (val) => {
    if (val === null || val === undefined) return Number.NaN
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const match = val.match(/^(\d+)/)
      if (match) return parseInt(match[1], 10)
      return parseInt(val, 10)
    }
    return Number.NaN
  }

  const getCriticiteScore = (r) => {
    const impactBrut = extractNumber(r.impact)
    const eff = extractNumber(r.efficacite_contr)
    const impactNet = calculateImpactNetDashboard(impactBrut, eff)
    const probData = getRisqueProbabilite(r, periodeKey)
    const prob = parseInt(probData.probDisplay || '', 10)
    if (Number.isNaN(impactBrut) || Number.isNaN(impactNet) || Number.isNaN(prob)) return Number.NaN
    const impact = useBrute ? impactBrut : impactNet
    return impact * prob
  }

  const totalRisques = filtered.length
  const evaluesList = filtered.filter((r) => !Number.isNaN(getCriticiteScore(r)))
  const evalues = evaluesList.length
  const nonEvalues = totalRisques - evalues
  const tauxSuivi = totalRisques > 0 ? Math.round((evalues / totalRisques) * 100) : 0

  let faible = 0
  let modere = 0
  let significatif = 0
  let critique = 0
  evaluesList.forEach((r) => {
    const score = getCriticiteScore(r)
    if (Number.isNaN(score)) return
    if (score >= 1 && score <= 3) faible += 1
    else if (score >= 4 && score <= 6) modere += 1
    else if (score >= 8 && score <= 9) significatif += 1
    else if (score >= 12 && score <= 16) critique += 1
  })

  const tauxMaitrise = evalues > 0 ? Math.round((faible / evalues) * 100) : 0
  const pctInt = (n) => (evalues > 0 ? Math.round((n / evalues) * 100) : 0)
  const repartitionCriticite = [
    { key: 'Faible', range: '1-3', label: 'Faible', value: faible, display: `${faible} (${pctInt(faible)}%)` },
    { key: 'Modéré', range: '4-6', label: 'Modéré', value: modere, display: `${modere} (${pctInt(modere)}%)` },
    { key: 'Significatif', range: '8-9', label: 'Significatif', value: significatif, display: `${significatif} (${pctInt(significatif)}%)` },
    { key: 'Critique', range: '12-16', label: 'Critique', value: critique, display: `${critique} (${pctInt(critique)}%)` },
  ]

  const critiqueParProcessus = {}
  evaluesList.forEach((r) => {
    const proc = String(r.code_processus || 'N/A').trim() || 'N/A'
    if (!critiqueParProcessus[proc]) critiqueParProcessus[proc] = { critique: 0, total: 0 }
    critiqueParProcessus[proc].total += 1
    const score = getCriticiteScore(r)
    if (!Number.isNaN(score) && score >= 8 && score <= 16) critiqueParProcessus[proc].critique += 1
  })

  const criticalProcessRates = Object.entries(critiqueParProcessus)
    .map(([code, data]) => {
      const percent = data.total > 0 ? (data.critique / data.total) * 100 : 0
      return { code, label: code, value: Number(percent.toFixed(1)), annotation: `${data.critique}/${data.total} (${percent.toFixed(1)}%)`, color: '#EF4444' }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)

  const previousPeriode = getPreviousPeriodeForAttenuation()
  const previousPeriodeKey = (() => {
    if (!previousPeriode?.annee) return ''
    if (previousPeriode.mois) {
      const moisNum = typeof previousPeriode.mois === 'number' ? previousPeriode.mois : parseInt(previousPeriode.mois, 10)
      return `${moisList[moisNum - 1]}-${previousPeriode.annee}`
    }
    if (previousPeriode.trimestre) return `T${previousPeriode.trimestre}-${previousPeriode.annee}`
    if (previousPeriode.semestre) return `S${previousPeriode.semestre}-${previousPeriode.annee}`
    return `${previousPeriode.annee}`
  })()

  const attenuationValues = []
  let prevEvaluatedCount = 0
  filtered.forEach((r) => {
    const impactBrut = extractNumber(r.impact)
    const eff = extractNumber(r.efficacite_contr)
    const impactNet = calculateImpactNetDashboard(impactBrut, eff)
    if (Number.isNaN(impactNet)) return

    const probPrevData = getRisqueProbabilite(r, previousPeriodeKey)
    const probCurData = getRisqueProbabilite(r, periodeKey)

    if (probPrevData?.hasProb) prevEvaluatedCount += 1
    if (!probPrevData?.hasProb || !probCurData?.hasProb) return

    const probPrev = parseInt(probPrevData.probDisplay, 10)
    const probCur = parseInt(probCurData.probDisplay, 10)
    if (Number.isNaN(probPrev) || Number.isNaN(probCur)) return

    const criticitePrev = impactNet * probPrev
    const criticiteCur = impactNet * probCur
    const niveauPrev = getNiveauCriticiteNum(criticitePrev)
    const niveauCur = getNiveauCriticiteNum(criticiteCur)
    if (!niveauPrev || !niveauCur) return

    const taux = calculateTauxAttenuation(niveauPrev, niveauCur)
    if (taux === null || taux === undefined) return

    attenuationValues.push(taux)
  })
  const tauxAttenuation = (!periodeKey || evalues === 0 || !previousPeriode || !previousPeriodeKey || prevEvaluatedCount === 0 || attenuationValues.length === 0)
    ? 'N/A'
    : `${Math.round(attenuationValues.reduce((a, b) => a + b, 0) / attenuationValues.length)}%`

  const planRows = ((riskPlanRows && riskPlanRows.length) ? riskPlanRows : (planMaitrise || []).map((action) => {
    const occurrence = action?.latest_occurrence || null
    return {
      code_structure: normalizeStructure(action?.code_structure_resp || action?.code_structure || occurrence?.code_structure),
      date_debut: occurrence?.date_debut || action?.date_debut_initiale,
      date_fin: occurrence?.date_fin || action?.date_fin_initiale,
      tx_avancement: occurrence?.tx_avancement ?? action?.tx_avancement ?? 0,
      gestionnaire_conf: occurrence?.gestionnaire_conf || action?.gestionnaire_conf,
      date_realisation: occurrence?.date_realisation || action?.date_realisation,
      date_conf: occurrence?.date_conf || action?.date_conf,
    }
  }))
    .filter((row) => row?.code_structure && (!structureSet.size || structureSet.has(normalizeStructure(row.code_structure))))

  const today = toDateOnlyRisk(new Date())
  const normalizedPlanRows = planRows.map((row) => {
    const tx = Number(toNumber(row?.tx_avancement) || 0)
    const dateFin = toDateOnlyRisk(row?.date_fin)
    const dateRealisation = toDateOnlyRisk(row?.date_realisation)
    const dateConfirmation = toDateOnlyRisk(row?.date_conf)
    const isDone = tx >= 100
    const level = tx >= 100 && String(row?.gestionnaire_conf || '').trim().toLowerCase() === 'oui'
      ? 'Achevée'
      : tx >= 100
        ? 'Terminée - non confirmée'
        : tx > 50
          ? 'En cours +50%'
          : tx > 0
            ? 'En cours -50%'
            : 'Non entamée'
    const referenceDate = isDone ? (dateRealisation || dateConfirmation || today) : today
    const jourRetard = dateFin ? Math.floor((referenceDate - dateFin) / 86400000) : 0
    const positiveDelay = jourRetard > 0 ? jourRetard : 0
    return {
      ...row,
      tx,
      level,
      isDone,
      jourRetard,
      positiveDelay,
      structureCode: normalizeStructure(row?.code_structure) || 'N/A',
    }
  })

  const planTotal = normalizedPlanRows.length
  const realisees = normalizedPlanRows.filter((item) => item.isDone).length
  const nonRealisees = normalizedPlanRows.filter((item) => !item.isDone).length
  const lateRows = normalizedPlanRows.filter((item) => !item.isDone && item.jourRetard > 0)
  const positiveDelays = normalizedPlanRows.filter((item) => item.positiveDelay > 0)
  const levelOrder = ['Achevée', 'Terminée - non confirmée', 'En cours +50%', 'En cours -50%', 'Non entamée']
  const levelColors = { 'Achevée': 'bg-green-600', 'Terminée - non confirmée': 'bg-green-400', 'En cours +50%': 'bg-yellow-500', 'En cours -50%': 'bg-orange-500', 'Non entamée': 'bg-red-600' }
  const parAvancement = levelOrder.map((label) => ({ label, value: normalizedPlanRows.filter((item) => item.level === label).length, color: levelColors[label] }))
  const actionTotalsByStructure = {}
  normalizedPlanRows.forEach((item) => {
    const struct = item.structureCode || 'N/A'
    if (!actionTotalsByStructure[struct]) actionTotalsByStructure[struct] = { total: 0, retard: 0 }
    actionTotalsByStructure[struct].total += 1
    if (!item.isDone && item.jourRetard > 0) actionTotalsByStructure[struct].retard += 1
  })
  const allRetardStructures = Object.entries(actionTotalsByStructure)
    .filter(([, data]) => data.retard > 0)
    .map(([code, data]) => {
      const proportion = data.total > 0 ? Number(((data.retard / data.total) * 100).toFixed(1)) : 0
      return { code, value: data.retard, rawValue: data.retard, total: data.total, widthValue: proportion, annotation: `${data.retard}/${data.total} (${proportion.toFixed(1)}%)`, libelle: (structures || []).find((s) => normalizeStructure(s.code_structure) === code)?.libelle_structure || '' }
    })
    .sort((a, b) => b.value - a.value || a.code.localeCompare(b.code, 'fr', { sensitivity: 'base' }))
  const topRetardStructures = allRetardStructures.slice(0, 5).map((item) => ({ ...item, label: item.code, display: `${item.rawValue}/${item.total} (${item.widthValue.toFixed(1)}%)`, color: 'bg-red-500' }))

  const planStats = {
    total: planTotal,
    realisees,
    nonRealisees,
    tauxRealisation: planTotal > 0 ? ((realisees / planTotal) * 100).toFixed(1) : '0.0',
    enRetard: lateRows.length,
    retardMoyen: positiveDelays.length ? Math.round(positiveDelays.reduce((sum, item) => sum + item.positiveDelay, 0) / positiveDelays.length) : 0,
    parAvancement,
    topRetardStructures,
    allRetardStructures,
    totalRetards: allRetardStructures.reduce((sum, item) => sum + (item.rawValue || 0), 0),
    maxRetardStructures: Math.max(1, ...allRetardStructures.map((item) => item.value || 0)),
  }

  return {
    periodLabel: selectedPeriodLabel,
    selectedTypeCriticite: useBrute ? 'Brute' : 'Nette',
    totalRisques,
    evalues,
    nonEvalues,
    tauxEvaluation: tauxSuivi,
    tauxSuivi,
    tauxMaitrise: Number.isFinite(tauxMaitrise) ? tauxMaitrise : null,
    tauxAttenuation,
    repartitionCriticite,
    criticalProcessRates,
    planStats,
    hasData: totalRisques > 0,
  }
}

const computeReportData = ({ structures = [], periodes = [], risques = [], probabilites = [], planMaitrise = [], riskPlanRows = [], groupesActions = [], actions = [], actionOccurrences = [], indicateurs = [], indicatorOccurrences = [], processus = [], users = [] }, scope) => {
  const selectedStructureCodes = scope?.selectedStructureCodes || []
  const performanceRows = buildPerformanceRows({ users, actions, actionOccurrences, groupesActions, indicateurs, indicatorOccurrences, selectedStructureCodes })

  const structureLabelMap = new Map((structures || []).map((item) => [normalizeStructure(item?.code_structure), item?.libelle_structure || item?.code_structure]))
  const performanceGlobal = avg(performanceRows.map((row) => row.scorePerformance))
  const performanceByStructure = unique(performanceRows.map((row) => normalizeStructure(row.code_structure)))
    .map((code) => {
      const rows = performanceRows.filter((row) => normalizeStructure(row.code_structure) === code && Number.isFinite(row.scorePerformance))
      const value = avg(rows.map((row) => row.scorePerformance))
      if (!Number.isFinite(value)) return null
      return {
        code,
        label: structureLabelMap.get(code) || code,
        performance: value,
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.performance - a.performance) || a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))

  const risks = scope.includeRisks ? buildRiskSection({ structures, periodes, risques, probabilites, planMaitrise, riskPlanRows, indicatorOccurrences, processus, selectedStructureCodes, riskPeriod: buildScopePeriod(scope), riskTypeCriticite: scope?.riskTypeCriticite || 'Nette' }) : null
  const actionsSection = scope.includeActivities && scope.selectedProjectCodes?.length
    ? buildActionSection({ structures, users, groupesActions, actions, actionOccurrences, performanceRows, selectedStructureCodes, selectedProjectCodes: scope.selectedProjectCodes })
    : null
  const indicatorsSection = scope.includeIndicators && scope.selectedGroupCodes?.length
    ? buildIndicatorSection({ structures, users, indicateurs, indicatorOccurrences, performanceRows, selectedStructureCodes, selectedGroupCodes: scope.selectedGroupCodes })
    : null

  return {
    generatedAt: new Date(),
    selectedStructureCodes,
    performanceGlobal,
    performanceByStructure,
    risks,
    actionsSection,
    indicatorsSection,
    performanceRows,
  }
}

function ScopeRow({ children }) {
  return (
    <div className={`${SUBCARD_CLASS} px-3.5 py-3.5 md:px-4 md:py-4`}>
      {children}
    </div>
  )
}

function KeyFigure({ label, value, accent = 'text-[#d94841]' }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-4 py-4 text-center border border-slate-200">
      <div className="text-[11px] md:text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-xl md:text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  )
}

function RiskMetricCard({ label, value, tone = 'blue', icon: Icon }) {
  const toneMap = {
    blue: { wrapper: 'bg-blue-50 border-blue-100', value: 'text-blue-700', iconWrap: 'bg-blue-100', icon: 'text-blue-600' },
    green: { wrapper: 'bg-green-50 border-green-100', value: 'text-green-700', iconWrap: 'bg-green-100', icon: 'text-green-600' },
    orange: { wrapper: 'bg-orange-50 border-orange-100', value: 'text-orange-700', iconWrap: 'bg-orange-100', icon: 'text-orange-600' },
    purple: { wrapper: 'bg-purple-50 border-purple-100', value: 'text-purple-700', iconWrap: 'bg-purple-100', icon: 'text-purple-600' },
    teal: { wrapper: 'bg-teal-50 border-teal-100', value: 'text-teal-700', iconWrap: 'bg-teal-100', icon: 'text-teal-600' },
    emerald: { wrapper: 'bg-emerald-50 border-emerald-100', value: 'text-emerald-700', iconWrap: 'bg-emerald-100', icon: 'text-emerald-600' },
  }
  const palette = toneMap[tone] || toneMap.blue
  return (
    <div className={`rounded-[18px] border p-4 ${palette.wrapper}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${palette.iconWrap}`}>
          {Icon ? <Icon size={16} className={palette.icon} /> : null}
        </div>
        <div className="min-w-0">
          <div className={`text-xl md:text-2xl font-bold ${palette.value}`}>{value}</div>
          <div className="mt-0.5 text-[11px] md:text-xs text-slate-600">{label}</div>
        </div>
      </div>
    </div>
  )
}

function ProgressCard({ title, children }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:p-6">
      <h4 className="mb-4 text-lg md:text-xl font-bold text-slate-800">{title}</h4>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function PerformanceTable({ rows = [] }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
      <table className="min-w-full text-xs md:text-sm">
        <thead className="bg-slate-100 text-[#243b72]">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold">Structure</th>
            <th className="px-4 py-2.5 text-center font-semibold w-40">Performance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-t border-slate-200">
              <td className="px-4 py-2.5 text-slate-700">{row.label}</td>
              <td className="px-4 py-2.5 text-center font-semibold text-[#d94841]">{formatPct(row.performance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryStatsTable({ metrics, footerLabel, footerValue }) {
  const entries = [
    { label: 'Total', value: metrics?.total ?? 0, valueClass: 'text-[#22386b]' },
    footerLabel === 'Performance action'
      ? { label: 'Terminées', value: metrics?.terminees ?? 0, valueClass: 'text-green-600' }
      : { label: 'Renseignés', value: metrics?.renseignes ?? 0, valueClass: 'text-green-600' },
    footerLabel === 'Performance action'
      ? { label: 'Terminé dans le délai', value: metrics?.termineesDansDelai ?? 0, valueClass: 'text-green-600' }
      : { label: 'Rens. dans le délai', value: metrics?.renseignesDansDelai ?? 0, valueClass: 'text-green-600' },
    footerLabel === 'Performance action'
      ? { label: 'En cours', value: metrics?.enCours ?? 0, valueClass: 'text-blue-500' }
      : { label: 'En retard', value: metrics?.enRetard ?? 0, valueClass: 'text-[#d94841]' },
    footerLabel === 'Performance action'
      ? { label: 'En retard', value: metrics?.enRetard ?? 0, valueClass: 'text-[#d94841]' }
      : { label: 'Tx atteinte', value: formatPct(metrics?.txAtteinte), valueClass: 'text-indigo-600' },
  ]

  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
      <div className="grid grid-cols-2 md:grid-cols-5">
        {entries.map((entry, index) => (
          <div key={`${entry.label}-${index}`} className="border-b border-r border-slate-200 px-3 py-3 md:py-3.5 text-center last:border-r-0 md:[&:nth-child(5)]:border-r-0">
            <div className="text-[11px] md:text-xs text-slate-500">{entry.label}</div>
            <div className={`mt-1.5 text-xl md:text-2xl font-bold ${entry.valueClass}`}>{entry.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-slate-100 px-4 py-3 text-center text-sm md:text-base font-semibold text-[#314fb8]">
        <span className="font-bold">{footerLabel}</span> : {formatPct(footerValue)}
      </div>
    </div>
  )
}

function DataTable({ columns = [], rows = [], compact = false }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-slate-200 bg-white">
      <table className="min-w-full text-xs md:text-sm">
        <thead className="bg-[#f4efe7] text-[#8c451f]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 ${compact ? 'py-2.5' : 'py-3.5'} text-left font-semibold whitespace-nowrap`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-200 align-top">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 ${compact ? 'py-2.5' : 'py-3.5'} text-slate-700`}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className={`${CARD_CLASS} p-4`}>
      <h4 className="text-sm md:text-base font-semibold text-slate-800 mb-3">{title}</h4>
      <div className="giras-mobile-chart-scroll">
        <div className="giras-mobile-chart-inner h-64">{children}</div>
      </div>
    </div>
  )
}

function ReportBlock({ title, icon: Icon, children, subtitle }) {
  return (
    <section className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1f3763] text-white shadow-sm">
          <Icon size={18} />
        </div>
        <div>
          <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
          {subtitle ? <p className="mt-1 text-xs md:text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyState({ text }) {
  return <div className="rounded-[18px] border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">{text}</div>
}

export default function ReportsPage() {
  const router = useRouter()
  const reportRef = useRef(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)
  const [datasets, setDatasets] = useState({
    structures: [],
    periodes: [],
    risques: [],
    probabilites: [],
    planMaitrise: [],
    riskPlanRows: [],
    groupesActions: [],
    actions: [],
    actionOccurrences: [],
    indicateurs: [],
    indicatorOccurrences: [],
    groupsIndicateurs: [],
    users: [],
  })

  const [scope, setScope] = useState({
    selectedStructureCodes: [],
    includeRisks: false,
    riskYear: '',
    riskSemester: '',
    riskTrimester: '',
    riskMonth: '',
    riskTypeCriticite: 'Nette',
    includeActivities: false,
    selectedProjectCodes: [],
    includeIndicators: false,
    selectedGroupCodes: [],
  })
  const [generatedScope, setGeneratedScope] = useState(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (!storedUser) {
      router.push('/login')
      return
    }
    const parsed = JSON.parse(storedUser)
    setCurrentUser(parsed)
  }, [router])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/structures'),
          fetch('/api/periodes'),
          fetch('/api/risques'),
          fetch('/api/risques/probabilite'),
          fetch('/api/plan-maitrise'),
          fetch('/api/actions/risques-suivi'),
          fetch('/api/groupes-actions'),
          fetch('/api/actions'),
          fetch('/api/actions/occurrences'),
          fetch('/api/indicateurs'),
          fetch('/api/indicateurs/occurrences'),
          fetch('/api/groupe-indicateurs'),
          fetch('/api/processus'),
          fetch('/api/users?statut=Actif'),
        ])

        const [
          structuresRes,
          periodesRes,
          risquesRes,
          probabilitesRes,
          planMaitriseRes,
          riskPlanRowsRes,
          groupesActionsRes,
          actionsRes,
          actionOccurrencesRes,
          indicateursRes,
          indicatorOccurrencesRes,
          groupsIndicateursRes,
          processusRes,
          usersRes,
        ] = responses

        setDatasets({
          structures: structuresRes.ok ? ((await structuresRes.json()).structures || []) : [],
          periodes: periodesRes.ok ? ((await periodesRes.json()).periodes || []) : [],
          risques: risquesRes.ok ? ((await risquesRes.json()).risques || []) : [],
          probabilites: probabilitesRes.ok ? ((await probabilitesRes.json()).probabilites || []) : [],
          planMaitrise: planMaitriseRes.ok ? ((await planMaitriseRes.json()).actions || []) : [],
          riskPlanRows: riskPlanRowsRes.ok ? ((await riskPlanRowsRes.json()).rows || []) : [],
          groupesActions: groupesActionsRes.ok ? ((await groupesActionsRes.json()).groupes || []) : [],
          actions: actionsRes.ok ? ((await actionsRes.json()).actions || []) : [],
          actionOccurrences: actionOccurrencesRes.ok ? ((await actionOccurrencesRes.json()).occurrences || []) : [],
          indicateurs: indicateursRes.ok ? ((await indicateursRes.json()).indicateurs || []) : [],
          indicatorOccurrences: indicatorOccurrencesRes.ok ? ((await indicatorOccurrencesRes.json()).occurrences || []) : [],
          groupsIndicateurs: groupsIndicateursRes.ok ? ((await groupsIndicateursRes.json()).groupes || []) : [],
          processus: processusRes.ok ? ((await processusRes.json()).processus || []) : [],
          users: usersRes.ok ? ((await usersRes.json()).users || []) : [],
        })
      } catch (error) {
        console.error('Erreur chargement rapports:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const visibleStructures = useMemo(() => {
    if (!currentUser) return []
    if (isPrivilegedUser(currentUser)) return datasets.structures || []
    return (datasets.structures || []).filter((item) => normalizeStructure(item?.code_structure) === normalizeStructure(currentUser?.structure))
  }, [currentUser, datasets.structures])

  const projectOptions = useMemo(() => [{ value: '__all__', label: 'Tous' }, ...((datasets.groupesActions || [])
    .filter((item) => item && !isTrueLike(item.archive) && String(item?.statut || 'Actif').trim() !== 'Inactif')
    .sort((a, b) => String(a.libelle_groupe || '').localeCompare(String(b.libelle_groupe || ''), 'fr', { sensitivity: 'base' }))
    .map((item) => ({ value: String(item.code_groupe), label: `${item.code_groupe} - ${item.libelle_groupe}` })))], [datasets.groupesActions])

  const groupOptions = useMemo(() => [{ value: '__all__', label: 'Tous' }, ...((datasets.groupsIndicateurs || [])
    .filter((item) => item && !isTrueLike(item.archive) && String(item?.statut || 'Actif').trim() !== 'Inactif')
    .sort((a, b) => String(a.libelle_groupe || '').localeCompare(String(b.libelle_groupe || ''), 'fr', { sensitivity: 'base' }))
    .map((item) => ({ value: String(item.code_groupe), label: `${item.code_groupe} - ${item.libelle_groupe}` })))], [datasets.groupsIndicateurs])

  const structureOptions = useMemo(() => [{ value: '__all__', label: 'Toutes' }, ...(visibleStructures || [])
    .sort((a, b) => String(a.libelle_structure || '').localeCompare(String(b.libelle_structure || ''), 'fr', { sensitivity: 'base' }))
    .map((item) => ({ value: String(item.code_structure), label: `${item.code_structure} - ${item.libelle_structure}` }))], [visibleStructures])

  const riskYears = useMemo(() => unique((datasets.periodes || []).map((item) => String(item?.annee || '')).filter(Boolean)).sort(), [datasets.periodes])
  const riskSemesters = useMemo(() => unique((datasets.periodes || []).filter((item) => String(item?.annee || '') === String(scope.riskYear || '') && item?.semestre).map((item) => String(item.semestre))).sort(), [datasets.periodes, scope.riskYear])
  const riskTrimesters = useMemo(() => unique((datasets.periodes || []).filter((item) => String(item?.annee || '') === String(scope.riskYear || '') && item?.trimestre).map((item) => String(item.trimestre))).sort(), [datasets.periodes, scope.riskYear])
  const riskMonths = useMemo(() => unique((datasets.periodes || []).filter((item) => String(item?.annee || '') === String(scope.riskYear || '') && item?.mois).map((item) => Number(item.mois))).sort((a, b) => a - b), [datasets.periodes, scope.riskYear])


  const updateScope = (patch) => {
    setScope((prev) => ({ ...prev, ...patch }))
  }

  const handleStructureChange = (values) => {
    const nextValues = Array.isArray(values) ? values : []
    const allCodes = (visibleStructures || []).map((item) => String(item.code_structure))
    updateScope({ selectedStructureCodes: nextValues.includes('__all__') ? allCodes : nextValues.filter((value) => value !== '__all__') })
  }

  const handleProjectChange = (values) => {
    const nextValues = Array.isArray(values) ? values : []
    const allCodes = (datasets.groupesActions || []).map((item) => String(item.code_groupe))
    updateScope({ selectedProjectCodes: nextValues.includes('__all__') ? allCodes : nextValues.filter((value) => value !== '__all__') })
  }

  const handleGroupChange = (values) => {
    const nextValues = Array.isArray(values) ? values : []
    const allCodes = (datasets.groupsIndicateurs || []).map((item) => String(item.code_groupe))
    updateScope({ selectedGroupCodes: nextValues.includes('__all__') ? allCodes : nextValues.filter((value) => value !== '__all__') })
  }

  const reportData = useMemo(() => {
    if (!generatedScope || !generatedScope.selectedStructureCodes?.length) return null
    return computeReportData(datasets, generatedScope)
  }, [datasets, generatedScope])

  const handleGenerateReport = async () => {
    if (!scope.selectedStructureCodes.length) return
    setGenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 120))
    setGeneratedScope({ ...scope, selectedStructureCodes: [...scope.selectedStructureCodes], selectedProjectCodes: [...scope.selectedProjectCodes], selectedGroupCodes: [...scope.selectedGroupCodes] })
    setGenerating(false)
  }

  const handleExportPdf = async () => {
    if (!reportRef.current || !reportData) return
    setExportingPdf(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const wrapper = document.createElement('div')
      wrapper.style.position = 'fixed'
      wrapper.style.left = '-20000px'
      wrapper.style.top = '0'
      wrapper.style.width = '1440px'
      wrapper.style.background = '#f8fafc'
      wrapper.style.padding = '28px'
      wrapper.style.zIndex = '-1'

      const header = document.createElement('div')
      header.style.background = 'linear-gradient(135deg, #1f3763 0%, #355893 100%)'
      header.style.color = '#fff'
      header.style.padding = '22px 28px'
      header.style.borderRadius = '24px'
      header.style.marginBottom = '18px'
      header.innerHTML = `<div style="font-size:30px;font-weight:700;">Rapport GIRAS</div><div style="font-size:13px;color:#dbeafe;margin-top:6px;">Export généré le ${new Date().toLocaleString('fr-FR')}</div>`
      wrapper.appendChild(header)

      const clone = reportRef.current.cloneNode(true)
      clone.style.width = '1380px'
      clone.style.background = '#f8fafc'
      clone.querySelectorAll('button,[data-export-exclude="true"]').forEach((node) => node.remove())
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 180)))

      const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#f8fafc', windowWidth: 1440 })
      document.body.removeChild(wrapper)

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const usableWidth = pageWidth - margin * 2
      const usableHeight = pageHeight - margin * 2
      const pxPerMm = canvas.width / usableWidth
      const pageHeightPx = Math.floor(usableHeight * pxPerMm)
      let rendered = 0
      let pageIndex = 0

      while (rendered < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - rendered)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const ctx = pageCanvas.getContext('2d')
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        if (pageIndex > 0) pdf.addPage()
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, usableWidth, sliceHeight / pxPerMm)
        rendered += sliceHeight
        pageIndex += 1
      }

      const totalPages = pdf.getNumberOfPages()
      for (let index = 1; index <= totalPages; index += 1) {
        pdf.setPage(index)
        pdf.setFontSize(9)
        pdf.setTextColor(100)
        pdf.text(`Page ${index} / ${totalPages}`, pageWidth - 28, pageHeight - 4)
      }
      pdf.save(`rapport_giras_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (error) {
      console.error('Erreur export PDF rapport:', error)
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportWord = async () => {
    if (!reportRef.current || !reportData) return
    setExportingWord(true)
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport GIRAS</title><style>
        @page { size: A4; margin: 1.5cm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
        h1,h2,h3,h4 { color: #1f3763; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #dbe4f0; padding: 8px; vertical-align: top; }
        th { background: #f4efe7; color: #8c451f; }
      </style></head><body>
      <h1>Rapport GIRAS</h1>
      <p>Export généré le ${new Date().toLocaleString('fr-FR')}</p>
      ${reportRef.current.innerHTML}
      </body></html>`
      const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rapport_giras_${new Date().toISOString().slice(0, 10)}.doc`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erreur export Word rapport:', error)
    } finally {
      setExportingWord(false)
    }
  }

  if (!currentUser && !loading) return null

  const canGenerateReport = !!scope.selectedStructureCodes.length
    && (!scope.includeActivities || !!scope.selectedProjectCodes.length)
    && (!scope.includeIndicators || !!scope.selectedGroupCodes.length)

  return (
    <div className="space-y-6">
      <div className={`${CARD_CLASS} p-4 md:p-5 space-y-3`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#1f3763]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1f3763]">
              <FileText size={13} /> Rapport
            </div>
            <h1 className="mt-3 text-xl md:text-2xl font-bold text-slate-900">Définition du périmètre du rapport</h1>
          </div>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => window.location.reload()} className="shrink-0">
            Actualiser les données
          </Button>
        </div>

        <div className="space-y-3">
          <ScopeRow>
            <SearchableSelect
              multiple
              value={scope.selectedStructureCodes}
              onChange={handleStructureChange}
              options={structureOptions}
              placeholder="Structure"
              searchPlaceholder="Rechercher une structure..."
              size="sm"
            />
          </ScopeRow>

          <ScopeRow>
            <div className="flex flex-wrap items-end gap-2.5 md:gap-3">
              <label className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs md:text-sm font-medium text-slate-700 w-fit whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={scope.includeRisks}
                  onChange={(e) => updateScope({
                    includeRisks: e.target.checked,
                    riskYear: e.target.checked ? scope.riskYear : '',
                    riskSemester: e.target.checked ? scope.riskSemester : '',
                    riskTrimester: e.target.checked ? scope.riskTrimester : '',
                    riskMonth: e.target.checked ? scope.riskMonth : '',
                    riskTypeCriticite: e.target.checked ? scope.riskTypeCriticite : 'Nette',
                  })}
                  className="h-4 w-4 rounded border-slate-300 text-[#1f3763] focus:ring-[#1f3763]"
                />
                Intégrer la gestion des risques ?
              </label>
              {scope.includeRisks ? (
                <>
                  <div className="min-w-[108px] flex-1 sm:flex-none sm:w-[108px]">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Année</label>
                    <select value={scope.riskYear} onChange={(e) => updateScope({ riskYear: e.target.value, riskSemester: '', riskTrimester: '', riskMonth: '' })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="">--</option>
                      {riskYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  <div className="min-w-[120px] flex-1 sm:flex-none sm:w-[120px]">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Semestre</label>
                    <select value={scope.riskSemester} onChange={(e) => updateScope({ riskSemester: e.target.value, riskTrimester: '', riskMonth: '' })} disabled={!scope.riskYear || !riskSemesters.length} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">--</option>
                      {riskSemesters.map((semester) => <option key={semester} value={`S${semester}`}>{`Semestre ${semester}`}</option>)}
                    </select>
                  </div>
                  <div className="min-w-[124px] flex-1 sm:flex-none sm:w-[124px]">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Trimestre</label>
                    <select value={scope.riskTrimester} onChange={(e) => updateScope({ riskTrimester: e.target.value, riskSemester: '', riskMonth: '' })} disabled={!scope.riskYear || !riskTrimesters.length} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">--</option>
                      {riskTrimesters.map((trimester) => <option key={trimester} value={`T${trimester}`}>{`Trimestre ${trimester}`}</option>)}
                    </select>
                  </div>
                  <div className="min-w-[112px] flex-1 sm:flex-none sm:w-[112px]">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Mois</label>
                    <select value={scope.riskMonth} onChange={(e) => updateScope({ riskMonth: e.target.value, riskSemester: '', riskTrimester: '' })} disabled={!scope.riskYear || !riskMonths.length} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">--</option>
                      {riskMonths.map((month) => <option key={month} value={moisList[month - 1]}>{moisList[month - 1]}</option>)}
                    </select>
                  </div>
                  <div className="min-w-[112px] flex-1 sm:flex-none sm:w-[112px]">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Type crit.</label>
                    <select value={scope.riskTypeCriticite} onChange={(e) => updateScope({ riskTypeCriticite: e.target.value })} className="w-full rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-slate-700">
                      <option value="Brute">Brute</option>
                      <option value="Nette">Nette</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => updateScope({ riskYear: '', riskSemester: '', riskTrimester: '', riskMonth: '', riskTypeCriticite: 'Nette' })} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50" title="Réinitialiser la période risques">
                    <RotateCcw size={16} />
                  </button>
                </>
              ) : null}
            </div>
          </ScopeRow>

          <ScopeRow>
            <div className="space-y-2.5">
              <label className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs md:text-sm font-medium text-slate-700 w-fit">
                <input type="checkbox" checked={scope.includeActivities} onChange={(e) => updateScope({ includeActivities: e.target.checked, selectedProjectCodes: e.target.checked ? scope.selectedProjectCodes : [] })} className="h-4 w-4 rounded border-slate-300 text-[#1f3763] focus:ring-[#1f3763]" />
                Intégrer le suivi des activités ?
              </label>
              {scope.includeActivities ? (
                <SearchableSelect
                  multiple
                  value={scope.selectedProjectCodes}
                  onChange={handleProjectChange}
                  options={projectOptions}
                  placeholder="Projets"
                  searchPlaceholder="Rechercher un projet..."
                  size="sm"
                />
              ) : null}
            </div>
          </ScopeRow>

          <ScopeRow>
            <div className="space-y-2.5">
              <label className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs md:text-sm font-medium text-slate-700 w-fit">
                <input type="checkbox" checked={scope.includeIndicators} onChange={(e) => updateScope({ includeIndicators: e.target.checked, selectedGroupCodes: e.target.checked ? scope.selectedGroupCodes : [] })} className="h-4 w-4 rounded border-slate-300 text-[#1f3763] focus:ring-[#1f3763]" />
                Intégrer le suivi des indicateurs ?
              </label>
              {scope.includeIndicators ? (
                <SearchableSelect
                  multiple
                  value={scope.selectedGroupCodes}
                  onChange={handleGroupChange}
                  options={groupOptions}
                  placeholder="Groupes"
                  searchPlaceholder="Rechercher un groupe..."
                  size="sm"
                />
              ) : null}
            </div>
          </ScopeRow>

          <div className="pt-1">
            <Button loading={generating} disabled={!canGenerateReport} onClick={handleGenerateReport} size="md" className="w-full md:w-auto min-w-[220px]">
              Générer le rapport
            </Button>
          </div>
        </div>
      </div>

      {!generatedScope ? (
        <EmptyState text="Sélectionnez au moins une structure puis cliquez sur “Générer le rapport”." />
      ) : !reportData ? (
        <EmptyState text="Aucune donnée disponible pour ce périmètre." />
      ) : (
        <div className="space-y-6">
          <div className={`${CARD_CLASS} p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Rapport généré</h2>
              <p className="text-xs text-slate-500 mt-1">Exportez le rapport en PDF ou en Word.</p>
            </div>
            <div className="flex flex-wrap gap-3" data-export-exclude="true">
              <Button variant="secondary" icon={Download} onClick={handleExportPdf} loading={exportingPdf}>Export PDF</Button>
              <Button variant="secondary" icon={Download} onClick={handleExportWord} loading={exportingWord}>Export Word</Button>
            </div>
          </div>

          <div ref={reportRef} className="space-y-10 rounded-[32px] border border-slate-200 bg-slate-50 p-6 md:p-8">
            {generatedScope.includeRisks && reportData.risks ? (
              <ReportBlock title="Gestion des risques" icon={ShieldAlert} subtitle={`Période utilisée : ${reportData.risks.periodLabel} · Criticité ${reportData.risks.selectedTypeCriticite}`}>
                {!reportData.risks.hasData ? (
                  <EmptyState text="Aucune donnée risque disponible pour le périmètre sélectionné." />
                ) : (
                  <div className="space-y-8">
                    <div className={`${CARD_CLASS} p-5 md:p-6 space-y-6`}>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-[#1f3763]">Statistiques sur les caractéristiques des risques</h3>
                        <p className="mt-1 text-[11px] md:text-xs text-slate-500">Les statistiques ci-dessous correspondent exactement à la période d'évaluation choisie.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <RiskMetricCard label="Risques actifs" value={reportData.risks.totalRisques} tone="blue" icon={Target} />
                        <RiskMetricCard label="Risques évalués" value={reportData.risks.evalues} tone="green" icon={CheckCircle2} />
                        <RiskMetricCard label="Non évalués" value={reportData.risks.nonEvalues} tone="orange" icon={AlertTriangle} />
                        <RiskMetricCard label="Taux de suivi" value={`${reportData.risks.tauxSuivi}%`} tone="purple" icon={BarChart3} />
                        <RiskMetricCard label="Taux de maîtrise" value={reportData.risks.tauxMaitrise === null ? 'N/A' : `${reportData.risks.tauxMaitrise}%`} tone="teal" icon={Shield} />
                        <RiskMetricCard label="Atténuation" value={reportData.risks.tauxAttenuation} tone="emerald" icon={TrendingDown} />
                      </div>
                      <div className="grid gap-5 xl:grid-cols-2">
                        <ProgressCard title="Répartition des risques évalués selon la criticité">
                          {reportData.risks.repartitionCriticite.map((item, index) => {
                            const total = reportData.risks.evalues || 0
                            const pct = total ? (item.value / total) * 100 : 0
                            const barColors = ['bg-green-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500']
                            return (
                              <div key={item.key} className="space-y-2">
                                <div className="flex items-center justify-between gap-4 text-xs md:text-sm text-slate-700">
                                  <span>{item.range} ({item.label})</span>
                                  <span className="font-semibold">{item.value} ({Math.round(pct)}%)</span>
                                </div>
                                <div className="h-8 rounded-full bg-slate-200/80 overflow-hidden">
                                  <div className={`h-full rounded-full ${barColors[index]}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </ProgressCard>
                        <ProgressCard title="Taux de risques critiques (8–16) par processus">
                          {(reportData.risks.criticalProcessRates || []).length ? reportData.risks.criticalProcessRates.map((item) => (
                            <div key={item.code} className="space-y-2">
                              <div className="flex items-center justify-between gap-4 text-xs md:text-sm text-slate-700">
                                <span>{item.label}</span>
                                <span className="font-semibold">{item.annotation}</span>
                              </div>
                              <div className="h-8 rounded-full bg-slate-200/80 overflow-hidden">
                                <div className="h-full rounded-full bg-red-500" style={{ width: `${item.value}%` }} />
                              </div>
                            </div>
                          )) : <EmptyState text="Aucun processus critique sur la période sélectionnée." />}
                        </ProgressCard>
                      </div>
                    </div>

                    <div className={`${CARD_CLASS} p-5 md:p-6 space-y-6`}>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-[#1f3763]">Statistiques de suivi du plan de maîtrise des risques</h3>
                        <p className="mt-1 text-[11px] md:text-xs text-slate-500">Les composantes de ce bloc reprennent exactement le suivi du plan de maîtrise affiché dans la rubrique Risque.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <RiskMetricCard label="Actions" value={reportData.risks.planStats.total} tone="blue" icon={Layers} />
                        <RiskMetricCard label="Réalisées" value={reportData.risks.planStats.realisees} tone="green" icon={CheckCircle2} />
                        <RiskMetricCard label="Non réalisées" value={reportData.risks.planStats.nonRealisees} tone="orange" icon={AlertTriangle} />
                        <RiskMetricCard label="Taux réalis." value={`${reportData.risks.planStats.tauxRealisation}%`} tone="purple" icon={BarChart3} />
                        <RiskMetricCard label="En retard" value={reportData.risks.planStats.enRetard} tone="red" icon={AlertTriangle} />
                        <RiskMetricCard label="Retard moy." value={`${reportData.risks.planStats.retardMoyen}j`} tone="amber" icon={BarChart3} />
                      </div>
                      <div className="grid gap-5 xl:grid-cols-2">
                        <ProgressCard title="Répartition actions par niveau de réalisation">
                          {[
                            { label: 'Achevée', value: (reportData.risks.planStats.parAvancement || []).find(x => x.label === 'Achevée')?.value || 0, color: 'bg-green-600' },
                            { label: 'Terminée - non confirmée', value: (reportData.risks.planStats.parAvancement || []).find(x => x.label === 'Terminée - non confirmée')?.value || 0, color: 'bg-green-400' },
                            { label: 'En cours +50%', value: (reportData.risks.planStats.parAvancement || []).find(x => x.label === 'En cours +50%')?.value || 0, color: 'bg-yellow-500' },
                            { label: 'En cours -50%', value: (reportData.risks.planStats.parAvancement || []).find(x => x.label === 'En cours -50%')?.value || 0, color: 'bg-orange-500' },
                            { label: 'Non entamée', value: (reportData.risks.planStats.parAvancement || []).find(x => x.label === 'Non entamée')?.value || 0, color: 'bg-red-600' }
                          ].map((item) => {
                            const totalActions = reportData.risks.planStats.total || 0
                            const pct = totalActions > 0 ? Math.round((item.value / totalActions) * 100) : 0
                            const width = totalActions > 0 ? (item.value / totalActions) * 100 : 0
                            return (
                              <div key={item.label} className="space-y-2">
                                <div className="flex items-center justify-between gap-4 text-xs md:text-sm text-slate-700">
                                  <span>{item.label}</span>
                                </div>
                                <div className="relative h-8 rounded-full bg-slate-200/80 overflow-hidden">
                                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[10px] font-bold">{item.value} ({pct}%)</span>
                                </div>
                              </div>
                            )
                          })}
                        </ProgressCard>
                        <ProgressCard title="Top 05 des structures avec un retard">
                          {(reportData.risks.planStats.topRetardStructures || []).length ? reportData.risks.planStats.topRetardStructures.map((item) => {
                            const totalRetards = (reportData.risks.planStats.allRetardStructures || []).reduce((sum, x) => sum + (x.value || 0), 0)
                            const v = item.value || 0
                            const pct = totalRetards > 0 ? Math.round((v / totalRetards) * 100) : 0
                            const width = totalRetards > 0 ? (v / totalRetards) * 100 : 0
                            return (
                              <div key={item.code} className="space-y-2">
                                <div className="flex items-center justify-between gap-4 text-xs md:text-sm text-slate-700">
                                  <span>{item.code}</span>
                                </div>
                                <div className="relative h-8 rounded-full bg-slate-200/80 overflow-hidden">
                                  <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(width, v > 0 ? 6 : 0)}%` }} />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[10px] font-bold">{v} action(s){totalRetards > 0 ? ` (${pct}%)` : ''}</span>
                                </div>
                              </div>
                            )
                          }) : <EmptyState text="Aucune structure en retard sur la période sélectionnée." />}
                        </ProgressCard>
                      </div>
                    </div>
                  </div>
                )}
              </ReportBlock>
            ) : null}

            <ReportBlock title="Performance globale par structure" icon={Layers}>
              <div className="space-y-5">
                <KeyFigure label="Performance globale" value={formatPct(reportData.performanceGlobal)} />
                <div>
                  <h3 className="text-xl font-bold text-[#1f3763] mb-4">Performance moyenne par structure</h3>
                  {reportData.performanceByStructure.length ? <PerformanceTable rows={reportData.performanceByStructure} /> : <EmptyState text="Aucune structure avec score de performance exploitable sur le périmètre choisi." />}
                </div>
              </div>
            </ReportBlock>

            {generatedScope.includeActivities ? (
              <ReportBlock title="Performance au niveau de la réalisation des actions" icon={Activity}>
                {!generatedScope.selectedProjectCodes.length || !reportData.actionsSection ? (
                  <EmptyState text="Aucun projet sélectionné. Le volet activités n'est donc pas intégré au rapport." />
                ) : (
                  <div className="space-y-6">
                    <SummaryStatsTable metrics={reportData.actionsSection.globalStats} footerLabel="Performance action" footerValue={reportData.actionsSection.globalStats.performanceAction} />
                    {reportData.actionsSection.byStructure.map((item) => (
                      <div key={item.code} className={`${CARD_CLASS} p-5 space-y-4`}>
                        <h3 className="text-2xl font-bold text-[#1f3763]">{item.label}</h3>
                        <SummaryStatsTable metrics={item} footerLabel="Performance action" footerValue={item.performanceAction} />
                      </div>
                    ))}
                    {!reportData.actionsSection.byStructure.length ? <EmptyState text="Aucune action disponible pour les structures et projets sélectionnés." /> : null}
                  </div>
                )}
              </ReportBlock>
            ) : null}

            {generatedScope.includeIndicators ? (
              <ReportBlock title="Performance au niveau de la production des indicateurs stratégiques" icon={BarChart3}>
                {!generatedScope.selectedGroupCodes.length || !reportData.indicatorsSection ? (
                  <EmptyState text="Aucun groupe d'indicateurs sélectionné. Le volet indicateurs n'est donc pas intégré au rapport." />
                ) : (
                  <div className="space-y-6">
                    <SummaryStatsTable metrics={reportData.indicatorsSection.globalStats} footerLabel="Performance indicateurs" footerValue={reportData.indicatorsSection.globalStats.performanceIndicateurs} />
                    {reportData.indicatorsSection.byStructure.map((item) => (
                      <div key={item.code} className={`${CARD_CLASS} p-5 space-y-4`}>
                        <h3 className="text-2xl font-bold text-[#1f3763]">{item.label}</h3>
                        <SummaryStatsTable metrics={item} footerLabel="Performance indicateurs" footerValue={item.performanceIndicateurs} />
                      </div>
                    ))}
                    {!reportData.indicatorsSection.byStructure.length ? <EmptyState text="Aucun indicateur disponible pour les structures et groupes sélectionnés." /> : null}
                  </div>
                )}
              </ReportBlock>
            ) : null}

            {generatedScope.includeActivities ? (
              <ReportBlock title="Liste des actions en retard" icon={AlertTriangle}>
                {!reportData.actionsSection?.delayedByStructure?.length ? (
                  <EmptyState text="Aucune action en retard pour le périmètre sélectionné." />
                ) : (
                  <div className="space-y-6">
                    {reportData.actionsSection.delayedByStructure.map((structure) => (
                      <div key={structure.code} className="space-y-3">
                        <h3 className="text-2xl font-bold text-[#1f3763]">{structure.label}</h3>
                        <DataTable
                          compact
                          columns={[
                            { key: 'projet', label: 'Projet' },
                            { key: 'action', label: 'Action' },
                            { key: 'dates', label: 'Dates' },
                            { key: 'avancement', label: 'Avancement' },
                            { key: 'joursRetard', label: 'Jours retard' },
                            { key: 'responsable', label: 'Responsable' },
                          ]}
                          rows={structure.rows.map((row) => ({
                            projet: row.__projectLabel,
                            action: row.__action?.libelle_action || row.libelle_action || '-',
                            dates: formatDateRange(row.date_debut, row.date_fin),
                            avancement: `${Math.round(row.__tx)}% • ${getActionProgressLabel(row)}`,
                            joursRetard: <span className="font-semibold text-[#d94841]">{Math.max(0, row.__daysLate)}</span>,
                            responsable: row.__responsable ? <div><div>{`${row.__responsable.nom || ''} ${row.__responsable.prenoms || ''}`.trim()}</div><div className="text-blue-700 underline">{row.__responsable.username}</div></div> : row.responsable || '-',
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ReportBlock>
            ) : null}

            {generatedScope.includeIndicators ? (
              <ReportBlock title="Liste des indicateurs dont la production est en retard" icon={CheckCircle2}>
                {!reportData.indicatorsSection?.delayedByStructure?.length ? (
                  <EmptyState text="Aucun indicateur en retard pour le périmètre sélectionné." />
                ) : (
                  <div className="space-y-6">
                    {reportData.indicatorsSection.delayedByStructure.map((structure) => (
                      <div key={structure.code} className="space-y-3">
                        <h3 className="text-2xl font-bold text-[#1f3763]">{structure.label}</h3>
                        <DataTable
                          compact
                          columns={[
                            { key: 'groupe', label: 'Groupe' },
                            { key: 'indicateur', label: 'Indicateur' },
                            { key: 'periode', label: 'Période' },
                            { key: 'dateLimite', label: 'Date limite' },
                            { key: 'joursRetard', label: 'Jours retard' },
                            { key: 'responsable', label: 'Responsable' },
                          ]}
                          rows={structure.rows.map((row) => ({
                            groupe: row.__groups.join(', ') || '-',
                            indicateur: row.__indicator?.libelle_indicateur || '-',
                            periode: row.periode || '-',
                            dateLimite: formatDateFr(row.date_limite_saisie || row.date_fin),
                            joursRetard: <span className="font-semibold text-[#d94841]">{Math.max(0, Math.floor((toDateOnlyRisk(new Date()) - toDateOnly(row.date_limite_saisie || row.date_fin)) / 86400000))}</span>,
                            responsable: row.__responsable ? <div><div>{`${row.__responsable.nom || ''} ${row.__responsable.prenoms || ''}`.trim()}</div><div className="text-blue-700 underline">{row.__responsable.username}</div></div> : row.__indicator?.responsable || '-',
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ReportBlock>
            ) : null}
          </div>
        </div>
      )}

      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xl text-slate-700">
            <Loader2 size={18} className="animate-spin" /> Chargement des données du module Rapports...
          </div>
        </div>
      ) : null}
    </div>
  )
}
