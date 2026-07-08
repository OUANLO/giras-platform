'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Users, Bell, Plus, Edit, Trash2, KeyRound, Lock, Mail, Send, RefreshCw, CheckCircle, AlertTriangle, User, Copy, X, BarChart2 } from 'lucide-react'
import { Button, Modal, FormInput, FilterBar, DataTable, StatusBadge, SidebarButton, AlertModal, SearchableSelect } from '@/components/ui'
import { canAccessAdministration as hasAdministrationAccess, canAccessAdminSection, canEditAdminSection } from '@/lib/roles'

const PENDING_VALIDATION_SETTINGS_STORAGE_KEY = 'giras_pending_validation_settings'

const readCachedPendingValidationSettings = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PENDING_VALIDATION_SETTINGS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      actionValidationDelayDays: parsed?.actionValidationDelayDays ?? '',
      indicatorValidationDelayDays: parsed?.indicatorValidationDelayDays ?? ''
    }
  } catch {
    return null
  }
}

const writeCachedPendingValidationSettings = (settings) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PENDING_VALIDATION_SETTINGS_STORAGE_KEY, JSON.stringify({
      actionValidationDelayDays: settings?.actionValidationDelayDays ?? '',
      indicatorValidationDelayDays: settings?.indicatorValidationDelayDays ?? ''
    }))
  } catch {}
}

