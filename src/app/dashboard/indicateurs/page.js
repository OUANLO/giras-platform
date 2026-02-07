'use client'
import { useState, useEffect, useRef } from 'react'
import { FolderOpen, BarChart2, TrendingUp, Plus, Edit, Trash2, List, PlayCircle, Eye, CheckCircle, AlertTriangle, XCircle, ChevronLeft, ChevronRight, X, Info, RotateCcw, ChevronDown, Download } from 'lucide-react'
import { Button, Modal, FormInput, StatusBadge, SidebarButton, AlertModal } from '@/components/ui'
import * as XLSX from 'xlsx'

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

function SearchableMultiSelect({ label, value, onChange, options, placeholder = 'Ajouter...', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  const filtered = options.filter(o => !value?.includes(o.value) && o.label.toLowerCase().includes(search.toLowerCase()))
  return (<div className="relative" ref={ref}>{label && <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>}<button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled} className={`w-full px-2 py-1.5 text-xs border rounded bg-white text-left flex items-center justify-between gap-1 ${disabled ? 'bg-gray-100 text-gray-500' : 'hover:border-gray-400'}`}><span className="text-gray-500">{placeholder}</span><ChevronDown size={14} className="text-gray-400" /></button>{isOpen && (<div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-hidden"><div className="p-2 border-b"><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full px-2 py-1 text-xs border rounded" autoFocus /></div><div className="max-h-48 overflow-y-auto">{filtered.map(o => (<div key={o.value} onClick={() => { onChange(o.value); setSearch('') }} className="px-3 py-2 text-xs cursor-pointer hover:bg-gray-100">{o.label}</div>))}{!filtered.length && <p className="px-3 py-2 text-xs text-gray-500">Aucun résultat</p>}</div></div>)}</div>)
}

