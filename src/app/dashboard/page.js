'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Activity, BarChart3, TrendingUp, PieChart, Settings, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react'

export default function DashboardHome() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [pendingRisks, setPendingRisks] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    fetchPendingRisks()
  }, [])

  const fetchPendingRisks = async () => {
    try {
      const response = await fetch('/api/risques/pending')
      if (response.ok) {
        const data = await response.json()
        setPendingRisks(data.count || 0)
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const menuItems = [
    { 
      icon: Shield, 
      label: 'Gestion des Risques', 
      key: 'risques', 
      href: '/dashboard/risques', 
      access: user?.acces_risque === 'Oui', 
      gradient: 'from-[#dc2626] to-[#ea580c]',
      bgLight: 'bg-red-50',
      iconBg: 'bg-red-500'
    },
    { 
      icon: Activity, 
      label: 'Suivi des Activités', 
      key: 'activites', 
      href: '/dashboard/activites', 
      access: user?.acces_activite === 'Oui', 
      gradient: 'from-[#2563eb] to-[#0891b2]',
      bgLight: 'bg-blue-50',
      iconBg: 'bg-blue-500'
    },
    { 
      icon: BarChart3, 
      label: 'Suivi des Indicateurs', 
      key: 'indicateurs', 
      href: '/dashboard/indicateurs', 
      access: user?.acces_indicateur === 'Oui', 
      gradient: 'from-[#7c3aed] to-[#db2777]',
      bgLight: 'bg-purple-50',
      iconBg: 'bg-purple-500'
    },
    { 
      icon: TrendingUp, 
      label: 'Suivi des Performances', 
      key: 'performances', 
      href: '/dashboard/performances', 
      access: user?.acces_perform === 'Oui', 
      gradient: 'from-[#059669] to-[#0d9488]',
      bgLight: 'bg-emerald-50',
      iconBg: 'bg-emerald-500'
    },
    { 
      icon: PieChart, 
      label: 'Tableau de Bord', 
      key: 'tableau', 
      href: '/dashboard/tableau-bord', 
      access: user?.acces_tb === 'Oui', 
      gradient: 'from-[#d97706] to-[#eab308]',
      bgLight: 'bg-amber-50',
      iconBg: 'bg-amber-500'
    },
    { 
      icon: Settings, 
      label: 'Administration', 
      key: 'admin', 
      href: '/dashboard/admin', 
      access: user?.acces_admin === 'Oui', 
      gradient: 'from-[#475569] to-[#64748b]',
      bgLight: 'bg-slate-50',
      iconBg: 'bg-slate-600'
    }
  ]

  if (!user) return null

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-br from-gray-50 via-white to-blue-50/30 p-4 lg:p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Cadre alerte risques en attente - EN PREMIER */}
        <div className={`rounded-xl p-3 mb-6 border shadow-sm transition-all ${
          pendingRisks > 0 
            ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' 
            : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${pendingRisks > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
              {pendingRisks > 0 ? (
                <AlertTriangle size={18} className="text-red-600" />
              ) : (
                <CheckCircle size={18} className="text-emerald-600" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${pendingRisks > 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                {pendingRisks > 0
                  ? `${pendingRisks} risque(s) en attente de quantification`
                  : 'Aucun risque en attente de quantification'
                }
              </p>
            </div>
            {pendingRisks > 0 && (
              <button
                onClick={() => router.push('/dashboard/risques')}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors flex items-center gap-1"
              >
                Évaluer
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Grille des 6 modules - Design professionnel */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => item.access && router.push(item.href)}
              disabled={!item.access}
              className={`relative overflow-hidden rounded-xl p-4 lg:p-5 text-left transition-all duration-300 group ${
                item.access
                  ? `${item.bgLight} hover:shadow-xl hover:scale-[1.02] cursor-pointer border border-transparent hover:border-gray-200`
                  : 'bg-gray-100 cursor-not-allowed opacity-40'
              }`}
            >
              {/* Effet de fond au survol */}
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-300`} />
              
              {/* Icône */}
              <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg ${item.iconBg} flex items-center justify-center mb-3 shadow-md group-hover:scale-105 group-hover:shadow-lg transition-all duration-300`}>
                <item.icon size={20} className="text-white lg:w-6 lg:h-6" />
              </div>
              
              {/* Titre */}
              <h3 className="text-sm lg:text-base font-semibold text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                {item.label}
              </h3>
              
              {/* Flèche */}
              <ArrowRight 
                size={16} 
                className="absolute bottom-4 right-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" 
              />

              {/* Badge accès refusé */}
              {!item.access && (
                <span className="absolute top-2 right-2 text-[9px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                  Accès refusé
                </span>
              )}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
