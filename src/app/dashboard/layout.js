'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Home, Shield, Activity, BarChart3, TrendingUp, PieChart, Settings, ChevronDown, LogOut, User, Menu, X } from 'lucide-react'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [flashMessage, setFlashMessage] = useState('')

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (!storedUser) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(storedUser))
    fetchFlashMessages()
  }, [router])

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

  const handleLogout = () => {
    localStorage.removeItem('giras_user')
    router.push('/login')
  }

  const navItems = [
    { key: 'accueil', label: 'Accueil', icon: Home, href: '/dashboard', access: true },
    { key: 'risques', label: 'Gestion des Risques', icon: Shield, href: '/dashboard/risques', access: user?.acces_risque === 'Oui' },
    { key: 'activites', label: 'Suivi des Activités', icon: Activity, href: '/dashboard/activites', access: user?.acces_activite === 'Oui' },
    { key: 'indicateurs', label: 'Suivi des Indicateurs', icon: BarChart3, href: '/dashboard/indicateurs', access: user?.acces_indicateur === 'Oui' },
    { key: 'performances', label: 'Suivi des Performances', icon: TrendingUp, href: '/dashboard/performances', access: user?.acces_perform === 'Oui' },
    { key: 'tableau', label: 'Tableau de Bord', icon: PieChart, href: '/dashboard/tableau-bord', access: user?.acces_tb === 'Oui' },
    { key: 'admin', label: 'Administration', icon: Settings, href: '/dashboard/admin', access: user?.acces_admin === 'Oui' },
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
        <nav className="hidden lg:block h-9 px-4 bg-gradient-to-r from-[#1a365d] via-[#234876] to-[#1a365d] overflow-x-auto">
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
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
