'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Activity, BarChart3, TrendingUp, PieChart, Settings, ArrowRight, AlertTriangle, CheckCircle, Clock3, ClipboardList, PencilLine } from 'lucide-react'
import { canAccessActionOccurrence, canAccessIndicatorOccurrence, canAccessRisk } from '@/lib/access-scope'

const todayDateOnly = () => {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

const parseDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const isFilled = (value) => !(value === null || value === undefined || `${value}`.trim() === '')

export default function DashboardHome() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({
    hasOpenPeriod: false,
    openPeriodLabel: '',
    pendingRisks: 0,
    pendingActions: 0,
    lateActions: 0,
    pendingIndicators: 0,
    lateIndicators: 0,
  })

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    fetchDashboardSummary()
  }, [])

  const fetchDashboardSummary = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('giras_user') || 'null')
      const [periodesRes, risquesRes, probabilitesRes, actionsOccRes, indicOccRes, indicateursRes, usersRes] = await Promise.all([
        fetch('/api/periodes?statut=Ouvert'),
        fetch('/api/risques'),
        fetch('/api/risques/probabilite'),
        fetch('/api/actions/occurrences'),
        fetch('/api/indicateurs/occurrences'),
        fetch('/api/indicateurs'),
        fetch('/api/users?statut=Actif')
      ])

      const periodes = periodesRes.ok ? ((await periodesRes.json()).periodes || []) : []
      const risques = risquesRes.ok ? ((await risquesRes.json()).risques || []) : []
      const probabilites = probabilitesRes.ok ? ((await probabilitesRes.json()).probabilites || []) : []
      const actionOccurrences = actionsOccRes.ok ? ((await actionsOccRes.json()).occurrences || []) : []
      const indicatorOccurrences = indicOccRes.ok ? ((await indicOccRes.json()).occurrences || []) : []
      const indicateurs = indicateursRes.ok ? ((await indicateursRes.json()).indicateurs || []) : []
      const users = usersRes.ok ? ((await usersRes.json()).users || []) : []

      const openPeriod = (periodes || [])[0] || null
      const openPeriodLabel = openPeriod?.periode || openPeriod?.libelle_periode || openPeriod?.libelle || ''
      const activeRisks = (risques || []).filter((r) => r && r.statut !== 'Inactif' && r.archive !== true && canAccessRisk(storedUser, r))
      const probByRiskAndPeriod = new Set(
        (probabilites || [])
          .filter((p) => p && p.archive !== true && isFilled(p.probabilite))
          .map((p) => `${String(p.code_risque || '').trim()}::${String(p.periode || '').trim()}`)
      )
      const pendingRisks = openPeriodLabel
        ? activeRisks.filter((r) => !probByRiskAndPeriod.has(`${String(r.code_risque || '').trim()}::${openPeriodLabel}`)).length
        : 0

      const today = todayDateOnly()
      const pendingActionsRows = (actionOccurrences || []).filter((o) => {
        if (!o || o.archive === true || !canAccessActionOccurrence(storedUser, o, users)) return false
        const tx = Number.parseFloat(o.tx_avancement ?? 0)
        return Number.isFinite(tx) ? tx < 100 : true
      })
      const lateActions = pendingActionsRows.filter((o) => {
        const end = parseDateOnly(o.date_fin)
        return end && today > end
      }).length

      const pendingIndicatorsRows = (indicatorOccurrences || []).filter((o) => {
        if (!o || o.archive === true || !canAccessIndicatorOccurrence(storedUser, o, indicateurs, users)) return false
        return !isFilled(o.val_indicateur)
      })
      const lateIndicators = pendingIndicatorsRows.filter((o) => {
        const limit = parseDateOnly(o.date_limite_saisie || o.date_fin)
        return limit && today > limit
      }).length

      setSummary({
        hasOpenPeriod: !!openPeriod,
        openPeriodLabel,
        pendingRisks,
        pendingActions: pendingActionsRows.length,
        lateActions,
        pendingIndicators: pendingIndicatorsRows.length,
        lateIndicators,
      })
    } catch (error) {
      console.error('Erreur synthèse accueil:', error)
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
      bgLight: 'bg-red-50/80',
      iconBg: 'bg-red-600',
      borderClass: 'border-red-200 hover:border-red-300'
    },
    {
      icon: Activity,
      label: 'Suivi des Activités',
      key: 'activites',
      href: '/dashboard/activites',
      access: user?.acces_activite === 'Oui',
      gradient: 'from-[#2563eb] to-[#0891b2]',
      bgLight: 'bg-sky-50/80',
      iconBg: 'bg-sky-600',
      borderClass: 'border-sky-200 hover:border-sky-300'
    },
    {
      icon: BarChart3,
      label: 'Suivi des Indicateurs',
      key: 'indicateurs',
      href: '/dashboard/indicateurs',
      access: user?.acces_indicateur === 'Oui',
      gradient: 'from-[#7c3aed] to-[#db2777]',
      bgLight: 'bg-violet-50/80',
      iconBg: 'bg-violet-600',
      borderClass: 'border-violet-200 hover:border-violet-300'
    },
    {
      icon: TrendingUp,
      label: 'Suivi des Performances',
      key: 'performances',
      href: '/dashboard/performances',
      access: user?.acces_perform === 'Oui',
      gradient: 'from-[#059669] to-[#0d9488]',
      bgLight: 'bg-emerald-50/80',
      iconBg: 'bg-emerald-600',
      borderClass: 'border-emerald-200 hover:border-emerald-300'
    },
    {
      icon: PieChart,
      label: 'Tableau de Bord',
      key: 'tableau',
      href: '/dashboard/tableau-bord',
      access: user?.acces_tb === 'Oui',
      gradient: 'from-[#d97706] to-[#eab308]',
      bgLight: 'bg-amber-50/80',
      iconBg: 'bg-amber-600',
      borderClass: 'border-amber-200 hover:border-amber-300'
    },
    {
      icon: Settings,
      label: 'Administration',
      key: 'admin',
      href: '/dashboard/admin',
      access: user?.acces_admin === 'Oui',
      gradient: 'from-[#475569] to-[#64748b]',
      bgLight: 'bg-slate-50/80',
      iconBg: 'bg-slate-600',
      borderClass: 'border-slate-200 hover:border-slate-300'
    }
  ]

  if (!user) return null

  const synthesisCards = [
    {
      key: 'risques',
      icon: AlertTriangle,
      accent: summary.pendingRisks > 0 ? 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50' : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50',
      iconBg: summary.pendingRisks > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600',
      title: 'Évaluation des risques',
      message: !summary.hasOpenPeriod
        ? "Aucun risque en attente d’évaluation"
        : summary.pendingRisks > 0
          ? `${summary.pendingRisks} risques sont en attentes d’évaluation. Prière les évaluer Svp`
          : "Aucun risque en attente d’évaluation",
      buttonLabel: 'Voir les risques',
      showButton: summary.hasOpenPeriod && summary.pendingRisks > 0,
      onClick: () => router.push('/dashboard/risques?tab=analyse&typeEvaluation=Non%20%C3%A9valu%C3%A9')
    },
    {
      key: 'actions',
      icon: ClipboardList,
      accent: summary.pendingActions > 0 ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50' : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50',
      iconBg: summary.pendingActions > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600',
      title: 'Réalisation des actions',
      message: `${summary.pendingActions} actions sont en attentes de réalisation, dont ${summary.lateActions} en retard`,
      buttonLabel: 'Voir les actions',
      showButton: summary.pendingActions > 0,
      onClick: () => router.push('/dashboard/activites?tab=suivi&pending=1')
    },
    {
      key: 'indicateurs',
      icon: PencilLine,
      accent: summary.pendingIndicators > 0 ? 'border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50' : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50',
      iconBg: summary.pendingIndicators > 0 ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-600',
      title: 'Saisie des indicateurs',
      message: `${summary.pendingIndicators} indicateurs sont en attentes de saisie, dont ${summary.lateIndicators} en retard`,
      buttonLabel: 'Voir les indicateurs',
      showButton: summary.pendingIndicators > 0,
      onClick: () => router.push('/dashboard/indicateurs?tab=suivi')
    }
  ]

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-br from-gray-50 via-white to-blue-50/30 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
          {synthesisCards.map((card) => (
            <div key={card.key} className={`rounded-2xl border shadow-sm px-4 py-3 lg:px-4 lg:py-3.5 ${card.accent}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${card.iconBg}`}>
                  <card.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-[13px] lg:text-sm font-semibold text-gray-800">{card.title}</p>
                    {card.key === 'risques' && summary.hasOpenPeriod && summary.openPeriodLabel && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 text-[10px] font-medium text-gray-600 border border-white/70">
                        <Clock3 size={11} />
                        {summary.openPeriodLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs lg:text-[13px] text-gray-700 leading-snug">{loading ? 'Chargement des synthèses...' : card.message}</p>
                  {card.showButton && !loading && (
                    <button
                      onClick={card.onClick}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#1a365d] hover:bg-[#15304f] transition-colors shadow-sm"
                    >
                      {card.buttonLabel}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => item.access && router.push(item.href)}
              disabled={!item.access}
              className={`relative overflow-hidden rounded-2xl p-4 lg:p-5 text-left transition-all duration-300 group shadow-sm ${
                item.access
                  ? `${item.bgLight} ${item.borderClass} hover:shadow-lg hover:-translate-y-0.5 cursor-pointer border-2 bg-white/90 backdrop-blur-sm`
                  : 'bg-gray-100 cursor-not-allowed opacity-40 border-2 border-gray-200'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.05] group-hover:opacity-[0.10] transition-opacity duration-300`} />
              <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${item.gradient} opacity-80`} />
              <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${item.iconBg} flex items-center justify-center mb-3 shadow-md group-hover:scale-105 group-hover:shadow-lg transition-all duration-300 ring-4 ring-white/60`}>
                <item.icon size={20} className="text-white lg:w-6 lg:h-6" />
              </div>
              <h3 className="text-sm lg:text-base font-semibold text-gray-800 group-hover:text-gray-900 transition-colors leading-tight pr-8">
                {item.label}
              </h3>
              <ArrowRight
                size={16}
                className="absolute bottom-4 right-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all opacity-70 group-hover:opacity-100"
              />
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