export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('structures')
  const [structures, setStructures] = useState([])
  const [users, setUsers] = useState([])
  const [flashMessages, setFlashMessages] = useState([])
  const [flashFilters, setFlashFilters] = useState({ statut: '', search: '' })
  const [structureFilters, setStructureFilters] = useState({ search: '' })
  const [userFilters, setUserFilters] = useState({ structure: '', search: '' })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState(null)
  const [formData, setFormData] = useState({})
  const [selectedItem, setSelectedItem] = useState(null)
  const [user, setUser] = useState(null)
  const [resetLoading, setResetLoading] = useState(false)
  
  // États pour AlertModal unifié
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [confirmAction, setConfirmAction] = useState(null)
  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => { if (alertModal.onConfirm) alertModal.onConfirm(); setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null }) }

  const renderAdminCell = (value, extraClass = '', titleValue = null) => (
    <span
      className={`block text-[11px] leading-4 text-gray-700 break-words ${extraClass}`.trim()}
      title={titleValue ?? (value || '-')}
      style={{
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical'
      }}
    >
      {value || '-'}
    </span>
  )

  
  // États pour le modal de mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordModalData, setPasswordModalData] = useState(null)
  const [copied, setCopied] = useState(false)
  
  // États pour Emailing - Rappels quotidiens
  const [emailSynthesis, setEmailSynthesis] = useState([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [selectedUsersForEmail, setSelectedUsersForEmail] = useState([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResult, setEmailResult] = useState(null)
  const [emailSubTab, setEmailSubTab] = useState('envoi') // 'envoi' ou 'historique'
  const [emailLogs, setEmailLogs] = useState([])
  const [emailLogsLoading, setEmailLogsLoading] = useState(false)
  const [emailStats, setEmailStats] = useState(null)
  const [emailFilters, setEmailFilters] = useState({ type: '', statut: '', date_debut: '', date_fin: '' })
  
  // États pour Récap Hebdomadaire
  const [selectedUsersForRecap, setSelectedUsersForRecap] = useState([])
  const [sendingRecap, setSendingRecap] = useState(false)
  const [recapResult, setRecapResult] = useState(null)

  // États pour validations / confirmations en attente
  const [pendingValidationSynthesis, setPendingValidationSynthesis] = useState([])
  const [selectedManagersForPendingEmail, setSelectedManagersForPendingEmail] = useState([])
  const [pendingValidationTestEmails, setPendingValidationTestEmails] = useState('')
  const [sendingPendingValidationEmail, setSendingPendingValidationEmail] = useState(false)
  const [pendingValidationEmailResult, setPendingValidationEmailResult] = useState(null)
  const cachedPendingValidationSettings = readCachedPendingValidationSettings()
  const [pendingValidationSettings, setPendingValidationSettings] = useState(cachedPendingValidationSettings || { actionValidationDelayDays: '', indicatorValidationDelayDays: '' })
  const [pendingValidationSettingsLoaded, setPendingValidationSettingsLoaded] = useState(!!cachedPendingValidationSettings)
  const [savingPendingValidationSettings, setSavingPendingValidationSettings] = useState(false)

  const isAdminSectionUser = (candidate) => hasAdministrationAccess(candidate)

  const recapPriorityRoles = new Set(['Super admin', 'Super manager', 'Manager'])
  const emailSynthesisByUsername = new Map((emailSynthesis || []).map((s) => [s.username, s]))
  const structureResponsibles = new Set(
    (structures || [])
      .map((structure) => String(structure?.responsable_structure || '').trim().toLowerCase())
      .filter(Boolean)
  )

  const emailTargetOptions = emailSynthesis.map((s) => ({
    value: s.username,
    label: `${s.prenoms} ${s.nom} (${s.username}) — ${s.actionsNonRealisees} actions, ${s.indicateursNonRenseignes} indicateurs`
  }))

  const recapTargetOptions = [...(users || [])]
    .filter((candidate) => candidate?.statut === 'Actif')
    .filter((candidate) => recapPriorityRoles.has(candidate?.type_utilisateur) || emailSynthesisByUsername.has(candidate?.username) || structureResponsibles.has(String(candidate?.username || '').trim().toLowerCase()) || structureResponsibles.has(String(candidate?.email || '').trim().toLowerCase()))
    .sort((a, b) => {
      const roleCmp = String(a?.type_utilisateur || '').localeCompare(String(b?.type_utilisateur || ''), 'fr')
      if (roleCmp !== 0) return roleCmp
      const nameA = `${a?.prenoms || ''} ${a?.nom || ''}`.trim()
      const nameB = `${b?.prenoms || ''} ${b?.nom || ''}`.trim()
      return nameA.localeCompare(nameB, 'fr')
    })
    .map((candidate) => {
      const synthesis = emailSynthesisByUsername.get(candidate.username)
      const baseLabel = `${candidate.prenoms} ${candidate.nom} (${candidate.username})`
      const suffix = synthesis
        ? `— ${synthesis.actionsNonRealisees || 0} actions, ${synthesis.indicateursNonRenseignes || 0} indicateurs`
        : '— récap selon profil'
      return {
        value: candidate.username,
        label: `${baseLabel} ${suffix}`
      }
    })

  const pendingValidationTargetOptions = (pendingValidationSynthesis || [])
    .filter((candidate) => candidate?.hasItems)
    .sort((a, b) => (`${a?.prenoms || ''} ${a?.nom || ''}`).localeCompare(`${b?.prenoms || ''} ${b?.nom || ''}`, 'fr'))
    .map((candidate) => ({
      value: candidate.username,
      label: `${candidate.prenoms} ${candidate.nom} (${candidate.username}) — ${candidate.actionsPending || 0} actions, ${candidate.indicatorsPending || 0} indicateurs`
    }))

  const subPages = [
    { key: 'structures', label: 'Structures', icon: Layers },
    { key: 'utilisateurs', label: 'Gestion', icon: Users },
    { key: 'flash', label: 'Infos Flash', icon: Bell },
    { key: 'emailing', label: 'Emailing', icon: Mail }
  ]

  // Vérifier si l'utilisateur peut modifier (Admin, Super admin uniquement pour Administration)
  const canEdit = (currentUser = user) => isAdminSectionUser(currentUser)
  const canAccessTab = (tabKey, currentUser = user) => {
    if (tabKey === 'utilisateurs') return isAdminSectionUser(currentUser)
    return canAccessAdminSection(currentUser, tabKey)
  }
  const canEditTab = (tabKey, currentUser = user) => {
    if (tabKey === 'utilisateurs') return isAdminSectionUser(currentUser)
    return canEditAdminSection(currentUser, tabKey)
  }
  const visibleSubPages = subPages.filter((page) => canAccessTab(page.key))

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (!storedUser) {
      router.replace('/login')
      return
    }

    const parsedUser = JSON.parse(storedUser)
    setUser(parsedUser)

    if (!isAdminSectionUser(parsedUser)) {
      router.replace('/dashboard')
      return
    }

    const allowedTabs = subPages
      .filter((page) => page.key === 'utilisateurs' ? isAdminSectionUser(parsedUser) : canAccessAdminSection(parsedUser, page.key))
      .map((page) => page.key)

    if (!allowedTabs.includes(activeTab) && allowedTabs.length > 0) {
      setActiveTab(allowedTabs[0])
      return
    }

    fetchData(activeTab, parsedUser)
  }, [activeTab, router])

  const fetchData = async (tabKey = activeTab, currentUser = user) => {
    setLoading(true)
    try {
      if (!canAccessTab(tabKey, currentUser)) {
        setLoading(false)
        return
      }

      if (tabKey === 'structures') {
        const [structuresRes, usersRes] = await Promise.all([
          fetch('/api/structures'),
          fetch('/api/users?statut=Actif&admin_scope=1')
        ])
        if (structuresRes.ok) {
          const data = await structuresRes.json()
          setStructures(data.structures || [])
        }
        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users || [])
        }
      } else if (tabKey === 'utilisateurs') {
        const [usersRes, structuresRes] = await Promise.all([
          fetch('/api/users?admin_scope=1'),
          fetch('/api/structures?statut=Actif')
        ])
        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users || [])
        }
        if (structuresRes.ok) {
          const data = await structuresRes.json()
          setStructures(data.structures || [])
        }
      } else if (tabKey === 'flash') {
        const res = await fetch('/api/flash?all=true')
        if (res.ok) {
          const data = await res.json()
          setFlashMessages(data.messages || [])
        }
      } else if (tabKey === 'emailing') {
        // Charger les utilisateurs et les synthèses d'emailing
        const [usersRes, synthesisRes, pendingValidationRes] = await Promise.all([
          fetch('/api/users?statut=Actif'),
          fetch('/api/emailing'),
          fetch('/api/emailing/pending-validations')
        ])
        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users || [])
        }
        if (synthesisRes.ok) {
          const data = await synthesisRes.json()
          setEmailSynthesis(data.synthesis || [])
        }
        if (pendingValidationRes.ok) {
          const data = await pendingValidationRes.json()
          setPendingValidationSynthesis(data.synthesis || [])
          if (data.settings) {
            const normalizedSettings = {
              actionValidationDelayDays: data.settings.actionValidationDelayDays ?? '',
              indicatorValidationDelayDays: data.settings.indicatorValidationDelayDays ?? ''
            }
            setPendingValidationSettings(normalizedSettings)
            writeCachedPendingValidationSettings(normalizedSettings)
          }
          setPendingValidationSettingsLoaded(true)
        } else {
          setPendingValidationSettingsLoaded(true)
        }
        // Charger les logs et stats
        await fetchEmailLogs()
        await fetchEmailStats()
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // Colonnes pour le tableau des messages flash
  const flashColumns = [
    { key: 'info', label: 'Message', render: (v) => <span className="text-sm line-clamp-2">{v}</span> },
    { key: 'date_debut', label: 'Date début', width: '110px', render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '-' },
    { key: 'date_fin', label: 'Date fin', width: '110px', render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '-' },
    { key: 'createur', label: 'Créateur', width: '140px', render: (v) => <span className="text-xs text-gray-500">{v || '-'}</span> },
    { key: 'statut', label: 'Statut', width: '100px', render: (v) => <StatusBadge status={v} /> }
  ]

  // Filtrer les messages flash
  const filteredFlashMessages = flashMessages.filter(m => {
    if (flashFilters.statut && m.statut !== flashFilters.statut) return false
    if (flashFilters.search && !m.info?.toLowerCase().includes(flashFilters.search.toLowerCase())) return false
    return true
  })

  const getDefaultUserFormData = () => ({
    username: '',
    nom: '',
    prenoms: '',
    structure: '',
    superieur: '',
    superieur_existe: 'Non',
    poste: '',
    type_utilisateur: 'User',
    statut: 'Actif',
    acces_risque: 'Non',
    acces_activite: 'Non',
    acces_indicateur: 'Non',
    acces_tb: 'Non',
    acces_perform: 'Non',
    acces_admin: 'Non',
    peut_creer_projets: 'Non',
    peut_creer_groupes_indicateurs: 'Non',
    admin_structures_droit: 'none',
    admin_flash_droit: 'none',
    admin_emailing_acces: 'Non'
  })

  const handleCreate = (type) => {
    setSelectedItem(null)
    setFormData(type === 'user' ? getDefaultUserFormData() : {})
    setModalType(type)
    setShowModal(true)
  }

  const handleEdit = (item, type) => {
    setSelectedItem(item)
    setFormData(item)
    setModalType(type)
    setShowModal(true)
  }

  const handleDelete = async (item, endpoint) => {
    setConfirmAction({
      message: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/${endpoint}?id=${item.id}`, { method: 'DELETE' })
          if (res.ok) {
            fetchData()
            showAlert('success', 'Élément supprimé avec succès')
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de la suppression')
        }
      }
    })
  }

  const handleResetPassword = async (targetUser) => {
    // Vérifier si c'est le Super Admin et que l'utilisateur courant n'est pas Super Admin
    if (targetUser.type_utilisateur === 'Super admin' && user?.type_utilisateur !== 'Super admin') {
      showAlert('error', 'Vous ne pouvez pas réinitialiser le mot de passe du Super Admin')
      return
    }

    setConfirmAction({
      message: `Êtes-vous sûr de vouloir réinitialiser le mot de passe de ${targetUser.prenoms} ${targetUser.nom} ?\n\nUn nouveau mot de passe sera généré.`,
      onConfirm: async () => {
        setResetLoading(true)
        try {
          const res = await fetch('/api/users/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: targetUser.id,
              adminUsername: user?.username
            })
          })

          const data = await res.json()

          if (res.ok) {
            setPasswordModalData({
              type: 'reset',
              username: targetUser.username,
              nom: `${targetUser.prenoms} ${targetUser.nom}`,
              password: data.tempPassword || '(envoyé par email)',
              emailSent: data.emailSent,
              emailError: data.emailError
            })
            setShowPasswordModal(true)
            setCopied(false)
          } else {
            showAlert('error', data.error || 'Erreur lors de la réinitialisation')
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de la réinitialisation du mot de passe')
        } finally {
          setResetLoading(false)
        }
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (modalType === 'user' && selectedItem?.type_utilisateur === 'Super admin' && user?.type_utilisateur !== 'Super admin') {
      showAlert('warning', "Seul un super admin peut modifier les informations d'un super admin.")
      return
    }
    try {
      const endpoints = { structure: 'structures', user: 'users', flash: 'flash' }
      const method = selectedItem ? 'PUT' : 'POST'
      const body = { ...formData, responsable_structure: formData.responsable_structure || null, superieur: formData.superieur || null, superieur_existe: formData.superieur ? 'Oui' : 'Non', id: selectedItem?.id, createur: user?.username, modificateur: user?.username }

      if (modalType === 'user') {
        body.peut_creer_projets = body.type_utilisateur === 'Super admin' ? 'Oui' : (body.peut_creer_projets || 'Non')
        body.peut_creer_groupes_indicateurs = body.type_utilisateur === 'Super admin' ? 'Oui' : (body.peut_creer_groupes_indicateurs || 'Non')

        if (body.type_utilisateur === 'Admin' && body.acces_admin === 'Oui') {
          body.admin_structures_droit = body.admin_structures_droit || 'read'
          body.admin_flash_droit = body.admin_flash_droit || 'read'
          body.admin_emailing_acces = body.admin_emailing_acces || 'Non'
        } else if (body.type_utilisateur === 'Super admin') {
          body.admin_structures_droit = 'edit'
          body.admin_flash_droit = 'edit'
          body.admin_emailing_acces = 'Oui'
        } else {
          body.admin_structures_droit = 'none'
          body.admin_flash_droit = 'none'
          body.admin_emailing_acces = 'Non'
        }
      }

      const res = await fetch(`/api/${endpoints[modalType]}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (res.ok) {
        setShowModal(false)
        fetchData()

        if (modalType === 'user' && selectedItem?.id === user?.id && data?.user) {
          const updatedUser = { ...user, ...data.user }
          setUser(updatedUser)
          localStorage.setItem('giras_user', JSON.stringify(updatedUser))
        }

        if (modalType === 'user' && !selectedItem) {
          // Création d'utilisateur - afficher le modal avec le mot de passe
          setPasswordModalData({
            type: 'create',
            username: formData.username,
            nom: `${formData.prenoms} ${formData.nom}`,
            password: data.tempPassword || formData.password || '(généré automatiquement)',
            emailSent: data.emailSent,
            emailError: data.emailError
          })
          setShowPasswordModal(true)
          setCopied(false)
        }
      } else {
        showAlert('error', data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const structureColumns = [
    { key: 'code_structure', label: 'Code', width: '100px', render: (v) => renderAdminCell(v, 'font-medium text-gray-800') },
    { key: 'libelle_structure', label: 'Libellé', width: '420px', render: (v) => <span className="block text-[11px] leading-4 text-gray-700 font-medium truncate whitespace-nowrap" title={v || '-'}>{v || '-'}</span> },
    { key: 'responsable_structure', label: 'Responsable', width: '240px', render: (v) => renderAdminCell(v ? getUserDisplayName(v) : '-', 'font-medium text-gray-800', v ? getUserDisplayName(v) : '-') },
    { key: 'statut', label: 'Statut', width: '100px', render: (v) => <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${v === 'Actif' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{v || '-'}</span> }
  ]

  const getStructureLabel = (code) => {
    const s = structures.find(item => item.code_structure === code)
    return s ? `${s.code_structure} - ${s.libelle_structure}` : code || '-'
  }

  const getUserDisplayName = (username) => {
    const target = users.find(item => item.username === username)
    if (!target) return username || '-'
    return `${target.nom} ${target.prenoms} (${target.username})`
  }

  const getStructureResponsableOptions = () => {
    const structureCode = selectedItem?.code_structure || formData.code_structure || formData.structure
    if (!structureCode) return []
    return (users || [])
      .filter(u => u.statut === 'Actif' && u.structure === structureCode && ['Manager', 'Super manager', 'Admin', 'Super admin'].includes(u.type_utilisateur))
      .map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms} (${u.username})` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  }

  const getSuperieurOptions = () => {
    const selectedStructure = formData.structure
    const currentUsername = selectedItem?.username || formData.username

    return (users || [])
      .filter(u =>
        u.statut === 'Actif' &&
        !!selectedStructure &&
        u.structure === selectedStructure &&
        u.username !== currentUsername &&
        ['Manager', 'Super manager', 'Admin', 'Super admin'].includes(u.type_utilisateur)
      )
      .map(u => ({
        value: u.username,
        label: `${u.nom} ${u.prenoms} (${u.username})`
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  }

  const userColumns = [
    { key: 'username', label: 'Email', width: '220px', render: (v) => renderAdminCell(v, 'font-medium text-gray-800') },
    { key: 'nom', label: 'Nom', width: '130px', render: (v) => renderAdminCell(v, 'font-medium text-gray-800') },
    { key: 'prenoms', label: 'Prénoms', width: '180px', render: (v) => renderAdminCell(v, 'font-medium text-gray-800') },
    { key: 'structure', label: 'Structure', width: '120px', render: (v) => renderAdminCell(v, 'font-medium text-gray-800 font-mono') },
    { key: 'superieur', label: 'Supérieur', width: '220px', render: (v) => renderAdminCell(v ? getUserDisplayName(v) : '-', 'font-medium text-gray-800', v ? getUserDisplayName(v) : '-') },
    { key: 'type_utilisateur', label: 'Type', width: '120px', render: (v) => renderAdminCell(v, 'font-medium text-gray-800') },
    { key: 'statut', label: 'Statut', width: '100px', render: (v) => <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${v === 'Actif' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{v || '-'}</span> }
  ]


  const filteredStructures = structures.filter((item) => {
    const search = String(structureFilters.search || '').trim().toLowerCase()
    if (!search) return true
    return (
      item.code_structure?.toLowerCase().includes(search) ||
      item.libelle_structure?.toLowerCase().includes(search)
    )
  })

  const filteredUsers = users.filter((item) => {
    if (user?.type_utilisateur === 'Admin' && item?.createur !== user?.username) return false
    if (userFilters.structure && item.structure !== userFilters.structure) return false
    const search = String(userFilters.search || '').trim().toLowerCase()
    if (!search) return true
    return (
      item.username?.toLowerCase().includes(search) ||
      item.nom?.toLowerCase().includes(search) ||
      item.prenoms?.toLowerCase().includes(search)
    )
  })

  // Déterminer si l'utilisateur peut réinitialiser le mot de passe d'un autre utilisateur
  const canResetPassword = (targetUser) => {
    if (!user) return false
    if (user.type_utilisateur === 'Super admin') return true
    if (user.type_utilisateur === 'Admin') {
      return targetUser.type_utilisateur !== 'Super admin' && targetUser.type_utilisateur !== 'Super manager'
    }
    return false
  }

  const isActorSuperAdmin = user?.type_utilisateur === 'Super admin'
  const isActorAdmin = user?.type_utilisateur === 'Admin'
  const selectedUserIsLockedAsLead = !!selectedItem && ((structures || []).some((s) => String(s?.responsable_structure || '').trim().toLowerCase() === String(selectedItem?.username || '').trim().toLowerCase()) || (users || []).some((u) => String(u?.superieur || '').trim().toLowerCase() === String(selectedItem?.username || '').trim().toLowerCase()))
  const userTypeOptions = isActorSuperAdmin
    ? [
        { value: 'Admin', label: 'Admin' },
        { value: 'Super admin', label: 'Super Admin' },
        { value: 'Super manager', label: 'Super Manager' },
        { value: 'Manager', label: 'Manager' },
        { value: 'User', label: 'User' }
      ]
    : [
        { value: 'Admin', label: 'Admin' },
        { value: 'Manager', label: 'Manager' },
        { value: 'User', label: 'User' }
      ]


  // Fonctions Emailing
  const refreshEmailSynthesis = async () => {
    setEmailLoading(true)
    try {
      const res = await fetch('/api/emailing')
      if (res.ok) {
        const data = await res.json()
        setEmailSynthesis(data.synthesis || [])
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setEmailLoading(false)
    }
  }

  // Fonctions pour les logs d'emails
  const fetchEmailLogs = async () => {
    setEmailLogsLoading(true)
    try {
      const params = new URLSearchParams()
      if (emailFilters.type) params.append('type', emailFilters.type)
      if (emailFilters.statut) params.append('statut', emailFilters.statut)
      if (emailFilters.date_debut) params.append('date_debut', emailFilters.date_debut)
      if (emailFilters.date_fin) params.append('date_fin', emailFilters.date_fin)
      params.append('limit', '100')
      
      const res = await fetch(`/api/email-logs?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEmailLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Erreur chargement logs:', error)
    } finally {
      setEmailLogsLoading(false)
    }
  }

  const fetchEmailStats = async () => {
    try {
      const res = await fetch('/api/email-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats' })
      })
      if (res.ok) {
        const data = await res.json()
        setEmailStats(data.stats || null)
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    }
  }


  const sendEmailToUsers = async (usernames) => {
    const targets = Array.isArray(usernames) ? usernames.filter(Boolean) : [usernames].filter(Boolean)
    if (!targets.length) {
      showAlert('warning', 'Veuillez sélectionner au moins un utilisateur')
      return
    }

    const multi = targets.length > 1
    setConfirmAction({
      message: multi
        ? `Envoyer un email de rappel à ${targets.length} utilisateur(s) sélectionné(s) ?`
        : `Envoyer un email de rappel à ${targets[0]} ?`,
      onConfirm: async () => {
        setSendingEmail(true)
        setEmailResult(null)
        try {
          const payload = targets.length === 1
            ? { targetUser: targets[0], createur: user?.username }
            : { targetUsers: targets, createur: user?.username }

          const res = await fetch('/api/emailing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          const data = await res.json()

          if (res.ok) {
            setEmailResult({
              success: true,
              message: data.message,
              summary: data.summary,
              details: data.details
            })
            showAlert('success', multi ? `${data.summary?.sent || 0} email(s) envoyé(s) avec succès` : `Email envoyé avec succès à ${targets[0]}`)
            await fetchEmailLogs()
            await fetchEmailStats()
          } else {
            setEmailResult({ success: false, message: data.error })
            showAlert('error', data.error || "Erreur lors de l'envoi")
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', "Erreur lors de l'envoi de l'email")
        } finally {
          setSendingEmail(false)
        }
      }
    })
  }

  const sendEmailToUser = async (username) => {
    await sendEmailToUsers(username ? [username] : [])
  }

  const sendEmailToAll = async () => {
    const usersWithItems = emailSynthesis.filter(s => s.hasItems)
    if (usersWithItems.length === 0) {
      showAlert('info', "Aucun utilisateur n'a d'éléments en attente")
      return
    }

    setConfirmAction({
      message: `Envoyer un email de rappel à ${usersWithItems.length} utilisateur(s) ayant des éléments en attente ?`,
      onConfirm: async () => {
        setSendingEmail(true)
        setEmailResult(null)
        try {
          const res = await fetch('/api/emailing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sendToAll: true, createur: user?.username })
          })

          const data = await res.json()

          if (res.ok) {
            setEmailResult({
              success: true,
              message: data.message,
              summary: data.summary,
              details: data.details
            })
            showAlert('success', `${data.summary?.sent || 0} email(s) envoyé(s) avec succès`)
            await fetchEmailLogs()
            await fetchEmailStats()
          } else {
            setEmailResult({ success: false, message: data.error })
            showAlert('error', data.error || "Erreur lors de l'envoi")
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', "Erreur lors de l'envoi des emails")
        } finally {
          setSendingEmail(false)
        }
      }
    })
  }

  const sendEmailToSelected = async () => {
    if (!selectedUsersForEmail.length) {
      showAlert('warning', 'Veuillez sélectionner au moins un utilisateur')
      return
    }
    await sendEmailToUsers(selectedUsersForEmail)
  }

  // Fonctions pour le récap hebdomadaire

  const sendRecapToUsers = async (usernames) => {
    const targets = Array.isArray(usernames) ? usernames.filter(Boolean) : [usernames].filter(Boolean)
    if (!targets.length) {
      showAlert('warning', 'Veuillez sélectionner au moins un utilisateur')
      return
    }

    setSendingRecap(true)
    setRecapResult(null)
    try {
      const payload = targets.length === 1
        ? { targetUser: targets[0], createur: user?.username }
        : { targetUsers: targets, createur: user?.username }

      const res = await fetch('/api/cron/weekly-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setRecapResult({
          success: true,
          message: targets.length === 1 ? `Traitement terminé pour ${targets[0]}` : `${data.summary?.emails_sent || 0} récap(s) envoyé(s)`,
          summary: {
            total: data.summary?.total_users || targets.length,
            sent: data.summary?.emails_sent || 0,
            skipped: data.summary?.users_skipped || 0,
            failed: data.summary?.emails_failed || 0
          },
          results: data.results || []
        })
        showAlert('success', targets.length === 1 ? `Récap hebdomadaire envoyé à ${targets[0]}` : `${data.summary?.emails_sent || 0} récap(s) hebdomadaire(s) envoyé(s)`)
        await fetchEmailLogs()
        await fetchEmailStats()
      } else {
        setRecapResult({ success: false, message: data.error || "Erreur lors de l'envoi" })
        showAlert('error', data.error || "Erreur lors de l'envoi")
      }
    } catch (error) {
      console.error('Erreur:', error)
      showAlert('error', "Erreur lors de l'envoi du récap")
    } finally {
      setSendingRecap(false)
    }
  }

  const sendRecapToUser = async (username) => {
    await sendRecapToUsers(username ? [username] : [])
  }

  const sendRecapToAll = async () => {
    setConfirmAction({
      message: `Envoyer le récap hebdomadaire des performances à ${recapTargetOptions.length} utilisateur(s) ?`,
      onConfirm: async () => {
        setSendingRecap(true)
        setRecapResult(null)
        try {
          const res = await fetch('/api/cron/weekly-recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sendToAll: true, createur: user?.username })
          })

          const data = await res.json()

          if (res.ok && data.success) {
            setRecapResult({
              success: true,
              message: `${data.summary?.emails_sent || 0} récap(s) envoyé(s)`,
              summary: {
                total: data.summary?.total_users || 0,
                sent: data.summary?.emails_sent || 0,
                skipped: data.summary?.users_skipped || 0,
                failed: data.summary?.emails_failed || 0
              },
              results: data.results || []
            })
            showAlert('success', `${data.summary?.emails_sent || 0} récap(s) hebdomadaire(s) envoyé(s)`)
            await fetchEmailLogs()
            await fetchEmailStats()
          } else {
            setRecapResult({ success: false, message: data.error || "Erreur lors de l'envoi" })
            showAlert('error', data.error || "Erreur lors de l'envoi")
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', "Erreur lors de l'envoi des récaps")
        } finally {
          setSendingRecap(false)
        }
      }
    })
  }


  const sendRecapToSelected = async () => {
    if (!selectedUsersForRecap.length) {
      showAlert('warning', 'Veuillez sélectionner au moins un utilisateur')
      return
    }
    await sendRecapToUsers(selectedUsersForRecap)
  }

  const saveValidationReminderSettings = async () => {
    setSavingPendingValidationSettings(true)
    try {
      const res = await fetch('/api/admin/pending-validation-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingValidationSettings)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'enregistrement")
      const normalizedSettings = data.settings || pendingValidationSettings
      setPendingValidationSettings(normalizedSettings)
      writeCachedPendingValidationSettings(normalizedSettings)
      setPendingValidationSettingsLoaded(true)
      showAlert('success', 'Paramètres de relance des validations enregistrés avec succès')
    } catch (error) {
      console.error(error)
      showAlert('error', error.message || "Erreur lors de l'enregistrement")
    } finally {
      setSavingPendingValidationSettings(false)
    }
  }

  const sendPendingValidationEmails = async (usernames) => {
    const targets = Array.isArray(usernames) ? usernames.filter(Boolean) : [usernames].filter(Boolean)
    if (!targets.length) {
      showAlert('warning', 'Veuillez sélectionner au moins un gestionnaire')
      return
    }
    setSendingPendingValidationEmail(true)
    setPendingValidationEmailResult(null)
    try {
      const payload = targets.length === 1 ? { targetUser: targets[0], createur: user?.username } : { targetUsers: targets, createur: user?.username }
      const res = await fetch('/api/emailing/pending-validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi")
      setPendingValidationEmailResult({ success: true, summary: data.summary, results: data.results, message: data.message })
      showAlert('success', `${data.summary?.sent || 0} email(s) envoyé(s)`) 
      const refreshRes = await fetch('/api/emailing/pending-validations', { cache: 'no-store' })
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()
        setPendingValidationSynthesis(refreshData.synthesis || [])
        if (refreshData.settings) setPendingValidationSettings(refreshData.settings)
      }
      await fetchEmailLogs()
      await fetchEmailStats()
    } catch (error) {
      console.error(error)
      setPendingValidationEmailResult({ success: false, message: error.message || "Erreur lors de l'envoi" })
      showAlert('error', error.message || "Erreur lors de l'envoi")
    } finally {
      setSendingPendingValidationEmail(false)
    }
  }

  const sendPendingValidationEmailsToAll = async () => {
    setConfirmAction({
      message: `Envoyer le mail de validations en attente à ${pendingValidationSynthesis.length} gestionnaire(s) ?`,
      onConfirm: async () => {
        setSendingPendingValidationEmail(true)
        setPendingValidationEmailResult(null)
        try {
          const res = await fetch('/api/emailing/pending-validations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sendToAll: true, createur: user?.username })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi")
          setPendingValidationEmailResult({ success: true, summary: data.summary, results: data.results, message: data.message })
          showAlert('success', `${data.summary?.sent || 0} email(s) envoyé(s)`) 
          await fetchEmailLogs()
          await fetchEmailStats()
        } catch (error) {
          console.error(error)
          setPendingValidationEmailResult({ success: false, message: error.message || "Erreur lors de l'envoi" })
          showAlert('error', error.message || "Erreur lors de l'envoi")
        } finally {
          setSendingPendingValidationEmail(false)
        }
      }
    })
  }


  const sendPendingValidationCronTestEmails = async () => {
    const emails = pendingValidationTestEmails
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean)
    if (!emails.length) {
      showAlert('warning', 'Veuillez renseigner au moins une adresse email de test')
      return
    }
    setConfirmAction({
      message: `Lancer un test CRON pour ${emails.length} adresse(s) email ?`,
      onConfirm: async () => {
        setSendingPendingValidationEmail(true)
        setPendingValidationEmailResult(null)
        try {
          const qs = new URLSearchParams({
            test: 'true',
            secret: 'giras-rappel-quotidien-2024',
            emails: emails.join(',')
          })
          const res = await fetch(`/api/cron/pending-validations-daily?${qs.toString()}`)
          const data = await res.json()
          if (!res.ok || data?.error) throw new Error(data.error || 'Erreur lors du test du CRON')
          setPendingValidationEmailResult({
            success: true,
            message: data.skipped ? (data.message || 'Test ignoré') : `Test CRON exécuté : ${data.summary?.emails_sent || 0} email(s) envoyé(s)`,
            summary: data.summary,
            results: data.results
          })
          showAlert('success', data.skipped ? (data.message || 'Test ignoré') : `Test CRON exécuté : ${data.summary?.emails_sent || 0} email(s) envoyé(s)`)
          const refreshRes = await fetch('/api/emailing/pending-validations', { cache: 'no-store' })
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json()
            setPendingValidationSynthesis(refreshData.synthesis || [])
            if (refreshData.settings) setPendingValidationSettings(refreshData.settings)
          }
          await fetchEmailLogs()
          await fetchEmailStats()
        } catch (error) {
          console.error(error)
          setPendingValidationEmailResult({ success: false, message: error.message || 'Erreur lors du test du CRON' })
          showAlert('error', error.message || 'Erreur lors du test du CRON')
        } finally {
          setSendingPendingValidationEmail(false)
        }
      }
    })
  }

  const sendPendingValidationEmailsToSelected = async () => {
    if (!selectedManagersForPendingEmail.length) {
      showAlert('warning', 'Veuillez sélectionner au moins un gestionnaire')
      return
    }
    await sendPendingValidationEmails(selectedManagersForPendingEmail)
  }

  return (
    <div className="mobile-subrubric-layout flex h-[calc(100vh-140px)]">
      <div className="mobile-subrubric-sidebar w-64 bg-white border-r border-gray-100 p-4 space-y-2 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto">
        <div className="mobile-subrubric-sidebar-grid">{visibleSubPages.map((page) => (
          <SidebarButton key={page.key} icon={page.icon} label={page.label} active={activeTab === page.key} onClick={() => setActiveTab(page.key)} />
        ))}</div>
      </div>

      <div className="mobile-subrubric-content flex-1 p-6 overflow-auto bg-gray-50">
        {/* Message d'avertissement lecture seule */}
        {activeTab !== 'utilisateurs' ? (!canEditTab(activeTab) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
            <Lock size={18} />
            <span className="text-sm">Mode lecture seule - Vous n'avez pas les droits pour modifier cette section</span>
          </div>
        )) : (!canEdit() && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
            <Lock size={18} />
            <span className="text-sm">Mode lecture seule - Vous n'avez pas les droits pour modifier cette section</span>
          </div>
        ))}

        {activeTab === 'structures' && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              {canEditTab('structures') ? <Button icon={Plus} onClick={() => handleCreate('structure')}>Nouvelle structure</Button> : <div />}
              <div className="w-full sm:w-80">
                <label className="block text-xs text-gray-500 mb-1">Recherche</label>
                <input
                  type="text"
                  value={structureFilters.search}
                  onChange={(e) => setStructureFilters({ search: e.target.value })}
                  placeholder="Code ou libellé"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
              </div>
            </div>
            <DataTable
              columns={structureColumns}
              data={filteredStructures}
              loading={loading}
              actionsWidth="64px"
              actions={canEditTab('structures') ? [
                { icon: Edit, label: 'Modifier', onClick: (r) => handleEdit(r, 'structure'), className: 'hover:bg-blue-50 text-blue-500' },
                { icon: Trash2, label: 'Supprimer', onClick: (r) => handleDelete(r, 'structures'), className: 'hover:bg-red-50 text-red-500' }
              ] : []}
            />
          </>
        )}

        {activeTab === 'utilisateurs' && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              {canEdit() ? <Button icon={Plus} onClick={() => handleCreate('user')}>Nouvel utilisateur</Button> : <div />}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-64">
                  <SearchableSelect
                    label="Structure"
                    size="sm"
                    value={userFilters.structure}
                    onChange={(v) => setUserFilters({ ...userFilters, structure: v })}
                    options={[{ value: '', label: 'Toutes' }, ...structures.map((s) => ({ value: s.code_structure, label: `${s.code_structure} - ${s.libelle_structure}` }))]}
                    placeholder="Toutes"
                    searchPlaceholder="Rechercher une structure..."
                  />
                </div>
                <div className="w-80">
                  <label className="block text-xs text-gray-500 mb-1">Recherche</label>
                  <input
                    type="text"
                    value={userFilters.search}
                    onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value })}
                    placeholder="Mail, nom ou prénom"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
              </div>
            </div>
            <DataTable
              columns={userColumns}
              data={filteredUsers}
              loading={loading}
              actionsWidth="72px"
              actions={canEdit() ? [
                {
                  icon: Edit,
                  label: 'Modifier',
                  onClick: (r) => handleEdit(r, 'user'),
                  className: 'hover:bg-blue-50 text-blue-500',
                  hidden: (r) => r.type_utilisateur === 'Super admin' && user?.type_utilisateur !== 'Super admin'
                },
                {
                  icon: KeyRound,
                  label: 'Réinitialiser mot de passe',
                  onClick: (r) => handleResetPassword(r),
                  className: 'hover:bg-orange-50 text-orange-500',
                  hidden: (r) => !canResetPassword(r)
                }
              ] : []}
            />
          </>
        )}

        {activeTab === 'flash' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              {canEditTab('flash') && <Button icon={Plus} onClick={() => handleCreate('flash')}>Nouveau message</Button>}
              <div className="flex items-center gap-3">
                <select 
                  value={flashFilters?.statut || ''} 
                  onChange={(e) => setFlashFilters({ ...flashFilters, statut: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  <option value="">Tous les statuts</option>
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  value={flashFilters?.search || ''}
                  onChange={(e) => setFlashFilters({ ...flashFilters, search: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-48"
                />
                <button 
                  onClick={() => setFlashFilters({ statut: '', search: '' })}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Réinitialiser
                </button>
              </div>
            </div>

            <DataTable
              columns={flashColumns}
              data={filteredFlashMessages}
              loading={loading}
              actions={canEditTab('flash') ? [
                { icon: Edit, label: 'Modifier', onClick: (r) => handleEdit(r, 'flash'), className: 'hover:bg-blue-50 text-blue-500' },
                { icon: Trash2, label: 'Supprimer', onClick: (r) => handleDelete(r, 'flash'), className: 'hover:bg-red-50 text-red-500' }
              ] : []}
              emptyMessage="Aucun message flash configuré"
            />
          </>
        )}

        {activeTab === 'emailing' && (
          <div className="space-y-6">
            {/* Sous-onglets */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setEmailSubTab('envoi')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${emailSubTab === 'envoi' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                <Send size={14} className="inline mr-2" />
                Envoi de rappels
              </button>
              <button
                onClick={() => { setEmailSubTab('historique'); fetchEmailLogs(); fetchEmailStats(); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${emailSubTab === 'historique' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                <Mail size={14} className="inline mr-2" />
                Historique des emails
              </button>
            </div>

            {emailSubTab === 'envoi' && (
            <>
            {/* En-tête */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Mail size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Envoi d'emails de rappel</h2>
                  <p className="text-sm text-gray-500">Envoyer des rappels pour les actions et indicateurs en attente</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-[250px]">
                  <label className="block text-xs text-gray-500 mb-1">Envoyer à un ou plusieurs utilisateurs</label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <SearchableSelect
                        value={selectedUsersForEmail}
                        onChange={setSelectedUsersForEmail}
                        options={emailTargetOptions}
                        placeholder="Sélectionner un ou plusieurs utilisateurs..."
                        searchPlaceholder="Rechercher un utilisateur..."
                        multiple
                      />
                    </div>
                    <Button 
                      icon={Send} 
                      onClick={sendEmailToSelected}
                      disabled={!selectedUsersForEmail.length || sendingEmail}
                    >
                      Envoyer
                    </Button>
                  </div>
                </div>
                
                <div className="border-l border-gray-300 h-12 hidden md:block"></div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Envoi groupé</label>
                  <Button 
                    icon={Send} 
                    variant="secondary"
                    onClick={sendEmailToAll}
                    disabled={sendingEmail || emailSynthesis.length === 0}
                  >
                    {sendingEmail ? 'Envoi en cours...' : `Envoyer à tous (${emailSynthesis.length})`}
                  </Button>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Actualiser</label>
                  <button 
                    onClick={refreshEmailSynthesis}
                    disabled={emailLoading}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw size={18} className={`text-gray-600 ${emailLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>




              {/* Résultat de l'envoi */}
              {emailResult && (
                <div className={`mt-4 p-4 rounded-lg ${emailResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {emailResult.success ? (
                      <CheckCircle size={18} className="text-green-600" />
                    ) : (
                      <AlertTriangle size={18} className="text-red-600" />
                    )}
                    <span className={`font-medium ${emailResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {emailResult.message}
                    </span>
                  </div>
                  {emailResult.summary && (
                    <div className="mt-2 text-sm text-gray-600">
                      Total: {emailResult.summary.total} | Envoyés: {emailResult.summary.sent} | Ignorés: {emailResult.summary.skipped}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Récap Hebdomadaire */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <BarChart2 size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Récap hebdomadaire des performances</h2>
                  <p className="text-sm text-gray-500">Envoyer le récapitulatif des performances (score global, actions, indicateurs)</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="flex-1 min-w-[250px]">
                  <label className="block text-xs text-gray-500 mb-1">Envoyer à un ou plusieurs utilisateurs</label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <SearchableSelect
                        value={selectedUsersForRecap}
                        onChange={setSelectedUsersForRecap}
                        options={recapTargetOptions}
                        placeholder="Sélectionner un ou plusieurs utilisateurs..."
                        searchPlaceholder="Rechercher un utilisateur..."
                        multiple
                      />
                    </div>
                    <Button 
                      icon={Send} 
                      onClick={sendRecapToSelected}
                      disabled={!selectedUsersForRecap.length || sendingRecap}
                    >
                      Envoyer
                    </Button>
                  </div>
                </div>
                
                <div className="border-l border-purple-300 h-12 hidden md:block"></div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Envoi groupé</label>
                  <Button 
                    icon={Send} 
                    variant="secondary"
                    onClick={sendRecapToAll}
                    disabled={sendingRecap || recapTargetOptions.length === 0}
                  >
                    {sendingRecap ? 'Envoi en cours...' : `Envoyer à tous (${recapTargetOptions.length})`}
                  </Button>
                </div>
              </div>

              {/* Résultat de l'envoi récap */}
              {recapResult && (
                <div className={`mt-4 p-4 rounded-lg ${recapResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {recapResult.success ? (
                      <CheckCircle size={18} className="text-green-600" />
                    ) : (
                      <AlertTriangle size={18} className="text-red-600" />
                    )}
                    <span className={`font-medium ${recapResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {recapResult.message}
                    </span>
                  </div>
                  {recapResult.summary && (
                    <div className="mt-2 text-sm text-gray-600">
                      Total: {recapResult.summary.total} | Envoyés: {recapResult.summary.sent} | Ignorés: {recapResult.summary.skipped} | Échecs: {recapResult.summary.failed || 0}
                    </div>
                  )}
                  {Array.isArray(recapResult.results) && recapResult.results.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {recapResult.results.map((row, idx) => (
                        <div key={`${row.user}-${idx}`} className={`rounded-lg border px-3 py-2 text-sm ${row.status === 'sent' ? 'border-green-200 bg-green-50 text-green-700' : row.status === 'skipped' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                          <span className="font-medium">{row.fullName || row.user}</span>
                          <span className="ml-2">
                            {row.status === 'sent' && 'Récap envoyé'}
                            {row.status === 'skipped' && (row.reason || "Aucun contenu à envoyer pour cet utilisateur")}
                            {row.status === 'failed' && (row.error || "Erreur lors de l\'envoi")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>


            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-sm">
                    <AlertTriangle size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Validations et confirmations en attente</h2>
                    <p className="text-sm text-gray-500">Pilotage des mails quotidiens envoyés aux gestionnaires de projet et aux gestionnaires de groupes d'indicateurs.</p>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
                <div className="xl:col-span-1 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Paramètres des délais</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-white text-amber-700 border border-amber-200">Administration</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Délai confirmation actions (jours)</label>
                      <input type="number" min="0" value={pendingValidationSettings.actionValidationDelayDays ?? ''} disabled={!pendingValidationSettingsLoaded} onChange={(e) => setPendingValidationSettings({ ...pendingValidationSettings, actionValidationDelayDays: e.target.value })} className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Délai validation indicateurs (jours)</label>
                      <input type="number" min="0" value={pendingValidationSettings.indicatorValidationDelayDays ?? ''} disabled={!pendingValidationSettingsLoaded} onChange={(e) => setPendingValidationSettings({ ...pendingValidationSettings, indicatorValidationDelayDays: e.target.value })} className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-amber-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                    </div>
                    <Button onClick={saveValidationReminderSettings} disabled={savingPendingValidationSettings}>
                      {savingPendingValidationSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                    </Button>
                  </div>
                </div>

                <div className="xl:col-span-2 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">Envoi manuel</h3>
                      <p className="text-xs text-gray-600 mt-1">Envoyez maintenant ce mail aux gestionnaires concernés.</p>
                    </div>
                    <Button icon={Send} variant="secondary" onClick={sendPendingValidationEmailsToAll} disabled={sendingPendingValidationEmail || pendingValidationTargetOptions.length === 0}>
                      {sendingPendingValidationEmail ? 'Envoi en cours...' : `Envoyer à tous (${pendingValidationTargetOptions.length})`}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Gestionnaires ciblés</label>
                      <SearchableSelect
                        value={selectedManagersForPendingEmail}
                        onChange={setSelectedManagersForPendingEmail}
                        options={pendingValidationTargetOptions}
                        placeholder="Sélectionner un ou plusieurs gestionnaires..."
                        searchPlaceholder="Rechercher un gestionnaire..."
                        multiple
                      />
                      <div className="mt-3 flex justify-end">
                        <Button icon={Send} onClick={sendPendingValidationEmailsToSelected} disabled={!selectedManagersForPendingEmail.length || sendingPendingValidationEmail}>Envoyer la sélection</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {pendingValidationEmailResult && (
                <div className={`mt-4 p-4 rounded-lg ${pendingValidationEmailResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {pendingValidationEmailResult.success ? <CheckCircle size={18} className="text-green-600" /> : <AlertTriangle size={18} className="text-red-600" />}
                    <span className={`font-medium ${pendingValidationEmailResult.success ? 'text-green-700' : 'text-red-700'}`}>{pendingValidationEmailResult.message}</span>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-[11px]">
                  <thead className="bg-gradient-to-r from-amber-600 to-orange-600">
                    <tr>
                      <th className="px-2 py-2 text-left text-white">Gestionnaire</th>
                      <th className="px-2 py-2 text-left text-white">Email</th>
                      <th className="px-2 py-2 text-center text-white">Actions attente</th>
                      <th className="px-2 py-2 text-center text-white">Actions retard</th>
                      <th className="px-2 py-2 text-center text-white">Indic. attente</th>
                      <th className="px-2 py-2 text-center text-white">Indic. retard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingValidationSynthesis.map((row) => (
                      <tr key={row.username} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-2">{row.prenoms} {row.nom}</td>
                        <td className="px-2 py-2">{row.email}</td>
                        <td className="px-2 py-2 text-center">{row.actionsPending || 0}</td>
                        <td className="px-2 py-2 text-center">{row.actionsLate || 0}</td>
                        <td className="px-2 py-2 text-center">{row.indicatorsPending || 0}</td>
                        <td className="px-2 py-2 text-center">{row.indicatorsLate || 0}</td>
                      </tr>
                    ))}
                    {pendingValidationSynthesis.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">Aucun gestionnaire de projet ou de groupe d'indicateurs trouvé.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tableau de synthèse */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-800">Synthèse par utilisateur</h3>
                <p className="text-xs text-gray-500">Liste des utilisateurs avec des éléments en attente</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]">
                    <tr>
                      <th className="px-2 py-2 text-left text-white">Utilisateur</th>
                      <th className="px-2 py-2 text-left text-white">Email</th>
                      <th className="px-2 py-2 text-center text-white">Structure</th>
                      <th className="px-2 py-2 text-center text-white">Actions non réalisées</th>
                      <th className="px-2 py-2 text-center text-white">Indicateurs non renseignés</th>
                      <th className="px-2 py-2 text-center text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading || emailLoading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            Chargement...
                          </div>
                        </td>
                      </tr>
                    ) : emailSynthesis.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
                          <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
                          Aucun utilisateur n'a d'éléments en attente
                        </td>
                      </tr>
                    ) : (
                      emailSynthesis.map((item, idx) => (
                        <tr key={item.username} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                <User size={10} className="text-gray-500" />
                              </div>
                              <span className="font-medium text-gray-900">{item.prenoms} {item.nom}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-gray-600">{item.email}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-mono">{item.structure || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {item.actionsNonRealisees > 0 ? (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-medium">
                                {item.actionsNonRealisees}
                              </span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {item.indicateursNonRenseignes > 0 ? (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-medium">
                                {item.indicateursNonRenseignes}
                              </span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => sendEmailToUser(item.username)}
                              disabled={sendingEmail}
                              className="p-1 rounded hover:bg-blue-100 text-blue-600 disabled:opacity-50"
                              title="Envoyer un email de rappel"
                            >
                              <Send size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {emailSynthesis.length > 0 && (
                <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">
                  Total: {emailSynthesis.length} utilisateur(s) | 
                  {emailSynthesis.reduce((a, b) => a + b.actionsNonRealisees, 0)} actions, {emailSynthesis.reduce((a, b) => a + b.indicateursNonRenseignes, 0)} indicateurs
                </div>
              )}
            </div>
            </>
            )}

            {/* Sous-onglet Historique */}
            {emailSubTab === 'historique' && (
            <>
              {/* Stats */}
              {emailStats && (
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-gray-900">{emailStats.total}</div>
                    <div className="text-xs text-gray-500">Total emails</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-green-600">{emailStats.envoyes}</div>
                    <div className="text-xs text-gray-500">Envoyés</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-red-600">{emailStats.echoues}</div>
                    <div className="text-xs text-gray-500">Échoués</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-blue-600">{emailStats.aujourdhui}</div>
                    <div className="text-xs text-gray-500">Aujourd'hui</div>
                  </div>
                </div>
              )}

              {/* Filtres */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select
                    value={emailFilters.type}
                    onChange={(e) => setEmailFilters({...emailFilters, type: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  >
                    <option value="">Tous les types</option>
                    <option value="rappel_quotidien">Rappel quotidien (CRON)</option>
                    <option value="rappel_manuel">Rappel manuel</option>
                    <option value="creation_compte">Création compte</option>
                    <option value="reset_password">Réinitialisation MDP</option>
                    <option value="attribution_action">Attribution action</option>
                    <option value="attribution_indicateur">Attribution indicateur</option>
                    <option value="confirmation_gestionnaire">Confirmation gestionnaire</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs text-gray-500 mb-1">Statut</label>
                  <select
                    value={emailFilters.statut}
                    onChange={(e) => setEmailFilters({...emailFilters, statut: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  >
                    <option value="">Tous</option>
                    <option value="envoyé">Envoyé</option>
                    <option value="échec">Échec</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-gray-500 mb-1">Date début</label>
                  <input
                    type="date"
                    value={emailFilters.date_debut}
                    onChange={(e) => setEmailFilters({...emailFilters, date_debut: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-gray-500 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={emailFilters.date_fin}
                    onChange={(e) => setEmailFilters({...emailFilters, date_fin: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <Button icon={RefreshCw} onClick={fetchEmailLogs} disabled={emailLogsLoading}>
                  {emailLogsLoading ? 'Chargement...' : 'Filtrer'}
                </Button>
              </div>

              {/* Tableau des logs */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-800">Historique des emails envoyés</h3>
                  <p className="text-xs text-gray-500">Tous les emails envoyés (automatiques et manuels)</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]">
                      <tr>
                        <th className="px-2 py-2 text-left text-white">Date</th>
                        <th className="px-2 py-2 text-left text-white">Destinataire</th>
                        <th className="px-2 py-2 text-left text-white">Sujet</th>
                        <th className="px-2 py-2 text-center text-white">Type</th>
                        <th className="px-2 py-2 text-center text-white">Source</th>
                        <th className="px-2 py-2 text-center text-white">Actions</th>
                        <th className="px-2 py-2 text-center text-white">Indic.</th>
                        <th className="px-2 py-2 text-center text-white">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {emailLogsLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500">
                            <div className="flex items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                              Chargement...
                            </div>
                          </td>
                        </tr>
                      ) : emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500">
                            Aucun email dans l'historique
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                              {new Date(log.date_envoi).toLocaleString('fr-FR', { 
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="font-medium text-gray-900">{log.destinataire_nom || '-'}</div>
                              <div className="text-[9px] text-gray-500">{log.destinataire}</div>
                            </td>
                            <td className="px-2 py-1.5 text-gray-600 max-w-[200px] truncate" title={log.sujet}>
                              {log.sujet}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                log.type_email === 'rappel_quotidien' ? 'bg-blue-100 text-blue-700' :
                                log.type_email === 'rappel_manuel' ? 'bg-purple-100 text-purple-700' :
                                log.type_email === 'creation_compte' ? 'bg-green-100 text-green-700' :
                                log.type_email === 'reset_password' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {log.type_email?.replace('_', ' ') || '-'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                ['cron_quotidien', 'cron_hebdo', 'cron_pending_validations_daily', 'cron_validation_pending_daily', 'cron_validation_pending_weekly'].includes(log.source) ? 'bg-indigo-100 text-indigo-700' :
                                log.source === 'manuel' || log.source === 'manuel_validation_pending' || log.source === 'manuel_hebdo' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {['cron_quotidien', 'cron_hebdo', 'cron_pending_validations_daily', 'cron_validation_pending_daily', 'cron_validation_pending_weekly'].includes(log.source) ? '⏰ CRON' : ['manuel', 'manuel_validation_pending', 'manuel_hebdo'].includes(log.source) ? '👤 Manuel' : log.source || '-'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {log.nb_actions > 0 ? (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-medium">
                                  {log.nb_actions}
                                </span>
                              ) : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {log.nb_indicateurs > 0 ? (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-medium">
                                  {log.nb_indicateurs}
                                </span>
                              ) : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {log.statut === 'envoyé' ? (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-medium">
                                  ✓ Envoyé
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-medium" title={log.erreur}>
                                  ✗ Échec
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {emailLogs.length > 0 && (
                  <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500">
                    {emailLogs.length} email(s) affichés
                  </div>
                )}
              </div>
            </>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalType === 'structure' ? (selectedItem ? 'Modifier la structure' : 'Nouvelle structure') : modalType === 'user' ? (selectedItem ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur') : 'Message flash'} size={modalType === 'user' ? 'lg' : 'md'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {modalType === 'structure' && (
            <>
              <FormInput label="Code" value={formData.code_structure} onChange={(v) => setFormData({ ...formData, code_structure: v })} required disabled={!!selectedItem} placeholder="Ex: DERS" />
              <FormInput label="Libellé" value={formData.libelle_structure} onChange={(v) => setFormData({ ...formData, libelle_structure: v })} required placeholder="Direction des..." />
              {selectedItem && (
                <SearchableSelect
                  label="Responsable de la structure"
                  value={formData.responsable_structure || ''}
                  onChange={(v) => setFormData({ ...formData, responsable_structure: v })}
                  options={[{ value: '', label: 'Aucun responsable' }, ...getStructureResponsableOptions()]}
                  placeholder="Sélectionner un responsable..."
                  searchPlaceholder="Rechercher un responsable..."
                />
              )}
              <FormInput label="Statut" type="select" value={formData.statut || 'Actif'} onChange={(v) => setFormData({ ...formData, statut: v })} options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]} />
            </>
          )}

          {modalType === 'user' && (
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Email" type="email" value={formData.username} onChange={(v) => setFormData({ ...formData, username: v })} required disabled={!!selectedItem} placeholder="email@ipscnam.ci" />
              {!selectedItem && <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">Le mot de passe n'est pas saisi ici. Il sera généré automatiquement lors de la création du compte.</div>}
              {selectedItem && <div></div>}
              <FormInput label="Nom" value={formData.nom} onChange={(v) => setFormData({ ...formData, nom: v })} required placeholder="NOM" />
              <FormInput label="Prénoms" value={formData.prenoms} onChange={(v) => setFormData({ ...formData, prenoms: v })} required placeholder="Prénoms" />
              <FormInput label="Structure" type="select" value={formData.structure} onChange={(v) => setFormData({ ...formData, structure: v, superieur: '' })} required options={structures.map(s => ({ value: s.code_structure, label: `${s.code_structure} - ${s.libelle_structure}` }))} />
              <FormInput label="Poste" value={formData.poste} onChange={(v) => setFormData({ ...formData, poste: v })} required placeholder="Chef de service" />
              <div className="col-span-2">
                <SearchableSelect label="Supérieur hiérarchique direct" value={formData.superieur || ''} onChange={(v) => setFormData({ ...formData, superieur: v, superieur_existe: v ? 'Oui' : 'Non' })} options={[{ value: '', label: 'Aucun supérieur hiérarchique direct' }, ...getSuperieurOptions()]} placeholder={formData.structure ? 'Sélectionner un supérieur...' : 'Choisir la structure d’abord'} searchPlaceholder="Rechercher un supérieur..." disabled={!formData.structure} />
                <p className="mt-1 text-xs text-gray-500">Champ facultatif. Liste limitée aux Manager, Super manager, Admin et Super admin actifs de la structure choisie.</p>
              </div>
              <FormInput label="Type" type="select" value={formData.type_utilisateur} onChange={(v) => setFormData({ ...formData, type_utilisateur: v, acces_admin: isActorSuperAdmin ? (v === 'Super admin' ? 'Oui' : (v === 'Admin' ? (formData.acces_admin || 'Non') : 'Non')) : 'Non', admin_structures_droit: isActorSuperAdmin ? (v === 'Super admin' ? 'edit' : (v === 'Admin' ? (formData.admin_structures_droit || 'read') : 'none')) : 'none', admin_flash_droit: isActorSuperAdmin ? (v === 'Super admin' ? 'edit' : (v === 'Admin' ? (formData.admin_flash_droit || 'read') : 'none')) : 'none', admin_emailing_acces: isActorSuperAdmin ? (v === 'Super admin' ? 'Oui' : (v === 'Admin' ? (formData.admin_emailing_acces || 'Non') : 'Non')) : 'Non' })} required options={userTypeOptions} />
              <FormInput label="Statut" type="select" value={formData.statut || 'Actif'} onChange={(v) => setFormData({ ...formData, statut: v })} options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]} />
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-3">Droits d'accès</p>
                <div className="grid grid-cols-3 gap-3">
                  <FormInput label="Risques" type="select" value={formData.acces_risque || 'Non'} onChange={(v) => setFormData({ ...formData, acces_risque: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Activités" type="select" value={formData.acces_activite || 'Non'} onChange={(v) => setFormData({ ...formData, acces_activite: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Indicateurs" type="select" value={formData.acces_indicateur || 'Non'} onChange={(v) => setFormData({ ...formData, acces_indicateur: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Tableau de bord" type="select" value={formData.acces_tb || 'Non'} onChange={(v) => setFormData({ ...formData, acces_tb: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Performances" type="select" value={formData.acces_perform || 'Non'} onChange={(v) => setFormData({ ...formData, acces_perform: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Administration" type="select" value={isActorSuperAdmin ? (formData.type_utilisateur === 'Super admin' ? 'Oui' : (formData.type_utilisateur === 'Admin' ? (formData.acces_admin || 'Non') : 'Non')) : 'Non'} onChange={(v) => setFormData({ ...formData, acces_admin: isActorSuperAdmin ? (formData.type_utilisateur === 'Admin' ? v : (formData.type_utilisateur === 'Super admin' ? 'Oui' : 'Non')) : 'Non', admin_structures_droit: isActorSuperAdmin && v === 'Oui' ? (formData.admin_structures_droit || 'read') : 'none', admin_flash_droit: isActorSuperAdmin && v === 'Oui' ? (formData.admin_flash_droit || 'read') : 'none', admin_emailing_acces: isActorSuperAdmin && v === 'Oui' ? (formData.admin_emailing_acces || 'Non') : 'Non' })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" disabled={!isActorSuperAdmin || formData.type_utilisateur !== 'Admin'} helperText={isActorSuperAdmin ? (formData.type_utilisateur === 'Super admin' ? 'Accès obligatoire pour le Super Admin' : formData.type_utilisateur === 'Admin' ? 'Choisir si cet admin peut accéder au module Administration' : 'Réservé aux profils Admin et Super Admin') : 'Ce droit ne peut être accordé que par un Super Admin'} />
                  <FormInput label="Créer projets" type="select" value={formData.peut_creer_projets || (formData.type_utilisateur === 'Super admin' ? 'Oui' : 'Non')} onChange={(v) => setFormData({ ...formData, peut_creer_projets: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Créer groupes d'indicateurs" type="select" value={formData.peut_creer_groupes_indicateurs || (formData.type_utilisateur === 'Super admin' ? 'Oui' : 'Non')} onChange={(v) => setFormData({ ...formData, peut_creer_groupes_indicateurs: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                </div>
                {isActorSuperAdmin && ((formData.type_utilisateur === 'Admin' && (formData.acces_admin || 'Non') === 'Oui') || formData.type_utilisateur === 'Super admin') ? (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <FormInput label="Administration > Structures" type="select" value={formData.type_utilisateur === 'Super admin' ? 'edit' : (formData.admin_structures_droit || 'read')} onChange={(v) => setFormData({ ...formData, admin_structures_droit: v })} options={[{ value: 'read', label: 'Lecture seule' }, { value: 'edit', label: 'Créer et modifier' }]} className="mb-0" disabled={formData.type_utilisateur === 'Super admin'} />
                    <FormInput label="Administration > Infos flash" type="select" value={formData.type_utilisateur === 'Super admin' ? 'edit' : (formData.admin_flash_droit || 'read')} onChange={(v) => setFormData({ ...formData, admin_flash_droit: v })} options={[{ value: 'read', label: 'Lecture seule' }, { value: 'edit', label: 'Créer et modifier' }]} className="mb-0" disabled={formData.type_utilisateur === 'Super admin'} />
                    <FormInput label="Administration > Emailing" type="select" value={formData.type_utilisateur === 'Super admin' ? 'Oui' : (formData.admin_emailing_acces || 'Non')} onChange={(v) => setFormData({ ...formData, admin_emailing_acces: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" disabled={formData.type_utilisateur === 'Super admin'} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {modalType === 'flash' && (
            <>
              <FormInput label="Message" type="textarea" value={formData.info} onChange={(v) => setFormData({ ...formData, info: v })} required placeholder="Votre message flash..." />
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Date début" type="date" value={formData.date_debut} onChange={(v) => setFormData({ ...formData, date_debut: v })} required />
                <FormInput label="Date fin" type="date" value={formData.date_fin} onChange={(v) => setFormData({ ...formData, date_fin: v })} required />
              </div>
              <FormInput label="Statut" type="select" value={formData.statut || 'Actif'} onChange={(v) => setFormData({ ...formData, statut: v })} options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]} />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" disabled={modalType === 'user' && selectedItem?.type_utilisateur === 'Super admin' && user?.type_utilisateur !== 'Super admin'}>{selectedItem ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal d'affichage du mot de passe */}
      {showPasswordModal && passwordModalData && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 ${passwordModalData.emailSent ? 'bg-green-500' : 'bg-orange-500'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {passwordModalData.emailSent ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-white" />
                  )}
                  <h3 className="text-lg font-bold text-white">
                    {passwordModalData.type === 'create' ? 'Compte créé' : 'Mot de passe réinitialisé'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 rounded-full hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Statut email */}
              <div className={`p-3 rounded-lg mb-4 ${passwordModalData.emailSent ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                {passwordModalData.emailSent ? (
                  <p className="text-green-700 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Un email avec les identifiants a été envoyé à <strong>{passwordModalData.username}</strong>
                  </p>
                ) : (
                  <div>
                    <p className="text-orange-700 text-sm flex items-center gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4" />
                      L'email n'a pas pu être envoyé
                    </p>
                    {passwordModalData.emailError && (
                      <p className="text-orange-600 text-xs mt-1 ml-6">
                        Raison : {passwordModalData.emailError}
                      </p>
                    )}
                    <p className="text-orange-700 text-xs mt-2 ml-6">
                      💡 Les serveurs de messagerie d'entreprise (CNAM) peuvent bloquer les emails. 
                      Veuillez transmettre le mot de passe ci-dessous manuellement à l'utilisateur.
                    </p>
                  </div>
                )}
              </div>

              {/* Informations utilisateur */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Utilisateur</label>
                  <p className="font-medium text-gray-800">{passwordModalData.nom}</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email (identifiant)</label>
                  <p className="font-mono text-gray-800">{passwordModalData.username}</p>
                </div>
                
                {/* Afficher le mot de passe UNIQUEMENT si l'email n'a pas été envoyé */}
                {!passwordModalData.emailSent && passwordModalData.password && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Mot de passe temporaire</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-100 px-3 py-2 rounded-lg font-mono text-lg font-bold text-blue-600 select-all">
                        {passwordModalData.password}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(passwordModalData.password)
                          setCopied(true)
                          setTimeout(() => setCopied(false), 2000)
                        }}
                        className={`p-2 rounded-lg transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}
                        title="Copier le mot de passe"
                      >
                        {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    {copied && (
                      <p className="text-green-600 text-xs mt-1">✓ Mot de passe copié !</p>
                    )}
                  </div>
                )}
              </div>

              {/* Note importante - différente selon le statut */}
              {passwordModalData.emailSent ? (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-blue-700 text-xs">
                    <strong>Note :</strong> L'utilisateur a reçu ses identifiants par email. 
                    Il lui sera demandé de changer son mot de passe lors de sa première connexion.
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-orange-700 text-xs">
                    <strong>Important :</strong> Veuillez transmettre ces identifiants à l'utilisateur 
                    par un moyen sécurisé (téléphone, en personne, etc.) et lui demander de changer son mot de passe.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <Button onClick={() => setShowPasswordModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

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
