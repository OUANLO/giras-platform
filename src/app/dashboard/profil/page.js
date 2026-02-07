'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Building2, Lock, Save, AlertCircle } from 'lucide-react'
import { Button, FormInput } from '@/components/ui'

export default function ProfilPage() {
  const [user, setUser] = useState(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Mot de passe modifié avec succès' })
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors du changement de mot de passe' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur de connexion au serveur' })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-gray-500 mt-1">Gérez vos informations personnelles et votre mot de passe</p>
      </div>

      {/* Informations utilisateur */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <User className="text-blue-600" size={20} />
          Informations personnelles
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Nom</label>
            <p className="text-lg font-medium text-gray-900">{user.nom}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Prénoms</label>
            <p className="text-lg font-medium text-gray-900">{user.prenoms}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Mail size={14} />
              Email
            </label>
            <p className="text-lg text-gray-900">{user.username}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500 flex items-center gap-1">
              <Building2 size={14} />
              Structure
            </label>
            <p className="text-lg text-gray-900">{user.code_structure || '-'}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Poste</label>
            <p className="text-lg text-gray-900">{user.poste || '-'}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Type d'utilisateur</label>
            <p className="text-lg">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {user.type_utilisateur}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Changement de mot de passe */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Lock className="text-blue-600" size={20} />
          Changer le mot de passe
        </h2>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            <AlertCircle size={18} />
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <FormInput
            label="Mot de passe actuel"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(v) => setPasswordForm({ ...passwordForm, currentPassword: v })}
            required
            placeholder="••••••••"
          />
          <FormInput
            label="Nouveau mot de passe"
            type="password"
            value={passwordForm.newPassword}
            onChange={(v) => setPasswordForm({ ...passwordForm, newPassword: v })}
            required
            placeholder="••••••••"
            helperText="Minimum 8 caractères"
          />
          <FormInput
            label="Confirmer le nouveau mot de passe"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(v) => setPasswordForm({ ...passwordForm, confirmPassword: v })}
            required
            placeholder="••••••••"
          />
          <div className="pt-4">
            <Button type="submit" icon={Save} loading={loading}>
              Enregistrer le nouveau mot de passe
            </Button>
          </div>
        </form>
      </div>

      {/* Droits d'accès */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Droits d'accès</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Gestion des risques', key: 'acces_risque' },
            { label: 'Suivi des activités', key: 'acces_activite' },
            { label: 'Suivi des indicateurs', key: 'acces_indicateur' },
            { label: 'Tableau de bord', key: 'acces_tb' },
            { label: 'Suivi des performances', key: 'acces_perform' },
            { label: 'Administration', key: 'acces_admin' }
          ].map(item => (
            <div key={item.key} className={`p-3 rounded-lg border ${
              user[item.key] === 'Oui' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <span className={`text-sm font-medium ${
                user[item.key] === 'Oui' ? 'text-green-700' : 'text-gray-500'
              }`}>
                {user[item.key] === 'Oui' ? '✓' : '✗'} {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
