'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Search, AlertCircle } from 'lucide-react'
import { AlertModal } from '@/components/ui'

// Composant pour afficher un pourcentage avec code couleur
const PercentageCell = ({ value, notApplicable }) => {
  if (notApplicable) {
    return <span className="text-gray-400 text-xs">N/A</span>
  }
  
  const numValue = parseFloat(value) || 0
  let bgColor = 'bg-red-100 text-red-700'
  if (numValue >= 80) bgColor = 'bg-green-100 text-green-700'
  else if (numValue >= 60) bgColor = 'bg-blue-100 text-blue-700'
  else if (numValue >= 40) bgColor = 'bg-yellow-100 text-yellow-700'
  else if (numValue >= 20) bgColor = 'bg-orange-100 text-orange-700'

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>
      {numValue.toFixed(1)}%
    </span>
  )
}

export default function PerformancesPage() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [structures, setStructures] = useState([])
  const [actions, setActions] = useState([])
  const [indicateurs, setIndicateurs] = useState([])
  const [performanceData, setPerformanceData] = useState([])
  
  // État pour AlertModal unifié
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => { if (alertModal.onConfirm) alertModal.onConfirm(); setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null }) }
  
  // Filtres
  const [filters, setFilters] = useState({
    structure: '',
    utilisateur: '',
    recherche: '',
    dateDebut: '',
    dateFin: ''
  })

  // Initialiser les dates par défaut (dernière année)
  useEffect(() => {
    const now = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(now.getFullYear() - 1)
    
    setFilters(prev => ({
      ...prev,
      dateDebut: oneYearAgo.toISOString().split('T')[0],
      dateFin: now.toISOString().split('T')[0]
    }))
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (users.length > 0) {
      calculatePerformances()
    }
  }, [users, actions, indicateurs, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, structRes, actionsRes, indRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/structures?statut=Actif'),
        fetch('/api/taches'),
        fetch('/api/indicateurs?withOccurrences=true')
      ])

      if (usersRes.ok) setUsers((await usersRes.json()).users || [])
      if (structRes.ok) setStructures((await structRes.json()).structures || [])
      if (actionsRes.ok) setActions((await actionsRes.json()).taches || [])
      if (indRes.ok) setIndicateurs((await indRes.json()).indicateurs || [])
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePerformances = () => {
    const dateDebut = filters.dateDebut ? new Date(filters.dateDebut) : null
    const dateFin = filters.dateFin ? new Date(filters.dateFin) : null

    // Filtrer les actions par période
    let filteredActions = actions.filter(a => a.statut === 'Actif')
    if (dateDebut) filteredActions = filteredActions.filter(a => !a.date_echeance || new Date(a.date_echeance) >= dateDebut)
    if (dateFin) filteredActions = filteredActions.filter(a => !a.date_echeance || new Date(a.date_echeance) <= dateFin)

    // Filtrer les indicateurs par période
    let filteredIndicateurs = indicateurs.filter(i => i.statut === 'Actif')

    // Calculer les stats par structure (pour Atteinte_cible)
    const structureStats = {}
    filteredIndicateurs.forEach(ind => {
      const struct = ind.code_structure || 'N/A'
      if (!structureStats[struct]) structureStats[struct] = { total: 0, ciblesAtteintes: 0 }
      structureStats[struct].total++
      
      const val = parseFloat(ind.occurrence?.val_indicateur)
      const cible = parseFloat(ind.cible)
      if (!isNaN(val) && !isNaN(cible)) {
        if ((ind.sens === 'Positif' && val >= cible) || (ind.sens === 'Négatif' && val <= cible)) {
          structureStats[struct].ciblesAtteintes++
        }
      }
    })

    // Calculer les performances par utilisateur
    const performances = users.map(user => {
      const username = user.username

      // Actions où l'utilisateur est responsable
      const userActions = filteredActions.filter(a => a.responsable === username)
      const totalActions = userActions.length
      const actionsRealisees = userActions.filter(a => a.niv_avancement === '100%' || a.niv_avancement === 'Terminé').length
      const actionsRealiseesDelai = userActions.filter(a => {
        if (a.niv_avancement !== '100%' && a.niv_avancement !== 'Terminé') return false
        if (!a.date_realisation || !a.date_echeance) return false
        return new Date(a.date_realisation) <= new Date(a.date_echeance)
      }).length

      // Tx réalisation actions
      const txRealisationAction = totalActions > 0 ? (actionsRealisees / totalActions) * 100 : null

      // Tx réalisation actions dans délai
      const txRealisationActionDelai = totalActions > 0 ? (actionsRealiseesDelai / totalActions) * 100 : null

      // Indicateurs où l'utilisateur est responsable
      const userIndicateurs = filteredIndicateurs.filter(i => i.responsable === username)
      const totalIndicateurs = userIndicateurs.length
      const indicateursRenseignes = userIndicateurs.filter(i => 
        i.occurrence?.val_indicateur !== null && i.occurrence?.val_indicateur !== undefined && i.occurrence?.val_indicateur !== ''
      ).length
      
      // Pour le délai, on considère qu'un indicateur est renseigné dans le délai si date_saisie existe
      // et correspond à la période (simplifié car pas de date limite explicite)
      const indicateursRenseignesDelai = userIndicateurs.filter(i => {
        if (i.occurrence?.val_indicateur === null || i.occurrence?.val_indicateur === undefined) return false
        // Considérer comme dans le délai si renseigné (pas de retard spécifié)
        return i.occurrence?.retard2 !== 'Retard'
      }).length

      // Renseigne indicateurs
      const renseigneIndic = totalIndicateurs > 0 ? (indicateursRenseignes / totalIndicateurs) * 100 : null

      // Renseigne indicateurs dans délai
      const renseigneIndicDelai = totalIndicateurs > 0 ? (indicateursRenseignesDelai / totalIndicateurs) * 100 : null

      // Atteinte cible (par structure)
      const userStruct = user.code_structure || 'N/A'
      const structStats = structureStats[userStruct] || { total: 0, ciblesAtteintes: 0 }
      const atteinteCible = structStats.total > 0 ? (structStats.ciblesAtteintes / structStats.total) * 100 : null

      // Score collaborateur (pour les managers)
      const isManager = user.type_utilisateur === 'Manager' || user.type_utilisateur === 'Super manager'
      let scoreCollaborateur = null
      
      if (isManager) {
        // Trouver les utilisateurs dont ce manager est le supérieur
        const subordinates = users.filter(u => u.superieur === username)
        if (subordinates.length > 0) {
          // On va calculer récursivement (mais sans scoreCollaborateur pour éviter la récursion infinie)
          const subScores = subordinates.map(sub => {
            const subActions = filteredActions.filter(a => a.responsable === sub.username)
            const subTotalAct = subActions.length
            const subActReal = subActions.filter(a => a.niv_avancement === '100%' || a.niv_avancement === 'Terminé').length
            const subActRealDelai = subActions.filter(a => {
              if (a.niv_avancement !== '100%' && a.niv_avancement !== 'Terminé') return false
              if (!a.date_realisation || !a.date_echeance) return false
              return new Date(a.date_realisation) <= new Date(a.date_echeance)
            }).length

            const subIndicateurs = filteredIndicateurs.filter(i => i.responsable === sub.username)
            const subTotalInd = subIndicateurs.length
            const subIndRens = subIndicateurs.filter(i => i.occurrence?.val_indicateur !== null && i.occurrence?.val_indicateur !== undefined).length
            const subIndRensDelai = subIndicateurs.filter(i => i.occurrence?.val_indicateur !== null && i.occurrence?.retard2 !== 'Retard').length

            const subStruct = sub.code_structure || 'N/A'
            const subStructStats = structureStats[subStruct] || { total: 0, ciblesAtteintes: 0 }

            const scores = []
            if (subTotalAct > 0) {
              scores.push((subActReal / subTotalAct) * 100)
              scores.push((subActRealDelai / subTotalAct) * 100)
            }
            if (subTotalInd > 0) {
              scores.push((subIndRens / subTotalInd) * 100)
              scores.push((subIndRensDelai / subTotalInd) * 100)
            }
            if (subStructStats.total > 0) {
              scores.push((subStructStats.ciblesAtteintes / subStructStats.total) * 100)
            }

            return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
          }).filter(s => s !== null)

          if (subScores.length > 0) {
            scoreCollaborateur = subScores.reduce((a, b) => a + b, 0) / subScores.length
          }
        }
      }

      // Score performance global
      const allScores = []
      if (txRealisationAction !== null) allScores.push(txRealisationAction)
      if (txRealisationActionDelai !== null) allScores.push(txRealisationActionDelai)
      if (renseigneIndic !== null) allScores.push(renseigneIndic)
      if (renseigneIndicDelai !== null) allScores.push(renseigneIndicDelai)
      if (atteinteCible !== null) allScores.push(atteinteCible)
      if (scoreCollaborateur !== null) allScores.push(scoreCollaborateur)

      const scorePerformance = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0

      return {
        ...user,
        txRealisationAction,
        txRealisationActionDelai,
        renseigneIndic,
        renseigneIndicDelai,
        atteinteCible,
        scoreCollaborateur,
        scorePerformance,
        totalActions,
        totalIndicateurs,
        isManager
      }
    })

    // Trier par score de performance décroissant
    performances.sort((a, b) => b.scorePerformance - a.scorePerformance)

    setPerformanceData(performances)
  }

  // Appliquer les filtres
  const getFilteredData = () => {
    let filtered = performanceData

    if (filters.structure) {
      filtered = filtered.filter(u => u.code_structure === filters.structure)
    }
    if (filters.utilisateur) {
      filtered = filtered.filter(u => u.username === filters.utilisateur)
    }
    if (filters.recherche) {
      const s = filters.recherche.toLowerCase()
      filtered = filtered.filter(u => 
        u.nom?.toLowerCase().includes(s) || 
        u.prenoms?.toLowerCase().includes(s) || 
        u.email?.toLowerCase().includes(s)
      )
    }

    return filtered
  }

  // Vérifier que la période ne dépasse pas 1 an
  const validatePeriod = (debut, fin) => {
    if (!debut || !fin) return true
    const d1 = new Date(debut)
    const d2 = new Date(fin)
    const diffDays = Math.abs((d2 - d1) / (1000 * 60 * 60 * 24))
    return diffDays <= 366
  }

  const handleDateChange = (field, value) => {
    const newFilters = { ...filters, [field]: value }
    
    if (field === 'dateDebut' && newFilters.dateFin) {
      if (!validatePeriod(value, newFilters.dateFin)) {
        showAlert('warning', 'La période ne peut pas excéder un an.')
        return
      }
    }
    if (field === 'dateFin' && newFilters.dateDebut) {
      if (!validatePeriod(newFilters.dateDebut, value)) {
        showAlert('warning', 'La période ne peut pas excéder un an.')
        return
      }
    }
    
    setFilters(newFilters)
  }

  const filteredData = getFilteredData()

  return (
    <div className="p-6 bg-gray-50 min-h-[calc(100vh-140px)]">
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Suivi des performances</h1>
            <p className="text-sm text-gray-500">Tableau de bord des performances individuelles</p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[120px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Structure</label>
            <select 
              value={filters.structure} 
              onChange={e => setFilters({...filters, structure: e.target.value})} 
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
            >
              <option value="">Toutes</option>
              {structures.map(s => (
                <option key={s.code_structure} value={s.code_structure}>{s.code_structure}</option>
              ))}
            </select>
          </div>
          <div className="w-[150px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Utilisateur</label>
            <select 
              value={filters.utilisateur} 
              onChange={e => setFilters({...filters, utilisateur: e.target.value})} 
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
            >
              <option value="">Tous</option>
              {users.map(u => (
                <option key={u.username} value={u.username}>{u.nom} {u.prenoms}</option>
              ))}
            </select>
          </div>
          <div className="w-[120px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Date début</label>
            <input 
              type="date" 
              value={filters.dateDebut} 
              onChange={e => handleDateChange('dateDebut', e.target.value)} 
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
            />
          </div>
          <div className="w-[120px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Date fin</label>
            <input 
              type="date" 
              value={filters.dateFin} 
              onChange={e => handleDateChange('dateFin', e.target.value)} 
              className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Recherche</label>
            <div className="relative">
              <input 
                type="text" 
                value={filters.recherche} 
                onChange={e => setFilters({...filters, recherche: e.target.value})} 
                placeholder="Nom, prénom, email..." 
                className="w-full px-2 py-1.5 pr-8 rounded border border-gray-200 text-xs"
              />
              <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <button 
            onClick={() => setFilters({ structure: '', utilisateur: '', recherche: '', dateDebut: filters.dateDebut, dateFin: filters.dateFin })}
            className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded border border-gray-200"
          >
            Reset
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <AlertCircle size={12} className="text-amber-500" />
          <span className="text-[10px] text-amber-600">La période de calcul ne peut pas excéder un an.</span>
        </div>
      </div>

      {/* Tableau des performances */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left text-white">Nom</th>
                <th className="px-2 py-2 text-left text-white">Prénom</th>
                <th className="px-2 py-2 text-left text-white">Email</th>
                <th className="px-2 py-2 text-center text-white">Structure</th>
                <th className="px-2 py-2 text-center text-white">
                  <div className="text-[9px] leading-tight">Tx réalisation<br/>action</div>
                </th>
                <th className="px-2 py-2 text-center text-white">
                  <div className="text-[9px] leading-tight">Tx réalisation<br/>action délai</div>
                </th>
                <th className="px-2 py-2 text-center text-white">
                  <div className="text-[9px] leading-tight">Renseigne<br/>indic</div>
                </th>
                <th className="px-2 py-2 text-center text-white">
                  <div className="text-[9px] leading-tight">Renseigne<br/>indic délai</div>
                </th>
                <th className="px-2 py-2 text-center text-white">
                  <div className="text-[9px] leading-tight">Atteinte<br/>cible</div>
                </th>
                <th className="px-2 py-2 text-center text-white">
                  <div className="text-[9px] leading-tight">Score<br/>collaborateur</div>
                </th>
                <th className="px-2 py-2 text-center text-white bg-indigo-700">
                  <div className="text-[9px] leading-tight">Score<br/>performance</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      Chargement...
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                filteredData.map((user, idx) => (
                  <tr key={user.id || user.username} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-medium text-gray-900">{user.nom}</td>
                    <td className="px-2 py-1.5 text-gray-700">{user.prenoms}</td>
                    <td className="px-2 py-1.5 text-gray-600">{user.email}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-mono">{user.code_structure || '-'}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <PercentageCell value={user.txRealisationAction} notApplicable={user.totalActions === 0} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <PercentageCell value={user.txRealisationActionDelai} notApplicable={user.totalActions === 0} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <PercentageCell value={user.renseigneIndic} notApplicable={user.totalIndicateurs === 0} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <PercentageCell value={user.renseigneIndicDelai} notApplicable={user.totalIndicateurs === 0} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <PercentageCell value={user.atteinteCible} notApplicable={user.atteinteCible === null} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <PercentageCell value={user.scoreCollaborateur} notApplicable={!user.isManager || user.scoreCollaborateur === null} />
                    </td>
                    <td className="px-2 py-1.5 text-center bg-indigo-50">
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                        user.scorePerformance >= 80 ? 'bg-green-500 text-white' :
                        user.scorePerformance >= 60 ? 'bg-blue-500 text-white' :
                        user.scorePerformance >= 40 ? 'bg-yellow-500 text-white' :
                        user.scorePerformance >= 20 ? 'bg-orange-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {user.scorePerformance.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer avec statistiques */}
        {!loading && filteredData.length > 0 && (
          <div className="px-2 py-1.5 bg-gray-50 border-t text-[10px] text-gray-500 flex items-center justify-between">
            <span>Total: {filteredData.length}</span>
            <span>
              Score moyen: <strong className="text-gray-700">
                {(filteredData.reduce((a, b) => a + b.scorePerformance, 0) / filteredData.length).toFixed(1)}%
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Légende des couleurs */}
      <div className="mt-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Légende des couleurs</h4>
        <div className="flex flex-wrap gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-green-100"></span>
            <span>≥ 80% (Excellent)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-blue-100"></span>
            <span>60-79% (Bon)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-yellow-100"></span>
            <span>40-59% (Moyen)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-orange-100"></span>
            <span>20-39% (Faible)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-red-100"></span>
            <span>&lt; 20% (Critique)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">N/A</span>
            <span>= Non applicable</span>
          </div>
        </div>
      </div>

      {/* AlertModal unifié pour tous les messages */}
      <AlertModal 
        isOpen={alertModal.isOpen} 
        onClose={closeAlert} 
        type={alertModal.type}
        message={alertModal.message} 
      />
    </div>
  )
}
