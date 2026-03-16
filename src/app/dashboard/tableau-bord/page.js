'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Target, Activity, CheckCircle, AlertTriangle, TrendingUp, Search, Maximize2, X, Clock, Users, FileText, Percent, Calendar, List, ListChecks, Timer, RotateCcw, Layers, Shield, TrendingDown } from 'lucide-react'
import { SidebarButton, Modal, Button, SearchableSelect } from '@/components/ui'
import { computePlanRiskStats } from '@/lib/risques-plan-stats'
import { canAccessRisk, isPrivilegedUser, normalizeStructure, normalizeUsername, getActionResponsibles } from '@/lib/access-scope'

// Composant StatCard
const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600'
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

// Composant ProgressBarChart pour les barres horizontales
const ProgressBarChart = ({ data, maxValue, showExpand, onExpand, title, emptyMessage }) => {
  const getBarColor = (item, index) => {
    if (item.color) return item.color
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
    return colors[index % colors.length]
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {showExpand && (
          <button onClick={onExpand} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Voir tout">
            <Maximize2 size={16} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0
          return (
            <div key={index} className="group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600 truncate max-w-[150px]" title={item.label}>{item.label}</span>
                <span className="text-xs font-medium text-gray-700">{item.display || item.value}</span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                  style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: getBarColor(item, index) }}
                />
                {item.annotation && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-medium">
                    {item.annotation}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {data.length === 0 && <p className="text-xs text-gray-400 text-center py-4">{emptyMessage || 'Aucune donnée'}</p>}
      </div>
    </div>
  )
}


const DashboardFilterField = ({ label, children, className = '' }) => (
  <div className={`min-w-[160px] ${className}`}>
    <label className="block text-[13px] font-medium text-gray-600 mb-2">{label}</label>
    {children}
  </div>
)

const dashboardInputClass = 'w-full h-12 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'

const DashboardStatCard = ({ title, value, icon: Icon, tone = 'blue', suffix = '', compact = false }) => {
  const tones = {
    blue: {
      card: 'bg-blue-50 border-blue-100',
      icon: 'bg-blue-100 text-blue-600',
      value: 'text-blue-700',
      title: 'text-blue-600'
    },
    green: {
      card: 'bg-green-50 border-green-100',
      icon: 'bg-green-100 text-green-600',
      value: 'text-green-700',
      title: 'text-green-600'
    },
    orange: {
      card: 'bg-orange-50 border-orange-100',
      icon: 'bg-orange-100 text-orange-600',
      value: 'text-orange-700',
      title: 'text-orange-600'
    },
    red: {
      card: 'bg-red-50 border-red-100',
      icon: 'bg-red-100 text-red-600',
      value: 'text-red-700',
      title: 'text-red-600'
    },
    purple: {
      card: 'bg-purple-50 border-purple-100',
      icon: 'bg-purple-100 text-purple-600',
      value: 'text-purple-700',
      title: 'text-purple-600'
    },
    amber: {
      card: 'bg-amber-50 border-amber-100',
      icon: 'bg-amber-100 text-amber-600',
      value: 'text-amber-700',
      title: 'text-amber-600'
    }
  }
  const toneMap = tones[tone] || tones.blue

  return (
    <div className={`${toneMap.card} border rounded-xl px-3 py-2.5 min-h-[74px]`}>
      <div className="flex items-center gap-2">
        <div className={`${toneMap.icon} w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon size={compact ? 14 : 16} />
        </div>
        <div className="min-w-0">
          <p className={`${toneMap.value} text-lg font-bold leading-none`}>
            {value}{suffix}
          </p>
          <p className={`${toneMap.title} mt-1 text-[11px] font-medium leading-tight`}>{title}</p>
        </div>
      </div>
    </div>
  )
}

const DashboardProgressCard = ({ title, data, icon: Icon, onExpand, emptyMessage = 'Aucune donnée', maxValue = null }) => (
  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 h-full">
    <div className="flex items-center justify-between gap-4 mb-4">
      <h4 className="font-semibold text-gray-700">{title}</h4>
      {onExpand ? (
        <button
          onClick={onExpand}
          className="p-1 hover:bg-gray-200 rounded text-gray-500"
          title="Voir le graphique en grand"
        >
          <Icon size={14} />
        </button>
      ) : null}
    </div>
    <div className="space-y-3">
      {data.length === 0 ? (
        <p className="text-gray-500 text-center py-4 text-sm">{emptyMessage}</p>
      ) : (
        data.map((item, index) => {
          const baseValue = Number(item.widthValue ?? item.value ?? 0)
          const denominator = maxValue ?? Math.max(...data.map((entry) => Number(entry.widthValue ?? entry.value ?? 0)), 0)
          const width = denominator > 0 ? (baseValue / denominator) * 100 : 0
          const barColor = item.color || (index % 4 === 0 ? 'bg-blue-500' : index % 4 === 1 ? 'bg-green-400' : index % 4 === 2 ? 'bg-amber-500' : 'bg-red-500')
          return (
            <div key={`${item.label}-${index}`} className="group">
              <div className="flex justify-between text-xs mb-1 gap-2">
                <span className="text-gray-600 truncate max-w-[240px]" title={item.label}>{item.label}</span>
              </div>
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                <div className={`${barColor} h-full rounded-full transition-all duration-300 group-hover:opacity-85`} style={{ width: `${Math.max(Math.min(width, 100), baseValue > 0 ? 6 : 0)}%` }} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[10px] font-bold">
                  {item.annotation || item.display || item.value}
                </span>
              </div>
            </div>
          )
        })
      )}
    </div>
  </div>
)

export default function TableauBordPage() {
  console.log('[TABLEAU-BORD] Composant chargé')
  
  const [activeTab, setActiveTab] = useState('indicateurs')
  const [loading, setLoading] = useState(true)
  
  // Données
  const [indicateurs, setIndicateurs] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [actions, setActions] = useState([])
  const [planActions, setPlanActions] = useState([])
  const [planOccurrences, setPlanOccurrences] = useState([])

  const normalizeActionCodeForPlan = (value) => {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  const getRiskCodesFromAction = (action) => {
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
    pushValue(action?.code_risque)
    pushValue(action?.code_risques)
    return [...new Set(values)]
  }

  const isRiskGroupCode = (value) => ['RISQUES', 'RISQUE', 'Risque'].includes((value ?? '').toString().trim())
  const isRiskActionLegacy = (action) => getRiskCodesFromAction(action).length > 0 || isRiskGroupCode(action?.code_groupe)
  const getPrimaryRiskCode = (action) => getRiskCodesFromAction(action)[0] || null

  const getOccurrenceActionCode = (occ) => normalizeActionCodeForPlan(occ?.code_action || occ?.code_action_occ || occ?.__actionCode)
  const getOccurrenceIndicatorCode = (occ) => String(occ?.code_indicateur || occ?.code_indicateur_occ || '').trim()

  const restrictStructureCode = (code) => normalizeStructure(code)

  const canViewDashboardIndicator = (indicator, occurrence = null) => {
    if (!currentUser) return true
    if (isPrivilegedUser(currentUser)) return true

    const userStructure = normalizeStructure(currentUser?.structure)
    const itemStructure = normalizeStructure(
      occurrence?.code_structure ||
      indicator?.code_structure ||
      occurrence?.structure ||
      indicator?.structure
    )

    return !!userStructure && !!itemStructure && userStructure === itemStructure
  }

  const canViewDashboardAction = (action, occurrence = null) => {
    if (!currentUser) return true
    if (isPrivilegedUser(currentUser)) return true

    const currentUsername = normalizeUsername(currentUser?.username)
    if (!currentUsername) return false

    const actionResponsible = normalizeUsername(
      action?.responsable || action?.occ_responsable || action?.latest_occurrence?.responsable
    )
    const occurrenceResponsible = normalizeUsername(occurrence?.responsable)

    return actionResponsible === currentUsername || occurrenceResponsible === currentUsername
  }

  const canViewDashboardRisk = (risk) => {
    if (!currentUser) return true
    return canAccessRisk(currentUser, risk)
  }


  const findOccurrenceForAction = (action) => {
    const actionCode = normalizeActionCodeForPlan(action?.code_action)
    if (!actionCode) return {}
    return (planOccurrences || []).find(o => getOccurrenceActionCode(o) === actionCode) || {}
  }
  const [risques, setRisques] = useState([])
  const [risquesProbabilites, setRisquesProbabilites] = useState([])
  const [structures, setStructures] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [groupes, setGroupes] = useState([])
  const [projets, setProjets] = useState([])
  const [processus, setProcessus] = useState([])
  const [categories, setCategories] = useState([])
  const [periodeOuverte, setPeriodeOuverte] = useState(null)
  const [allPeriodes, setAllPeriodes] = useState([]) // Toutes les périodes
  const [attenuationAppreciationType, setAttenuationAppreciationType] = useState('Année')
  
  // Filtres Indicateurs
  const [indFilters, setIndFilters] = useState({
    structure: '', type_indicateur: '', sens: '', projet: '',
    dateDebut: '', dateFin: ''
  })
  
  // Filtres Actions
  const [actFilters, setActFilters] = useState({
    structure: '', groupe: '', dateDebut: '', dateFin: ''
  })
  
  // Filtres Risques - Globaux (DOIVENT être identiques à la Synthèse de Gestion des risques)
  // Champs : Catégorie / Structure / Processus
  const [riskGlobalFilters, setRiskGlobalFilters] = useState({
    categorie: '',
    structure: '',
    processus: ''
  })
  
  // Filtres Risques - Bloc caractéristiques
  const [riskPeriodFilters, setRiskPeriodFilters] = useState({
    annee: '', semestre: '', trimestre: '', mois: ''
  })

  // Type de criticité (Brute/Nette) - même champ que la Synthèse (Gestion des risques)
  const [riskTypeCriticite, setRiskTypeCriticite] = useState('Nette')

  // Modal "Tous les processus" (plein écran) pour le graphique "Taux de risques critiques (8–16) par processus"
  // Doit être identique à l'affichage correspondant dans "Gestion des risques > Synthèse".
  const [showProcessusCritiquesModal, setShowProcessusCritiquesModal] = useState(false)
  
  // Filtres Risques - Bloc plan maîtrise
  const [riskPlanFilters, setRiskPlanFilters] = useState({ dateDebut: '', dateFin: '' })
  const [riskPlanRows, setRiskPlanRows] = useState([])
  
  // Modal expansion
  const [showExpandModal, setShowExpandModal] = useState(false)
  const [expandData, setExpandData] = useState({ title: '', data: [] })

  // Modal dédiée pour le "Top 05 des structures avec un retard" (plan de maîtrise)
  // Rendu identique à "Gestion des risques > Synthèse".
  const [showStructuresRetardModal, setShowStructuresRetardModal] = useState(false)

  const handleTabChange = (tab) => {
    console.log('[TABLEAU-BORD] Changement d\'onglet vers:', tab)
    setActiveTab(tab)
  }

  const subPages = [
    { key: 'indicateurs', label: 'Indicateurs', icon: BarChart3 },
    { key: 'actions', label: 'Actions', icon: Activity },
    { key: 'risques', label: 'Risques', icon: Target }
  ]

  const moisList = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  // Normaliser une période (API) vers les valeurs attendues par les champs de filtres (UI)
  // - annee: "2025"
  // - semestre: "Semestre 1"
  // - trimestre: "Trimestre 2"
  // - mois: "Janvier"
  const normalizePeriodeToRiskFilters = (p) => {
    if (!p) return { annee: '', semestre: '', trimestre: '', mois: '' }
    const annee = p?.annee ? String(p.annee) : ''

    const toSemestre = (v) => {
      if (!v) return ''
      const s = String(v)
      return s.toLowerCase().includes('semestre') ? s : `Semestre ${s}`
    }
    const toTrimestre = (v) => {
      if (!v) return ''
      const s = String(v)
      return s.toLowerCase().includes('trimestre') ? s : `Trimestre ${s}`
    }
    const toMois = (v) => {
      if (!v) return ''
      if (typeof v === 'number') return moisList[v - 1] || ''
      const s = String(v)
      // si l'API renvoie déjà le libellé (Janvier, ...), le garder
      if (moisList.includes(s)) return s
      // sinon essayer de convertir "1".."12"
      const n = parseInt(s, 10)
      if (!Number.isNaN(n) && n >= 1 && n <= 12) return moisList[n - 1]
      return s
    }

    // Priorité à la granularité la plus fine (mois > trimestre > semestre)
    const mois = toMois(p?.mois)
    const trimestre = mois ? '' : toTrimestre(p?.trimestre)
    const semestre = (mois || trimestre) ? '' : toSemestre(p?.semestre)

    return { annee, semestre, trimestre, mois }
  }

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('giras_user')
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser))
      }

      const saved = localStorage.getItem('giras_attenuation_appreciation_type')
      if (saved) setAttenuationAppreciationType(saved)
    } catch (e) {
      console.warn('Erreur lors du chargement des préférences du tableau de bord:', e)
    }

    fetchBaseData()
  }, [])

  const fetchBaseData = async () => {
    setLoading(true)
    try {
      const [structRes, groupRes, projetsRes, procRes, catRes, indRes, occRes, tachesRes, planActionsRes, planOccRes, riskRes, probRes, perRes, allPerRes] = await Promise.all([
        fetch('/api/structures?statut=Actif'),
        fetch('/api/groupe-indicateurs?statut=Actif'),
        fetch('/api/groupes-actions?statut=Actif'),
        fetch('/api/processus?statut=Actif'),
        fetch('/api/categories'),
        fetch('/api/indicateurs?withOccurrences=true'),
        fetch('/api/indicateurs/occurrences'),
        fetch('/api/taches'),
        fetch('/api/actions'),
        fetch('/api/actions/occurrences'),
        fetch('/api/risques'),
        fetch('/api/risques/probabilite'),
        fetch('/api/periodes?statut=Ouvert'),
        fetch('/api/periodes') // Toutes les périodes
      ])

      if (structRes.ok) setStructures((await structRes.json()).structures || [])
      if (groupRes.ok) setGroupes((await groupRes.json()).groupes || [])
      if (projetsRes.ok) setProjets((await projetsRes.json()).groupes || [])
      if (procRes.ok) setProcessus((await procRes.json()).processus || [])
      if (catRes.ok) setCategories((await catRes.json()).categories || [])
      if (indRes.ok) setIndicateurs((await indRes.json()).indicateurs || [])
      if (occRes.ok) setOccurrences((await occRes.json()).occurrences || [])
      if (tachesRes.ok) setActions((await tachesRes.json()).taches || [])
      if (planActionsRes.ok) setPlanActions((await planActionsRes.json()).actions || [])
      if (planOccRes.ok) setPlanOccurrences((((await planOccRes.json()).occurrences) || []).map(o => ({ ...o, __actionCode: String(o?.code_action || o?.code_action_occ || '').trim() })))
      if (riskRes.ok) setRisques((await riskRes.json()).risques || [])
      if (probRes.ok) setRisquesProbabilites((await probRes.json()).probabilites || [])
      
      // Charger toutes les périodes
      if (allPerRes.ok) {
        const allPer = (await allPerRes.json()).periodes || []
        setAllPeriodes(allPer)
      }
      
      if (perRes.ok) {
        const periodes = (await perRes.json()).periodes || []
        if (periodes.length > 0) {
          const p = periodes[0]
          setPeriodeOuverte(p)
          setRiskPeriodFilters(normalizePeriodeToRiskFilters(p))
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // ==================== OUTILS COMMUNS DASHBOARD ====================
  const getPeriodeLabel = (p) => {
    if (!p) return ''
    if (typeof p === 'string') return p
    if (p.libelle) return String(p.libelle)
    if (p.semestre) return `S${p.semestre}-${p.annee}`
    if (p.trimestre) return `T${p.trimestre}-${p.annee}`
    if (p.mois) return `M${String(p.mois).padStart(2, '0')}-${p.annee}`
    return p.annee ? String(p.annee) : ''
  }

  const parseDateSafe = (value) => {
    if (!value) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const getRangeEndWithinOneYear = (startValue, endValue) => {
    const start = parseDateSafe(startValue)
    const end = parseDateSafe(endValue)
    if (!start) return end
    const limit = new Date(start)
    limit.setFullYear(limit.getFullYear() + 1)
    if (!end) return limit
    return end > limit ? limit : end
  }

  const getPeriodeDateRange = (periodeValue) => {
    if (!periodeValue) return { start: null, end: null }
    const found = (allPeriodes || []).find(p => getPeriodeLabel(p) === periodeValue || String(p.id) === String(periodeValue))
    if (!found) return { start: null, end: null }
    return {
      start: parseDateSafe(found.date_debut || found.dateDebut),
      end: parseDateSafe(found.date_fin || found.dateFin)
    }
  }

  const getDateWindow = (filters) => {
    if (filters?.periode) {
      const byPeriode = getPeriodeDateRange(filters.periode)
      if (byPeriode.start || byPeriode.end) return byPeriode
    }
    const start = parseDateSafe(filters?.dateDebut)
    const end = getRangeEndWithinOneYear(filters?.dateDebut, filters?.dateFin)
    return { start, end }
  }

  const dateOverlapsWindow = (itemStart, itemEnd, windowStart, windowEnd) => {
    const start = parseDateSafe(itemStart)
    const end = parseDateSafe(itemEnd || itemStart)
    if (!windowStart && !windowEnd) return true
    if (!start && !end) return true
    const actualStart = start || end
    const actualEnd = end || start
    if (windowStart && actualEnd && actualEnd < windowStart) return false
    if (windowEnd && actualStart && actualStart > windowEnd) return false
    return true
  }

  const getOccurrencePeriodeKey = (occ) => {
    return String(
      occ?.periode || occ?.libelle_periode || occ?.periode_libelle || occ?.periode_evaluation || occ?.periode_label || ''
    ).trim()
  }

  const matchText = (value, search) => String(value || '').toLowerCase().includes(String(search || '').toLowerCase())

  const isArchivedRecord = (item) => {
    const value = item?.archive
    return value === true || value === 'true' || value === 'Oui' || value === 'oui' || value === 1 || value === '1'
  }

  const isInactiveRecord = (item) => {
    const statut = String(item?.statut ?? item?.statut_act ?? '').trim().toLowerCase()
    return statut === 'inactif'
  }

  const matchesOccurrenceDateBounds = (occ, startBound, endBound) => {
    const occStart = parseDateSafe(occ?.date_debut)
    const occEnd = parseDateSafe(occ?.date_fin || occ?.date_debut)
    if (startBound && occStart && occStart < startBound) return false
    if (endBound && occEnd && occEnd > endBound) return false
    if (startBound && !occStart) return false
    if (endBound && !occEnd) return false
    return true
  }

  const getRelevantIndicatorOccurrences = (indicator, windowStart, windowEnd, periode) => {
    const linked = (occurrences || []).filter(o => String(o.code_indicateur) === String(indicator.code_indicateur))
    return linked.filter((occ) => {
      if (isArchivedRecord(occ) || isInactiveRecord(occ)) return false
      if (periode) {
        const key = getOccurrencePeriodeKey(occ)
        if (key && key !== periode) return false
      }
      return matchesOccurrenceDateBounds(occ, windowStart, windowEnd)
    })
  }

  const isActionActive = (action) => {
    if (isArchivedRecord(action) || isInactiveRecord(action)) return false
    const statut = String(action?.statut ?? action?.statut_act ?? '').trim().toLowerCase()
    return !statut || statut === 'actif'
  }

  const isIndicatorActive = (indicator) => {
    if (isArchivedRecord(indicator) || isInactiveRecord(indicator)) return false
    const statut = String(indicator?.statut ?? '').trim().toLowerCase()
    return !statut || statut === 'actif'
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

  const getActionGroupCode = (action) => {
    return String(action?.code_groupe || action?.groupe || action?.code_projet || '').trim()
  }

  const getActionStructureCode = (action, occ) => {
    return String(occ?.code_structure || occ?.structure || action?.code_structure || '').trim()
  }

  const getActionTxForOccurrence = (occ) => {
    if (!occ) return 0
    const occId = occ?.code_occurrence || occ?.id
    const occTaches = (actions || []).filter((t) => String(t?.code_occurrence || '').trim() === String(occId || '').trim())
    if (occTaches.length === 0) return parseFloat(occ?.tx_avancement || occ?.taux_avancement || 0) || 0
    const avg = occTaches.reduce((sum, t) => sum + (parseFloat(t?.tx_avancement) || 0), 0) / occTaches.length
    return Math.round(avg * 100) / 100
  }

  const getActionOccurrenceProgress = (occ) => {
    if (!occ) return { tx: 0, niveauAvancement: 'Non entamée', jourRetard: 0, niveauRetard: 'Pas retard', isDone: false }
    const tx = getActionTxForOccurrence(occ)
    const isDone = tx >= 100
    const dateFin = parseDateSafe(occ?.date_fin)
    const dateReal = parseDateSafe(occ?.date_realisation)
    const dateConf = parseDateSafe(occ?.date_conf)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let niveauAvancement = 'Non entamée'
    if (tx === 0) niveauAvancement = 'Non entamée'
    else if (tx <= 50) niveauAvancement = 'En cours -50%'
    else if (tx < 100) niveauAvancement = 'En cours +50%'
    else if (tx >= 100 && occ?.gestionnaire_conf !== 'Oui') niveauAvancement = 'Terminée - non confirmée'
    else if (tx >= 100 && occ?.gestionnaire_conf === 'Oui') niveauAvancement = 'Achevée'

    let jourRetard = 0
    if (dateFin) {
      const fin = new Date(dateFin)
      fin.setHours(0, 0, 0, 0)
      if (isDone) {
        const ref = dateReal || dateConf || today
        const compare = new Date(ref)
        compare.setHours(0, 0, 0, 0)
        jourRetard = Math.floor((compare - fin) / 86400000)
      } else {
        jourRetard = Math.floor((today - fin) / 86400000)
      }
    }

    return {
      tx,
      niveauAvancement,
      jourRetard,
      niveauRetard: jourRetard > 0 ? 'Retard' : 'Pas retard',
      isDone
    }
  }

  const getActionFiltersWindow = () => getDateWindow(actFilters)

  // ============ CALCULS INDICATEURS ============
  const getIndicateursStats = () => {
    const startBound = parseDateSafe(indFilters.dateDebut)
    const endBound = parseDateSafe(indFilters.dateFin)

    const indicatorByCode = new Map(
      (indicateurs || []).map((indicator) => [String(indicator?.code_indicateur || '').trim(), indicator])
    )

    const normalizeSens = (value) => String(value || '').trim().toLowerCase()
    const isIndicatorOccurrenceFilled = (occurrence) => occurrence?.val_indicateur !== null && occurrence?.val_indicateur !== undefined && String(occurrence?.val_indicateur).trim() !== ''
    const getIndicatorOccurrenceTarget = (indicator, occurrence) => {
      const directTarget = parseFloat(occurrence?.cible)
      if (!Number.isNaN(directTarget)) return directTarget

      const groupCodes = getIndicatorProjectCodes(indicator)
      const isRisk = groupCodes.some((code) => String(code || '').trim().toLowerCase() === 'risque')
      if (isRisk) {
        const sens = normalizeSens(indicator?.sens)
        const riskTarget = sens === 'négatif' || sens === 'negatif'
          ? parseFloat(indicator?.seuil1)
          : parseFloat(indicator?.seuil3)
        return Number.isNaN(riskTarget) ? null : riskTarget
      }

      const indicatorTarget = parseFloat(indicator?.cible)
      return Number.isNaN(indicatorTarget) ? null : indicatorTarget
    }
    const getIndicatorOccurrenceAttPct = (indicator, occurrence) => {
      if (!isIndicatorOccurrenceFilled(occurrence)) return null
      const val = parseFloat(occurrence?.val_indicateur)
      const cible = getIndicatorOccurrenceTarget(indicator, occurrence)
      if (Number.isNaN(val) || cible === null || cible === 0) return null
      const sens = normalizeSens(indicator?.sens)
      if (sens === 'positif') return (val / cible) * 100
      if (sens === 'négatif' || sens === 'negatif') return val <= cible ? 100 : (cible / val) * 100
      return null
    }

    const occurrenceRows = (occurrences || [])
      .filter((occ) => {
        if (isArchivedRecord(occ) || isInactiveRecord(occ)) return false
        if (!matchesOccurrenceDateBounds(occ, startBound, endBound)) return false

        const codeIndicateur = getOccurrenceIndicatorCode(occ)
        const indicator = indicatorByCode.get(codeIndicateur) || null
        if (indicator && (isArchivedRecord(indicator) || isInactiveRecord(indicator))) return false
        if (!canViewDashboardIndicator(indicator, occ)) return false

        const occStructure = normalizeStructure(occ?.code_structure || indicator?.code_structure || occ?.structure || indicator?.structure)
        const projectCodes = [...new Set([
          ...getIndicatorProjectCodes(indicator),
          ...getIndicatorProjectCodes(occ)
        ])]

        if (indFilters.structure && occStructure !== normalizeStructure(indFilters.structure)) return false
        if (indFilters.type_indicateur && String(indicator?.type_indicateur || '').trim() !== String(indFilters.type_indicateur).trim()) return false
        if (indFilters.sens && String(indicator?.sens || '').trim() !== String(indFilters.sens).trim()) return false
        if (indFilters.projet && !projectCodes.includes(String(indFilters.projet).trim())) return false

        return true
      })
      .map((occ) => ({
        indicator: indicatorByCode.get(getOccurrenceIndicatorCode(occ)) || null,
        occurrence: occ
      }))

    const total = occurrenceRows.length
    const renseignesRows = occurrenceRows.filter(({ occurrence }) => isIndicatorOccurrenceFilled(occurrence))
    const renseignes = renseignesRows.length
    const atteintesRows = occurrenceRows.filter(({ indicator, occurrence }) => {
      const att = getIndicatorOccurrenceAttPct(indicator, occurrence)
      return att !== null && att >= 100
    })
    const ciblesAtteintes = atteintesRows.length
    const tauxRenseignement = total > 0 ? ((renseignes / total) * 100).toFixed(1) : '0.0'
    const tauxAtteinte = renseignes > 0 ? ((ciblesAtteintes / renseignes) * 100).toFixed(1) : '0.0'

    const byStructure = {}
    occurrenceRows.forEach(({ indicator, occurrence }) => {
      const struct = String(occurrence?.code_structure || indicator?.code_structure || '').trim() || 'N/A'
      if (!byStructure[struct]) byStructure[struct] = { total: 0, renseignes: 0, atteintes: 0 }
      byStructure[struct].total += 1
      if (isIndicatorOccurrenceFilled(occurrence)) byStructure[struct].renseignes += 1
      const att = getIndicatorOccurrenceAttPct(indicator, occurrence)
      if (att !== null && att >= 100) byStructure[struct].atteintes += 1
    })

    const renseignementParStructure = Object.entries(byStructure).map(([code, data]) => {
      const proportion = data.total > 0 ? Number(((data.renseignes / data.total) * 100).toFixed(1)) : 0
      return {
        label: code,
        value: proportion,
        widthValue: proportion,
        rawValue: data.renseignes,
        total: data.total,
        display: `${data.renseignes}/${data.total} (${proportion.toFixed(1)}%)`,
        annotation: `${data.renseignes}/${data.total} (${proportion.toFixed(1)}%)`
      }
    }).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))

    const atteinteParStructure = Object.entries(byStructure).map(([code, data]) => {
      const denominator = data.renseignes
      const proportion = denominator > 0 ? Number(((data.atteintes / denominator) * 100).toFixed(1)) : 0
      return {
        label: code,
        value: proportion,
        widthValue: proportion,
        rawValue: data.atteintes,
        total: denominator,
        display: `${data.atteintes}/${denominator} (${proportion.toFixed(1)}%)`,
        annotation: `${data.atteintes}/${denominator} (${proportion.toFixed(1)}%)`
      }
    }).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))

    return { total, renseignes, tauxRenseignement, ciblesAtteintes, tauxAtteinte, renseignementParStructure, atteinteParStructure, byStructure }
  }

  // ============ CALCULS ACTIONS ============
  const getActionsStats = () => {
    const actionsByCode = new Map(
      (planActions || []).map((action) => [String(action?.code_action || '').trim(), action])
    )

    // IMPORTANT:
    // Le sous-tableau "Tableau de bord > Actions" doit retrouver exactement la même base
    // que "Suivi des activités > Suivi actions" : on compte les occurrences visibles
    // (lignes du tableau), et non les actions uniques.
    // On applique donc la même logique de sélection de base :
    // - on exclut uniquement les occurrences archivées,
    // - on rattache chaque occurrence à son action via code_action,
    // - on conserve les occurrences dont l'action existe,
    // - puis on applique les filtres du tableau de bord.
    const relevantOccurrences = (planOccurrences || [])
      .filter((occ) => {
        if (occ?.archive) return false

        const actionCode = String(getOccurrenceActionCode(occ)).trim()
        const action = actionsByCode.get(actionCode) || null
        if (!action || action?.archive) return false
        if (!canViewDashboardAction(action, occ)) return false

        if (actFilters.structure && normalizeStructure(action?.code_structure || action?.structure) !== normalizeStructure(actFilters.structure)) return false
        if (actFilters.groupe && String(getActionGroupCode(action) || '').trim() !== String(actFilters.groupe).trim()) return false
        if (actFilters.dateDebut && occ?.date_debut && occ.date_debut < actFilters.dateDebut) return false
        if (actFilters.dateFin && occ?.date_fin && occ.date_fin > actFilters.dateFin) return false
        if (actFilters.dateDebut && !occ?.date_debut) return false
        if (actFilters.dateFin && !occ?.date_fin) return false

        return true
      })
      .map((occ) => {
        const action = actionsByCode.get(String(getOccurrenceActionCode(occ)).trim()) || null
        const progress = getActionOccurrenceProgress(occ)
        return { ...occ, __action: action, __progress: progress }
      })

    const total = relevantOccurrences.length
    const realiseesRows = relevantOccurrences.filter((occ) => occ.__progress?.isDone)
    const realisees = realiseesRows.length
    const nonRealisees = Math.max(0, total - realisees)
    const tauxRealisation = total > 0 ? ((realisees / total) * 100).toFixed(1) : '0.0'

    const realiseesDelai = realiseesRows.filter((occ) => (occ.__progress?.jourRetard || 0) <= 0).length
    const tauxRealisationDelai = realisees > 0 ? ((realiseesDelai / realisees) * 100).toFixed(1) : '0.0'

    const lateOccurrences = relevantOccurrences.filter((occ) => !occ.__progress?.isDone && (occ.__progress?.jourRetard || 0) > 0)
    const enRetard = lateOccurrences.length

    const retards = lateOccurrences
      .map((occ) => occ.__progress?.jourRetard || 0)
      .filter((value) => value > 0)
    const retardMoyen = retards.length > 0 ? (retards.reduce((a, b) => a + b, 0) / retards.length).toFixed(1) : '0.0'

    const expectedLevels = ['Achevée', 'Terminée - non confirmée', 'En cours +50%', 'En cours -50%', 'Non entamée']
    const byAvancement = Object.fromEntries(expectedLevels.map((label) => [label, 0]))
    relevantOccurrences.forEach((occ) => {
      const key = expectedLevels.includes(occ.__progress?.niveauAvancement) ? occ.__progress?.niveauAvancement : 'Non entamée'
      byAvancement[key] = (byAvancement[key] || 0) + 1
    })

    const parAvancement = expectedLevels.map((label, idx) => {
      const count = byAvancement[label] || 0
      const proportion = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
      return {
        label,
        value: proportion,
        widthValue: proportion,
        rawValue: count,
        total,
        display: `${count}/${total} (${proportion.toFixed(1)}%)`,
        annotation: `${count}/${total} (${proportion.toFixed(1)}%)`,
        color: idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-green-400' : idx === 2 ? 'bg-amber-500' : idx === 3 ? 'bg-orange-500' : 'bg-red-600'
      }
    })

    const actionTotalsByStructure = {}
    relevantOccurrences.forEach((occ) => {
      const action = occ.__action || {}
      const struct = getActionStructureCode(action, occ) || 'N/A'
      if (!actionTotalsByStructure[struct]) actionTotalsByStructure[struct] = { total: 0, retard: 0 }
      actionTotalsByStructure[struct].total += 1
      if (!occ.__progress?.isDone && (occ.__progress?.jourRetard || 0) > 0) actionTotalsByStructure[struct].retard += 1
    })

    const allRetardStructures = Object.entries(actionTotalsByStructure)
      .filter(([, data]) => data.retard > 0)
      .map(([code, data]) => {
        const proportion = data.total > 0 ? Number(((data.retard / data.total) * 100).toFixed(1)) : 0
        return {
          code,
          value: proportion,
          rawValue: data.retard,
          total: data.total,
          widthValue: proportion,
          annotation: `${data.retard}/${data.total} (${proportion.toFixed(1)}%)`,
          libelle: structures.find((s) => s.code_structure === code)?.libelle_structure || ''
        }
      })
      .sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))

    const topRetardStructures = allRetardStructures
      .slice(0, 4)
      .map((item) => ({
        label: item.code,
        value: item.value,
        rawValue: item.rawValue,
        total: item.total,
        widthValue: item.widthValue,
        display: `${item.rawValue}/${item.total} (${item.value.toFixed(1)}%)`,
        annotation: `${item.rawValue}/${item.total} (${item.value.toFixed(1)}%)`,
        color: 'bg-red-500'
      }))

    return { total, realisees, nonRealisees, tauxRealisation, realiseesDelai, tauxRealisationDelai, enRetard, retardMoyen, parAvancement, topRetardStructures, allRetardStructures }
  }

  // ============ OUTILS RISQUES (Synthèse) ==========
  const getPeriodeKeyRisques = () => {
    if (!riskPeriodFilters.annee) return null
    const annee = String(riskPeriodFilters.annee)

    if (riskPeriodFilters.mois) return `${riskPeriodFilters.mois}-${annee}`
    if (riskPeriodFilters.trimestre) {
      const num = String(riskPeriodFilters.trimestre).match(/(\d+)/)?.[1]
      return num ? `T${num}-${annee}` : null
    }
    if (riskPeriodFilters.semestre) {
      const num = String(riskPeriodFilters.semestre).match(/(\d+)/)?.[1]
      return num ? `S${num}-${annee}` : null
    }
    // Année seule
    return annee
  }

  // Fonction pour obtenir la date de début d'une période
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

  // Fonction pour trouver la période sélectionnée à partir des filtres
  const findSelectedPeriodeFromForm = (form) => {
    if (!form.annee) return null
    const annee = parseInt(form.annee, 10)
    
    // Rechercher la période correspondante dans allPeriodes
    return allPeriodes.find(p => {
      if (p.annee !== annee) return false
      
      if (form.mois) {
        const moisNum = typeof form.mois === 'string' && isNaN(parseInt(form.mois)) 
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
      
      // Année seule
      return !p.semestre && !p.trimestre && !p.mois
    })
  }

  // Déterminer la dernière période de comparaison (avant la période filtre)
  // selon le type de périodicité choisi dans "Gestion"
  const getPreviousPeriodeForAttenuation = () => {
    const selected = findSelectedPeriodeFromForm(riskPeriodFilters)
    if (!selected) return null
    
    const selectedStart = getPeriodeDateDebut(selected)
    const type = attenuationAppreciationType || 'Année'
    
    // Déterminer quelle période chercher selon le type de périodicité
    // Exemple: si périodicité = "Année" et période filtre = "S1-2025"
    // alors on cherche l'année "2024" (pas le "S1-2024")
    const matchesType = (p) => {
      if (type === 'Mois') return !!p?.mois && !p?.trimestre && !p?.semestre
      if (type === 'Trimestre') return !!p?.trimestre && !p?.semestre && !p?.mois
      if (type === 'Semestre') return !!p?.semestre && !p?.trimestre && !p?.mois
      // Année : doit être une période annuelle (pas de semestre/trimestre/mois)
      return !!p?.annee && !p?.semestre && !p?.trimestre && !p?.mois
    }
    
    const candidates = (allPeriodes || [])
      .filter(p => matchesType(p) && getPeriodeDateDebut(p) < selectedStart)
      .sort((a, b) => getPeriodeDateDebut(b) - getPeriodeDateDebut(a))
    
    return candidates[0] || null
  }

  // Convertir niveau de criticité (score 1-16) en numéro de niveau (1-4)
  const getNiveauCriticiteNum = (score) => {
    if (!score || score < 1) return null
    if (score <= 3) return 1
    if (score <= 7) return 2
    if (score <= 11) return 3
    return 4
  }

  // Calculer le taux d'atténuation entre deux niveaux
  const calculateTauxAttenuation = (criticiteComparaison, criticiteActuelle) => {
    if (!criticiteComparaison || !criticiteActuelle) return null
    
    const tauxTable = {
      '1-1': 100, '1-2': -50, '1-3': -75, '1-4': -100,
      '2-1': 100, '2-2': 0, '2-3': -50, '2-4': -100,
      '3-1': 100, '3-2': 50, '3-3': 0, '3-4': -100,
      '4-1': 100, '4-2': 75, '4-3': 50, '4-4': -100
    }
    
    const key = `${criticiteComparaison}-${criticiteActuelle}`
    const taux = tauxTable[key]
    return taux !== undefined ? taux : null
  }

  // ============ CALCULS RISQUES ============
  const calculateProbabilite = (valIndicateur, seuils, sens) => {
    if (valIndicateur === null || valIndicateur === undefined || valIndicateur === '') return ''
    if (!seuils?.seuil1) return ''

    const val = parseFloat(valIndicateur)
    const s1 = parseFloat(seuils.seuil1)
    const s2 = parseFloat(seuils.seuil2)
    const s3 = parseFloat(seuils.seuil3)
    if ([val, s1, s2, s3].some(n => Number.isNaN(n))) return ''

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
      const rp = risquesProbabilites.find(p => p.code_risque === risque.code_risque && p.periode === periodeKey)
      storedProba = rp?.probabilite ?? null
    } else {
      indicOcc = occurrences.find(o => o.code_indicateur === risque.code_indicateur && o.periode === periodeKey)
      const rp = risquesProbabilites.find(p => p.code_risque === risque.code_risque && p.periode === periodeKey)
      // La probabilité n'est plus stockée sur indicateur_occurrences (colonne supprimée)
      storedProba = rp?.probabilite || null
    }

    const valInd = isQualitatif ? null : indicOcc?.val_indicateur
    const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''
    const seuils = {
      seuil1: risque.indicateur?.seuil1 || risque.indicateur?.seuil_1,
      seuil2: risque.indicateur?.seuil2 || risque.indicateur?.seuil_2,
      seuil3: risque.indicateur?.seuil3 || risque.indicateur?.seuil_3
    }
    const calculatedProba = (!isQualitatif && hasValInd) ? calculateProbabilite(valInd, seuils, risque.indicateur?.sens) : ''
    const probDisplay = calculatedProba || storedProba || ''
    const hasProb = probDisplay !== '' && probDisplay !== null && probDisplay !== undefined
    return { probDisplay, hasProb }
  }

  // Impact net (cohérent Cartographie): appliquer l'efficacité des contrôles
  const calculateAttenuation = (efficacite_contr) => {
    if (efficacite_contr === 1) return -3
    if (efficacite_contr === 2) return -2
    if (efficacite_contr === 3) return -1
    return 0
  }
  const calculateImpactNet = (impactBrut, efficacite_contr) => {
    const attenuation = calculateAttenuation(efficacite_contr)
    return Math.max(1, (impactBrut || 1) + attenuation)
  }

  // ============ CALCULS RISQUES ============
  const getRisquesStats = () => {
    console.log('[DEBUG] getRisquesStats appelée')
    
    let filtered = risques
      .filter((r) => r.statut === 'Actif')
      .filter((r) => canViewDashboardRisk(r))
    
    // Filtres globaux (identiques à la Synthèse de Gestion des risques)
    if (riskGlobalFilters.structure) filtered = filtered.filter(r => r.code_structure === riskGlobalFilters.structure)
    if (riskGlobalFilters.processus) filtered = filtered.filter(r => r.code_processus === riskGlobalFilters.processus)
    if (riskGlobalFilters.categorie) {
      const catId = parseInt(riskGlobalFilters.categorie, 10)
      filtered = filtered.filter(r => Array.isArray(r.categories) && r.categories.includes(catId))
    }

    // Si aucune période sélectionnée : chiffres '-' et graphiques vides
    const periodeKey = getPeriodeKeyRisques()
    if (!periodeKey) {
      return {
        totalActifs: '-',
        evalues: '-',
        nonEvalues: '-',
        tauxSuivi: '-',
        tauxAttenuation: 'N/A',
        totalEvalues: 0,
        parCriticite: [],
        topProcessusCritiques: [],
        critiqueParProcessus: {}
      }
    }

    const totalActifs = filtered.length

    // Fonction utilitaire pour extraire la valeur numérique
    const extractNumber = (val) => {
      if (val === null || val === undefined) return NaN
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const match = val.match(/^(\d+)/)
        if (match) return parseInt(match[1])
        return parseInt(val)
      }
      return NaN
    }

    // Criticité (identique Synthèse) : score 1-16 = Impact(Brut|Net) × Prob(1-4)
    const getCriticiteScore = (r) => {
      const impactBrut = extractNumber(r.impact)
      const eff = extractNumber(r.efficacite_contr)
      const impactNet = calculateImpactNet(impactBrut, eff)
      const probData = getRisqueProbabilite(r, periodeKey)
      const prob = parseInt(probData.probDisplay || '', 10)
      if (Number.isNaN(impactBrut) || Number.isNaN(impactNet) || Number.isNaN(prob)) return NaN
      const useBrute = (riskTypeCriticite || 'Nette') === 'Brute'
      const impact = useBrute ? impactBrut : impactNet
      return impact * prob
    }

    // Un risque est évalué s'il a une criticité calculable (probabilité existante + impact renseigné)
    const evaluesList = filtered.filter(r => !Number.isNaN(getCriticiteScore(r)))
    const totalEvalues = evaluesList.length
    const nonEvalues = totalActifs - totalEvalues
    const tauxSuivi = totalActifs > 0 ? Math.round((totalEvalues / totalActifs) * 100) : 0

    // Répartition par criticité (identique Synthèse)
    // 1-3: Faible, 4-6: Modéré, 8-9: Significatif, 12-16: Critique
    let faible = 0
    let modere = 0
    let significatif = 0
    let critique = 0

    evaluesList.forEach(r => {
      const score = getCriticiteScore(r)
      if (Number.isNaN(score)) return
      if (score >= 1 && score <= 3) faible += 1
      else if (score >= 4 && score <= 6) modere += 1
      else if (score >= 8 && score <= 9) significatif += 1
      else if (score >= 12 && score <= 16) critique += 1
    })

    // Taux de maîtrise = % de risques (niveau 1) parmi les évalués
    const tauxMaitrise = totalEvalues > 0 ? Math.round((faible / totalEvalues) * 100) : 0

    const totalEvaluesForBars = totalEvalues
    const pctInt = (n) => (totalEvaluesForBars > 0 ? Math.round((n / totalEvaluesForBars) * 100) : 0)
    // Données (conservées) pour compatibilité éventuelle, mais la vue utilise le rendu identique à la Synthèse
    const parCriticite = [
      { label: '1-3 (Faible)', value: faible, display: `${faible} (${pctInt(faible)}%)` },
      { label: '4-6 (Modéré)', value: modere, display: `${modere} (${pctInt(modere)}%)` },
      { label: '8-9 (Significatif)', value: significatif, display: `${significatif} (${pctInt(significatif)}%)` },
      { label: '12-16 (Critique)', value: critique, display: `${critique} (${pctInt(critique)}%)` }
    ]

    // Top 4 - taux de risques critiques (8-16) par processus (tri par %)
    const critiqueParProcessus = {}
    evaluesList.forEach(r => {
      const proc = r.code_processus || 'N/A'
      if (!critiqueParProcessus[proc]) critiqueParProcessus[proc] = { critique: 0, total: 0 }
      critiqueParProcessus[proc].total++
      const score = getCriticiteScore(r)
      if (!Number.isNaN(score) && score >= 8 && score <= 16) critiqueParProcessus[proc].critique++
    })

    const toProcessItem = ([code, data]) => {
      const percent = data.total > 0 ? (data.critique / data.total) * 100 : 0
      return {
        label: code,
        value: Number(percent.toFixed(1)), // pour largeur + tri
        display: `${data.critique}/${data.total} (${percent.toFixed(1)}%)`,
        color: '#EF4444',
        _raw: data
      }
    }
    const topProcessusCritiques = Object.entries(critiqueParProcessus)
      .map(toProcessItem)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)

    // Liste complète pour l'affichage plein écran (identique à "Synthèse" : code + libellé + barres proportionnelles)
    const allProcessus = Object.entries(critiqueParProcessus)
      .map(([code, data]) => {
        const libelle = (processus || []).find(p => p.code_processus === code)?.libelle_processus || code
        return { code, libelle, critiques: data.critique, total: data.total }
      })
      .sort((a, b) => {
        const pa = a.total > 0 ? a.critiques / a.total : 0
        const pb = b.total > 0 ? b.critiques / b.total : 0
        return pb - pa
      })

    // Calcul du taux d'atténuation moyen
    const computeTauxAttenuationMoyen = () => {
      // Si aucune période sélectionnée ou aucun risque évalué => N/A
      if (!periodeKey || totalEvalues === 0) {
        console.log('[Atténuation] N/A - Pas de période ou pas de risques évalués', { periodeKey, totalEvalues })
        return 'N/A'
      }

      const prevPeriode = getPreviousPeriodeForAttenuation()
      if (!prevPeriode) {
        console.log('[Atténuation] N/A - Pas de période de comparaison trouvée', { 
          attenuationAppreciationType, 
          riskPeriodFilters,
          allPeriodesCount: allPeriodes.length 
        })
        return 'N/A'
      }

      // Construire la clé de la période de comparaison
      const prevKey = (() => {
        if (!prevPeriode?.annee) return ''
        if (prevPeriode.mois) {
          const moisNum = typeof prevPeriode.mois === 'number' ? prevPeriode.mois : parseInt(prevPeriode.mois, 10)
          return `${moisList[moisNum - 1]}-${prevPeriode.annee}`
        }
        if (prevPeriode.trimestre) return `T${prevPeriode.trimestre}-${prevPeriode.annee}`
        if (prevPeriode.semestre) return `S${prevPeriode.semestre}-${prevPeriode.annee}`
        return `${prevPeriode.annee}`
      })()
      
      if (!prevKey) {
        console.log('[Atténuation] N/A - Clé de période vide', { prevPeriode })
        return 'N/A'
      }

      console.log('[Atténuation] Calcul en cours', {
        periodeActuelle: periodeKey,
        periodeComparaison: prevKey,
        prevPeriode,
        risquesFiltered: filtered.length,
        attenuationType: attenuationAppreciationType,
        risquesProbabilitesCount: risquesProbabilites.length,
        occurrencesCount: occurrences.length,
        // Exemples de clés de période dans les données
        exemplesPeriodesRisquesProba: risquesProbabilites.slice(0, 5).map(rp => ({ 
          code_risque: rp.code_risque, 
          periode: rp.periode, 
          probabilite: rp.probabilite 
        })),
        exemplesPeriodesOccurrences: occurrences.slice(0, 5).map(o => ({ 
          code_indicateur: o.code_indicateur, 
          periode: o.periode, 
          val_indicateur: o.val_indicateur 
        }))
      })

      let prevEvaluatedCount = 0
      const tauxValues = []

      console.log('[Atténuation] Début boucle sur risques', {
        nombreRisques: filtered.length,
        periodeActuelleKey: periodeKey,
        periodeComparaisonKey: prevKey
      })

      filtered.forEach((r, index) => {
        const impactBrut = extractNumber(r.impact)
        const eff = extractNumber(r.efficacite_contr)
        const impactNet = calculateImpactNet(impactBrut, eff)
        
        if (Number.isNaN(impactNet)) {
          if (index < 3) console.log(`[Atténuation] Risque ${r.code_risque} ignoré : impact net NaN`)
          return
        }

        // Probabilités pour les deux périodes
        const probPrevData = getRisqueProbabilite(r, prevKey)
        const probCurData = getRisqueProbabilite(r, periodeKey)

        if (index < 3) {
          console.log(`[Atténuation] Risque ${r.code_risque}:`, {
            probPrev: probPrevData,
            probCur: probCurData,
            isQualitatif: r.qualitatif,
            code_indicateur: r.code_indicateur
          })
        }

        // Compter les risques évalués en période de comparaison
        if (probPrevData.hasProb) prevEvaluatedCount += 1

        // Les deux périodes doivent avoir une probabilité pour calculer l'atténuation
        if (!probPrevData.hasProb || !probCurData.hasProb) {
          if (index < 3) console.log(`[Atténuation] Risque ${r.code_risque} ignoré : manque probabilité`)
          return
        }
        
        const probPrev = parseInt(probPrevData.probDisplay, 10)
        const probCur = parseInt(probCurData.probDisplay, 10)

        if (Number.isNaN(probPrev) || Number.isNaN(probCur)) {
          if (index < 3) console.log(`[Atténuation] Risque ${r.code_risque} ignoré : probabilité NaN`)
          return
        }

        // Calculer les criticités
        const critPrev = impactNet * probPrev
        const critCur = impactNet * probCur
        const nivPrev = getNiveauCriticiteNum(critPrev)
        const nivCur = getNiveauCriticiteNum(critCur)

        if (!nivPrev || !nivCur) {
          if (index < 3) console.log(`[Atténuation] Risque ${r.code_risque} ignoré : niveau null`)
          return
        }

        const taux = calculateTauxAttenuation(nivPrev, nivCur)
        if (taux === null || taux === undefined) {
          if (index < 3) console.log(`[Atténuation] Risque ${r.code_risque} ignoré : taux null`)
          return
        }
        
        if (index < 3) {
          console.log(`[Atténuation] Risque ${r.code_risque} OK:`, {
            impactNet,
            probPrev,
            probCur,
            critPrev,
            critCur,
            nivPrev,
            nivCur,
            taux
          })
        }
        
        tauxValues.push(taux)
      })

      console.log('[Atténuation] Résultats', {
        prevEvaluatedCount,
        tauxValuesCount: tauxValues.length,
        tauxValues
      })

      // Si aucun risque évalué en période de comparaison => N/A
      if (prevEvaluatedCount === 0) {
        console.log('[Atténuation] N/A - Aucun risque évalué en période de comparaison')
        return 'N/A'
      }
      if (tauxValues.length === 0) {
        console.log('[Atténuation] N/A - Aucun taux calculable')
        return 'N/A'
      }

      const avg = Math.round(tauxValues.reduce((a, b) => a + b, 0) / tauxValues.length)
      console.log('[Atténuation] Moyenne calculée', avg)
      return `${avg}%`
    }

    const tauxAttenuation = computeTauxAttenuationMoyen()

    return {
      totalActifs,
      evalues: totalEvalues,
      nonEvalues,
      tauxSuivi,
      tauxMaitrise,
      tauxAttenuation,
      totalEvalues,
      totalEvaluesForBars,
      faible,
      modere,
      significatif,
      critique,
      parCriticite,
      topProcessusCritiques,
      critiqueParProcessus,
      allProcessus
    }
  }

  // ============ CALCULS PLAN MAITRISE ============
  
  // ============ CALCULS PLAN MAITRISE ============
  
  // ============ CALCULS PLAN MAITRISE ============
  

  useEffect(() => {
    const fetchRiskPlanRows = async () => {
      try {
        const res = await fetch(`/api/actions/risques-suivi?t=${Date.now()}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setRiskPlanRows(data.rows || [])
        } else {
          setRiskPlanRows([])
        }
      } catch (error) {
        console.error('Erreur chargement suivi plan risques:', error)
        setRiskPlanRows([])
      }
    }
    fetchRiskPlanRows()
  }, [])

  const getPlanStats = () => {
    return computePlanRiskStats({
      rows: riskPlanRows,
      structures,
      filters: riskPlanFilters,
    })
  }

  const renderRisques = () => {
    const riskStats = getRisquesStats()
    const planStats = getPlanStats()
    const hasPeriodeRisques = riskStats.totalActifs !== '-' && riskStats.totalActifs !== undefined
    const totalEvaluesForBars = riskStats.totalEvaluesForBars || 0
    // Graph 1 : proportion par rapport au total évalué
    const maxCriticite = Math.max(riskStats.totalEvalues || 0, 1)
    // Graph 2 : taux en %, borné à 100
    const maxProcessus = 100
    const maxAvancement = Math.max(...planStats.parAvancement.map(d => d.value), 1)
    // Pour le graphique "structures avec retard", l'échelle doit être basée sur le nombre d'actions en retard.
    // (planStats.retardParStructure n'existe pas : on se base sur les valeurs calculées)
    const maxRetard = Math.max(...(planStats.allRetardStructures || []).map(d => d.value || 0), 1)

    return (
      <div className="space-y-4">
        {/* Filtres globaux (identiques à la Synthèse de Gestion des risques) */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Catégorie"
                size="sm"
                value={riskGlobalFilters.categorie || ''}
                onChange={(v) => setRiskGlobalFilters({ ...riskGlobalFilters, categorie: v })}
                options={[{ value: '', label: 'Toutes' }, ...categories.filter(c => c.statut === 'Actif').map(c => ({ value: c.code_categorie?.toString() || c.id?.toString(), label: c.libelle_categorie }))]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Structure"
                size="sm"
                value={riskGlobalFilters.structure || ''}
                onChange={(v) => setRiskGlobalFilters({ ...riskGlobalFilters, structure: v })}
                options={[{ value: '', label: 'Toutes' }, ...structures.map(s => ({ value: s.code_structure, label: s.libelle_structure }))]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Processus"
                size="sm"
                value={riskGlobalFilters.processus || ''}
                onChange={(v) => setRiskGlobalFilters({ ...riskGlobalFilters, processus: v })}
                options={[{ value: '', label: 'Tous' }, ...processus.filter(p => p.statut === 'Actif').map(p => ({ value: p.code_processus, label: p.libelle_processus }))]}
                placeholder="Tous"
              />
            </div>
            <button
              onClick={() => setRiskGlobalFilters({ categorie: '', structure: '', processus: '' })}
              className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0"
              title="Réinitialiser"
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <p className="text-[9px] text-gray-400 mt-2 italic">Ces filtres s'appliquent sur l'ensemble des statistiques des deux blocs</p>
        </div>

        {/* BLOC 1: Statistiques caractéristiques risques (identique à Synthèse > Gestion des risques) */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="text-blue-600" size={20} />
            Statistiques sur les caractéristiques des risques
          </h3>

          {/* Filtres période - identiques */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <div className="flex items-end gap-2">
              <div className="w-[90px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Année</label>
                <select value={riskPeriodFilters.annee} onChange={(e) => setRiskPeriodFilters({ annee: e.target.value, semestre: '', trimestre: '', mois: '' })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                  <option value="">--</option>
                  {allPeriodes.map(p => p.annee).filter((v, i, a) => a.indexOf(v) === i).sort().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Semestre</label>
                <select value={riskPeriodFilters.semestre} onChange={(e) => setRiskPeriodFilters({ ...riskPeriodFilters, semestre: e.target.value, trimestre: '', mois: '' })} disabled={!riskPeriodFilters.annee} className={`w-full px-2 py-1 rounded border text-xs ${!riskPeriodFilters.annee ? 'bg-gray-100 text-gray-400' : 'border-gray-200'}`}>
                  <option value="">--</option>
                  {allPeriodes.filter(p => p.annee?.toString() === riskPeriodFilters.annee && p.semestre).map(p => p.semestre).filter((v, i, a) => a.indexOf(v) === i).sort().map(s => <option key={s} value={`Semestre ${s}`}>Semestre {s}</option>)}
                </select>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Trimestre</label>
                <select value={riskPeriodFilters.trimestre} onChange={(e) => setRiskPeriodFilters({ ...riskPeriodFilters, trimestre: e.target.value, semestre: '', mois: '' })} disabled={!riskPeriodFilters.annee} className={`w-full px-2 py-1 rounded border text-xs ${!riskPeriodFilters.annee ? 'bg-gray-100 text-gray-400' : 'border-gray-200'}`}>
                  <option value="">--</option>
                  {allPeriodes.filter(p => p.annee?.toString() === riskPeriodFilters.annee && p.trimestre).map(p => p.trimestre).filter((v, i, a) => a.indexOf(v) === i).sort().map(t => <option key={t} value={`Trimestre ${t}`}>Trimestre {t}</option>)}
                </select>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Mois</label>
                <select value={riskPeriodFilters.mois} onChange={(e) => setRiskPeriodFilters({ ...riskPeriodFilters, mois: e.target.value, semestre: '', trimestre: '' })} disabled={!riskPeriodFilters.annee} className={`w-full px-2 py-1 rounded border text-xs ${!riskPeriodFilters.annee ? 'bg-gray-100 text-gray-400' : 'border-gray-200'}`}>
                  <option value="">--</option>
                  {allPeriodes.filter(p => p.annee?.toString() === riskPeriodFilters.annee && p.mois).map(p => moisList[p.mois - 1]).filter((v, i, a) => a.indexOf(v) === i).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="w-[90px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Type crit.</label>
                <select value={riskTypeCriticite} onChange={(e) => setRiskTypeCriticite(e.target.value)} className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-purple-50">
                  <option value="Brute">Brute</option>
                  <option value="Nette">Nette</option>
                </select>
              </div>
              <button
                onClick={() => {
                  // Réinitialisation identique à "Gestion des risques > Synthèse" :
                  // la période ouverte doit être automatiquement sélectionnée.
                  setRiskPeriodFilters(normalizePeriodeToRiskFilters(periodeOuverte))
                  setRiskTypeCriticite('Nette')
                }}
                className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0"
                title="Réinitialiser"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* KPIs risques - identiques (même style que Synthèse) */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><Target className="text-blue-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-blue-700">{riskStats.totalActifs}</p>
                  <p className="text-[10px] text-blue-600">Risques actifs</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-green-700">{riskStats.evalues}</p>
                  <p className="text-[10px] text-green-600">Risques évalués</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg"><AlertTriangle className="text-orange-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-orange-700">{riskStats.nonEvalues}</p>
                  <p className="text-[10px] text-orange-600">Non évalués</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg"><BarChart3 className="text-purple-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-purple-700">{hasPeriodeRisques ? `${riskStats.tauxSuivi}%` : '-'}</p>
                  <p className="text-[10px] text-purple-600">Taux de suivi</p>
                </div>
              </div>
            </div>
            <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-100 rounded-lg"><Shield className="text-teal-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-teal-700">{!hasPeriodeRisques ? '-' : ((riskStats?.evalues || 0) === 0 ? 'N/A' : `${riskStats.tauxMaitrise}%`)}</p>
                  <p className="text-[10px] text-teal-600">Taux de maîtrise</p>
                </div>
              </div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg"><TrendingDown className="text-emerald-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-emerald-700">{riskStats.tauxAttenuation || 'N/A'}</p>
                  <p className="text-[10px] text-emerald-600">Atténuation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Graphiques risques - identiques */}
          <div className="grid grid-cols-2 gap-4">
            {/* Répartition par criticité */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-4">Répartition des risques évalués selon la criticité</h4>
              {!hasPeriodeRisques ? (
                <p className="text-gray-500 text-center py-6 text-sm">Sélectionnez une période pour afficher les statistiques.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: '1-3 (Faible)', value: riskStats.faible || 0, color: 'bg-green-500', hoverColor: 'hover:bg-green-600' },
                    { label: '4-6 (Modéré)', value: riskStats.modere || 0, color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600' },
                    { label: '8-9 (Significatif)', value: riskStats.significatif || 0, color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600' },
                    { label: '12-16 (Critique)', value: riskStats.critique || 0, color: 'bg-red-500', hoverColor: 'hover:bg-red-600' }
                  ].map((item, idx) => {
                    const pct = totalEvaluesForBars > 0 ? Math.round((item.value / totalEvaluesForBars) * 100) : 0
                    const width = totalEvaluesForBars > 0 ? (item.value / totalEvaluesForBars) * 100 : 0
                    return (
                      <div key={idx} className="group">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="text-gray-600 font-semibold">{item.value} ({pct}%)</span>
                        </div>
                        <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                          <div className={`h-full ${item.color} ${item.hoverColor} transition-all duration-300 rounded-full`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top processus critiques */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700">Taux de risques critiques (8–16) par processus</h4>
                <button
                  onClick={() => setShowProcessusCritiquesModal(true)}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Voir tous"
                >
                  <Layers size={12} className="text-gray-500" />
                </button>
              </div>
              {!hasPeriodeRisques ? (
                <p className="text-gray-500 text-center py-6 text-sm">Sélectionnez une période pour afficher les statistiques.</p>
              ) : (
                <div className="space-y-3">
                  {riskStats.topProcessusCritiques.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">Aucun processus avec risques critiques</p>}
                  {riskStats.topProcessusCritiques.map((p, idx) => {
                    // p.value = % (0-100) ; display = "x/y (z%)"
                    const width = Math.max(0, Math.min(p.value, 100))
                    return (
                      <div key={idx} className="group">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 truncate max-w-[200px]" title={p.label}>{p.label}</span>
                          <span className="text-gray-600 font-semibold">{p.display}</span>
                        </div>
                        <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                          <div className="h-full bg-red-500 hover:bg-red-600 transition-all duration-300 rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOC 2: Statistiques suivi plan maîtrise (rendu identique à "Gestion des risques > Synthèse") */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="text-green-600" size={20} />
            Statistiques de suivi du plan de maîtrise des risques
          </h3>

          {/* Filtres période (exactement comme Synthèse) */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <div className="flex items-end gap-2">
              <div className="w-[130px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Date début ≥</label>
                <input
                  type="date"
                  value={riskPlanFilters.dateDebut}
                  onChange={e => setRiskPlanFilters({ ...riskPlanFilters, dateDebut: e.target.value })}
                  className="w-full px-2 py-1 rounded border border-gray-200 text-xs"
                />
              </div>
              <div className="w-[130px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Date fin ≤</label>
                <input
                  type="date"
                  value={riskPlanFilters.dateFin}
                  onChange={e => setRiskPlanFilters({ ...riskPlanFilters, dateFin: e.target.value })}
                  className="w-full px-2 py-1 rounded border border-gray-200 text-xs"
                />
              </div>
              <button
                onClick={() => setRiskPlanFilters({ dateDebut: '', dateFin: '' })}
                className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0"
                title="Réinitialiser"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* KPIs (exactement comme Synthèse) */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                {/* Aligné avec "Gestion des risques > Synthèse" */}
                <div className="p-1.5 bg-blue-100 rounded-lg"><List className="text-blue-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-blue-700">{planStats.total}</p>
                  <p className="text-[10px] text-blue-600">Actions</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-green-700">{planStats.realisees}</p>
                  <p className="text-[10px] text-green-600">Réalisées</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg"><AlertTriangle className="text-orange-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-orange-700">{planStats.nonRealisees}</p>
                  <p className="text-[10px] text-orange-600">Non réalisées</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg"><BarChart3 className="text-purple-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-purple-700">{planStats.tauxRealisation}%</p>
                  <p className="text-[10px] text-purple-600">Taux réalis.</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-lg"><AlertTriangle className="text-red-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-red-700">{planStats.enRetard}</p>
                  <p className="text-[10px] text-red-600">En retard</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-yellow-100 rounded-lg"><BarChart3 className="text-yellow-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-yellow-700">{planStats.retardMoyen}j</p>
                  <p className="text-[10px] text-yellow-600">Retard moy.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Graphiques (exactement comme Synthèse) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Répartition par niveau de réalisation */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-4">Répartition actions par niveau de réalisation</h4>
              <div className="space-y-3">
                {[
                  { label: 'Achevée', value: (planStats.parAvancement || []).find(x => x.label === 'Achevée')?.value || 0, color: 'bg-green-600' },
                  { label: 'Terminée - non confirmée', value: (planStats.parAvancement || []).find(x => x.label === 'Terminée - non confirmée')?.value || 0, color: 'bg-green-400' },
                  { label: 'En cours +50%', value: (planStats.parAvancement || []).find(x => x.label === 'En cours +50%')?.value || 0, color: 'bg-yellow-500' },
                  { label: 'En cours -50%', value: (planStats.parAvancement || []).find(x => x.label === 'En cours -50%')?.value || 0, color: 'bg-orange-500' },
                  { label: 'Non entamée', value: (planStats.parAvancement || []).find(x => x.label === 'Non entamée')?.value || 0, color: 'bg-red-600' }
                ].map((item, idx) => (
                  <div key={idx} className="group">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{item.label}</span>
                    </div>
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                      {(() => {
                        const totalActions = planStats.total || 0
                        const pct = totalActions > 0 ? Math.round((item.value / totalActions) * 100) : 0
                        const width = totalActions > 0 ? (item.value / totalActions) * 100 : 0
                        return (
                          <>
                            <div className={`h-full ${item.color} hover:opacity-80 transition-all duration-300 rounded-full`} style={{ width: `${width}%` }} />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[10px] font-bold">{item.value} ({pct}%)</span>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 05 structures en retard */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700">Top 05 des structures avec un retard</h4>
                <button onClick={() => setShowStructuresRetardModal(true)} className="p-1 hover:bg-gray-200 rounded" title="Voir toutes">
                  <Layers size={12} className="text-gray-500" />
                </button>
              </div>
              <div className="space-y-3">
                {(planStats.topRetardStructures || []).length === 0 && <p className="text-gray-500 text-center py-4 text-sm">Aucune structure en retard</p>}
                {(planStats.topRetardStructures || []).map((s, idx) => (
                  <div key={idx} className="group">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 truncate max-w-[240px]" title={s.code}>{s.code}</span>
                    </div>
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                      {(() => {
                        // Une barre entière = 100% des actions en retard (toutes structures confondues)
                        const totalRetards = (planStats.allRetardStructures || []).reduce((sum, x) => sum + (x.value || 0), 0)
                        const v = s.value || 0
                        const pct = totalRetards > 0 ? Math.round((v / totalRetards) * 100) : 0
                        const width = totalRetards > 0 ? (v / totalRetards) * 100 : 0
                        return (
                          <>
                            <div
                              className="h-full bg-red-500 hover:bg-red-600 transition-all duration-300 rounded-full"
                              style={{ width: `${Math.max(width, v > 0 ? 6 : 0)}%` }}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[10px] font-bold">
                              {v} action(s){totalRetards > 0 ? ` (${pct}%)` : ''}
                            </span>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderIndicateurs = () => {
    const stats = getIndicateursStats()
    const structuresOptions = (isPrivilegedUser(currentUser) ? structures : structures.filter(s => restrictStructureCode(s.code_structure) === restrictStructureCode(currentUser?.structure))).map(s => ({ value: s.code_structure, label: `${s.code_structure} - ${s.libelle_structure}` }))
    const projetsOptions = [...new Map(
      groupes
        .filter(g => String(g?.statut || '').trim().toLowerCase() === 'actif' && String(g?.libelle_groupe || '').trim())
        .map(g => {
          const label = String(g.libelle_groupe || '').trim()
          return [label.toLowerCase(), { value: g.code_groupe, label }]
        })
    ).values()]
    const typesIndicateur = [...new Set(indicateurs.filter(isIndicatorActive).map(i => i.type_indicateur).filter(Boolean))]
    const sensOptions = [...new Set(indicateurs.filter(isIndicatorActive).map(i => i.sens).filter(Boolean))]

    return (
      <div className="space-y-4 p-6 pt-4 bg-gray-50 min-h-full">
        <h2 className="text-lg font-bold text-gray-800">Suivi des indicateurs</h2>

        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2 overflow-x-auto">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Structure" size="sm" value={indFilters.structure || ''} onChange={(v) => setIndFilters(prev => ({ ...prev, structure: v }))} options={[{ value: '', label: 'Toutes' }, ...structuresOptions]} placeholder="Toutes" />
            </div>
            <div className="w-[140px] flex-shrink-0">
              <SearchableSelect label="Type_indicateur" size="sm" value={indFilters.type_indicateur || ''} onChange={(v) => setIndFilters(prev => ({ ...prev, type_indicateur: v }))} options={[{ value: '', label: 'Tous' }, ...typesIndicateur.map(opt => ({ value: opt, label: opt }))]} placeholder="Tous" />
            </div>
            <div className="w-[110px] flex-shrink-0">
              <SearchableSelect label="Sens" size="sm" value={indFilters.sens || ''} onChange={(v) => setIndFilters(prev => ({ ...prev, sens: v }))} options={[{ value: '', label: 'Tous' }, ...sensOptions.map(opt => ({ value: opt, label: opt }))]} placeholder="Tous" />
            </div>
            <div className="w-[130px] flex-shrink-0">
              <SearchableSelect label="Groupe" size="sm" value={indFilters.projet || ''} onChange={(v) => setIndFilters(prev => ({ ...prev, projet: v }))} options={[{ value: '', label: 'Tous' }, ...projetsOptions]} placeholder="Tous" />
            </div>
            <div className="w-[130px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Date début ≥</label>
              <input type="date" className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={indFilters.dateDebut} onChange={(e) => setIndFilters(prev => ({ ...prev, dateDebut: e.target.value }))} />
            </div>
            <div className="w-[130px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Date fin ≤</label>
              <input type="date" className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={indFilters.dateFin} onChange={(e) => setIndFilters(prev => ({ ...prev, dateFin: e.target.value }))} />
            </div>
            <button onClick={() => setIndFilters({ structure: '', type_indicateur: '', sens: '', projet: '', dateDebut: '', dateFin: '' })} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <DashboardStatCard title="Indicateurs" value={stats.total} icon={BarChart3} tone="blue" compact />
          <DashboardStatCard title="Indicateurs renseignés" value={stats.renseignes} icon={CheckCircle} tone="green" compact />
          <DashboardStatCard title="Taux de renseign." value={stats.tauxRenseignement} suffix="%" icon={Percent} tone="purple" compact />
          <DashboardStatCard title="Cible atteinte" value={stats.ciblesAtteintes} icon={Target} tone="orange" compact />
          <DashboardStatCard title="Taux d'atteinte" value={stats.tauxAtteinte} suffix="%" icon={TrendingUp} tone="red" compact />
        </div>

        <div className="grid grid-cols-2 gap-4 px-1">
          <DashboardProgressCard title="Taux de renseignement des indicateurs par structure" data={stats.renseignementParStructure} icon={Layers} maxValue={100} emptyMessage="Aucune donnée" />
          <DashboardProgressCard title="Taux d’atteinte des cibles par structure" data={stats.atteinteParStructure} icon={Layers} maxValue={100} emptyMessage="Aucune donnée" />
        </div>
      </div>
    )
  }

  const renderActions = () => {
    const stats = getActionsStats()
    const structuresOptions = (isPrivilegedUser(currentUser) ? structures : structures.filter(s => restrictStructureCode(s.code_structure) === restrictStructureCode(currentUser?.structure))).map(s => ({ value: s.code_structure, label: `${s.code_structure} - ${s.libelle_structure}` }))
    const groupesOptions = [...new Map(
      projets
        .filter(g => String(g?.statut || '').trim().toLowerCase() === 'actif' && String(g?.libelle_groupe || '').trim())
        .map(g => {
          const label = String(g.libelle_groupe || '').trim()
          return [label.toLowerCase(), { value: g.code_groupe, label }]
        })
    ).values()]

    return (
      <div className="space-y-4 p-6 pt-4 bg-gray-50 min-h-full">
        <h2 className="text-lg font-bold text-gray-800">Suivi des actions</h2>

        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2 overflow-x-auto">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Structure" size="sm" value={actFilters.structure || ''} onChange={(v) => setActFilters(prev => ({ ...prev, structure: v }))} options={[{ value: '', label: 'Toutes' }, ...structuresOptions]} placeholder="Toutes" />
            </div>
            <div className="w-[130px] flex-shrink-0">
              <SearchableSelect label="Projet" size="sm" value={actFilters.groupe || ''} onChange={(v) => setActFilters(prev => ({ ...prev, groupe: v }))} options={[{ value: '', label: 'Tous' }, ...groupesOptions]} placeholder="Tous" />
            </div>
            <div className="w-[130px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Date début ≥</label>
              <input type="date" className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={actFilters.dateDebut} onChange={(e) => setActFilters(prev => ({ ...prev, dateDebut: e.target.value }))} />
            </div>
            <div className="w-[130px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Date fin ≤</label>
              <input type="date" className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={actFilters.dateFin} onChange={(e) => setActFilters(prev => ({ ...prev, dateFin: e.target.value }))} />
            </div>
            <button onClick={() => setActFilters({ structure: '', groupe: '', dateDebut: '', dateFin: '' })} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <DashboardStatCard title="Nombre d'actions" value={stats.total} icon={ListChecks} tone="blue" compact />
          <DashboardStatCard title="Activités réalisées" value={stats.realisees} icon={CheckCircle} tone="green" compact />
          <DashboardStatCard title="Activités non réalisées" value={stats.nonRealisees} icon={AlertTriangle} tone="orange" compact />
          <DashboardStatCard title="Taux de réalisation" value={stats.tauxRealisation} suffix="%" icon={Percent} tone="purple" compact />
          <DashboardStatCard title="Réalisées dans le délai" value={stats.realiseesDelai} icon={Timer} tone="green" compact />
          <DashboardStatCard title="Taux dans le délai" value={stats.tauxRealisationDelai} suffix="%" icon={TrendingUp} tone="blue" compact />
          <DashboardStatCard title="Actions en retard" value={stats.enRetard} icon={AlertTriangle} tone="red" compact />
          <DashboardStatCard title="Retard moyen" value={stats.retardMoyen} suffix="j" icon={Clock} tone="amber" compact />
        </div>

        <div className="grid grid-cols-2 gap-4 px-1">
          <DashboardProgressCard title="Répartition actions par niveau de réalisation" data={stats.parAvancement} icon={Layers} maxValue={100} emptyMessage="Aucune donnée" />

          <DashboardProgressCard title="Top 04 des structures avec un retard" data={stats.topRetardStructures} icon={Layers} maxValue={100} onExpand={() => setShowStructuresRetardModal(true)} emptyMessage="Aucune structure en retard" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      <div className="w-56 bg-white border border-gray-200 rounded-2xl p-3 space-y-2 flex-shrink-0 sticky top-0 self-start h-[calc(100vh-140px)] overflow-y-auto">
        {subPages.map((page) => (
          <SidebarButton key={page.key} icon={page.icon} label={page.label} active={activeTab === page.key} onClick={() => handleTabChange(page.key)} />
        ))}
      </div>

      <div className="flex-1 min-w-0 overflow-auto bg-gray-50 p-2">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'indicateurs' && renderIndicateurs()}
            {activeTab === 'actions' && renderActions()}
            {activeTab === 'risques' && renderRisques()}
          </>
        )}
      </div>

      {/* Modal expansion graphique */}
      {/* Modal "Tous les processus" - affichage identique à "Gestion des risques > Synthèse" */}
      <Modal
        isOpen={showProcessusCritiquesModal}
        onClose={() => setShowProcessusCritiquesModal(false)}
        title="Tous les processus critiques (score 8-16)"
        size="lg"
      >
        {(() => {
          const riskStats = getRisquesStats()
          const hasPeriodeRisques = riskStats.totalActifs !== '-' && riskStats.totalActifs !== undefined

          if (!hasPeriodeRisques) {
            return <p className="text-gray-500 text-center py-6 text-sm">Sélectionnez une période pour afficher les statistiques.</p>
          }

          return (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {(riskStats.allProcessus || []).map((p, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{p.code} - {p.libelle}</span>
                  </div>
                  <div className="h-5 bg-gray-200 rounded-full overflow-hidden relative">
                    {(() => {
                      const pct = p.total > 0 ? Math.round((p.critiques / p.total) * 100) : 0
                      const width = p.total > 0 ? (p.critiques / p.total) * 100 : 0
                      return (
                        <>
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${width}%` }} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[9px] font-bold">{p.critiques}/{p.total} ({pct}%)</span>
                        </>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </Modal>

      {/* Modal toutes structures (plan de maîtrise) - affichage identique à "Gestion des risques > Synthèse" */}
      <Modal
        isOpen={showStructuresRetardModal}
        onClose={() => setShowStructuresRetardModal(false)}
        title="Top des structures avec actions en retard"
        size="lg"
      >
        {(() => {
          const actionStats = getActionsStats()
          const all = actionStats.allRetardStructures || []
          return (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {all.map((s, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between text-xs mb-1">
                    <span
                      className="text-gray-600 truncate max-w-[360px]"
                      title={s.libelle ? `${s.code} - ${s.libelle}` : s.code}
                    >
                      {s.libelle && s.libelle !== s.code ? `${s.code} - ${s.libelle}` : s.code}
                    </span>
                  </div>
                  <div className="h-5 bg-gray-200 rounded-full overflow-hidden relative">
                    {(() => {
                      const width = Math.max(0, Math.min(s.value || 0, 100))
                      return (
                        <>
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${Math.max(width, (s.rawValue || 0) > 0 ? 6 : 0)}%` }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[9px] font-bold">
                            {s.annotation || s.display || `${s.rawValue || 0}/${s.total || 0}`}
                          </span>
                        </>
                      )
                    })()}
                  </div>
                </div>
              ))}
              {all.length === 0 && <p className="text-gray-500 text-center py-6 text-sm">Aucune structure en retard</p>}
            </div>
          )
        })()}
      </Modal>

      <Modal isOpen={showExpandModal} onClose={() => setShowExpandModal(false)} title={expandData.title} size="lg">
        <div className="max-h-[500px] overflow-auto">
          <div className="space-y-2">
            {expandData.data.sort((a, b) => b.value - a.value).map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">{idx + 1}</span>
                <span className="flex-1 text-sm">{item.label}</span>
                <span className="font-medium text-sm">{item.display || item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-4 mt-4 border-t">
          <Button variant="secondary" onClick={() => setShowExpandModal(false)}>Fermer</Button>
        </div>
      </Modal>
    </div>
  )
}
