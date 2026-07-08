'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { FolderOpen, List, CheckSquare, Plus, Edit, Trash2, Users, PlayCircle, ListChecks, RotateCcw, UserMinus, Eye, CheckCircle, XCircle, Download, Archive, Send, Loader2, ChevronDown } from 'lucide-react'
import { Button, Modal, SidebarButton, StatusBadge, SearchableSelect, AlertModal } from '@/components/ui'
import * as XLSX from 'xlsx'
import { canAccessAction, canAccessActionOccurrence, isPrivilegedUser, isSuperManagerUser, isStructureResponsible } from '@/lib/access-scope'
import { canSendReminders, canCreateProjects as canUserCreateProjects } from '@/lib/roles'

function SearchableFilterMultiSelect({ label, value, onChange, options, placeholder = 'Tous', disabled = false, size = 'sm' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : [])
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const filtered = options.filter(o => String(o.label || '').toLowerCase().includes(search.toLowerCase()))
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

export default function ActivitesPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('projets')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionInProgressCount, setActionInProgressCount] = useState(0)
  const actionInProgress = actionInProgressCount > 0
  const [projets, setProjets] = useState([])
  const [actions, setActions] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [taches, setTaches] = useState([])
  const [structures, setStructures] = useState([])
  const [users, setUsers] = useState([])
  const [showProjetModal, setShowProjetModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showOccurrenceEditModal, setShowOccurrenceEditModal] = useState(false)
  const [showTacheModal, setShowTacheModal] = useState(false)
  const [showTachesListModal, setShowTachesListModal] = useState(false)
  const [showMembresModal, setShowMembresModal] = useState(false)
  const [showOccurrencesListModal, setShowOccurrencesListModal] = useState(false)
  const [selectedProjet, setSelectedProjet] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)
  const [selectedOccurrence, setSelectedOccurrence] = useState(null)
  const [selectedTache, setSelectedTache] = useState(null)
  const [projetForm, setProjetForm] = useState({ libelle_groupe: '', commentaire: '', gestionnaires: [], membres: [], type_projet: 'Public', statut: 'Actif' })
  const [actionForm, setActionForm] = useState({ libelle_action: '', code_groupe: '', code_structure: '', commentaire: '', statut: 'Actif', occ_date_debut: '', occ_date_fin: '', occ_responsable: '' })
  const [occurrenceForm, setOccurrenceForm] = useState({ date_debut: '', date_fin: '', responsable: '', tx_avancement: 0, commentaire: '', date_realisation: '', date_realisation_auto: '' })
  const [tacheForm, setTacheForm] = useState({ libelle_tache: '', date_debut: '', date_fin: '', responsable: '', commentaire: '', tx_avancement: 0 })
  const [projetFilters, setProjetFilters] = useState({ gestionnaire: [], statut: '', search: '' })
  const [actionFilters, setActionFilters] = useState({ projet: [], type: [], responsable: [], structure: [], statut: [], search: '' })
  const [suiviFilters, setSuiviFilters] = useState({ projet: [], structure: [], responsable: [], dateDebut: '', dateFin: '', search: '', niveauAvancement: [], niveauRetard: '' })
  const [dashboardPendingOnly, setDashboardPendingOnly] = useState(false)
  const subPages = [{ key: 'projets', label: 'Projet', icon: FolderOpen }, { key: 'actions', label: 'Actions', icon: List }, { key: 'suivi', label: 'Suivi actions', icon: CheckSquare }]
  
  // États pour l'archivage
  const [showArchives, setShowArchives] = useState(false)
  const [archiveType, setArchiveType] = useState('')
  const [archivedItems, setArchivedItems] = useState([])
  
  // État pour AlertModal unifié
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [confirmAction, setConfirmAction] = useState(null)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [confirmationForm, setConfirmationForm] = useState({ date_realisation: '', manager_comment: '' })
  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => { setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null }) }
  const runBlockingAction = useCallback(async (operation) => {
    setActionInProgressCount(count => count + 1)
    try {
      return await operation()
    } finally {
      setActionInProgressCount(count => Math.max(0, count - 1))
    }
  }, [])
  const blockingFetch = useCallback((...args) => runBlockingAction(() => globalThis.fetch(...args)), [runBlockingAction])

  // Fonction pour archiver un élément
  const handleArchive = async (type, id, libelle) => {
    const archiveMessage = type === 'projet'
      ? `Vous êtes sur le point d'archiver le projet "${libelle}".

Toutes les actions de ce projet ainsi que toutes leurs occurrences seront également archivées.

Voulez-vous confirmer ?`
      : type === 'action'
        ? `Vous êtes sur le point d'archiver l'action "${libelle}".

Toutes les occurrences de cette action seront également archivées.

Voulez-vous confirmer ?`
        : `Voulez-vous archiver "${libelle}" ?

Cet élément ne sera plus modifiable et disparaîtra du tableau.`

    setConfirmAction({
      message: archiveMessage,
      onConfirm: async () => {
        try {
          const r = await blockingFetch('/api/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, id, archive_par: user?.username })
          })
          if (r.ok) {
            const result = await r.json().catch(() => ({}))
            showAlert('success', result.message || 'Élément archivé avec succès')
            if (type === 'projet' || type === 'groupe_actions') {
              fetchProjets()
              fetchActions()
              fetchOccurrences()
            }
            else if (type === 'action') {
              fetchActions()
              fetchOccurrences()
            }
            else if (type === 'action_occurrence' || type === 'suivi_action') fetchOccurrences()
          } else {
            const err = await r.json()
            showAlert('error', err.error || 'Erreur')
          }
        } catch (e) {
          showAlert('error', 'Erreur: ' + e.message)
        }
      }
    })
  }

  // Fonction pour voir les archives
  const handleViewArchives = async (type) => {
    setArchiveType(type)
    try {
      const r = await blockingFetch(`/api/archive?type=${type}`)
      if (r.ok) {
        const data = await r.json()
        setArchivedItems(data)
        setShowArchives(true)
      }
    } catch (e) {
      showAlert('error', 'Erreur: ' + e.message)
    }
  }
  
  // Fonction pour désarchiver
  const handlePermanentDelete = async (type, id, libelle) => {
    const deleteMessage = type === 'projet'
      ? `Vous êtes sur le point de supprimer définitivement le projet "${libelle}".

Toutes les actions de ce projet ainsi que toutes leurs occurrences seront également supprimées définitivement.

Voulez-vous confirmer ?`
      : type === 'action'
        ? `Vous êtes sur le point de supprimer définitivement l'action "${libelle}".

Toutes les occurrences de cette action seront également supprimées définitivement.

Voulez-vous confirmer ?`
        : `Voulez-vous supprimer définitivement "${libelle || 'cet élément'}" ?

Cette action est irréversible.`

    setConfirmAction({
      message: deleteMessage,
      onConfirm: async () => {
        try {
          const r = await blockingFetch('/api/archive', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, id })
          })
          const data = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(data.error || 'Erreur de suppression définitive')
          setArchivedItems((prev) => prev.filter((i) => i.id !== id))
          showAlert('success', data.message || 'Élément supprimé définitivement')
          fetchProjets()
          fetchActions()
          fetchOccurrences()
          fetchTaches()
        } catch (e) {
          showAlert('error', 'Erreur: ' + e.message)
        }
      }
    })
  }

  useEffect(() => { const u = localStorage.getItem('giras_user'); if (u) setUser(JSON.parse(u)); fetchData() }, [])
  useEffect(() => {
    const tab = searchParams.get('tab')
    const pending = searchParams.get('pending') === '1'
    if (tab === 'suivi') setActiveTab('suivi')
    setDashboardPendingOnly(pending)
  }, [searchParams])
  const ensureActivityData = async ({ withTasks = false } = {}) => {
    await Promise.all([fetchProjets(), fetchActions(), fetchOccurrences()])
    if (withTasks) await fetchTaches()
  }

  useEffect(() => {
    if (activeTab === 'projets') ensureActivityData()
    else if (activeTab === 'actions') ensureActivityData()
    else if (activeTab === 'suivi') ensureActivityData({ withTasks: true })
  }, [activeTab])

  const fetchData = async () => { try { const [sRes, uRes] = await Promise.all([blockingFetch('/api/structures?statut=Actif'), blockingFetch('/api/users?statut=Actif')]); if (sRes.ok) setStructures((await sRes.json()).structures || []); if (uRes.ok) setUsers((await uRes.json()).users || []) } catch (e) { console.error(e) } }
  const fetchProjets = async () => { setLoading(true); try { const r = await blockingFetch('/api/groupes-actions'); if (r.ok) setProjets((await r.json()).groupes || []) } catch (e) { console.error(e) } finally { setLoading(false) } }
  const fetchActions = async () => {
    try {
      const [r, riskRes] = await Promise.all([blockingFetch('/api/actions'), blockingFetch('/api/actions/risques-suivi')])
      const baseActions = r.ok ? ((await r.json()).actions || []) : []
      const riskRows = riskRes.ok ? ((await riskRes.json()).rows || []) : []
      const byCode = new Map()
      baseActions.forEach((a) => byCode.set(normalizeActionCode(a.code_action), a))
      riskRows.forEach((row) => {
        const key = normalizeActionCode(row.code_action)
        if (!key) return
        const prev = byCode.get(key) || {}
        byCode.set(key, {
          ...prev,
          code_action: row.code_action,
          libelle_action: row.libelle_action || prev.libelle_action,
          code_groupe: 'RISQUES',
          code_structure: row.code_structure || prev.code_structure,
          code_risque: row.code_risque || prev.code_risque,
          statut_act: prev.statut_act || 'Actif',
          statut: prev.statut || prev.statut_act || 'Actif',
          archive: prev.archive === true ? true : false
        })
      })
      setActions(Array.from(byCode.values()))
    } catch (e) { console.error(e) }
  }
  const fetchOccurrences = async () => {
    try {
      const [r, riskRes] = await Promise.all([blockingFetch('/api/actions/occurrences'), blockingFetch('/api/actions/risques-suivi')])
      const baseOccurrences = r.ok ? ((await r.json()).occurrences || []) : []
      const riskRows = riskRes.ok ? ((await riskRes.json()).rows || []) : []
      const byId = new Map()
      baseOccurrences.forEach((o) => byId.set(String(o.id || o.code_occurrence || ''), o))
      riskRows.forEach((row) => {
        const key = String(row.occurrence_id || row.id || row.code_occurrence || '')
        if (!key) return
        const prev = byId.get(key) || {}
        byId.set(key, {
          ...prev,
          id: row.occurrence_id || prev.id,
          code_occurrence: row.code_occurrence || prev.code_occurrence,
          code_action: row.code_action,
          __actionCode: normalizeActionCode(row.code_action),
          libelle_action: row.libelle_action || prev.libelle_action,
          date_debut: row.date_debut || prev.date_debut,
          date_fin: row.date_fin || prev.date_fin,
          statut: row.statut || prev.statut,
          tx_avancement: row.tx_avancement ?? prev.tx_avancement ?? 0,
          gestionnaire_conf: row.gestionnaire_conf ?? prev.gestionnaire_conf ?? null,
          responsable: row.responsable || prev.responsable,
          archive: row.archive === true ? true : false,
          date_creation: row.date_creation || prev.date_creation,
          date_realisation: row.date_realisation || prev.date_realisation,
          date_realisation_auto: row.date_realisation_auto || prev.date_realisation_auto,
          commentaire: row.commentaire ?? prev.commentaire ?? '',
          date_conf: row.date_conf || prev.date_conf
        })
      })
      setOccurrences(Array.from(byId.values()))
    } catch (e) { console.error(e) }
  }
  const fetchTaches = async () => { try { const r = await blockingFetch('/api/taches'); if (r.ok) setTaches((await r.json()).taches || []) } catch (e) { console.error(e) } }

  // ============ PERMISSIONS ============
  const isAdmin = () => user?.type_utilisateur === 'Super admin' || user?.type_utilisateur === 'Admin'
  const isManager = () => user?.type_utilisateur === 'Manager' || user?.type_utilisateur === 'Super manager'
  const isSuperManager = () => isSuperManagerUser(user)
  const canTriggerActionReminder = (o) => {
    if (Number(getTxAvancementForOccurrence(o) || 0) >= 100) return false
    const action = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o?.code_action || o?.code_action_occ || o?.__actionCode))
    const project = getProjectForAction(action)
    return canSendReminders(user) || isGestionnaireProjet(project)
  }
  const hasGlobalActivityAccess = () => isPrivilegedUser(user)
  const canCreateProjects = () => canUserCreateProjects(user)
  
  const getProjetGestionnaires = (p) => { if (!p) return []; try { return Array.isArray(p.gestionnaires) ? p.gestionnaires : JSON.parse(p.gestionnaires || '[]') } catch { return [] } }
  const getProjetMembres = (p) => { if (!p) return []; if (p.code_groupe === 'RISQUES') return users.filter(u => u.statut === 'Actif').map(u => u.username); const g = getProjetGestionnaires(p); try { const m = Array.isArray(p.membres) ? p.membres : JSON.parse(p.membres || '[]'); return [...new Set([...g, ...m])] } catch { return g } }
  const getActionResponsables = (a) => {
    if (!a) return []
    const values = []
    if (a.latest_occurrence?.responsable) values.push(a.latest_occurrence.responsable)
    ;(Array.isArray(a.action_occurrences) ? a.action_occurrences : []).forEach(o => { if (o && o.archive !== true && o.responsable) values.push(o.responsable) })
    occurrences.forEach(o => { if (normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode) === normalizeActionCode(a.code_action) && o.archive !== true && o.responsable) values.push(o.responsable) })
    return [...new Set(values.filter(Boolean))]
  }
  const getActionTypeProjet = (a) => getProjectForAction(a)?.type_projet || 'Public'

  const clampProgress = (value) => {
    const parsed = Number.parseFloat(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.min(100, Math.max(0, parsed))
  }

  const hasOccurrenceOverlap = (form, excludeId = null) => {
    if (!selectedAction?.code_action || !form?.date_debut || !form?.date_fin) return false
    const newStart = String(form.date_debut)
    const newEnd = String(form.date_fin)
    const actionCode = normalizeActionCode(selectedAction.code_action)

    return occurrences.some((occ) => {
      if (!occ || occ.archive === true) return false
      if (excludeId && String(occ.id) === String(excludeId)) return false

      const occActionCode = normalizeActionCode(occ.code_action || occ.code_action_occ || occ.__actionCode)
      if (occActionCode !== actionCode) return false

      const occStart = String(occ.date_debut || '')
      const occEnd = String(occ.date_fin || '')
      if (!occStart || !occEnd) return false

      return newStart <= occEnd && newEnd >= occStart
    })
  }

  const isProjectPrivate = (project) => String(project?.type_projet || '').trim().toLowerCase() === 'privé'
  const isAssignedActionForCurrentUser = (action) => {
    const current = String(user?.username || '').trim().toLowerCase()
    if (!current || !action) return false
    return occurrences.some((occ) => {
      const occAction = normalizeActionCode(occ?.code_action || occ?.code_action_occ || occ?.__actionCode)
      return occAction === normalizeActionCode(action?.code_action) && String(occ?.responsable || '').trim().toLowerCase() === current
    })
  }
  const isAssignedOccurrenceForCurrentUser = (occurrence) => String(occurrence?.responsable || '').trim().toLowerCase() === String(user?.username || '').trim().toLowerCase()
  const canSuperManagerAccessProject = (project) => isGestionnaireProjet(project) || !isProjectPrivate(project)
  const canSuperManagerAccessAction = (action) => {
    const project = getProjectForAction(action)
    if (!canSuperManagerAccessProject(project)) return isAssignedActionForCurrentUser(action)
    return true
  }
  const canSuperManagerAccessOccurrence = (occurrence) => {
    const action = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(occurrence?.code_action || occurrence?.code_action_occ || occurrence?.__actionCode))
    if (!action) return false
    const project = getProjectForAction(action)
    if (!canSuperManagerAccessProject(project)) return isAssignedOccurrenceForCurrentUser(occurrence)
    return true
  }
  const canSuperManagerEditAction = (action) => {
    const project = getProjectForAction(action)
    return isGestionnaireProjet(project) || isAssignedActionForCurrentUser(action)
  }
  const canSuperManagerEditOccurrence = (occurrence) => {
    const action = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(occurrence?.code_action || occurrence?.code_action_occ || occurrence?.__actionCode))
    const project = getProjectForAction(action)
    return isGestionnaireProjet(project) || isAssignedOccurrenceForCurrentUser(occurrence)
  }

  const getRiskCodesFromAction = (a) => {
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
    pushValue(a?.code_risque)
    pushValue(a?.code_risques)
    return [...new Set(values)]
  }
  const normalizeActionCode = (v) => String(v ?? '').trim()
  const isLegacyRiskAction = (a) => getRiskCodesFromAction(a).length > 0 || ['RISQUES', 'RISQUE', 'Risque'].includes((a?.code_groupe || '').toString().trim())
  const getProjectForAction = (a) => {
    const groupCode = (a?.code_groupe || '').toString().trim()
    const direct = projets.find(x => x.code_groupe === groupCode)
    if (direct) return direct
    if (isLegacyRiskAction(a)) {
      return projets.find(x => x.code_groupe === 'RISQUES') || {
        code_groupe: 'RISQUES',
        libelle_groupe: 'Projet des Risques',
        type_projet: 'Public',
        statut: 'Actif'
      }
    }
    return null
  }

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
  const requiresResponsibleReply = (occ, nextTx) => (String(occ?.validation_status || '').toLowerCase() === 'rejetée' || String(occ?.validation_status || '').toLowerCase() === 'rejetee' || !!String(occ?.last_rejection_comment || '').trim()) && Number(nextTx || 0) >= 100
  const isOccurrenceAchieved = (o) => String(o?.gestionnaire_conf || '').toLowerCase() === 'oui' && (String(o?.validation_status || '').toLowerCase() === 'achevée' || Number(getTxAvancementForOccurrence(o) || 0) >= 100)
  const canUnlockAchievedOccurrence = (o) => canEditOccurrence(o)

  const getProjectCodeForAction = (a) => getProjectForAction(a)?.code_groupe || (isLegacyRiskAction(a) ? 'RISQUES' : a?.code_groupe)
  const getProjectLabelForAction = (a) => getProjectForAction(a)?.libelle_groupe || (isLegacyRiskAction(a) ? 'Projet des Risques' : (a?.code_groupe || '-'))
  const isGestionnaireProjet = (p) => p && user && getProjetGestionnaires(p).includes(user.username)
  const isMembreProjet = (p) => p && user && getProjetMembres(p).includes(user.username)
  const isCreateurProjet = (p) => p && user && p.createur === user.username
  
  const canViewProjet = (p) => {
    if (!p) return false
    if (isSuperManager()) return canSuperManagerAccessProject(p)
    if (hasGlobalActivityAccess()) return true
    if (isGestionnaireProjet(p)) return true
    const projectCode = String(p.code_groupe || '').trim()
    return actions.some((action) => !action?.archive && getProjectCodeForAction(action) === projectCode && canAccessAction(user, action, users, occurrences, structures))
  }
  const canEditProjet = (p) => {
    if (!p) return false
    if (p?.code_groupe === 'RISQUES') return false
    if (isSuperManager()) return isGestionnaireProjet(p)
    return user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(p)
  }
  const canDeleteProjet = (p) => p?.code_groupe !== 'RISQUES' && (user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(p))
  const canViewMembres = (p) => {
    if (isSuperManager()) return isGestionnaireProjet(p) || canSuperManagerAccessProject(p)
    return user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(p)
  }
  
  const canViewAction = (a) => {
    const p = getProjectForAction(a)
    if (isSuperManager()) return canSuperManagerAccessAction(a)
    if (isGestionnaireProjet(p)) return true
    return canAccessAction(user, a, users, occurrences, structures)
  }
  const canEditAction = (a) => {
    if (isSuperManager()) return canSuperManagerEditAction(a)
    const p = getProjectForAction(a)
    return user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(p)
  }
  const canCreateAction = (p) => isSuperManager() ? isGestionnaireProjet(p) : (user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(p))
  

  const canValidateOccurrenceCompletion = (o) => {
    if (!o) return false
    const a = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o?.code_action || o?.code_action_occ || o?.__actionCode))
    const p = getProjectForAction(a)
    return user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(p)
  }
  const canEditOccurrence = (o) => {
    if (isSuperManager()) return canSuperManagerEditOccurrence(o)
    const a = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o?.code_action || o?.code_action_occ || o?.__actionCode))
    const p = getProjectForAction(a)
    return user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(p)
  }
  const canViewOccurrence = (o) => {
    if (isSuperManager()) return canSuperManagerAccessOccurrence(o)
    const a = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o?.code_action || o?.code_action_occ || o?.__actionCode))
    const p = getProjectForAction(a)
    if (isGestionnaireProjet(p)) return true
    return canAccessActionOccurrence(user, o, users, actions, structures)
  }
  const isResponsableOccurrence = (o) => o?.responsable === user?.username
  const canEditTxAvancement = (o) => {
    if (isOccurrenceAchieved(o)) return canUnlockAchievedOccurrence(o)
    return canEditOccurrence(o) || isResponsableOccurrence(o) || canManageOccurrenceWorkflow(o)
  }
  const canEditRealisationDate = (o) => {
    const action = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o?.code_action || o?.code_action_occ || o?.__actionCode))
    const projet = getProjectForAction(action)
    return user?.type_utilisateur === 'Super admin' || isGestionnaireProjet(projet)
  }
  
  const canEditTache = (t) => { const o = occurrences.find(x => (x.code_occurrence || x.id) === t?.code_occurrence); if (isOccurrenceAchieved(o)) return false; return canEditOccurrence(o) }
  const isResponsableTache = (t) => t?.responsable === user?.username
  const canEditTxTache = (t) => { const o = occurrences.find(x => (x.code_occurrence || x.id) === t?.code_occurrence); if (isOccurrenceAchieved(o)) return false; return canEditTache(t) || isResponsableTache(t) }

  // ============ CALCULS ============
  const getTxAvancementForOccurrence = useCallback((o) => {
    if (!o) return 0
    const occId = o.code_occurrence || o.id
    const occTaches = taches.filter(t => t.code_occurrence === occId)
    if (occTaches.length === 0) return parseFloat(o.tx_avancement) || 0
    return Math.round(occTaches.reduce((s, t) => s + (parseFloat(t.tx_avancement) || 0), 0) / occTaches.length * 100) / 100
  }, [taches])
  
  const hasOccurrenceTaches = useCallback((o) => {
    if (!o) return false
    const occId = o.code_occurrence || o.id
    return taches.some(t => t.code_occurrence === occId)
  }, [taches])
  
  // Vérifier et réinitialiser gestionnaire_conf si tx < 100%
  const checkAndResetGestionnaireConf = useCallback(async (o) => {
    if (!o || !o.gestionnaire_conf || o.gestionnaire_conf !== 'Oui') return
    const tx = getTxAvancementForOccurrence(o)
    if (tx < 100) {
      // Réinitialiser en base de données
      try {
        await blockingFetch('/api/actions/occurrences', { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ id: o.id, gestionnaire_conf: null, date_conf: null, modificateur: user?.username }) 
        })
        fetchOccurrences()
      } catch (e) { console.error('Erreur reset conf:', e) }
    }
  }, [getTxAvancementForOccurrence, user])

  // IMPORTANT : Ne pas faire d'écritures serveur en arrière-plan lors du rendu.
  // La "date_realisation" doit être renseignée/vidée uniquement quand l'utilisateur
  // modifie le Tx% (PUT /api/actions/occurrences). Cela évite les boucles d'appels
  // et les erreurs de surcharge réseau observées côté navigateur.
  
  // Vérifier toutes les occurrences au chargement des tâches
  useEffect(() => {
    if (occurrences.length > 0 && taches.length >= 0) {
      occurrences.forEach(o => {
        if (o.gestionnaire_conf === 'Oui') {
          const tx = getTxAvancementForOccurrence(o)
          if (tx < 100) {
            checkAndResetGestionnaireConf(o)
          }
        }

        // Pas d'écritures serveur automatiques ici.
      })
    }
  }, [taches, occurrences, getTxAvancementForOccurrence, checkAndResetGestionnaireConf])
  
  const calculateOccurrenceFields = (occ) => {
    if (!occ) return { niveauAvancement: 'Non entamée', jourRetard: 0, niveauRetard: 'Pas retard' }
    // Le Tx% affiché peut provenir soit d'une saisie manuelle (tx_avancement),
    // soit du calcul via les tâches. On centralise donc la source ici.
    const tx = getTxAvancementForOccurrence(occ)
    const isDone = tx >= 100
    const dateFin = occ.date_fin ? new Date(occ.date_fin) : null
    const dateReal = occ.date_realisation ? new Date(occ.date_realisation) : null
    const today = new Date(); today.setHours(0,0,0,0)
    
    let niveauAvancement = 'Non entamée'
    if (tx === 0) niveauAvancement = 'Non entamée'
    else if (tx <= 50) niveauAvancement = 'En cours -50%'
    else if (tx < 100) niveauAvancement = 'En cours +50%'
    else if (tx >= 100 && occ.gestionnaire_conf !== 'Oui') niveauAvancement = 'Terminée - non confirmée'
    else if (tx >= 100 && occ.gestionnaire_conf === 'Oui') niveauAvancement = 'Achevée'
    
    let jourRetard = 0
    if (dateFin) {
      if (isDone) {
        // Si la Date de réalisation n'existe pas encore (anciens enregistrements),
        // on prend un fallback raisonnable pour éviter des incohérences d'affichage.
        // La vraie Date de réalisation est créée automatiquement lors d'une mise à jour du Tx%.
        const ref = dateReal ? new Date(dateReal) : (occ.date_conf ? new Date(occ.date_conf) : today)
        ref.setHours(0,0,0,0)
        jourRetard = Math.floor((ref - dateFin) / 86400000)
      } else {
        jourRetard = Math.floor((today - dateFin) / 86400000)
      }
    }
    return { niveauAvancement, jourRetard, niveauRetard: jourRetard > 0 ? 'Retard' : 'Pas retard' }
  }
  
  const getSortPriority = (occ) => {
    const calc = calculateOccurrenceFields({...occ, tx_avancement: getTxAvancementForOccurrence(occ)})
    const isRetard = calc.niveauRetard === 'Retard'
    
    // Ordre de tri:
    // 1. Non entamée en retard
    // 2. En cours -50% en retard
    // 3. En cours +50% en retard
    // 4. Terminée - non confirmée en retard
    // 5. Non entamée pas retard
    // 6. En cours -50% pas retard
    // 7. En cours +50% pas retard
    // 8. Terminée - non confirmée pas retard
    // 9. Achevée en retard
    // 10. Achevée pas retard
    
    let priority = 11
    if (isRetard) {
      if (calc.niveauAvancement === 'Non entamée') priority = 1
      else if (calc.niveauAvancement.includes('-50')) priority = 2
      else if (calc.niveauAvancement.includes('+50')) priority = 3
      else if (calc.niveauAvancement.includes('Terminée')) priority = 4
      else if (calc.niveauAvancement === 'Achevée') priority = 9
    } else {
      if (calc.niveauAvancement === 'Non entamée') priority = 5
      else if (calc.niveauAvancement.includes('-50')) priority = 6
      else if (calc.niveauAvancement.includes('+50')) priority = 7
      else if (calc.niveauAvancement.includes('Terminée')) priority = 8
      else if (calc.niveauAvancement === 'Achevée') priority = 10
    }
    
    return { priority, jourRetard: calc.jourRetard }
  }
  
  const getResponsablesForAction = () => {
    if (!actionForm.code_groupe || !actionForm.code_structure) return []
    const p = projets.find(x => x.code_groupe === actionForm.code_groupe)
    if (!p) return []
    const membres = getProjetMembres(p)
    return users.filter(u => u.statut === 'Actif' && membres.includes(u.username) && u.structure === actionForm.code_structure)
  }

  const userOptions = users.filter(u => u.statut === 'Actif').map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms} (${u.username})` }))
  const structureOptions = structures.map(s => ({ value: s.code_structure, label: s.libelle_structure || s.code_structure }))
  // Exclure le projet RISQUES des options - les actions de ce projet sont créées dans "Plan de maîtrise"
  const allProjetOptions = projets.filter(p => p.statut === 'Actif' && p.code_groupe !== 'RISQUES').map(p => ({ value: p.code_groupe, label: p.libelle_groupe }))
  const projetOptions = (user?.type_utilisateur === 'Super admin'
    ? allProjetOptions
    : projets
        .filter(p => p.statut === 'Actif' && p.code_groupe !== 'RISQUES' && isGestionnaireProjet(p))
        .map(p => ({ value: p.code_groupe, label: p.libelle_groupe })))
  const projetFilterOptions = [{ value: '', label: 'Tous les projets' }, ...projets.map(p => ({ value: p.code_groupe, label: p.libelle_groupe }))]
  const structureFilterOptions = [{ value: '', label: 'Toutes' }, ...structures.map(s => ({ value: s.code_structure, label: s.libelle_structure || s.code_structure }))]
  const responsableFilterOptions = [{ value: '', label: 'Tous' }, ...users.filter(u => u.statut === 'Actif').map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms}` }))]

  const asFilterArray = (value) => Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : [])
  const filterHasValue = (value, itemValue) => {
    const selected = asFilterArray(value)
    return selected.length === 0 || selected.includes(itemValue || '')
  }
  const buildOptionsFromOccurrences = (rows, getValue, getLabel, fallbackLabel) => {
    const seen = new Set()
    const opts = []
    rows.forEach(row => {
      const value = getValue(row) || ''
      if (!value || seen.has(value)) return
      seen.add(value)
      opts.push({ value, label: getLabel(row) || fallbackLabel || value })
    })
    return opts.sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr'))
  }
  const buildOptionsFromItems = (rows, getValue, getLabel, fallbackLabel) => {
    const seen = new Set()
    const opts = []
    rows.forEach(row => {
      const rawValues = getValue(row)
      const values = Array.isArray(rawValues) ? rawValues : [rawValues]
      values.forEach(raw => {
        const value = raw || ''
        if (!value || seen.has(value)) return
        seen.add(value)
        opts.push({ value, label: getLabel(row, value) || fallbackLabel || value })
      })
    })
    return opts.sort((a, b) => String(a.label).localeCompare(String(b.label), 'fr'))
  }
  const emptySuiviFilters = () => ({ projet: [], structure: [], responsable: [], dateDebut: '', dateFin: '', search: '', niveauAvancement: [], niveauRetard: '' })
  
  // Fonction pour obtenir les utilisateurs filtrés par structure
  const getUserOptionsByStructure = (codeStructure) => {
    if (!codeStructure) return userOptions
    return users.filter(u => u.statut === 'Actif' && u.structure === codeStructure).map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms} (${u.username})` }))
  }
  
  // Options de responsables pour le modal d'occurrence (filtré par structure de l'action)
  const occurrenceResponsableOptions = selectedAction ? getUserOptionsByStructure(selectedAction.code_structure) : userOptions

  // ============ HANDLERS PROJETS ============
  
  // Validation du code projet : un seul mot, max 20 caractères, pas de caractères spéciaux
  const validateCodeProjet = (code) => {
    if (!code) return { valid: false, error: 'Code obligatoire' }
    if (code.length > 20) return { valid: false, error: 'Le code ne doit pas dépasser 20 caractères' }
    if (/\s/.test(code)) return { valid: false, error: 'Le code ne doit pas contenir d\'espaces' }
    if (!/^[a-zA-Z0-9_-]+$/.test(code)) return { valid: false, error: 'Le code ne doit contenir que des lettres, chiffres, tirets ou underscores' }
    return { valid: true }
  }
  
  const handleSaveProjet = async () => {
    if (!projetForm.code_groupe) { showAlert('error', 'Code obligatoire'); return }
    if (!projetForm.libelle_groupe) { showAlert('error', 'Libellé obligatoire'); return }
    
    // Valider le format du code
    const codeValidation = validateCodeProjet(projetForm.code_groupe)
    if (!codeValidation.valid) { showAlert('error', codeValidation.error); return }
    
    if (!projetForm.gestionnaires?.length) { showAlert('error', 'Au moins un gestionnaire requis'); return }
    try {
      const r = await blockingFetch('/api/groupes-actions', { method: selectedProjet ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...projetForm, id: selectedProjet?.id, createur: selectedProjet?.createur || user?.username, modificateur: user?.username }) })
      if (r.ok) { showAlert('success', selectedProjet ? 'Projet modifié avec succès' : 'Projet créé avec succès', () => { setShowProjetModal(false); fetchProjets() }) }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') }
  }
  
  const handleDeleteProjet = (p) => {
    if (!canDeleteProjet(p)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: `Supprimer "${p.libelle_groupe}" ?`, onConfirm: async () => {
      try { const r = await blockingFetch('/api/groupes-actions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }); if (r.ok) { showAlert('success', 'Projet supprimé', fetchProjets) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }
  
  const handleUpdateGestionnairesRisques = async () => {
    const rp = projets.find(p => p.code_groupe === 'RISQUES')
    if (!rp) return
    try { const r = await blockingFetch('/api/groupes-actions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rp.id, gestionnaires: projetForm.gestionnaires, modificateur: user?.username, isRisquesUpdate: true }) }); if (r.ok) { showAlert('success', 'Gestionnaires mis à jour', () => { setShowProjetModal(false); fetchProjets() }) } } catch { }
  }
  
  const handleAddMembre = (username) => {
    if (!username || !selectedProjet) return
    const membres = getProjetMembres(selectedProjet)
    if (membres.includes(username)) { showAlert('warning', 'Déjà membre'); return }
    const currentMembres = Array.isArray(selectedProjet.membres) ? selectedProjet.membres : JSON.parse(selectedProjet.membres || '[]')
    updateProjetMembres([...currentMembres, username])
  }
  
  const handleRemoveMembre = (username) => {
    if (!selectedProjet) return
    if (getProjetGestionnaires(selectedProjet).includes(username)) { showAlert('error', 'Impossible de retirer un gestionnaire'); return }
    const currentMembres = Array.isArray(selectedProjet.membres) ? selectedProjet.membres : JSON.parse(selectedProjet.membres || '[]')
    updateProjetMembres(currentMembres.filter(m => m !== username))
  }
  
  const updateProjetMembres = async (newMembres) => {
    try { const r = await blockingFetch('/api/groupes-actions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedProjet.id, membres: newMembres, gestionnaires: getProjetGestionnaires(selectedProjet), libelle_groupe: selectedProjet.libelle_groupe, type_projet: selectedProjet.type_projet, statut: selectedProjet.statut, modificateur: user?.username }) }); if (r.ok) { setSelectedProjet({...selectedProjet, membres: newMembres}); fetchProjets() } } catch { showAlert('error', 'Erreur de connexion') }
  }

  // ============ HANDLERS ACTIONS ============
  const handleSaveAction = async () => {
    if (!actionForm.libelle_action) { showAlert('error', 'Libellé obligatoire'); return }
    if (!actionForm.code_groupe) { showAlert('error', 'Projet obligatoire'); return }
    if (!actionForm.code_structure) { showAlert('error', 'Structure obligatoire'); return }
    if (!selectedAction) {
      if (!actionForm.occ_date_debut || !actionForm.occ_date_fin) { showAlert('error', 'Dates occurrence obligatoires'); return }
      if (actionForm.occ_date_fin < actionForm.occ_date_debut) { showAlert('error', 'La date de fin doit être ultérieure ou égale à la date de début'); return }
      if (!actionForm.occ_responsable) { showAlert('error', 'Responsable occurrence obligatoire'); return }
    }
    try {
      const body = { libelle_action: actionForm.libelle_action, code_groupe: actionForm.code_groupe, code_structure: actionForm.code_structure, commentaire: actionForm.commentaire, statut: actionForm.statut, id: selectedAction?.id, createur: selectedAction?.createur || user?.username, modificateur: user?.username }
      if (!selectedAction) body.first_occurrence = { date_debut: actionForm.occ_date_debut, date_fin: actionForm.occ_date_fin, responsable: actionForm.occ_responsable }
      const r = await blockingFetch('/api/actions', { method: selectedAction ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) { setShowActionModal(false); fetchActions(); fetchOccurrences(); showAlert('success', selectedAction ? 'Action modifiée avec succès' : 'Action et occurrence créées') }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch (e) { showAlert('error', 'Erreur: ' + e.message) }
  }
  
  const handleDeleteAction = (a) => {
    if (!canEditAction(a)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: `Supprimer "${a.libelle_action}" ?`, onConfirm: async () => {
      try { const r = await blockingFetch('/api/actions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) }); if (r.ok) { showAlert('success', 'Action supprimée', () => { fetchActions(); fetchOccurrences() }) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }

  // ============ HANDLERS OCCURRENCES ============
  // Le modal est rendu globalement, donc il s'ouvre immédiatement
  const handleOpenOccurrenceForm = (action) => {
    const projet = projets.find(p => p.code_groupe === action?.code_groupe)
    if (String(action?.statut || 'Actif') !== 'Actif') { showAlert('error', "Impossible de créer une occurrence pour une action inactive"); return }
    if (projet && String(projet?.statut || 'Actif') !== 'Actif') { showAlert('error', "Impossible de créer une occurrence pour une action rattachée à un projet inactif"); return }
    if (!action) return
    if (action.statut !== 'Actif') { showAlert('warning', 'Action inactive'); return }
    if (!canEditAction(action)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: `Ouvrir une nouvelle occurrence pour "${action.libelle_action}" ?`, onConfirm: () => {
      // Fermer tous les autres modals
      setShowTachesListModal(false)
      setShowOccurrencesListModal(false)
      setShowActionModal(false)
      
      // Préparer les données
      setSelectedAction(action)
      setSelectedOccurrence(null)
      setOccurrenceForm({ date_debut: '', date_fin: '', responsable: '', tx_avancement: 0, commentaire: '', date_realisation: '', date_realisation_auto: '' })
      
      // Ouvrir le modal immédiatement (le modal est rendu globalement)
      setShowOccurrenceEditModal(true)
    }})
  }
  
  const handleSaveOccurrence = async () => {
    const nextTx = hasOccurrenceTaches(selectedOccurrence) ? getTxAvancementForOccurrence(selectedOccurrence) : (parseFloat(occurrenceForm.tx_avancement) || 0)
    if (selectedOccurrence && requiresResponsibleReply(selectedOccurrence, nextTx) && !String(occurrenceForm.commentaire || '').trim()) {
      showAlert('error', "Vous devez renseigner un commentaire en réponse au rejet avant d'enregistrer à nouveau 100%")
      return
    }
    if (!occurrenceForm.date_debut || !occurrenceForm.date_fin) { showAlert('error', 'Dates obligatoires'); return }
    if (occurrenceForm.date_fin < occurrenceForm.date_debut) { showAlert('error', 'La date de fin doit être ultérieure ou égale à la date de début'); return }
    if (!occurrenceForm.responsable) { showAlert('error', 'Responsable obligatoire'); return }
    const occurrenceTx = clampProgress(occurrenceForm.tx_avancement)
    if (Number.parseFloat(occurrenceForm.tx_avancement ?? 0) !== occurrenceTx) { showAlert('error', "Le taux d'avancement doit être compris entre 0% et 100%"); return }
    const isNew = !selectedOccurrence
    
    if (isNew && selectedAction) {
      if (occurrences.find(o => o.code_action === selectedAction.code_action && o.date_debut === occurrenceForm.date_debut && o.date_fin === occurrenceForm.date_fin)) { 
        showAlert('error', 'Cette occurrence existe déjà'); return 
      }
      if (hasOccurrenceOverlap(occurrenceForm, selectedOccurrence?.id)) {
        showAlert('error', "Cette période chevauche une occurrence existante de la même action"); return
      }
    }
    
    try {
      const body = isNew 
        ? { code_action: selectedAction.code_action, ...occurrenceForm, tx_avancement: occurrenceTx, createur: user?.username } 
        : { id: selectedOccurrence.id, ...occurrenceForm, tx_avancement: occurrenceTx, modificateur: user?.username }
      const r = await blockingFetch('/api/actions/occurrences', { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) { 
        showAlert('success', isNew ? 'Occurrence créée' : 'Occurrence modifiée', () => { setShowOccurrenceEditModal(false); fetchOccurrences() })
      }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') }
  }
  
  const handleDeleteOccurrence = (o) => {
    if (!canEditOccurrence(o)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: 'Supprimer cette occurrence ?', onConfirm: async () => {
      try { const r = await blockingFetch('/api/actions/occurrences', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) }); if (r.ok) { showAlert('success', 'Occurrence supprimée', fetchOccurrences) } } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }
  
  // Confirmer ou annuler la confirmation gestionnaire
  const handleToggleGestionnaireConf = (o, doConfirm) => {
    if (!canValidateOccurrenceCompletion(o)) { showAlert('error', 'Non autorisé'); return }
    const tx = getTxAvancementForOccurrence(o)
    if (doConfirm && tx < 100) { showAlert('error', "Le taux d'avancement doit être à 100%"); return }

    if (doConfirm) {
      setSelectedOccurrence(o)
      setConfirmationForm({ date_realisation: o.date_realisation || o.date_realisation_auto || new Date().toISOString().split('T')[0] })
      setShowConfirmationModal(true)
      return
    }

    setConfirmAction({ message: "Annuler la confirmation ?", onConfirm: async () => {
      try {
        const body = {
          id: o.id,
          gestionnaire_conf: null,
          date_conf: null,
          modificateur: user?.username
        }
        const r = await blockingFetch('/api/actions/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (r.ok) {
          fetchOccurrences()
          showAlert('success', 'Confirmation annulée')
        }
      } catch {
        showAlert('error', 'Erreur de connexion')
      }
    }})
  }

  const executeOccurrenceCompletionDecision = async (decision = 'approve') => {
    if (!selectedOccurrence) return
    if (decision === 'reject' && !String(confirmationForm.manager_comment || '').trim()) {
      showAlert('error', 'Le commentaire de rejet est obligatoire')
      return
    }

    // Blocage obligatoire pendant toute l'opération de validation/rejet
    // d'une occurrence au statut "Terminée - non confirmée" : dès la confirmation
    // utilisateur et jusqu'à l'affichage du message de succès ou d'erreur.
    setActionInProgressCount(count => count + 1)
    try {
      const body = {
        id: selectedOccurrence.id,
        validation_decision: decision,
        validation_comment: confirmationForm.manager_comment,
        gestionnaire_conf: decision === 'approve' ? 'Oui' : null,
        date_conf: decision === 'approve' ? new Date().toISOString().split('T')[0] : null,
        date_realisation: decision === 'approve' ? (confirmationForm.date_realisation || selectedOccurrence.date_realisation || selectedOccurrence.date_realisation_auto || new Date().toISOString().split('T')[0]) : null,
        modificateur: user?.username
      }
      const r = await blockingFetch('/api/actions/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        setShowConfirmationModal(false)
        setSelectedOccurrence(null)
        setConfirmationForm({ date_realisation: '', manager_comment: '' })
        await Promise.all([fetchOccurrences(), fetchTaches()])
        showAlert('success', decision === 'approve' ? "La validation de l'achèvement a bien été enregistrée. L'action est maintenant au statut Achevée." : "Le rejet a bien été enregistré et un email a été envoyé automatiquement au responsable de l'action.")
      } else {
        const err = await r.json().catch(() => ({}))
        showAlert('error', err.error || 'Erreur')
      }
    } catch {
      showAlert('error', 'Erreur de connexion')
    } finally {
      setActionInProgressCount(count => Math.max(0, count - 1))
    }
  }

  const handleConfirmOccurrenceCompletion = async (decision = 'approve') => {
    if (!selectedOccurrence) return
    if (decision === 'reject' && !String(confirmationForm.manager_comment || '').trim()) {
      showAlert('error', 'Le commentaire de rejet est obligatoire')
      return
    }

    const message = decision === 'approve'
      ? "Confirmez-vous la validation de l'achèvement de cette action ? Après validation, l'action passera au statut Achevée."
      : "Confirmez-vous le rejet de cet achèvement ? Le taux d'avancement sera réinitialisé à 0% et un email sera envoyé automatiquement au responsable avec l'intégralité de votre commentaire."

    setConfirmAction({
      message,
      onConfirm: () => executeOccurrenceCompletionDecision(decision)
    })
  }

  // ============ HANDLERS TACHES ============
  const handleOpenTacheForm = (occurrence, fromList = false) => {
    if (!canEditOccurrence(occurrence)) {
      showAlert('error', 'Non autorisé')
      return
    }
    if (isOccurrenceAchieved(occurrence)) {
      showAlert('error', 'Cette action est au statut Achevée. Toutes les tâches sont en lecture seule.')
      return
    }
    const hasTaches = hasOccurrenceTaches(occurrence)
    setConfirmAction({ message: hasTaches ? 'Créer une nouvelle tâche ?' : 'Créer une tâche ? Le Tx sera calculé automatiquement.', onConfirm: () => {
      if (fromList) setShowTachesListModal(false)
      
      setSelectedOccurrence(occurrence)
      setSelectedTache(null)
      setTacheForm({ libelle_tache: '', date_debut: occurrence.date_debut || '', date_fin: occurrence.date_fin || '', responsable: occurrence.responsable || '', commentaire: '', tx_avancement: 0 })
      
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setShowTacheModal(true)
        })
      })
    }})
  }
  
  const handleEditTache = (t) => {
    setShowTachesListModal(false)
    setSelectedTache(t)
    setTacheForm({...t})
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setShowTacheModal(true)
      })
    })
  }
  
  const handleSaveTache = async () => {
    if (selectedOccurrence && isOccurrenceAchieved(selectedOccurrence)) { showAlert('error', 'Cette action est au statut Achevée. Toutes les tâches sont en lecture seule.'); return }
    if (!selectedTache && selectedOccurrence && Number(getTxAvancementForOccurrence(selectedOccurrence) || 0) >= 100) { showAlert('error', "Impossible de créer une tâche pour une action dont le taux d'avancement est déjà à 100%."); return }
    if (!tacheForm.libelle_tache) { showAlert('error', 'Libellé obligatoire'); return }
    if (!tacheForm.date_debut || !tacheForm.date_fin) { showAlert('error', 'Dates obligatoires'); return }
    if (tacheForm.date_fin < tacheForm.date_debut) { showAlert('error', 'La date de fin doit être ultérieure ou égale à la date de début'); return }
    if (!tacheForm.responsable) { showAlert('error', 'Responsable obligatoire'); return }
    const taskTx = clampProgress(tacheForm.tx_avancement)
    if (Number.parseFloat(tacheForm.tx_avancement ?? 0) !== taskTx) { showAlert('error', "Le taux d'avancement doit être compris entre 0% et 100%"); return }
    
    if (selectedOccurrence) {
      const tDebut = new Date(tacheForm.date_debut), tFin = new Date(tacheForm.date_fin)
      const oDebut = new Date(selectedOccurrence.date_debut), oFin = new Date(selectedOccurrence.date_fin)
      if (tDebut < oDebut) { showAlert('error', "Date début antérieure à l'occurrence"); return }
      if (tFin > oFin) { showAlert('error', "Date fin postérieure à l'occurrence"); return }
    }
    
    try {
      const occId = selectedOccurrence?.code_occurrence || selectedOccurrence?.id
      const r = await blockingFetch('/api/taches', { method: selectedTache ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tacheForm, tx_avancement: taskTx, id: selectedTache?.id, code_occurrence: selectedTache?.code_occurrence || occId, code_action: selectedOccurrence?.code_action, createur: selectedTache?.createur || user?.username, modificateur: user?.username }) })
      if (r.ok) { showAlert('success', selectedTache ? 'Tâche modifiée' : 'Tâche créée', () => { setShowTacheModal(false); fetchTaches(); fetchOccurrences() }) }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') }
  }
  
  const handleDeleteTache = (t) => {
    if (!canEditTache(t)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: 'Supprimer cette tâche ?', onConfirm: async () => {
      try { const r = await blockingFetch('/api/taches', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) }); if (r.ok) { showAlert('success', 'Tâche supprimée', () => { fetchTaches(); fetchOccurrences() }) } } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }

  // ============ EXPORT EXCEL ============
  const getUserName = (username) => {
    const u = users.find(x => x.username === username)
    return u ? `${u.nom} ${u.prenoms}` : username
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '-'

  const exportProjetsToExcel = () => {
    const filtered = getFilteredProjets()
    const data = filtered.map(p => ({
      'Code': p.code_groupe,
      'Libellé': p.libelle_groupe,
      'Gestionnaire(s)': getProjetGestionnaires(p).map(u => getUserName(u)).join(', '),
      'Type': p.type_projet || 'Public',
      'Commentaire': p.commentaire || '',
      'Statut': p.statut
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Projets')
    XLSX.writeFile(wb, `projets_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportActionsToExcel = () => {
    const filtered = getFilteredActions()
    const data = filtered.map(a => {
      const projet = getProjectForAction(a)
      const actionOccs = occurrences.filter(o => o.code_action === a.code_action)
      return {
        'Libellé': a.libelle_action,
        'Projet': getProjectLabelForAction(a),
        'Structure': a.code_structure,
        'Nb occurrences': actionOccs.length,
        'Commentaire': a.commentaire || '',
        'Statut': a.statut
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Actions')
    XLSX.writeFile(wb, `actions_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportSuiviActionsToExcel = () => {
    const filtered = getFilteredOccurrences()
    const data = filtered.map(o => {
      const a = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode))
      const p = getProjectForAction(a)
      const tx = getTxAvancementForOccurrence(o)
      const calc = calculateOccurrenceFields({...o, tx_avancement: tx})
      return {
        'Action': a?.libelle_action || '-',
        'Projet': p?.libelle_groupe || '-',
        'Structure': a?.code_structure || '-',
        'Responsable': getUserName(o.responsable),
        'Début': fmtDate(o.date_debut),
        'Fin': fmtDate(o.date_fin),
        'Avancement (%)': tx,
        'Niveau avancement': calc.niveauAvancement,
        'Réalisation': fmtDate(o.date_realisation),
        'Commentaire': o.commentaire || '',
        'Jours retard': calc.jourRetard,
        'Niveau retard': calc.niveauRetard
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Suivi Actions')
    XLSX.writeFile(wb, `suivi_actions_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ============ FILTRES ============
  const getFilteredProjets = (ignoreFilter = '') => projets.filter(p => canViewProjet(p) && !p.archive && (ignoreFilter === 'gestionnaire' || filterHasValue(projetFilters.gestionnaire, null) || getProjetGestionnaires(p).some(g => asFilterArray(projetFilters.gestionnaire).includes(g))) && (ignoreFilter === 'statut' || !projetFilters.statut || p.statut === projetFilters.statut) && (!projetFilters.search || p.libelle_groupe?.toLowerCase().includes(projetFilters.search.toLowerCase()) || p.code_groupe?.toLowerCase().includes(projetFilters.search.toLowerCase())))
  const getFilteredActions = (ignoreFilter = '') => actions.filter(a => canViewAction(a) && !a.archive && (ignoreFilter === 'projet' || filterHasValue(actionFilters.projet, getProjectCodeForAction(a))) && (ignoreFilter === 'type' || filterHasValue(actionFilters.type, getActionTypeProjet(a))) && (ignoreFilter === 'responsable' || filterHasValue(actionFilters.responsable, null) || getActionResponsables(a).some(r => asFilterArray(actionFilters.responsable).includes(r))) && (ignoreFilter === 'structure' || filterHasValue(actionFilters.structure, a.code_structure)) && (ignoreFilter === 'statut' || filterHasValue(actionFilters.statut, (a.statut || a.statut_act))) && (!actionFilters.search || a.libelle_action?.toLowerCase().includes(actionFilters.search.toLowerCase())))
  const getFilteredOccurrences = (sourceOccurrences = occurrences, ignoreFilter = '') => sourceOccurrences.filter(o => { 
    if (o.archive) return false
    const a = actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode))
    if (!a || !canViewAction(a) || !canViewOccurrence(o)) return false
    if (ignoreFilter !== 'projet' && !filterHasValue(suiviFilters.projet, getProjectCodeForAction(a))) return false
    if (ignoreFilter !== 'structure' && !filterHasValue(suiviFilters.structure, a.code_structure)) return false
    if (ignoreFilter !== 'responsable' && !filterHasValue(suiviFilters.responsable, o.responsable)) return false
    if (suiviFilters.search && !a.libelle_action?.toLowerCase().includes(suiviFilters.search.toLowerCase())) return false
    if (suiviFilters.dateDebut && o.date_debut < suiviFilters.dateDebut) return false
    if (suiviFilters.dateFin && o.date_fin > suiviFilters.dateFin) return false
    
    // Filtres niveau avancement et retard
    const tx = getTxAvancementForOccurrence(o)
    const calc = calculateOccurrenceFields({...o, tx_avancement: tx})
    
    if (ignoreFilter !== 'niveauAvancement' && !filterHasValue(suiviFilters.niveauAvancement, calc.niveauAvancement)) return false
    if (ignoreFilter !== 'niveauRetard' && !filterHasValue(suiviFilters.niveauRetard, calc.niveauRetard)) return false
    
    return true
  }).sort((a, b) => {
    const sortA = getSortPriority(a)
    const sortB = getSortPriority(b)
    // Tri primaire par priorité
    if (sortA.priority !== sortB.priority) return sortA.priority - sortB.priority
    // Tri secondaire par jours de retard décroissant (du plus grand au plus petit)
    return sortB.jourRetard - sortA.jourRetard
  })



  const getFilteredArchivedProjets = () => archivedItems.filter(p => p.archive && canViewProjet(p) && (!projetFilters.gestionnaire || getProjetGestionnaires(p).includes(projetFilters.gestionnaire)) && (!projetFilters.statut || p.statut === projetFilters.statut) && (!projetFilters.search || p.libelle_groupe?.toLowerCase().includes(projetFilters.search.toLowerCase()) || p.code_groupe?.toLowerCase().includes(projetFilters.search.toLowerCase())))
  const getFilteredArchivedActions = () => archivedItems.filter(a => a.archive && canViewAction(a) && filterHasValue(actionFilters.projet, getProjectCodeForAction(a)) && filterHasValue(actionFilters.type, getActionTypeProjet(a)) && (filterHasValue(actionFilters.responsable, null) || getActionResponsables(a).some(r => asFilterArray(actionFilters.responsable).includes(r))) && filterHasValue(actionFilters.structure, a.code_structure) && filterHasValue(actionFilters.statut, (a.statut || a.statut_act)) && (!actionFilters.search || a.libelle_action?.toLowerCase().includes(actionFilters.search.toLowerCase())))
  const getFilteredArchivedOccurrences = () => archivedItems.filter(o => {
    if (!o.archive) return false
    const linkedAction = o.action || actions.find(x => normalizeActionCode(x.code_action) === normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode)) || null
    if (!linkedAction) return true
    if (!canViewAction(linkedAction) || !canViewOccurrence(o)) return false
    if (!filterHasValue(suiviFilters.projet, getProjectCodeForAction(linkedAction))) return false
    if (!filterHasValue(suiviFilters.structure, linkedAction.code_structure)) return false
    if (!filterHasValue(suiviFilters.responsable, o.responsable)) return false
    if (suiviFilters.search && !(o.libelle_action || linkedAction.libelle_action || '').toLowerCase().includes(suiviFilters.search.toLowerCase())) return false
    if (suiviFilters.dateDebut && o.date_debut < suiviFilters.dateDebut) return false
    if (suiviFilters.dateFin && o.date_fin > suiviFilters.dateFin) return false
    const tx = getTxAvancementForOccurrence(o)
    const calc = calculateOccurrenceFields({...o, tx_avancement: tx})
    if (!filterHasValue(suiviFilters.niveauAvancement, calc.niveauAvancement)) return false
    if (!filterHasValue(suiviFilters.niveauRetard, calc.niveauRetard)) return false
    return true
  }).sort((a, b) => {
    const sortA = getSortPriority(a)
    const sortB = getSortPriority(b)
    if (sortA.priority !== sortB.priority) return sortA.priority - sortB.priority
    return sortB.jourRetard - sortA.jourRetard
  })

  const renderArchivedProjets = () => {
    const filtered = getFilteredArchivedProjets()
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-3 shadow-sm border mobile-no-shrink overflow-x-auto"><div className="mobile-inline-scroll flex flex-nowrap gap-3 items-end min-w-max">
          <div className="w-44 flex-none"><SearchableSelect label="Gestionnaire" value={projetFilters.gestionnaire} onChange={v => setProjetFilters({...projetFilters, gestionnaire: v})} options={userOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-28 flex-none"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={projetFilters.statut} onChange={e => setProjetFilters({...projetFilters, statut: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div>
          <div className="w-80 flex-none"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher..." value={projetFilters.search} onChange={e => setProjetFilters({...projetFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <button onClick={() => setProjetFilters({gestionnaire:[], statut:'', search:''})} className="p-1.5 hover:bg-gray-100 rounded border flex-none" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
        </div></div>
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Code</th><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-center text-white">Type</th><th className="px-2 py-2 text-left text-white">Gestionnaire(s)</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Aucun projet archivé</td></tr> : filtered.map(p => {
                  const gest = getProjetGestionnaires(p)
                  return <tr key={p.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 font-mono font-bold text-blue-600">{p.code_groupe}</td><td className="px-2 py-1.5">{p.libelle_groupe}</td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${p.type_projet === 'Privé' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{p.type_projet || 'Public'}</span></td><td className="px-2 py-1.5 text-gray-600 max-w-[200px] truncate">{gest.join(', ') || '-'}</td><td className="px-2 py-1.5 text-center"><StatusBadge status={p.statut} /></td><td className="px-2 py-1.5 text-center"><button onClick={() => handlePermanentDelete('projet', p.id, p.libelle_groupe)} className="p-1 hover:bg-red-100 rounded" title="Supprimer définitivement"><Trash2 size={12} className="text-red-600"/></button></td></tr>
                })}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {filtered.length}</div>
        </div>
      </div>
    )
  }

  const renderArchivedActions = () => {
    const filtered = getFilteredArchivedActions()
    const archivedActionRows = archivedItems.filter(a => a.archive && canViewAction(a) && (!actionFilters.search || a.libelle_action?.toLowerCase().includes(actionFilters.search.toLowerCase())))
    const archivedRowsFor = (ignoreFilter = '') => archivedActionRows.filter(a => (ignoreFilter === 'projet' || filterHasValue(actionFilters.projet, getProjectCodeForAction(a))) && (ignoreFilter === 'type' || filterHasValue(actionFilters.type, getActionTypeProjet(a))) && (ignoreFilter === 'responsable' || filterHasValue(actionFilters.responsable, null) || getActionResponsables(a).some(r => asFilterArray(actionFilters.responsable).includes(r))) && (ignoreFilter === 'structure' || filterHasValue(actionFilters.structure, a.code_structure)) && (ignoreFilter === 'statut' || filterHasValue(actionFilters.statut, (a.statut || a.statut_act))))
    const dynamicProjetOptions = buildOptionsFromItems(archivedRowsFor('projet'), a => getProjectCodeForAction(a), a => getProjectLabelForAction(a))
    const dynamicTypeOptions = buildOptionsFromItems(archivedRowsFor('type'), a => getActionTypeProjet(a), (a, type) => type)
    const dynamicResponsableOptions = buildOptionsFromItems(archivedRowsFor('responsable'), a => getActionResponsables(a), (a, username) => { const u = users.find(x => x.username === username); return u ? `${u.nom} ${u.prenoms} (${u.username})` : username })
    const dynamicStructureOptions = buildOptionsFromItems(archivedRowsFor('structure'), a => a.code_structure, a => { const st = structures.find(s => s.code_structure === a.code_structure); return st?.libelle_structure || a.code_structure })
    const dynamicStatutOptions = buildOptionsFromItems(archivedRowsFor('statut'), a => (a.statut || a.statut_act), (a, statut) => statut)
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-3 shadow-sm border flex flex-wrap gap-3 items-end">
          <div className="w-56"><SearchableFilterMultiSelect label="Groupe" value={actionFilters.projet} onChange={v => setActionFilters({...actionFilters, projet: v})} options={dynamicProjetOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-44"><SearchableFilterMultiSelect label="Type" value={actionFilters.type} onChange={v => setActionFilters({...actionFilters, type: v})} options={dynamicTypeOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-56"><SearchableFilterMultiSelect label="Responsable" value={actionFilters.responsable} onChange={v => setActionFilters({...actionFilters, responsable: v})} options={dynamicResponsableOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-56"><SearchableFilterMultiSelect label="Structure" value={actionFilters.structure} onChange={v => setActionFilters({...actionFilters, structure: v})} options={dynamicStructureOptions} placeholder="Toutes" size="sm"/></div>
          <div className="w-44"><SearchableFilterMultiSelect label="Statut" value={actionFilters.statut} onChange={v => setActionFilters({...actionFilters, statut: v})} options={dynamicStatutOptions} placeholder="Tous" size="sm"/></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher..." value={actionFilters.search} onChange={e => setActionFilters({...actionFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <button onClick={() => setActionFilters({projet:[], type:[], responsable:[], structure:[], statut:[], search:''})} className="p-1.5 hover:bg-gray-100 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-left text-white">Projet</th><th className="px-2 py-2 text-left text-white">Structure</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Aucune action archivée</td></tr> : filtered.map(a => {
                  const projet = getProjectForAction(a)
                  return <tr key={a.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 max-w-[300px] truncate">{a.libelle_action}</td><td className="px-2 py-1.5 text-gray-600">{getProjectLabelForAction(a)}</td><td className="px-2 py-1.5 text-gray-600">{a.code_structure}</td><td className="px-2 py-1.5 text-center"><StatusBadge status={a.statut_act || a.statut || 'Inactif'} /></td><td className="px-2 py-1.5 text-center"><button onClick={() => handlePermanentDelete('action', a.id, a.libelle_action)} className="p-1 hover:bg-red-100 rounded" title="Supprimer définitivement"><Trash2 size={12} className="text-red-600"/></button></td></tr>
                })}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {filtered.length}</div>
        </div>
      </div>
    )
  }

  const renderArchivedOccurrences = () => {
    const filtered = getFilteredArchivedOccurrences()
    const niveauAvancementOptions = [
      { value: '', label: 'Tous' },
      { value: 'Non entamée', label: 'Non entamée' },
      { value: 'En cours <50%', label: 'En cours <50%' },
      { value: 'En cours ≥50%', label: 'En cours ≥50%' },
      { value: 'Terminée att. conf.', label: 'Terminée att. conf.' },
      { value: 'Achevée', label: 'Achevée' }
    ]
    const niveauRetardOptions = [{ value: '', label: 'Tous' }, { value: 'À temps', label: 'À temps' }, { value: 'Retard', label: 'Retard' }]
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-3 shadow-sm border flex flex-wrap gap-3 items-end">
          <div className="w-52"><SearchableSelect label="Projet" value={suiviFilters.projet} onChange={v => setSuiviFilters({...suiviFilters, projet: v})} options={projetFilterOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-48"><SearchableSelect label="Structure" value={suiviFilters.structure} onChange={v => setSuiviFilters({...suiviFilters, structure: v})} options={structureFilterOptions} placeholder="Toutes" size="sm"/></div>
          <div className="w-48"><SearchableSelect label="Responsable" value={suiviFilters.responsable} onChange={v => setSuiviFilters({...suiviFilters, responsable: v})} options={userOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-36"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niveau av.</label><select value={suiviFilters.niveauAvancement} onChange={e => setSuiviFilters({...suiviFilters, niveauAvancement: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs">{niveauAvancementOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niv. ret.</label><select value={suiviFilters.niveauRetard} onChange={e => setSuiviFilters({...suiviFilters, niveauRetard: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs">{niveauRetardOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
          <div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Début ≥</label><input type="date" value={suiviFilters.dateDebut} onChange={e => setSuiviFilters({...suiviFilters, dateDebut: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Fin ≤</label><input type="date" value={suiviFilters.dateFin} onChange={e => setSuiviFilters({...suiviFilters, dateFin: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <div className="flex-1 min-w-[180px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher..." value={suiviFilters.search} onChange={e => setSuiviFilters({...suiviFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <button onClick={() => setSuiviFilters(emptySuiviFilters())} className="p-1.5 hover:bg-gray-100 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
        </div>
        {dashboardPendingOnly && <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">Affichage direct des occurrences d'actions en attente de réalisation.</div>}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Action</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Tx%</th><th className="px-2 py-2 text-center text-white">Niv. avancement</th><th className="px-2 py-2 text-center text-white">Jr ret.</th><th className="px-2 py-2 text-center text-white">Niv. retard</th><th className="px-2 py-2 text-center text-white">Conf.</th><th className="px-2 py-2 text-left text-white">Responsable</th><th className="px-2 py-2 text-center text-white">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">Aucune occurrence archivée</td></tr> : filtered.map((o, i) => {
                  const action = o.action || actions.find(x => x.code_action === o.code_action)
                  const txAvancement = getTxAvancementForOccurrence(o)
                  const hasTaches = hasOccurrenceTaches(o)
                  const calc = calculateOccurrenceFields({...o, tx_avancement: txAvancement})
                  const confEffective = txAvancement >= 100 && o.gestionnaire_conf === 'Oui'
                  const bgColor = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  return <tr key={o.id} className={`hover:bg-blue-50/50 ${bgColor}`}><td className={`px-2 py-1.5 sticky left-0 z-10 ${bgColor} border-r min-w-[270px] max-w-[270px]`} title={o.libelle_action || action?.libelle_action}><div className="whitespace-normal break-words leading-tight" style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{o.libelle_action || action?.libelle_action || '-'}</div></td><td className="px-2 py-1.5 text-center">{o.date_debut ? new Date(o.date_debut).toLocaleDateString('fr-FR') : '-'}</td><td className="px-2 py-1.5 text-center">{o.date_fin ? new Date(o.date_fin).toLocaleDateString('fr-FR') : '-'}</td><td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] font-bold ${txAvancement >= 100 ? 'bg-green-100 text-green-800' : txAvancement > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{txAvancement}%</span>{hasTaches && <span className="ml-0.5 text-[8px] text-gray-400">(calc)</span>}</td><td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauAvancement === 'Achevée' ? 'bg-green-100 text-green-700' : calc.niveauAvancement.includes('Terminée') ? 'bg-blue-100 text-blue-700' : calc.niveauAvancement.includes('+50') ? 'bg-yellow-100 text-yellow-700' : calc.niveauAvancement.includes('-50') ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{calc.niveauAvancement}</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] font-medium ${calc.jourRetard > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.jourRetard}j</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauRetard === 'Retard' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.niveauRetard}</span></td><td className="px-2 py-1.5 text-center">{txAvancement < 100 ? <span className="text-gray-300 text-[9px]">- (tx&lt;100%)</span> : confEffective ? <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Oui</span> : <span className="text-gray-400 text-[9px]">Non confirmé</span>}</td><td className="px-2 py-1.5 text-gray-600 truncate max-w-[80px]">{o.responsable || '-'}</td><td className={`px-2 py-1.5 sticky right-0 z-10 ${bgColor} border-l`}><button onClick={() => handlePermanentDelete('suivi_action', o.id, `${action?.libelle_action || 'Occurrence'} (${o.code_occurrence || o.id})`)} className="p-0.5 hover:bg-red-100 rounded" title="Supprimer définitivement"><Trash2 size={12} className="text-red-600"/></button></td></tr>
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-gray-50 border-t text-[10px] text-gray-500">Total: {filtered.length}</div>
        </div>
      </div>
    )
  }

  const renderArchivesModalContent = () => {
    if (archiveType === 'projet') return renderArchivedProjets()
    if (archiveType === 'action') return renderArchivedActions()
    return renderArchivedOccurrences()
  }

  // ============ RENDER PROJETS ============
  const renderProjets = () => {
    const filtered = getFilteredProjets()
    const gestionnaireOptionRows = getFilteredProjets('gestionnaire')
    const dynamicGestionnaireOptions = buildOptionsFromItems(gestionnaireOptionRows, p => getProjetGestionnaires(p), (p, username) => { const u = users.find(x => x.username === username); return u ? `${u.nom} ${u.prenoms} (${u.username})` : username })
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mobile-header-stack">
          <h2 className="text-lg font-bold text-gray-900">Projets</h2>
          <div className="flex gap-2 mobile-header-actions">
            {canCreateProjects() && <Button size="sm" icon={Plus} onClick={() => { setSelectedProjet(null); setProjetForm({ libelle_groupe: '', commentaire: '', gestionnaires: [], membres: [], type_projet: 'Public', statut: 'Actif' }); setShowProjetModal(true) }}>Nouveau projet</Button>}
            <Button size="sm" variant="secondary" onClick={exportProjetsToExcel}><Download size={14} className="mr-1"/>Excel</Button>
            <button onClick={() => runBlockingAction(() => handleViewArchives('projet'))} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"><Archive size={14}/>Archives</button>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border flex flex-wrap gap-3 items-end">
          <div className="w-56"><SearchableFilterMultiSelect label="Gestionnaire" value={projetFilters.gestionnaire} onChange={v => setProjetFilters({...projetFilters, gestionnaire: v})} options={dynamicGestionnaireOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={projetFilters.statut} onChange={e => setProjetFilters({...projetFilters, statut: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div>
          <div className="flex-1 max-w-xs"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher..." value={projetFilters.search} onChange={e => setProjetFilters({...projetFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <button onClick={() => setProjetFilters({gestionnaire:[], statut:'', search:''})} className="p-1.5 hover:bg-gray-100 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Code</th><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-center text-white">Type</th><th className="px-2 py-2 text-left text-white">Gestionnaire(s)</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{minWidth:'120px'}}>Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Chargement...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Aucun projet</td></tr> : filtered.map(p => {
                  const gest = getProjetGestionnaires(p), isRisques = p.code_groupe === 'RISQUES', canEdit = canEditProjet(p), canDel = canDeleteProjet(p), canMbr = canViewMembres(p)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-mono font-bold text-blue-600">{p.code_groupe}</td>
                      <td className="px-2 py-1.5">{p.libelle_groupe}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${p.type_projet === 'Privé' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{p.type_projet || 'Public'}</span></td>
                      <td className="px-2 py-1.5 text-gray-600 max-w-[200px] truncate">{gest.join(', ') || '-'}</td>
                      <td className="px-2 py-1.5 text-center"><StatusBadge status={p.statut} /></td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isRisques ? (
                            <span className="text-gray-400 text-[9px] italic" title="Gestionnaires gérés dans 'Gestion des risques'">🔒 Géré ailleurs</span>
                          ) : (
                            <>
                              <button onClick={() => { setSelectedProjet(p); setProjetForm({...p, gestionnaires: gest, membres: Array.isArray(p.membres) ? p.membres : JSON.parse(p.membres || '[]')}); setShowProjetModal(true) }} className="p-1 hover:bg-blue-100 rounded" title={canEdit ? "Modifier" : "Consulter"}><Edit size={12} className={canEdit ? "text-blue-600" : "text-gray-500"}/></button>
                              {canMbr && <button onClick={() => { setSelectedProjet(p); setShowMembresModal(true) }} className="p-1 hover:bg-purple-100 rounded" title="Membres"><Users size={12} className="text-purple-600"/></button>}
                              {canDel && <button onClick={() => handleDeleteProjet(p)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
                              {canEdit && <button onClick={() => handleArchive('projet', p.id, p.libelle_groupe)} className="p-1 hover:bg-orange-100 rounded" title="Archiver"><Archive size={12} className="text-orange-600"/></button>}
                              {!canEdit && !isSuperManager() && <span className="text-gray-400 text-[9px] italic">Lecture seule</span>}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {filtered.length}</div>
        </div>
        <Modal isOpen={showProjetModal} onClose={() => setShowProjetModal(false)} title={selectedProjet ? (selectedProjet.code_groupe === 'RISQUES' ? 'Gestionnaires Risques' : (canEditProjet(selectedProjet) ? 'Modifier' : 'Consultation du projet')) : 'Nouveau projet'} size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            {selectedProjet?.code_groupe !== 'RISQUES' && <><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Code *</label><input type="text" value={projetForm.code_groupe || ''} onChange={e => setProjetForm({...projetForm, code_groupe: e.target.value.toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '')})} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Ex: PROJ01" maxLength={20} disabled={!!selectedProjet}/><p className="text-xs text-gray-500 mt-1">Max 20 caractères, sans espaces</p></div><div><label className="block text-sm font-medium mb-1">Libellé *</label><input type="text" value={projetForm.libelle_groupe || ''} onChange={e => setProjetForm({...projetForm, libelle_groupe: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedProjet && !canEditProjet(selectedProjet)}/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Type</label><select value={projetForm.type_projet || 'Public'} onChange={e => setProjetForm({...projetForm, type_projet: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedProjet && !canEditProjet(selectedProjet)}><option value="Public">Public</option><option value="Privé">Privé</option></select></div><div><label className="block text-sm font-medium mb-1">Statut</label><select value={projetForm.statut || 'Actif'} onChange={e => setProjetForm({...projetForm, statut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedProjet && !canEditProjet(selectedProjet)}><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div></div></>}
            <SearchableSelect label="Gestionnaire(s) *" value={projetForm.gestionnaires} onChange={v => setProjetForm({...projetForm, gestionnaires: v})} options={userOptions} multiple placeholder="Sélectionner..." disabled={selectedProjet && !canEditProjet(selectedProjet)}/>
            {selectedProjet?.code_groupe !== 'RISQUES' && <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={projetForm.commentaire || ''} onChange={e => setProjetForm({...projetForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={selectedProjet && !canEditProjet(selectedProjet)}/></div>}
            <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={() => setShowProjetModal(false)}>Fermer</Button>{(canEditProjet(selectedProjet) || !selectedProjet) && <Button onClick={() => runBlockingAction(selectedProjet?.code_groupe === 'RISQUES' ? handleUpdateGestionnairesRisques : handleSaveProjet)}>Enregistrer</Button>}</div>
          </div>
        </Modal>
        <Modal isOpen={showMembresModal} onClose={() => setShowMembresModal(false)} title={`Membres - ${selectedProjet?.libelle_groupe}`} size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            <SearchableSelect label="Ajouter un membre" value="" onChange={v => v && handleAddMembre(v)} options={userOptions.filter(u => !getProjetMembres(selectedProjet).includes(u.value))} placeholder="Rechercher..."/>
            <div><label className="block text-sm font-medium mb-2">Membres actuels</label><div className="border rounded-lg overflow-hidden"><table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]"><tr><th className="px-2 py-2 text-left text-white">Nom</th><th className="px-2 py-2 text-left text-white">Username</th><th className="px-2 py-2 text-center text-white">Rôle</th><th className="px-2 py-2 text-right text-white">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{(() => { const membres = getProjetMembres(selectedProjet), gest = getProjetGestionnaires(selectedProjet); return membres.length === 0 ? <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-500">Aucun</td></tr> : membres.map(m => { const u = users.find(x => x.username === m), isGest = gest.includes(m); return <tr key={m} className="hover:bg-gray-50"><td className="px-2 py-1.5">{u ? `${u.nom} ${u.prenoms}` : m}</td><td className="px-2 py-1.5 text-gray-600">{m}</td><td className="px-2 py-1.5 text-center">{isGest && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">Gestionnaire</span>}</td><td className="px-2 py-1.5 text-right">{!isGest && <button onClick={() => handleRemoveMembre(m)} className="p-1 hover:bg-red-100 rounded"><UserMinus size={12} className="text-red-600"/></button>}</td></tr> }) })()}</tbody></table></div></div>
            <div className="flex justify-end pt-4 border-t"><Button variant="secondary" onClick={() => setShowMembresModal(false)}>Fermer</Button></div>
          </div>
        </Modal>
      </div>
    )
  }

  // ============ RENDER ACTIONS ============
  const renderActions = () => {
    const filtered = getFilteredActions()
    const canCreateAny = projets.some(p => canCreateAction(p))
    const projetOptionRows = getFilteredActions('projet')
    const typeOptionRows = getFilteredActions('type')
    const responsableOptionRows = getFilteredActions('responsable')
    const structureOptionRows = getFilteredActions('structure')
    const statutOptionRows = getFilteredActions('statut')
    const dynamicProjetOptions = buildOptionsFromItems(projetOptionRows, a => getProjectCodeForAction(a), a => getProjectLabelForAction(a))
    const dynamicTypeOptions = buildOptionsFromItems(typeOptionRows, a => getActionTypeProjet(a), (a, type) => type)
    const dynamicResponsableOptions = buildOptionsFromItems(responsableOptionRows, a => getActionResponsables(a), (a, username) => { const u = users.find(x => x.username === username); return u ? `${u.nom} ${u.prenoms} (${u.username})` : username })
    const dynamicStructureOptions = buildOptionsFromItems(structureOptionRows, a => a.code_structure, a => { const st = structures.find(s => s.code_structure === a.code_structure); return st?.libelle_structure || a.code_structure })
    const dynamicStatutOptions = buildOptionsFromItems(statutOptionRows, a => (a.statut || a.statut_act), (a, statut) => statut)
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mobile-header-stack">
          <h2 className="text-lg font-bold text-gray-900">Actions</h2>
          <div className="flex gap-2 mobile-header-actions">
            {canCreateAny && <Button size="sm" icon={Plus} onClick={() => { setSelectedAction(null); setActionForm({ libelle_action: '', code_groupe: '', code_structure: '', commentaire: '', statut: 'Actif', occ_date_debut: '', occ_date_fin: '', occ_responsable: '' }); setShowActionModal(true) }}>Nouvelle action</Button>}
            <Button size="sm" variant="secondary" onClick={exportActionsToExcel}><Download size={14} className="mr-1"/>Excel</Button>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border flex flex-wrap gap-3 items-end">
          <div className="w-56"><SearchableFilterMultiSelect label="Groupe" value={actionFilters.projet} onChange={v => setActionFilters({...actionFilters, projet: v})} options={dynamicProjetOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-44"><SearchableFilterMultiSelect label="Type" value={actionFilters.type} onChange={v => setActionFilters({...actionFilters, type: v})} options={dynamicTypeOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-56"><SearchableFilterMultiSelect label="Responsable" value={actionFilters.responsable} onChange={v => setActionFilters({...actionFilters, responsable: v})} options={dynamicResponsableOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-56"><SearchableFilterMultiSelect label="Structure" value={actionFilters.structure} onChange={v => setActionFilters({...actionFilters, structure: v})} options={dynamicStructureOptions} placeholder="Toutes" size="sm"/></div>
          <div className="w-44"><SearchableFilterMultiSelect label="Statut" value={actionFilters.statut} onChange={v => setActionFilters({...actionFilters, statut: v})} options={dynamicStatutOptions} placeholder="Tous" size="sm"/></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher..." value={actionFilters.search} onChange={e => setActionFilters({...actionFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <button onClick={() => runBlockingAction(() => handleViewArchives('action'))} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 self-end"><Archive size={14}/>Archives</button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-left text-white">Projet</th><th className="px-2 py-2 text-left text-white">Structure</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{minWidth:'140px'}}>Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Chargement...</td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Aucune action</td></tr> : filtered.map(a => {
                  const projet = getProjectForAction(a), actionOccs = occurrences.filter(o => normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode) === normalizeActionCode(a.code_action)), canEdit = canEditAction(a)
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 max-w-[300px] truncate">{a.libelle_action}</td>
                      <td className="px-2 py-1.5 text-gray-600">{getProjectLabelForAction(a)}</td>
                      <td className="px-2 py-1.5 text-gray-600">{a.code_structure}</td>
                      <td className="px-2 py-1.5 text-center"><StatusBadge status={a.statut} /></td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setSelectedAction(a); setActionForm({...a}); setShowActionModal(true) }} className="p-1 hover:bg-blue-100 rounded" title={canEdit ? "Modifier" : "Consulter"}><Edit size={12} className={canEdit ? "text-blue-600" : "text-gray-500"}/></button>
                          {canEdit && (
                            <>
                              <button onClick={() => handleDeleteAction(a)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>
                              {a.statut === 'Actif' && (projets.find(p => p.code_groupe === a.code_groupe)?.statut !== 'Inactif') && <button onClick={() => handleOpenOccurrenceForm(a)} className="p-1 hover:bg-green-100 rounded" title="Ouvrir occurrence"><PlayCircle size={12} className="text-green-600"/></button>}
                              <button onClick={() => handleArchive('action', a.id, a.libelle_action)} className="p-1 hover:bg-orange-100 rounded" title="Archiver"><Archive size={12} className="text-orange-600"/></button>
                            </>
                          )}
                          <button onClick={() => { setSelectedAction(a); setShowOccurrencesListModal(true) }} className="p-1 hover:bg-purple-100 rounded" title={`Voir occurrences (${actionOccs.length})`}><Eye size={12} className="text-purple-600"/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {filtered.length}</div>
        </div>
        <Modal isOpen={showActionModal} onClose={() => setShowActionModal(false)} title={selectedAction ? (canEditAction(selectedAction) ? "Modifier l\'action" : "Consultation de l\'action") : 'Nouvelle action'} size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Libellé *</label><input type="text" value={actionForm.libelle_action || ''} onChange={e => setActionForm({...actionForm, libelle_action: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedAction && !canEditAction(selectedAction)}/></div>
            <div className="grid grid-cols-2 gap-4">
              <SearchableSelect label="Projet *" value={actionForm.code_groupe} onChange={v => setActionForm({...actionForm, code_groupe: v, occ_responsable: ''})} options={projetOptions} placeholder="Sélectionner..." disabled={selectedAction && !canEditAction(selectedAction)}/>
              <SearchableSelect label="Structure *" value={actionForm.code_structure} onChange={v => setActionForm({...actionForm, code_structure: v, occ_responsable: ''})} options={structureOptions} placeholder="Sélectionner..." disabled={selectedAction && !canEditAction(selectedAction)}/>
            </div>
            <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={actionForm.commentaire || ''} onChange={e => setActionForm({...actionForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={selectedAction && !canEditAction(selectedAction)}/></div>
            <div><label className="block text-sm font-medium mb-1">Statut</label><select value={actionForm.statut || 'Actif'} onChange={e => setActionForm({...actionForm, statut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedAction && !canEditAction(selectedAction)}><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div>
            {!selectedAction && <div className="border-t pt-4 mt-4"><h4 className="text-sm font-semibold text-gray-700 mb-3">Planification de la première occurrence</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Date début *</label><input type="date" value={actionForm.occ_date_debut || ''} onChange={e => setActionForm({...actionForm, occ_date_debut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/></div><div><label className="block text-sm font-medium mb-1">Date fin *</label><input type="date" value={actionForm.occ_date_fin || ''} onChange={e => setActionForm({...actionForm, occ_date_fin: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/></div></div><div className="mt-3"><SearchableSelect label="Responsable * (membre du projet + structure)" value={actionForm.occ_responsable} onChange={v => setActionForm({...actionForm, occ_responsable: v})} options={getResponsablesForAction().map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms} (${u.username})` }))} placeholder={!actionForm.code_groupe ? '-- Sélectionner projet --' : !actionForm.code_structure ? '-- Sélectionner structure --' : 'Sélectionner...'} disabled={!actionForm.code_groupe || !actionForm.code_structure}/>{actionForm.code_groupe && actionForm.code_structure && getResponsablesForAction().length === 0 && <p className="text-xs text-orange-600 mt-1">Aucun membre du projet dans cette structure.</p>}</div></div>}
            <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={() => setShowActionModal(false)}>Fermer</Button>{(!selectedAction || canEditAction(selectedAction)) && <Button onClick={() => runBlockingAction(handleSaveAction)}>Enregistrer</Button>}</div>
          </div>
        </Modal>
        <Modal isOpen={showOccurrencesListModal} onClose={() => setShowOccurrencesListModal(false)} title={`Occurrences - ${selectedAction?.libelle_action}`} size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            {occurrences.filter(o => normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode) === normalizeActionCode(selectedAction?.code_action)).length === 0 ? <p className="text-center text-gray-500 py-6 text-xs">Aucune occurrence</p> : <table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]"><tr><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Tx%</th><th className="px-2 py-2 text-left text-white">Responsable</th><th className="px-2 py-2 text-center text-white">Conf.</th><th className="px-2 py-2 text-center text-white">Statut</th></tr></thead><tbody className="divide-y divide-gray-100">{occurrences.filter(o => normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode) === normalizeActionCode(selectedAction?.code_action)).map(o => { const tx = getTxAvancementForOccurrence(o); const calc = calculateOccurrenceFields({...o, tx_avancement: tx}); const isAchevee = calc.niveauAvancement === 'Achevée'; return <tr key={o.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 text-center">{o.date_debut ? new Date(o.date_debut).toLocaleDateString('fr-FR') : '-'}</td><td className="px-2 py-1.5 text-center">{o.date_fin ? new Date(o.date_fin).toLocaleDateString('fr-FR') : '-'}</td><td className="px-2 py-1.5 text-center">{tx}%</td><td className="px-2 py-1.5">{o.responsable || '-'}</td><td className="px-2 py-1.5 text-center">{tx >= 100 && o.gestionnaire_conf === 'Oui' ? <span className="text-green-600">✓</span> : '-'}</td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${isAchevee ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{calc.niveauAvancement}</span></td></tr> })}</tbody></table>}
            <div className="flex justify-end pt-4 border-t"><Button variant="secondary" onClick={() => setShowOccurrencesListModal(false)}>Fermer</Button></div>
          </div>
        </Modal>
      </div>
    )
  }

  const handleSendActionReminder = async (occurrence) => {
    if (!canTriggerActionReminder(occurrence)) return
    showAlert('confirm', "Envoyer un mail de relance pour cette action ?", async () => {
      try {
        const res = await blockingFetch('/api/emailing/item-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'action', occurrenceId: occurrence.id })
        })
        const data = await res.json()
        if (res.ok) showAlert('success', data.message || 'Mail de relance envoyé avec succès.')
        else showAlert('error', data.error || "Erreur lors de l'envoi du mail de relance")
      } catch (error) {
        console.error('Erreur relance action:', error)
        showAlert('error', "Erreur lors de l'envoi du mail de relance")
      }
    })
  }

  // ============ RENDER SUIVI ============
  const renderSuivi = () => {
    const filtered = getFilteredOccurrences()
    const getActionForOccurrence = (o) => actions.find(a => normalizeActionCode(a.code_action) === normalizeActionCode(o.code_action || o.code_action_occ || o.__actionCode))
    // Les listes de modalités doivent refléter exactement le contenu du tableau affiché,
    // donc elles sont construites à partir des occurrences déjà filtrées.
    const projectOptionRows = getFilteredOccurrences(occurrences, 'projet')
    const structureOptionRows = getFilteredOccurrences(occurrences, 'structure')
    const responsableOptionRows = getFilteredOccurrences(occurrences, 'responsable')
    const niveauAvancementOptionRows = getFilteredOccurrences(occurrences, 'niveauAvancement')
    const dynamicProjetFilterOptions = buildOptionsFromOccurrences(projectOptionRows, o => getProjectCodeForAction(getActionForOccurrence(o)), o => getProjectLabelForAction(getActionForOccurrence(o)))
    const dynamicStructureFilterOptions = buildOptionsFromOccurrences(structureOptionRows, o => (getActionForOccurrence(o) || {}).code_structure, o => { const code = (getActionForOccurrence(o) || {}).code_structure; const st = structures.find(s => s.code_structure === code); return st?.libelle_structure || code })
    const dynamicResponsableFilterOptions = buildOptionsFromOccurrences(responsableOptionRows, o => o.responsable, o => { const u = users.find(x => x.username === o.responsable); return u ? `${u.nom} ${u.prenoms}` : o.responsable })
    const niveauAvancementOptions = [
      { value: '', label: 'Tous' },
      { value: 'Non entamée', label: 'Non entamée' },
      { value: 'En cours -50%', label: 'En cours -50%' },
      { value: 'En cours +50%', label: 'En cours +50%' },
      { value: 'Terminée - non confirmée', label: 'Terminée - non confirmée' },
      { value: 'Achevée', label: 'Achevée' }
    ]
    const niveauRetardOptions = [
      { value: '', label: 'Tous' },
      { value: 'Retard', label: 'Retard' },
      { value: 'Pas retard', label: 'Pas retard' }
    ]
    const dynamicNiveauAvancementOptions = buildOptionsFromOccurrences(niveauAvancementOptionRows, o => calculateOccurrenceFields({...o, tx_avancement: getTxAvancementForOccurrence(o)}).niveauAvancement, o => calculateOccurrenceFields({...o, tx_avancement: getTxAvancementForOccurrence(o)}).niveauAvancement)

    
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Suivi des actions</h2>
        <div className="bg-white rounded-lg p-3 shadow-sm border space-y-2">
          {/* Première ligne - Tous les filtres */}
          <div className="mobile-inline-scroll flex flex-wrap md:flex-nowrap items-end gap-2">
            <div className="w-56"><SearchableFilterMultiSelect label="Projet" value={suiviFilters.projet} onChange={v => setSuiviFilters({...suiviFilters, projet: v})} options={dynamicProjetFilterOptions} placeholder="Tous" size="sm"/></div>
            <div className="w-56"><SearchableFilterMultiSelect label="Structure" value={suiviFilters.structure} onChange={v=>setSuiviFilters({...suiviFilters,structure:v})} options={dynamicStructureFilterOptions} placeholder="Toutes" size="sm"/></div>
            <div className="w-56"><SearchableFilterMultiSelect label="Responsable" value={suiviFilters.responsable} onChange={v=>setSuiviFilters({...suiviFilters,responsable:v})} options={dynamicResponsableFilterOptions} placeholder="Tous" size="sm"/></div>
            <div className="w-56"><SearchableFilterMultiSelect label="Niveau avancement" value={suiviFilters.niveauAvancement} onChange={v => setSuiviFilters({...suiviFilters, niveauAvancement: v})} options={dynamicNiveauAvancementOptions} placeholder="Tous" size="sm"/></div>
            <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niv. retard</label><select value={suiviFilters.niveauRetard} onChange={e => setSuiviFilters({...suiviFilters, niveauRetard: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs">{niveauRetardOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          </div>
          {/* Seconde ligne - Dates + Recherche + Reset + Export */}
          <div className="mobile-inline-scroll flex flex-wrap md:flex-nowrap gap-2 items-end">
            <div className="w-[115px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Date début ≥</label><input type="date" value={suiviFilters.dateDebut} onChange={e => setSuiviFilters({...suiviFilters, dateDebut: e.target.value})} className="w-full px-1.5 py-1.5 rounded border text-xs"/></div>
            <div className="w-[115px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Date fin ≤</label><input type="date" value={suiviFilters.dateFin} onChange={e => setSuiviFilters({...suiviFilters, dateFin: e.target.value})} className="w-full px-1.5 py-1.5 rounded border text-xs"/></div>
            <div className="flex-1 min-w-[220px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher une action..." value={suiviFilters.search} onChange={e => setSuiviFilters({...suiviFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
            <button onClick={() => setSuiviFilters(emptySuiviFilters())} className="p-1.5 hover:bg-gray-100 rounded border self-end" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
            <Button size="sm" variant="secondary" onClick={exportSuiviActionsToExcel}><Download size={14} className="mr-1"/>Excel</Button>
            <button onClick={() => runBlockingAction(() => handleViewArchives('suivi_action'))} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 self-end"><Archive size={14}/>Archives</button>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]" style={{minWidth:'1260px'}}>
              <thead className="sticky top-0 bg-gradient-to-r from-[#1a365d] to-[#2c5282] z-20"><tr><th className="px-2 py-2 text-left text-white sticky left-0 bg-[#1a365d] z-30 min-w-[270px] max-w-[270px]">Action</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Tx%</th><th className="px-2 py-2 text-center text-white">Niveau av.</th><th className="px-2 py-2 text-center text-white">Réalisat.</th><th className="px-2 py-2 text-center text-white">Jr ret.</th><th className="px-2 py-2 text-center text-white">Niv. ret.</th><th className="px-2 py-2 text-center text-white min-w-[90px]">Conf. Gest.</th><th className="px-2 py-2 text-left text-white">Resp.</th><th className="px-2 py-2 text-center text-white sticky right-0 bg-[#1a365d] z-30 min-w-[100px]">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-500">Chargement...</td></tr> : filtered.length === 0 ? <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-500">Aucune occurrence</td></tr> : filtered.map((o, i) => {
                  const action = actions.find(a => a.code_action === o.code_action)
                  const txAvancement = getTxAvancementForOccurrence(o)
                  const calc = calculateOccurrenceFields({...o, tx_avancement: txAvancement})
                  const hasTaches = hasOccurrenceTaches(o)
                  const occId = o.code_occurrence || o.id
                  const occTaches = taches.filter(t => t.code_occurrence === occId)
                  const bgColor = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  const canEditOcc = canEditOccurrence(o)
                  const canValidateOcc = canValidateOccurrenceCompletion(o)
                  const isResp = isResponsableOccurrence(o)
                  // La confirmation n'est valide que si tx >= 100% ET gestionnaire_conf = 'Oui'
                  const confEffective = txAvancement >= 100 && o.gestionnaire_conf === 'Oui'
                  
                  return (
                    <tr key={o.id} className={`hover:bg-blue-50/50 ${bgColor}`}>
                      <td className={`px-2 py-1.5 sticky left-0 z-10 ${bgColor} border-r min-w-[270px] max-w-[270px]`} title={o.libelle_action || action?.libelle_action}><div className="whitespace-normal break-words leading-tight" style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{o.libelle_action || action?.libelle_action || '-'}</div></td>
                      <td className="px-2 py-1.5 text-center">{o.date_debut ? new Date(o.date_debut).toLocaleDateString('fr-FR') : '-'}</td>
                      <td className="px-2 py-1.5 text-center">{o.date_fin ? new Date(o.date_fin).toLocaleDateString('fr-FR') : '-'}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] font-bold ${txAvancement >= 100 ? 'bg-green-100 text-green-800' : txAvancement > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{txAvancement}%</span>{hasTaches && <span className="ml-0.5 text-[8px] text-gray-400">(calc)</span>}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauAvancement === 'Achevée' ? 'bg-green-100 text-green-700' : calc.niveauAvancement.includes('Terminée') ? 'bg-blue-100 text-blue-700' : calc.niveauAvancement.includes('+50') ? 'bg-yellow-100 text-yellow-700' : calc.niveauAvancement.includes('-50') ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{calc.niveauAvancement}</span></td>
                      <td className="px-2 py-1.5 text-center text-gray-600">{o.date_realisation ? new Date(o.date_realisation).toLocaleDateString('fr-FR') : '-'}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] font-medium ${calc.jourRetard > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.jourRetard}j</span></td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauRetard === 'Retard' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.niveauRetard}</span></td>
                      <td className="px-2 py-1.5 text-center">
                        {txAvancement < 100 ? (
                          <span className="text-gray-300 text-[9px]">- (tx&lt;100%)</span>
                        ) : confEffective ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Oui</span>
                            {canValidateOcc && <button onClick={() => handleToggleGestionnaireConf(o, false)} className="p-0.5 hover:bg-red-100 rounded" title="Annuler confirmation"><XCircle size={12} className="text-red-500"/></button>}
                          </div>
                        ) : canValidateOcc ? (
                          <button onClick={() => handleToggleGestionnaireConf(o, true)} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] hover:bg-blue-600 flex items-center gap-0.5 mx-auto"><CheckCircle size={10}/>Confirmer</button>
                        ) : (
                          <span className="text-gray-400 text-[9px]">Non confirmé</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 truncate max-w-[80px]">{o.responsable || '-'}</td>
                      <td className={`px-2 py-1.5 sticky right-0 z-10 ${bgColor} border-l`}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => { setSelectedOccurrence(o); setSelectedAction(action); setOccurrenceForm({ ...o, commentaire: o.commentaire || '', date_realisation: o.date_realisation || '', date_realisation_auto: o.date_realisation_auto || '', tx_avancement: hasTaches ? undefined : o.tx_avancement }); setShowOccurrenceEditModal(true) }} className="p-0.5 hover:bg-blue-100 rounded" title={canEditOcc ? "Modifier" : (isResp ? "Modifier Tx uniquement" : "Consulter")}><Edit size={12} className={canEditOcc || isResp ? "text-blue-600" : "text-gray-500"}/></button>
                          {canEditOcc && <button onClick={() => handleOpenTacheForm(o, false)} className="p-0.5 hover:bg-green-100 rounded" title="Ajouter tâche"><Plus size={12} className="text-green-600"/></button>}
                          <button onClick={() => { setSelectedOccurrence(o); setShowTachesListModal(true) }} className="p-0.5 hover:bg-purple-100 rounded" title={`Tâches (${occTaches.length})`}><ListChecks size={12} className="text-purple-600"/></button>
                          {canTriggerActionReminder(o) && <button onClick={() => runBlockingAction(() => handleSendActionReminder(o))} className="p-0.5 hover:bg-amber-100 rounded" title="Envoyer un mail de relance"><Send size={12} className="text-amber-600"/></button>}
                          {canEditOcc && <button onClick={() => handleArchive('suivi_action', o.id, `${action?.libelle_action || 'Occurrence'} (${o.code_occurrence || o.id})`)} className="p-0.5 hover:bg-orange-100 rounded" title="Archiver"><Archive size={12} className="text-orange-600"/></button>}
                          {canEditOcc && <button onClick={() => handleDeleteOccurrence(o)} className="p-0.5 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-gray-50 border-t text-[10px] text-gray-500">Total: {filtered.length}</div>
        </div>
        
        
        {/* Modal Nouvelle/Modifier tâche */}
        <Modal isOpen={showTacheModal} onClose={() => setShowTacheModal(false)} title={selectedTache ? 'Modifier la tâche' : 'Nouvelle tâche'} size="md" closeOnClickOutside={false}>
          <div className="space-y-4">
            <div className="p-2 bg-blue-50 rounded-lg text-xs">Occurrence du {selectedOccurrence?.date_debut ? new Date(selectedOccurrence.date_debut).toLocaleDateString('fr-FR') : '-'} au {selectedOccurrence?.date_fin ? new Date(selectedOccurrence.date_fin).toLocaleDateString('fr-FR') : '-'}</div>
            {selectedOccurrence && isOccurrenceAchieved(selectedOccurrence) && (
              <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">Cette action est au statut Achevée. Toutes les tâches associées sont en lecture seule.</div>
            )}
            {selectedTache && !canEditTache(selectedTache) && isResponsableTache(selectedTache) && !isOccurrenceAchieved(selectedOccurrence) && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                En tant que responsable, supérieur hiérarchique direct ou responsable de structure autorisé, vous pouvez mettre à jour le taux d'avancement et commenter.
              </div>
            )}
            <div><label className="block text-sm font-medium mb-1">Libellé *</label><input type="text" value={tacheForm.libelle_tache || ''} onChange={e => setTacheForm({...tacheForm, libelle_tache: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={isOccurrenceAchieved(selectedOccurrence) || (selectedTache && !canEditTache(selectedTache))}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Date début *</label><input type="date" value={tacheForm.date_debut || ''} onChange={e => setTacheForm({...tacheForm, date_debut: e.target.value})} min={selectedOccurrence?.date_debut} max={selectedOccurrence?.date_fin} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={isOccurrenceAchieved(selectedOccurrence) || (selectedTache && !canEditTache(selectedTache))}/></div>
              <div><label className="block text-sm font-medium mb-1">Date fin *</label><input type="date" value={tacheForm.date_fin || ''} onChange={e => setTacheForm({...tacheForm, date_fin: e.target.value})} min={selectedOccurrence?.date_debut} max={selectedOccurrence?.date_fin} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={isOccurrenceAchieved(selectedOccurrence) || (selectedTache && !canEditTache(selectedTache))}/></div>
            </div>
            <SearchableSelect label="Responsable *" value={tacheForm.responsable} onChange={v => setTacheForm({...tacheForm, responsable: v})} options={userOptions} placeholder="Sélectionner..." disabled={isOccurrenceAchieved(selectedOccurrence) || (selectedTache && !canEditTache(selectedTache))}/>
            <div><label className="block text-sm font-medium mb-1">Taux d'avancement (%)</label><input type="number" min="0" max="100" value={tacheForm.tx_avancement || 0} onChange={e => setTacheForm({...tacheForm, tx_avancement: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={isOccurrenceAchieved(selectedOccurrence) || (selectedTache && !canEditTxTache(selectedTache))}/></div>
            <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={tacheForm.commentaire || ''} onChange={e => setTacheForm({...tacheForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={isOccurrenceAchieved(selectedOccurrence) || (selectedTache && !canEditTache(selectedTache))}/></div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowTacheModal(false)}>Fermer</Button>
              {!isOccurrenceAchieved(selectedOccurrence) && (!selectedTache || canEditTache(selectedTache) || canEditTxTache(selectedTache)) && <Button onClick={() => runBlockingAction(handleSaveTache)}>Enregistrer</Button>}
            </div>
          </div>
        </Modal>
        
        {/* Modal Liste des tâches */}
        <Modal isOpen={showTachesListModal} onClose={() => setShowTachesListModal(false)} title="Tâches de l'occurrence" size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            <div className="p-2 bg-blue-50 rounded-lg text-xs">Occurrence du {selectedOccurrence?.date_debut ? new Date(selectedOccurrence.date_debut).toLocaleDateString('fr-FR') : '-'} au {selectedOccurrence?.date_fin ? new Date(selectedOccurrence.date_fin).toLocaleDateString('fr-FR') : '-'}</div>
            {(() => { 
              const occId = selectedOccurrence?.code_occurrence || selectedOccurrence?.id
              const occTaches = taches.filter(t => t.code_occurrence === occId)
              const canEditOcc = canEditOccurrence(selectedOccurrence)
              return occTaches.length === 0 ? (
                <p className="text-center text-gray-500 py-6 text-xs">Aucune tâche</p>
              ) : (
                <table className="w-full text-[10px]">
                  <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]"><tr><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Tx%</th><th className="px-2 py-2 text-left text-white">Resp.</th><th className="px-2 py-2 text-right text-white">Act.</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {occTaches.map(t => {
                      const canEditT = canEditTache(t)
                      const isRespT = isResponsableTache(t)
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5">{t.libelle_tache}</td>
                          <td className="px-2 py-1.5 text-center">{t.date_debut ? new Date(t.date_debut).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="px-2 py-1.5 text-center">{t.date_fin ? new Date(t.date_fin).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="px-2 py-1.5 text-center">{t.tx_avancement || 0}%</td>
                          <td className="px-2 py-1.5">{t.responsable || '-'}</td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              {!isOccurrenceAchieved(selectedOccurrence) && (canEditT || isRespT) && <button onClick={() => handleEditTache(t)} className="p-1 hover:bg-blue-100 rounded" title={isRespT && !canEditT ? "Modifier Tx uniquement" : "Modifier"}><Edit size={12} className="text-blue-600"/></button>}
                              {!isOccurrenceAchieved(selectedOccurrence) && canEditT && <button onClick={() => handleDeleteTache(t)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })()}
            <div className="flex justify-between pt-4 border-t">
              <div>
                {canEditOccurrence(selectedOccurrence) && !isOccurrenceAchieved(selectedOccurrence) && <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenTacheForm(selectedOccurrence, true)}>Ajouter tâche</Button>}
                {isOccurrenceAchieved(selectedOccurrence) && <div className="text-xs text-gray-500">Tâches en lecture seule : l'action est au statut Achevée.</div>}
              </div>
              <Button variant="secondary" onClick={() => setShowTachesListModal(false)}>Fermer</Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  const renderContent = () => { switch(activeTab) { case 'projets': return renderProjets(); case 'actions': return renderActions(); case 'suivi': return renderSuivi(); default: return null } }

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
      <div className="mobile-subrubric-sidebar w-56 bg-white border-r border-gray-100 p-3 space-y-1 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto">
        <div className="mobile-subrubric-sidebar-grid">{subPages.map(p => <SidebarButton key={p.key} icon={p.icon} label={p.label} active={activeTab === p.key} onClick={() => setActiveTab(p.key)}/> )}</div>
      </div>
      <div className="mobile-subrubric-content flex-1 p-4 overflow-auto bg-gray-50">{renderContent()}</div>
      
      {/* Modal global pour créer/modifier une occurrence - accessible depuis tous les onglets */}
      <Modal isOpen={showOccurrenceEditModal} onClose={() => setShowOccurrenceEditModal(false)} title={selectedOccurrence ? (canEditOccurrence(selectedOccurrence) ? "Modifier l\'occurrence" : "Consultation de l\'occurrence") : 'Nouvelle occurrence'} size="md" closeOnClickOutside={false}>
        <div className="space-y-4">
          {selectedAction && <div className="p-3 bg-blue-50 rounded-lg text-xs"><strong>Action:</strong> {selectedAction.libelle_action}</div>}
          {selectedOccurrence && isOccurrenceAchieved(selectedOccurrence) && <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">Action achevée verrouillée : le taux, les commentaires et les autres champs sont en lecture seule tant qu'un gestionnaire ou un super administrateur n'a pas retiré le statut Achevée.</div>}
          {selectedOccurrence && !canEditOccurrence(selectedOccurrence) && isResponsableOccurrence(selectedOccurrence) && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              En tant que responsable, supérieur hiérarchique direct ou responsable de structure autorisé, vous pouvez mettre à jour le taux d'avancement et commenter.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Date début *</label><input type="date" value={occurrenceForm.date_debut || ''} onChange={e => setOccurrenceForm({...occurrenceForm, date_debut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedOccurrence && (isOccurrenceAchieved(selectedOccurrence) || !canEditOccurrence(selectedOccurrence))}/></div>
            <div><label className="block text-sm font-medium mb-1">Date fin *</label><input type="date" value={occurrenceForm.date_fin || ''} onChange={e => setOccurrenceForm({...occurrenceForm, date_fin: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedOccurrence && (isOccurrenceAchieved(selectedOccurrence) || !canEditOccurrence(selectedOccurrence))}/></div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Taux d'avancement (%)</label>
            {hasOccurrenceTaches(selectedOccurrence) ? (
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">{getTxAvancementForOccurrence(selectedOccurrence)}% (calculé depuis les tâches)</div>
            ) : (
              <input type="number" min="0" max="100" value={occurrenceForm.tx_avancement || 0} onChange={e => setOccurrenceForm({...occurrenceForm, tx_avancement: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedOccurrence && (isOccurrenceAchieved(selectedOccurrence) || !canEditTxAvancement(selectedOccurrence))}/>
            )}
          </div>
          <SearchableSelect label="Responsable *" value={occurrenceForm.responsable} onChange={v => setOccurrenceForm({...occurrenceForm, responsable: v})} options={occurrenceResponsableOptions} placeholder="Sélectionner..." disabled={selectedOccurrence && (isOccurrenceAchieved(selectedOccurrence) || !canEditOccurrence(selectedOccurrence))}/>
          <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={occurrenceForm.commentaire || ''} onChange={e => setOccurrenceForm({...occurrenceForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={selectedOccurrence && (isOccurrenceAchieved(selectedOccurrence) || !canEditTxAvancement(selectedOccurrence))} /></div>

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
          {selectedOccurrence && (((hasOccurrenceTaches(selectedOccurrence) ? getTxAvancementForOccurrence(selectedOccurrence) : (parseFloat(occurrenceForm.tx_avancement) || 0)) >= 100)) && (
            <div>
              <label className="block text-sm font-medium mb-1">Date réelle de réalisation</label>
              <input type="date" value={occurrenceForm.date_realisation || ''} onChange={e => setOccurrenceForm({...occurrenceForm, date_realisation: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={isOccurrenceAchieved(selectedOccurrence) || !canEditRealisationDate(selectedOccurrence)} />
              {!canEditRealisationDate(selectedOccurrence) && <p className="mt-1 text-xs text-gray-500">Seuls les gestionnaires du projet et les super administrateurs peuvent modifier cette date.</p>}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowOccurrenceEditModal(false)}>Fermer</Button>
            {(!selectedOccurrence || ((!isOccurrenceAchieved(selectedOccurrence)) && (canEditOccurrence(selectedOccurrence) || canEditTxAvancement(selectedOccurrence)))) && <Button onClick={() => runBlockingAction(handleSaveOccurrence)}>Enregistrer</Button>}
          </div>
        </div>
      </Modal>

      <Modal isOpen={showConfirmationModal} onClose={() => setShowConfirmationModal(false)} title="Confirmation d'achèvement" size="sm" closeOnClickOutside={false}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Confirmez l'achèvement de l'action et, si besoin, ajustez la date réelle de réalisation.</p>
          <div>
            <label className="block text-sm font-medium mb-1">Date réelle de réalisation</label>
            <input type="date" value={confirmationForm.date_realisation || ''} onChange={e => setConfirmationForm({ ...confirmationForm, date_realisation: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedOccurrence ? !canEditRealisationDate(selectedOccurrence) : true} />
            {selectedOccurrence && !canEditRealisationDate(selectedOccurrence) && <p className="mt-1 text-xs text-gray-500">Seuls les gestionnaires du projet et les super administrateurs peuvent modifier cette date.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Commentaire du gestionnaire</label>
            <textarea value={confirmationForm.manager_comment || ''} onChange={e => setConfirmationForm({ ...confirmationForm, manager_comment: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" rows={3} placeholder="Optionnel pour une validation, obligatoire pour un rejet" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowConfirmationModal(false)}>Fermer</Button>
            <Button variant="danger" disabled={actionInProgress} onClick={() => handleConfirmOccurrenceCompletion('reject')}>Rejeter</Button>
            <Button disabled={actionInProgress} onClick={() => handleConfirmOccurrenceCompletion('approve')}>Valider</Button>
          </div>
        </div>
      </Modal>

      {/* AlertModal unifié pour tous les messages */}
      <AlertModal 
        isOpen={alertModal.isOpen} 
        onClose={closeAlert} 
        type={alertModal.type}
        message={alertModal.message}
        onConfirm={alertModal.onConfirm}
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
      
      {/* Modal des éléments archivés */}
      <Modal isOpen={showArchives} onClose={() => setShowArchives(false)} title={`Archives - ${archiveType === 'projet' ? 'Projets' : archiveType === 'action' ? 'Actions' : 'Suivi actions'}`} size="xl" closeOnClickOutside={false}>
        {renderArchivesModalContent()}
      </Modal>
    </div>
  )
}
