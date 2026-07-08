'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Search, AlertCircle, Download, FileText, FileSpreadsheet, Info } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { AlertModal } from '@/components/ui'
import { isPrivilegedUser, normalizeStructure } from '@/lib/access-scope'
import { computePerformanceRows, toDateOnly, DELAY_DEPTH_CAP_DAYS } from '@/lib/performance-metrics'

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return 'N/A'
  return `${value.toFixed(1)}%`
}

const badgeClass = (value) => {
  if (!Number.isFinite(value)) return 'bg-gray-100 text-gray-500'
  if (value >= 85) return 'bg-green-100 text-green-700'
  if (value >= 70) return 'bg-blue-100 text-blue-700'
  if (value >= 50) return 'bg-yellow-100 text-yellow-700'
  if (value >= 30) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

const scoreCellClass = (value) => {
  if (!Number.isFinite(value)) return ''
  if (value >= 85) return 'bg-green-50'
  if (value >= 70) return 'bg-blue-50'
  if (value >= 50) return 'bg-yellow-50'
  if (value >= 30) return 'bg-orange-50'
  return 'bg-red-50'
}

const formatDateInput = (value) => {
  const d = toDateOnly(value)
  if (!d) return ''
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

const RatioCell = ({ numerator, denominator, rate, emptyLabel = 'N/A' }) => {
  if (!denominator) return <span className="text-gray-400 text-[10px]">{emptyLabel}</span>

  return (
    <div className="flex flex-col items-center gap-0.5 leading-tight">
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${badgeClass(rate)}`}>
        {formatPercent(rate)}
      </span>
      <span className="text-[9px] text-gray-500">{numerator}/{denominator}</span>
    </div>
  )
}

const ScoreValueCell = ({ value, className = '' }) => {
  if (!Number.isFinite(value)) return <span className={`text-gray-400 text-[11px] ${className}`.trim()}>N/A</span>
  return <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${badgeClass(value)} ${className}`.trim()}>{formatPercent(value)}</span>
}

export default function PerformancesPage() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [structures, setStructures] = useState([])
  const [actions, setActions] = useState([])
  const [actionOccurrences, setActionOccurrences] = useState([])
  const [groupesActions, setGroupesActions] = useState([])
  const [indicators, setIndicators] = useState([])
  const [indicatorOccurrences, setIndicatorOccurrences] = useState([])
  const [performanceData, setPerformanceData] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [filters, setFilters] = useState({
    structure: '',
    utilisateur: '',
    periodeDebut: '',
    periodeFin: '',
    recherche: '',
  })

  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => {
    if (alertModal.onConfirm) alertModal.onConfirm()
    setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null })
  }

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
  }, [users, actions, actionOccurrences, groupesActions, indicators, indicatorOccurrences, filters.periodeDebut, filters.periodeFin])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, structRes, actionsRes, actionOccRes, groupesActionsRes, indicatorsRes, indicatorOccRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/structures?statut=Actif'),
        fetch('/api/actions?statut=Actif'),
        fetch('/api/actions/occurrences?include_archived=1'),
        fetch('/api/groupes-actions'),
        fetch('/api/indicateurs?include_archived=1'),
        fetch('/api/indicateurs/occurrences?include_archived=1'),
      ])

      if (usersRes.ok) setUsers((await usersRes.json()).users || [])
      if (structRes.ok) setStructures((await structRes.json()).structures || [])
      if (actionsRes.ok) setActions((await actionsRes.json()).actions || [])
      if (actionOccRes.ok) setActionOccurrences((await actionOccRes.json()).occurrences || [])
      if (groupesActionsRes.ok) setGroupesActions((await groupesActionsRes.json()).groupes || [])
      if (indicatorsRes.ok) setIndicators((await indicatorsRes.json()).indicateurs || [])
      if (indicatorOccRes.ok) setIndicatorOccurrences((await indicatorOccRes.json()).occurrences || [])
    } catch (error) {
      console.error('Erreur chargement performances:', error)
      showAlert('error', 'Erreur lors du chargement des performances.')
    } finally {
      setLoading(false)
    }
  }

  const calculatePerformances = () => {
    const periodStart = toDateOnly(filters.periodeDebut)
    const periodEnd = toDateOnly(filters.periodeFin)
    const rows = computePerformanceRows({
      users,
      actions,
      actionOccurrences,
      groupesActions,
      indicateurs: indicators,
      indicatorOccurrences,
      periodStart,
      periodEnd,
    })
    setPerformanceData(rows)
  }


  const visibleStructures = useMemo(() => {
    const structuresFromUsers = (users || [])
      .map(user => normalizeStructure(user?.structure || user?.code_structure))
      .filter(Boolean)
    const structuresFromRef = (structures || [])
      .map(item => normalizeStructure(item?.code_structure || item?.structure || item?.code))
      .filter(Boolean)
    return Array.from(new Set([...structuresFromRef, ...structuresFromUsers]))
      .sort((a, b) => a.localeCompare(b, 'fr'))
      .map(code => ({ code_structure: code }))
  }, [structures, users])

  const visibleUsers = useMemo(() => {
    const targetStructure = normalizeStructure(filters.structure)
    let pool = [...(users || [])]
    if (!isPrivilegedUser(currentUser)) {
      pool = pool.filter(user => normalizeStructure(user?.structure || user?.code_structure) === normalizeStructure(currentUser?.structure))
    } else if (targetStructure) {
      pool = pool.filter(user => normalizeStructure(user?.structure || user?.code_structure) === targetStructure)
    }
    return pool.sort((a, b) => `${a.nom || ''} ${a.prenoms || ''}`.localeCompare(`${b.nom || ''} ${b.prenoms || ''}`, 'fr'))
  }, [users, filters.structure, currentUser])

  const filteredData = useMemo(() => {
    let rows = [...performanceData]
    if (!isPrivilegedUser(currentUser)) {
      rows = rows.filter(item => normalizeStructure(item.code_structure) === normalizeStructure(currentUser?.structure))
    } else if (filters.structure) {
      rows = rows.filter(item => normalizeStructure(item.code_structure) === normalizeStructure(filters.structure))
    }
    if (filters.utilisateur) {
      rows = rows.filter(item => item.username === filters.utilisateur)
    }
    if (filters.recherche.trim()) {
      const query = filters.recherche.trim().toLowerCase()
      rows = rows.filter(item => (`${item.nom || ''} ${item.prenoms || ''} ${item.username || ''} ${item.email || ''}`).toLowerCase().includes(query))
    }
    return rows.sort((a, b) => {
      if (!Number.isFinite(a.scorePerformance) && !Number.isFinite(b.scorePerformance)) return 0
      if (!Number.isFinite(a.scorePerformance)) return 1
      if (!Number.isFinite(b.scorePerformance)) return -1
      return b.scorePerformance - a.scorePerformance
    })
  }, [performanceData, filters, currentUser])

  const scoreMoyen = useMemo(() => {
    const valid = filteredData.map(item => item.scorePerformance).filter(Number.isFinite)
    if (!valid.length) return null
    return valid.reduce((sum, value) => sum + value, 0) / valid.length
  }, [filteredData])

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

  const getExportRows = () => filteredData.map((item, index) => ({
    Rang: index + 1,
    Structure: item.code_structure || '-',
    Nom: item.nom || '-',
    'Prénom(s)': item.prenoms || '-',
    Email: item.username || '-',
    'Score actions': formatPercent(item.actionScore),
    'Actions échues réalisées': formatPercent(item.scoreActionsRealisees),
    'Actions réalisées dans le délai': formatPercent(item.scoreActionsDansDelai),
    'Profondeur retard actions': formatPercent(item.scoreRetardActions),
    'Volume actions': formatPercent(item.scoreVolumeActions),
    'Score indicateurs': formatPercent(item.indicatorScore),
    'Saisie périodes échues': formatPercent(item.scoreSaisieEchues),
    'Saisie dans le délai': formatPercent(item.scoreSaisieDelai),
    'Profondeur retard saisie': formatPercent(item.scoreRetardSaisie),
    'Volume indicateurs': formatPercent(item.scoreVolumeIndicateurs),
    'Atteinte des cibles': formatPercent(item.scoreAtteinteCibles),
    'Score management': formatPercent(item.managementScore),
    'Score final': formatPercent(item.scorePerformance),
  }))

  const exportPerformanceToExcel = () => {
    const rows = getExportRows()
    if (!rows.length) return showAlert('warning', 'Aucune donnée à exporter')
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Performances')
    XLSX.writeFile(wb, `performances_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportPerformanceToPdf = () => {
    const rows = getExportRows()
    if (!rows.length) return showAlert('warning', 'Aucune donnée à exporter')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
    doc.setFontSize(15)
    doc.text('Suivi des performances', 14, 14)
    doc.setFontSize(8)
    doc.text(`Export du ${new Date().toLocaleString('fr-FR')}`, 14, 20)
    autoTable(doc, {
      startY: 24,
      head: [Object.keys(rows[0])],
      body: rows.map(row => Object.values(row)),
      styles: { fontSize: 6.5, cellPadding: 1.4 },
      headStyles: { fillColor: [26, 54, 93] },
    })
    doc.save(`performances_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportPerformanceToWord = () => {
    const rows = getExportRows()
    if (!rows.length) return showAlert('warning', 'Aucune donnée à exporter')
    const headers = Object.keys(rows[0])
    const tableHtml = `
      <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:11px;">
        <thead><tr>${headers.map(h => `<th style="background:#1a365d;color:#fff;">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`
    const methodologyHtml = `
      <h3>Méthodologie de calcul</h3>
      <p>Le score final est borné entre 0% et 100%. Pour un collaborateur non manager, le score final correspond à la moyenne pondérée du score Actions (50) et du score Indicateurs (30), repondérée sur les composantes disponibles. Pour un manager, la moyenne des scores finaux de ses collaborateurs directs est ajoutée avec un poids de 20.</p>
      <p>Score Actions = 40% réalisation des actions échues + 25% réalisation dans le délai + 20% profondeur du retard + 15% volume d'actions.</p>
      <p>Score Indicateurs = 30% saisie des périodes échues + 25% saisie dans le délai + 20% profondeur du retard de saisie + 10% volume d'indicateurs + 15% atteinte des cibles. Ce score est commun à tous les membres d'une même structure.</p>`
    const html = `<html><head><meta charset="utf-8"></head><body><h2>Suivi des performances</h2>${tableHtml}${methodologyHtml}</body></html>`
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performances_${new Date().toISOString().split('T')[0]}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 md:px-5 md:py-4">
          <div className="flex items-center gap-2 rounded-full w-fit border border-blue-100 bg-blue-50/70 px-3 py-1 text-[11px] font-semibold text-blue-700">
            <TrendingUp size={13} /> Performance collaborateurs
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Utilisateurs classés</div>
              <div className="mt-1 text-2xl font-bold leading-none text-slate-900">{filteredData.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Score moyen</div>
              <div className="mt-1 text-2xl font-bold leading-none text-slate-900">{formatPercent(scoreMoyen)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pondération finale</div>
              <div className="mt-1 text-sm font-semibold leading-tight text-slate-900">Actions 50 · Indicateurs 30 · Management 20</div>
            </div>
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
              {visibleStructures.map(s => <option key={s.code_structure} value={s.code_structure}>{s.code_structure}</option>)}
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
              {visibleUsers.map(u => <option key={u.username} value={u.username}>{u.nom} {u.prenoms}</option>)}
            </select>
          </div>
          <div className="w-[280px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Période</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={formatDateInput(filters.periodeDebut)} onChange={e => updatePeriodFilter('periodeDebut', e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
              <input type="date" value={formatDateInput(filters.periodeFin)} onChange={e => updatePeriodFilter('periodeFin', e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
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
          <button onClick={exportPerformanceToPdf} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded border border-gray-200 inline-flex items-center gap-1"><Download size={12}/>PDF</button>
          <button onClick={exportPerformanceToWord} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded border border-gray-200 inline-flex items-center gap-1"><FileText size={12}/>Word</button>
          <button onClick={exportPerformanceToExcel} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded border border-gray-200 inline-flex items-center gap-1"><FileSpreadsheet size={12}/>Excel</button>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-amber-500 mt-0.5" />
          <span className="text-[10px] text-amber-600">
            Les occurrences actives seules sont prises en compte. Une occurrence est considérée comme échue lorsque sa date de fin est strictement antérieure à la date du jour. Les scores restent toujours bornés entre 0% et 100%.
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="overflow-x-auto md:overflow-x-auto md:overflow-y-auto md:max-h-[70vh]">
          <table className="w-full min-w-[1900px] text-xs md:text-[10px] table-fixed border-separate border-spacing-0">
            <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-30">
              <tr>
                <th className="md:sticky md:left-0 z-40 min-w-[70px] border-r border-white/10 bg-[#1a365d] px-3 py-3 text-center text-white md:shadow-[4px_0_10px_rgba(15,23,42,0.08)]">Rang</th>
                <th className="md:sticky md:left-[70px] z-40 min-w-[140px] border-r border-white/10 bg-[#1d426f] px-3 py-3 text-left text-white md:shadow-[4px_0_10px_rgba(15,23,42,0.08)]">Nom</th>
                <th className="md:sticky md:left-[210px] z-40 min-w-[160px] border-r border-white/10 bg-[#214b7d] px-3 py-3 text-left text-white md:shadow-[4px_0_10px_rgba(15,23,42,0.08)]">Prénom</th>
                <th className="min-w-[220px] px-3 py-3 text-left text-white">Email</th>
                <th className="min-w-[120px] px-3 py-3 text-center text-white">Structure</th>
                <th className="min-w-[110px] px-3 py-3 text-center text-white">Score actions</th>
                <th className="min-w-[120px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Actions échues<br/>réalisées</div></th>
                <th className="min-w-[125px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Actions réalisées<br/>dans le délai</div></th>
                <th className="min-w-[120px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Profondeur<br/>retard actions</div></th>
                <th className="min-w-[110px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Volume<br/>actions</div></th>
                <th className="min-w-[120px] px-3 py-3 text-center text-white">Score indicateurs</th>
                <th className="min-w-[125px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Saisie périodes<br/>échues</div></th>
                <th className="min-w-[120px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Saisie dans<br/>le délai</div></th>
                <th className="min-w-[130px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Profondeur retard<br/>de saisie</div></th>
                <th className="min-w-[115px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Volume<br/>indicateurs</div></th>
                <th className="min-w-[120px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Atteinte des<br/>cibles</div></th>
                <th className="min-w-[120px] px-3 py-3 text-center text-white"><div className="text-[11px] md:text-[10px] leading-tight">Score<br/>management</div></th>
                <th className="md:sticky md:right-0 z-40 min-w-[110px] border-l border-white/10 bg-indigo-700 px-3 py-3 text-center text-white md:shadow-[-4px_0_10px_rgba(15,23,42,0.08)]"><div className="text-[11px] md:text-[10px] leading-tight">Score<br/>final</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={18} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      Chargement...
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={18} className="text-center py-12 text-gray-500">Aucun utilisateur trouvé</td>
                </tr>
              ) : filteredData.map((user, idx) => (
                <tr key={user.id || user.username} className="group hover:bg-gray-50">
                  <td className="md:sticky md:left-0 z-20 bg-white px-3 py-2 text-center font-semibold text-gray-600 md:shadow-[4px_0_10px_rgba(15,23,42,0.04)] group-hover:bg-gray-50">{idx + 1}</td>
                  <td className="md:sticky md:left-[70px] z-20 bg-white px-3 py-2 font-medium text-gray-900 md:shadow-[4px_0_10px_rgba(15,23,42,0.04)] group-hover:bg-gray-50">{user.nom || '-'}</td>
                  <td className="md:sticky md:left-[210px] z-20 bg-white px-3 py-2 text-gray-700 md:shadow-[4px_0_10px_rgba(15,23,42,0.04)] group-hover:bg-gray-50">{user.prenoms || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{user.email || '-'}</td>
                  <td className="px-3 py-2 text-center"><span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">{user.code_structure || '-'}</span></td>
                  <td className="px-3 py-2 text-center"><ScoreValueCell value={user.actionScore} /></td>
                  <td className="px-3 py-2 text-center"><RatioCell numerator={user.realisedActionsCount} denominator={user.dueActionsCount} rate={user.scoreActionsRealisees} /></td>
                  <td className="px-3 py-2 text-center"><RatioCell numerator={user.realisedOnTimeActionsCount} denominator={user.dueActionsCount} rate={user.scoreActionsDansDelai} /></td>
                  <td className="px-3 py-2 text-center"><ScoreValueCell value={user.scoreRetardActions} /></td>
                  <td className="px-3 py-2 text-center"><ScoreValueCell value={user.scoreVolumeActions} /></td>
                  <td className="px-3 py-2 text-center"><ScoreValueCell value={user.indicatorScore} /></td>
                  <td className="px-3 py-2 text-center"><RatioCell numerator={user.filledDueIndicatorsCount} denominator={user.dueIndicatorsCount} rate={user.scoreSaisieEchues} /></td>
                  <td className="px-3 py-2 text-center"><RatioCell numerator={user.filledDueIndicatorsOnTimeCount} denominator={user.dueIndicatorsCount} rate={user.scoreSaisieDelai} /></td>
                  <td className="px-3 py-2 text-center"><ScoreValueCell value={user.scoreRetardSaisie} /></td>
                  <td className="px-3 py-2 text-center"><ScoreValueCell value={user.scoreVolumeIndicateurs} /></td>
                  <td className="px-3 py-2 text-center"><RatioCell numerator={user.reachedTargetIndicatorsCount} denominator={user.filledDueIndicatorsCount} rate={user.scoreAtteinteCibles} /></td>
                  <td className="px-3 py-2 text-center"><ScoreValueCell value={user.managementScore} /></td>
                  <td className={`md:sticky md:right-0 z-20 px-3 py-2 text-center md:shadow-[-4px_0_10px_rgba(15,23,42,0.04)] ${Number.isFinite(user.scorePerformance) ? scoreCellClass(user.scorePerformance) : 'bg-white'}`}><ScoreValueCell value={user.scorePerformance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Info size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Méthodologie détaillée de calcul du score de performance</h2>
            <p className="text-sm text-gray-600 mt-1">
              Le score final de chaque utilisateur est toujours compris entre 0% et 100%. Le tableau est trié par ordre décroissant du score final. Les valeurs N/A ne sont jamais intégrées dans les calculs : chaque moyenne pondérée est recalculée uniquement sur les composantes réellement disponibles afin d'éviter toute pénalisation artificielle.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">1. Score Actions</h3>
            <p className="text-sm text-gray-600 mb-2">Le score Actions mesure la qualité d'exécution des actions assignées à l'utilisateur.</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
              <li><strong>40%</strong> : taux de réalisation des actions échues, avec action considérée comme réalisée à partir de 100% d'avancement.</li>
              <li><strong>25%</strong> : taux de réalisation dans le délai des actions échues.</li>
              <li><strong>20%</strong> : profondeur du retard, calculée à partir du retard moyen des actions en retard ou réalisées hors délai, puis transformée en score décroissant avec plafond à {DELAY_DEPTH_CAP_DAYS} jours.</li>
              <li><strong>15%</strong> : volume d'actions assignées dans la période, comparé au volume moyen observé sur la population.</li>
              <li>Si toutes les composantes du bloc Actions sont indisponibles, le <strong>Score Actions</strong> reste affiché à <strong>N/A</strong>.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">2. Score Indicateurs</h3>
            <p className="text-sm text-gray-600 mb-2">Le score Indicateurs est commun à tous les membres d'une même structure, car les indicateurs sont pilotés au niveau structurel.</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
              <li><strong>30%</strong> : saisie des valeurs attendues pour les périodes échues.</li>
              <li><strong>25%</strong> : saisie des valeurs dans le délai pour les périodes échues.</li>
              <li><strong>20%</strong> : profondeur du retard de saisie, basée sur le retard moyen par rapport à la date limite de saisie.</li>
              <li><strong>10%</strong> : volume d'indicateurs à renseigner pour la structure.</li>
              <li><strong>15%</strong> : atteinte des cibles des indicateurs renseignés.</li>
              <li>Si toutes les composantes du bloc Indicateurs sont indisponibles, le <strong>Score Indicateurs</strong> reste affiché à <strong>N/A</strong>.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-2">3. Score final et management</h3>
            <p className="text-sm text-gray-700 mb-2">Le score final combine ensuite les blocs précédents.</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
              <li><strong>Poids standard</strong> : Actions 50, Indicateurs 30, Management 20.</li>
              <li>Pour un <strong>non-manager</strong>, le score final est calculé à partir des composantes disponibles, sans pénalisation liée à l'absence de collaborateurs.</li>
              <li>Pour un <strong>manager</strong>, le score management correspond à la moyenne des scores finaux de ses collaborateurs directs. Le manager est ainsi impacté par les résultats de son équipe.</li>
              <li>Chaque moyenne pondérée est automatiquement repondérée sur les composantes disponibles afin de conserver un score cohérent et borné entre 0% et 100%.</li>
              <li>Si les blocs Actions, Indicateurs et Management sont tous indisponibles, le <strong>Score final</strong> reste affiché à <strong>N/A</strong>.</li>
            </ul>
          </div>
        </div>
      </div>

      <AlertModal isOpen={alertModal.isOpen} type={alertModal.type} message={alertModal.message} onClose={closeAlert} />
    </div>
  )
}
