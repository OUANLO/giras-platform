'use client'
import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, List, CheckSquare, Plus, Edit, Trash2, Users, PlayCircle, ListChecks, RotateCcw, UserMinus, Eye, CheckCircle, XCircle, Download, Archive, ArchiveRestore } from 'lucide-react'
import { Button, Modal, SidebarButton, StatusBadge, SearchableSelect, AlertModal } from '@/components/ui'
import * as XLSX from 'xlsx'

export default function ActivitesPage() {
  const [activeTab, setActiveTab] = useState('projets')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
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
  const [occurrenceForm, setOccurrenceForm] = useState({ date_debut: '', date_fin: '', responsable: '', tx_avancement: 0 })
  const [tacheForm, setTacheForm] = useState({ libelle_tache: '', date_debut: '', date_fin: '', responsable: '', commentaire: '', tx_avancement: 0 })
  const [projetFilters, setProjetFilters] = useState({ gestionnaire: '', statut: '', search: '' })
  const [actionFilters, setActionFilters] = useState({ projet: '', structure: '', statut: '', search: '' })
  const [suiviFilters, setSuiviFilters] = useState({ projet: '', structure: '', responsable: '', dateDebut: '', dateFin: '', search: '', niveauAvancement: '', niveauRetard: '' })
  const subPages = [{ key: 'projets', label: 'Projet', icon: FolderOpen }, { key: 'actions', label: 'Actions', icon: List }, { key: 'suivi', label: 'Suivi actions', icon: CheckSquare }]
  
  // États pour l'archivage
  const [showArchives, setShowArchives] = useState(false)
  const [archiveType, setArchiveType] = useState('')
  const [archivedItems, setArchivedItems] = useState([])
  
  // État pour AlertModal unifié
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [confirmAction, setConfirmAction] = useState(null)
  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => { if (alertModal.onConfirm) alertModal.onConfirm(); setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null }) }

  // Fonction pour archiver un élément
  const handleArchive = async (type, id, libelle) => {
    setConfirmAction({
      message: `Voulez-vous archiver "${libelle}" ?\n\nCet élément ne sera plus modifiable et disparaîtra du tableau.`,
      onConfirm: async () => {
        try {
          const r = await fetch('/api/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, id, archive_par: user?.username })
          })
          if (r.ok) {
            showAlert('success', 'Élément archivé avec succès')
            if (type === 'projet' || type === 'groupe_actions') fetchProjets()
            else if (type === 'action') fetchActions()
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
      const r = await fetch(`/api/archive?type=${type}`)
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
  const handleUnarchive = async (type, id) => {
    try {
      const r = await fetch('/api/archive', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, modificateur: user?.username })
      })
      if (r.ok) {
        showAlert('success', 'Élément désarchivé avec succès')
        setArchivedItems(archivedItems.filter(i => i.id !== id))
        if (type === 'projet' || type === 'groupe_actions') fetchProjets()
        else if (type === 'action') fetchActions()
        else if (type === 'action_occurrence' || type === 'suivi_action') fetchOccurrences()
      }
    } catch (e) {
      showAlert('error', 'Erreur: ' + e.message)
    }
  }

  useEffect(() => { const u = localStorage.getItem('giras_user'); if (u) setUser(JSON.parse(u)); fetchData() }, [])
  useEffect(() => { if (activeTab === 'projets') fetchProjets(); else if (activeTab === 'actions') { fetchProjets(); fetchActions(); fetchOccurrences() } else if (activeTab === 'suivi') { fetchProjets(); fetchActions(); fetchOccurrences(); fetchTaches() } }, [activeTab])

  const fetchData = async () => { try { const [sRes, uRes] = await Promise.all([fetch('/api/structures?statut=Actif'), fetch('/api/users?statut=Actif')]); if (sRes.ok) setStructures((await sRes.json()).structures || []); if (uRes.ok) setUsers((await uRes.json()).users || []) } catch (e) { console.error(e) } }
  const fetchProjets = async () => { setLoading(true); try { const r = await fetch('/api/groupes-actions'); if (r.ok) setProjets((await r.json()).groupes || []) } catch (e) { console.error(e) } finally { setLoading(false) } }
  const fetchActions = async () => { try { const r = await fetch('/api/actions'); if (r.ok) setActions((await r.json()).actions || []) } catch (e) { console.error(e) } }
  const fetchOccurrences = async () => { try { const r = await fetch('/api/actions/occurrences'); if (r.ok) setOccurrences((await r.json()).occurrences || []) } catch (e) { console.error(e) } }
  const fetchTaches = async () => { try { const r = await fetch('/api/taches'); if (r.ok) setTaches((await r.json()).taches || []) } catch (e) { console.error(e) } }

  // ============ PERMISSIONS ============
  const isAdmin = () => user?.type_utilisateur === 'Super admin' || user?.type_utilisateur === 'Admin'
  const isManager = () => user?.type_utilisateur === 'Manager' || user?.type_utilisateur === 'Super manager'
  const canCreateProjects = () => isAdmin() || isManager()
  
  const getProjetGestionnaires = (p) => { if (!p) return []; try { return Array.isArray(p.gestionnaires) ? p.gestionnaires : JSON.parse(p.gestionnaires || '[]') } catch { return [] } }
  const getProjetMembres = (p) => { if (!p) return []; if (p.code_groupe === 'RISQUES') return users.filter(u => u.statut === 'Actif').map(u => u.username); const g = getProjetGestionnaires(p); try { const m = Array.isArray(p.membres) ? p.membres : JSON.parse(p.membres || '[]'); return [...new Set([...g, ...m])] } catch { return g } }
  const isGestionnaireProjet = (p) => p && user && getProjetGestionnaires(p).includes(user.username)
  const isMembreProjet = (p) => p && user && getProjetMembres(p).includes(user.username)
  const isCreateurProjet = (p) => p && user && p.createur === user.username
  
  const canViewProjet = (p) => { if (!p) return false; if (p.type_projet !== 'Privé') return true; return isAdmin() || isMembreProjet(p) }
  const canEditProjet = (p) => {
    // Le projet RISQUES ne peut pas être modifié ici - gestionnaires gérés dans Gestion des risques
    if (p?.code_groupe === 'RISQUES') return false
    return isAdmin() || isGestionnaireProjet(p) || isCreateurProjet(p)
  }
  const canDeleteProjet = (p) => p?.code_groupe !== 'RISQUES' && (isAdmin() || isGestionnaireProjet(p) || isCreateurProjet(p))
  const canViewMembres = (p) => isAdmin() || isGestionnaireProjet(p) || isCreateurProjet(p)
  
  const canViewAction = (a) => { const p = projets.find(x => x.code_groupe === a?.code_groupe); return canViewProjet(p) }
  const canEditAction = (a) => { const p = projets.find(x => x.code_groupe === a?.code_groupe); return isAdmin() || isGestionnaireProjet(p) || isCreateurProjet(p) }
  const canCreateAction = (p) => isAdmin() || isGestionnaireProjet(p) || isCreateurProjet(p) || isManager()
  
  const canEditOccurrence = (o) => { const a = actions.find(x => x.code_action === o?.code_action); const p = projets.find(x => x.code_groupe === a?.code_groupe); return isAdmin() || isGestionnaireProjet(p) || isCreateurProjet(p) }
  const isResponsableOccurrence = (o) => o?.responsable === user?.username
  const canEditTxAvancement = (o) => canEditOccurrence(o) || isResponsableOccurrence(o)
  
  const canEditTache = (t) => { const o = occurrences.find(x => (x.code_occurrence || x.id) === t?.code_occurrence); return canEditOccurrence(o) }
  const isResponsableTache = (t) => t?.responsable === user?.username
  const canEditTxTache = (t) => canEditTache(t) || isResponsableTache(t)

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
        await fetch('/api/actions/occurrences', { 
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
  const projetOptions = projets.filter(p => p.statut === 'Actif' && p.code_groupe !== 'RISQUES').map(p => ({ value: p.code_groupe, label: p.libelle_groupe }))
  const projetFilterOptions = [{ value: '', label: 'Tous les projets' }, ...projets.map(p => ({ value: p.code_groupe, label: p.libelle_groupe }))]
  const structureFilterOptions = [{ value: '', label: 'Toutes' }, ...structures.map(s => ({ value: s.code_structure, label: s.libelle_structure || s.code_structure }))]
  const responsableFilterOptions = [{ value: '', label: 'Tous' }, ...users.filter(u => u.statut === 'Actif').map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms}` }))]
  
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
      const r = await fetch('/api/groupes-actions', { method: selectedProjet ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...projetForm, id: selectedProjet?.id, createur: selectedProjet?.createur || user?.username, modificateur: user?.username }) })
      if (r.ok) { showAlert('success', selectedProjet ? 'Projet modifié avec succès' : 'Projet créé avec succès', () => { setShowProjetModal(false); fetchProjets() }) }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') }
  }
  
  const handleDeleteProjet = (p) => {
    if (!canDeleteProjet(p)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: `Supprimer "${p.libelle_groupe}" ?`, onConfirm: async () => {
      try { const r = await fetch('/api/groupes-actions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }); if (r.ok) { showAlert('success', 'Projet supprimé', fetchProjets) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }
  
  const handleUpdateGestionnairesRisques = async () => {
    const rp = projets.find(p => p.code_groupe === 'RISQUES')
    if (!rp) return
    try { const r = await fetch('/api/groupes-actions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rp.id, gestionnaires: projetForm.gestionnaires, modificateur: user?.username, isRisquesUpdate: true }) }); if (r.ok) { showAlert('success', 'Gestionnaires mis à jour', () => { setShowProjetModal(false); fetchProjets() }) } } catch { }
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
    try { const r = await fetch('/api/groupes-actions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedProjet.id, membres: newMembres, gestionnaires: getProjetGestionnaires(selectedProjet), libelle_groupe: selectedProjet.libelle_groupe, type_projet: selectedProjet.type_projet, statut: selectedProjet.statut, modificateur: user?.username }) }); if (r.ok) { setSelectedProjet({...selectedProjet, membres: newMembres}); fetchProjets() } } catch { showAlert('error', 'Erreur de connexion') }
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
      const r = await fetch('/api/actions', { method: selectedAction ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) { setShowActionModal(false); fetchActions(); fetchOccurrences(); showAlert('success', selectedAction ? 'Action modifiée avec succès' : 'Action et occurrence créées') }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch (e) { showAlert('error', 'Erreur: ' + e.message) }
  }
  
  const handleDeleteAction = (a) => {
    if (!canEditAction(a)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: `Supprimer "${a.libelle_action}" ?`, onConfirm: async () => {
      try { const r = await fetch('/api/actions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) }); if (r.ok) { showAlert('success', 'Action supprimée', () => { fetchActions(); fetchOccurrences() }) } else { const err = await r.json(); showAlert('error', err.error || 'Erreur') } } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }

  // ============ HANDLERS OCCURRENCES ============
  // Le modal est rendu globalement, donc il s'ouvre immédiatement
  const handleOpenOccurrenceForm = (action) => {
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
      setOccurrenceForm({ date_debut: '', date_fin: '', responsable: '', tx_avancement: 0 })
      
      // Ouvrir le modal immédiatement (le modal est rendu globalement)
      setShowOccurrenceEditModal(true)
    }})
  }
  
  const handleSaveOccurrence = async () => {
    if (!occurrenceForm.date_debut || !occurrenceForm.date_fin) { showAlert('error', 'Dates obligatoires'); return }
    if (occurrenceForm.date_fin < occurrenceForm.date_debut) { showAlert('error', 'La date de fin doit être ultérieure ou égale à la date de début'); return }
    if (!occurrenceForm.responsable) { showAlert('error', 'Responsable obligatoire'); return }
    const isNew = !selectedOccurrence
    
    if (isNew && selectedAction) {
      if (occurrences.find(o => o.code_action === selectedAction.code_action && o.date_debut === occurrenceForm.date_debut && o.date_fin === occurrenceForm.date_fin)) { 
        showAlert('error', 'Cette occurrence existe déjà'); return 
      }
    }
    
    try {
      const body = isNew 
        ? { code_action: selectedAction.code_action, ...occurrenceForm, tx_avancement: 0, createur: user?.username } 
        : { id: selectedOccurrence.id, ...occurrenceForm, modificateur: user?.username }
      const r = await fetch('/api/actions/occurrences', { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) { 
        showAlert('success', isNew ? 'Occurrence créée' : 'Occurrence modifiée', () => { setShowOccurrenceEditModal(false); fetchOccurrences() })
      }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') }
  }
  
  const handleDeleteOccurrence = (o) => {
    if (!canEditOccurrence(o)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: 'Supprimer cette occurrence ?', onConfirm: async () => {
      try { const r = await fetch('/api/actions/occurrences', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) }); if (r.ok) { showAlert('success', 'Occurrence supprimée', fetchOccurrences) } } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }
  
  // Confirmer ou annuler la confirmation gestionnaire
  const handleToggleGestionnaireConf = (o, doConfirm) => {
    if (!canEditOccurrence(o)) { showAlert('error', 'Non autorisé'); return }
    const tx = getTxAvancementForOccurrence(o)
    if (doConfirm && tx < 100) { showAlert('error', 'Le taux d\'avancement doit être à 100%'); return }
    
    const msg = doConfirm ? "Confirmer l'achèvement ?" : "Annuler la confirmation ?"
    setConfirmAction({ message: msg, onConfirm: async () => {
      try { 
        const body = { 
          id: o.id, 
        gestionnaire_conf: doConfirm ? 'Oui' : null, 
        date_conf: doConfirm ? new Date().toISOString().split('T')[0] : null, 
        modificateur: user?.username 
      }
      const r = await fetch('/api/actions/occurrences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) { 
        fetchOccurrences()
        showAlert('success', doConfirm ? 'Confirmé' : 'Confirmation annulée') 
      } 
    } catch { showAlert('error', 'Erreur de connexion') }
    }})
  }

  // ============ HANDLERS TACHES ============
  const handleOpenTacheForm = (occurrence, fromList = false) => {
    if (!canEditOccurrence(occurrence)) {
      showAlert('error', 'Non autorisé')
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
    if (!tacheForm.libelle_tache) { showAlert('error', 'Libellé obligatoire'); return }
    if (!tacheForm.date_debut || !tacheForm.date_fin) { showAlert('error', 'Dates obligatoires'); return }
    if (!tacheForm.responsable) { showAlert('error', 'Responsable obligatoire'); return }
    
    if (selectedOccurrence) {
      const tDebut = new Date(tacheForm.date_debut), tFin = new Date(tacheForm.date_fin)
      const oDebut = new Date(selectedOccurrence.date_debut), oFin = new Date(selectedOccurrence.date_fin)
      if (tDebut < oDebut) { showAlert('error', "Date début antérieure à l'occurrence"); return }
      if (tFin > oFin) { showAlert('error', "Date fin postérieure à l'occurrence"); return }
    }
    
    try {
      const occId = selectedOccurrence?.code_occurrence || selectedOccurrence?.id
      const r = await fetch('/api/taches', { method: selectedTache ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tacheForm, id: selectedTache?.id, code_occurrence: selectedTache?.code_occurrence || occId, code_action: selectedOccurrence?.code_action, createur: selectedTache?.createur || user?.username, modificateur: user?.username }) })
      if (r.ok) { showAlert('success', selectedTache ? 'Tâche modifiée' : 'Tâche créée', () => { setShowTacheModal(false); fetchTaches(); fetchOccurrences() }) }
      else { const err = await r.json(); showAlert('error', err.error || 'Erreur') }
    } catch { showAlert('error', 'Erreur de connexion') }
  }
  
  const handleDeleteTache = (t) => {
    if (!canEditTache(t)) { showAlert('error', 'Non autorisé'); return }
    setConfirmAction({ message: 'Supprimer cette tâche ?', onConfirm: async () => {
      try { const r = await fetch('/api/taches', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) }); if (r.ok) { showAlert('success', 'Tâche supprimée', () => { fetchTaches(); fetchOccurrences() }) } } catch { showAlert('error', 'Erreur de connexion') }
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
      const projet = projets.find(p => p.code_groupe === a.code_groupe)
      const actionOccs = occurrences.filter(o => o.code_action === a.code_action)
      return {
        'Libellé': a.libelle_action,
        'Projet': projet?.libelle_groupe || a.code_groupe,
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
      const a = actions.find(x => x.code_action === o.code_action)
      const p = projets.find(x => x.code_groupe === a?.code_groupe)
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
  const getFilteredProjets = () => projets.filter(p => canViewProjet(p) && !p.archive && (!projetFilters.gestionnaire || getProjetGestionnaires(p).includes(projetFilters.gestionnaire)) && (!projetFilters.statut || p.statut === projetFilters.statut) && (!projetFilters.search || p.libelle_groupe?.toLowerCase().includes(projetFilters.search.toLowerCase()) || p.code_groupe?.toLowerCase().includes(projetFilters.search.toLowerCase())))
  const getFilteredActions = () => actions.filter(a => canViewAction(a) && !a.archive && (!actionFilters.projet || a.code_groupe === actionFilters.projet) && (!actionFilters.structure || a.code_structure === actionFilters.structure) && (!actionFilters.statut || a.statut === actionFilters.statut) && (!actionFilters.search || a.libelle_action?.toLowerCase().includes(actionFilters.search.toLowerCase())))
  const getFilteredOccurrences = () => occurrences.filter(o => { 
    const a = actions.find(x => x.code_action === o.code_action)
    if (!a || !canViewAction(a)) return false
    if (suiviFilters.projet && a.code_groupe !== suiviFilters.projet) return false
    if (suiviFilters.structure && a.code_structure !== suiviFilters.structure) return false
    if (suiviFilters.responsable && o.responsable !== suiviFilters.responsable) return false
    if (suiviFilters.search && !a.libelle_action?.toLowerCase().includes(suiviFilters.search.toLowerCase())) return false
    if (suiviFilters.dateDebut && o.date_debut < suiviFilters.dateDebut) return false
    if (suiviFilters.dateFin && o.date_fin > suiviFilters.dateFin) return false
    
    // Filtres niveau avancement et retard
    const tx = getTxAvancementForOccurrence(o)
    const calc = calculateOccurrenceFields({...o, tx_avancement: tx})
    
    if (suiviFilters.niveauAvancement && calc.niveauAvancement !== suiviFilters.niveauAvancement) return false
    if (suiviFilters.niveauRetard && calc.niveauRetard !== suiviFilters.niveauRetard) return false
    
    return true
  }).sort((a, b) => {
    const sortA = getSortPriority(a)
    const sortB = getSortPriority(b)
    // Tri primaire par priorité
    if (sortA.priority !== sortB.priority) return sortA.priority - sortB.priority
    // Tri secondaire par jours de retard décroissant (du plus grand au plus petit)
    return sortB.jourRetard - sortA.jourRetard
  })

  // ============ RENDER PROJETS ============
  const renderProjets = () => {
    const filtered = getFilteredProjets()
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Projets</h2>
          <div className="flex gap-2">
            {canCreateProjects() && <Button size="sm" icon={Plus} onClick={() => { setSelectedProjet(null); setProjetForm({ libelle_groupe: '', commentaire: '', gestionnaires: [], membres: [], type_projet: 'Public', statut: 'Actif' }); setShowProjetModal(true) }}>Nouveau projet</Button>}
            <Button size="sm" variant="secondary" onClick={exportProjetsToExcel}><Download size={14} className="mr-1"/>Excel</Button>
            <button onClick={() => handleViewArchives('projet')} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"><Archive size={14}/>Archives</button>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border flex flex-wrap gap-3 items-end">
          <div className="w-44"><SearchableSelect label="Gestionnaire" value={projetFilters.gestionnaire} onChange={v => setProjetFilters({...projetFilters, gestionnaire: v})} options={userOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={projetFilters.statut} onChange={e => setProjetFilters({...projetFilters, statut: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div>
          <div className="flex-1 max-w-xs"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher..." value={projetFilters.search} onChange={e => setProjetFilters({...projetFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <button onClick={() => setProjetFilters({gestionnaire:'', statut:'', search:''})} className="p-1.5 hover:bg-gray-100 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
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
                              {canEdit && <button onClick={() => { setSelectedProjet(p); setProjetForm({...p, gestionnaires: gest, membres: Array.isArray(p.membres) ? p.membres : JSON.parse(p.membres || '[]')}); setShowProjetModal(true) }} className="p-1 hover:bg-blue-100 rounded" title="Modifier"><Edit size={12} className="text-blue-600"/></button>}
                              {canMbr && <button onClick={() => { setSelectedProjet(p); setShowMembresModal(true) }} className="p-1 hover:bg-purple-100 rounded" title="Membres"><Users size={12} className="text-purple-600"/></button>}
                              {canDel && <button onClick={() => handleDeleteProjet(p)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
                              {canEdit && <button onClick={() => handleArchive('projet', p.id, p.libelle_groupe)} className="p-1 hover:bg-orange-100 rounded" title="Archiver"><Archive size={12} className="text-orange-600"/></button>}
                              {!canEdit && <span className="text-gray-400 text-[9px] italic">Lecture seule</span>}
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
        <Modal isOpen={showProjetModal} onClose={() => setShowProjetModal(false)} title={selectedProjet ? (selectedProjet.code_groupe === 'RISQUES' ? 'Gestionnaires Risques' : 'Modifier') : 'Nouveau projet'} size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            {selectedProjet?.code_groupe !== 'RISQUES' && <><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Code *</label><input type="text" value={projetForm.code_groupe || ''} onChange={e => setProjetForm({...projetForm, code_groupe: e.target.value.toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '')})} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="Ex: PROJ01" maxLength={20} disabled={!!selectedProjet}/><p className="text-xs text-gray-500 mt-1">Max 20 caractères, sans espaces</p></div><div><label className="block text-sm font-medium mb-1">Libellé *</label><input type="text" value={projetForm.libelle_groupe || ''} onChange={e => setProjetForm({...projetForm, libelle_groupe: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedProjet && !canEditProjet(selectedProjet)}/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Type</label><select value={projetForm.type_projet || 'Public'} onChange={e => setProjetForm({...projetForm, type_projet: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedProjet && !canEditProjet(selectedProjet)}><option value="Public">Public</option><option value="Privé">Privé</option></select></div><div><label className="block text-sm font-medium mb-1">Statut</label><select value={projetForm.statut || 'Actif'} onChange={e => setProjetForm({...projetForm, statut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedProjet && !canEditProjet(selectedProjet)}><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div></div></>}
            <SearchableSelect label="Gestionnaire(s) *" value={projetForm.gestionnaires} onChange={v => setProjetForm({...projetForm, gestionnaires: v})} options={userOptions} multiple placeholder="Sélectionner..." disabled={selectedProjet && !canEditProjet(selectedProjet)}/>
            {selectedProjet?.code_groupe !== 'RISQUES' && <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={projetForm.commentaire || ''} onChange={e => setProjetForm({...projetForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={selectedProjet && !canEditProjet(selectedProjet)}/></div>}
            <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={() => setShowProjetModal(false)}>Fermer</Button>{(canEditProjet(selectedProjet) || !selectedProjet) && <Button onClick={selectedProjet?.code_groupe === 'RISQUES' ? handleUpdateGestionnairesRisques : handleSaveProjet}>Enregistrer</Button>}</div>
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
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Actions</h2>
          <div className="flex gap-2">
            {canCreateAny && <Button size="sm" icon={Plus} onClick={() => { setSelectedAction(null); setActionForm({ libelle_action: '', code_groupe: '', code_structure: '', commentaire: '', statut: 'Actif', occ_date_debut: '', occ_date_fin: '', occ_responsable: '' }); setShowActionModal(true) }}>Nouvelle action</Button>}
            <Button size="sm" variant="secondary" onClick={exportActionsToExcel}><Download size={14} className="mr-1"/>Excel</Button>
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border flex flex-wrap gap-3 items-end">
          <div className="w-56"><SearchableSelect label="Projet" value={actionFilters.projet} onChange={v => setActionFilters({...actionFilters, projet: v})} options={projetFilterOptions} placeholder="Tous" size="sm"/></div>
          <div className="w-52"><SearchableSelect label="Structure" value={actionFilters.structure} onChange={v => setActionFilters({...actionFilters, structure: v})} options={structureFilterOptions} placeholder="Toutes" size="sm"/></div>
          <div className="w-28"><label className="block text-[10px] font-medium text-gray-500 mb-1">Statut</label><select value={actionFilters.statut} onChange={e => setActionFilters({...actionFilters, statut: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"><option value="">Tous</option><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher..." value={actionFilters.search} onChange={e => setActionFilters({...actionFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
          <button onClick={() => handleViewArchives('action')} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 self-end"><Archive size={14}/>Archives</button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10"><tr><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-left text-white">Projet</th><th className="px-2 py-2 text-left text-white">Structure</th><th className="px-2 py-2 text-center text-white">Statut</th><th className="px-2 py-2 text-center text-white" style={{minWidth:'140px'}}>Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Chargement...</td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Aucune action</td></tr> : filtered.map(a => {
                  const projet = projets.find(p => p.code_groupe === a.code_groupe), actionOccs = occurrences.filter(o => o.code_action === a.code_action), canEdit = canEditAction(a)
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 max-w-[300px] truncate">{a.libelle_action}</td>
                      <td className="px-2 py-1.5 text-gray-600">{projet?.libelle_groupe || a.code_groupe}</td>
                      <td className="px-2 py-1.5 text-gray-600">{a.code_structure}</td>
                      <td className="px-2 py-1.5 text-center"><StatusBadge status={a.statut} /></td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit ? (
                            <>
                              <button onClick={() => { setSelectedAction(a); setActionForm({...a}); setShowActionModal(true) }} className="p-1 hover:bg-blue-100 rounded" title="Modifier"><Edit size={12} className="text-blue-600"/></button>
                              <button onClick={() => handleDeleteAction(a)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>
                              {a.statut === 'Actif' && <button onClick={() => handleOpenOccurrenceForm(a)} className="p-1 hover:bg-green-100 rounded" title="Ouvrir occurrence"><PlayCircle size={12} className="text-green-600"/></button>}
                              <button onClick={() => handleArchive('action', a.id, a.libelle_action)} className="p-1 hover:bg-orange-100 rounded" title="Archiver"><Archive size={12} className="text-orange-600"/></button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-[9px] italic mr-1">Lecture seule</span>
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
        <Modal isOpen={showActionModal} onClose={() => setShowActionModal(false)} title={selectedAction ? "Modifier l'action" : 'Nouvelle action'} size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Libellé *</label><input type="text" value={actionForm.libelle_action || ''} onChange={e => setActionForm({...actionForm, libelle_action: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedAction && !canEditAction(selectedAction)}/></div>
            <div className="grid grid-cols-2 gap-4">
              <SearchableSelect label="Projet *" value={actionForm.code_groupe} onChange={v => setActionForm({...actionForm, code_groupe: v, occ_responsable: ''})} options={projetOptions} placeholder="Sélectionner..." disabled={selectedAction && !canEditAction(selectedAction)}/>
              <SearchableSelect label="Structure *" value={actionForm.code_structure} onChange={v => setActionForm({...actionForm, code_structure: v, occ_responsable: ''})} options={structureOptions} placeholder="Sélectionner..." disabled={selectedAction && !canEditAction(selectedAction)}/>
            </div>
            <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={actionForm.commentaire || ''} onChange={e => setActionForm({...actionForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={selectedAction && !canEditAction(selectedAction)}/></div>
            <div><label className="block text-sm font-medium mb-1">Statut</label><select value={actionForm.statut || 'Actif'} onChange={e => setActionForm({...actionForm, statut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedAction && !canEditAction(selectedAction)}><option value="Actif">Actif</option><option value="Inactif">Inactif</option></select></div>
            {!selectedAction && <div className="border-t pt-4 mt-4"><h4 className="text-sm font-semibold text-gray-700 mb-3">Planification de la première occurrence</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Date début *</label><input type="date" value={actionForm.occ_date_debut || ''} onChange={e => setActionForm({...actionForm, occ_date_debut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/></div><div><label className="block text-sm font-medium mb-1">Date fin *</label><input type="date" value={actionForm.occ_date_fin || ''} onChange={e => setActionForm({...actionForm, occ_date_fin: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/></div></div><div className="mt-3"><SearchableSelect label="Responsable * (membre du projet + structure)" value={actionForm.occ_responsable} onChange={v => setActionForm({...actionForm, occ_responsable: v})} options={getResponsablesForAction().map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms} (${u.username})` }))} placeholder={!actionForm.code_groupe ? '-- Sélectionner projet --' : !actionForm.code_structure ? '-- Sélectionner structure --' : 'Sélectionner...'} disabled={!actionForm.code_groupe || !actionForm.code_structure}/>{actionForm.code_groupe && actionForm.code_structure && getResponsablesForAction().length === 0 && <p className="text-xs text-orange-600 mt-1">Aucun membre du projet dans cette structure.</p>}</div></div>}
            <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={() => setShowActionModal(false)}>Fermer</Button>{(!selectedAction || canEditAction(selectedAction)) && <Button onClick={handleSaveAction}>Enregistrer</Button>}</div>
          </div>
        </Modal>
        <Modal isOpen={showOccurrencesListModal} onClose={() => setShowOccurrencesListModal(false)} title={`Occurrences - ${selectedAction?.libelle_action}`} size="lg" closeOnClickOutside={false}>
          <div className="space-y-4">
            {occurrences.filter(o => o.code_action === selectedAction?.code_action).length === 0 ? <p className="text-center text-gray-500 py-6 text-xs">Aucune occurrence</p> : <table className="w-full text-[10px]"><thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]"><tr><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Tx%</th><th className="px-2 py-2 text-left text-white">Responsable</th><th className="px-2 py-2 text-center text-white">Conf.</th><th className="px-2 py-2 text-center text-white">Statut</th></tr></thead><tbody className="divide-y divide-gray-100">{occurrences.filter(o => o.code_action === selectedAction?.code_action).map(o => { const tx = getTxAvancementForOccurrence(o); const calc = calculateOccurrenceFields({...o, tx_avancement: tx}); const isAchevee = calc.niveauAvancement === 'Achevée'; return <tr key={o.id} className="hover:bg-gray-50"><td className="px-2 py-1.5 text-center">{o.date_debut ? new Date(o.date_debut).toLocaleDateString('fr-FR') : '-'}</td><td className="px-2 py-1.5 text-center">{o.date_fin ? new Date(o.date_fin).toLocaleDateString('fr-FR') : '-'}</td><td className="px-2 py-1.5 text-center">{tx}%</td><td className="px-2 py-1.5">{o.responsable || '-'}</td><td className="px-2 py-1.5 text-center">{tx >= 100 && o.gestionnaire_conf === 'Oui' ? <span className="text-green-600">✓</span> : '-'}</td><td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${isAchevee ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{calc.niveauAvancement}</span></td></tr> })}</tbody></table>}
            <div className="flex justify-end pt-4 border-t"><Button variant="secondary" onClick={() => setShowOccurrencesListModal(false)}>Fermer</Button></div>
          </div>
        </Modal>
      </div>
    )
  }

  // ============ RENDER SUIVI ============
  const renderSuivi = () => {
    const filtered = getFilteredOccurrences()
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
    
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Suivi des actions</h2>
        <div className="bg-white rounded-lg p-3 shadow-sm border space-y-2">
          {/* Première ligne - Tous les filtres */}
          <div className="flex gap-2 items-end">
            <div className="w-36"><SearchableSelect label="Projet" value={suiviFilters.projet} onChange={v => setSuiviFilters({...suiviFilters, projet: v})} options={projetFilterOptions} placeholder="Tous" size="sm"/></div>
            <div className="w-[154px]"><SearchableSelect label="Structure" value={suiviFilters.structure} onChange={v=>{const nf={...suiviFilters,structure:v};if(v&&suiviFilters.responsable){const ru=users.find(u=>u.username===suiviFilters.responsable);if(ru&&ru.structure!==v)nf.responsable=''}setSuiviFilters(nf)}} options={suiviFilters.responsable?structureFilterOptions.filter(s=>{const u=users.find(x=>x.username===suiviFilters.responsable);return !u||s.value===u.structure}):structureFilterOptions} placeholder="Toutes" size="sm"/></div>
            <div className="w-36"><SearchableSelect label="Responsable" value={suiviFilters.responsable} onChange={v=>{const nf={...suiviFilters,responsable:v};if(v){const u=users.find(x=>x.username===v);if(u&&u.structure)nf.structure=u.structure}setSuiviFilters(nf)}} options={suiviFilters.structure?responsableFilterOptions.filter(o=>{const u=users.find(x=>x.username===o.value);return u&&u.structure===suiviFilters.structure}):responsableFilterOptions} placeholder="Tous" size="sm"/></div>
            <div className="w-36"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niveau avancement</label><select value={suiviFilters.niveauAvancement} onChange={e => setSuiviFilters({...suiviFilters, niveauAvancement: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs">{niveauAvancementOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="w-24"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niv. retard</label><select value={suiviFilters.niveauRetard} onChange={e => setSuiviFilters({...suiviFilters, niveauRetard: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs">{niveauRetardOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="w-[115px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Date début ≥</label><input type="date" value={suiviFilters.dateDebut} onChange={e => setSuiviFilters({...suiviFilters, dateDebut: e.target.value})} className="w-full px-1.5 py-1.5 rounded border text-xs"/></div>
            <div className="w-[115px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Date fin ≤</label><input type="date" value={suiviFilters.dateFin} onChange={e => setSuiviFilters({...suiviFilters, dateFin: e.target.value})} className="w-full px-1.5 py-1.5 rounded border text-xs"/></div>
          </div>
          {/* Seconde ligne - Recherche + Reset + Export */}
          <div className="flex gap-2 items-end">
            <div className="flex-1"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="Rechercher une action..." value={suiviFilters.search} onChange={e => setSuiviFilters({...suiviFilters, search: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
            <button onClick={() => setSuiviFilters({ projet: '', structure: '', responsable: '', dateDebut: '', dateFin: '', search: '', niveauAvancement: '', niveauRetard: '' })} className="p-1.5 hover:bg-gray-100 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
            <Button size="sm" variant="secondary" onClick={exportSuiviActionsToExcel}><Download size={14} className="mr-1"/>Excel</Button>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto" style={{maxHeight:'550px'}}>
            <table className="w-full text-[10px]" style={{minWidth:'1150px'}}>
              <thead className="sticky top-0 bg-gradient-to-r from-[#1a365d] to-[#2c5282] z-20"><tr><th className="px-2 py-2 text-left text-white sticky left-0 bg-[#1a365d] z-30 min-w-[180px]">Action</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Tx%</th><th className="px-2 py-2 text-center text-white">Niveau av.</th><th className="px-2 py-2 text-center text-white">Jr ret.</th><th className="px-2 py-2 text-center text-white">Niv. ret.</th><th className="px-2 py-2 text-center text-white min-w-[90px]">Conf. Gest.</th><th className="px-2 py-2 text-left text-white">Resp.</th><th className="px-2 py-2 text-center text-white sticky right-0 bg-[#1a365d] z-30 min-w-[100px]">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">Chargement...</td></tr> : filtered.length === 0 ? <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">Aucune occurrence</td></tr> : filtered.map((o, i) => {
                  const action = actions.find(a => a.code_action === o.code_action)
                  const txAvancement = getTxAvancementForOccurrence(o)
                  const calc = calculateOccurrenceFields({...o, tx_avancement: txAvancement})
                  const hasTaches = hasOccurrenceTaches(o)
                  const occId = o.code_occurrence || o.id
                  const occTaches = taches.filter(t => t.code_occurrence === occId)
                  const bgColor = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  const canEditOcc = canEditOccurrence(o)
                  const isResp = isResponsableOccurrence(o)
                  // La confirmation n'est valide que si tx >= 100% ET gestionnaire_conf = 'Oui'
                  const confEffective = txAvancement >= 100 && o.gestionnaire_conf === 'Oui'
                  
                  return (
                    <tr key={o.id} className={`hover:bg-blue-50/50 ${bgColor}`}>
                      <td className={`px-2 py-1.5 sticky left-0 z-10 ${bgColor} border-r max-w-[180px] truncate`} title={action?.libelle_action}>{action?.libelle_action || '-'}</td>
                      <td className="px-2 py-1.5 text-center">{o.date_debut ? new Date(o.date_debut).toLocaleDateString('fr-FR') : '-'}</td>
                      <td className="px-2 py-1.5 text-center">{o.date_fin ? new Date(o.date_fin).toLocaleDateString('fr-FR') : '-'}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] font-bold ${txAvancement >= 100 ? 'bg-green-100 text-green-800' : txAvancement > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{txAvancement}%</span>{hasTaches && <span className="ml-0.5 text-[8px] text-gray-400">(calc)</span>}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauAvancement === 'Achevée' ? 'bg-green-100 text-green-700' : calc.niveauAvancement.includes('Terminée') ? 'bg-blue-100 text-blue-700' : calc.niveauAvancement.includes('+50') ? 'bg-yellow-100 text-yellow-700' : calc.niveauAvancement.includes('-50') ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{calc.niveauAvancement}</span></td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] font-medium ${calc.jourRetard > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.jourRetard}j</span></td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauRetard === 'Retard' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.niveauRetard}</span></td>
                      <td className="px-2 py-1.5 text-center">
                        {txAvancement < 100 ? (
                          <span className="text-gray-300 text-[9px]">- (tx&lt;100%)</span>
                        ) : confEffective ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Oui</span>
                            {canEditOcc && <button onClick={() => handleToggleGestionnaireConf(o, false)} className="p-0.5 hover:bg-red-100 rounded" title="Annuler confirmation"><XCircle size={12} className="text-red-500"/></button>}
                          </div>
                        ) : canEditOcc ? (
                          <button onClick={() => handleToggleGestionnaireConf(o, true)} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] hover:bg-blue-600 flex items-center gap-0.5 mx-auto"><CheckCircle size={10}/>Confirmer</button>
                        ) : (
                          <span className="text-gray-400 text-[9px]">Non confirmé</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 truncate max-w-[80px]">{o.responsable || '-'}</td>
                      <td className={`px-2 py-1.5 sticky right-0 z-10 ${bgColor} border-l`}>
                        <div className="flex items-center justify-center gap-0.5">
                          {(canEditOcc || isResp) && <button onClick={() => { setSelectedOccurrence(o); setSelectedAction(action); setOccurrenceForm({...o, tx_avancement: hasTaches ? undefined : o.tx_avancement}); setShowOccurrenceEditModal(true) }} className="p-0.5 hover:bg-blue-100 rounded" title={isResp && !canEditOcc ? "Modifier Tx uniquement" : "Modifier"}><Edit size={12} className="text-blue-600"/></button>}
                          {canEditOcc && <button onClick={() => handleOpenTacheForm(o, false)} className="p-0.5 hover:bg-green-100 rounded" title="Ajouter tâche"><Plus size={12} className="text-green-600"/></button>}
                          <button onClick={() => { setSelectedOccurrence(o); setShowTachesListModal(true) }} className="p-0.5 hover:bg-purple-100 rounded" title={`Tâches (${occTaches.length})`}><ListChecks size={12} className="text-purple-600"/></button>
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
            {selectedTache && !canEditTache(selectedTache) && isResponsableTache(selectedTache) && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                En tant que responsable, vous pouvez uniquement modifier le taux d'avancement.
              </div>
            )}
            <div><label className="block text-sm font-medium mb-1">Libellé *</label><input type="text" value={tacheForm.libelle_tache || ''} onChange={e => setTacheForm({...tacheForm, libelle_tache: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedTache && !canEditTache(selectedTache)}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Date début *</label><input type="date" value={tacheForm.date_debut || ''} onChange={e => setTacheForm({...tacheForm, date_debut: e.target.value})} min={selectedOccurrence?.date_debut} max={selectedOccurrence?.date_fin} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedTache && !canEditTache(selectedTache)}/></div>
              <div><label className="block text-sm font-medium mb-1">Date fin *</label><input type="date" value={tacheForm.date_fin || ''} onChange={e => setTacheForm({...tacheForm, date_fin: e.target.value})} min={selectedOccurrence?.date_debut} max={selectedOccurrence?.date_fin} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedTache && !canEditTache(selectedTache)}/></div>
            </div>
            <SearchableSelect label="Responsable *" value={tacheForm.responsable} onChange={v => setTacheForm({...tacheForm, responsable: v})} options={userOptions} placeholder="Sélectionner..." disabled={selectedTache && !canEditTache(selectedTache)}/>
            <div><label className="block text-sm font-medium mb-1">Taux d'avancement (%)</label><input type="number" min="0" max="100" value={tacheForm.tx_avancement || 0} onChange={e => setTacheForm({...tacheForm, tx_avancement: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedTache && !canEditTxTache(selectedTache)}/></div>
            <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={tacheForm.commentaire || ''} onChange={e => setTacheForm({...tacheForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={selectedTache && !canEditTache(selectedTache)}/></div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowTacheModal(false)}>Fermer</Button>
              {(!selectedTache || canEditTache(selectedTache) || canEditTxTache(selectedTache)) && <Button onClick={handleSaveTache}>Enregistrer</Button>}
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
                              {(canEditT || isRespT) && <button onClick={() => handleEditTache(t)} className="p-1 hover:bg-blue-100 rounded" title={isRespT && !canEditT ? "Modifier Tx uniquement" : "Modifier"}><Edit size={12} className="text-blue-600"/></button>}
                              {canEditT && <button onClick={() => handleDeleteTache(t)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
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
              {canEditOccurrence(selectedOccurrence) && <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenTacheForm(selectedOccurrence, true)}>Ajouter tâche</Button>}
              <Button variant="secondary" onClick={() => setShowTachesListModal(false)}>Fermer</Button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  const renderContent = () => { switch(activeTab) { case 'projets': return renderProjets(); case 'actions': return renderActions(); case 'suivi': return renderSuivi(); default: return null } }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      <div className="w-56 bg-white border-r border-gray-100 p-3 space-y-1 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto">
        {subPages.map(p => <SidebarButton key={p.key} icon={p.icon} label={p.label} active={activeTab === p.key} onClick={() => setActiveTab(p.key)}/>)}
      </div>
      <div className="flex-1 p-4 overflow-auto bg-gray-50">{renderContent()}</div>
      
      {/* Modal global pour créer/modifier une occurrence - accessible depuis tous les onglets */}
      <Modal isOpen={showOccurrenceEditModal} onClose={() => setShowOccurrenceEditModal(false)} title={selectedOccurrence ? "Modifier l'occurrence" : 'Nouvelle occurrence'} size="md" closeOnClickOutside={false}>
        <div className="space-y-4">
          {selectedAction && <div className="p-3 bg-blue-50 rounded-lg text-xs"><strong>Action:</strong> {selectedAction.libelle_action}</div>}
          {selectedOccurrence && !canEditOccurrence(selectedOccurrence) && isResponsableOccurrence(selectedOccurrence) && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              En tant que responsable, vous pouvez uniquement modifier le taux d'avancement.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Date début *</label><input type="date" value={occurrenceForm.date_debut || ''} onChange={e => setOccurrenceForm({...occurrenceForm, date_debut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedOccurrence && !canEditOccurrence(selectedOccurrence)}/></div>
            <div><label className="block text-sm font-medium mb-1">Date fin *</label><input type="date" value={occurrenceForm.date_fin || ''} onChange={e => setOccurrenceForm({...occurrenceForm, date_fin: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedOccurrence && !canEditOccurrence(selectedOccurrence)}/></div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Taux d'avancement (%)</label>
            {hasOccurrenceTaches(selectedOccurrence) ? (
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">{getTxAvancementForOccurrence(selectedOccurrence)}% (calculé depuis les tâches)</div>
            ) : (
              <input type="number" min="0" max="100" value={occurrenceForm.tx_avancement || 0} onChange={e => setOccurrenceForm({...occurrenceForm, tx_avancement: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={selectedOccurrence && !canEditTxAvancement(selectedOccurrence)}/>
            )}
          </div>
          <SearchableSelect label="Responsable *" value={occurrenceForm.responsable} onChange={v => setOccurrenceForm({...occurrenceForm, responsable: v})} options={occurrenceResponsableOptions} placeholder="Sélectionner..." disabled={selectedOccurrence && !canEditOccurrence(selectedOccurrence)}/>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowOccurrenceEditModal(false)}>Fermer</Button>
            {(!selectedOccurrence || canEditOccurrence(selectedOccurrence) || canEditTxAvancement(selectedOccurrence)) && <Button onClick={handleSaveOccurrence}>Enregistrer</Button>}
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
        onConfirm={() => { confirmAction?.onConfirm?.(); setConfirmAction(null) }}
        showCancel={true}
      />
      
      {/* Modal des éléments archivés */}
      <Modal isOpen={showArchives} onClose={() => setShowArchives(false)} title={`Éléments archivés - ${archiveType === 'projet' ? 'Projets' : archiveType === 'action' ? 'Actions' : 'Suivi actions'}`} size="xl" closeOnClickOutside={false}>
        <div className="space-y-4">
          {archivedItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Aucun élément archivé</div>
          ) : (
            <div className="overflow-x-auto border rounded-lg" style={{maxHeight: '400px'}}>
              <table className="w-full text-[10px]">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">Code</th>
                    <th className="px-2 py-2 text-left">Libellé</th>
                    <th className="px-2 py-2 text-left">Date archive</th>
                    <th className="px-2 py-2 text-left">Archivé par</th>
                    <th className="px-2 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {archivedItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-mono text-blue-600">{item.code_groupe || item.code_action || item.code_occurrence || '-'}</td>
                      <td className="px-2 py-1.5">{item.libelle_groupe || item.libelle_action || `Occurrence ${item.code_occurrence}` || '-'}</td>
                      <td className="px-2 py-1.5 text-gray-500">{item.date_archive ? new Date(item.date_archive).toLocaleDateString('fr-FR') : '-'}</td>
                      <td className="px-2 py-1.5 text-gray-500">{item.archive_par || '-'}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => handleUnarchive(archiveType, item.id)} className="p-1 hover:bg-green-100 rounded" title="Désarchiver">
                          <ArchiveRestore size={14} className="text-green-600"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowArchives(false)}>Fermer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
