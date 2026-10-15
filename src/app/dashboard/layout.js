'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Home, Shield, Activity, BarChart3, TrendingUp, PieChart, Settings, HelpCircle, ChevronDown, LogOut, User, Menu, X, Bell, TriangleAlert, ExternalLink, FileText, Info } from 'lucide-react'
import { canAccessAdministration as hasAdministrationAccess } from '@/lib/roles'
import { canAccessActionOccurrence, canAccessIndicatorOccurrence, canAccessRisk } from '@/lib/access-scope'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [flashMessage, setFlashMessage] = useState('')
  const [alertSummary, setAlertSummary] = useState({
    pendingRisks: 0,
    lateRisks: 0,
    pendingActions: 0,
    lateActions: 0,
    pendingIndicators: 0,
    lateIndicators: 0,
  })
  const [showAlertsMenu, setShowAlertsMenu] = useState(false)
  const alertsCloseTimerRef = useRef(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (!storedUser) {
      router.push('/login')
      return
    }
    const parsedUser = JSON.parse(storedUser)
    setUser(parsedUser)
    fetchFlashMessages()
    fetchAlertSummary(parsedUser)
  }, [router])


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

const normalizePeriodLabel = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[_/]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const buildPeriodAliases = (period) => {
  if (!period) return []
  const aliases = new Set()
  const year = String(period.annee || '').trim()
  const semestre = String(period.semestre || '').trim()
  const trimestre = String(period.trimestre || '').trim()
  const moisNum = Number(period.mois) || 0
  ;[period.periode, period.libelle_periode, period.libelle].filter(Boolean).forEach((value) => aliases.add(normalizePeriodLabel(value)))
  if (year) aliases.add(normalizePeriodLabel(year))
  if (year && semestre) { aliases.add(normalizePeriodLabel(`S${semestre}-${year}`)); aliases.add(normalizePeriodLabel(`Semestre ${semestre} ${year}`)) }
  if (year && trimestre) { aliases.add(normalizePeriodLabel(`T${trimestre}-${year}`)); aliases.add(normalizePeriodLabel(`Trimestre ${trimestre} ${year}`)) }
  if (year && moisNum) { const mm = String(moisNum).padStart(2, '0'); aliases.add(normalizePeriodLabel(`${mm}-${year}`)) }
  return [...aliases].filter(Boolean)
}

