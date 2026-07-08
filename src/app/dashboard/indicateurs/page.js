'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { canSendReminders, canCreateIndicatorGroups } from '@/lib/roles'
import { FolderOpen, BarChart2, TrendingUp, Plus, Edit, Trash2, List, PlayCircle, Eye, CheckCircle, AlertTriangle, XCircle, ChevronLeft, ChevronRight, X, Info, RotateCcw, ChevronDown, Download, Archive, Send, Loader2 } from 'lucide-react'
import { Button, Modal, FormInput, StatusBadge, SidebarButton, AlertModal } from '@/components/ui'
import * as XLSX from 'xlsx'
import { canAccessIndicator, canAccessIndicatorOccurrence, isPrivilegedUser, isStructureResponsible } from '@/lib/access-scope'

function SearchableSelect({ label, value, onChange, options, placeholder = 'Tous', disabled = false, size = 'md' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)
  const sz = size === 'sm' ? 'text-xs py-1.5' : 'text-sm py-2'
  return (<div className="relative" ref={ref}>{label && <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>}<button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled} className={`w-full px-2 ${sz} border rounded bg-white text-left flex items-center justify-between gap-1 ${disabled ? 'bg-gray-100 text-gray-500' : 'hover:border-gray-400'}`}><span className="truncate text-gray-700">{selected?.label || placeholder}</span><ChevronDown size={14} className="text-gray-400 flex-shrink-0" /></button>{isOpen && (<div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-hidden"><div className="p-2 border-b"><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full px-2 py-1 text-xs border rounded" autoFocus /></div><div className="max-h-48 overflow-y-auto"><div onClick={() => { onChange(''); setIsOpen(false); setSearch('') }} className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer text-gray-500">{placeholder}</div>{filtered.map(o => (<div key={o.value} onClick={() => { onChange(o.value); setIsOpen(false); setSearch('') }} className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-100 ${o.value === value ? 'bg-blue-50 text-blue-700' : ''}`}>{o.label}</div>))}{!filtered.length && <p className="px-3 py-2 text-xs text-gray-500">Aucun résultat</p>}</div></div>)}</div>)
}


function SearchableFilterMultiSelect({ label, value, onChange, options, placeholder = 'Tous', disabled = false, size = 'sm' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : [])
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selectedLabels = selectedValues.map(v => options.find(o => String(o.value) === String(v))?.label).filter(Boolean)
  const sz = size === 'sm' ? 'text-xs py-1.5' : 'text-sm py-2'
  const toggle = (optionValue) => {
    const key = String(optionValue)
    const current = selectedValues.map(v => String(v))
    if (current.includes(key)) onChange(selectedValues.filter(v => String(v) !== key))
    else onChange([...selectedValues, optionValue])
  }
  const dropdownStyle = { minWidth: '100%', width: 'max-content', maxWidth: 'min(42rem, calc(100vw - 2rem))' }
  return (<div className="relative" ref={ref}>{label && <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>}<button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled} className={`w-full px-2 ${sz} border rounded bg-white text-left flex items-center justify-between gap-1 ${disabled ? 'bg-gray-100 text-gray-500' : 'hover:border-gray-400'}`}><span className="truncate text-gray-700">{selectedLabels.length ? `${selectedLabels.length} sélectionné(s)` : placeholder}</span><ChevronDown size={14} className="text-gray-400 flex-shrink-0" /></button>{isOpen && (<div className="absolute left-0 z-50 mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden" style={dropdownStyle}><div className="p-2 border-b"><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full px-2 py-1 text-xs border rounded" autoFocus /></div><div className="max-h-64 overflow-y-auto"><div onClick={() => { onChange([]); setSearch('') }} className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer text-gray-500 whitespace-normal break-words">{placeholder}</div>{filtered.map(o => { const checked = selectedValues.map(v => String(v)).includes(String(o.value)); return <div key={o.value} onClick={() => toggle(o.value)} title={o.label} className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-100 flex items-start gap-2 whitespace-normal break-words ${checked ? 'bg-blue-50 text-blue-700' : ''}`}><input type="checkbox" readOnly checked={checked} className="h-3 w-3 mt-0.5 flex-shrink-0"/><span className="block whitespace-normal break-words leading-snug">{o.label}</span></div> })}{!filtered.length && <p className="px-3 py-2 text-xs text-gray-500">Aucun résultat</p>}</div></div>)}</div>)
}

function SearchableMultiSelect({ label, value, onChange, options, placeholder = 'Ajouter...', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const filtered = options.filter(o => !value?.includes(o.value) && o.label.toLowerCase().includes(search.toLowerCase()))
  return (<div className="relative" ref={ref}>{label && <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>}<button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled} className={`w-full px-2 py-1.5 text-xs border rounded bg-white text-left flex items-center justify-between gap-1 ${disabled ? 'bg-gray-100 text-gray-500' : 'hover:border-gray-400'}`}><span className="text-gray-500">{placeholder}</span><ChevronDown size={14} className="text-gray-400" /></button>{isOpen && (<div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-hidden"><div className="p-2 border-b"><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full px-2 py-1 text-xs border rounded" autoFocus /></div><div className="max-h-48 overflow-y-auto">{filtered.map(o => (<div key={o.value} onClick={() => { onChange(o.value); setSearch('') }} className="px-3 py-2 text-xs cursor-pointer hover:bg-gray-100">{o.label}</div>))}{!filtered.length && <p className="px-3 py-2 text-xs text-gray-500">Aucun résultat</p>}</div></div>)}</div>)
}

export default function IndicateursPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('groupes')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionInProgressCount, setActionInProgressCount] = useState(0)
  const actionInProgress = actionInProgressCount > 0
  const [groupes, setGroupes] = useState([])
  const [indicateurs, setIndicateurs] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [structures, setStructures] = useState([])
  const [users, setUsers] = useState([])
  const [groupeFilters, setGroupeFilters] = useState({ gestionnaire: [], statut: '', recherche: '' })
  const [indicateurFilters, setIndicateurFilters] = useState({ structure: [], groupe: [], type_indicateur: [], statut: '', responsable: [], recherche: '' })
  const emptySuiviFilters = { groupe: [], structure: [], indicateur: [], responsable: [], statut: '', atteinte: '', date_debut: '', date_fin: '', renseignement: '', recherche: '' }
  const [suiviFilters, setSuiviFilters] = useState(emptySuiviFilters)
  const [dashboardPendingOnly, setDashboardPendingOnly] = useState(false)
  const [showGroupeModal, setShowGroupeModal] = useState(false)
  const [showIndicateurModal, setShowIndicateurModal] = useState(false)
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false)
  const [showCreateOccurrenceModal, setShowCreateOccurrenceModal] = useState(false)
  const [showOccurrencesListModal, setShowOccurrencesListModal] = useState(false)
  const [showArchivedGroupesModal, setShowArchivedGroupesModal] = useState(false)
  const [showArchivedIndicateursModal, setShowArchivedIndicateursModal] = useState(false)
  const [showArchivedSuiviModal, setShowArchivedSuiviModal] = useState(false)
  const [archivedGroupes, setArchivedGroupes] = useState([])
  const [archivedIndicateurs, setArchivedIndicateurs] = useState([])
  const [archivedSuiviOccurrences, setArchivedSuiviOccurrences] = useState([])
  const [selectedGroupe, setSelectedGroupe] = useState(null)
  const [selectedIndicateur, setSelectedIndicateur] = useState(null)
  const [selectedOccurrence, setSelectedOccurrence] = useState(null)
  const [indicateurOccurrences, setIndicateurOccurrences] = useState([])
  const [groupeForm, setGroupeForm] = useState({ gestionnaires: [] })
  const [indicateurForm, setIndicateurForm] = useState({ groupes: [] })
  const [occurrenceForm, setOccurrenceForm] = useState({})
  const [validationForm, setValidationForm] = useState({ comment: '' })
  const [showIndicatorValidationModal, setShowIndicatorValidationModal] = useState(false)
  const [createOccurrenceForm, setCreateOccurrenceForm] = useState({})
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const tableContainerRef = useRef(null)
  
  // État pour AlertModal unifié
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => { 
    if (alertModal.onConfirm) alertModal.onConfirm()
    setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null }) 
  }

  const runBlockingAction = useCallback(async (operation) => {
    setActionInProgressCount(count => count + 1)
    try {
      return await operation()
    } finally {
      setActionInProgressCount(count => Math.max(0, count - 1))
    }
  }, [])
  const blockingFetch = useCallback((...args) => runBlockingAction(() => globalThis.fetch(...args)), [runBlockingAction])

  const typeOptions = [{ value: 'Taux', label: 'Taux (Num./Dén.) - %' }, { value: 'TxCalcule', label: 'Taux déjà calculé - %' }, { value: 'Nombre', label: 'Nombre' }]
  const periodicites = ['Annuel', 'Semestriel', 'Trimestriel', 'Mensuel', 'Hebdomadaire', 'Journalier', 'Personnalise']
  const subPages = [{ key: 'groupes', label: 'Groupe', icon: FolderOpen }, { key: 'indicateurs', label: 'Indicateur', icon: BarChart2 }, { key: 'suivi', label: 'Suivi', icon: TrendingUp }]

  useEffect(() => { const u = localStorage.getItem('giras_user'); if (u) setUser(JSON.parse(u)); fetchBaseData() }, [])
  useEffect(() => {
    const tab = searchParams.get('tab')
    const pending = searchParams.get('pending') === '1'
    if (tab === 'suivi') setActiveTab('suivi')
    setDashboardPendingOnly(pending)
    if (pending) setSuiviFilters(prev => ({ ...prev, renseignement: 'non' }))
  }, [searchParams])
  const ensureIndicatorData = async ({ withOccurrences = false } = {}) => {
    await Promise.all([fetchGroupes(), fetchIndicateurs()])
    if (withOccurrences) await fetchOccurrences()
  }

  useEffect(() => {
    if (activeTab === 'groupes') ensureIndicatorData()
    else if (activeTab === 'indicateurs') ensureIndicatorData()
    else if (activeTab === 'suivi') ensureIndicatorData({ withOccurrences: true })
  }, [activeTab])
  useEffect(() => { checkScroll() }, [occurrences, activeTab])

  const fetchArchivedGroupesOptions = async () => {
    try {
      const r = await blockingFetch('/api/archive?type=groupe_indicateurs')
      if (r.ok) setArchivedGroupes((await r.json()) || [])
    } catch {}
  }
  const fetchBaseData = async () => {
    try {
      const [sR, uR, aR] = await Promise.all([blockingFetch('/api/structures'), blockingFetch('/api/users'), blockingFetch('/api/archive?type=groupe_indicateurs')])
      if (sR.ok) setStructures((await sR.json()).structures || [])
      if (uR.ok) setUsers((await uR.json()).users || [])
      if (aR.ok) setArchivedGroupes((await aR.json()) || [])
    } catch {}
  }
  const fetchGroupes = async () => { setLoading(true); try { const r = await blockingFetch('/api/groupe-indicateurs'); if (r.ok) setGroupes((await r.json()).groupes || []) ; await fetchArchivedGroupesOptions() } catch {} setLoading(false) }
  const fetchIndicateurs = async () => { setLoading(true); try { const r = await blockingFetch('/api/indicateurs'); if (r.ok) setIndicateurs((await r.json()).indicateurs || []) } catch {} setLoading(false) }
  const fetchOccurrences = async () => { try { const r = await blockingFetch('/api/indicateurs/occurrences'); if (r.ok) setOccurrences((await r.json()).occurrences || []) } catch {} }
  const checkScroll = () => { const c = tableContainerRef.current; if (c) { setCanScrollLeft(c.scrollLeft > 0); setCanScrollRight(c.scrollLeft < c.scrollWidth - c.clientWidth - 10) } }
  const scrollTable = (d) => { const c = tableContainerRef.current; if (c) { c.scrollBy({ left: d === 'left' ? -300 : 300, behavior: 'smooth' }); setTimeout(checkScroll, 300) } }

  const isAdmin = () => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.type_utilisateur === 'Admin' || user?.type_utilisateur === 'Super admin'
  const canTriggerIndicatorReminder = (occ) => {
    if (!canSendReminders(user)) return false
    const indicator = indicateurs.find(i => String(i.code_indicateur) === String(occ?.code_indicateur))
    const hasValue = !(occ?.val_indicateur === null || occ?.val_indicateur === undefined || `${occ?.val_indicateur}`.trim() === '')
    if (hasValue) return false
    return isAdmin() || (indicator && indicator.groupes?.some ? indicator.groupes.some(g => isGest(groupes.find(x => x.code_groupe === g))) : true) || groupes.some(g => isGest(g) && ((indicator?.groupes || []).includes(g.code_groupe) || indicator?.code_groupe === g.code_groupe))
  }
  const isGest = (g) => g?.gestionnaires?.includes(user?.username) || g?.gestionnaire === user?.username
  const canCreateGroupe = () => canCreateIndicatorGroups(user)

  const normalizeUsernameValue = (value) => String(value || '').trim().toLowerCase()
  const isDirectSuperiorOf = (targetUsername) => {
    const currentUsername = normalizeUsernameValue(user?.username)
    const target = users.find((item) => normalizeUsernameValue(item?.username) === normalizeUsernameValue(targetUsername))
    return !!currentUsername && !!target && normalizeUsernameValue(target?.superieur) === currentUsername
  }
  const isStructureManagerForCode = (structureCode) => isStructureResponsible(user, structureCode, structures)
  const canManageIndicatorWorkflow = (occ = null, ind = null) => {
    if (user?.type_utilisateur === 'Super admin') return true
    if (ind && isGestionnaireOnIndicator(ind)) return true
    if (occ && isGestionnaireOnOccurrence(occ)) return true
    return false
  }
  const canUserEditIndicatorOccurrence = (occ, ind) => {
    if (isIndicatorValidated(occ)) return false
    return canManageIndicatorWorkflow(occ, ind) || isResp(ind) || isDirectSuperiorOf(occ?.responsable || ind?.responsable) || isStructureManagerForCode(ind?.code_structure || occ?.code_structure)
  }
  const canFullyEditIndicatorOccurrence = (occ, ind) => {
    if (isIndicatorValidated(occ)) return false
    return canManageIndicatorWorkflow(occ, ind)
  }
  const canLimitedEditIndicatorOccurrence = (occ, ind) => {
    if (isIndicatorValidated(occ)) return false
    return isResp(ind) || isDirectSuperiorOf(occ?.responsable || ind?.responsable) || isStructureManagerForCode(ind?.code_structure || occ?.code_structure)
  }
  const getIndicatorWorkflowHistory = (occ) => {
    if (!occ?.validation_history) return []
    try { const parsed = JSON.parse(occ.validation_history); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
  }
  const requiresIndicatorReply = (occ, nextValue = null) => {
    const status = String(occ?.validation_status || '').trim().toLowerCase()
    const hasOutstandingRejection = status === 'rejetée' || status === 'rejetee' || !!String(occ?.last_rejection_comment || '').trim()
    const hasValue = !(nextValue === null || nextValue === undefined || String(nextValue).trim() === '')
    return hasOutstandingRejection && hasValue
  }

  const canEditGroupe = (g) => {
    if (!g) return false
    // Le groupe RISQUE ne peut pas être modifié ici - gestionnaires gérés dans Gestion des risques
    if (g?.code_groupe === 'RISQUE' || g?.code_groupe === 'Risque') return false
    return user?.type_utilisateur === 'Super admin' || isGest(g)
  }
  const canDelGroupe = (g) => {
    if (g?.code_groupe === 'RISQUE' || g?.code_groupe === 'Risque') return false
    return user?.type_utilisateur === 'Super admin' || isGest(g)
  }
  const isRisque = (ind) => ind?.groupes?.includes('Risque') || ind?.code_groupe === 'Risque'
  const indicatorRequiresTarget = (ind) => ind?.necessite_cible !== 'Non'
  
  // Fonction pour obtenir la cible correcte d'une occurrence
  // Pour les indicateurs risque : Seuil3 si sens positif, Seuil1 si sens négatif
  // Pour les autres : la cible de l'occurrence
  const getCible = (occ, ind) => {
    if (!indicatorRequiresTarget(ind)) return null
    if (isRisque(ind)) {
      return ind?.sens === 'Négatif' ? parseFloat(ind?.seuil1) : parseFloat(ind?.seuil3)
    }
    return occ?.cible != null ? parseFloat(occ.cible) : null
  }
  
  const hasGlobalIndicatorAccess = () => isPrivilegedUser(user)
  const getIndicatorGroupCodes = (ind) => {
    const values = []
    if (Array.isArray(ind?.groupes)) values.push(...ind.groupes)
    else if (typeof ind?.groupes === 'string') {
      try {
        const parsed = JSON.parse(ind.groupes)
        if (Array.isArray(parsed)) values.push(...parsed)
      } catch {}
    }
    if (ind?.code_groupe) values.push(ind.code_groupe)
    return [...new Set(values.filter(Boolean).map(v => String(v).trim()))]
  }
  const isGestionnaireGroupe = (g) => !!g && isGest(g)
  const isGestionnaireOnIndicator = (ind) => getIndicatorGroupCodes(ind).some(code => isGestionnaireGroupe(groupes.find(g => g.code_groupe === code)))
  const isGestionnaireOnOccurrence = (occ) => {
    const ind = [...indicateurs, ...archivedIndicateurs].find(item => String(item?.code_indicateur) === String(occ?.code_indicateur || occ?.code_indicateur_occ))
    if (ind) return isGestionnaireOnIndicator(ind)
    const codes = []
    if (Array.isArray(occ?.groupes)) codes.push(...occ.groupes)
    if (occ?.code_groupe) codes.push(occ.code_groupe)
    return [...new Set(codes.filter(Boolean).map(v => String(v).trim()))].some(code => isGestionnaireGroupe(groupes.find(g => g.code_groupe === code)))
  }
  const canViewInd = (ind) => isGestionnaireOnIndicator(ind) || canAccessIndicator(user, ind, users, structures)
  const canViewOcc = (occ) => isGestionnaireOnOccurrence(occ) || canAccessIndicatorOccurrence(user, occ, [...indicateurs, ...archivedIndicateurs], users, structures)
  const canEditInd = (ind) => { if (isAdmin()) return true; return getIndicatorGroupCodes(ind).some(code => isGest(groupes.find(g => g.code_groupe === code))) }
  const canDelInd = canEditInd
  const isResp = (ind) => ind?.responsable === user?.username
  const isIndicatorValidated = (occ) => {
    const status = String(occ?.validation_status || '').trim().toLowerCase()
    return status === 'validé' || status === 'valide'
  }
  const canEditOcc = (occ, ind) => canUserEditIndicatorOccurrence(occ, ind)
  const availableManagedGroupsForForm = (user?.type_utilisateur === 'Super admin'
    ? groupes
    : groupes.filter(g => isGest(g)))
      .filter(g => g.statut === 'Actif')

  const canSaisir = (occ, ind) => canUserEditIndicatorOccurrence(occ, ind)
  const canDelOcc = (occ, ind) => canEditOcc(occ, ind)
  const getUsersStruct = (cs) => !cs ? [] : users.filter(u => u.structure === cs)
  const getGroupManagerUsernamesForIndicator = (ind) => {
    const managers = []
    getIndicatorGroupCodes(ind).forEach(code => {
      const group = groupes.find(g => String(g.code_groupe) === String(code))
      if (!group) return
      if (group.gestionnaire) managers.push(group.gestionnaire)
      if (Array.isArray(group.gestionnaires)) managers.push(...group.gestionnaires)
      else if (typeof group.gestionnaires === 'string') {
        try {
          const parsed = JSON.parse(group.gestionnaires)
          if (Array.isArray(parsed)) managers.push(...parsed)
          else managers.push(...group.gestionnaires.split(/[;,]/))
        } catch { managers.push(...group.gestionnaires.split(/[;,]/)) }
      }
    })
    return [...new Set(managers.map(v => String(v || '').trim()).filter(Boolean))]
  }
  const getResponsableOptionsForIndicatorData = (ind) => {
    const managerSet = new Set(getGroupManagerUsernamesForIndicator(ind).map(v => v.toLowerCase()))
    const optionUsers = users.filter(u => String(u?.statut || 'Actif') === 'Actif' && (u.structure === ind?.code_structure || managerSet.has(String(u.username || '').toLowerCase())))
    return optionUsers
      .filter((u, idx, arr) => arr.findIndex(x => x.username === u.username) === idx)
      .sort((a, b) => `${a.nom || ''} ${a.prenoms || ''}`.localeCompare(`${b.nom || ''} ${b.prenoms || ''}`, 'fr'))
      .map(u => ({
        value: u.username,
        label: `${u.nom || ''} ${u.prenoms || ''}${managerSet.has(String(u.username || '').toLowerCase()) ? ' - Gestionnaire' : ''}`.trim()
      }))
  }
  const getIndicatorResponsableOptions = () => getResponsableOptionsForIndicatorData(indicateurForm)
  const getOccurrenceResponsableOptions = (ind) => getResponsableOptionsForIndicatorData(ind)
  const isAllowedIndicatorResponsible = (username, ind) => {
    if (!username) return false
    const selectedUser = users.find(u => u.username === username)
    if (!selectedUser) return false
    if (selectedUser.structure === ind?.code_structure) return true
    const managerSet = new Set(getGroupManagerUsernamesForIndicator(ind).map(v => v.toLowerCase()))
    return managerSet.has(String(username).toLowerCase())
  }

  const validateSeuils = (f) => { if (!f.groupes?.includes('Risque')) return true; const s1 = parseFloat(f.seuil1), s2 = parseFloat(f.seuil2), s3 = parseFloat(f.seuil3); if (isNaN(s1) || isNaN(s2) || isNaN(s3)) { showAlert('error', 'Seuils obligatoires'); return false } if (!(s1 < s2 && s2 < s3)) { showAlert('error', 'S1 < S2 < S3'); return false } return true }

  const getWeekDates = (y, w) => { const d = new Date(y, 0, 1 + (w - 1) * 7); const dow = d.getDay(); const start = new Date(d); start.setDate(d.getDate() - dow + 1); const end = new Date(start); end.setDate(start.getDate() + 6); return { debut: start.toISOString().split('T')[0], fin: end.toISOString().split('T')[0] } }
  const genPeriodes = (p, y) => { const yrs = Array.from({ length: 101 }, (_, i) => 2000 + i); if (p === 'Annuel') return yrs.map(yr => ({ value: `${yr}`, label: `${yr}`, debut: `${yr}-01-01`, fin: `${yr}-12-31` })); if (p === 'Semestriel' && y) return [{ value: `S1-${y}`, label: `S1 ${y}`, debut: `${y}-01-01`, fin: `${y}-06-30` }, { value: `S2-${y}`, label: `S2 ${y}`, debut: `${y}-07-01`, fin: `${y}-12-31` }]; if (p === 'Trimestriel' && y) return [1,2,3,4].map(t => ({ value: `T${t}-${y}`, label: `T${t} ${y}`, debut: `${y}-${String((t-1)*3+1).padStart(2,'0')}-01`, fin: t===1?`${y}-03-31`:t===2?`${y}-06-30`:t===3?`${y}-09-30`:`${y}-12-31` })); if (p === 'Mensuel' && y) { const m = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']; return m.map((n, i) => { const mn = String(i + 1).padStart(2, '0'); const ld = new Date(y, i + 1, 0).getDate(); return { value: `${n}-${y}`, label: `${n} ${y}`, debut: `${y}-${mn}-01`, fin: `${y}-${mn}-${ld}` } }) } if (p === 'Hebdomadaire' && y) { const ws = []; for (let w = 1; w <= 52; w++) { const wd = getWeekDates(y, w); ws.push({ value: `Sem${w}-${y}`, label: `S${w} ${y}`, debut: wd.debut, fin: wd.fin }) } return ws } return [] }
  const handlePeriode = (f, sf, p, v, y) => { if (p === 'Personnalise') { sf({ ...f, periode: '', annee: null, date_debut: '', date_fin: '' }); return } if (p === 'Journalier') { sf({ ...f, periode: v, annee: null, date_debut: v, date_fin: v }); return } const ps = genPeriodes(p, y); const sel = ps.find(x => x.value === v); if (sel) sf({ ...f, periode: v, annee: y || parseInt(v), date_debut: sel.debut, date_fin: sel.fin }) }

  const handleOpenGrpModal = (g = null) => { setSelectedGroupe(g); setGroupeForm(g ? { ...g, gestionnaires: g.gestionnaires || (g.gestionnaire ? [g.gestionnaire] : []) } : { statut: 'Actif', gestionnaires: [] }); setShowGroupeModal(true) }
  const handleAddGest = (u) => { if (u && !groupeForm.gestionnaires?.includes(u)) setGroupeForm({ ...groupeForm, gestionnaires: [...(groupeForm.gestionnaires || []), u] }) }
  const handleRemGest = (u) => { setGroupeForm({ ...groupeForm, gestionnaires: groupeForm.gestionnaires?.filter(x => x !== u) || [] }) }
  
  // Validation du code groupe : un seul mot, max 20 caractères, pas de caractères spéciaux
  const validateCodeGroupe = (code) => {
    if (!code) return { valid: false, error: 'Code obligatoire' }
    if (code.length > 20) return { valid: false, error: 'Le code ne doit pas dépasser 20 caractères' }
    if (/\s/.test(code)) return { valid: false, error: 'Le code ne doit pas contenir d\'espaces' }
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) return { valid: false, error: 'Le code ne doit contenir que des lettres, chiffres, tirets ou underscores' }
    return { valid: true }
  }
  
  const handleSaveGrp = async () => { 
    if (!groupeForm.code_groupe || !groupeForm.libelle_groupe) { showAlert('error', 'Code et libellé obligatoires'); return }
    
    // Valider le format du code
    const codeValidation = validateCodeGroupe(groupeForm.code_groupe)
    if (!codeValidation.valid) { showAlert('error', codeValidation.error); return }
    
    if (!groupeForm.gestionnaires?.length) { showAlert('error', 'Gestionnaire requis'); return } 
    try { 
      const r = await blockingFetch('/api/groupe-indicateurs', { method: selectedGroupe ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...groupeForm, id: selectedGroupe?.id, createur: user?.username, modificateur: user?.username }) })
      if (r.ok) { 
        showAlert('success', selectedGroupe ? 'Groupe modifié avec succès' : 'Groupe créé avec succès', () => { setShowGroupeModal(false); fetchGroupes(); fetchBaseData() })
      } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') } 
  }
  const [confirmAction, setConfirmAction] = useState(null)
  const handleDelGrp = (g) => { 
    if (!canDelGroupe(g) || g.is_default) return
    setConfirmAction({ message: `Supprimer "${g.libelle_groupe}" ? Cette suppression entraînera aussi la suppression de tous les indicateurs et de toutes les occurrences associés à ce groupe.`, onConfirm: async () => {
      try { const r = await blockingFetch('/api/groupe-indicateurs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id }) }); if (r.ok) { showAlert('success', 'Groupe, indicateurs et occurrences supprimés', async () => { await fetchGroupes(); await fetchIndicateurs(); await fetchOccurrences(); if (showArchivedGroupesModal) handleOpenArchivedGroupes(); if (showArchivedIndicateursModal) handleOpenArchivedIndicateurs(); if (showArchivedSuiviModal) handleOpenArchivedSuivi() }) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur') }
    }})
  }

  const handleOpenIndModal = (ind = null) => { setSelectedIndicateur(ind); setIndicateurForm(ind ? { ...ind, necessite_cible: ind.necessite_cible || 'Oui', groupes: ind.groupes || (ind.code_groupe ? [ind.code_groupe] : []) } : { type_indicateur: 'Taux', sens: 'Positif', statut: 'Actif', periodicite: '', groupes: [], code_structure: '', numerateur: '', denominateur: '', necessite_cible: 'Oui' }); setShowIndicateurModal(true) }
  const handleAddGrp = (c) => { if (!c) return; if (c === 'Risque') { setIndicateurForm({ ...indicateurForm, groupes: ['Risque'], periodicite: 'Personnalise' }) } else { if (indicateurForm.groupes?.includes('Risque')) { showAlert('warning', 'Le groupe Risque est exclusif'); return } if (!indicateurForm.groupes?.includes(c)) setIndicateurForm({ ...indicateurForm, groupes: [...(indicateurForm.groupes || []), c] }) } }
  const handleRemGrp = (c) => { const ng = indicateurForm.groupes?.filter(x => x !== c) || []; setIndicateurForm({ ...indicateurForm, groupes: ng, ...(c === 'Risque' ? { periodicite: '', seuil1: null, seuil2: null, seuil3: null } : {}) }) }
  const handleStructChg = (cs) => {
    const nextForm = { ...indicateurForm, code_structure: cs }
    if (!isAllowedIndicatorResponsible(indicateurForm.responsable, nextForm)) nextForm.responsable = ''
    setIndicateurForm(nextForm)
  }
  const handleTypeChg = (t) => { setIndicateurForm({ ...indicateurForm, type_indicateur: t, ...(t !== 'Taux' ? { numerateur: '', denominateur: '' } : {}) }) }
  const handleSaveInd = async () => { 
    if (!indicateurForm.libelle_indicateur || !indicateurForm.code_structure || !indicateurForm.responsable) { showAlert('error', 'Champs obligatoires manquants'); return } 
    if (!indicateurForm.groupes?.length) { showAlert('error', 'Groupe requis'); return } 
    if (indicateurForm.type_indicateur === 'Taux' && (!indicateurForm.numerateur || !indicateurForm.denominateur)) { showAlert('error', 'Numérateur/Dénominateur requis'); return } 
    const hasR = indicateurForm.groupes?.includes('Risque')
    if (!selectedIndicateur && !hasR && !indicateurForm.periodicite) { showAlert('error', 'Périodicité requise'); return } 
    if (!validateSeuils(indicateurForm)) return
    if (!isAllowedIndicatorResponsible(indicateurForm.responsable, indicateurForm)) { showAlert('error', "Le responsable doit être membre de la structure sélectionnée ou gestionnaire du groupe d'indicateurs"); return } 
    try { 
      const data = { ...indicateurForm, necessite_cible: indicateurForm.necessite_cible || 'Oui' }
      if (hasR) data.periodicite = 'Personnalise'
      if (!hasR) { data.seuil1 = data.seuil2 = data.seuil3 = null } 
      if (data.type_indicateur !== 'Taux') { data.numerateur = null; data.denominateur = null } 
      const r = await blockingFetch('/api/indicateurs', { method: selectedIndicateur ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, id: selectedIndicateur?.id, createur: user?.username, modificateur: user?.username }) })
      if (r.ok) { 
        showAlert('success', selectedIndicateur ? 'Indicateur modifié avec succès' : 'Indicateur créé avec succès', () => { setShowIndicateurModal(false); fetchIndicateurs() })
      } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') } 
  }
  const handleDelInd = (ind) => { 
    if (!canDelInd(ind)) return
    setConfirmAction({ message: `Supprimer l'indicateur "${ind.libelle_indicateur}" ? Cette suppression entraînera aussi la suppression de toutes ses occurrences.`, onConfirm: async () => {
      try { const r = await blockingFetch('/api/indicateurs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ind.id }) }); if (r.ok) { showAlert('success', 'Indicateur et occurrences supprimés', async () => { await fetchIndicateurs(); await fetchOccurrences(); if (showArchivedIndicateursModal) handleOpenArchivedIndicateurs(); if (showArchivedSuiviModal) handleOpenArchivedSuivi() }) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur') }
    }})
  }

  const handleOpenCreateOcc = (ind) => { 
    const linkedGroups = (ind.groupes || (ind.code_groupe ? [ind.code_groupe] : [])).map(String)
    const hasInactiveGroup = linkedGroups.some(code => (allGroupes.find(g => g.code_groupe === code)?.statut || 'Actif') !== 'Actif')
    if (hasInactiveGroup) { showAlert('error', "Impossible de créer une occurrence pour un indicateur rattaché à un groupe inactif"); return }
    if (ind.statut !== 'Actif' || !canEditInd(ind)) return
    if (isRisque(ind)) { showAlert('info', 'Les occurrences Risque sont créées depuis Gestion des risques'); return } 
    setConfirmAction({ message: `Ouvrir une occurrence pour "${ind.libelle_indicateur}" ?`, onConfirm: async () => {
      try { const r = await blockingFetch(`/api/indicateurs/occurrences?code_indicateur=${ind.code_indicateur}`); if (r.ok) setIndicateurOccurrences((await r.json()).occurrences || []) } catch {} 
      setSelectedIndicateur(ind); setCreateOccurrenceForm({ code_indicateur: ind.code_indicateur, periodicite: ind.periodicite, annee: new Date().getFullYear(), periode: '', date_debut: '', date_fin: '', date_limite_saisie: '', cible: '', responsable: ind.responsable || '' }); setShowCreateOccurrenceModal(true)
    }})
  }
  const handleSaveCreateOcc = async () => { 
    if (!createOccurrenceForm.date_debut || !createOccurrenceForm.date_fin || !createOccurrenceForm.date_limite_saisie) { showAlert('error', 'Dates requises'); return } 
    // Validation : la date limite de saisie doit être >= date de fin de période
    if (createOccurrenceForm.date_limite_saisie < createOccurrenceForm.date_fin) { 
      showAlert('error', 'La date limite de saisie doit être ultérieure ou égale à la date de fin de période'); return 
    }
    if (indicatorRequiresTarget(selectedIndicateur) && (createOccurrenceForm.cible === '' || createOccurrenceForm.cible == null)) { showAlert('error', 'Cible requise'); return } 
    if (!createOccurrenceForm.responsable) { showAlert('error', 'Responsable requis'); return }
    if (selectedIndicateur?.periodicite !== 'Personnalise' && !createOccurrenceForm.periode) { showAlert('error', 'Période requise'); return } 
    if (indicateurOccurrences.find(o => o.date_debut === createOccurrenceForm.date_debut && o.date_fin === createOccurrenceForm.date_fin)) { showAlert('error', 'Cette occurrence existe déjà'); return } 
    try { 
      const r = await blockingFetch('/api/indicateurs/occurrences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...createOccurrenceForm, createur: user?.username }) })
      if (r.ok) { showAlert('success', 'Occurrence créée avec succès', () => { setShowCreateOccurrenceModal(false); fetchOccurrences() }) } 
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur') } 
  }
  const handleShowOccList = async (ind) => { setSelectedIndicateur(ind); try { const r = await blockingFetch(`/api/indicateurs/occurrences?code_indicateur=${ind.code_indicateur}`); if (r.ok) { setIndicateurOccurrences((await r.json()).occurrences || []); setShowOccurrencesListModal(true) } } catch {} }
  const handleOpenOccModal = (occ) => { const ind = indicateurs.find(i => i.code_indicateur === occ.code_indicateur); setSelectedIndicateur(ind); setSelectedOccurrence(occ); let cible = occ.cible; if (isRisque(ind)) cible = ind.sens === 'Négatif' ? ind.seuil1 : ind.seuil3; setOccurrenceForm({ ...occ, cible, periodicite: ind?.periodicite, annee: occ.annee || new Date(occ.date_debut).getFullYear() }); setValidationForm({ comment: '' }); setShowOccurrenceModal(true) }
  const openIndicatorValidationModal = (occ, ind = null) => {
    const resolvedInd = ind || indicateurs.find(i => i.code_indicateur === occ.code_indicateur)
    setSelectedIndicateur(resolvedInd || null)
    setSelectedOccurrence(occ)
    setValidationForm({ comment: '' })
    setShowIndicatorValidationModal(true)
  }
  const handleSaveOcc = async () => { 
    const nextIndicatorValue = occurrenceForm.val_indicateur !== null && occurrenceForm.val_indicateur !== undefined && `${occurrenceForm.val_indicateur}` !== '' ? occurrenceForm.val_indicateur : null
    if (selectedOccurrence && requiresIndicatorReply(selectedOccurrence, nextIndicatorValue) && !String(occurrenceForm.commentaire || '').trim()) { showAlert('error', 'Vous devez répondre au commentaire du gestionnaire avant la nouvelle soumission'); return }
    if (!occurrenceForm.date_limite_saisie) { showAlert('error', 'Date limite requise'); return }
    // Validation : la date limite de saisie doit être >= date de fin de période
    if (occurrenceForm.date_limite_saisie < occurrenceForm.date_fin) { 
      showAlert('error', 'La date limite de saisie doit être ultérieure ou égale à la date de fin de période'); return 
    }
    try { 
      const hasIndicatorValue = occurrenceForm.val_indicateur !== null && occurrenceForm.val_indicateur !== undefined && `${occurrenceForm.val_indicateur}` !== ''
      const payload = { ...occurrenceForm, modificateur: user?.username, validation_status: hasIndicatorValue ? 'Attente de validation' : occurrenceForm.validation_status }
      const ind = selectedIndicateur || indicateurs.find(i => i.code_indicateur === occurrenceForm.code_indicateur)
      if (ind?.type_indicateur === 'Taux' && occurrenceForm.val_numerateur !== null && occurrenceForm.val_numerateur !== undefined && `${occurrenceForm.val_numerateur}` !== '' && occurrenceForm.val_denominateur !== null && occurrenceForm.val_denominateur !== undefined && `${occurrenceForm.val_denominateur}` !== '') { 
        const d = parseFloat(occurrenceForm.val_denominateur)
        payload.val_indicateur = d !== 0 ? (parseFloat(occurrenceForm.val_numerateur) / d) * 100 : null 
      } 
      if (!indicatorRequiresTarget(ind)) payload.cible = null
      const r = await blockingFetch('/api/indicateurs/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (r.ok) { 
        showAlert('success', 'Occurrence modifiée avec succès', async () => { 
          setShowOccurrenceModal(false); fetchOccurrences()
          if (showOccurrencesListModal && selectedIndicateur) { const rr = await blockingFetch(`/api/indicateurs/occurrences?code_indicateur=${selectedIndicateur.code_indicateur}`); if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || []) }
        })
      } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur') } 
  }

  const executeIndicatorValidationDecision = async (decision) => {
    if (!selectedOccurrence) return
    if (!canManageIndicatorWorkflow(selectedOccurrence, selectedIndicateur)) {
      showAlert('error', 'Seuls un gestionnaire ou un super admin peuvent valider ou rejeter un indicateur')
      return
    }
    if (decision === 'reject' && !String(validationForm.comment || '').trim()) {
      showAlert('error', 'Le commentaire de rejet est obligatoire')
      return
    }
    try {
      const payload = {
        ...selectedOccurrence,
        id: selectedOccurrence.id,
        modificateur: user?.username,
        validation_decision: decision,
        validation_comment: validationForm.comment,
      }
      const r = await blockingFetch('/api/indicateurs/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (r.ok) {
        showAlert('success', decision === 'reject' ? 'Valeur rejetée avec succès' : 'Valeur validée avec succès', async () => {
          setValidationForm({ comment: '' })
          setShowIndicatorValidationModal(false)
          setShowOccurrenceModal(false)
          await fetchOccurrences()
          if (showOccurrencesListModal && selectedIndicateur) { const rr = await blockingFetch(`/api/indicateurs/occurrences?code_indicateur=${selectedIndicateur.code_indicateur}`); if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || []) }
        })
      } else {
        const err = await r.json().catch(() => ({}))
        showAlert('error', err.error || 'Erreur')
      }
    } catch {
      showAlert('error', 'Erreur')
    }
  }

  const handleIndicatorValidationDecision = (decision) => {
    if (!selectedOccurrence) return
    if (!canManageIndicatorWorkflow(selectedOccurrence, selectedIndicateur)) {
      showAlert('error', 'Seuls un gestionnaire ou un super admin peuvent valider ou rejeter un indicateur')
      return
    }
    if (decision === 'reject' && !String(validationForm.comment || '').trim()) {
      showAlert('error', 'Le commentaire de rejet est obligatoire')
      return
    }
    setConfirmAction({
      message: decision === 'reject'
        ? "Confirmez-vous le rejet de cette valeur ? La valeur de l'occurrence sera vidée automatiquement et un email sera envoyé au responsable avec l'intégralité du commentaire."
        : "Confirmez-vous la validation de cette valeur d'indicateur ?",
      onConfirm: async () => { await executeIndicatorValidationDecision(decision) }
    })
  }

  const handleUndoIndicatorValidation = (occ) => {
    const ind = indicateurs.find(i => i.code_indicateur === occ.code_indicateur)
    if (!canManageIndicatorWorkflow(occ, ind) || !isIndicatorValidated(occ)) return
    setConfirmAction({
      message: "Confirmez-vous l'annulation de la validation ? L'indicateur repassera en attente de validation et redeviendra modifiable.",
      onConfirm: async () => {
        try {
          const payload = {
            ...occ,
            id: occ.id,
            modificateur: user?.username,
            validation_decision: 'cancel_approval',
            validation_comment: 'Validation annulée par le gestionnaire',
          }
          if (!indicatorRequiresTarget(ind)) payload.cible = null
          const r = await blockingFetch('/api/indicateurs/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          if (r.ok) {
            showAlert('success', 'Validation annulée avec succès', async () => {
              await fetchOccurrences()
              if (showOccurrencesListModal && selectedIndicateur) {
                const rr = await blockingFetch(`/api/indicateurs/occurrences?code_indicateur=${selectedIndicateur.code_indicateur}`)
                if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || [])
              }
            })
          } else {
            const err = await r.json().catch(() => ({}))
            showAlert('error', err.error || 'Erreur')
          }
        } catch {
          showAlert('error', 'Erreur')
        }
      }
    })
  }

  const handleDelOcc = (occ) => { 
    const ind = selectedIndicateur || indicateurs.find(i => i.code_indicateur === occ.code_indicateur)
    if (!canDelOcc(occ, ind)) return
    setConfirmAction({ message: 'Supprimer cette occurrence ?', onConfirm: async () => {
      try { 
        const r = await blockingFetch('/api/indicateurs/occurrences', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: occ.id }) })
        if (r.ok) { 
          showAlert('success', 'Occurrence supprimée', async () => {
            fetchOccurrences()
            if (showOccurrencesListModal && selectedIndicateur) { const rr = await blockingFetch(`/api/indicateurs/occurrences?code_indicateur=${selectedIndicateur.code_indicateur}`); if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || []) }
          })
        } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
      } catch { showAlert('error', 'Erreur') }
    }})
  }

  const handleArchiveItem = (type, item, libelle) => {
    let message = `Archiver "${libelle}" ?`
    if (type === 'groupe_indicateurs') {
      message = `Archiver "${libelle}" ? Tous les indicateurs et toutes les occurrences rattachés à ce groupe seront également archivés et passeront au statut Inactif.`
    } else if (type === 'indicateur') {
      message = `Archiver "${libelle}" ? Toutes les occurrences rattachées à cet indicateur seront également archivées et passeront au statut Inactif.`
    }

    setConfirmAction({ message, onConfirm: async () => {
      try {
        const r = await blockingFetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id: item.id, archive_par: user?.username })
        })
        if (!r.ok) {
          const err = await r.json()
          showAlert('error', err.error || 'Erreur')
          return
        }
        showAlert('success', type === 'groupe_indicateurs' ? 'Groupe, indicateurs et occurrences archivés' : type === 'indicateur' ? 'Indicateur et occurrences archivés' : 'Élément archivé avec succès', async () => {
          if (type === 'groupe_indicateurs') {
            await fetchGroupes()
            await fetchIndicateurs()
            await fetchOccurrences()
            if (showArchivedGroupesModal) handleOpenArchivedGroupes()
            if (showArchivedIndicateursModal) handleOpenArchivedIndicateurs()
            if (showArchivedSuiviModal) handleOpenArchivedSuivi()
          } else if (type === 'indicateur') {
            await fetchIndicateurs()
            await fetchOccurrences()
            if (showArchivedIndicateursModal) handleOpenArchivedIndicateurs()
            if (showArchivedSuiviModal) handleOpenArchivedSuivi()
          } else {
            await fetchOccurrences()
            if (showOccurrencesListModal && selectedIndicateur) {
              const rr = await blockingFetch(`/api/indicateurs/occurrences?code_indicateur=${selectedIndicateur.code_indicateur}`)
              if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || [])
            }
            if (showArchivedSuiviModal) handleOpenArchivedSuivi()
          }
        })
      } catch {
        showAlert('error', 'Erreur')
      }
    }})
  }

  const handleDeleteArchivedItem = (type, item, libelle) => {
    const message = type === 'groupe_indicateurs'
      ? `Supprimer définitivement "${libelle}" ? Cette suppression entraînera aussi la suppression définitive de tous les indicateurs et de toutes les occurrences associés.`
      : type === 'indicateur'
        ? `Supprimer définitivement "${libelle}" ? Cette suppression entraînera aussi la suppression définitive de toutes ses occurrences.`
        : `Supprimer définitivement "${libelle}" ?`
    setConfirmAction({ message, onConfirm: async () => {
      try {
        const r = await blockingFetch('/api/archive', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id: item.id })
        })
        if (!r.ok) {
          const err = await r.json()
          showAlert('error', err.error || 'Erreur')
          return
        }
        showAlert('success', type === 'groupe_indicateurs' ? 'Groupe archivé, indicateurs et occurrences supprimés' : type === 'indicateur' ? 'Indicateur archivé et occurrences supprimés' : 'Archive supprimée', async () => {
          await fetchGroupes()
          await fetchIndicateurs()
          await fetchOccurrences()
          if (type === 'groupe_indicateurs') handleOpenArchivedGroupes()
          else if (type === 'indicateur') handleOpenArchivedIndicateurs()
          else handleOpenArchivedSuivi()
        })
      } catch {
        showAlert('error', 'Erreur')
      }
    }})
  }

  const getAtteinte = (v, c, sens) => {
    if (v == null || c == null) return { status: 'unknown', pct: 0 }
    const val = parseFloat(v)
    const cible = parseFloat(c)
    if (Number.isNaN(val) || Number.isNaN(cible)) return { status: 'unknown', pct: 0 }
    let p
    if (cible === 0) {
      p = sens === 'Négatif' ? (val <= 0 ? 100 : 0) : (val >= 0 ? 100 : 0)
    } else {
      p = sens === 'Positif' ? (val / cible) * 100 : (val <= cible ? 100 : (cible / val) * 100)
    }
    if (p >= 100) return { status: 'atteint', pct: p }; if (p >= 90) return { status: 'proche', pct: p }; return { status: 'non_atteint', pct: p }
  }
  // Calcul du retard (même logique que côté serveur):
  // - comparaison en *date-only* pour éviter les décalages timezone
  // - jours_retard = max(0, floor((dateRef - dateLimite)/jour))
  // - dateRef = date_saisie si saisie, sinon aujourd'hui
  const calcRetard = (occ) => {
    const MS_PER_DAY = 1000 * 60 * 60 * 24
    const toDateOnly = (v) => {
      if (!v) return null
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return null
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    }

    const lim = toDateOnly(occ?.date_limite_saisie)
    if (!lim) return { jours: 0, enRetard: false, niveau: 'Pas retard', joursRestants: 0, label: '0j' }

    const ref = (occ?.val_indicateur != null && occ?.date_saisie)
      ? (toDateOnly(occ.date_saisie) || toDateOnly(new Date()))
      : toDateOnly(new Date())

    const diff = Math.floor((ref.getTime() - lim.getTime()) / MS_PER_DAY)
    if (diff > 0) {
      return { jours: diff, enRetard: true, niveau: 'Retard', joursRestants: 0, label: `${diff}j` }
    }

    const joursRestants = Math.abs(diff)
    return { jours: joursRestants, enRetard: false, niveau: 'Pas retard', joursRestants, label: `${joursRestants}j` }
  }
  const toFilterArray = (value) => Array.isArray(value) ? value.map(v => String(v)) : (value ? [String(value)] : [])
  const filterGroupesList = (list, ignoreFilter = '') => list.filter(g => {
    if (!hasGlobalIndicatorAccess()) {
      const groupCode = g?.code_groupe
      const hasVisibleIndicator = [...indicateurs, ...archivedIndicateurs].some(ind => getIndicatorGroupCodes(ind).includes(groupCode) && canViewInd(ind))
      if (!isGestionnaireGroupe(g) && !hasVisibleIndicator) return false
    }
    const gestionnairesSelection = toFilterArray(groupeFilters.gestionnaire)
    const groupManagers = (g.gestionnaires || (g.gestionnaire ? [g.gestionnaire] : [])).map(v => String(v))
    if (ignoreFilter !== 'gestionnaire' && gestionnairesSelection.length && !gestionnairesSelection.some(v => groupManagers.includes(String(v)))) return false
    if (groupeFilters.statut && g.statut !== groupeFilters.statut) return false
    if (groupeFilters.recherche && !g.code_groupe?.toLowerCase().includes(groupeFilters.recherche.toLowerCase()) && !g.libelle_groupe?.toLowerCase().includes(groupeFilters.recherche.toLowerCase())) return false
    return true
  })
  const filterIndicateursList = (list, ignoreFilter = '') => list.filter(i => {
    if (!canViewInd(i)) return false
    const structuresSelection = toFilterArray(indicateurFilters.structure)
    const groupesSelection = toFilterArray(indicateurFilters.groupe)
    const typesSelection = toFilterArray(indicateurFilters.type_indicateur)
    const responsablesSelection = toFilterArray(indicateurFilters.responsable)
    const indicatorGroups = [...(Array.isArray(i.groupes) ? i.groupes : []), i.code_groupe].filter(Boolean).map(v => String(v))
    if (ignoreFilter !== 'structure' && structuresSelection.length && !structuresSelection.includes(String(i.code_structure || ''))) return false
    if (ignoreFilter !== 'groupe' && groupesSelection.length && !groupesSelection.some(v => indicatorGroups.includes(String(v)))) return false
    if (ignoreFilter !== 'type_indicateur' && typesSelection.length && !typesSelection.includes(String(i.type_indicateur || ''))) return false
    if (ignoreFilter !== 'responsable' && responsablesSelection.length && !responsablesSelection.includes(String(i.responsable || ''))) return false
    if (indicateurFilters.statut && i.statut !== indicateurFilters.statut) return false
    if (indicateurFilters.recherche && !i.libelle_indicateur?.toLowerCase().includes(indicateurFilters.recherche.toLowerCase())) return false
    return true
  })
  const getOccIndicator = (o) => indicateurs.find(i => i.code_indicateur === o.code_indicateur) || archivedIndicateurs.find(i => i.code_indicateur === o.code_indicateur) || o.indicateur || null
  const getOccMeta = (o) => {
    const ind = getOccIndicator(o)
    return {
      ind,
      groupes: ind?.groupes || o.groupes || [],
      codeGroupe: ind?.code_groupe || o.code_groupe,
      structure: ind?.code_structure || o.code_structure,
      responsable: ind?.responsable || o.responsable,
      libelle: ind?.libelle_indicateur || o.libelle_indicateur,
      sens: ind?.sens || o.sens,
      codeIndicateur: String(o.code_indicateur || '')
    }
  }
  const filterOccurrencesList = (list, ignoreFilter = '') => list.filter(o => {
    if (!canViewOcc(o)) return false
    const meta = getOccMeta(o)
    const groupesSelection = toFilterArray(suiviFilters.groupe)
    const structuresSelection = toFilterArray(suiviFilters.structure)
    const indicateursSelection = toFilterArray(suiviFilters.indicateur)
    const responsablesSelection = toFilterArray(suiviFilters.responsable)
    const occurrenceGroupes = [...(Array.isArray(meta.groupes) ? meta.groupes : []), meta.codeGroupe].filter(Boolean).map(v => String(v))
    if (ignoreFilter !== 'groupe' && groupesSelection.length && !groupesSelection.some(g => occurrenceGroupes.includes(String(g)))) return false
    if (ignoreFilter !== 'structure' && structuresSelection.length && !structuresSelection.includes(String(meta.structure || ''))) return false
    if (ignoreFilter !== 'indicateur' && indicateursSelection.length && !indicateursSelection.includes(String(o.code_indicateur || ''))) return false
    if (ignoreFilter !== 'responsable' && responsablesSelection.length && !responsablesSelection.includes(String(meta.responsable || ''))) return false
    if (suiviFilters.statut) { const ret = calcRetard(o) || { enRetard: false }; if (suiviFilters.statut === 'Retard' && !ret.enRetard) return false; if (suiviFilters.statut === 'Pas retard' && ret.enRetard) return false }
    if (suiviFilters.date_debut && o.date_debut < suiviFilters.date_debut) return false
    if (suiviFilters.date_fin && o.date_fin > suiviFilters.date_fin) return false
    if (suiviFilters.atteinte) { const cibleVal = getCible(o, meta.ind || o); const att = getAtteinte(o.val_indicateur, cibleVal, meta.sens); if (suiviFilters.atteinte !== att.status) return false }
    if (suiviFilters.renseignement === 'oui' && o.val_indicateur == null) return false
    if (suiviFilters.renseignement === 'non' && o.val_indicateur != null) return false
    if (dashboardPendingOnly && o.val_indicateur != null) return false
    if (suiviFilters.recherche && !meta.libelle?.toLowerCase().includes(suiviFilters.recherche.toLowerCase())) return false
    return true
  })
  const sortOccurrencesList = (list) => [...list].sort((a, b) => {
    const aRenseigne = a.val_indicateur != null
    const bRenseigne = b.val_indicateur != null
    if (!aRenseigne && bRenseigne) return -1
    if (aRenseigne && !bRenseigne) return 1
    const retA = calcRetard(a)
    const retB = calcRetard(b)
    return (retB.jours || 0) - (retA.jours || 0)
  })
  const fGrp = filterGroupesList(groupes)
  const fArchivedGrp = filterGroupesList(archivedGroupes)
  const fInd = filterIndicateursList(indicateurs)
  const fArchivedInd = filterIndicateursList(archivedIndicateurs)
  const filteredOcc = filterOccurrencesList(occurrences)
  const filteredArchivedOcc = filterOccurrencesList(archivedSuiviOccurrences)
  
  // Trier les occurrences : 1) Non renseignées d'abord, 2) Par jours de retard décroissant
  const fOcc = sortOccurrencesList(filteredOcc)
  const fArchivedOcc = sortOccurrencesList(filteredArchivedOcc)


  const AttBadge = ({a}) => { if (!a || a.status === 'unknown') return <span className="text-gray-400">-</span>; const cls = { atteint: 'bg-green-100 text-green-700', proche: 'bg-orange-100 text-orange-700', non_atteint: 'bg-red-100 text-red-700' }; const Ic = { atteint: CheckCircle, proche: AlertTriangle, non_atteint: XCircle }[a.status]; return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${cls[a.status]}`}><Ic size={10}/>{a.pct?.toFixed(0) || 0}%</span> }
  const RetBadge = ({ret}) => { if (!ret) return <span className="text-gray-400">-</span>; return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${ret.enRetard ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{ret.label || `${ret.jours}j`}</span> }
  const StBadge = ({ret, s}) => { 
    // Accepte soit ret (objet avec enRetard) soit s (string statut)
    if (s) {
      const enRetard = s === 'Retard'
      return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${enRetard ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{enRetard ? 'Retard' : 'Pas retard'}</span>
    }
    if (!ret) return <span className="text-gray-400">-</span>
    return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${ret.enRetard ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{ret.enRetard ? 'Retard' : 'Pas retard'}</span> 
  }
  const getIndicatorValidationLabel = (occ) => {
    const status = String(occ?.validation_status || '').trim().toLowerCase()
    if (!occ || occ.val_indicateur == null || status === 'non renseigné') return ''
    if (status === 'validé' || status === 'valide') return 'Validé'
    if (status === 'rejetée' || status === 'rejetee') return 'Rejetée'
    return 'Attente de validation'
  }
  const getIndicatorManagerConfirmation = (occ) => {
    const status = String(occ?.validation_status || '').trim().toLowerCase()
    if (status === 'validé' || status === 'valide') return 'Oui'
    if (status === 'rejetée' || status === 'rejetee') return 'Non'
    return ''
  }
  const isIndicatorWaitingValidation = (occ) => String(getIndicatorValidationLabel(occ) || '').trim().toLowerCase() === 'attente de validation'
  const ValBadge = ({ value }) => {
    if (!value) return <span className="text-gray-400">-</span>
    const normalized = String(value).trim().toLowerCase()
    const cls = normalized === 'validé' || normalized === 'valide'
      ? 'bg-green-100 text-green-700'
      : normalized === 'rejetée' || normalized === 'rejetee'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700'
    return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${cls}`}>{value}</span>
  }
  const ConfBadge = ({ value }) => {
    if (!value) return <span className="text-gray-400">-</span>
    const normalized = String(value).trim().toLowerCase()
    const cls = normalized === 'oui' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${cls}`}>{value}</span>
  }
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '-'
  const getUserN = (u) => { const x = users.find(y => y.username === u); return x ? `${x.nom} ${x.prenoms}` : u }
  const getTypeL = (t) => typeOptions.find(o => o.value === t)?.label || t

  const gestOpts = users.map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms}` }))
  const allGroupes = [...groupes, ...archivedGroupes].filter((g, idx, arr) => g?.code_groupe && arr.findIndex(x => x?.code_groupe === g.code_groupe) === idx)
  const grpOpts = allGroupes.map(g => ({ value: g.code_groupe, label: g.libelle_groupe }))
  const structOpts = structures.map(s => ({ value: s.code_structure, label: `${s.code_structure} - ${s.libelle_structure}` }))
  const indOpts = indicateurs.map(i => ({ value: i.code_indicateur.toString(), label: i.libelle_indicateur }))
  const typeFilterOptions = typeOptions.map(t => ({ value: t.value, label: t.label }))
  const uniqOptions = (items) => items.filter((item, idx, arr) => item?.value && arr.findIndex(x => String(x.value) === String(item.value)) === idx)
  const buildGroupeOptions = (field, sourceList = groupes) => {
    const rows = filterGroupesList(sourceList, field)
    if (field === 'gestionnaire') {
      const codes = new Set()
      rows.forEach(g => (g.gestionnaires || (g.gestionnaire ? [g.gestionnaire] : [])).filter(Boolean).forEach(v => codes.add(String(v))))
      return gestOpts.filter(o => codes.has(String(o.value)))
    }
    return []
  }
  const groupeGestionnaireOpts = buildGroupeOptions('gestionnaire')
  const archivedGroupeGestionnaireOpts = buildGroupeOptions('gestionnaire', archivedGroupes)
  const buildIndicateurOptions = (field, sourceList = indicateurs) => {
    const rows = filterIndicateursList(sourceList, field)
    if (field === 'groupe') {
      const codes = new Set()
      rows.forEach(i => [...(Array.isArray(i.groupes) ? i.groupes : []), i.code_groupe].filter(Boolean).forEach(v => codes.add(String(v))))
      return grpOpts.filter(o => codes.has(String(o.value)))
    }
    if (field === 'structure') {
      const codes = new Set(rows.map(i => String(i.code_structure || '')).filter(Boolean))
      return structOpts.filter(o => codes.has(String(o.value)))
    }
    if (field === 'type_indicateur') {
      const codes = new Set(rows.map(i => String(i.type_indicateur || '')).filter(Boolean))
      return typeFilterOptions.filter(o => codes.has(String(o.value)))
    }
    if (field === 'responsable') {
      const codes = new Set(rows.map(i => String(i.responsable || '')).filter(Boolean))
      return gestOpts.filter(o => codes.has(String(o.value)))
    }
    return []
  }
  const indicateurGrpOpts = buildIndicateurOptions('groupe')
  const indicateurStructOpts = buildIndicateurOptions('structure')
  const indicateurTypeOpts = buildIndicateurOptions('type_indicateur')
  const indicateurRespOpts = buildIndicateurOptions('responsable')
  const archivedIndicateurGrpOpts = buildIndicateurOptions('groupe', archivedIndicateurs)
  const archivedIndicateurStructOpts = buildIndicateurOptions('structure', archivedIndicateurs)
  const archivedIndicateurTypeOpts = buildIndicateurOptions('type_indicateur', archivedIndicateurs)
  const archivedIndicateurRespOpts = buildIndicateurOptions('responsable', archivedIndicateurs)
  const buildSuiviOptions = (field, sourceList = occurrences) => {
    const rows = filterOccurrencesList(sourceList, field)
    if (field === 'groupe') {
      const codes = new Set()
      rows.forEach(o => { const meta = getOccMeta(o); [...(Array.isArray(meta.groupes) ? meta.groupes : []), meta.codeGroupe].filter(Boolean).forEach(v => codes.add(String(v))) })
      return grpOpts.filter(o => codes.has(String(o.value)))
    }
    if (field === 'structure') {
      const codes = new Set(rows.map(o => String(getOccMeta(o).structure || '')).filter(Boolean))
      return structOpts.filter(o => codes.has(String(o.value)))
    }
    if (field === 'indicateur') {
      const codes = new Set(rows.map(o => String(o.code_indicateur || '')).filter(Boolean))
      return uniqOptions([...indOpts, ...rows.map(o => ({ value: String(o.code_indicateur), label: getOccMeta(o).libelle || String(o.code_indicateur) }))]).filter(o => codes.has(String(o.value)))
    }
    if (field === 'responsable') {
      const codes = new Set(rows.map(o => String(getOccMeta(o).responsable || '')).filter(Boolean))
      return gestOpts.filter(o => codes.has(String(o.value)))
    }
    return []
  }
  const suiviGrpOpts = buildSuiviOptions('groupe')
  const suiviStructOpts = buildSuiviOptions('structure')
  const suiviIndOpts = buildSuiviOptions('indicateur')
  const suiviGestOpts = buildSuiviOptions('responsable')
  const archivedSuiviGrpOpts = buildSuiviOptions('groupe', archivedSuiviOccurrences)
  const archivedSuiviStructOpts = buildSuiviOptions('structure', archivedSuiviOccurrences)
  const archivedSuiviIndOpts = buildSuiviOptions('indicateur', archivedSuiviOccurrences)
  const archivedSuiviGestOpts = buildSuiviOptions('responsable', archivedSuiviOccurrences)
  const yrs = Array.from({ length: 101 }, (_, i) => 2000 + i)
  const hasR = indicateurForm.groupes?.includes('Risque')

  const handleSendIndicatorReminder = async (occurrence) => {
    if (!canTriggerIndicatorReminder(occurrence)) return
    setAlertModal({
      isOpen: true,
      type: 'confirm',
      message: 'Envoyer un mail de relance pour cet indicateur ?',
      onConfirm: async () => {
        try {
          const res = await blockingFetch('/api/emailing/item-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'indicator', occurrenceId: occurrence.id })
          })
          const data = await res.json()
          if (res.ok) showAlert('success', data.message || 'Mail de relance envoyé avec succès.')
          else showAlert('error', data.error || "Erreur lors de l'envoi du mail de relance")
        } catch (error) {
          console.error('Erreur relance indicateur:', error)
          showAlert('error', "Erreur lors de l'envoi du mail de relance")
        }
      }
    })
  }

  // Fonctions d'export Excel
  const exportGroupesToExcel = () => {
    const data = fGrp.map(g => ({
      'Code': g.code_groupe,
      'Libellé': g.libelle_groupe,
      'Gestionnaire(s)': (g.gestionnaires || [g.gestionnaire]).map(u => getUserN(u)).join(', '),
      'Commentaire': g.commentaire || '',
      'Statut': g.statut
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Groupes')
    XLSX.writeFile(wb, `groupes_indicateurs_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportIndicateursToExcel = () => {
    const data = fInd.map(ind => ({
      'Libellé': ind.libelle_indicateur,
      'Groupe(s)': (ind.groupes || [ind.code_groupe]).map(c => allGroupes.find(g => g.code_groupe === c)?.libelle_groupe || c).join(', '),
      'Structure': ind.code_structure,
      'Périodicité': ind.periodicite || '-',
      'Type': ind.type_indicateur === 'TxCalcule' ? 'Tx%' : ind.type_indicateur,
      'Sens': ind.sens,
      'Statut': ind.statut
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Indicateurs')
    XLSX.writeFile(wb, `indicateurs_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportSuiviToExcel = () => {
    const data = fOcc.map(occ => {
      const ind = indicateurs.find(i => i.code_indicateur === occ.code_indicateur)
      const cibleVal = getCible(occ, ind)
      const ret = calcRetard(occ)
      const att = getAtteinte(occ.val_indicateur, cibleVal, ind?.sens)
      const isTx = ind?.type_indicateur === 'Taux' || ind?.type_indicateur === 'TxCalcule'
      return {
        'Indicateur': ind?.libelle_indicateur || '-',
        'Période': occ.periode || 'Perso.',
        'Début': fmtDate(occ.date_debut),
        'Fin': fmtDate(occ.date_fin),
        'Limite': fmtDate(occ.date_limite_saisie),
        'Valeur': occ.val_indicateur != null ? (isTx ? `${occ.val_indicateur.toFixed(1)}%` : occ.val_indicateur) : '-',
        'Cible': cibleVal != null ? (isTx ? `${cibleVal}%` : cibleVal) : '-',
        'Atteinte': att.status !== 'unknown' ? `${att.pct?.toFixed(0)}%` : '-',
        'Retard (j)': ret.jours,
        'Statut': occ.statut || (ret.enRetard ? 'Retard' : 'Pas retard') || '-',
        'Validation gestionnaire': occ.validation_status || '-'
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Suivi')
    XLSX.writeFile(wb, `suivi_indicateurs_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleOpenArchivedGroupes = async () => {
    try {
      const rr = await blockingFetch('/api/archive?type=groupe_indicateurs')
      const jj = rr.ok ? await rr.json() : []
      setArchivedGroupes(jj || [])
      setShowArchivedGroupesModal(true)
    } catch (e) {
      console.error('Erreur chargement groupes archivés:', e)
      setArchivedGroupes([])
      setShowArchivedGroupesModal(true)
    }
  }

  const handleOpenArchivedIndicateurs = async () => {
    try {
      const rr = await blockingFetch('/api/archive?type=indicateur')
      const jj = rr.ok ? await rr.json() : []
      setArchivedIndicateurs(jj || [])
      setShowArchivedIndicateursModal(true)
    } catch (e) {
      console.error('Erreur chargement indicateurs archivés:', e)
      setArchivedIndicateurs([])
      setShowArchivedIndicateursModal(true)
    }
  }

  const handleOpenArchivedSuivi = async () => {
    try {
      const rr = await blockingFetch('/api/archive?type=suivi_indicateur')
      const jj = rr.ok ? await rr.json() : []
      setArchivedSuiviOccurrences(jj || [])
      setShowArchivedSuiviModal(true)
    } catch (e) {
      console.error('Erreur chargement occurrences archivées:', e)
      setArchivedSuiviOccurrences([])
      setShowArchivedSuiviModal(true)
    }
  }


  const getSeuilH = (n, s) => {
    // Nomenclature: F1=Très rare, F2=Rare, F3=Fréquent, F4=Très fréquent
    if (s === 'Positif') {
      // Sens positif: plus la valeur est basse, plus c'est fréquent
      if (n === 1) return 'Valeur < S1 → Très fréquent (F4)'
      if (n === 2) return 'S1 ≤ Valeur < S2 → Fréquent (F3)'
      return 'S2 ≤ Valeur < S3 → Rare (F2), ≥ S3 → Très rare (F1)'
    } else {
      // Sens négatif: plus la valeur est basse, plus c'est rare
      if (n === 1) return 'Valeur ≤ S1 → Très rare (F1)'
      if (n === 2) return 'S1 < Valeur ≤ S2 → Rare (F2)'
      return 'S2 < Valeur ≤ S3 → Fréquent (F3), > S3 → Très fréquent (F4)'
    }
  }

  const PeriodeSel = ({ form, setForm, per, dis }) => {
    if (per === 'Personnalise') return <div className="grid grid-cols-2 gap-3"><FormInput label="Début *" type="date" value={form.date_debut||''} onChange={v=>setForm({...form,date_debut:v})} disabled={dis}/><FormInput label="Fin *" type="date" value={form.date_fin||''} onChange={v=>setForm({...form,date_fin:v})} disabled={dis}/></div>
    if (per === 'Annuel') return <div><label className="block text-xs font-medium text-gray-700 mb-1">Année *</label><select value={form.periode||''} onChange={e=>handlePeriode(form,setForm,per,e.target.value,null)} disabled={dis} className={`w-full px-2 py-1.5 text-xs border rounded ${dis?'bg-gray-100':''}`}><option value="">...</option>{yrs.map(y=><option key={y} value={`${y}`}>{y}</option>)}</select></div>
    if (per === 'Journalier') return <FormInput label="Date *" type="date" value={form.date_debut||''} onChange={v=>setForm({...form,periode:v,date_debut:v,date_fin:v})} disabled={dis}/>
    const ps = genPeriodes(per, form.annee)
    return <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-700 mb-1">Année</label><select value={form.annee||''} onChange={e=>setForm({...form,annee:parseInt(e.target.value),periode:''})} disabled={dis} className={`w-full px-2 py-1.5 text-xs border rounded ${dis?'bg-gray-100':''}`}><option value="">...</option>{yrs.map(y=><option key={y} value={y}>{y}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-700 mb-1">Période</label><select value={form.periode||''} onChange={e=>handlePeriode(form,setForm,per,e.target.value,form.annee)} disabled={dis||!form.annee} className={`w-full px-2 py-1.5 text-xs border rounded ${dis||!form.annee?'bg-gray-100':''}`}><option value="">...</option>{ps.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></div></div>
  }

  return (
    <div className="mobile-subrubric-layout flex h-[calc(100vh-140px)]">
      {actionInProgress && (
        <div className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-[1px] flex items-center justify-center cursor-wait" aria-live="polite" aria-busy="true">
          <div className="w-[min(420px,calc(100vw-2rem))] rounded-2xl bg-white shadow-2xl p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#1a365d]" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Traitement en cours...</p>
                <p className="text-xs text-gray-500">Veuillez patienter jusqu'au message de succès ou d'erreur.</p>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#1a365d] to-[#2c5282] animate-pulse" />
            </div>
          </div>
        </div>
      )}
      <div className="mobile-subrubric-sidebar w-56 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto"><div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3"><div className="mobile-subrubric-sidebar-grid">{subPages.map(p=><SidebarButton key={p.key} icon={p.icon} label={p.label} active={activeTab===p.key} onClick={()=>setActiveTab(p.key)}/>)}</div></div></div>
      <div className="mobile-subrubric-content flex-1 min-w-0 overflow-auto p-1">
        {activeTab==='groupes'&&<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4 mobile-header-stack"><h2 className="text-lg font-semibold text-gray-800">Groupes</h2><div className="flex gap-2 mobile-header-actions"><Button size="sm" variant="secondary" onClick={handleOpenArchivedGroupes}><Archive size={14} className="mr-1"/>Archives</Button>{canCreateGroupe()&&<Button size="sm" onClick={()=>handleOpenGrpModal()}><Plus size={14} className="mr-1"/>Nouveau</Button>}<Button size="sm" variant="secondary" onClick={exportGroupesToExcel}><Download size={14} className="mr-1"/>Excel</Button></div></div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4"><div className="flex gap-2 items-end flex-wrap"><div className="w-48"><SearchableFilterMultiSelect label="Gestionnaire" value={groupeFilters.gestionnaire} onChange={v=>setGroupeFilters({...groupeFilters,gestionnaire:v})} options={groupeGestionnaireOpts} size="sm"/></div><div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={groupeFilters.statut} onChange={e=>setGroupeFilters({...groupeFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div><div className="flex-1 min-w-[120px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={groupeFilters.recherche} onChange={e=>setGroupeFilters({...groupeFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><button onClick={()=>setGroupeFilters({gestionnaire:[],statut:'',recherche:''})} className="p-1.5 hover:bg-gray-100 rounded border"><RotateCcw size={14} className="text-gray-600"/></button></div></div>
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Code</th><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-left text-white">Gestionnaire(s)</th><th className="px-2 py-2 text-left text-white">Commentaire</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{width:'80px'}}>Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading?<tr><td colSpan={6} className="text-center py-8 text-gray-500">Chargement...</td></tr>:fGrp.length===0?<tr><td colSpan={6} className="text-center py-8 text-gray-500">Aucun</td></tr>:fGrp.map(g=>{const isRisqueGrp = g.code_groupe === 'RISQUE' || g.code_groupe === 'Risque'; return <tr key={g.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 font-mono text-blue-600">{g.code_groupe}</td><td className="px-2 py-1.5">{g.libelle_groupe}</td><td className="px-2 py-1.5 text-gray-600">{(g.gestionnaires||[g.gestionnaire]).map(u=>getUserN(u)).join(', ')}</td><td className="px-2 py-1.5 text-gray-500 max-w-xs truncate">{g.commentaire}</td><td className="px-2 py-1.5 text-center"><StatusBadge status={g.statut}/></td><td className="px-2 py-1.5 text-center">{isRisqueGrp ? <span className="text-gray-400 text-[9px] italic" title="Gestionnaires gérés dans 'Gestion des risques'">🔒 Géré ailleurs</span> : <div className="flex justify-center gap-1"><button onClick={()=>handleOpenGrpModal(g)} className={`p-1 rounded ${canEditGroupe(g)?'text-blue-600 hover:bg-blue-100':'text-gray-400'}`}>{canEditGroupe(g)?<Edit size={12}/>:<Eye size={12}/>}</button>{canEditGroupe(g)&&!g.is_default&&<button onClick={()=>handleArchiveItem('groupe_indicateurs', g, g.libelle_groupe)} className="p-1 text-amber-600 hover:bg-amber-100 rounded" title="Archiver"><Archive size={12}/></button>}{canDelGroupe(g)&&!g.is_default&&<button onClick={()=>handleDelGrp(g)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}</div>}</td></tr>})}</tbody></table></div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fGrp.length}</div>
        </div>}

        {activeTab==='indicateurs'&&<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3 mb-4 mobile-header-stack md:flex-row md:items-center md:justify-between"><h2 className="text-lg font-semibold text-gray-800">Indicateurs</h2><div className="mobile-inline-scroll flex items-center gap-2 md:flex-nowrap md:justify-end"><Button size="sm" variant="secondary" onClick={handleOpenArchivedIndicateurs}><Archive size={14} className="mr-1"/>Archives</Button>{(isAdmin()||fGrp.some(g=>isGest(g)))&&<Button size="sm" onClick={()=>handleOpenIndModal()}><Plus size={14} className="mr-1"/>Nouveau</Button>}<Button size="sm" variant="secondary" onClick={exportIndicateursToExcel}><Download size={14} className="mr-1"/>Excel</Button></div></div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4"><div className="flex gap-2 items-end flex-wrap"><div className="w-36"><SearchableFilterMultiSelect label="Groupe" value={indicateurFilters.groupe} onChange={v=>setIndicateurFilters({...indicateurFilters,groupe:v})} options={indicateurGrpOpts} size="sm"/></div><div className="w-36"><SearchableFilterMultiSelect label="Structure" value={indicateurFilters.structure} onChange={v=>setIndicateurFilters({...indicateurFilters,structure:v})} options={indicateurStructOpts} size="sm"/></div><div className="w-28"><SearchableFilterMultiSelect label="Type" value={indicateurFilters.type_indicateur} onChange={v=>setIndicateurFilters({...indicateurFilters,type_indicateur:v})} options={indicateurTypeOpts} size="sm"/></div><div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={indicateurFilters.statut} onChange={e=>setIndicateurFilters({...indicateurFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div><div className="w-40"><SearchableFilterMultiSelect label="Responsable" value={indicateurFilters.responsable} onChange={v=>setIndicateurFilters({...indicateurFilters,responsable:v})} options={indicateurRespOpts} size="sm"/></div><div className="flex-1 min-w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={indicateurFilters.recherche} onChange={e=>setIndicateurFilters({...indicateurFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><button onClick={()=>setIndicateurFilters({structure:[],groupe:[],type_indicateur:[],statut:'',responsable:[],recherche:''})} className="p-1.5 hover:bg-gray-100 rounded border"><RotateCcw size={14} className="text-gray-600"/></button></div></div>
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white" style={{minWidth:'180px'}}>Libellé</th><th className="px-2 py-2 text-left text-white">Groupe(s)</th><th className="px-2 py-2 text-left text-white">Structure</th><th className="px-2 py-2 text-center text-white">Périod.</th><th className="px-2 py-2 text-center text-white">Type</th><th className="px-2 py-2 text-center text-white">Sens</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{width:'100px'}}>Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading?<tr><td colSpan={8} className="text-center py-8 text-gray-500">Chargement...</td></tr>:fInd.length===0?<tr><td colSpan={8} className="text-center py-8 text-gray-500">Aucun</td></tr>:fInd.map(ind=>{const ce=canEditInd(ind);const ir=isRisque(ind);const gn=(ind.groupes||[ind.code_groupe]).map(c=>allGroupes.find(g=>g.code_groupe===c)?.libelle_groupe||c).join(', ');return<tr key={ind.id} className="hover:bg-gray-50"><td className="px-2 py-1.5"><span className="line-clamp-2" title={ind.libelle_indicateur}>{ind.libelle_indicateur}</span></td><td className="px-2 py-1.5 text-gray-600">{gn}</td><td className="px-2 py-1.5 text-gray-600">{ind.code_structure}</td><td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100">{ind.periodicite||'-'}</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 text-[9px] rounded ${ind.type_indicateur==='Nombre'?'bg-cyan-100 text-cyan-700':'bg-purple-100 text-purple-700'}`}>{ind.type_indicateur==='TxCalcule'?'Tx%':ind.type_indicateur}</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 text-[9px] rounded ${ind.sens==='Positif'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>{ind.sens}</span></td><td className="px-2 py-1.5 text-center"><StatusBadge status={ind.statut}/></td><td className="px-2 py-1.5 text-center"><div className="flex justify-center gap-1"><button onClick={()=>handleOpenIndModal(ind)} className={`p-1 rounded ${ce?'text-blue-600 hover:bg-blue-100':'text-gray-400'}`}>{ce?<Edit size={12}/>:<Eye size={12}/>}</button>{ce&&!ir&&<button onClick={()=>handleArchiveItem('indicateur', ind, ind.libelle_indicateur)} className="p-1 text-amber-600 hover:bg-amber-100 rounded" title="Archiver"><Archive size={12}/></button>}{ce&&<button onClick={()=>handleDelInd(ind)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}{ind.statut==='Actif'&&ce&&!ir&&!(ind.groupes||[ind.code_groupe]).some(c => (allGroupes.find(g => g.code_groupe===c)?.statut || 'Actif') === 'Inactif')&&<button onClick={()=>handleOpenCreateOcc(ind)} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Ouvrir"><PlayCircle size={12}/></button>}<button onClick={()=>handleShowOccList(ind)} className="p-1 text-purple-600 hover:bg-purple-100 rounded" title="Liste"><List size={12}/></button></div></td></tr>})}</tbody></table></div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fInd.length}</div>
        </div>}

        {activeTab==='suivi'&&<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3 mb-4 mobile-header-stack md:flex-row md:items-center md:justify-between"><h2 className="text-lg font-semibold text-gray-800">Suivi</h2><div className="mobile-inline-scroll flex items-center gap-2 md:flex-nowrap md:justify-end"><Button size="sm" variant="secondary" onClick={handleOpenArchivedSuivi}><Archive size={14} className="mr-1"/>Archives</Button><Button size="sm" variant="secondary" onClick={exportSuiviToExcel}><Download size={14} className="mr-1"/>Excel</Button></div></div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="w-32"><SearchableFilterMultiSelect label="Groupe" value={suiviFilters.groupe} onChange={v=>setSuiviFilters({...suiviFilters,groupe:v})} options={suiviGrpOpts} size="sm"/></div>
              <div className="w-32"><SearchableFilterMultiSelect label="Structure" value={suiviFilters.structure} onChange={v=>setSuiviFilters({...suiviFilters,structure:v})} options={suiviStructOpts} size="sm"/></div>
              <div className="w-36"><SearchableFilterMultiSelect label="Indicateur" value={suiviFilters.indicateur} onChange={v=>setSuiviFilters({...suiviFilters,indicateur:v})} options={suiviIndOpts} size="sm"/></div>
              <div className="w-36"><SearchableFilterMultiSelect label="Responsable" value={suiviFilters.responsable} onChange={v=>setSuiviFilters({...suiviFilters,responsable:v})} options={suiviGestOpts} size="sm"/></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={suiviFilters.statut} onChange={e=>setSuiviFilters({...suiviFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Retard">Retard</option><option value="Pas retard">Pas retard</option></select></div>
              <div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Atteinte</label><select value={suiviFilters.atteinte} onChange={e=>setSuiviFilters({...suiviFilters,atteinte:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Toutes</option><option value="atteint">≥100%</option><option value="proche">≥90%</option><option value="non_atteint">&lt;90%</option></select></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Renseign.</label><select value={suiviFilters.renseignement} onChange={e=>setSuiviFilters({...suiviFilters,renseignement:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="oui">Oui</option><option value="non">Non</option></select></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Début≥</label><input type="date" value={suiviFilters.date_debut} onChange={e=>setSuiviFilters({...suiviFilters,date_debut:e.target.value})} className="w-full px-1 py-1.5 text-xs border rounded"/></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Fin≤</label><input type="date" value={suiviFilters.date_fin} onChange={e=>setSuiviFilters({...suiviFilters,date_fin:e.target.value})} className="w-full px-1 py-1.5 text-xs border rounded"/></div>
              <div className="flex-1 min-w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={suiviFilters.recherche} onChange={e=>setSuiviFilters({...suiviFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div>
              <button onClick={()=>setSuiviFilters(emptySuiviFilters)} className="p-1.5 hover:bg-gray-100 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
              
            </div>
          </div>
          <div className="relative">{canScrollLeft&&<button onClick={()=>scrollTable('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow rounded-full p-1.5 border"><ChevronLeft size={18}/></button>}{canScrollRight&&<button onClick={()=>scrollTable('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow rounded-full p-1.5 border"><ChevronRight size={18}/></button>}<div ref={tableContainerRef} onScroll={checkScroll} className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]" style={{minWidth:'1230px'}}><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-20"><tr><th className="px-2 py-2 text-left text-white sticky left-0 bg-[#1a365d] z-30" style={{minWidth:'350px', width:'350px'}}>Libellé</th><th className="px-2 py-2 text-center text-white">Période</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Limite</th><th className="px-2 py-2 text-center text-white">Val</th><th className="px-2 py-2 text-center text-white">Cible</th><th className="px-2 py-2 text-center text-white">Att.</th><th className="px-2 py-2 text-center text-white">Saisie</th><th className="px-2 py-2 text-center text-white">Ret.</th><th className="px-2 py-2 text-center text-white">St.</th><th className="px-2 py-2 text-center text-white">St. val.</th><th className="px-2 py-2 text-center text-white whitespace-nowrap" style={{minWidth:'120px'}}>Gest. Conf.</th><th className="px-2 py-2 text-center text-white sticky right-0 bg-[#1a365d] z-30" style={{width:'50px'}}>Act</th></tr></thead><tbody className="divide-y divide-gray-100">{loading?<tr><td colSpan={14} className="text-center py-8 text-gray-500">Chargement...</td></tr>:fOcc.length===0?<tr><td colSpan={14} className="text-center py-8 text-gray-500">Aucune</td></tr>:fOcc.map(occ=>{const ind=indicateurs.find(i=>i.code_indicateur===occ.code_indicateur);const ce=canEditOcc(occ,ind);const cs=canSaisir(occ,ind);const validatedOcc=isIndicatorValidated(occ);const cibleVal=getCible(occ,ind);const att=getAtteinte(occ.val_indicateur,cibleVal,ind?.sens);const ret=calcRetard(occ);const isTx=ind?.type_indicateur==='Taux'||ind?.type_indicateur==='TxCalcule';return<tr key={occ.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 sticky left-0 bg-white z-10" style={{width:'350px', minWidth:'350px', maxWidth:'350px'}} title={occ.libelle_indicateur || ind?.libelle_indicateur}><span className="line-clamp-2 whitespace-normal leading-snug">{occ.libelle_indicateur || ind?.libelle_indicateur || '-'}</span></td><td className="px-2 py-1.5 text-center">{occ.periode||'-'}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_debut)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_fin)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_limite_saisie)}</td><td className="px-2 py-1.5 text-center font-medium">{occ.val_indicateur!=null?(isTx?`${parseFloat(occ.val_indicateur).toFixed(1)}%`:occ.val_indicateur):'-'}</td><td className="px-2 py-1.5 text-center">{cibleVal!=null?(isTx?`${cibleVal}%`:cibleVal):'-'}</td><td className="px-2 py-1.5 text-center"><AttBadge a={att}/></td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_saisie)}</td><td className="px-2 py-1.5 text-center"><RetBadge ret={ret}/></td><td className="px-2 py-1.5 text-center"><StBadge ret={ret}/></td><td className="px-2 py-1.5 text-center"><ValBadge value={getIndicatorValidationLabel(occ)}/></td><td className="px-2 py-1.5 text-center">{canManageIndicatorWorkflow(occ, ind) && occ.val_indicateur != null && isIndicatorWaitingValidation(occ) ? <button onClick={()=>openIndicatorValidationModal(occ, ind)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed" title="Ouvrir le formulaire de validation"><CheckCircle size={12}/>Valider</button> : isIndicatorValidated(occ) ? <div className="flex items-center justify-center gap-1"><span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap bg-green-100 text-green-700"><CheckCircle size={11}/>Oui</span>{canManageIndicatorWorkflow(occ, ind) && <button onClick={()=>handleUndoIndicatorValidation(occ)} className="inline-flex items-center justify-center p-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100" title="Annuler la validation"><RotateCcw size={11}/></button>}</div> : <ConfBadge value={getIndicatorManagerConfirmation(occ)}/>}</td><td className="px-2 py-1.5 text-center sticky right-0 bg-white z-10"><div className="flex justify-center gap-1">{((ce||cs) && !validatedOcc)?<button onClick={()=>handleOpenOccModal(occ)} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><Edit size={12}/></button>:<button onClick={()=>handleOpenOccModal(occ)} className="p-1 text-gray-400 rounded"><Eye size={12}/></button>}{canTriggerIndicatorReminder(occ)&&<button onClick={()=>handleSendIndicatorReminder(occ)} className="p-1 text-amber-600 hover:bg-amber-100 rounded" title="Envoyer un mail de relance"><Send size={12}/></button>}{ce&&!isRisque(ind)&&<button onClick={()=>handleArchiveItem('suivi_indicateur', occ, `${ind?.libelle_indicateur||'Occurrence'} - ${occ.periode||'Perso.'}`)} className="p-1 text-amber-600 hover:bg-amber-100 rounded" title="Archiver"><Archive size={12}/></button>}{ce&&<button onClick={()=>handleDelOcc(occ)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}</div></td></tr>})}</tbody></table></div></div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fOcc.length}</div>
        </div>}
      </div>

      

      {/* Modal Groupes archivés */}
      <Modal isOpen={showArchivedGroupesModal} onClose={()=>setShowArchivedGroupesModal(false)} title="Archives - Groupes" size="xl">
        <div className="bg-gray-50 rounded-lg p-3 mb-4"><div className="flex gap-2 items-end flex-wrap"><div className="w-48"><SearchableFilterMultiSelect label="Gestionnaire" value={groupeFilters.gestionnaire} onChange={v=>setGroupeFilters({...groupeFilters,gestionnaire:v})} options={archivedGroupeGestionnaireOpts} size="sm"/></div><div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={groupeFilters.statut} onChange={e=>setGroupeFilters({...groupeFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div><div className="flex-1 min-w-[120px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={groupeFilters.recherche} onChange={e=>setGroupeFilters({...groupeFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><button onClick={()=>setGroupeFilters({gestionnaire:[],statut:'',recherche:''})} className="p-1.5 hover:bg-gray-100 rounded border"><RotateCcw size={14} className="text-gray-600"/></button></div></div>
        <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Code</th><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-left text-white">Gestionnaire(s)</th><th className="px-2 py-2 text-left text-white">Commentaire</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{width:'80px'}}>Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{fArchivedGrp.length===0?<tr><td colSpan={6} className="text-center py-8 text-gray-500">Aucun</td></tr>:fArchivedGrp.map(g=><tr key={g.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 font-mono text-blue-600">{g.code_groupe}</td><td className="px-2 py-1.5">{g.libelle_groupe}</td><td className="px-2 py-1.5 text-gray-600">{(g.gestionnaires||[g.gestionnaire]).filter(Boolean).map(u=>getUserN(u)).join(', ')}</td><td className="px-2 py-1.5 text-gray-500 max-w-xs truncate">{g.commentaire}</td><td className="px-2 py-1.5 text-center"><StatusBadge status={g.statut}/></td><td className="px-2 py-1.5 text-center"><div className="flex justify-center gap-1"><button onClick={()=>handleDeleteArchivedItem('groupe_indicateurs', g, g.libelle_groupe)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Supprimer définitivement"><Trash2 size={12}/></button></div></td></tr>)}</tbody></table></div>
        <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fArchivedGrp.length}</div>
      </Modal>

      {/* Modal Indicateurs archivés */}
      <Modal isOpen={showArchivedIndicateursModal} onClose={()=>setShowArchivedIndicateursModal(false)} title="Archives - Indicateurs" size="xl">
        <div className="bg-gray-50 rounded-lg p-3 mb-4"><div className="flex gap-2 items-end flex-wrap"><div className="w-48"><SearchableFilterMultiSelect label="Structure" value={indicateurFilters.structure} onChange={v=>setIndicateurFilters({...indicateurFilters,structure:v})} options={archivedIndicateurStructOpts} size="sm"/></div><div className="w-48"><SearchableFilterMultiSelect label="Groupe" value={indicateurFilters.groupe} onChange={v=>setIndicateurFilters({...indicateurFilters,groupe:v})} options={archivedIndicateurGrpOpts} size="sm"/></div><div className="w-32"><SearchableFilterMultiSelect label="Type" value={indicateurFilters.type_indicateur} onChange={v=>setIndicateurFilters({...indicateurFilters,type_indicateur:v})} options={archivedIndicateurTypeOpts} size="sm"/></div><div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={indicateurFilters.statut} onChange={e=>setIndicateurFilters({...indicateurFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div><div className="w-48"><SearchableFilterMultiSelect label="Responsable" value={indicateurFilters.responsable} onChange={v=>setIndicateurFilters({...indicateurFilters,responsable:v})} options={archivedIndicateurRespOpts} size="sm"/></div><div className="flex-1 min-w-[120px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={indicateurFilters.recherche} onChange={e=>setIndicateurFilters({...indicateurFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><button onClick={()=>setIndicateurFilters({structure:[],groupe:[],type_indicateur:[],statut:'',responsable:[],recherche:''})} className="p-1.5 hover:bg-gray-100 rounded border"><RotateCcw size={14} className="text-gray-600"/></button></div></div>
        <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white" style={{minWidth:'180px'}}>Libellé</th><th className="px-2 py-2 text-left text-white">Groupe(s)</th><th className="px-2 py-2 text-left text-white">Structure</th><th className="px-2 py-2 text-center text-white">Périod.</th><th className="px-2 py-2 text-center text-white">Type</th><th className="px-2 py-2 text-center text-white">Sens</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{width:'100px'}}>Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{fArchivedInd.length===0?<tr><td colSpan={8} className="text-center py-8 text-gray-500">Aucun</td></tr>:fArchivedInd.map(ind=>{const gn=(ind.groupes||[ind.code_groupe]).map(c=>allGroupes.find(g=>g.code_groupe===c)?.libelle_groupe||c).join(', ');return<tr key={ind.id} className="hover:bg-gray-50"><td className="px-2 py-1.5"><span className="line-clamp-2" title={ind.libelle_indicateur}>{ind.libelle_indicateur}</span></td><td className="px-2 py-1.5 text-gray-600">{gn}</td><td className="px-2 py-1.5 text-gray-600">{ind.code_structure}</td><td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100">{ind.periodicite||'-'}</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 text-[9px] rounded ${ind.type_indicateur==='Nombre'?'bg-cyan-100 text-cyan-700':'bg-purple-100 text-purple-700'}`}>{ind.type_indicateur==='TxCalcule'?'Tx%':ind.type_indicateur}</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 text-[9px] rounded ${ind.sens==='Positif'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>{ind.sens}</span></td><td className="px-2 py-1.5 text-center"><StatusBadge status={ind.statut}/></td><td className="px-2 py-1.5 text-center"><div className="flex justify-center gap-1"><button onClick={()=>handleDeleteArchivedItem('indicateur', ind, ind.libelle_indicateur)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Supprimer définitivement"><Trash2 size={12}/></button></div></td></tr>})}</tbody></table></div>
        <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fArchivedInd.length}</div>
      </Modal>

      {/* Modal Occurrences archivées */}
      <Modal isOpen={showArchivedSuiviModal} onClose={()=>setShowArchivedSuiviModal(false)} title="Archives - Suivi" size="xl">
        <div className="bg-gray-50 rounded-lg p-3 mb-4"><div className="flex gap-2 items-end flex-wrap"><div className="w-48"><SearchableFilterMultiSelect label="Groupe" value={suiviFilters.groupe} onChange={v=>setSuiviFilters({...suiviFilters,groupe:v})} options={archivedSuiviGrpOpts} size="sm"/></div><div className="w-48"><SearchableFilterMultiSelect label="Structure" value={suiviFilters.structure} onChange={v=>setSuiviFilters({...suiviFilters,structure:v})} options={archivedSuiviStructOpts} size="sm"/></div><div className="w-52"><SearchableFilterMultiSelect label="Indicateur" value={suiviFilters.indicateur} onChange={v=>setSuiviFilters({...suiviFilters,indicateur:v})} options={archivedSuiviIndOpts} size="sm"/></div><div className="w-48"><SearchableFilterMultiSelect label="Responsable" value={suiviFilters.responsable} onChange={v=>setSuiviFilters({...suiviFilters,responsable:v})} options={archivedSuiviGestOpts} size="sm"/></div><div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={suiviFilters.statut} onChange={e=>setSuiviFilters({...suiviFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Retard">Retard</option><option value="Pas retard">Pas retard</option></select></div><div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Atteinte</label><select value={suiviFilters.atteinte} onChange={e=>setSuiviFilters({...suiviFilters,atteinte:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Toutes</option><option value="atteint">Atteint</option><option value="proche">Proche</option><option value="non_atteint">Non atteint</option></select></div><div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Début ≥</label><input type="date" value={suiviFilters.date_debut} onChange={e=>setSuiviFilters({...suiviFilters,date_debut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Fin ≤</label><input type="date" value={suiviFilters.date_fin} onChange={e=>setSuiviFilters({...suiviFilters,date_fin:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Renseigné</label><select value={suiviFilters.renseignement} onChange={e=>setSuiviFilters({...suiviFilters,renseignement:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="oui">Oui</option><option value="non">Non</option></select></div><div className="flex-1 min-w-[120px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={suiviFilters.recherche} onChange={e=>setSuiviFilters({...suiviFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><button onClick={()=>setSuiviFilters(emptySuiviFilters)} className="p-1.5 hover:bg-gray-100 rounded border"><RotateCcw size={14} className="text-gray-600"/></button></div>{dashboardPendingOnly && <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-800">Affichage direct des occurrences d'indicateurs en attente de saisie.</div>}</div>
        <div className="relative"><div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]" style={{minWidth:'1230px'}}><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-20"><tr><th className="px-2 py-2 text-left text-white sticky left-0 bg-[#1a365d] z-30" style={{minWidth:'350px', width:'350px'}}>Libellé</th><th className="px-2 py-2 text-center text-white">Période</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Limite</th><th className="px-2 py-2 text-center text-white">Val</th><th className="px-2 py-2 text-center text-white">Cible</th><th className="px-2 py-2 text-center text-white">Att.</th><th className="px-2 py-2 text-center text-white">Saisie</th><th className="px-2 py-2 text-center text-white">Ret.</th><th className="px-2 py-2 text-center text-white">St.</th><th className="px-2 py-2 text-center text-white">St. val.</th><th className="px-2 py-2 text-center text-white">Gest. Conf.</th><th className="px-2 py-2 text-center text-white sticky right-0 bg-[#1a365d] z-30" style={{width:'50px'}}>Act</th></tr></thead><tbody className="divide-y divide-gray-100">{fArchivedOcc.length===0?<tr><td colSpan={14} className="text-center py-8 text-gray-500">Aucune</td></tr>:fArchivedOcc.map(occ=>{const ind=indicateurs.find(i=>i.code_indicateur===occ.code_indicateur) || archivedIndicateurs.find(i=>i.code_indicateur===occ.code_indicateur);const cibleVal=getCible(occ,ind);const att=getAtteinte(occ.val_indicateur,cibleVal,ind?.sens);const ret=calcRetard(occ);const isTx=ind?.type_indicateur==='Taux'||ind?.type_indicateur==='TxCalcule';return<tr key={occ.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 sticky left-0 bg-white z-10" style={{width:'350px', minWidth:'350px', maxWidth:'350px'}} title={occ.libelle_indicateur || ind?.libelle_indicateur}><span className="line-clamp-2 whitespace-normal leading-snug">{occ.libelle_indicateur || ind?.libelle_indicateur || '-'}</span></td><td className="px-2 py-1.5 text-center">{occ.periode||'-'}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_debut)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_fin)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_limite_saisie)}</td><td className="px-2 py-1.5 text-center font-medium">{occ.val_indicateur!=null?(isTx?`${parseFloat(occ.val_indicateur).toFixed(1)}%`:occ.val_indicateur):'-'}</td><td className="px-2 py-1.5 text-center">{cibleVal!=null?(isTx?`${cibleVal}%`:cibleVal):'-'}</td><td className="px-2 py-1.5 text-center"><AttBadge a={att}/></td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_saisie)}</td><td className="px-2 py-1.5 text-center"><RetBadge ret={ret}/></td><td className="px-2 py-1.5 text-center"><StBadge ret={ret}/></td><td className="px-2 py-1.5 text-center sticky right-0 bg-white z-10"><div className="flex justify-center gap-1"><button onClick={()=>handleDeleteArchivedItem('suivi_indicateur', occ, `${ind?.libelle_indicateur||'Occurrence'} - ${occ.periode||'Perso.'}`)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Supprimer définitivement"><Trash2 size={12}/></button></div></td></tr>})}</tbody></table></div></div>
        <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fArchivedOcc.length}</div>
      </Modal>

      {/* Modal Groupe avec SearchableMultiSelect */}
      <Modal isOpen={showGroupeModal} onClose={()=>setShowGroupeModal(false)} title={selectedGroupe?'Modifier groupe':'Nouveau groupe'} size="md" closeOnClickOutside={false}><div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
          <input type="text" value={groupeForm.code_groupe||''} onChange={e=>setGroupeForm({...groupeForm,code_groupe:e.target.value.toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '')})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ex: GRP01" maxLength={20} disabled={!!selectedGroupe}/>
          <p className="text-xs text-gray-500 mt-1">Max 20 caractères, sans espaces ni caractères spéciaux</p>
        </div>
        <FormInput label="Libellé *" value={groupeForm.libelle_groupe||''} onChange={v=>setGroupeForm({...groupeForm,libelle_groupe:v})} disabled={selectedGroupe&&!canEditGroupe(selectedGroupe)}/>
        <div>
          <SearchableMultiSelect label="Gestionnaire(s) *" value={groupeForm.gestionnaires} onChange={handleAddGest} options={users.map(u=>({value:u.username,label:`${u.nom} ${u.prenoms}`}))} placeholder="Rechercher et ajouter..." disabled={selectedGroupe&&!canEditGroupe(selectedGroupe)}/>
          <div className="flex flex-wrap gap-1 mt-2">{groupeForm.gestionnaires?.map(u=><span key={u} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1">{getUserN(u)}{(canEditGroupe(selectedGroupe)||!selectedGroupe)&&<button onClick={()=>handleRemGest(u)} className="hover:text-red-600"><X size={12}/></button>}</span>)}</div>
        </div>
        <FormInput label="Commentaire" type="textarea" value={groupeForm.commentaire||''} onChange={v=>setGroupeForm({...groupeForm,commentaire:v})} disabled={selectedGroupe&&!canEditGroupe(selectedGroupe)}/>
        <FormInput label="Statut" type="select" value={groupeForm.statut||'Actif'} onChange={v=>setGroupeForm({...groupeForm,statut:v})} options={[{value:'Actif',label:'Actif'},{value:'Inactif',label:'Inactif'}]} disabled={selectedGroupe&&!canEditGroupe(selectedGroupe)}/>
        <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={()=>setShowGroupeModal(false)}>Fermer</Button>{((selectedGroupe && canEditGroupe(selectedGroupe)) || (!selectedGroupe && canCreateGroupe()))&&<Button onClick={handleSaveGrp}>Enregistrer</Button>}</div>
      </div></Modal>

      {/* Modal Indicateur avec SearchableSelect */}
      <Modal isOpen={showIndicateurModal} onClose={()=>setShowIndicateurModal(false)} title={selectedIndicateur?(canEditInd(selectedIndicateur)?'Modifier':'Détails'):'Nouvel indicateur'} size="lg" closeOnClickOutside={false}><div className="max-h-[70vh] overflow-y-auto pr-2 space-y-4">
        <FormInput label="Libellé *" value={indicateurForm.libelle_indicateur||''} onChange={v=>setIndicateurForm({...indicateurForm,libelle_indicateur:v})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)}/>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <SearchableMultiSelect label="Groupe(s) *" value={indicateurForm.groupes} onChange={handleAddGrp} options={availableManagedGroupsForForm.filter(g=>!indicateurForm.groupes?.includes(g.code_groupe)).filter(g=>!(hasR||(indicateurForm.groupes?.length>0&&g.code_groupe==='Risque'))).map(g=>({value:g.code_groupe,label:g.libelle_groupe}))} placeholder="Rechercher..." disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)}/>
            <div className="flex flex-wrap gap-1 mt-2">{indicateurForm.groupes?.map(c=><span key={c} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${c==='Risque'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{allGroupes.find(g=>g.code_groupe===c)?.libelle_groupe||c}{(!selectedIndicateur||canEditInd(selectedIndicateur))&&<button onClick={()=>handleRemGrp(c)} className="hover:text-red-600"><X size={12}/></button>}</span>)}</div>
          </div>
          <SearchableSelect label="Structure *" value={indicateurForm.code_structure} onChange={handleStructChg} options={structOpts} placeholder="Choisir..." disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)}/>
        </div>
        <SearchableSelect label="Responsable *" value={indicateurForm.responsable} onChange={v=>setIndicateurForm({...indicateurForm,responsable:v})} options={getIndicatorResponsableOptions()} placeholder={(indicateurForm.code_structure && indicateurForm.groupes?.length)?'Choisir...':'Choisir structure et groupe d\'abord'} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)||!indicateurForm.code_structure||!indicateurForm.groupes?.length}/>
        <div className="grid grid-cols-3 gap-3"><div><label className="block text-xs font-medium text-gray-700 mb-1">Type *</label><select value={indicateurForm.type_indicateur||'Taux'} onChange={e=>handleTypeChg(e.target.value)} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} className="w-full px-2 py-1.5 text-xs border rounded">{typeOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-700 mb-1">Sens *</label><select value={indicateurForm.sens||'Positif'} onChange={e=>setIndicateurForm({...indicateurForm,sens:e.target.value})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} className="w-full px-2 py-1.5 text-xs border rounded"><option value="Positif">Positif</option><option value="Négatif">Négatif</option></select></div>{!hasR&&<div><label className="block text-xs font-medium text-gray-700 mb-1">Périodicité *</label><select value={indicateurForm.periodicite||''} onChange={e=>setIndicateurForm({...indicateurForm,periodicite:e.target.value})} disabled={!!selectedIndicateur} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">...</option>{periodicites.map(p=><option key={p} value={p}>{p}</option>)}</select></div>}</div><div><label className="block text-xs font-medium text-gray-700 mb-1">L'indicateur nécessite-t-il une cible ? *</label><select value={indicateurForm.necessite_cible||'Oui'} onChange={e=>setIndicateurForm({...indicateurForm,necessite_cible:e.target.value})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} className="w-full px-2 py-1.5 text-xs border rounded"><option value="Oui">Oui</option><option value="Non">Non</option></select></div>
        {indicateurForm.type_indicateur==='Taux'&&<div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-700 mb-1">Numérateur *</label><input type="text" value={indicateurForm.numerateur||''} onChange={e=>setIndicateurForm({...indicateurForm,numerateur:e.target.value})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} placeholder="Ex: Nb traités" className="w-full px-2 py-1.5 text-xs border rounded"/></div><div><label className="block text-xs font-medium text-gray-700 mb-1">Dénominateur *</label><input type="text" value={indicateurForm.denominateur||''} onChange={e=>setIndicateurForm({...indicateurForm,denominateur:e.target.value})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} placeholder="Ex: Total" className="w-full px-2 py-1.5 text-xs border rounded"/></div></div>}
        <FormInput label="Statut" type="select" value={indicateurForm.statut||'Actif'} onChange={v=>setIndicateurForm({...indicateurForm,statut:v})} options={[{value:'Actif',label:'Actif'},{value:'Inactif',label:'Inactif'}]} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)}/>
        {hasR&&<div className="p-3 bg-orange-50 rounded-lg border border-orange-200"><h4 className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle size={14}/>Seuils de fréquence (S1 &lt; S2 &lt; S3){indicateurForm.type_indicateur!=='Nombre'&&<span className="font-normal text-orange-600 ml-1">- Valeurs en %, saisir sans le symbole %</span>}</h4><div className="grid grid-cols-3 gap-3">{[1,2,3].map(n=><div key={n}><label className="block text-xs font-medium text-gray-700 mb-1">S{n} *</label><input type="number" step="any" value={indicateurForm[`seuil${n}`]||''} onChange={e=>setIndicateurForm({...indicateurForm,[`seuil${n}`]:e.target.value})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} className="w-full px-2 py-1.5 text-xs border rounded" placeholder={indicateurForm.type_indicateur!=='Nombre'?'Ex: 25':'Ex: 10'}/><p className="text-[9px] text-gray-500 mt-1">{getSeuilH(n,indicateurForm.sens)}</p></div>)}</div></div>}
        <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={()=>setShowIndicateurModal(false)}>Fermer</Button>{(!selectedIndicateur||canEditInd(selectedIndicateur))&&<Button onClick={handleSaveInd}>{selectedIndicateur?'Enregistrer':'Créer'}</Button>}</div>
      </div></Modal>

      {/* Modal Création Occurrence */}
      <Modal isOpen={showCreateOccurrenceModal} onClose={()=>setShowCreateOccurrenceModal(false)} title="Ouvrir occurrence" size="md" closeOnClickOutside={false}>
        <div className="mb-4 p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-800 font-medium">{selectedIndicateur?.libelle_indicateur}</p><p className="text-xs text-blue-600">Type: {getTypeL(selectedIndicateur?.type_indicateur)} | Périod.: {selectedIndicateur?.periodicite}</p></div>
        <div className="space-y-4">
          <PeriodeSel form={createOccurrenceForm} setForm={setCreateOccurrenceForm} per={selectedIndicateur?.periodicite} dis={false}/>
          {selectedIndicateur?.periodicite!=='Personnalise'&&selectedIndicateur?.periodicite!=='Journalier'&&<div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Début</label><input type="date" value={createOccurrenceForm.date_debut||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Fin</label><input type="date" value={createOccurrenceForm.date_fin||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div></div>}
          <FormInput label="Date limite *" type="date" value={createOccurrenceForm.date_limite_saisie||''} onChange={v=>setCreateOccurrenceForm({...createOccurrenceForm,date_limite_saisie:v})}/>
          <SearchableSelect label="Responsable *" value={createOccurrenceForm.responsable||''} onChange={v=>setCreateOccurrenceForm({...createOccurrenceForm,responsable:v})} options={getOccurrenceResponsableOptions(selectedIndicateur)} placeholder="Choisir..."/>
          {indicatorRequiresTarget(selectedIndicateur)&&<div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cible *{selectedIndicateur?.type_indicateur!=='Nombre'?' (valeur en %, saisir sans le symbole %)':''}</label>
            <input type="number" step="any" value={createOccurrenceForm.cible||''} onChange={e=>setCreateOccurrenceForm({...createOccurrenceForm,cible:e.target.value})} className="w-full px-2 py-1.5 border rounded text-xs" placeholder={selectedIndicateur?.type_indicateur!=='Nombre'?'Ex: 85':'Ex: 100'}/>
          </div>}
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t"><Button variant="secondary" onClick={()=>setShowCreateOccurrenceModal(false)}>Annuler</Button><Button onClick={handleSaveCreateOcc}>Créer</Button></div>
      </Modal>

      {/* Modal Liste Occurrences */}
      <Modal isOpen={showOccurrencesListModal} onClose={()=>setShowOccurrencesListModal(false)} title={`Occurrences - ${selectedIndicateur?.libelle_indicateur?.slice(0,30)}...`} size="lg"><div className="overflow-x-auto max-h-96"><table className="w-full text-[10px]"><thead className="bg-gray-100 sticky top-0"><tr><th className="px-2 py-2 text-left">Période</th><th className="px-2 py-2 text-center">Début</th><th className="px-2 py-2 text-center">Fin</th><th className="px-2 py-2 text-center">Valeur</th><th className="px-2 py-2 text-center">Cible</th><th className="px-2 py-2 text-center">Att.</th><th className="px-2 py-2 text-center">Statut</th><th className="px-2 py-2 text-center">St. val.</th><th className="px-2 py-2 text-center whitespace-nowrap">Gest. Conf.</th><th className="px-2 py-2 text-center">Act.</th></tr></thead><tbody className="divide-y">{indicateurOccurrences.length===0?<tr><td colSpan={10} className="text-center py-4 text-gray-500">Aucune</td></tr>:indicateurOccurrences.map(occ=>{const cibleVal=getCible(occ,selectedIndicateur);const att=getAtteinte(occ.val_indicateur,cibleVal,selectedIndicateur?.sens);const ce=canEditOcc(occ,selectedIndicateur);const cs=canSaisir(occ,selectedIndicateur);const validatedOcc=isIndicatorValidated(occ);const isTx=selectedIndicateur?.type_indicateur==='Taux'||selectedIndicateur?.type_indicateur==='TxCalcule';return<tr key={occ.id} className="hover:bg-gray-50"><td className="px-2 py-1.5">{occ.periode||'Perso.'}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_debut)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_fin)}</td><td className="px-2 py-1.5 text-center font-medium">{occ.val_indicateur!=null?(isTx?`${parseFloat(occ.val_indicateur).toFixed(1)}%`:occ.val_indicateur):'-'}</td><td className="px-2 py-1.5 text-center">{cibleVal!=null?(isTx?`${cibleVal}%`:cibleVal):'-'}</td><td className="px-2 py-1.5 text-center"><AttBadge a={att}/></td><td className="px-2 py-1.5 text-center"><StBadge s={occ.statut || '-'}/></td><td className="px-2 py-1.5 text-center"><ValBadge value={getIndicatorValidationLabel(occ)}/></td><td className="px-2 py-1.5 text-center"><ConfBadge value={getIndicatorManagerConfirmation(occ)}/></td><td className="px-2 py-1.5 text-center"><div className="flex justify-center gap-1"><button onClick={()=>{setShowOccurrencesListModal(false);handleOpenOccModal(occ)}} className={`p-1 rounded ${((ce||cs) && !validatedOcc)?'text-blue-600 hover:bg-blue-100':'text-gray-400'}`}>{((ce||cs) && !validatedOcc)?<Edit size={12}/>:<Eye size={12}/>}</button>{ce&&!isRisque(selectedIndicateur)&&<button onClick={()=>handleArchiveItem('suivi_indicateur', occ, `${selectedIndicateur?.libelle_indicateur||'Occurrence'} - ${occ.periode||'Perso.'}`)} className="p-1 text-amber-600 hover:bg-amber-100 rounded" title="Archiver"><Archive size={12}/></button>}{ce&&<button onClick={()=>handleDelOcc(occ)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}</div></td></tr>})}</tbody></table></div><div className="text-xs text-gray-500 mt-2">Total: {indicateurOccurrences.length}</div></Modal>

      {/* Modal Saisie Occurrence - Masquer Num/Dén pour Nombre et TxCalcule */}
      <Modal isOpen={showOccurrenceModal} onClose={()=>setShowOccurrenceModal(false)} title="Saisie valeurs" size="md" closeOnClickOutside={false}>{(()=>{
        const ind=selectedIndicateur||indicateurs.find(i=>i.code_indicateur===occurrenceForm.code_indicateur)
        const ce=canEditOcc(selectedOccurrence,ind)
        const cs=canSaisir(selectedOccurrence,ind)
        const canWorkflow=canManageIndicatorWorkflow(selectedOccurrence, ind)
        const workflowHistory=getIndicatorWorkflowHistory(selectedOccurrence)
        const workflowStatus=selectedOccurrence?.validation_status || occurrenceForm.validation_status || occurrenceForm.statut || '-'
        const rejectedValue=(selectedOccurrence?.rejected_value ?? selectedOccurrence?.valeur_rejetee ?? null)
        const needsReply=requiresIndicatorReply(selectedOccurrence, occurrenceForm.val_indicateur)
        const waitingValidation=String(workflowStatus).trim().toLowerCase()==='attente de validation'
        const today = new Date().toISOString().split('T')[0]
        const periodeEchue = occurrenceForm.date_fin && occurrenceForm.date_fin <= today
        const periodeNonEchue = !periodeEchue
        const saisieBloquee = periodeNonEchue
        const fullEdit = canFullyEditIndicatorOccurrence(selectedOccurrence, ind)
        const limitedEdit = canLimitedEditIndicatorOccurrence(selectedOccurrence, ind)
        const readOnlyWorkflow = isIndicatorValidated(selectedOccurrence)
        const ro = (!ce && !cs) || saisieBloquee || readOnlyWorkflow
        const canEditMetadata = fullEdit && !saisieBloquee && !readOnlyWorkflow
        const canEditValueFields = (fullEdit || limitedEdit) && !saisieBloquee && !readOnlyWorkflow
        const canEditCommentField = (fullEdit || limitedEdit) && !saisieBloquee && !readOnlyWorkflow
        const ir=isRisque(ind)
        const ti=ind?.type_indicateur
        const isTx=ti==='Taux'||ti==='TxCalcule'
        const respOnly=limitedEdit && !fullEdit
        return<>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-800 font-medium">{ind?.libelle_indicateur}</p><p className="text-xs text-blue-600">Type: {getTypeL(ti)} | Sens: {ind?.sens}</p>{isIndicatorValidated(selectedOccurrence)&&<p className="text-xs text-green-700 mt-1 font-medium">Indicateur validé : lecture seule jusqu'à annulation de la validation par un gestionnaire ou un super admin.</p>}{respOnly&&!saisieBloquee&&!isIndicatorValidated(selectedOccurrence)&&<p className="text-xs text-orange-600 mt-1 font-medium">Responsable, supérieur hiérarchique direct et responsable de structure autorisés : seule la valeur de l'indicateur et le commentaire sont modifiables.</p>}</div>
          {selectedOccurrence && <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-gray-700">Statut du workflow</span><span className="px-2 py-1 rounded-full text-[11px] font-medium bg-white border">{workflowStatus}</span></div></div>}
          {selectedOccurrence && (String(selectedOccurrence?.validation_status || '').trim().toLowerCase()==='rejetée' || String(selectedOccurrence?.validation_status || '').trim().toLowerCase()==='rejetee') && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-xs font-semibold text-red-800 mb-1">Commentaire du gestionnaire</p><p className="text-xs text-red-700 whitespace-pre-wrap">{selectedOccurrence?.last_rejection_comment || 'Aucun commentaire'}</p>{rejectedValue != null && <p className="mt-2 text-[11px] text-red-700"><strong>Valeur rejetée :</strong> {rejectedValue}</p>}{needsReply && <p className="mt-2 text-[11px] text-red-700">Avant toute nouvelle soumission, un commentaire de réponse est obligatoire.</p>}</div>}
          {periodeNonEchue && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-yellow-600" /><p className="text-sm text-yellow-800 font-medium">Période non échue</p></div><p className="text-xs text-yellow-700 mt-1">La date de fin de période ({fmtDate(occurrenceForm.date_fin)}) n'est pas encore atteinte. La saisie des valeurs est désactivée.</p></div>}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {!ir&&<PeriodeSel form={occurrenceForm} setForm={setOccurrenceForm} per={ind?.periodicite} dis={!canEditMetadata}/>}            
            {ir&&<div className="p-2 bg-orange-50 rounded text-xs text-orange-700"><Info size={12} className="inline mr-1"/>Risque: dates fixes</div>}
            {ind?.periodicite!=='Personnalise'&&ind?.periodicite!=='Journalier'&&!ir&&<div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Début</label><input type="date" value={occurrenceForm.date_debut||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Fin</label><input type="date" value={occurrenceForm.date_fin||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div></div>}
            {ir&&<div className="grid grid-cols-3 gap-2"><div><label className="block text-xs text-gray-500 mb-1">Début</label><input type="date" value={occurrenceForm.date_debut||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Fin</label><input type="date" value={occurrenceForm.date_fin||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Limite</label><input type="date" value={occurrenceForm.date_limite_saisie||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div></div>}
            {!ir&&<FormInput label="Date limite *" type="date" value={occurrenceForm.date_limite_saisie||''} onChange={v=>setOccurrenceForm({...occurrenceForm,date_limite_saisie:v})} disabled={!canEditMetadata}/>}
            {!ir&&<SearchableSelect label="Responsable *" value={occurrenceForm.responsable || ind?.responsable || ''} onChange={v=>setOccurrenceForm({...occurrenceForm,responsable:v})} options={getOccurrenceResponsableOptions(ind)} placeholder="Choisir..." disabled={!canEditMetadata}/>}
            {indicatorRequiresTarget(ind)&&<div><label className="block text-xs font-medium text-gray-700 mb-1">Cible *{isTx?' (valeur en %, saisir sans le symbole %)':''}</label><input type="number" step="any" value={occurrenceForm.cible ?? ''} onChange={e=>setOccurrenceForm({...occurrenceForm,cible:e.target.value})} disabled={!canEditMetadata||ir} className={`w-full px-2 py-1.5 border rounded text-xs ${(!ce||ir)?'bg-gray-100':''}`} placeholder={isTx?'Ex: 85':'Ex: 100'}/>{ir&&<p className="text-[10px] text-gray-500 mt-1">={ind?.sens==='Négatif'?'S1':'S3'}</p>}</div>}
            {ti==='Taux'&&<><div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-700 mb-0.5">Numérateur</label><p className="text-[10px] text-gray-500 mb-1">{ind?.numerateur||'Num.'}</p><input type="number" step="any" value={saisieBloquee ? '' : (occurrenceForm.val_numerateur ?? '')} onChange={e=>setOccurrenceForm({...occurrenceForm,val_numerateur:e.target.value})} disabled={!canEditValueFields} className={`w-full px-2 py-1.5 border rounded text-xs ${!canEditValueFields?'bg-gray-100':''}`} placeholder={saisieBloquee?'Période non échue':''}/></div><div><label className="block text-xs font-medium text-gray-700 mb-0.5">Dénominateur</label><p className="text-[10px] text-gray-500 mb-1">{ind?.denominateur||'Dén.'}</p><input type="number" step="any" value={saisieBloquee ? '' : (occurrenceForm.val_denominateur ?? '')} onChange={e=>setOccurrenceForm({...occurrenceForm,val_denominateur:e.target.value})} disabled={!canEditValueFields} className={`w-full px-2 py-1.5 border rounded text-xs ${!canEditValueFields?'bg-gray-100':''}`} placeholder={saisieBloquee?'Période non échue':''}/></div></div><div><label className="block text-xs text-gray-500 mb-1">Valeur (%)</label><input type="text" value={!saisieBloquee && occurrenceForm.val_numerateur !== null && occurrenceForm.val_numerateur !== undefined && `${occurrenceForm.val_numerateur}` !== '' && occurrenceForm.val_denominateur !== null && occurrenceForm.val_denominateur !== undefined && `${occurrenceForm.val_denominateur}` !== '' && parseFloat(occurrenceForm.val_denominateur)!==0 ?`${((parseFloat(occurrenceForm.val_numerateur)/parseFloat(occurrenceForm.val_denominateur))*100).toFixed(2)}%`:'-'} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/><p className="text-[9px] text-gray-400">Calculé automatiquement</p></div></>}
            {ti==='TxCalcule'&&<div><label className="block text-xs font-medium text-gray-700 mb-1">Valeur (%) * - saisir sans le symbole %</label><input type="number" step="any" value={saisieBloquee ? '' : (occurrenceForm.val_indicateur ?? '')} onChange={e=>setOccurrenceForm({...occurrenceForm,val_indicateur:e.target.value})} disabled={!canEditValueFields} placeholder={saisieBloquee?'Période non échue':'Ex: 85.5'} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`}/></div>}
            {ti==='Nombre'&&<div><label className="block text-xs font-medium text-gray-700 mb-1">Valeur *</label><input type="number" step="any" value={saisieBloquee ? '' : (occurrenceForm.val_indicateur ?? '')} onChange={e=>setOccurrenceForm({...occurrenceForm,val_indicateur:e.target.value})} disabled={!canEditValueFields} placeholder={saisieBloquee?'Période non échue':'Ex: 150'} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`}/></div>}
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Retard (j)</label><input type="text" value={occurrenceForm.nb_jr_retard??'-'} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Statut</label><input type="text" value={occurrenceForm.statut||'-'} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Commentaire</label><textarea value={occurrenceForm.commentaire||''} onChange={e=>setOccurrenceForm({...occurrenceForm,commentaire:e.target.value})} disabled={!canEditCommentField} rows={2} className={`w-full px-2 py-1.5 border rounded text-xs ${!canEditCommentField?'bg-gray-100':''}`}/>{needsReply && <p className="mt-1 text-[11px] text-red-600">Après un rejet, ce commentaire est obligatoire avant de ressaisir une nouvelle valeur.</p>}</div>
            {selectedOccurrence && <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-gray-700">Historique des échanges</span><span className="text-[10px] text-gray-500">{workflowHistory.length} entrée(s)</span></div><div className="max-h-44 overflow-y-auto space-y-2">{workflowHistory.length === 0 ? <p className="text-xs text-gray-500">Aucun échange pour le moment.</p> : workflowHistory.map((item) => (<div key={item.id} className="rounded-lg bg-white border border-gray-200 p-2"><div className="flex items-center justify-between gap-2 mb-1"><span className="text-[11px] font-semibold text-gray-700">{item.actor || '-'}</span><span className="text-[10px] text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '-'}</span></div><p className="text-[11px] text-gray-600 whitespace-pre-wrap">{item.comment || 'Sans commentaire'}</p>{(item.metadata?.rejected_value != null || item.previous_value != null || item.new_value != null) && <p className="mt-1 text-[10px] text-gray-500">Valeur : {item.metadata?.rejected_value ?? item.previous_value ?? '-'} → {item.new_value ?? '-'}</p>}</div>))}</div></div>}
          </div>
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t"><Button variant="secondary" onClick={()=>setShowOccurrenceModal(false)}>Fermer</Button>{(canEditValueFields || canEditCommentField || canEditMetadata) && periodeEchue && <Button onClick={handleSaveOcc}>Enregistrer</Button>}</div>
        </>})()}</Modal>

      <Modal isOpen={showIndicatorValidationModal} onClose={()=>setShowIndicatorValidationModal(false)} title="Validation de la valeur" size="sm" closeOnClickOutside={false}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Confirmez la validation de la valeur ou rejetez-la avec un commentaire explicatif.</p>
          <div>
            <label className="block text-sm font-medium mb-1">Commentaire du gestionnaire</label>
            <textarea value={validationForm.comment || ''} onChange={e => setValidationForm({ comment: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" rows={3} placeholder="Optionnel pour une validation, obligatoire pour un rejet" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowIndicatorValidationModal(false)}>Fermer</Button>
            <Button variant="danger" onClick={() => handleIndicatorValidationDecision('reject')}>Rejeter</Button>
            <Button onClick={() => handleIndicatorValidationDecision('approve')}>Valider</Button>
          </div>
        </div>
      </Modal>

      {/* AlertModal unifié pour tous les messages */}
      <AlertModal 
        isOpen={alertModal.isOpen} 
        onClose={closeAlert} 
        type={alertModal.type}
        message={alertModal.message} 
      />
      
      {/* Modal de confirmation */}
      <AlertModal 
        isOpen={!!confirmAction} 
        onClose={() => setConfirmAction(null)} 
        type="confirm"
        message={confirmAction?.message || ''}
        onConfirm={() => { const operation = confirmAction?.onConfirm; setConfirmAction(null); if (operation) runBlockingAction(operation) }}
        showCancel={true}
      />
    </div>
  )
}