export default function IndicateursPage() {
  const [activeTab, setActiveTab] = useState('groupes')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [groupes, setGroupes] = useState([])
  const [indicateurs, setIndicateurs] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [structures, setStructures] = useState([])
  const [users, setUsers] = useState([])
  const [groupeFilters, setGroupeFilters] = useState({ gestionnaire: '', statut: '', recherche: '' })
  const [indicateurFilters, setIndicateurFilters] = useState({ structure: '', groupe: '', type_indicateur: '', statut: '', responsable: '', recherche: '' })
  const [suiviFilters, setSuiviFilters] = useState({ groupe: '', structure: '', indicateur: '', responsable: '', statut: '', atteinte: '', date_debut: '', date_fin: '', renseignement: '', recherche: '' })
  const [showGroupeModal, setShowGroupeModal] = useState(false)
  const [showIndicateurModal, setShowIndicateurModal] = useState(false)
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false)
  const [showCreateOccurrenceModal, setShowCreateOccurrenceModal] = useState(false)
  const [showOccurrencesListModal, setShowOccurrencesListModal] = useState(false)
  const [showArchivedSuiviModal, setShowArchivedSuiviModal] = useState(false)
  const [archivedSuiviOccurrences, setArchivedSuiviOccurrences] = useState([])
  const [selectedGroupe, setSelectedGroupe] = useState(null)
  const [selectedIndicateur, setSelectedIndicateur] = useState(null)
  const [selectedOccurrence, setSelectedOccurrence] = useState(null)
  const [indicateurOccurrences, setIndicateurOccurrences] = useState([])
  const [groupeForm, setGroupeForm] = useState({ gestionnaires: [] })
  const [indicateurForm, setIndicateurForm] = useState({ groupes: [] })
  const [occurrenceForm, setOccurrenceForm] = useState({})
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

  const typeOptions = [{ value: 'Taux', label: 'Taux (Num./Dén.) - %' }, { value: 'TxCalcule', label: 'Taux déjà calculé - %' }, { value: 'Nombre', label: 'Nombre' }]
  const periodicites = ['Annuel', 'Semestriel', 'Trimestriel', 'Mensuel', 'Hebdomadaire', 'Journalier', 'Personnalise']
  const subPages = [{ key: 'groupes', label: 'Groupe', icon: FolderOpen }, { key: 'indicateurs', label: 'Indicateur', icon: BarChart2 }, { key: 'suivi', label: 'Suivi', icon: TrendingUp }]

  useEffect(() => { const u = localStorage.getItem('giras_user'); if (u) setUser(JSON.parse(u)); fetchBaseData() }, [])
  useEffect(() => { if (activeTab === 'groupes') fetchGroupes(); else if (activeTab === 'indicateurs') fetchIndicateurs(); else if (activeTab === 'suivi') { fetchIndicateurs(); fetchOccurrences() } }, [activeTab])
  useEffect(() => { checkScroll() }, [occurrences, activeTab])

  const fetchBaseData = async () => { try { const [sR, uR] = await Promise.all([fetch('/api/structures'), fetch('/api/users')]); if (sR.ok) setStructures((await sR.json()).structures || []); if (uR.ok) setUsers((await uR.json()).users || []) } catch {} }
  const fetchGroupes = async () => { setLoading(true); try { const r = await fetch('/api/groupe-indicateurs'); if (r.ok) setGroupes((await r.json()).groupes || []) } catch {} setLoading(false) }
  const fetchIndicateurs = async () => { setLoading(true); try { const r = await fetch('/api/indicateurs'); if (r.ok) setIndicateurs((await r.json()).indicateurs || []) } catch {} setLoading(false) }
  const fetchOccurrences = async () => { try { const r = await fetch('/api/indicateurs/occurrences'); if (r.ok) setOccurrences((await r.json()).occurrences || []) } catch {} }
  const checkScroll = () => { const c = tableContainerRef.current; if (c) { setCanScrollLeft(c.scrollLeft > 0); setCanScrollRight(c.scrollLeft < c.scrollWidth - c.clientWidth - 10) } }
  const scrollTable = (d) => { const c = tableContainerRef.current; if (c) { c.scrollBy({ left: d === 'left' ? -300 : 300, behavior: 'smooth' }); setTimeout(checkScroll, 300) } }

  const isAdmin = () => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.type_utilisateur === 'Admin' || user?.type_utilisateur === 'Super admin'
  const isGest = (g) => g?.gestionnaires?.includes(user?.username) || g?.gestionnaire === user?.username
  const canEditGroupe = (g) => {
    // Le groupe RISQUE ne peut pas être modifié ici - gestionnaires gérés dans Gestion des risques
    if (g?.code_groupe === 'RISQUE' || g?.code_groupe === 'Risque') return false
    return !g || isAdmin() || isGest(g)
  }
  const canDelGroupe = (g) => {
    // Le groupe RISQUE ne peut pas être supprimé
    if (g?.code_groupe === 'RISQUE' || g?.code_groupe === 'Risque') return false
    return isAdmin() || isGest(g)
  }
  const isRisque = (ind) => ind?.groupes?.includes('Risque') || ind?.code_groupe === 'Risque'
  
  // Fonction pour obtenir la cible correcte d'une occurrence
  // Pour les indicateurs risque : Seuil3 si sens positif, Seuil1 si sens négatif
  // Pour les autres : la cible de l'occurrence
  const getCible = (occ, ind) => {
    if (isRisque(ind)) {
      return ind?.sens === 'Négatif' ? parseFloat(ind?.seuil1) : parseFloat(ind?.seuil3)
    }
    return occ?.cible != null ? parseFloat(occ.cible) : null
  }
  
  const canEditInd = (ind) => { if (isAdmin()) return true; const gc = ind?.groupes?.[0] || ind?.code_groupe; const grp = groupes.find(g => g.code_groupe === gc); return isGest(grp) }
  const canDelInd = canEditInd
  const isResp = (ind) => ind?.responsable === user?.username
  const canEditOcc = (occ, ind) => isAdmin() || canEditInd(ind)
  const canSaisir = (occ, ind) => canEditOcc(occ, ind) || isResp(ind)
  const canDelOcc = (occ, ind) => canEditOcc(occ, ind)
  const getUsersStruct = (cs) => !cs ? [] : users.filter(u => u.structure === cs)

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
      const r = await fetch('/api/groupe-indicateurs', { method: selectedGroupe ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...groupeForm, id: selectedGroupe?.id, createur: user?.username, modificateur: user?.username }) })
      if (r.ok) { 
        showAlert('success', selectedGroupe ? 'Groupe modifié avec succès' : 'Groupe créé avec succès', () => { setShowGroupeModal(false); fetchGroupes(); fetchBaseData() })
      } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') } 
  }
  const [confirmAction, setConfirmAction] = useState(null)
  const handleDelGrp = (g) => { 
    if (!canDelGroupe(g) || g.is_default) return
    setConfirmAction({ message: `Supprimer "${g.libelle_groupe}" ?`, onConfirm: async () => {
      try { const r = await fetch('/api/groupe-indicateurs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id }) }); if (r.ok) { showAlert('success', 'Groupe supprimé', fetchGroupes) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur') }
    }})
  }

  const handleOpenIndModal = (ind = null) => { setSelectedIndicateur(ind); setIndicateurForm(ind ? { ...ind, groupes: ind.groupes || (ind.code_groupe ? [ind.code_groupe] : []) } : { type_indicateur: 'Taux', sens: 'Positif', statut: 'Actif', periodicite: '', groupes: [], code_structure: '', numerateur: '', denominateur: '' }); setShowIndicateurModal(true) }
  const handleAddGrp = (c) => { if (!c) return; if (c === 'Risque') { setIndicateurForm({ ...indicateurForm, groupes: ['Risque'], periodicite: 'Personnalise' }) } else { if (indicateurForm.groupes?.includes('Risque')) { showAlert('warning', 'Le groupe Risque est exclusif'); return } if (!indicateurForm.groupes?.includes(c)) setIndicateurForm({ ...indicateurForm, groupes: [...(indicateurForm.groupes || []), c] }) } }
  const handleRemGrp = (c) => { const ng = indicateurForm.groupes?.filter(x => x !== c) || []; setIndicateurForm({ ...indicateurForm, groupes: ng, ...(c === 'Risque' ? { periodicite: '', seuil1: null, seuil2: null, seuil3: null } : {}) }) }
  const handleStructChg = (cs) => { setIndicateurForm({ ...indicateurForm, code_structure: cs, responsable: '' }) }
  const handleTypeChg = (t) => { setIndicateurForm({ ...indicateurForm, type_indicateur: t, ...(t !== 'Taux' ? { numerateur: '', denominateur: '' } : {}) }) }
  const handleSaveInd = async () => { 
    if (!indicateurForm.libelle_indicateur || !indicateurForm.code_structure || !indicateurForm.responsable) { showAlert('error', 'Champs obligatoires manquants'); return } 
    if (!indicateurForm.groupes?.length) { showAlert('error', 'Groupe requis'); return } 
    if (indicateurForm.type_indicateur === 'Taux' && (!indicateurForm.numerateur || !indicateurForm.denominateur)) { showAlert('error', 'Numérateur/Dénominateur requis'); return } 
    const hasR = indicateurForm.groupes?.includes('Risque')
    if (!selectedIndicateur && !hasR && !indicateurForm.periodicite) { showAlert('error', 'Périodicité requise'); return } 
    if (!validateSeuils(indicateurForm)) return
    const ru = users.find(u => u.username === indicateurForm.responsable)
    if (ru && ru.structure !== indicateurForm.code_structure) { showAlert('error', 'Le responsable doit être de la structure'); return } 
    try { 
      const data = { ...indicateurForm }
      if (hasR) data.periodicite = 'Personnalise'
      if (!hasR) { data.seuil1 = data.seuil2 = data.seuil3 = null } 
      if (data.type_indicateur !== 'Taux') { data.numerateur = null; data.denominateur = null } 
      const r = await fetch('/api/indicateurs', { method: selectedIndicateur ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, id: selectedIndicateur?.id, createur: user?.username, modificateur: user?.username }) })
      if (r.ok) { 
        showAlert('success', selectedIndicateur ? 'Indicateur modifié avec succès' : 'Indicateur créé avec succès', () => { setShowIndicateurModal(false); fetchIndicateurs() })
      } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') } 
  }
  const handleDelInd = (ind) => { 
    if (!canDelInd(ind)) return
    setConfirmAction({ message: 'Supprimer cet indicateur ?', onConfirm: async () => {
      try { const r = await fetch('/api/indicateurs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ind.id }) }); if (r.ok) { showAlert('success', 'Indicateur supprimé', fetchIndicateurs) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur') }
    }})
  }

  const handleOpenCreateOcc = (ind) => { 
    if (ind.statut !== 'Actif' || !canEditInd(ind)) return
    if (isRisque(ind)) { showAlert('info', 'Les occurrences Risque sont créées depuis Gestion des risques'); return } 
    setConfirmAction({ message: `Ouvrir une occurrence pour "${ind.libelle_indicateur}" ?`, onConfirm: async () => {
      try { const r = await fetch(`/api/indicateurs/occurrences?code_indicateur=${ind.code_indicateur}`); if (r.ok) setIndicateurOccurrences((await r.json()).occurrences || []) } catch {} 
      setSelectedIndicateur(ind); setCreateOccurrenceForm({ code_indicateur: ind.code_indicateur, periodicite: ind.periodicite, annee: new Date().getFullYear(), periode: '', date_debut: '', date_fin: '', date_limite_saisie: '', cible: '' }); setShowCreateOccurrenceModal(true)
    }})
  }
  const handleSaveCreateOcc = async () => { 
    if (!createOccurrenceForm.date_debut || !createOccurrenceForm.date_fin || !createOccurrenceForm.date_limite_saisie) { showAlert('error', 'Dates requises'); return } 
    // Validation : la date limite de saisie doit être >= date de fin de période
    if (createOccurrenceForm.date_limite_saisie < createOccurrenceForm.date_fin) { 
      showAlert('error', 'La date limite de saisie doit être ultérieure ou égale à la date de fin de période'); return 
    }
    if (createOccurrenceForm.cible === '' || createOccurrenceForm.cible == null) { showAlert('error', 'Cible requise'); return } 
    if (selectedIndicateur?.periodicite !== 'Personnalise' && !createOccurrenceForm.periode) { showAlert('error', 'Période requise'); return } 
    if (indicateurOccurrences.find(o => o.date_debut === createOccurrenceForm.date_debut && o.date_fin === createOccurrenceForm.date_fin)) { showAlert('error', 'Cette occurrence existe déjà'); return } 
    try { 
      const r = await fetch('/api/indicateurs/occurrences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...createOccurrenceForm, createur: user?.username }) })
      if (r.ok) { showAlert('success', 'Occurrence créée avec succès', () => { setShowCreateOccurrenceModal(false); fetchOccurrences() }) } 
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur') } 
  }
  const handleShowOccList = async (ind) => { setSelectedIndicateur(ind); try { const r = await fetch(`/api/indicateurs/occurrences?code_indicateur=${ind.code_indicateur}`); if (r.ok) { setIndicateurOccurrences((await r.json()).occurrences || []); setShowOccurrencesListModal(true) } } catch {} }
  const handleOpenOccModal = (occ) => { const ind = indicateurs.find(i => i.code_indicateur === occ.code_indicateur); setSelectedIndicateur(ind); setSelectedOccurrence(occ); let cible = occ.cible; if (isRisque(ind)) cible = ind.sens === 'Négatif' ? ind.seuil1 : ind.seuil3; setOccurrenceForm({ ...occ, cible, periodicite: ind?.periodicite, annee: occ.annee || new Date(occ.date_debut).getFullYear() }); setShowOccurrenceModal(true) }
  const handleSaveOcc = async () => { 
    if (!occurrenceForm.date_limite_saisie) { showAlert('error', 'Date limite requise'); return }
    // Validation : la date limite de saisie doit être >= date de fin de période
    if (occurrenceForm.date_limite_saisie < occurrenceForm.date_fin) { 
      showAlert('error', 'La date limite de saisie doit être ultérieure ou égale à la date de fin de période'); return 
    }
    try { 
      const payload = { ...occurrenceForm, modificateur: user?.username }
      const ind = selectedIndicateur || indicateurs.find(i => i.code_indicateur === occurrenceForm.code_indicateur)
      if (ind?.type_indicateur === 'Taux' && occurrenceForm.val_numerateur && occurrenceForm.val_denominateur) { 
        const d = parseFloat(occurrenceForm.val_denominateur)
        payload.val_indicateur = d !== 0 ? (parseFloat(occurrenceForm.val_numerateur) / d) * 100 : null 
      } 
      const r = await fetch('/api/indicateurs/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (r.ok) { 
        showAlert('success', 'Occurrence modifiée avec succès', async () => { 
          setShowOccurrenceModal(false); fetchOccurrences()
          if (showOccurrencesListModal && selectedIndicateur) { const rr = await fetch(`/api/indicateurs/occurrences?include_archived=1&code_indicateur=${selectedIndicateur.code_indicateur}`); if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || []) }
        })
      } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur') } 
  }
  const handleDelOcc = (occ) => { 
    const ind = selectedIndicateur || indicateurs.find(i => i.code_indicateur === occ.code_indicateur)
    if (!canDelOcc(occ, ind)) return
    setConfirmAction({ message: 'Supprimer cette occurrence ?', onConfirm: async () => {
      try { 
        const r = await fetch('/api/indicateurs/occurrences', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: occ.id }) })
        if (r.ok) { 
          showAlert('success', 'Occurrence supprimée', async () => {
            fetchOccurrences()
            if (showOccurrencesListModal && selectedIndicateur) { const rr = await fetch(`/api/indicateurs/occurrences?include_archived=1&code_indicateur=${selectedIndicateur.code_indicateur}`); if (rr.ok) setIndicateurOccurrences((await rr.json()).occurrences || []) }
          })
        } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
      } catch { showAlert('error', 'Erreur') }
    }})
  }

  const getAtteinte = (v, c, sens) => { if (v == null || c == null || c === 0) return { status: 'unknown', pct: 0 }; let p = sens === 'Positif' ? (v / c) * 100 : (v <= c ? 100 : (c / v) * 100); if (p >= 100) return { status: 'atteint', pct: p }; if (p >= 90) return { status: 'proche', pct: p }; return { status: 'non_atteint', pct: p } }
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
    if (!lim) return { jours: 0, enRetard: false, niveau: 'Pas retard' }

    const ref = (occ?.val_indicateur != null && occ?.date_saisie)
      ? (toDateOnly(occ.date_saisie) || toDateOnly(new Date()))
      : toDateOnly(new Date())

    const diff = Math.floor((ref.getTime() - lim.getTime()) / MS_PER_DAY)
    const jours = diff > 0 ? diff : 0
    return { jours, enRetard: jours > 0, niveau: jours > 0 ? 'Retard' : 'Pas retard' }
  }
  const fGrp = groupes.filter(g => { if (groupeFilters.gestionnaire && !g.gestionnaires?.includes(groupeFilters.gestionnaire) && g.gestionnaire !== groupeFilters.gestionnaire) return false; if (groupeFilters.statut && g.statut !== groupeFilters.statut) return false; if (groupeFilters.recherche && !g.code_groupe?.toLowerCase().includes(groupeFilters.recherche.toLowerCase()) && !g.libelle_groupe?.toLowerCase().includes(groupeFilters.recherche.toLowerCase())) return false; return true })
  const fInd = indicateurs.filter(i => { if (indicateurFilters.structure && i.code_structure !== indicateurFilters.structure) return false; if (indicateurFilters.groupe && !i.groupes?.includes(indicateurFilters.groupe) && i.code_groupe !== indicateurFilters.groupe) return false; if (indicateurFilters.type_indicateur && i.type_indicateur !== indicateurFilters.type_indicateur) return false; if (indicateurFilters.statut && i.statut !== indicateurFilters.statut) return false; if (indicateurFilters.responsable && i.responsable !== indicateurFilters.responsable) return false; if (indicateurFilters.recherche && !i.libelle_indicateur?.toLowerCase().includes(indicateurFilters.recherche.toLowerCase())) return false; return true })
  // Filtrer les occurrences
  const filteredOcc = occurrences.filter(o => { const ind = indicateurs.find(i => i.code_indicateur === o.code_indicateur); if (suiviFilters.groupe && !ind?.groupes?.includes(suiviFilters.groupe) && ind?.code_groupe !== suiviFilters.groupe) return false; if (suiviFilters.structure && ind?.code_structure !== suiviFilters.structure) return false; if (suiviFilters.indicateur && o.code_indicateur !== parseInt(suiviFilters.indicateur)) return false; if (suiviFilters.responsable && ind?.responsable !== suiviFilters.responsable) return false; if (suiviFilters.statut) { const ret = calcRetard(o) || { enRetard: false }; if (suiviFilters.statut === 'Retard' && !ret.enRetard) return false; if (suiviFilters.statut === 'Pas retard' && ret.enRetard) return false } if (suiviFilters.date_debut && o.date_debut < suiviFilters.date_debut) return false; if (suiviFilters.date_fin && o.date_fin > suiviFilters.date_fin) return false; if (suiviFilters.atteinte) { const cibleVal = getCible(o, ind); const att = getAtteinte(o.val_indicateur, cibleVal, ind?.sens); if (suiviFilters.atteinte !== att.status) return false } if (suiviFilters.renseignement === 'oui' && o.val_indicateur == null) return false; if (suiviFilters.renseignement === 'non' && o.val_indicateur != null) return false; if (suiviFilters.recherche && !ind?.libelle_indicateur?.toLowerCase().includes(suiviFilters.recherche.toLowerCase())) return false; return true })
  
  // Trier les occurrences : 1) Non renseignées d'abord, 2) Par jours de retard décroissant
  const fOcc = [...filteredOcc].sort((a, b) => {
    const aRenseigne = a.val_indicateur != null
    const bRenseigne = b.val_indicateur != null
    // D'abord les non renseignées
    if (!aRenseigne && bRenseigne) return -1
    if (aRenseigne && !bRenseigne) return 1
    // Dans chaque groupe, trier par jours de retard décroissant
    const retA = calcRetard(a)
    const retB = calcRetard(b)
    return (retB.jours || 0) - (retA.jours || 0)
  })

  const AttBadge = ({a}) => { if (!a || a.status === 'unknown') return <span className="text-gray-400">-</span>; const cls = { atteint: 'bg-green-100 text-green-700', proche: 'bg-orange-100 text-orange-700', non_atteint: 'bg-red-100 text-red-700' }; const Ic = { atteint: CheckCircle, proche: AlertTriangle, non_atteint: XCircle }[a.status]; return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${cls[a.status]}`}><Ic size={10}/>{a.pct?.toFixed(0) || 0}%</span> }
  const RetBadge = ({ret}) => { if (!ret) return <span className="text-gray-400">-</span>; return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${ret.enRetard ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{ret.jours}j</span> }
  const StBadge = ({ret, s}) => { 
    // Accepte soit ret (objet avec enRetard) soit s (string statut)
    if (s) {
      const enRetard = s === 'Retard'
      return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${enRetard ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{enRetard ? 'Retard' : 'Pas retard'}</span>
    }
    if (!ret) return <span className="text-gray-400">-</span>
    return <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${ret.enRetard ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{ret.enRetard ? 'Retard' : 'Pas retard'}</span> 
  }
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '-'
  const getUserN = (u) => { const x = users.find(y => y.username === u); return x ? `${x.nom} ${x.prenoms}` : u }
  const getTypeL = (t) => typeOptions.find(o => o.value === t)?.label || t

  const gestOpts = users.map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms}` }))
  const grpOpts = groupes.map(g => ({ value: g.code_groupe, label: g.libelle_groupe }))
  const structOpts = structures.map(s => ({ value: s.code_structure, label: `${s.code_structure} - ${s.libelle_structure}` }))
  const indOpts = indicateurs.map(i => ({ value: i.code_indicateur.toString(), label: i.libelle_indicateur }))
  const yrs = Array.from({ length: 101 }, (_, i) => 2000 + i)
  const hasR = indicateurForm.groupes?.includes('Risque')

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
      'Groupe(s)': (ind.groupes || [ind.code_groupe]).map(c => groupes.find(g => g.code_groupe === c)?.libelle_groupe || c).join(', '),
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
        'Statut': ret.enRetard ? 'Retard' : 'Pas retard'
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Suivi')
    XLSX.writeFile(wb, `suivi_indicateurs_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Ouvrir la liste des occurrences archivées (lecture seule)
  const handleOpenArchivedSuivi = async () => {
    try {
      const rr = await fetch('/api/indicateurs/occurrences?archived_only=1')
      const jj = rr.ok ? await rr.json() : { occurrences: [] }
      setArchivedSuiviOccurrences(jj.occurrences || [])
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
    <div className="flex h-[calc(100vh-140px)]">
      <div className="w-56 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto"><div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3"><div className="space-y-1">{subPages.map(p=><SidebarButton key={p.key} icon={p.icon} label={p.label} active={activeTab===p.key} onClick={()=>setActiveTab(p.key)}/>)}</div></div></div>
      <div className="flex-1 min-w-0 overflow-auto p-1">
        {activeTab==='groupes'&&<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-800">Groupes</h2><div className="flex gap-2"><Button size="sm" onClick={()=>handleOpenGrpModal()}><Plus size={14} className="mr-1"/>Nouveau</Button><Button size="sm" variant="secondary" onClick={exportGroupesToExcel}><Download size={14} className="mr-1"/>Excel</Button></div></div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4"><div className="flex gap-2 items-end flex-wrap"><div className="w-48"><SearchableSelect label="Gestionnaire" value={groupeFilters.gestionnaire} onChange={v=>setGroupeFilters({...groupeFilters,gestionnaire:v})} options={gestOpts} size="sm"/></div><div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={groupeFilters.statut} onChange={e=>setGroupeFilters({...groupeFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div><div className="flex-1 min-w-[120px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={groupeFilters.recherche} onChange={e=>setGroupeFilters({...groupeFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><button onClick={()=>setGroupeFilters({gestionnaire:'',statut:'',recherche:''})} className="p-1.5 hover:bg-gray-100 rounded border"><RotateCcw size={14} className="text-gray-600"/></button></div></div>
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Code</th><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-left text-white">Gestionnaire(s)</th><th className="px-2 py-2 text-left text-white">Commentaire</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{width:'80px'}}>Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading?<tr><td colSpan={6} className="text-center py-8 text-gray-500">Chargement...</td></tr>:fGrp.length===0?<tr><td colSpan={6} className="text-center py-8 text-gray-500">Aucun</td></tr>:fGrp.map(g=>{const isRisqueGrp = g.code_groupe === 'RISQUE' || g.code_groupe === 'Risque'; return <tr key={g.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 font-mono text-blue-600">{g.code_groupe}</td><td className="px-2 py-1.5">{g.libelle_groupe}</td><td className="px-2 py-1.5 text-gray-600">{(g.gestionnaires||[g.gestionnaire]).map(u=>getUserN(u)).join(', ')}</td><td className="px-2 py-1.5 text-gray-500 max-w-xs truncate">{g.commentaire}</td><td className="px-2 py-1.5 text-center"><StatusBadge status={g.statut}/></td><td className="px-2 py-1.5 text-center">{isRisqueGrp ? <span className="text-gray-400 text-[9px] italic" title="Gestionnaires gérés dans 'Gestion des risques'">🔒 Géré ailleurs</span> : <div className="flex justify-center gap-1"><button onClick={()=>handleOpenGrpModal(g)} className={`p-1 rounded ${canEditGroupe(g)?'text-blue-600 hover:bg-blue-100':'text-gray-400'}`}>{canEditGroupe(g)?<Edit size={12}/>:<Eye size={12}/>}</button>{canDelGroupe(g)&&!g.is_default&&<button onClick={()=>handleDelGrp(g)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}</div>}</td></tr>})}</tbody></table></div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fGrp.length}</div>
        </div>}

        {activeTab==='indicateurs'&&<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-800">Indicateurs</h2><div className="flex gap-2"><Button size="sm" onClick={()=>handleOpenIndModal()}><Plus size={14} className="mr-1"/>Nouveau</Button><Button size="sm" variant="secondary" onClick={exportIndicateursToExcel}><Download size={14} className="mr-1"/>Excel</Button></div></div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4"><div className="flex gap-2 items-end flex-wrap"><div className="w-36"><SearchableSelect label="Groupe" value={indicateurFilters.groupe} onChange={v=>setIndicateurFilters({...indicateurFilters,groupe:v})} options={grpOpts} size="sm"/></div><div className="w-36"><SearchableSelect label="Structure" value={indicateurFilters.structure} onChange={v=>{const newFilters={...indicateurFilters,structure:v};if(v&&indicateurFilters.responsable){const respUser=users.find(u=>u.username===indicateurFilters.responsable);if(respUser&&respUser.structure!==v)newFilters.responsable=''}setIndicateurFilters(newFilters)}} options={indicateurFilters.responsable?structOpts.filter(s=>{const u=users.find(x=>x.username===indicateurFilters.responsable);return !u||s.value===u.structure}):structOpts} size="sm"/></div><div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Type</label><select value={indicateurFilters.type_indicateur} onChange={e=>setIndicateurFilters({...indicateurFilters,type_indicateur:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Taux">Taux</option><option value="TxCalcule">Tx calc.</option><option value="Nombre">Nombre</option></select></div><div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={indicateurFilters.statut} onChange={e=>setIndicateurFilters({...indicateurFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div><div className="w-40"><SearchableSelect label="Responsable" value={indicateurFilters.responsable} onChange={v=>{const newFilters={...indicateurFilters,responsable:v};if(v){const u=users.find(x=>x.username===v);if(u&&u.structure)newFilters.structure=u.structure}setIndicateurFilters(newFilters)}} options={indicateurFilters.structure?gestOpts.filter(o=>{const u=users.find(x=>x.username===o.value);return u&&u.structure===indicateurFilters.structure}):gestOpts} size="sm"/></div><div className="flex-1 min-w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={indicateurFilters.recherche} onChange={e=>setIndicateurFilters({...indicateurFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div><button onClick={()=>setIndicateurFilters({structure:'',groupe:'',type_indicateur:'',statut:'',responsable:'',recherche:''})} className="p-1.5 hover:bg-gray-100 rounded border"><RotateCcw size={14} className="text-gray-600"/></button></div></div>
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white" style={{minWidth:'180px'}}>Libellé</th><th className="px-2 py-2 text-left text-white">Groupe(s)</th><th className="px-2 py-2 text-left text-white">Structure</th><th className="px-2 py-2 text-center text-white">Périod.</th><th className="px-2 py-2 text-center text-white">Type</th><th className="px-2 py-2 text-center text-white">Sens</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{width:'100px'}}>Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading?<tr><td colSpan={8} className="text-center py-8 text-gray-500">Chargement...</td></tr>:fInd.length===0?<tr><td colSpan={8} className="text-center py-8 text-gray-500">Aucun</td></tr>:fInd.map(ind=>{const ce=canEditInd(ind);const ir=isRisque(ind);const gn=(ind.groupes||[ind.code_groupe]).map(c=>groupes.find(g=>g.code_groupe===c)?.libelle_groupe||c).join(', ');return<tr key={ind.id} className="hover:bg-gray-50"><td className="px-2 py-1.5"><span className="line-clamp-2" title={ind.libelle_indicateur}>{ind.libelle_indicateur}</span></td><td className="px-2 py-1.5 text-gray-600">{gn}</td><td className="px-2 py-1.5 text-gray-600">{ind.code_structure}</td><td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100">{ind.periodicite||'-'}</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 text-[9px] rounded ${ind.type_indicateur==='Nombre'?'bg-cyan-100 text-cyan-700':'bg-purple-100 text-purple-700'}`}>{ind.type_indicateur==='TxCalcule'?'Tx%':ind.type_indicateur}</span></td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 text-[9px] rounded ${ind.sens==='Positif'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>{ind.sens}</span></td><td className="px-2 py-1.5 text-center"><StatusBadge status={ind.statut}/></td><td className="px-2 py-1.5 text-center"><div className="flex justify-center gap-1"><button onClick={()=>handleOpenIndModal(ind)} className={`p-1 rounded ${ce?'text-blue-600 hover:bg-blue-100':'text-gray-400'}`}>{ce?<Edit size={12}/>:<Eye size={12}/>}</button>{ce&&<button onClick={()=>handleDelInd(ind)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}{ind.statut==='Actif'&&ce&&!ir&&<button onClick={()=>handleOpenCreateOcc(ind)} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Ouvrir"><PlayCircle size={12}/></button>}<button onClick={()=>handleShowOccList(ind)} className="p-1 text-purple-600 hover:bg-purple-100 rounded" title="Liste"><List size={12}/></button></div></td></tr>})}</tbody></table></div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fInd.length}</div>
        </div>}

        {activeTab==='suivi'&&<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-800">Suivi</h2><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={handleOpenArchivedSuivi}><Eye size={14} className="mr-1"/>Archives</Button><Button size="sm" variant="secondary" onClick={exportSuiviToExcel}><Download size={14} className="mr-1"/>Excel</Button></div></div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="w-32"><SearchableSelect label="Groupe" value={suiviFilters.groupe} onChange={v=>setSuiviFilters({...suiviFilters,groupe:v})} options={grpOpts} size="sm"/></div>
              <div className="w-32"><SearchableSelect label="Structure" value={suiviFilters.structure} onChange={v=>{const newFilters={...suiviFilters,structure:v};if(v&&suiviFilters.responsable){const respUser=users.find(u=>u.username===suiviFilters.responsable);if(respUser&&respUser.structure!==v)newFilters.responsable=''}setSuiviFilters(newFilters)}} options={suiviFilters.responsable?structOpts.filter(s=>{const u=users.find(x=>x.username===suiviFilters.responsable);return !u||s.value===u.structure}):structOpts} size="sm"/></div>
              <div className="w-36"><SearchableSelect label="Indicateur" value={suiviFilters.indicateur} onChange={v=>setSuiviFilters({...suiviFilters,indicateur:v})} options={indOpts} size="sm"/></div>
              <div className="w-36"><SearchableSelect label="Responsable" value={suiviFilters.responsable} onChange={v=>{const newFilters={...suiviFilters,responsable:v};if(v){const u=users.find(x=>x.username===v);if(u&&u.structure)newFilters.structure=u.structure}setSuiviFilters(newFilters)}} options={suiviFilters.structure?gestOpts.filter(o=>{const u=users.find(x=>x.username===o.value);return u&&u.structure===suiviFilters.structure}):gestOpts} size="sm"/></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={suiviFilters.statut} onChange={e=>setSuiviFilters({...suiviFilters,statut:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="Retard">Retard</option><option value="Pas retard">Pas retard</option></select></div>
              <div className="w-32"><label className="block text-[10px] font-medium text-gray-500 mb-1">Atteinte</label><select value={suiviFilters.atteinte} onChange={e=>setSuiviFilters({...suiviFilters,atteinte:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Toutes</option><option value="atteint">≥100%</option><option value="proche">≥90%</option><option value="non_atteint">&lt;90%</option></select></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Renseign.</label><select value={suiviFilters.renseignement} onChange={e=>setSuiviFilters({...suiviFilters,renseignement:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">Tous</option><option value="oui">Oui</option><option value="non">Non</option></select></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Début≥</label><input type="date" value={suiviFilters.date_debut} onChange={e=>setSuiviFilters({...suiviFilters,date_debut:e.target.value})} className="w-full px-1 py-1.5 text-xs border rounded"/></div>
              <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Fin≤</label><input type="date" value={suiviFilters.date_fin} onChange={e=>setSuiviFilters({...suiviFilters,date_fin:e.target.value})} className="w-full px-1 py-1.5 text-xs border rounded"/></div>
              <div className="flex-1 min-w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={suiviFilters.recherche} onChange={e=>setSuiviFilters({...suiviFilters,recherche:e.target.value})} className="w-full px-2 py-1.5 text-xs border rounded"/></div>
              <button onClick={()=>setSuiviFilters({groupe:'',structure:'',indicateur:'',responsable:'',statut:'',atteinte:'',date_debut:'',date_fin:'',renseignement:'',recherche:''})} className="p-1.5 hover:bg-gray-100 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
              
            </div>
          </div>
          <div className="relative">{canScrollLeft&&<button onClick={()=>scrollTable('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow rounded-full p-1.5 border"><ChevronLeft size={18}/></button>}{canScrollRight&&<button onClick={()=>scrollTable('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow rounded-full p-1.5 border"><ChevronRight size={18}/></button>}<div ref={tableContainerRef} onScroll={checkScroll} className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}><table className="w-full text-[10px]" style={{minWidth:'900px'}}><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-20"><tr><th className="px-2 py-2 text-left text-white sticky left-0 bg-[#1a365d] z-30" style={{minWidth:'140px'}}>Libellé</th><th className="px-2 py-2 text-center text-white">Période</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Limite</th><th className="px-2 py-2 text-center text-white">Val</th><th className="px-2 py-2 text-center text-white">Cible</th><th className="px-2 py-2 text-center text-white">Att.</th><th className="px-2 py-2 text-center text-white">Saisie</th><th className="px-2 py-2 text-center text-white">Ret.</th><th className="px-2 py-2 text-center text-white">St.</th><th className="px-2 py-2 text-center text-white sticky right-0 bg-[#1a365d] z-30" style={{width:'50px'}}>Act</th></tr></thead><tbody className="divide-y divide-gray-100">{loading?<tr><td colSpan={12} className="text-center py-8 text-gray-500">Chargement...</td></tr>:fOcc.length===0?<tr><td colSpan={12} className="text-center py-8 text-gray-500">Aucune</td></tr>:fOcc.map(occ=>{const ind=indicateurs.find(i=>i.code_indicateur===occ.code_indicateur);const ce=canEditOcc(occ,ind);const cs=canSaisir(occ,ind);const cibleVal=getCible(occ,ind);const att=getAtteinte(occ.val_indicateur,cibleVal,ind?.sens);const ret=calcRetard(occ);const isTx=ind?.type_indicateur==='Taux'||ind?.type_indicateur==='TxCalcule';return<tr key={occ.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 whitespace-nowrap overflow-hidden text-ellipsis sticky left-0 bg-white z-10" style={{maxWidth:'140px'}} title={ind?.libelle_indicateur}>{ind?.libelle_indicateur||'-'}</td><td className="px-2 py-1.5 text-center">{occ.periode||'-'}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_debut)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_fin)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_limite_saisie)}</td><td className="px-2 py-1.5 text-center font-medium">{occ.val_indicateur!=null?(isTx?`${parseFloat(occ.val_indicateur).toFixed(1)}%`:occ.val_indicateur):'-'}</td><td className="px-2 py-1.5 text-center">{cibleVal!=null?(isTx?`${cibleVal}%`:cibleVal):'-'}</td><td className="px-2 py-1.5 text-center"><AttBadge a={att}/></td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_saisie)}</td><td className="px-2 py-1.5 text-center"><RetBadge ret={ret}/></td><td className="px-2 py-1.5 text-center"><StBadge ret={ret}/></td><td className="px-2 py-1.5 text-center sticky right-0 bg-white z-10"><div className="flex justify-center gap-1">{(ce||cs)?<button onClick={()=>handleOpenOccModal(occ)} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><Edit size={12}/></button>:<button onClick={()=>handleOpenOccModal(occ)} className="p-1 text-gray-400 rounded"><Eye size={12}/></button>}{ce&&<button onClick={()=>handleDelOcc(occ)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}</div></td></tr>})}</tbody></table></div></div>
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">Total: {fOcc.length}</div>
        </div>}
      </div>

      

      {/* Modal Occurrences archivées (lecture seule) */}
      <Modal isOpen={showArchivedSuiviModal} onClose={()=>setShowArchivedSuiviModal(false)} title="Occurrences archivées" size="lg">
        <div className="text-xs text-gray-600 mb-2">Liste en lecture seule des occurrences archivées. Elles ne s'affichent plus dans l'onglet Suivi.</div>
        <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}>
          <table className="w-full text-[10px]" style={{minWidth:'900px'}}>
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left">Indicateur</th>
                <th className="px-2 py-2 text-center">Période</th>
                <th className="px-2 py-2 text-center">Début</th>
                <th className="px-2 py-2 text-center">Fin</th>
                <th className="px-2 py-2 text-center">Limite</th>
                <th className="px-2 py-2 text-center">Valeur</th>
                <th className="px-2 py-2 text-center">Cible</th>
                <th className="px-2 py-2 text-center">Saisie</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {archivedSuiviOccurrences.length===0?
                <tr><td colSpan={8} className="text-center py-6 text-gray-500">Aucune occurrence archivée</td></tr>
              :archivedSuiviOccurrences.map(occ=>{
                const ind = indicateurs.find(i=>i.code_indicateur===occ.code_indicateur)
                const isTx=ind?.type_indicateur==='Taux'||ind?.type_indicateur==='TxCalcule'
                const cibleVal=getCible(occ,ind)
                return (
                  <tr key={occ.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5" title={ind?.libelle_indicateur}>{ind?.libelle_indicateur||'-'}</td>
                    <td className="px-2 py-1.5 text-center">{occ.periode||'-'}</td>
                    <td className="px-2 py-1.5 text-center">{fmtDate(occ.date_debut)}</td>
                    <td className="px-2 py-1.5 text-center">{fmtDate(occ.date_fin)}</td>
                    <td className="px-2 py-1.5 text-center">{fmtDate(occ.date_limite_saisie)}</td>
                    <td className="px-2 py-1.5 text-center">{occ.val_indicateur!=null?(isTx?`${parseFloat(occ.val_indicateur).toFixed(1)}%`:occ.val_indicateur):'-'}</td>
                    <td className="px-2 py-1.5 text-center">{cibleVal!=null?(isTx?`${cibleVal}%`:cibleVal):'-'}</td>
                    <td className="px-2 py-1.5 text-center">{fmtDate(occ.date_saisie)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end pt-3 border-t mt-3"><Button variant="secondary" onClick={()=>setShowArchivedSuiviModal(false)}>Fermer</Button></div>
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
        <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={()=>setShowGroupeModal(false)}>Fermer</Button>{canEditGroupe(selectedGroupe)&&<Button onClick={handleSaveGrp}>Enregistrer</Button>}</div>
      </div></Modal>

      {/* Modal Indicateur avec SearchableSelect */}
      <Modal isOpen={showIndicateurModal} onClose={()=>setShowIndicateurModal(false)} title={selectedIndicateur?(canEditInd(selectedIndicateur)?'Modifier':'Détails'):'Nouvel indicateur'} size="lg" closeOnClickOutside={false}><div className="max-h-[70vh] overflow-y-auto pr-2 space-y-4">
        <FormInput label="Libellé *" value={indicateurForm.libelle_indicateur||''} onChange={v=>setIndicateurForm({...indicateurForm,libelle_indicateur:v})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)}/>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <SearchableMultiSelect label="Groupe(s) *" value={indicateurForm.groupes} onChange={handleAddGrp} options={groupes.filter(g=>g.statut==='Actif'&&!indicateurForm.groupes?.includes(g.code_groupe)).filter(g=>!(hasR||(indicateurForm.groupes?.length>0&&g.code_groupe==='Risque'))).map(g=>({value:g.code_groupe,label:g.libelle_groupe}))} placeholder="Rechercher..." disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)}/>
            <div className="flex flex-wrap gap-1 mt-2">{indicateurForm.groupes?.map(c=><span key={c} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${c==='Risque'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{groupes.find(g=>g.code_groupe===c)?.libelle_groupe||c}{(!selectedIndicateur||canEditInd(selectedIndicateur))&&<button onClick={()=>handleRemGrp(c)} className="hover:text-red-600"><X size={12}/></button>}</span>)}</div>
          </div>
          <SearchableSelect label="Structure *" value={indicateurForm.code_structure} onChange={handleStructChg} options={structOpts} placeholder="Choisir..." disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)}/>
        </div>
        <SearchableSelect label="Responsable *" value={indicateurForm.responsable} onChange={v=>setIndicateurForm({...indicateurForm,responsable:v})} options={getUsersStruct(indicateurForm.code_structure).map(u=>({value:u.username,label:`${u.nom} ${u.prenoms}`}))} placeholder={indicateurForm.code_structure?'Choisir...':'Choisir structure d\'abord'} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)||!indicateurForm.code_structure}/>
        <div className="grid grid-cols-3 gap-3"><div><label className="block text-xs font-medium text-gray-700 mb-1">Type *</label><select value={indicateurForm.type_indicateur||'Taux'} onChange={e=>handleTypeChg(e.target.value)} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} className="w-full px-2 py-1.5 text-xs border rounded">{typeOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-700 mb-1">Sens *</label><select value={indicateurForm.sens||'Positif'} onChange={e=>setIndicateurForm({...indicateurForm,sens:e.target.value})} disabled={selectedIndicateur&&!canEditInd(selectedIndicateur)} className="w-full px-2 py-1.5 text-xs border rounded"><option value="Positif">Positif</option><option value="Négatif">Négatif</option></select></div>{!hasR&&<div><label className="block text-xs font-medium text-gray-700 mb-1">Périodicité *</label><select value={indicateurForm.periodicite||''} onChange={e=>setIndicateurForm({...indicateurForm,periodicite:e.target.value})} disabled={!!selectedIndicateur} className="w-full px-2 py-1.5 text-xs border rounded"><option value="">...</option>{periodicites.map(p=><option key={p} value={p}>{p}</option>)}</select></div>}</div>
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cible *{selectedIndicateur?.type_indicateur!=='Nombre'?' (valeur en %, saisir sans le symbole %)':''}</label>
            <input type="number" step="any" value={createOccurrenceForm.cible||''} onChange={e=>setCreateOccurrenceForm({...createOccurrenceForm,cible:e.target.value})} className="w-full px-2 py-1.5 border rounded text-xs" placeholder={selectedIndicateur?.type_indicateur!=='Nombre'?'Ex: 85':'Ex: 100'}/>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t"><Button variant="secondary" onClick={()=>setShowCreateOccurrenceModal(false)}>Annuler</Button><Button onClick={handleSaveCreateOcc}>Créer</Button></div>
      </Modal>

      {/* Modal Liste Occurrences */}
      <Modal isOpen={showOccurrencesListModal} onClose={()=>setShowOccurrencesListModal(false)} title={`Occurrences - ${selectedIndicateur?.libelle_indicateur?.slice(0,30)}...`} size="lg"><div className="overflow-x-auto max-h-96"><table className="w-full text-[10px]"><thead className="bg-gray-100 sticky top-0"><tr><th className="px-2 py-2 text-left">Période</th><th className="px-2 py-2 text-center">Début</th><th className="px-2 py-2 text-center">Fin</th><th className="px-2 py-2 text-center">Valeur</th><th className="px-2 py-2 text-center">Cible</th><th className="px-2 py-2 text-center">Att.</th><th className="px-2 py-2 text-center">St.</th><th className="px-2 py-2 text-center">Act.</th></tr></thead><tbody className="divide-y">{indicateurOccurrences.length===0?<tr><td colSpan={8} className="text-center py-4 text-gray-500">Aucune</td></tr>:indicateurOccurrences.map(occ=>{const cibleVal=getCible(occ,selectedIndicateur);const att=getAtteinte(occ.val_indicateur,cibleVal,selectedIndicateur?.sens);const ce=canEditOcc(occ,selectedIndicateur);const cs=canSaisir(occ,selectedIndicateur);const isTx=selectedIndicateur?.type_indicateur==='Taux'||selectedIndicateur?.type_indicateur==='TxCalcule';return<tr key={occ.id} className="hover:bg-gray-50"><td className="px-2 py-1.5">{occ.periode||'Perso.'}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_debut)}</td><td className="px-2 py-1.5 text-center">{fmtDate(occ.date_fin)}</td><td className="px-2 py-1.5 text-center font-medium">{occ.val_indicateur!=null?(isTx?`${parseFloat(occ.val_indicateur).toFixed(1)}%`:occ.val_indicateur):'-'}</td><td className="px-2 py-1.5 text-center">{cibleVal!=null?(isTx?`${cibleVal}%`:cibleVal):'-'}</td><td className="px-2 py-1.5 text-center"><AttBadge a={att}/></td><td className="px-2 py-1.5 text-center"><StBadge s={occ.statut}/></td><td className="px-2 py-1.5 text-center"><div className="flex justify-center gap-1"><button onClick={()=>{setShowOccurrencesListModal(false);handleOpenOccModal(occ)}} className={`p-1 rounded ${(ce||cs)?'text-blue-600 hover:bg-blue-100':'text-gray-400'}`}>{(ce||cs)?<Edit size={12}/>:<Eye size={12}/>}</button>{ce&&<button onClick={()=>handleDelOcc(occ)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button>}</div></td></tr>})}</tbody></table></div><div className="text-xs text-gray-500 mt-2">Total: {indicateurOccurrences.length}</div></Modal>

      {/* Modal Saisie Occurrence - Masquer Num/Dén pour Nombre et TxCalcule */}
      <Modal isOpen={showOccurrenceModal} onClose={()=>setShowOccurrenceModal(false)} title="Saisie valeurs" size="md" closeOnClickOutside={false}>{(()=>{
        const ind=selectedIndicateur||indicateurs.find(i=>i.code_indicateur===occurrenceForm.code_indicateur)
        const ce=canEditOcc(selectedOccurrence,ind)
        const cs=canSaisir(selectedOccurrence,ind)
        
        // Vérifier si la période est échue (date de fin <= aujourd'hui)
        const today = new Date().toISOString().split('T')[0]
        const periodeEchue = occurrenceForm.date_fin && occurrenceForm.date_fin <= today
        const periodeNonEchue = !periodeEchue
        
        // Bloquer la saisie des valeurs si la période n'est pas échue (pour TOUS les utilisateurs)
        const saisieBloquee = periodeNonEchue
        const ro = (!ce && !cs) || saisieBloquee
        
        const ir=isRisque(ind)
        const ti=ind?.type_indicateur
        const isTx=ti==='Taux'||ti==='TxCalcule'
        const respOnly=cs&&!ce
        return<>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-800 font-medium">{ind?.libelle_indicateur}</p><p className="text-xs text-blue-600">Type: {getTypeL(ti)} | Sens: {ind?.sens}</p>{respOnly&&!saisieBloquee&&<p className="text-xs text-orange-600 mt-1 font-medium">Responsable: valeurs modifiables uniquement</p>}</div>
          
          {/* Message d'avertissement si période non échue */}
          {periodeNonEchue && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-600" />
              <p className="text-sm text-yellow-800 font-medium">Période non échue</p>
            </div>
            <p className="text-xs text-yellow-700 mt-1">La date de fin de période ({fmtDate(occurrenceForm.date_fin)}) n'est pas encore atteinte. La saisie des valeurs est désactivée.</p>
          </div>}
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {!ir&&<PeriodeSel form={occurrenceForm} setForm={setOccurrenceForm} per={ind?.periodicite} dis={!ce}/>}
            {ir&&<div className="p-2 bg-orange-50 rounded text-xs text-orange-700"><Info size={12} className="inline mr-1"/>Risque: dates fixes</div>}
            {ind?.periodicite!=='Personnalise'&&ind?.periodicite!=='Journalier'&&!ir&&<div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Début</label><input type="date" value={occurrenceForm.date_debut||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Fin</label><input type="date" value={occurrenceForm.date_fin||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div></div>}
            {ir&&<div className="grid grid-cols-3 gap-2"><div><label className="block text-xs text-gray-500 mb-1">Début</label><input type="date" value={occurrenceForm.date_debut||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Fin</label><input type="date" value={occurrenceForm.date_fin||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Limite</label><input type="date" value={occurrenceForm.date_limite_saisie||''} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div></div>}
            {!ir&&<FormInput label="Date limite *" type="date" value={occurrenceForm.date_limite_saisie||''} onChange={v=>setOccurrenceForm({...occurrenceForm,date_limite_saisie:v})} disabled={!ce}/>}
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Cible *{isTx?' (valeur en %, saisir sans le symbole %)':''}</label><input type="number" step="any" value={occurrenceForm.cible||''} onChange={e=>setOccurrenceForm({...occurrenceForm,cible:e.target.value})} disabled={!ce||ir} className={`w-full px-2 py-1.5 border rounded text-xs ${(!ce||ir)?'bg-gray-100':''}`} placeholder={isTx?'Ex: 85':'Ex: 100'}/>{ir&&<p className="text-[10px] text-gray-500 mt-1">={ind?.sens==='Négatif'?'S1':'S3'}</p>}</div>
            
            {/* Afficher Num/Dén uniquement pour type Taux */}
            {ti==='Taux'&&<>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-gray-700 mb-0.5">Numérateur</label><p className="text-[10px] text-gray-500 mb-1">{ind?.numerateur||'Num.'}</p><input type="number" step="any" value={saisieBloquee?'':occurrenceForm.val_numerateur||''} onChange={e=>setOccurrenceForm({...occurrenceForm,val_numerateur:e.target.value})} disabled={ro} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`} placeholder={saisieBloquee?'Période non échue':''}/></div><div><label className="block text-xs font-medium text-gray-700 mb-0.5">Dénominateur</label><p className="text-[10px] text-gray-500 mb-1">{ind?.denominateur||'Dén.'}</p><input type="number" step="any" value={saisieBloquee?'':occurrenceForm.val_denominateur||''} onChange={e=>setOccurrenceForm({...occurrenceForm,val_denominateur:e.target.value})} disabled={ro} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`} placeholder={saisieBloquee?'Période non échue':''}/></div></div>
              <div><label className="block text-xs text-gray-500 mb-1">Valeur (%)</label><input type="text" value={!saisieBloquee&&occurrenceForm.val_numerateur&&occurrenceForm.val_denominateur&&parseFloat(occurrenceForm.val_denominateur)!==0?`${((parseFloat(occurrenceForm.val_numerateur)/parseFloat(occurrenceForm.val_denominateur))*100).toFixed(2)}%`:'-'} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/><p className="text-[9px] text-gray-400">Calculé automatiquement</p></div>
            </>}
            
            {/* Pour TxCalcule - saisie directe de la valeur sans Num/Dén */}
            {ti==='TxCalcule'&&<div><label className="block text-xs font-medium text-gray-700 mb-1">Valeur (%) * - saisir sans le symbole %</label><input type="number" step="any" value={saisieBloquee?'':occurrenceForm.val_indicateur||''} onChange={e=>setOccurrenceForm({...occurrenceForm,val_indicateur:e.target.value})} disabled={ro} placeholder={saisieBloquee?'Période non échue':'Ex: 85.5'} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`}/></div>}
            
            {/* Pour Nombre - saisie directe de la valeur sans Num/Dén */}
            {ti==='Nombre'&&<div><label className="block text-xs font-medium text-gray-700 mb-1">Valeur *</label><input type="number" step="any" value={saisieBloquee?'':occurrenceForm.val_indicateur||''} onChange={e=>setOccurrenceForm({...occurrenceForm,val_indicateur:e.target.value})} disabled={ro} placeholder={saisieBloquee?'Période non échue':'Ex: 150'} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`}/></div>}
            
            <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Retard (j)</label><input type="text" value={occurrenceForm.nb_jr_retard??'-'} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div><div><label className="block text-xs text-gray-500 mb-1">Statut</label><input type="text" value={occurrenceForm.statut||'-'} disabled className="w-full px-2 py-1.5 border rounded text-xs bg-gray-100"/></div></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Commentaire</label><textarea value={occurrenceForm.commentaire||''} onChange={e=>setOccurrenceForm({...occurrenceForm,commentaire:e.target.value})} disabled={ro} rows={2} className={`w-full px-2 py-1.5 border rounded text-xs ${ro?'bg-gray-100':''}`}/></div>
          </div>
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t"><Button variant="secondary" onClick={()=>setShowOccurrenceModal(false)}>Fermer</Button>{!ro&&periodeEchue&&<Button onClick={handleSaveOcc}>Enregistrer</Button>}</div>
        </>})()}</Modal>

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
        onConfirm={() => { confirmAction?.onConfirm?.(); setConfirmAction(null) }}
        showCancel={true}
      />
    </div>
  )
}
