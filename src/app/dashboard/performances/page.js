'use client'

import { useMemo, useEffect, useState } from 'react'
import { TrendingUp, Search, AlertCircle, Info } from 'lucide-react'
import { AlertModal } from '@/components/ui'
import { isPrivilegedUser, normalizeStructure } from '@/lib/access-scope'

const toNumber = (value) => {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

const isFilled = (value) => value !== null && value !== undefined && `${value}`.trim() !== ''

const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const formatPercent = (value) => {
  const n = Number(value || 0)
  return `${n.toFixed(1)}%`
}

const computeRate = (num, den) => {
  if (!den) return null
  return (num / den) * 100
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

const getActionDelayDays = (occurrence) => {
  const tx = toNumber(occurrence?.tx_avancement) || 0
  const isDone = tx >= 100
  const dateFin = toDateOnly(occurrence?.date_fin)
  if (!dateFin) return 0

  const today = toDateOnly(new Date())
  const dateRealisation = toDateOnly(occurrence?.date_realisation)
  const dateConfirmation = toDateOnly(occurrence?.date_conf)
  const referenceDate = isDone ? (dateRealisation || dateConfirmation || today) : today

  return Math.floor((referenceDate - dateFin) / 86400000)
}

const badgeClass = (value) => {
  if (value === null || value === undefined) return 'bg-gray-100 text-gray-500'
  if (value >= 80) return 'bg-green-100 text-green-700'
  if (value >= 60) return 'bg-blue-100 text-blue-700'
  if (value >= 40) return 'bg-yellow-100 text-yellow-700'
  if (value >= 20) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

const scoreBadgeClass = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (value >= 80) return 'bg-green-500 text-white'
  if (value >= 60) return 'bg-green-100 text-green-700'
  if (value >= 40) return 'bg-yellow-500 text-white'
  if (value >= 20) return 'bg-orange-500 text-white'
  return 'bg-red-500 text-white'
}

const scoreCellClass = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (value >= 80) return 'bg-green-50'
  return 'bg-white'
}

const formatDateInput = (value) => {
  if (!value) return ''
  const d = toDateOnly(value)
  if (!d) return ''
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isWithinSelectedPeriod = (occurrence, periodStart, periodEnd) => {
  if (!periodStart && !periodEnd) return true
  const startDate = toDateOnly(occurrence?.date_debut)
  const endDate = toDateOnly(occurrence?.date_fin)
  if (periodStart && (!startDate || startDate < periodStart)) return false
  if (periodEnd && (!endDate || endDate > periodEnd)) return false
  return true
}

const RatioCell = ({ numerator, denominator, rate, emptyLabel = 'N/A' }) => {
  if (!denominator) {
    return <span className="text-gray-400 text-[10px]">{emptyLabel}</span>
  }

  return (
    <div className="flex flex-col items-center gap-0.5 leading-tight">
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${badgeClass(rate)}`}>
        {formatPercent(rate)}
      </span>
      <span className="text-[9px] text-gray-500">{numerator}/{denominator}</span>
    </div>
  )
}

const ScoreValueCell = ({ value }) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-gray-400 text-[10px]">N/A</span>
  }

  return (
    <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${scoreBadgeClass(value)}`}>
      {formatPercent(value)}
    </span>
  )
}

export default function PerformancesPage() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [structures, setStructures] = useState([])
  const [actionOccurrences, setActionOccurrences] = useState([])
  const [indicators, setIndicators] = useState([])
  const [indicatorOccurrences, setIndicatorOccurrences] = useState([])
  const [performanceData, setPerformanceData] = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => {
    if (alertModal.onConfirm) alertModal.onConfirm()
    setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

  const [filters, setFilters] = useState({
    structure: '',
    utilisateur: '',
    periodeDebut: '',
    periodeFin: '',
    recherche: ''
  })

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('giras_user')
      if (storedUser) {
        const parsed = JSON.parse(storedUser)
        setCurrentUser(parsed)
        if (!isPrivilegedUser(parsed)) {
          setFilters(prev => ({ ...prev, structure: normalizeStructure(parsed?.structure) }))
        }
      }
    } catch (error) {
      console.error('Erreur lecture utilisateur:', error)
    }
    fetchData()
  }, [])

  useEffect(() => {
    calculatePerformances()
  }, [users, actionOccurrences, indicators, indicatorOccurrences, filters.periodeDebut, filters.periodeFin])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, structRes, actionOccRes, indicatorsRes, indicatorOccRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/structures?statut=Actif'),
        fetch('/api/actions/occurrences?include_archived=1'),
        fetch('/api/indicateurs?include_archived=1'),
        fetch('/api/indicateurs/occurrences?include_archived=1')
      ])

      if (usersRes.ok) setUsers((await usersRes.json()).users || [])
      if (structRes.ok) setStructures((await structRes.json()).structures || [])
      if (actionOccRes.ok) setActionOccurrences((await actionOccRes.json()).occurrences || [])
      if (indicatorsRes.ok) setIndicators((await indicatorsRes.json()).indicateurs || [])
      if (indicatorOccRes.ok) setIndicatorOccurrences((await indicatorOccRes.json()).occurrences || [])
    } catch (error) {
      console.error('Erreur:', error)
      showAlert('error', 'Erreur lors du chargement des performances.')
    } finally {
      setLoading(false)
    }
  }

  const calculatePerformances = () => {
    const today = toDateOnly(new Date())
    const periodStart = toDateOnly(filters.periodeDebut)
    const periodEnd = toDateOnly(filters.periodeFin)
    const activeUsers = (users || []).filter(Boolean)
    const activeIndicators = (indicators || []).filter(ind => ind && ind.archive !== true && ind.statut !== 'Inactif')
    const indicatorMap = new Map(activeIndicators.map(ind => [String(ind.code_indicateur), ind]))

    const eligibleActionOccurrences = (actionOccurrences || []).filter(occ => (
      occ && occ.archive !== true && occ.statut !== 'Inactif'
    ))

    const eligibleIndicatorOccurrences = (indicatorOccurrences || []).filter(occ => {
      if (!occ || occ.archive === true || occ.statut === 'Inactif') return false
      return indicatorMap.has(String(occ.code_indicateur))
    })

    const baseMetrics = activeUsers.map(user => {
      const username = user.username

      const userDueActions = eligibleActionOccurrences.filter(occ => (
        occ.responsable === username &&
        isWithinSelectedPeriod(occ, periodStart, periodEnd) &&
        toDateOnly(occ.date_fin) &&
        toDateOnly(occ.date_fin) < today
      ))

      const realisedActions = userDueActions.filter(occ => (toNumber(occ.tx_avancement) || 0) >= 100)
      const realisedOnTimeActions = realisedActions.filter(occ => getActionDelayDays(occ) <= 0)
      const overdueOpenActions = userDueActions.filter(occ => (toNumber(occ.tx_avancement) || 0) < 100 && getActionDelayDays(occ) > 0)

      const userIndicatorOccurrences = eligibleIndicatorOccurrences.filter(occ => {
        const indicator = indicatorMap.get(String(occ.code_indicateur))
        return indicator?.responsable === username && isWithinSelectedPeriod(occ, periodStart, periodEnd)
      })

      const dueIndicatorOccurrences = userIndicatorOccurrences.filter(occ => {
        const endDate = toDateOnly(occ.date_fin)
        return endDate && endDate < today
      })

      const filledDueIndicators = dueIndicatorOccurrences.filter(occ => isFilled(occ.val_indicateur))
      const filledDueIndicatorsOnTime = filledDueIndicators.filter(occ => {
        const dateSaisie = toDateOnly(occ.date_saisie)
        const dateLimite = toDateOnly(occ.date_limite_saisie)
        return dateSaisie && dateLimite && dateSaisie <= dateLimite
      })

      const filledIndicatorsAll = userIndicatorOccurrences.filter(occ => isFilled(occ.val_indicateur))
      const reachedTargetIndicators = filledIndicatorsAll.filter(occ => {
        const indicator = indicatorMap.get(String(occ.code_indicateur))
        const cible = getIndicatorCible(indicator, occ)
        return isTargetReached(occ.val_indicateur, cible, indicator?.sens)
      })

      const txRealisationAction = computeRate(realisedActions.length, userDueActions.length)
      const txRealisationActionDelai = computeRate(realisedOnTimeActions.length, userDueActions.length)
      const renseigneIndic = computeRate(filledDueIndicators.length, dueIndicatorOccurrences.length)
      const renseigneIndicDelai = computeRate(filledDueIndicatorsOnTime.length, dueIndicatorOccurrences.length)
      const atteinteCible = computeRate(reachedTargetIndicators.length, filledIndicatorsAll.length)

      const weightedCriteria = [
        { key: 'txRealisationAction', value: txRealisationAction, weight: 0.25 },
        { key: 'txRealisationActionDelai', value: txRealisationActionDelai, weight: 0.15 },
        { key: 'renseigneIndic', value: renseigneIndic, weight: 0.20 },
        { key: 'renseigneIndicDelai', value: renseigneIndicDelai, weight: 0.10 },
        { key: 'atteinteCible', value: atteinteCible, weight: 0.20 }
      ]

      const availableWeight = weightedCriteria.reduce((sum, item) => sum + (item.value === null ? 0 : item.weight), 0)
      const weightedOwnScore = availableWeight > 0
        ? (weightedCriteria.reduce((sum, item) => sum + ((item.value === null ? 0 : item.value) * item.weight), 0) / availableWeight)
        : null

      return {
        ...user,
        code_structure: user.structure || user.code_structure || '',
        email: user.username,
        dueActionsCount: userDueActions.length,
        realisedActionsCount: realisedActions.length,
        realisedOnTimeActionsCount: realisedOnTimeActions.length,
        overdueOpenActionsCount: overdueOpenActions.length,
        dueIndicatorsCount: dueIndicatorOccurrences.length,
        filledDueIndicatorsCount: filledDueIndicators.length,
        filledDueIndicatorsOnTimeCount: filledDueIndicatorsOnTime.length,
        filledIndicatorsCount: filledIndicatorsAll.length,
        reachedTargetIndicatorsCount: reachedTargetIndicators.length,
        txRealisationAction,
        txRealisationActionDelai,
        renseigneIndic,
        renseigneIndicDelai,
        atteinteCible,
        scoreIndividuel: weightedOwnScore,
        subordinateCount: 0,
        scoreCollaborateur: null,
        scorePerformance: weightedOwnScore
      }
    })

    const withCollaboratorScores = baseMetrics.map(user => {
      const subordinates = baseMetrics.filter(item => item.superieur === user.username)
      const subordinateScores = subordinates.map(item => item.scoreIndividuel).filter(value => Number.isFinite(value))
      const scoreCollaborateur = subordinateScores.length > 0
        ? subordinateScores.reduce((sum, value) => sum + value, 0) / subordinateScores.length
        : null

      const weightedCriteria = [
        { value: user.txRealisationAction, weight: 0.25 },
        { value: user.txRealisationActionDelai, weight: 0.15 },
        { value: user.renseigneIndic, weight: 0.20 },
        { value: user.renseigneIndicDelai, weight: 0.10 },
        { value: user.atteinteCible, weight: 0.20 },
        { value: scoreCollaborateur, weight: 0.10 }
      ]

      const availableWeight = weightedCriteria.reduce((sum, item) => sum + (item.value === null ? 0 : item.weight), 0)
      const weightedScore = availableWeight > 0
        ? (weightedCriteria.reduce((sum, item) => sum + ((item.value === null ? 0 : item.value) * item.weight), 0) / availableWeight)
        : null

      return {
        ...user,
        subordinateCount: subordinates.length,
        scoreCollaborateur,
        scorePerformance: weightedScore,
        subordinates: subordinates.map(item => `${item.nom} ${item.prenoms}`.trim()).filter(Boolean)
      }
    })

    withCollaboratorScores.sort((a, b) => {
      if (a.scorePerformance === null && b.scorePerformance !== null) return 1
      if (b.scorePerformance === null && a.scorePerformance !== null) return -1
      if (a.scorePerformance !== b.scorePerformance) return (b.scorePerformance || 0) - (a.scorePerformance || 0)
      return `${a.nom || ''} ${a.prenoms || ''}`.localeCompare(`${b.nom || ''} ${b.prenoms || ''}`, 'fr', { sensitivity: 'base' })
    })

    setPerformanceData(withCollaboratorScores)
  }

  const filteredData = useMemo(() => {
    let filtered = [...performanceData]

    if (!isPrivilegedUser(currentUser)) {
      const allowedStructure = normalizeStructure(currentUser?.structure)
      filtered = filtered.filter(user => normalizeStructure(user.code_structure) === allowedStructure)
    }

    if (filters.structure) filtered = filtered.filter(user => normalizeStructure(user.code_structure) === normalizeStructure(filters.structure))
    if (filters.utilisateur) filtered = filtered.filter(user => user.username === filters.utilisateur)
    if (filters.recherche) {
      const search = filters.recherche.toLowerCase()
      filtered = filtered.filter(user => (
        user.nom?.toLowerCase().includes(search) ||
        user.prenoms?.toLowerCase().includes(search) ||
        user.username?.toLowerCase().includes(search)
      ))
    }

    return filtered
  }, [currentUser, filters, performanceData])

  const visibleStructures = useMemo(() => {
    if (isPrivilegedUser(currentUser)) return structures
    const allowedStructure = normalizeStructure(currentUser?.structure)
    return (structures || []).filter(s => normalizeStructure(s.code_structure) === allowedStructure)
  }, [currentUser, structures])

  const visibleUsers = useMemo(() => {
    if (isPrivilegedUser(currentUser)) return users
    const allowedStructure = normalizeStructure(currentUser?.structure)
    return (users || []).filter(u => normalizeStructure(u.structure || u.code_structure) === allowedStructure)
  }, [currentUser, users])

  const scoreMoyenItems = filteredData.filter(item => item.scorePerformance !== null && item.scorePerformance !== undefined)
  const scoreMoyen = scoreMoyenItems.length > 0
    ? scoreMoyenItems.reduce((sum, item) => sum + item.scorePerformance, 0) / scoreMoyenItems.length
    : null

  const updatePeriodFilter = (field, value) => {
    const nextFilters = { ...filters, [field]: value }
    const start = toDateOnly(nextFilters.periodeDebut)
    const end = toDateOnly(nextFilters.periodeFin)

    if (start && end) {
      if (end < start) {
        showAlert('error', 'La borne supérieure de la période doit être postérieure ou égale à la borne inférieure.')
        return
      }
      const diffDays = Math.floor((end - start) / 86400000)
      if (diffDays > 366) {
        showAlert('error', 'La période sélectionnée ne peut pas excéder un an.')
        return
      }
    }

    setFilters(nextFilters)
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Suivi des performances</h1>
            <p className="text-sm text-gray-500">Classement des utilisateurs du plus performant au moins performant</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[120px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Structure</label>
            <select
              value={filters.structure}
              onChange={e => setFilters({ ...filters, structure: e.target.value })}
              disabled={!isPrivilegedUser(currentUser)}
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Toutes</option>
              {visibleStructures.map(s => (
                <option key={s.code_structure} value={s.code_structure}>{s.code_structure}</option>
              ))}
            </select>
          </div>
          <div className="w-[180px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Utilisateur</label>
            <select
              value={filters.utilisateur}
              onChange={e => setFilters({ ...filters, utilisateur: e.target.value })}
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
            >
              <option value="">Tous</option>
              {visibleUsers.map(u => (
                <option key={u.username} value={u.username}>{u.nom} {u.prenoms}</option>
              ))}
            </select>
          </div>
          <div className="w-[280px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Période</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={formatDateInput(filters.periodeDebut)}
                onChange={e => updatePeriodFilter('periodeDebut', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
              />
              <input
                type="date"
                value={formatDateInput(filters.periodeFin)}
                onChange={e => updatePeriodFilter('periodeFin', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Recherche</label>
            <div className="relative">
              <input
                type="text"
                value={filters.recherche}
                onChange={e => setFilters({ ...filters, recherche: e.target.value })}
                placeholder="Nom, prénom, email..."
                className="w-full px-2 py-1.5 pr-8 rounded border border-gray-200 text-xs"
              />
              <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <button
            onClick={() => setFilters({ structure: isPrivilegedUser(currentUser) ? '' : normalizeStructure(currentUser?.structure), utilisateur: '', periodeDebut: '', periodeFin: '', recherche: '' })}
            className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded border border-gray-200"
          >
            Reset
          </button>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-amber-500 mt-0.5" />
          <span className="text-[10px] text-amber-600">
            Les actions et indicateurs sont calculés uniquement sur les occurrences actives. Une occurrence est dite échue lorsque sa date de fin est strictement antérieure à la date du jour. Si une période est sélectionnée, seules les occurrences dont la date de début est supérieure ou égale à la borne inférieure et dont la date de fin est inférieure ou égale à la borne supérieure sont retenues.
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-center text-white">Rang</th>
                <th className="px-2 py-2 text-left text-white">Nom</th>
                <th className="px-2 py-2 text-left text-white">Prénom</th>
                <th className="px-2 py-2 text-left text-white">Email</th>
                <th className="px-2 py-2 text-center text-white">Structure</th>
                <th className="px-2 py-2 text-center text-white"><div className="text-[9px] leading-tight">Tx réalisation<br/>action</div></th>
                <th className="px-2 py-2 text-center text-white"><div className="text-[9px] leading-tight">Tx réalisation<br/>action délai</div></th>
                <th className="px-2 py-2 text-center text-white"><div className="text-[9px] leading-tight">Renseigne<br/>indic</div></th>
                <th className="px-2 py-2 text-center text-white"><div className="text-[9px] leading-tight">Renseigne<br/>indic délai</div></th>
                <th className="px-2 py-2 text-center text-white"><div className="text-[9px] leading-tight">Atteinte<br/>cible</div></th>
                <th className="px-2 py-2 text-center text-white"><div className="text-[9px] leading-tight">Score<br/>collaborateur</div></th>
                <th className="px-2 py-2 text-center text-white bg-indigo-700"><div className="text-[9px] leading-tight">Score<br/>performance</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      Chargement...
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-500">Aucun utilisateur trouvé</td>
                </tr>
              ) : (
                filteredData.map((user, idx) => (
                  <tr key={user.id || user.username} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-center font-semibold text-gray-600">{idx + 1}</td>
                    <td className="px-2 py-1.5 font-medium text-gray-900">{user.nom || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-700">{user.prenoms || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-600">{user.email || '-'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-mono">{user.code_structure || '-'}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center"><RatioCell numerator={user.realisedActionsCount} denominator={user.dueActionsCount} rate={user.txRealisationAction} /></td>
                    <td className="px-2 py-1.5 text-center"><RatioCell numerator={user.realisedOnTimeActionsCount} denominator={user.dueActionsCount} rate={user.txRealisationActionDelai} /></td>
                    <td className="px-2 py-1.5 text-center"><RatioCell numerator={user.filledDueIndicatorsCount} denominator={user.dueIndicatorsCount} rate={user.renseigneIndic} /></td>
                    <td className="px-2 py-1.5 text-center"><RatioCell numerator={user.filledDueIndicatorsOnTimeCount} denominator={user.dueIndicatorsCount} rate={user.renseigneIndicDelai} /></td>
                    <td className="px-2 py-1.5 text-center"><RatioCell numerator={user.reachedTargetIndicatorsCount} denominator={user.filledIndicatorsCount} rate={user.atteinteCible} /></td>
                    <td className="px-2 py-1.5 text-center"><ScoreValueCell value={user.scoreCollaborateur} /></td>
                    <td className={`px-2 py-1.5 text-center ${scoreCellClass(user.scorePerformance)}`}>
                      <ScoreValueCell value={user.scorePerformance} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredData.length > 0 && (
          <div className="px-3 py-2 bg-gray-50 border-t text-[10px] text-gray-500 flex items-center justify-between">
            <span>Total utilisateurs classés : {filteredData.length}</span>
            <span>Score moyen : <strong className="text-gray-700">{scoreMoyen === null ? 'N/A' : formatPercent(scoreMoyen)}</strong></span>
          </div>
        )}
      </div>

      <div className="mt-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-800">Méthode détaillée de calcul du score de performance</h4>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-[11px] text-gray-700">
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="font-semibold text-gray-800 mb-2">1. Ratios calculés pour chaque utilisateur</p>
            <div className="space-y-1.5">
              <p><strong>Tx réalisation action</strong> = actions échues réalisées / actions échues.</p>
              <p><strong>Tx réalisation action délai</strong> = actions échues réalisées dans le délai / actions échues.</p>
              <p><strong>Renseigne indic</strong> = indicateurs échus renseignés / indicateurs échus.</p>
              <p><strong>Renseigne indic délai</strong> = indicateurs échus renseignés dans le délai / indicateurs échus.</p>
              <p><strong>Atteinte cible</strong> = indicateurs renseignés dont la cible est atteinte / indicateurs renseignés.</p>
              <p><strong>Score collaborateur</strong> = moyenne des <em>scores individuels</em> des collaborateurs rattachés directement à l'utilisateur.</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="font-semibold text-gray-800 mb-2">2. Pondération retenue</p>
            <div className="space-y-1.5">
              <p>Tx réalisation action : <strong>25%</strong></p>
              <p>Tx réalisation action délai : <strong>15%</strong></p>
              <p>Renseigne indic : <strong>20%</strong></p>
              <p>Renseigne indic délai : <strong>10%</strong></p>
              <p>Atteinte cible : <strong>20%</strong></p>
              <p>Score collaborateur : <strong>10%</strong></p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-900 space-y-1.5">
          <p><strong>Formule finale :</strong> le score de performance est une moyenne pondérée des critères disponibles. Si un critère n'est pas applicable à un utilisateur, sa pondération est redistribuée automatiquement entre les autres critères applicables. Si toutes les composantes sont non applicables, le score affiché est <strong>N/A</strong>.</p>
          <p><strong>Intervalle strict du score :</strong> le score est borné entre <strong>0%</strong> et <strong>100%</strong>, soit <strong>0 ≤ score ≤ 100</strong>.</p>
          <p><strong>Pourquoi cette méthode est cohérente :</strong> elle récompense d'abord l'exécution des actions, puis la ponctualité, ensuite la discipline de renseignement des indicateurs, la qualité d'atteinte des cibles, et enfin la capacité à faire progresser ses collaborateurs sans créer de boucle de calcul hiérarchique.</p>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        type={alertModal.type}
        message={alertModal.message}
      />
    </div>
  )
}
