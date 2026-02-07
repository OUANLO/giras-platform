'use client'

import { useState, useEffect } from 'react'
import { Layers, Users, Bell, Plus, Edit, Trash2, KeyRound, Lock, Mail, Send, RefreshCw, CheckCircle, AlertTriangle, User, Copy, X, BarChart2 } from 'lucide-react'
import { Button, Modal, FormInput, FilterBar, DataTable, StatusBadge, SidebarButton, AlertModal } from '@/components/ui'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('structures')
  const [structures, setStructures] = useState([])
  const [users, setUsers] = useState([])
  const [flashMessages, setFlashMessages] = useState([])
  const [flashFilters, setFlashFilters] = useState({ statut: '', search: '' })
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
  
  // États pour le modal de mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordModalData, setPasswordModalData] = useState(null)
  const [copied, setCopied] = useState(false)
  
  // États pour Emailing - Rappels quotidiens
  const [emailSynthesis, setEmailSynthesis] = useState([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [selectedUserForEmail, setSelectedUserForEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResult, setEmailResult] = useState(null)
  const [emailSubTab, setEmailSubTab] = useState('envoi') // 'envoi' ou 'historique'
  const [emailLogs, setEmailLogs] = useState([])
  const [emailLogsLoading, setEmailLogsLoading] = useState(false)
  const [emailStats, setEmailStats] = useState(null)
  const [emailFilters, setEmailFilters] = useState({ type: '', statut: '', date_debut: '', date_fin: '' })
  
  // États pour Récap Hebdomadaire
  const [selectedUserForRecap, setSelectedUserForRecap] = useState('')
  const [sendingRecap, setSendingRecap] = useState(false)
  const [recapResult, setRecapResult] = useState(null)

  const subPages = [
    { key: 'structures', label: 'Structures', icon: Layers },
    { key: 'utilisateurs', label: 'Gestion', icon: Users },
    { key: 'flash', label: 'Infos Flash', icon: Bell },
    { key: 'emailing', label: 'Emailing', icon: Mail }
  ]

  // Vérifier si l'utilisateur peut modifier (Admin, Super admin uniquement pour Administration)
  const canEdit = () => {
    const type = user?.type_utilisateur
    return type === 'Admin' || type === 'Super admin'
  }

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (storedUser) setUser(JSON.parse(storedUser))
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'structures') {
        const res = await fetch('/api/structures')
        if (res.ok) {
          const data = await res.json()
          setStructures(data.structures || [])
        }
      } else if (activeTab === 'utilisateurs') {
        const [usersRes, structuresRes] = await Promise.all([
          fetch('/api/users'),
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
      } else if (activeTab === 'flash') {
        const res = await fetch('/api/flash?all=true')
        if (res.ok) {
          const data = await res.json()
          setFlashMessages(data.messages || [])
        }
      } else if (activeTab === 'emailing') {
        // Charger les utilisateurs et la synthèse
        const [usersRes, synthesisRes] = await Promise.all([
          fetch('/api/users?statut=Actif'),
          fetch('/api/emailing')
        ])
        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users || [])
        }
        if (synthesisRes.ok) {
          const data = await synthesisRes.json()
          setEmailSynthesis(data.synthesis || [])
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

  const handleCreate = (type) => {
    setSelectedItem(null)
    setFormData({})
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
    try {
      const endpoints = { structure: 'structures', user: 'users', flash: 'flash' }
      const method = selectedItem ? 'PUT' : 'POST'
      const body = { ...formData, id: selectedItem?.id, createur: user?.username, modificateur: user?.username }

      const res = await fetch(`/api/${endpoints[modalType]}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (res.ok) {
        setShowModal(false)
        fetchData()
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
    { key: 'code_structure', label: 'Code', width: '100px' },
    { key: 'libelle_structure', label: 'Libellé' },
    { key: 'statut', label: 'Statut', width: '100px', render: (v) => <StatusBadge status={v} /> }
  ]

  const userColumns = [
    { key: 'username', label: 'Email' },
    { key: 'nom', label: 'Nom' },
    { key: 'prenoms', label: 'Prénoms' },
    { key: 'structure', label: 'Structure', width: '100px' },
    { key: 'type_utilisateur', label: 'Type', width: '120px' },
    { key: 'statut', label: 'Statut', width: '100px', render: (v) => <StatusBadge status={v} /> }
  ]

  // Déterminer si l'utilisateur peut réinitialiser le mot de passe d'un autre utilisateur
  const canResetPassword = (targetUser) => {
    if (!user) return false
    if (user.type_utilisateur === 'Super admin') return true
    if (user.type_utilisateur === 'Admin') {
      return targetUser.type_utilisateur !== 'Super admin' && targetUser.type_utilisateur !== 'Super manager'
    }
    return false
  }

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

  const sendEmailToUser = async (username) => {
    setConfirmAction({
      message: `Envoyer un email de rappel à ${username} ?`,
      onConfirm: async () => {
        setSendingEmail(true)
        setEmailResult(null)
        try {
          const res = await fetch('/api/emailing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUser: username, createur: user?.username })
          })
          
          const data = await res.json()
          
          if (res.ok) {
            setEmailResult({ success: true, message: data.message, details: data.details })
            showAlert('success', `Email envoyé avec succès à ${username}`)
            await fetchEmailLogs()
            await fetchEmailStats()
          } else {
            setEmailResult({ success: false, message: data.error })
            showAlert('error', data.error || 'Erreur lors de l\'envoi')
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de l\'envoi de l\'email')
        } finally {
          setSendingEmail(false)
        }
      }
    })
  }

  const sendEmailToAll = async () => {
    const usersWithItems = emailSynthesis.filter(s => s.hasItems)
    if (usersWithItems.length === 0) {
      showAlert('info', 'Aucun utilisateur n\'a d\'éléments en attente')
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
            showAlert('error', data.error || 'Erreur lors de l\'envoi')
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de l\'envoi des emails')
        } finally {
          setSendingEmail(false)
        }
      }
    })
  }

  const sendEmailToSelected = async () => {
    if (!selectedUserForEmail) {
      showAlert('warning', 'Veuillez sélectionner un utilisateur')
      return
    }
    await sendEmailToUser(selectedUserForEmail)
  }

  // Fonctions pour le récap hebdomadaire
  const sendRecapToUser = async (username) => {
    setSendingRecap(true)
    setRecapResult(null)
    try {
      const res = await fetch('/api/cron/weekly-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUser: username, createur: user?.username })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setRecapResult({ 
          success: true, 
          message: `Récap envoyé à ${username}`,
          summary: { total: 1, sent: data.summary?.emails_sent || 1, skipped: data.summary?.users_skipped || 0 }
        })
        showAlert('success', `Récap hebdomadaire envoyé à ${username}`)
        await fetchEmailLogs()
        await fetchEmailStats()
      } else {
        setRecapResult({ success: false, message: data.error || 'Erreur lors de l\'envoi' })
        showAlert('error', data.error || 'Erreur lors de l\'envoi')
      }
    } catch (error) {
      console.error('Erreur:', error)
      showAlert('error', 'Erreur lors de l\'envoi du récap')
    } finally {
      setSendingRecap(false)
    }
  }

  const sendRecapToAll = async () => {
    setConfirmAction({
      message: `Envoyer le récap hebdomadaire des performances à ${emailSynthesis.length} utilisateur(s) ?`,
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
                skipped: data.summary?.users_skipped || 0 
              }
            })
            showAlert('success', `${data.summary?.emails_sent || 0} récap(s) hebdomadaire(s) envoyé(s)`)
            await fetchEmailLogs()
            await fetchEmailStats()
          } else {
            setRecapResult({ success: false, message: data.error || 'Erreur lors de l\'envoi' })
            showAlert('error', data.error || 'Erreur lors de l\'envoi')
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de l\'envoi des récaps')
        } finally {
          setSendingRecap(false)
        }
      }
    })
  }

  const sendRecapToSelected = async () => {
    if (!selectedUserForRecap) {
      showAlert('warning', 'Veuillez sélectionner un utilisateur')
      return
    }
    await sendRecapToUser(selectedUserForRecap)
  }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      <div className="w-64 bg-white border-r border-gray-100 p-4 space-y-2 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto">
        {subPages.map((page) => (
          <SidebarButton key={page.key} icon={page.icon} label={page.label} active={activeTab === page.key} onClick={() => setActiveTab(page.key)} />
        ))}
      </div>

      <div className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Message d'avertissement lecture seule */}
        {!canEdit() && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
            <Lock size={18} />
            <span className="text-sm">Mode lecture seule - Vous n'avez pas les droits pour modifier cette section</span>
          </div>
        )}

        {activeTab === 'structures' && (
          <>
            <div className="flex justify-between mb-6">
              {canEdit() && <Button icon={Plus} onClick={() => handleCreate('structure')}>Nouvelle structure</Button>}
            </div>
            <DataTable
              columns={structureColumns}
              data={structures}
              loading={loading}
              actions={canEdit() ? [
                { icon: Edit, label: 'Modifier', onClick: (r) => handleEdit(r, 'structure'), className: 'hover:bg-blue-50 text-blue-500' },
                { icon: Trash2, label: 'Supprimer', onClick: (r) => handleDelete(r, 'structures'), className: 'hover:bg-red-50 text-red-500' }
              ] : []}
            />
          </>
        )}

        {activeTab === 'utilisateurs' && (
          <>
            <div className="flex justify-between mb-6">
              {canEdit() && <Button icon={Plus} onClick={() => handleCreate('user')}>Nouvel utilisateur</Button>}
            </div>
            <DataTable
              columns={userColumns}
              data={users}
              loading={loading}
              actions={canEdit() ? [
                { icon: Edit, label: 'Modifier', onClick: (r) => handleEdit(r, 'user'), className: 'hover:bg-blue-50 text-blue-500' },
                { icon: KeyRound, label: 'Réinitialiser mot de passe', onClick: (r) => handleResetPassword(r), className: 'hover:bg-orange-50 text-orange-500' }
              ] : []}
            />
          </>
        )}

        {activeTab === 'flash' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              {canEdit() && <Button icon={Plus} onClick={() => handleCreate('flash')}>Nouveau message</Button>}
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
              actions={canEdit() ? [
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
                  <label className="block text-xs text-gray-500 mb-1">Envoyer à un utilisateur spécifique</label>
                  <div className="flex gap-2">
                    <select 
                      value={selectedUserForEmail}
                      onChange={(e) => setSelectedUserForEmail(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    >
                      <option value="">Sélectionner un utilisateur...</option>
                      {emailSynthesis.map(s => (
                        <option key={s.username} value={s.username}>
                          {s.prenoms} {s.nom} ({s.actionsNonRealisees} actions, {s.indicateursNonRenseignes} indicateurs)
                        </option>
                      ))}
                    </select>
                    <Button 
                      icon={Send} 
                      onClick={sendEmailToSelected}
                      disabled={!selectedUserForEmail || sendingEmail}
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
                  <label className="block text-xs text-gray-500 mb-1">Envoyer à un utilisateur spécifique</label>
                  <div className="flex gap-2">
                    <select 
                      value={selectedUserForRecap}
                      onChange={(e) => setSelectedUserForRecap(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    >
                      <option value="">Sélectionner un utilisateur...</option>
                      {emailSynthesis.map(s => (
                        <option key={s.username} value={s.username}>
                          {s.prenoms} {s.nom}
                        </option>
                      ))}
                    </select>
                    <Button 
                      icon={Send} 
                      onClick={sendRecapToSelected}
                      disabled={!selectedUserForRecap || sendingRecap}
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
                    disabled={sendingRecap || emailSynthesis.length === 0}
                  >
                    {sendingRecap ? 'Envoi en cours...' : `Envoyer à tous (${emailSynthesis.length})`}
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
                      Total: {recapResult.summary.total} | Envoyés: {recapResult.summary.sent} | Ignorés: {recapResult.summary.skipped}
                    </div>
                  )}
                </div>
              )}
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
                                log.source === 'cron_quotidien' ? 'bg-indigo-100 text-indigo-700' :
                                log.source === 'manuel' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {log.source === 'cron_quotidien' ? '⏰ CRON' : log.source === 'manuel' ? '👤 Manuel' : log.source || '-'}
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
              <FormInput label="Statut" type="select" value={formData.statut || 'Actif'} onChange={(v) => setFormData({ ...formData, statut: v })} options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]} />
            </>
          )}

          {modalType === 'user' && (
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Email" type="email" value={formData.username} onChange={(v) => setFormData({ ...formData, username: v })} required disabled={!!selectedItem} placeholder="email@ipscnam.ci" />
              {!selectedItem && <FormInput label="Mot de passe" type="password" value={formData.password} onChange={(v) => setFormData({ ...formData, password: v })} placeholder="Laissez vide pour auto-générer" helperText="Si vide, un mot de passe sera généré automatiquement" />}
              {selectedItem && <div></div>}
              <FormInput label="Nom" value={formData.nom} onChange={(v) => setFormData({ ...formData, nom: v })} required placeholder="NOM" />
              <FormInput label="Prénoms" value={formData.prenoms} onChange={(v) => setFormData({ ...formData, prenoms: v })} required placeholder="Prénoms" />
              <FormInput label="Structure" type="select" value={formData.structure} onChange={(v) => setFormData({ ...formData, structure: v })} required options={structures.map(s => ({ value: s.code_structure, label: `${s.code_structure} - ${s.libelle_structure}` }))} />
              <FormInput label="Poste" value={formData.poste} onChange={(v) => setFormData({ ...formData, poste: v })} required placeholder="Chef de service" />
              <FormInput label="Type" type="select" value={formData.type_utilisateur} onChange={(v) => setFormData({ ...formData, type_utilisateur: v })} required options={[{ value: 'Admin', label: 'Admin' }, { value: 'Super manager', label: 'Super Manager' }, { value: 'Manager', label: 'Manager' }, { value: 'User', label: 'User' }]} />
              <FormInput label="Statut" type="select" value={formData.statut || 'Actif'} onChange={(v) => setFormData({ ...formData, statut: v })} options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]} />
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-3">Droits d'accès</p>
                <div className="grid grid-cols-3 gap-3">
                  <FormInput label="Risques" type="select" value={formData.acces_risque || 'Non'} onChange={(v) => setFormData({ ...formData, acces_risque: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Activités" type="select" value={formData.acces_activite || 'Non'} onChange={(v) => setFormData({ ...formData, acces_activite: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Indicateurs" type="select" value={formData.acces_indicateur || 'Non'} onChange={(v) => setFormData({ ...formData, acces_indicateur: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Tableau de bord" type="select" value={formData.acces_tb || 'Non'} onChange={(v) => setFormData({ ...formData, acces_tb: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Performances" type="select" value={formData.acces_perform || 'Non'} onChange={(v) => setFormData({ ...formData, acces_perform: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                  <FormInput label="Administration" type="select" value={formData.acces_admin || 'Non'} onChange={(v) => setFormData({ ...formData, acces_admin: v })} options={[{ value: 'Non', label: 'Non' }, { value: 'Oui', label: 'Oui' }]} className="mb-0" />
                </div>
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
            <Button type="submit">{selectedItem ? 'Enregistrer' : 'Créer'}</Button>
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
