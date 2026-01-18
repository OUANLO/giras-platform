'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Target, Activity, CheckCircle, AlertTriangle, TrendingUp, Search, Maximize2, X, Clock, Users, FileText, Percent, Calendar, ListChecks, Timer } from 'lucide-react'
import { SidebarButton, Modal, Button } from '@/components/ui'

// Composant StatCard
const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600'
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

// Composant ProgressBarChart pour les barres horizontales
const ProgressBarChart = ({ data, maxValue, showExpand, onExpand, title }) => {
  const getBarColor = (item, index) => {
    if (item.color) return item.color
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
    return colors[index % colors.length]
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {showExpand && (
          <button onClick={onExpand} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Voir tout">
            <Maximize2 size={16} />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0
          return (
            <div key={index} className="group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600 truncate max-w-[150px]" title={item.label}>{item.label}</span>
                <span className="text-xs font-medium text-gray-700">{item.display || item.value}</span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                  style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: getBarColor(item, index) }}
                />
                {item.annotation && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-medium">
                    {item.annotation}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {data.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Aucune donnée</p>}
      </div>
    </div>
  )
}

export default function TableauBordPage() {
  const [activeTab, setActiveTab] = useState('indicateurs')
  const [loading, setLoading] = useState(true)
  
  // Données
  const [indicateurs, setIndicateurs] = useState([])
  const [occurrences, setOccurrences] = useState([])
  const [actions, setActions] = useState([])
  const [planActions, setPlanActions] = useState([])
  const [risques, setRisques] = useState([])
  const [risquesProbabilites, setRisquesProbabilites] = useState([])
  const [structures, setStructures] = useState([])
  const [groupes, setGroupes] = useState([])
  const [processus, setProcessus] = useState([])
  const [categories, setCategories] = useState([])
  const [periodeOuverte, setPeriodeOuverte] = useState(null)
  
  // Filtres Indicateurs
  const [indFilters, setIndFilters] = useState({
    structure: '', type_indicateur: '', sens: '', routine: '', groupe: '',
    periode: '', dateDebut: '', dateFin: '', recherche: ''
  })
  
  // Filtres Actions
  const [actFilters, setActFilters] = useState({
    structure: '', routine: '', groupe: '', dateDebut: '', dateFin: '', recherche: ''
  })
  
  // Filtres Risques - Globaux
  const [riskGlobalFilters, setRiskGlobalFilters] = useState({
    categorie: '', structure: '', qualitatif: '', processus: '', recherche: ''
  })
  
  // Filtres Risques - Bloc caractéristiques
  const [riskPeriodFilters, setRiskPeriodFilters] = useState({
    annee: '', semestre: '', trimestre: '', mois: ''
  })
  
  // Filtres Risques - Bloc plan maîtrise
  const [riskPlanFilters, setRiskPlanFilters] = useState({ dateDebut: '', dateFin: '' })
  
  // Modal expansion
  const [showExpandModal, setShowExpandModal] = useState(false)
  const [expandData, setExpandData] = useState({ title: '', data: [] })

  const subPages = [
    { key: 'indicateurs', label: 'Indicateurs', icon: BarChart3 },
    { key: 'actions', label: 'Actions', icon: Activity },
    { key: 'risques', label: 'Risques', icon: Target }
  ]

  const moisList = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  useEffect(() => {
    fetchBaseData()
  }, [])

  const fetchBaseData = async () => {
    setLoading(true)
    try {
      const [structRes, groupRes, procRes, catRes, indRes, occRes, actRes, planRes, riskRes, probRes, perRes] = await Promise.all([
        fetch('/api/structures?statut=Actif'),
        fetch('/api/groupe-indicateurs'),
        fetch('/api/processus?statut=Actif'),
        fetch('/api/categories'),
        fetch('/api/indicateurs?withOccurrences=true'),
        fetch('/api/indicateurs/occurrences'),
        fetch('/api/taches'),
        fetch('/api/plan-maitrise'),
        fetch('/api/risques'),
        fetch('/api/risques/probabilite'),
        fetch('/api/periodes?statut=Ouvert')
      ])

      if (structRes.ok) setStructures((await structRes.json()).structures || [])
      if (groupRes.ok) setGroupes((await groupRes.json()).groupes || [])
      if (procRes.ok) setProcessus((await procRes.json()).processus || [])
      if (catRes.ok) setCategories((await catRes.json()).categories || [])
      if (indRes.ok) setIndicateurs((await indRes.json()).indicateurs || [])
      if (occRes.ok) setOccurrences((await occRes.json()).occurrences || [])
      if (actRes.ok) setActions((await actRes.json()).taches || [])
      if (planRes.ok) setPlanActions((await planRes.json()).actions || [])
      if (riskRes.ok) setRisques((await riskRes.json()).risques || [])
      if (probRes.ok) setRisquesProbabilites((await probRes.json()).probabilites || [])
      
      if (perRes.ok) {
        const periodes = (await perRes.json()).periodes || []
        if (periodes.length > 0) {
          const p = periodes[0]
          setPeriodeOuverte(p)
          setRiskPeriodFilters({
            annee: p.annee?.toString() || '',
            semestre: p.semestre || '',
            trimestre: p.trimestre || '',
            mois: p.mois || ''
          })
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============ CALCULS INDICATEURS ============
  const getIndicateursStats = () => {
    let filtered = indicateurs.filter(i => i.statut === 'Actif')
    
    if (indFilters.structure) filtered = filtered.filter(i => i.code_structure === indFilters.structure)
    if (indFilters.type_indicateur) filtered = filtered.filter(i => i.type_indicateur === indFilters.type_indicateur)
    if (indFilters.sens) filtered = filtered.filter(i => i.sens === indFilters.sens)
    if (indFilters.routine) filtered = filtered.filter(i => i.routine === indFilters.routine)
    if (indFilters.groupe) filtered = filtered.filter(i => i.code_groupe === indFilters.groupe)
    if (indFilters.recherche) {
      const s = indFilters.recherche.toLowerCase()
      filtered = filtered.filter(i => i.libelle_indicateur?.toLowerCase().includes(s) || i.code_indicateur?.toString().includes(s))
    }

    const total = filtered.length
    const renseignes = filtered.filter(i => i.occurrence?.val_indicateur !== null && i.occurrence?.val_indicateur !== undefined).length
    const tauxRenseignement = total > 0 ? ((renseignes / total) * 100).toFixed(1) : 0
    
    const ciblesAtteintes = filtered.filter(i => {
      const val = parseFloat(i.occurrence?.val_indicateur)
      const cible = parseFloat(i.cible)
      if (isNaN(val) || isNaN(cible)) return false
      return (i.sens === 'Positif' && val >= cible) || (i.sens === 'Négatif' && val <= cible)
    }).length
    
    const tauxAtteinte = total > 0 ? ((ciblesAtteintes / total) * 100).toFixed(1) : 0

    // Stats par structure
    const byStructure = {}
    filtered.forEach(i => {
      const struct = i.code_structure || 'N/A'
      if (!byStructure[struct]) byStructure[struct] = { total: 0, renseignes: 0, atteintes: 0 }
      byStructure[struct].total++
      if (i.occurrence?.val_indicateur !== null && i.occurrence?.val_indicateur !== undefined) {
        byStructure[struct].renseignes++
        const val = parseFloat(i.occurrence?.val_indicateur)
        const cible = parseFloat(i.cible)
        if (!isNaN(val) && !isNaN(cible)) {
          if ((i.sens === 'Positif' && val >= cible) || (i.sens === 'Négatif' && val <= cible)) {
            byStructure[struct].atteintes++
          }
        }
      }
    })

    const renseignementParStructure = Object.entries(byStructure).map(([code, data]) => ({
      label: code,
      value: data.renseignes,
      display: `${data.renseignes}/${data.total} (${data.total > 0 ? ((data.renseignes/data.total)*100).toFixed(0) : 0}%)`,
      color: '#3B82F6'
    })).sort((a, b) => b.value - a.value).slice(0, 6)

    const atteinteParStructure = Object.entries(byStructure).map(([code, data]) => ({
      label: code,
      value: data.atteintes,
      display: `${data.atteintes}/${data.total} (${data.total > 0 ? ((data.atteintes/data.total)*100).toFixed(0) : 0}%)`,
      color: '#10B981'
    })).sort((a, b) => b.value - a.value).slice(0, 6)

    return { total, renseignes, tauxRenseignement, ciblesAtteintes, tauxAtteinte, renseignementParStructure, atteinteParStructure, byStructure }
  }

  // ============ CALCULS ACTIONS ============
  const getActionsStats = () => {
    let filtered = actions.filter(a => a.statut === 'Actif')
    
    if (actFilters.structure) filtered = filtered.filter(a => a.code_structure === actFilters.structure)
    if (actFilters.groupe) filtered = filtered.filter(a => a.code_groupe === actFilters.groupe)
    if (actFilters.dateDebut) filtered = filtered.filter(a => new Date(a.date_echeance) >= new Date(actFilters.dateDebut))
    if (actFilters.dateFin) filtered = filtered.filter(a => new Date(a.date_echeance) <= new Date(actFilters.dateFin))
    if (actFilters.recherche) {
      const s = actFilters.recherche.toLowerCase()
      filtered = filtered.filter(a => a.libelle?.toLowerCase().includes(s))
    }

    const total = filtered.length
    const realisees = filtered.filter(a => a.niv_avancement === '100%' || a.niv_avancement === 'Terminé').length
    const nonRealisees = total - realisees
    const tauxRealisation = total > 0 ? ((realisees / total) * 100).toFixed(1) : 0

    const now = new Date()
    const realiseesDelai = filtered.filter(a => {
      if (a.niv_avancement !== '100%' && a.niv_avancement !== 'Terminé') return false
      if (!a.date_realisation || !a.date_echeance) return false
      return new Date(a.date_realisation) <= new Date(a.date_echeance)
    }).length
    const tauxRealisationDelai = total > 0 ? ((realiseesDelai / total) * 100).toFixed(1) : 0

    const enRetard = filtered.filter(a => {
      if (a.niv_avancement === '100%' || a.niv_avancement === 'Terminé') return false
      return a.date_echeance && new Date(a.date_echeance) < now
    }).length

    const retards = filtered.map(a => {
      if (!a.date_echeance) return 0
      const echeance = new Date(a.date_echeance)
      if (a.date_realisation) {
        const diff = Math.floor((new Date(a.date_realisation) - echeance) / (1000 * 60 * 60 * 24))
        return diff > 0 ? diff : 0
      }
      const diff = Math.floor((now - echeance) / (1000 * 60 * 60 * 24))
      return diff > 0 ? diff : 0
    }).filter(r => r > 0)
    const retardMoyen = retards.length > 0 ? (retards.reduce((a, b) => a + b, 0) / retards.length).toFixed(1) : 0

    // Par niveau d'avancement
    const byAvancement = {}
    filtered.forEach(a => {
      const niv = a.niv_avancement || 'Non défini'
      byAvancement[niv] = (byAvancement[niv] || 0) + 1
    })
    const parAvancement = Object.entries(byAvancement).map(([label, value]) => ({ label, value }))

    // Top 4 structures en retard
    const retardParStructure = {}
    filtered.forEach(a => {
      const struct = a.code_structure || 'N/A'
      if (!retardParStructure[struct]) retardParStructure[struct] = { retard: 0, total: 0 }
      retardParStructure[struct].total++
      if (a.niv_avancement !== '100%' && a.niv_avancement !== 'Terminé' && a.date_echeance && new Date(a.date_echeance) < now) {
        retardParStructure[struct].retard++
      }
    })
    const topRetardStructures = Object.entries(retardParStructure)
      .map(([code, data]) => ({ label: code, value: data.retard, display: `${data.retard}/${data.total}`, color: '#EF4444' }))
      .sort((a, b) => b.value - a.value).slice(0, 4)

    return { total, realisees, nonRealisees, tauxRealisation, realiseesDelai, tauxRealisationDelai, enRetard, retardMoyen, parAvancement, topRetardStructures, retardParStructure }
  }

  // ============ OUTILS RISQUES (Synthèse) ==========
  const getPeriodeKeyRisques = () => {
    if (!riskPeriodFilters.annee) return null
    const annee = String(riskPeriodFilters.annee)

    if (riskPeriodFilters.mois) return `${riskPeriodFilters.mois}-${annee}`
    if (riskPeriodFilters.trimestre) {
      const num = String(riskPeriodFilters.trimestre).match(/(\d+)/)?.[1]
      return num ? `T${num}-${annee}` : null
    }
    if (riskPeriodFilters.semestre) {
      const num = String(riskPeriodFilters.semestre).match(/(\d+)/)?.[1]
      return num ? `S${num}-${annee}` : null
    }
    // Année seule
    return annee
  }

  // Calcul proba depuis seuils indicateur (même logique que Gestion des risques)
  const calculateProbabilite = (valIndicateur, seuils, sens) => {
    if (valIndicateur === null || valIndicateur === undefined || valIndicateur === '') return ''
    if (!seuils?.seuil1) return ''

    const val = parseFloat(valIndicateur)
    const s1 = parseFloat(seuils.seuil1)
    const s2 = parseFloat(seuils.seuil2)
    const s3 = parseFloat(seuils.seuil3)
    if ([val, s1, s2, s3].some(n => Number.isNaN(n))) return ''

    if (sens === 'Positif') {
      if (val >= s3) return 1
      if (val >= s2) return 2
      if (val >= s1) return 3
      return 4
    }
    if (val <= s1) return 1
    if (val <= s2) return 2
    if (val <= s3) return 3
    return 4
  }

  const getRisqueProbabilite = (risque, periodeKey) => {
    const isQualitatif = risque.qualitatif === 'Oui' || !risque.code_indicateur
    let indicOcc = null
    let storedProba = null

    if (isQualitatif) {
      const rp = risquesProbabilites.find(p => p.code_risque === risque.code_risque && p.periode === periodeKey)
      storedProba = rp?.probabilite ?? null
    } else {
      indicOcc = occurrences.find(o => o.code_indicateur === risque.code_indicateur && o.periode === periodeKey)
      const rp = risquesProbabilites.find(p => p.code_risque === risque.code_risque && p.periode === periodeKey)
      storedProba = indicOcc?.probabilite || rp?.probabilite || null
    }

    const valInd = isQualitatif ? null : indicOcc?.val_indicateur
    const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''
    const seuils = {
      seuil1: risque.indicateur?.seuil1 || risque.indicateur?.seuil_1,
      seuil2: risque.indicateur?.seuil2 || risque.indicateur?.seuil_2,
      seuil3: risque.indicateur?.seuil3 || risque.indicateur?.seuil_3
    }
    const calculatedProba = (!isQualitatif && hasValInd) ? calculateProbabilite(valInd, seuils, risque.indicateur?.sens) : ''
    const probDisplay = calculatedProba || storedProba || ''
    return { probDisplay }
  }

  // Impact net (cohérent Cartographie): appliquer l'efficacité des contrôles
  const calculateAttenuation = (efficacite_contr) => {
    if (efficacite_contr === 1) return -3
    if (efficacite_contr === 2) return -2
    if (efficacite_contr === 3) return -1
    return 0
  }
  const calculateImpactNet = (impactBrut, efficacite_contr) => {
    const attenuation = calculateAttenuation(efficacite_contr)
    return Math.max(1, (impactBrut || 1) + attenuation)
  }

  // ============ CALCULS RISQUES ============
  const getRisquesStats = () => {
    let filtered = risques.filter(r => r.statut === 'Actif')
    
    // Filtres globaux
    if (riskGlobalFilters.structure) filtered = filtered.filter(r => r.code_structure === riskGlobalFilters.structure)
    if (riskGlobalFilters.processus) filtered = filtered.filter(r => r.code_processus === riskGlobalFilters.processus)
    if (riskGlobalFilters.qualitatif) filtered = filtered.filter(r => r.qualitatif === riskGlobalFilters.qualitatif)
    if (riskGlobalFilters.categorie) filtered = filtered.filter(r => r.categories?.includes(parseInt(riskGlobalFilters.categorie)))
    if (riskGlobalFilters.recherche) {
      const s = riskGlobalFilters.recherche.toLowerCase()
      filtered = filtered.filter(r => r.libelle_risque?.toLowerCase().includes(s) || r.code_risque?.toLowerCase().includes(s))
    }

    // Si aucune période sélectionnée : chiffres '-' et graphiques vides
    const periodeKey = getPeriodeKeyRisques()
    if (!periodeKey) {
      return {
        totalActifs: '-',
        evalues: '-',
        nonEvalues: '-',
        tauxSuivi: '-',
        totalEvalues: 0,
        parCriticite: [],
        topProcessusCritiques: [],
        critiqueParProcessus: {}
      }
    }

    const totalActifs = filtered.length

    // Fonction utilitaire pour extraire la valeur numérique
    const extractNumber = (val) => {
      if (val === null || val === undefined) return NaN
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const match = val.match(/^(\d+)/)
        if (match) return parseInt(match[1])
        return parseInt(val)
      }
      return NaN
    }

    // Criticité (cohérent Cartographie) : score 1-16 = ImpactNet × Prob(1-4)
    const getCriticite16 = (r) => {
      const impactBrut = extractNumber(r.impact)
      const eff = extractNumber(r.efficacite_contr)
      const impactNet = calculateImpactNet(impactBrut, eff)
      const probData = getRisqueProbabilite(r, periodeKey)
      const prob = parseInt(probData.probDisplay || '', 10)
      if (Number.isNaN(impactNet) || Number.isNaN(prob)) return NaN
      return impactNet * prob
    }

    const evaluesList = filtered.filter(r => {
      const score = getCriticite16(r)
      return !Number.isNaN(score)
    })
    const totalEvalues = evaluesList.length
    const nonEvalues = totalActifs - totalEvalues
    const tauxSuivi = totalActifs > 0 ? ((totalEvalues / totalActifs) * 100).toFixed(1) : '0.0'

    // Répartition : proportions par rapport au total évalué
    const criticiteData = { faible: 0, modere: 0, critique: 0 }
    evaluesList.forEach(r => {
      const score = getCriticite16(r)
      if (score <= 3) criticiteData.faible++
      else if (score <= 7) criticiteData.modere++
      else criticiteData.critique++ // 8-16
    })
    const pct = (n) => (totalEvalues > 0 ? ((n / totalEvalues) * 100).toFixed(1) : '0.0')
    const parCriticite = [
      { label: '1-3 (Faible)', value: criticiteData.faible, display: `${criticiteData.faible} (${pct(criticiteData.faible)}%)`, color: '#10B981' },
      { label: '4-7 (Modéré)', value: criticiteData.modere, display: `${criticiteData.modere} (${pct(criticiteData.modere)}%)`, color: '#F59E0B' },
      { label: '8-16 (Critique)', value: criticiteData.critique, display: `${criticiteData.critique} (${pct(criticiteData.critique)}%)`, color: '#EF4444' }
    ]

    // Top 4 - taux de risques critiques (8-16) par processus (tri par %)
    const critiqueParProcessus = {}
    evaluesList.forEach(r => {
      const proc = r.code_processus || 'N/A'
      if (!critiqueParProcessus[proc]) critiqueParProcessus[proc] = { critique: 0, total: 0 }
      critiqueParProcessus[proc].total++
      const score = getCriticite16(r)
      if (!Number.isNaN(score) && score >= 8) critiqueParProcessus[proc].critique++
    })

    const toProcessItem = ([code, data]) => {
      const percent = data.total > 0 ? (data.critique / data.total) * 100 : 0
      return {
        label: code,
        value: Number(percent.toFixed(1)), // pour largeur + tri
        display: `${data.critique}/${data.total} (${percent.toFixed(1)}%)`,
        color: '#EF4444',
        _raw: data
      }
    }
    const topProcessusCritiques = Object.entries(critiqueParProcessus)
      .map(toProcessItem)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)

    return {
      totalActifs,
      evalues: totalEvalues,
      nonEvalues,
      tauxSuivi,
      totalEvalues,
      parCriticite,
      topProcessusCritiques,
      critiqueParProcessus
    }
  }

  // ============ CALCULS PLAN MAITRISE ============
  const getPlanStats = () => {
    let filtered = planActions.filter(a => a.statut === 'Actif')

    // Appliquer filtres globaux (structure) + filtres du bloc (dates)
    if (riskGlobalFilters.structure) filtered = filtered.filter(a => (a.code_structure_resp || a.code_structure) === riskGlobalFilters.structure)

    const getEcheance = (a) => a.date_fin_replan || a.latest_occurrence?.date_fin || a.date_fin || a.date_fin_initiale || null
    const getNiv = (a) => a.latest_occurrence?.niv_avancement || a.niv_avancement || 'Non entamée'
    const getTx = (a) => {
      const tx = a.latest_occurrence?.tx_avancement ?? a.tx_avancement ?? 0
      const n = parseFloat(String(tx).replace('%', ''))
      return Number.isNaN(n) ? 0 : n
    }

    if (riskPlanFilters.dateDebut) {
      const d0 = new Date(riskPlanFilters.dateDebut)
      filtered = filtered.filter(a => {
        const e = getEcheance(a)
        return e ? new Date(e) >= d0 : false
      })
    }
    if (riskPlanFilters.dateFin) {
      const d1 = new Date(riskPlanFilters.dateFin)
      filtered = filtered.filter(a => {
        const e = getEcheance(a)
        return e ? new Date(e) <= d1 : false
      })
    }

    const total = filtered.length
    const isDone = (a) => getTx(a) >= 100 || ['100%', 'Terminé', 'Terminée', 'Terminee'].includes(getNiv(a))

    const realisees = filtered.filter(isDone).length
    const nonRealisees = total - realisees
    const tauxRealisation = total > 0 ? ((realisees / total) * 100).toFixed(1) : '0.0'

    const now = new Date()
    const isLate = (a) => {
      if (isDone(a)) return false
      const e = getEcheance(a)
      return e ? new Date(e) < now : false
    }
    const enRetard = filtered.filter(isLate).length

    const retards = filtered.map(a => {
      const e = getEcheance(a)
      if (!e) return 0
      const diff = Math.floor((now - new Date(e)) / (1000 * 60 * 60 * 24))
      return diff > 0 ? diff : 0
    }).filter(d => d > 0)
    const retardMoyen = retards.length > 0 ? (retards.reduce((s, n) => s + n, 0) / retards.length).toFixed(1) : '0.0'

    // Par avancement : grouper par niv_avancement (source plan-maitrise)
    const byAvancement = {}
    filtered.forEach(a => {
      const niv = getNiv(a)
      byAvancement[niv] = (byAvancement[niv] || 0) + 1
    })
    const parAvancement = Object.entries(byAvancement).map(([label, value]) => ({ label, value }))

    // Top structures avec retard (par structure du responsable si dispo)
    const retardParStructure = {}
    filtered.forEach(a => {
      const struct = (a.code_structure_resp || a.code_structure) || 'N/A'
      if (!retardParStructure[struct]) retardParStructure[struct] = { retard: 0, total: 0 }
      retardParStructure[struct].total++
      if (isLate(a)) retardParStructure[struct].retard++
    })
    const topRetardStructures = Object.entries(retardParStructure)
      .map(([code, data]) => ({ label: code, value: data.retard, display: `${data.retard}/${data.total}`, color: '#EF4444' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)

    return { total, realisees, nonRealisees, tauxRealisation, enRetard, retardMoyen, parAvancement, topRetardStructures, retardParStructure }
  }

  const handleExpand = (title, data) => {
    setExpandData({ title, data })
    setShowExpandModal(true)
  }

  // ============ RENDER INDICATEURS ============
  const renderIndicateurs = () => {
    const stats = getIndicateursStats()
    const maxStruct = Math.max(...Object.values(stats.byStructure).map(d => d.total), 1)

    return (
      <div className="space-y-4">
        {/* Filtres */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[90px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Structure</label>
              <select value={indFilters.structure} onChange={e => setIndFilters({...indFilters, structure: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Toutes</option>
                {structures.map(s => <option key={s.code_structure} value={s.code_structure}>{s.code_structure}</option>)}
              </select>
            </div>
            <div className="w-[80px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Type</label>
              <select value={indFilters.type_indicateur} onChange={e => setIndFilters({...indFilters, type_indicateur: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                <option value="Taux">Taux</option>
                <option value="Nombre">Nombre</option>
              </select>
            </div>
            <div className="w-[75px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Sens</label>
              <select value={indFilters.sens} onChange={e => setIndFilters({...indFilters, sens: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                <option value="Positif">Positif</option>
                <option value="Négatif">Négatif</option>
              </select>
            </div>
            <div className="w-[65px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Routine</label>
              <select value={indFilters.routine} onChange={e => setIndFilters({...indFilters, routine: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>
            <div className="w-[90px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Groupe</label>
              <select value={indFilters.groupe} onChange={e => setIndFilters({...indFilters, groupe: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                {groupes.map(g => <option key={g.code_groupe} value={g.code_groupe}>{g.code_groupe}</option>)}
              </select>
            </div>
            <div className="w-[90px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Date début</label>
              <input type="date" value={indFilters.dateDebut} onChange={e => setIndFilters({...indFilters, dateDebut: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
            </div>
            <div className="w-[90px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Date fin</label>
              <input type="date" value={indFilters.dateFin} onChange={e => setIndFilters({...indFilters, dateFin: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Recherche</label>
              <input type="text" value={indFilters.recherche} onChange={e => setIndFilters({...indFilters, recherche: e.target.value})} placeholder="Rechercher..." className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
            </div>
          </div>
        </div>

        {/* 5 Statistiques */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard title="Total indicateurs" value={stats.total} icon={BarChart3} color="blue" />
          <StatCard title="Indicateurs renseignés" value={stats.renseignes} icon={CheckCircle} color="green" />
          <StatCard title="Taux de renseignement" value={`${stats.tauxRenseignement}%`} icon={Percent} color="purple" />
          <StatCard title="Cibles atteintes" value={stats.ciblesAtteintes} icon={Target} color="orange" />
          <StatCard title="Taux d'atteinte" value={`${stats.tauxAtteinte}%`} icon={TrendingUp} color="green" />
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-2 gap-4">
          <ProgressBarChart 
            title="Taux de renseignement par structure" 
            data={stats.renseignementParStructure} 
            maxValue={maxStruct}
          />
          <ProgressBarChart 
            title="Taux d'atteinte des cibles par structure" 
            data={stats.atteinteParStructure} 
            maxValue={maxStruct}
          />
        </div>
      </div>
    )
  }

  // ============ RENDER ACTIONS ============
  const renderActions = () => {
    const stats = getActionsStats()
    const maxAvancement = Math.max(...stats.parAvancement.map(d => d.value), 1)
    const maxRetard = Math.max(...Object.values(stats.retardParStructure).map(d => d.total), 1)

    return (
      <div className="space-y-4">
        {/* Filtres */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[90px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Structure</label>
              <select value={actFilters.structure} onChange={e => setActFilters({...actFilters, structure: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Toutes</option>
                {structures.map(s => <option key={s.code_structure} value={s.code_structure}>{s.code_structure}</option>)}
              </select>
            </div>
            <div className="w-[65px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Routine</label>
              <select value={actFilters.routine} onChange={e => setActFilters({...actFilters, routine: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>
            <div className="w-[90px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Groupe</label>
              <select value={actFilters.groupe} onChange={e => setActFilters({...actFilters, groupe: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                {groupes.map(g => <option key={g.code_groupe} value={g.code_groupe}>{g.code_groupe}</option>)}
              </select>
            </div>
            <div className="w-[100px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Date début</label>
              <input type="date" value={actFilters.dateDebut} onChange={e => setActFilters({...actFilters, dateDebut: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
            </div>
            <div className="w-[100px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Date fin</label>
              <input type="date" value={actFilters.dateFin} onChange={e => setActFilters({...actFilters, dateFin: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Recherche</label>
              <input type="text" value={actFilters.recherche} onChange={e => setActFilters({...actFilters, recherche: e.target.value})} placeholder="Rechercher..." className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
            </div>
          </div>
        </div>

        {/* 8 Statistiques (2 lignes de 4) */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard title="Nombre d'activités" value={stats.total} icon={ListChecks} color="blue" />
          <StatCard title="Activités réalisées" value={stats.realisees} icon={CheckCircle} color="green" />
          <StatCard title="Activités non réalisées" value={stats.nonRealisees} icon={Clock} color="orange" />
          <StatCard title="Taux de réalisation" value={`${stats.tauxRealisation}%`} icon={Percent} color="purple" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <StatCard title="Réalisées dans le délai" value={stats.realiseesDelai} icon={Timer} color="green" />
          <StatCard title="Taux réalisation délai" value={`${stats.tauxRealisationDelai}%`} icon={TrendingUp} color="blue" />
          <StatCard title="Actions en retard" value={stats.enRetard} icon={AlertTriangle} color="red" />
          <StatCard title="Retard moyen (jours)" value={stats.retardMoyen} icon={Calendar} color="orange" />
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-2 gap-4">
          <ProgressBarChart 
            title="Répartition par niveau de réalisation" 
            data={stats.parAvancement} 
            maxValue={maxAvancement}
          />
          <ProgressBarChart 
            title="Top 4 structures avec retard" 
            data={stats.topRetardStructures} 
            maxValue={maxRetard}
            showExpand
            onExpand={() => handleExpand('Toutes les structures avec retard', Object.entries(stats.retardParStructure).map(([code, data]) => ({ label: code, value: data.retard, display: `${data.retard}/${data.total}` })))}
          />
        </div>
      </div>
    )
  }

  // ============ RENDER RISQUES ============
  const renderRisques = () => {
    const riskStats = getRisquesStats()
    const planStats = getPlanStats()
    // Graph 1 : proportion par rapport au total évalué
    const maxCriticite = Math.max(riskStats.totalEvalues || 0, 1)
    // Graph 2 : taux en %, borné à 100
    const maxProcessus = 100
    const maxAvancement = Math.max(...planStats.parAvancement.map(d => d.value), 1)
    const maxRetard = Math.max(...Object.values(planStats.retardParStructure).map(d => d.total), 1)

    return (
      <div className="space-y-4">
        {/* Filtres globaux */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-blue-600 font-medium">⚡ Ces filtres s'appliquent à tous les blocs</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[100px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Catégorie</label>
              <select value={riskGlobalFilters.categorie} onChange={e => setRiskGlobalFilters({...riskGlobalFilters, categorie: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Toutes</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.libelle_categorie}</option>)}
              </select>
            </div>
            <div className="w-[90px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Structure</label>
              <select value={riskGlobalFilters.structure} onChange={e => setRiskGlobalFilters({...riskGlobalFilters, structure: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Toutes</option>
                {structures.map(s => <option key={s.code_structure} value={s.code_structure}>{s.code_structure}</option>)}
              </select>
            </div>
            <div className="w-[80px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Qualitatif</label>
              <select value={riskGlobalFilters.qualitatif} onChange={e => setRiskGlobalFilters({...riskGlobalFilters, qualitatif: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>
            <div className="w-[120px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Processus</label>
              <select value={riskGlobalFilters.processus} onChange={e => setRiskGlobalFilters({...riskGlobalFilters, processus: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                <option value="">Tous</option>
                {processus.map(p => <option key={p.code_processus} value={p.code_processus}>{p.code_processus}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[9px] text-gray-500 mb-0.5">Recherche</label>
              <input type="text" value={riskGlobalFilters.recherche} onChange={e => setRiskGlobalFilters({...riskGlobalFilters, recherche: e.target.value})} placeholder="Rechercher..." className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
            </div>
            <button onClick={() => setRiskGlobalFilters({ categorie: '', structure: '', qualitatif: '', processus: '', recherche: '' })} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded mt-3">Reset</button>
          </div>
        </div>

        {/* BLOC 1: Caractéristiques des risques */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-3">📊 Statistiques sur les caractéristiques des risques</h3>
          
          {/* Filtres période */}
          <div className="bg-white rounded-lg p-2 mb-3 border border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[80px]">
                <label className="block text-[9px] text-gray-500 mb-0.5">Année</label>
                <select value={riskPeriodFilters.annee} onChange={e => setRiskPeriodFilters({...riskPeriodFilters, annee: e.target.value, semestre: '', trimestre: '', mois: ''})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                  <option value="">--</option>
                  {Array.from({ length: 28 }, (_, i) => 2023 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="w-[90px]">
                <label className="block text-[9px] text-gray-500 mb-0.5">Semestre</label>
                <select value={riskPeriodFilters.semestre} onChange={e => setRiskPeriodFilters({...riskPeriodFilters, semestre: e.target.value, trimestre: '', mois: ''})} disabled={!riskPeriodFilters.annee} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px] disabled:bg-gray-100 disabled:text-gray-400">
                  <option value="">--</option>
                  <option value="Semestre 1">Semestre 1</option>
                  <option value="Semestre 2">Semestre 2</option>
                </select>
              </div>
              <div className="w-[90px]">
                <label className="block text-[9px] text-gray-500 mb-0.5">Trimestre</label>
                <select value={riskPeriodFilters.trimestre} onChange={e => setRiskPeriodFilters({...riskPeriodFilters, trimestre: e.target.value, semestre: '', mois: ''})} disabled={!riskPeriodFilters.annee} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px] disabled:bg-gray-100 disabled:text-gray-400">
                  <option value="">--</option>
                  <option value="Trimestre 1">Trimestre 1</option>
                  <option value="Trimestre 2">Trimestre 2</option>
                  <option value="Trimestre 3">Trimestre 3</option>
                  <option value="Trimestre 4">Trimestre 4</option>
                </select>
              </div>
              <div className="w-[90px]">
                <label className="block text-[9px] text-gray-500 mb-0.5">Mois</label>
                <select value={riskPeriodFilters.mois} onChange={e => setRiskPeriodFilters({...riskPeriodFilters, mois: e.target.value, semestre: '', trimestre: ''})} disabled={!riskPeriodFilters.annee} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px] disabled:bg-gray-100 disabled:text-gray-400">
                  <option value="">--</option>
                  {moisList.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 4 Statistiques */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <StatCard title="Risques actifs" value={riskStats.totalActifs} icon={Target} color="blue" />
            <StatCard title="Risques évalués" value={riskStats.evalues} icon={CheckCircle} color="green" />
            <StatCard title="Risques non évalués" value={riskStats.nonEvalues} icon={AlertTriangle} color="orange" />
            <StatCard title="Taux de suivi" value={`${riskStats.tauxSuivi}%`} icon={Percent} color="purple" />
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-2 gap-4">
            <ProgressBarChart title="Répartition par criticité" data={riskStats.parCriticite} maxValue={maxCriticite} />
            <ProgressBarChart 
              title="Top 04 - Taux de risques critiques (8–16) par processus" 
              data={riskStats.topProcessusCritiques} 
              maxValue={maxProcessus}
              showExpand
              onExpand={() => handleExpand(
                'Tous les processus - taux de risques critiques (8–16)',
                Object.entries(riskStats.critiqueParProcessus).map(([code, data]) => {
                  const percent = data.total > 0 ? (data.critique / data.total) * 100 : 0
                  return { label: code, value: Number(percent.toFixed(1)), display: `${data.critique}/${data.total} (${percent.toFixed(1)}%)` }
                })
              )}
            />
          </div>
        </div>

        {/* BLOC 2: Suivi plan maîtrise */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-3">📋 Statistiques de suivi du plan de maîtrise des risques</h3>
          
          {/* Filtres période */}
          <div className="bg-white rounded-lg p-2 mb-3 border border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-[110px]">
                <label className="block text-[9px] text-gray-500 mb-0.5">Date début</label>
                <input type="date" value={riskPlanFilters.dateDebut} onChange={e => setRiskPlanFilters({...riskPlanFilters, dateDebut: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
              </div>
              <div className="w-[110px]">
                <label className="block text-[9px] text-gray-500 mb-0.5">Date fin</label>
                <input type="date" value={riskPlanFilters.dateFin} onChange={e => setRiskPlanFilters({...riskPlanFilters, dateFin: e.target.value})} className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]" />
              </div>
            </div>
          </div>

          {/* 6 Statistiques */}
          <div className="grid grid-cols-6 gap-3 mb-4">
            <StatCard title="Nombre d'activités" value={planStats.total} icon={ListChecks} color="blue" />
            <StatCard title="Réalisées" value={planStats.realisees} icon={CheckCircle} color="green" />
            <StatCard title="Non réalisées" value={planStats.nonRealisees} icon={Clock} color="orange" />
            <StatCard title="Taux réalisation" value={`${planStats.tauxRealisation}%`} icon={Percent} color="purple" />
            <StatCard title="En retard" value={planStats.enRetard} icon={AlertTriangle} color="red" />
            <StatCard title="Retard moyen" value={`${planStats.retardMoyen}j`} icon={Timer} color="orange" />
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-2 gap-4">
            <ProgressBarChart title="Répartition par niveau de réalisation" data={planStats.parAvancement} maxValue={maxAvancement} />
            <ProgressBarChart 
              title="Top 4 structures avec retard" 
              data={planStats.topRetardStructures} 
              maxValue={maxRetard}
              showExpand
              onExpand={() => handleExpand('Toutes les structures avec retard', Object.entries(planStats.retardParStructure).map(([code, data]) => ({ label: code, value: data.retard, display: `${data.retard}/${data.total}` })))}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Sidebar fixe */}
      <div className="w-48 bg-white border-r border-gray-100 p-4 space-y-2 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto">
        {subPages.map((page) => (
          <SidebarButton key={page.key} icon={page.icon} label={page.label} active={activeTab === page.key} onClick={() => setActiveTab(page.key)} />
        ))}
      </div>

      {/* Contenu principal */}
      <div className="flex-1 p-6 overflow-auto bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'indicateurs' && renderIndicateurs()}
            {activeTab === 'actions' && renderActions()}
            {activeTab === 'risques' && renderRisques()}
          </>
        )}
      </div>

      {/* Modal expansion graphique */}
      <Modal isOpen={showExpandModal} onClose={() => setShowExpandModal(false)} title={expandData.title} size="lg">
        <div className="max-h-[500px] overflow-auto">
          <div className="space-y-2">
            {expandData.data.sort((a, b) => b.value - a.value).map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">{idx + 1}</span>
                <span className="flex-1 text-sm">{item.label}</span>
                <span className="font-medium text-sm">{item.display || item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-4 mt-4 border-t">
          <Button variant="secondary" onClick={() => setShowExpandModal(false)}>Fermer</Button>
        </div>
      </Modal>
    </div>
  )
}