const getRiskProbabilityValue = (risk, periodAliases, indicatorOccurrences, probabilities, indicateurs = []) => {
  const aliases = Array.from(periodAliases || []).map((value) => normalizePeriodLabel(value)).filter(Boolean)
  if (!risk || aliases.length === 0) return null

  const probRows = (probabilities || []).filter((row) => row && row.archive !== true && String(row.code_risque || '').trim() === String(risk.code_risque || '').trim())
  const manualProb = probRows.find((row) => aliases.includes(normalizePeriodLabel(row.periode)))
  if (manualProb && isFilled(manualProb.probabilite)) return Number(manualProb.probabilite)

  const isQualitatif = risk.qualitatif === 'Oui' || !risk.code_indicateur
  if (isQualitatif) return null

  const occ = (indicatorOccurrences || []).find((row) => row && row.archive !== true && String(row.code_indicateur || '').trim() === String(risk.code_indicateur || '').trim() && aliases.includes(normalizePeriodLabel(row.periode)))
  const rawValue = occ?.val_indicateur
  if (!isFilled(rawValue)) return null

  const value = Number(rawValue)
  if (!Number.isFinite(value)) return null
  const indicateurRef = risk?.indicateur || (indicateurs || []).find((item) => String(item?.code_indicateur || '').trim() === String(risk?.code_indicateur || '').trim()) || null
  const seuil1 = Number(indicateurRef?.seuil1 ?? indicateurRef?.seuil_1)
  const seuil2 = Number(indicateurRef?.seuil2 ?? indicateurRef?.seuil_2)
  const seuil3 = Number(indicateurRef?.seuil3 ?? indicateurRef?.seuil_3)
  const sens = String(indicateurRef?.sens || '').toLowerCase()
  if (![seuil1, seuil2, seuil3].every(Number.isFinite)) return null

  if (sens.includes('neg')) {
    if (value < seuil1) return 1
    if (value < seuil2) return 2
    if (value < seuil3) return 3
    return 4
  }

  if (value > seuil3) return 1
  if (value > seuil2) return 2
  if (value > seuil1) return 3
  return 4
}


  const fetchAlertSummary = async (currentUser) => {
    try {
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
      const openPeriodAliases = new Set(buildPeriodAliases(openPeriod))
      const today = todayDateOnly()

      const activeRisks = (risques || []).filter((r) => r && r.statut !== 'Inactif' && r.archive !== true && canAccessRisk(currentUser, r))
      const pendingRisksRows = openPeriodAliases.size
        ? activeRisks.filter((r) => !isFilled(getRiskProbabilityValue(r, openPeriodAliases, indicatorOccurrences, probabilites, indicateurs)))
        : []
      const periodLimit = parseDateOnly(openPeriod?.date_limite_saisie)
      const lateRisks = pendingRisksRows.filter(() => periodLimit && today > periodLimit).length

      const pendingActionsRows = (actionOccurrences || []).filter((o) => {
        if (!o || o.archive === true || !canAccessActionOccurrence(currentUser, o, users)) return false
        const tx = Number.parseFloat(o.tx_avancement ?? 0)
        return Number.isFinite(tx) ? tx < 100 : true
      })
      const lateActions = pendingActionsRows.filter((o) => {
        const end = parseDateOnly(o.date_fin)
        return end && today > end
      }).length

      const pendingIndicatorsRows = (indicatorOccurrences || []).filter((o) => {
        if (!o || o.archive === true || !canAccessIndicatorOccurrence(currentUser, o, indicateurs, users)) return false
        return !isFilled(o.val_indicateur)
      })
      const lateIndicators = pendingIndicatorsRows.filter((o) => {
        const limit = parseDateOnly(o.date_limite_saisie || o.date_fin)
        return limit && today > limit
      }).length

      setAlertSummary({
        pendingRisks: pendingRisksRows.length,
        lateRisks,
        pendingActions: pendingActionsRows.length,
        lateActions,
        pendingIndicators: pendingIndicatorsRows.length,
        lateIndicators,
      })
    } catch (error) {
      console.error('Erreur alertes en-tête:', error)
    }
  }

  const fetchFlashMessages = async () => {
    try {
      const response = await fetch('/api/flash')
      if (response.ok) {
        const data = await response.json()
        if (data.messages?.length > 0) {
          setFlashMessage(data.messages.map(m => m.info).join(' • '))
        }
      }
    } catch (error) {
      console.error('Erreur flash:', error)
    }
  }

  const handleLogout = async () => {
    const storedUserRaw = localStorage.getItem('giras_user')
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null

    try {
      const payload = {
        email: storedUser?.username || '',
        type_utilisateur: storedUser?.type_utilisateur || '',
        id: storedUser?.id || null
      }

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        keepalive: true,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(storedUser?.username ? { 'x-user-email': storedUser.username } : {}),
          ...(storedUser?.type_utilisateur ? { 'x-user-type': storedUser.type_utilisateur } : {}),
          ...(storedUser?.id ? { 'x-user-id': String(storedUser.id) } : {})
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.error('Erreur logout HTTP:', response.status)
      }
    } catch (error) {
      console.error('Erreur logout:', error)
      try {
        const storedEmail = encodeURIComponent(storedUser?.username || '')
        const storedType = encodeURIComponent(storedUser?.type_utilisateur || '')
        const storedId = encodeURIComponent(storedUser?.id || '')
        await fetch(`/api/auth/logout?email=${storedEmail}&type=${storedType}&id=${storedId}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store'
        })
      } catch (fallbackError) {
        console.error('Erreur logout fallback:', fallbackError)
      }
    }

    localStorage.removeItem('giras_user')
    router.push('/login')
  }


  useEffect(() => {
    return () => {
      if (alertsCloseTimerRef.current) clearTimeout(alertsCloseTimerRef.current)
    }
  }, [])

  const openAlertsMenu = () => {
    if (alertsCloseTimerRef.current) {
      clearTimeout(alertsCloseTimerRef.current)
      alertsCloseTimerRef.current = null
    }
    if (totalLateAlerts > 0) setShowAlertsMenu(true)
  }

  const scheduleCloseAlertsMenu = () => {
    if (alertsCloseTimerRef.current) clearTimeout(alertsCloseTimerRef.current)
    alertsCloseTimerRef.current = setTimeout(() => {
      setShowAlertsMenu(false)
      alertsCloseTimerRef.current = null
    }, 220)
  }

  const toggleAlertsMenu = () => {
    if (alertsCloseTimerRef.current) {
      clearTimeout(alertsCloseTimerRef.current)
      alertsCloseTimerRef.current = null
    }
    if (totalLateAlerts > 0) setShowAlertsMenu((v) => !v)
  }

  const canAccessAdministration = hasAdministrationAccess(user)

  const totalLateAlerts = useMemo(
    () => (alertSummary.lateRisks || 0) + (alertSummary.lateActions || 0) + (alertSummary.lateIndicators || 0),
    [alertSummary]
  )

  const alertItems = [
    {
      key: 'risques',
      pending: alertSummary.pendingRisks,
      late: alertSummary.lateRisks,
      label: `${alertSummary.pendingRisks} risques sont en attente d'évaluation, ${alertSummary.lateRisks} sont en retard.`,
      href: '/dashboard/risques?tab=analyse&typeEvaluation=Non%20%C3%A9valu%C3%A9',
      access: user?.acces_risque === 'Oui',
    },
    {
      key: 'actions',
      pending: alertSummary.pendingActions,
      late: alertSummary.lateActions,
      label: `${alertSummary.pendingActions} actions sont en attente de réalisation, dont ${alertSummary.lateActions} en retard.`,
      href: '/dashboard/activites?tab=suivi&pending=1',
      access: user?.acces_activite === 'Oui',
    },
    {
      key: 'indicateurs',
      pending: alertSummary.pendingIndicators,
      late: alertSummary.lateIndicators,
      label: `${alertSummary.pendingIndicators} indicateurs sont en attente de saisie, dont ${alertSummary.lateIndicators} en retard.`,
      href: '/dashboard/indicateurs?tab=suivi',
      access: user?.acces_indicateur === 'Oui',
    }
  ].filter((item) => item.pending > 0)

  const navItems = [
    { key: 'accueil', label: 'Accueil', icon: Home, href: '/dashboard', access: true },
    { key: 'risques', label: 'Gestion des Risques', icon: Shield, href: '/dashboard/risques', access: user?.acces_risque === 'Oui' },
    { key: 'activites', label: 'Suivi des Activités', icon: Activity, href: '/dashboard/activites', access: user?.acces_activite === 'Oui' },
    { key: 'indicateurs', label: 'Suivi des Indicateurs', icon: BarChart3, href: '/dashboard/indicateurs', access: user?.acces_indicateur === 'Oui' },
    { key: 'performances', label: 'Suivi des Performances', icon: TrendingUp, href: '/dashboard/performances', access: user?.acces_perform === 'Oui' },
    { key: 'tableau', label: 'Tableau de Bord', icon: PieChart, href: '/dashboard/tableau-bord', access: user?.acces_tb === 'Oui' },
    { key: 'rapports', label: 'Rapport', icon: FileText, href: '/dashboard/reports', access: user?.acces_tb === 'Oui' },
    { key: 'admin', label: 'Administration', icon: Settings, href: '/dashboard/admin', access: canAccessAdministration },
    { key: 'aide', label: 'Aide', icon: HelpCircle, href: '/dashboard/aide', access: true },
    { key: 'a-propos', label: 'A propos', icon: Info, href: '/dashboard/a-propos', access: true },
  ]

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-[#1a365d] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* EN-TÊTE PROFESSIONNEL */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        {/* Ligne principale */}
        <div className="h-14 px-4 lg:px-6 flex items-center justify-between border-b border-gray-100">
          {/* Logos */}
          <div className="flex items-center gap-3">
            <Image 
              src="/logo-giras.png" 
              alt="GIRAS" 
              width={120} 
              height={40}
              className="h-8 w-auto"
              priority
            />
            <div className="h-6 w-px bg-gray-300 hidden sm:block" />
            <Image 
              src="/logo-cnam.png" 
              alt="CNAM" 
              width={40} 
              height={40}
              className="h-8 w-auto hidden sm:block"
              priority
            />
          </div>

          {/* Titre central - visible sur grands écrans */}
          <div className="hidden lg:flex items-center justify-center flex-1 px-8">
            <div className="text-center">
              <span className="text-lg font-bold text-[#1a365d] tracking-wide">
                PLATEFORME DE GESTION INTÉGRÉE DES RISQUES ET DES ACTIVITÉS STRATÉGIQUES
              </span>
            </div>
          </div>

          {/* Actions utilisateur */}
          <div className="flex items-center gap-2">
            {/* Menu mobile */}
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)} 
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div
              className="relative"
              onMouseEnter={openAlertsMenu}
              onMouseLeave={scheduleCloseAlertsMenu}
            >
              <button
                type="button"
                onClick={toggleAlertsMenu}
                className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-all ${totalLateAlerts > 0 ? 'border-amber-200 bg-amber-50 text-amber-600 shadow-sm hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}
                title="Alertes"
              >
                <Bell size={18} className={totalLateAlerts > 0 ? 'animate-pulse' : ''} />
                {totalLateAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow">
                    {totalLateAlerts}
                  </span>
                )}
              </button>

              {showAlertsMenu && totalLateAlerts > 0 && (
                <div className="absolute right-0 top-full pt-2 z-30" onMouseEnter={openAlertsMenu} onMouseLeave={scheduleCloseAlertsMenu}><div className="w-[360px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 p-3">
                  <div className="flex items-center gap-2 px-1 pb-2 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                      <TriangleAlert size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Alertes de suivi</p>
                      <p className="text-[11px] text-gray-500">Retards détectés sur vos rubriques accessibles</p>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {alertItems.map((item) => (
                      <div key={item.key} className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2">
                        <div className="mt-0.5 w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] leading-5 text-gray-700">{item.label}</p>
                        </div>
                        {item.access && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAlertsMenu(false)
                              router.push(item.href)
                            }}
                            className="shrink-0 p-2 rounded-lg text-[#1a365d] hover:bg-blue-100 transition-colors"
                            title="Voir le détail"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div></div>
              )}
            </div>

            {/* Profil utilisateur */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)} 
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-[#1a365d] to-[#2c5282] rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                  {user.nom?.charAt(0)}{user.prenoms?.charAt(0)}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[11px] font-semibold text-gray-800 leading-tight">{user.nom}</p>
                  <p className="text-[9px] text-gray-500 leading-tight">{user.type_utilisateur}</p>
                </div>
                <ChevronDown size={12} className="text-gray-400 hidden sm:block" />
              </button>

              {/* Menu déroulant utilisateur */}
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-800">{user.nom} {user.prenoms}</p>
                      <p className="text-[10px] text-gray-500 truncate">{user.username}</p>
                    </div>
                    <Link 
                      href="/dashboard/profil" 
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User size={14} />
                      Mon profil
                    </Link>
                    <button 
                      onClick={handleLogout} 
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={14} />
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* MESSAGE FLASH - Hauteur réduite (x0.6) */}
        {flashMessage && (
          <div className="h-5 bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white overflow-hidden relative flex items-center">
            <div className="animate-marquee-single whitespace-nowrap inline-block">
              <span className="text-[10px] font-medium tracking-wide">⚠️ {flashMessage}</span>
            </div>
          </div>
        )}

        {/* NAVIGATION - Design professionnel avec animations */}
        <nav className="hidden lg:block h-9 px-4 bg-gradient-to-r from-[#1a365d] via-[#234876] to-[#1a365d] overflow-x-auto overflow-y-hidden no-scrollbar">
          <div className="h-full flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.access ? item.href : '#'}
                className={`h-full flex items-center gap-1.5 px-3 text-[11px] font-medium transition-all duration-300 whitespace-nowrap border-b-2 transform ${
                  isActive(item.href)
                    ? 'bg-white/15 text-white border-white scale-105'
                    : item.access
                    ? 'text-blue-100 hover:text-white hover:bg-white/10 hover:scale-110 hover:-translate-y-0.5 border-transparent'
                    : 'text-blue-300/50 cursor-not-allowed border-transparent'
                }`}
                onClick={(e) => !item.access && e.preventDefault()}
              >
                <item.icon size={14} className={`transition-transform duration-300 ${item.access ? 'group-hover:rotate-12' : ''}`} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Navigation mobile */}
        {showMobileMenu && (
          <nav className="lg:hidden bg-white border-t border-gray-100 py-1 px-2 shadow-lg">
            <div className="flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.access ? item.href : '#'}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive(item.href)
                      ? 'bg-[#1a365d] text-white'
                      : item.access
                      ? 'text-gray-700 hover:bg-gray-50'
                      : 'text-gray-400 opacity-50'
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  <item.icon size={14} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-10 md:pb-10">
        {children}
      </main>

      <footer className="shrink-0 h-8 px-3 md:px-6 bg-white border-t border-gray-200 text-[11px] text-gray-600 flex items-center justify-center text-center sticky bottom-0 z-30">
        <span>© {new Date().getFullYear()} GIRAS — Plateforme professionnelle de pilotage, de suivi et de reporting.</span>
      </footer>
    </div>
  )
}
