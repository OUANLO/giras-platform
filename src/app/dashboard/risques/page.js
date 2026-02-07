'use client'

import { useState, useEffect } from 'react'
import { 
  Target, Search, BarChart3, Layers, CheckCircle, PieChart, Settings, 
  Plus, Download, Eye, Edit, Trash2, List, FileSpreadsheet, AlertTriangle, Users, RotateCcw, Maximize2, Minimize2, X, ZoomIn, ZoomOut, Image, Shield, XCircle, TrendingDown
} from 'lucide-react'
import { Button, Modal, FormInput, DataTable, KPICard, StatusBadge, SidebarButton, ProgressBar, SearchableSelect, AlertModal } from '@/components/ui'
import * as XLSX from 'xlsx'

export default function RisquesPage() {
  const [activeTab, setActiveTab] = useState('identification')
  const [risques, setRisques] = useState([])
  const [structures, setStructures] = useState([])
  const [processus, setProcessus] = useState([])
  const [categories, setCategories] = useState([])
  const [indicateurs, setIndicateurs] = useState([])
  const [allActionsStandards, setAllActionsStandards] = useState([])
  const [actionsStandards, setActionsStandards] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState(null)
  const [selectedRisk, setSelectedRisk] = useState(null)
  const [formData, setFormData] = useState({})
  const [actionFormData, setActionFormData] = useState({})
  const [editingAction, setEditingAction] = useState(null)
  const [user, setUser] = useState(null)
  const [analyseFilters, setAnalyseFilters] = useState({ structure: '', processus: '', categorie: '', typeEvaluation: '', recherche: '' })
  const [allPeriodes, setAllPeriodes] = useState([]) // Toutes les périodes (ouvertes et fermées)

  // --- Normalisation des clés de période
  // Objectif: éviter les incohérences de comparaison quand les libellés remontent sous des formats
  // différents (ex: "S1-2025" vs "Semestre 1 2025" ou "2025 Semestre 1").
  const normalizePeriodeKey = (raw) => {
    if (raw === null || raw === undefined) return ''
    let s = String(raw).trim()
    if (!s) return ''

    // UUID (id de période) : on le conserve, résolution via allPeriodes dans samePeriodeKey
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s

    // uniformise séparateurs/espaces
    s = s
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ') // nbsp
      .trim()

    // déjà au bon format
    if (/^S[12]-\d{4}$/.test(s)) return s
    if (/^T[1-4]-\d{4}$/.test(s)) return s
    // Mois au format "01-2026" => normaliser vers "M01-2026"
    if (/^\d{2}-\d{4}$/.test(s)) return `M${s}`
    if (/^M\d{1,2}-\d{4}$/.test(s)) {
      const [m, y] = s.substring(1).split('-')
      return `M${String(parseInt(m, 10)).padStart(2, '0')}-${y}`
    }
    if (/^\d{4}$/.test(s)) return s

    // Mois au format "Janvier-2026" (mois FR)
    {
      const moisFR = ['janvier','février','fevrier','mars','avril','mai','juin','juillet','août','aout','septembre','octobre','novembre','décembre','decembre']
      const mmFR = ['01','02','02','03','04','05','06','07','08','08','09','10','11','12','12']
      const mfr = s.match(/^([A-Za-zÀ-ÿ]+)\s*-\s*(\d{4})$/)
      if (mfr) {
        const name = mfr[1].toLowerCase()
        const year = mfr[2]
        const idx = moisFR.indexOf(name)
        if (idx >= 0) return `M${mmFR[idx]}-${year}`
      }
    }

    // "Semestre 1 2025" ou "2025 Semestre 1"
    let m = s.match(/^Semestre\s*([12])\s*(\d{4})$/i) || s.match(/^(\d{4})\s*Semestre\s*([12])$/i)
    if (m) {
      const year = m[2] || m[1]
      const sem = m[1] || m[2]
      return `S${sem}-${year}`
    }

    // "Trimestre 1 2025" ou "2025 Trimestre 1"
    m = s.match(/^Trimestre\s*([1-4])\s*(\d{4})$/i) || s.match(/^(\d{4})\s*Trimestre\s*([1-4])$/i)
    if (m) {
      const year = m[2] || m[1]
      const tri = m[1] || m[2]
      return `T${tri}-${year}`
    }

    // "Mois 1 2025" ou "2025 Mois 1"
    m = s.match(/^Mois\s*(\d{1,2})\s*(\d{4})$/i) || s.match(/^(\d{4})\s*Mois\s*(\d{1,2})$/i)
    if (m) {
      const year = m[2] || m[1]
      const month = m[1] || m[2]
      return `M${String(parseInt(month, 10)).padStart(2, '0')}-${year}`
    }

    // fallback: on garde la chaîne telle quelle (mais normalisée)
    return s
  }

  // Comparaison robuste entre deux périodes, compatible avec :
  //  - libellés ("2024", "S1-2025", ...)
  //  - variantes texte ("Semestre 1 2025", ...)
  //  - UUID stockés en base (périodes)
  const samePeriodeKey = (a, b) => {
    const na = normalizePeriodeKey(a)
    const nb = normalizePeriodeKey(b)
    if (na && nb && na === nb) return true

    const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '').trim())

    const resolve = (v) => {
      const raw = String(v || '').trim()
      if (!raw) return ''
      // si UUID : essayer de le convertir en clé (S1-2025, 2024, ...)
      if (isUuid(raw)) {
        const p = (allPeriodes || []).find(pp => String(pp.id) === raw)
        if (p) {
          // getPeriodeKeyFromPeriode est défini plus bas (Synthèse), mais disponible via closure
          try {
            if (typeof getPeriodeKeyFromPeriode === 'function') {
              return normalizePeriodeKey(getPeriodeKeyFromPeriode(p))
            }
          } catch (e) {}
        }
        return raw
      }

      // sinon : si cela correspond à une période existante, on renvoie sa clé normalisée
      try {
        const n = normalizePeriodeKey(raw)
        const p = (allPeriodes || []).find(pp => normalizePeriodeKey((typeof getPeriodeKeyFromPeriode === 'function') ? getPeriodeKeyFromPeriode(pp) : `${pp.annee || ''}`) === n)
        if (p && typeof getPeriodeKeyFromPeriode === 'function') return normalizePeriodeKey(getPeriodeKeyFromPeriode(p))
      } catch (e) {}
      return normalizePeriodeKey(raw)
    }

    return resolve(a) === resolve(b)
  }
  
  // État pour AlertModal unifié
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null })
  const [confirmAction, setConfirmAction] = useState(null)
  const showAlert = (type, message, onConfirm = null) => setAlertModal({ isOpen: true, type, message, onConfirm })
  const closeAlert = () => { if (alertModal.onConfirm) alertModal.onConfirm(); setAlertModal({ isOpen: false, type: 'success', message: '', onConfirm: null }) }
  
  // States pour la section Gestion
  const [periodeForm, setPeriodeForm] = useState({ annee: '', semestre: '', trimestre: '', mois: '', date_limite_saisie: '' })
  // Période d'appréciation de l'atténuation des risques (utilisée dans Synthèse)
  // Modalités : Année / Semestre / Trimestre / Mois. Valeur jamais vide.
  const [attenuationAppreciationType, setAttenuationAppreciationType] = useState('Année')
  const [showProcessusModal, setShowProcessusModal] = useState(false)
  const [showCategorieModal, setShowCategorieModal] = useState(false)
  const [processusForm, setProcessusForm] = useState({})
  const [categorieForm, setCategorieForm] = useState({})
  const [selectedProcessus, setSelectedProcessus] = useState(null)
  const [selectedCategorie, setSelectedCategorie] = useState(null)
  const [processusFilter, setProcessusFilter] = useState({ statut: '', search: '' })
  const [categorieFilter, setCategorieFilter] = useState({ statut: '', search: '' })
  const [gestionnairesRisques, setGestionnairesRisques] = useState([])
  const [selectedGestionnaireToAdd, setSelectedGestionnaireToAdd] = useState('')
  
  // States pour fermeture de période
  const [showFermetureModal, setShowFermetureModal] = useState(false)
  const [fermetureStep, setFermetureStep] = useState('verify') // verify, confirm, progress, done
  const [fermetureData, setFermetureData] = useState(null)
  const [fermetureCheckboxes, setFermetureCheckboxes] = useState({
    cartographie: false,
    infoNonModifiable: false,
    modifNImpacte: false,
    occurrencesArchivees: false
  })
  const [fichierCartographie, setFichierCartographie] = useState(null)
  const [progressOperation, setProgressOperation] = useState({ show: false, message: '', progress: 0 })
  
  // States pour archivage des éléments
  const [showArchivesModal, setShowArchivesModal] = useState({ type: '', show: false })

  // --- Données d'archive (périodes fermées) ---
  const [archiveByRisque, setArchiveByRisque] = useState({})
  const [archiveLoadedPeriodeId, setArchiveLoadedPeriodeId] = useState(null)
  // Clé UI (ex: 2024, T1-2024, S1-2025, 2025-01) de la période dont l'archive est chargée.
  // IMPORTANT: évite d'appliquer l'archive d'une période fermée à une autre période (comparaison, etc.).
  const [archiveLoadedPeriodeKey, setArchiveLoadedPeriodeKey] = useState(null)
  const [cartographieFile, setCartographieFile] = useState(null)

  const subPages = [
    { key: 'identification', label: 'Identification', icon: Target },
    { key: 'analyse', label: 'Analyse', icon: Search },
    { key: 'evaluation', label: 'Évaluation', icon: BarChart3 },
    { key: 'cartographie', label: 'Cartographie', icon: Layers },
    { key: 'plan', label: 'Plan de maîtrise', icon: CheckCircle },
    { key: 'synthese', label: 'Synthèse', icon: PieChart },
    { key: 'gestion', label: 'Gestion', icon: Settings }
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: Math.max(1, currentYear - 2019) }, (_, i) => 2020 + i)
  // Années de 2020 à l'année en cours (obligation) pour la gestion des périodes
  const yearsGestion = years
  const semestres = [{ value: 'S1', label: 'Semestre 1' }, { value: 'S2', label: 'Semestre 2' }]
  const trimestres = [{ value: 'T1', label: 'Trimestre 1' }, { value: 'T2', label: 'Trimestre 2' }, { value: 'T3', label: 'Trimestre 3' }, { value: 'T4', label: 'Trimestre 4' }]
  const moisList = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  // =========================
  // Helpers périodes (défauts)
  // =========================
  const getPeriodeDateDebut = (p) => {
    const raw = p?.date_debut || p?.dateDebut || p?.date_debut_periode
    const d = raw ? new Date(raw) : null
    if (d && !isNaN(d.getTime())) return d
    const year = Number(p?.annee || 0)
    const mois = Number(p?.mois || 0)
    const trimestre = Number(p?.trimestre || 0)
    const semestre = Number(p?.semestre || 0)
    const m = mois || (trimestre ? ((trimestre - 1) * 3 + 1) : (semestre ? ((semestre - 1) * 6 + 1) : 1))
    return new Date(year || 2000, Math.min(Math.max(m, 1), 12) - 1, 1)
  }

  const getPeriodeDateFin = (p) => {
    const raw = p?.date_fin || p?.dateFin || p?.date_fin_periode
    const d = raw ? new Date(raw) : null
    if (d && !isNaN(d.getTime())) return d
    // fallback : fin approximative
    const start = getPeriodeDateDebut(p)
    const year = Number(p?.annee || start.getFullYear())
    const mois = Number(p?.mois || 0)
    const trimestre = Number(p?.trimestre || 0)
    const semestre = Number(p?.semestre || 0)
    const endMonth = mois ? mois : (trimestre ? trimestre * 3 : (semestre ? semestre * 6 : 12))
    return new Date(year || 2000, Math.min(Math.max(endMonth, 1), 12) - 1, 28)
  }

  const getMostRecentPeriode = (periodes = []) => {
    if (!periodes || periodes.length === 0) return null
    const sorted = [...periodes].sort((a, b) => getPeriodeDateFin(b) - getPeriodeDateFin(a))
    return sorted[0] || null
  }

  const periodeToFormShort = (p) => ({
    annee: p?.annee?.toString() || '',
    semestre: p?.semestre ? `S${p.semestre}` : '',
    trimestre: p?.trimestre ? `T${p.trimestre}` : '',
    mois: p?.mois ? moisList[p.mois - 1] : ''
  })

  const periodeToFormLong = (p) => ({
    annee: p?.annee?.toString() || '',
    semestre: p?.semestre ? `Semestre ${p.semestre}` : '',
    trimestre: p?.trimestre ? `Trimestre ${p.trimestre}` : '',
    mois: p?.mois ? moisList[p.mois - 1] : ''
  })

  useEffect(() => {
    const storedUser = localStorage.getItem('giras_user')
    if (storedUser) setUser(JSON.parse(storedUser))

    // Charger la période d'appréciation de l'atténuation (persistée localement)
    try {
      const storedAtt = localStorage.getItem('giras_attenuation_appreciation_type')
      if (storedAtt && ['Année', 'Semestre', 'Trimestre', 'Mois'].includes(storedAtt)) {
        setAttenuationAppreciationType(storedAtt)
      }
    } catch (e) {
      // noop
    }
    fetchData()
    fetchAllActionsStandards()
    fetchIndicateurOccurrences()
    fetchRisquesProbabilites()
  }, [])

  // Charger les occurrences d'indicateurs
  const fetchIndicateurOccurrences = async () => {
    try {
      const res = await fetch('/api/indicateurs/occurrences')
      if (res.ok) {
        const data = await res.json()
        setIndicateurOccurrences(data.occurrences || [])
      }
    } catch (error) {
      console.error('Erreur chargement occurrences indicateurs:', error)
    }
  }

  // Charger les probabilités manuelles des risques qualitatifs
  const fetchRisquesProbabilites = async () => {
    try {
      const res = await fetch('/api/risques/probabilite')
      if (res.ok) {
        const data = await res.json()
        setRisquesProbabilites(data.probabilites || [])
      }
    } catch (error) {
      console.error('Erreur chargement probabilités risques:', error)
    }
  }

  // Vérifier si l'utilisateur peut modifier (Admin, Super admin, Risk manager uniquement)
  const canEdit = () => {
    const type = user?.type_utilisateur
    // Admin, Super admin ou Gestionnaire de risques peuvent éditer
    if (type === 'Admin' || type === 'Super admin') return true
    // Vérifier si l'utilisateur est dans la liste des gestionnaires de risques
    if (gestionnairesRisques.includes(user?.username)) return true
    return false
  }

  // Vérifier si l'utilisateur peut gérer les gestionnaires (Admin ou Super admin uniquement)
  const canManageGestionnaires = () => {
    const type = user?.type_utilisateur
    return type === 'Admin' || type === 'Super admin'
  }

  // Vérifier si l'utilisateur est en lecture seule (User, Manager, Super manager)
  const isReadOnly = () => {
    const type = user?.type_utilisateur
    if (type === 'Admin' || type === 'Super admin') return false
    if (gestionnairesRisques.includes(user?.username)) return false
    return true
  }

  // Vérifier si l'utilisateur peut voir ce risque (basé sur sa structure)
  const canViewRisk = (risk) => {
    const type = user?.type_utilisateur
    // Admin, Super admin et gestionnaires de risques voient tout
    if (type === 'Admin' || type === 'Super admin') return true
    if (gestionnairesRisques.includes(user?.username)) return true
    // Les autres ne voient que les risques de leur structure
    return risk.code_structure === user?.structure
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const [risquesRes, structuresRes, processusRes, categoriesRes, indicateursRes, usersRes, groupesRes] = await Promise.all([
        fetch('/api/risques'),
        fetch('/api/structures?statut=Actif'),
        fetch('/api/processus'),
        fetch('/api/categories'),
        fetch('/api/indicateurs?groupe=Risque&statut=Actif'),
        fetch('/api/users'),
        fetch('/api/groupe-indicateurs') // Charger tous les groupes pour trouver celui des risques
      ])

      if (risquesRes.ok) {
        const data = await risquesRes.json()
        setRisques(data.risques || [])
      }
      if (structuresRes.ok) {
        const data = await structuresRes.json()
        setStructures(data.structures || [])
      }
      if (processusRes.ok) {
        const data = await processusRes.json()
        setProcessus(data.processus || [])
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.categories || [])
      }
      if (indicateursRes.ok) {
        const data = await indicateursRes.json()
        setIndicateurs(data.indicateurs || [])
      }
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users || [])
      }
      // Charger les gestionnaires de risques depuis le groupe "Indicateurs des risques" ou "Risque"
      if (groupesRes.ok) {
        const data = await groupesRes.json()
        const groupes = data.groupes || []
        // Chercher le groupe par libellé "Indicateurs des risques" ou code "Risque"
        const groupeRisque = groupes.find(g => 
          g.libelle_groupe === 'Indicateurs des risques' || 
          g.code_groupe === 'Risque'
        )
        if (groupeRisque?.gestionnaires) {
          setGestionnairesRisques(groupeRisque.gestionnaires)
        }
      }
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllActionsStandards = async () => {
    try {
      const res = await fetch('/api/actions-risques')
      if (res.ok) {
        const data = await res.json()
        setAllActionsStandards(data.actions || [])
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchActionsStandards = async (codeRisque) => {
    try {
      const res = await fetch(`/api/actions-risques?code_risque=${codeRisque}`)
      if (res.ok) {
        const data = await res.json()
        setActionsStandards(data.actions || [])
      }
    } catch (error) {
      console.error('Erreur:', error)
      setActionsStandards([])
    }
  }

  // Obtenir les emails des gestionnaires de risques pour les risques qualitatifs
  const getGestionnairesRisquesEmails = () => {
    if (!gestionnairesRisques || gestionnairesRisques.length === 0) return '-'
    const emails = gestionnairesRisques.map(username => {
      const user = users.find(u => u.username === username)
      return user?.email || username
    }).filter(Boolean)
    return emails.length > 0 ? emails.join(', ') : '-'
  }

  // Fonction utilitaire centralisée pour récupérer la probabilité d'un risque
  // Retourne { storedProba, indicOcc, valInd, hasValInd, calculatedProba, probDisplay, hasProb }
  const getRisqueProbabilite = (risque, periodeKey) => {
    // IMPORTANT (Exigence):
    // - Si la période est FERMÉE, la source UNIQUE de vérité pour les index est `risques_probabilites`.
    //   (Aucun fallback vers d'autres tables/archives.)
    // - Si la période est OUVERTE, on conserve la logique historique (indicateurs + saisie manuelle).
    const periodeObj = (allPeriodes || []).find(p => String(getPeriodeKeyFromPeriode(p)) === String(periodeKey)) || null
    const isPeriodeFermee = !!(periodeObj && periodeObj.statut && String(periodeObj.statut).toLowerCase() !== 'ouvert')

    if (isPeriodeFermee) {
      const rp = risquesProbabilites.find(rp => rp.code_risque === risque.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
      const hasProb = !!(rp && rp.probabilite !== null && rp.probabilite !== undefined && `${rp.probabilite}` !== '')
      const p = hasProb ? Number(rp.probabilite) : null
      return {
        storedProba: p,
        indicOcc: null,
        valInd: null,
        hasValInd: false,
        calculatedProba: p,
        hasCalculatedProba: hasProb,
        probDisplay: hasProb ? String(p) : '',
        hasProb,
        hasStoredProba: hasProb,
        ind_obtenu: rp?.ind_obtenu ?? null,
        rp
      }
    }

    // Période OUVERTE : logique historique
    // (probabilité manuelle pour qualitatif, calcul à partir de l'indicateur si valeur renseignée)
    const canUseLoadedArchive = Boolean(archiveLoadedPeriodeId && archiveLoadedPeriodeKey && String(archiveLoadedPeriodeKey) === String(periodeKey))
    if (canUseLoadedArchive) {
      const rp = risquesProbabilites.find(rp => rp.code_risque === risque.code_risque && rp.periode === periodeKey)
      if (rp && rp.probabilite !== null && rp.probabilite !== undefined && `${rp.probabilite}` !== '') {
        const p = Number(rp.probabilite)
        return {
          storedProba: p,
          indicOcc: null,
          valInd: null,
          hasValInd: false,
          calculatedProba: p,
          hasCalculatedProba: true,
          probDisplay: String(p),
          hasProb: true,
          hasStoredProba: true,
          ind_obtenu: rp.ind_obtenu ?? null,
          rp
        }
      }

      const archived = archiveByRisque?.[risque.code_risque] || null
      if (archived) {
        const p = archived.probabilite
        const hasProb = p !== null && p !== undefined && `${p}` !== ''
        return {
          storedProba: hasProb ? Number(p) : null,
          indicOcc: null,
          valInd: archived.valeur_indicateur ?? null,
          hasValInd: archived.valeur_indicateur !== null && archived.valeur_indicateur !== undefined && `${archived.valeur_indicateur}` !== '',
          calculatedProba: hasProb ? Number(p) : null,
          hasCalculatedProba: hasProb,
          probDisplay: hasProb ? String(p) : '',
          hasProb,
          archived
        }
      }
    }

    const isQualitatif = risque.qualitatif === 'Oui' || !risque.code_indicateur
    
    let indicOcc = null
    let storedProba = null
    
    if (isQualitatif) {
      // Pour les qualitatifs : chercher dans risquesProbabilites
      const probQualit = risquesProbabilites.find(
        rp => rp.code_risque === risque.code_risque && samePeriodeKey(rp.periode, periodeKey)
      )
      storedProba = probQualit?.probabilite
    } else {
      // Pour les quantitatifs : chercher dans indicateurOccurrences ET risquesProbabilites (backup)
      indicOcc = indicateurOccurrences.find(
        io => io.code_indicateur === risque.code_indicateur && samePeriodeKey(io.periode, periodeKey)
      )
      const probBackup = risquesProbabilites.find(
        rp => rp.code_risque === risque.code_risque && samePeriodeKey(rp.periode, periodeKey)
      )
      // La probabilité n'est plus stockée sur indicateur_occurrences (colonne supprimée)
      storedProba = probBackup?.probabilite
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
    const hasProb = probDisplay !== '' && probDisplay !== null && probDisplay !== undefined
    const hasStoredProba = storedProba !== null && storedProba !== undefined && storedProba !== ''
    const hasCalculatedProba = calculatedProba !== '' && calculatedProba !== null
    
    return {
      isQualitatif,
      indicOcc,
      storedProba,
      valInd,
      hasValInd,
      calculatedProba,
      hasCalculatedProba,
      probDisplay,
      hasProb,
      hasStoredProba,
      seuils
    }
  }

  // Export Excel des risques - tous les champs
  const handleExportRisques = () => {
    // Vérifier si le tableau est vide
    if (filteredRisques.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    const headers = [
      'Code risque', 'Libellé risque', 'Code structure', 'Code processus', 'Libellé processus',
      'Cause', 'Conséquence', 'Impact', 'Efficacité contrôles', 
      'Qualitatif', 'Code indicateur', 'Libellé indicateur', 'Catégories',
      'Date vigueur', 'Statut', 'Créateur', 'Date création', 'Modificateur', 'Date modification'
    ]
    
    const rows = filteredRisques.map(r => ({
      'Code risque': r.code_risque,
      'Libellé risque': r.libelle_risque,
      'Code structure': r.code_structure,
      'Code processus': r.code_processus,
      'Libellé processus': r.processus?.libelle_processus || '',
      'Cause': r.cause || '',
      'Conséquence': r.consequence || '',
      'Impact': r.impact || '',
      'Efficacité contrôles': r.efficacite_contr || '',
      'Qualitatif': r.qualitatif || '',
      'Code indicateur': r.code_indicateur || '',
      'Libellé indicateur': r.indicateur?.libelle_indicateur || '',
      'Catégories': (r.categories || []).map(catCode => {
        const cat = categories.find(c => c.code_categorie === catCode || c.id === catCode)
        return `"${cat?.libelle_categorie || catCode}"`
      }).join(', '),
      'Date vigueur': r.date_vigueur || '',
      'Statut': r.statut,
      'Créateur': r.createur || '',
      'Date création': r.date_creation ? new Date(r.date_creation).toLocaleDateString('fr-FR') : '',
      'Modificateur': r.modificateur || '',
      'Date modification': r.date_modification ? new Date(r.date_modification).toLocaleDateString('fr-FR') : ''
    }))
    
    // Créer le workbook et la feuille
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Risques')
    
    // Télécharger le fichier
    XLSX.writeFile(wb, `risques_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Export Excel des actions
  const handleExportActions = () => {
    // Vérifier si le tableau est vide
    if (allActionsStandards.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    const rows = allActionsStandards.map(a => {
      const risque = risques.find(r => r.code_risque === a.code_risque)
      return {
        'Code Action': a.code_action,
        'Libellé Action': a.libelle_action,
        'Type': a.type_action,
        'Code Risque': a.code_risque,
        'Libellé Risque': risque?.libelle_risque || ''
      }
    })
    
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Actions')
    XLSX.writeFile(wb, `actions_standards_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Export actions d'un risque spécifique
  const handleExportActionsRisque = () => {
    if (!selectedRisk || actionsStandards.length === 0) {
      showAlert('warning', 'Aucune action à exporter')
      return
    }
    
    const rows = actionsStandards.map(a => ({
      'Code Action': a.code_action,
      'Libellé Action': a.libelle_action,
      'Type': a.type_action
    }))
    
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Actions')
    XLSX.writeFile(wb, `actions_${selectedRisk.code_risque}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleCreateRisk = () => {
    setSelectedRisk(null)
    setFormData({ qualitatif: 'Non', statut: 'Actif', categories: [] })
    setModalType('risk')
    setShowModal(true)
  }

  const handleEditRisk = (risk) => {
    setSelectedRisk(risk)
    setFormData({ ...risk, categories: risk.categories || [] })
    setModalType('risk')
    setShowModal(true)
  }

  const handleDeleteRisk = async (risk) => {
    if (user?.type_utilisateur !== 'Super admin' && user?.type_utilisateur !== 'Admin') {
      showAlert('error', 'Seuls les Super Admin et Admin peuvent supprimer des risques')
      return
    }
    setConfirmAction({
      message: `Supprimer le risque ${risk.code_risque} ?\n\n"${risk.libelle_risque}"\n\nCette action est irréversible.`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/risques?id=${risk.id}`, { method: 'DELETE' })
          const data = await response.json()
          
          if (response.ok) {
            fetchData()
            showAlert('success', `Le risque ${risk.code_risque} a été supprimé avec succès`)
          } else {
            if (data.error?.includes('foreign key') || data.error?.includes('constraint')) {
              showAlert('error', `Impossible de supprimer le risque ${risk.code_risque}. Ce risque est référencé par d'autres enregistrements. Veuillez d'abord supprimer les données liées ou désactiver le risque.`)
            } else {
              showAlert('error', `Erreur lors de la suppression : ${data.error || 'Erreur inconnue'}`)
            }
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur de connexion au serveur')
        }
      }
    })
  }

  const handleActionsStandards = (risk) => {
    setSelectedRisk(risk)
    fetchActionsStandards(risk.code_risque)
    setModalType('actions')
    setShowModal(true)
  }

  const handleShowAllActions = () => {
    fetchAllActionsStandards()
    setModalType('allActions')
    setShowModal(true)
  }

  const handleSubmitRisk = async (e) => {
    e.preventDefault()
    
    // Validation de tous les champs obligatoires
    const requiredFields = [
      { field: 'code_risque', label: 'Code risque' },
      { field: 'code_structure', label: 'Structure' },
      { field: 'code_processus', label: 'Processus' },
      { field: 'libelle_risque', label: 'Libellé du risque' },
      { field: 'cause', label: 'Cause(s)' },
      { field: 'consequence', label: 'Conséquence(s)' },
      { field: 'impact', label: 'Impact' },
      { field: 'efficacite_contr', label: 'Efficacité des contrôles' },
      { field: 'date_vigueur', label: 'Date de vigueur' }
    ]
    
    const missingFields = requiredFields.filter(f => !formData[f.field] || formData[f.field] === '')
    if (missingFields.length > 0) {
      showAlert('error', `Veuillez remplir tous les champs obligatoires : ${missingFields.map(f => f.label).join(', ')}`)
      return
    }

    // Vérifier que l'indicateur est sélectionné si le type est quantitatif
    if (formData.qualitatif !== 'Oui' && !formData.code_indicateur) {
      showAlert('error', 'Veuillez sélectionner un indicateur pour un risque quantitatif, ou choisir le type Qualitatif.')
      return
    }

    try {
      const method = selectedRisk ? 'PUT' : 'POST'
      const body = {
        ...formData,
        id: selectedRisk?.id,
        createur: user?.username,
        modificateur: user?.username,
        code_indicateur: formData.qualitatif === 'Oui' ? null : formData.code_indicateur
      }

      const response = await fetch('/api/risques', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        setShowModal(false)
        fetchData()
        showAlert('success', selectedRisk ? 'Risque modifié avec succès' : 'Risque créé avec succès')
      } else {
        const data = await response.json()
        showAlert('error', data.error || 'Erreur lors de l\'enregistrement')
      }
    } catch (error) {
      console.error('Erreur:', error)
      showAlert('error', 'Erreur de connexion au serveur')
    }
  }

  const handleSubmitAction = async (e) => {
    e.preventDefault()
    
    // Validation - code_action sera généré si manquant
    if (!actionFormData.code_risque || !actionFormData.libelle_action || !actionFormData.type_action) {
      showAlert('error', 'Veuillez remplir tous les champs obligatoires')
      return
    }

    // Générer code_action si manquant
    let finalFormData = { ...actionFormData }
    if (!finalFormData.code_action) {
      const existingActions = allActionsStandards.filter(a => a.code_risque === finalFormData.code_risque)
      const nextNum = existingActions.length + 1
      finalFormData.code_action = `${finalFormData.code_risque}-A${String(nextNum).padStart(2, '0')}`
    }
    
    setConfirmAction({
      message: editingAction ? 'Confirmer la modification de cette action ?' : 'Confirmer l\'enregistrement de cette action ?',
      onConfirm: async () => {
        try {
          const method = editingAction ? 'PUT' : 'POST'
          const body = editingAction 
            ? { ...finalFormData, id: editingAction.id, modificateur: user?.username }
            : { ...finalFormData, createur: user?.username }
          
          const response = await fetch('/api/actions-risques', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          
          if (response.ok) {
            fetchAllActionsStandards()
            if (selectedRisk) {
              const res = await fetch(`/api/actions-risques?code_risque=${selectedRisk.code_risque}`)
              if (res.ok) {
                const data = await res.json()
                setActionsStandards(data.actions || [])
              }
            }
            setActionFormData({ code_risque: '', code_action: '', libelle_action: '', type_action: '' })
            setEditingAction(null)
            if (modalType === 'addAction') {
              setModalType('actions')
            }
            showAlert('success', editingAction ? 'Action modifiée avec succès' : 'Action enregistrée avec succès')
          } else {
            const data = await response.json()
            showAlert('error', data.error || 'Erreur lors de l\'enregistrement')
          }
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur de connexion au serveur')
        }
      }
    })
  }

  const handleEditAction = (action) => {
    setEditingAction(action)
    setActionFormData({
      code_risque: action.code_risque,
      code_action: action.code_action,
      libelle_action: action.libelle_action,
      type_action: action.type_action
    })
  }

  const handleCancelEditAction = () => {
    setEditingAction(null)
    setActionFormData({ code_risque: '', code_action: '', libelle_action: '', type_action: '' })
  }

  const handleDeleteAction = async (action) => {
    setConfirmAction({
      message: 'Supprimer cette action ?',
      onConfirm: async () => {
        try {
          await fetch(`/api/actions-risques?id=${action.id}`, { method: 'DELETE' })
          if (selectedRisk) {
            fetchActionsStandards(selectedRisk.code_risque)
          }
          fetchAllActionsStandards()
          showAlert('success', 'Action supprimée')
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de la suppression')
        }
      }
    })
  }

  // Fonctions pour la section Gestion
  const handleOpenPeriode = async () => {
    if (!periodeForm.annee) {
      showAlert('error', 'Veuillez sélectionner une année')
      return
    }
    
    // Vérifier la date limite de saisie
    if (!periodeForm.date_limite_saisie) {
      showAlert('error', 'Veuillez saisir la date limite de saisie des indicateurs')
      return
    }
    
    // Vérifier qu'aucune période n'est déjà ouverte
    if (periodeOuverte) {
      showAlert('warning', 'Une période est déjà ouverte. Veuillez la fermer avant d\'en ouvrir une nouvelle.')
      return
    }

    // IMPORTANT : si la période demandée existe déjà et est fermée, on doit bloquer
    // AVANT d'afficher la confirmation. La confirmation ne doit s'afficher que pour
    // une nouvelle période.
    try {
      const res = await fetch(`/api/periodes?annee=${encodeURIComponent(periodeForm.annee)}`)
      const payload = await res.json()
      const periodes = payload?.periodes || []

      // Normaliser les valeurs de formulaire (mêmes règles que l'API)
      let semestreVal = null
      let trimestreVal = null
      let moisVal = null
      if (periodeForm.semestre && periodeForm.semestre !== '' && periodeForm.semestre !== '--') {
        semestreVal = periodeForm.semestre === 'S1' ? 1 : 2
      } else if (periodeForm.trimestre && periodeForm.trimestre !== '' && periodeForm.trimestre !== '--') {
        const trimStr = periodeForm.trimestre.toString()
        if (trimStr.startsWith('T')) trimestreVal = parseInt(trimStr.replace('T', ''), 10)
        else if (trimStr.includes('Trimestre')) trimestreVal = parseInt(trimStr.replace('Trimestre ', ''), 10)
        else trimestreVal = parseInt(trimStr, 10)
      } else if (periodeForm.mois && periodeForm.mois !== '' && periodeForm.mois !== '--') {
        // le mois est stocké côté DB en nombre (1..12)
        const m = parseInt(periodeForm.mois, 10)
        if (Number.isFinite(m)) {
          moisVal = m
        } else {
          const moisToNum = {
            'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
            'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
          }
          moisVal = moisToNum[periodeForm.mois] ?? null
        }
      }

      const existing = periodes.find(p => {
        if (semestreVal !== null) return p.semestre === semestreVal && p.trimestre == null && p.mois == null
        if (trimestreVal !== null) return p.trimestre === trimestreVal && p.semestre == null && p.mois == null
        if (moisVal !== null) return p.mois === moisVal && p.semestre == null && p.trimestre == null
        return p.semestre == null && p.trimestre == null && p.mois == null
      })

      if (existing && (existing.statut === 'Fermé' || existing.statut === 'Fermée')) {
        // Libellé lisible
        const moisNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        const libelle = (() => {
          if (existing.mois) return `${moisNoms[existing.mois]}-${existing.annee}`
          if (existing.trimestre) return `T${existing.trimestre}-${existing.annee}`
          if (existing.semestre) return `S${existing.semestre}-${existing.annee}`
          return `${existing.annee}`
        })()

        showAlert('error', `La période "${libelle}" est fermée et ne peut pas être réouverte. Veuillez créer une nouvelle période.`)
        return
      }
    } catch (e) {
      // En cas d'échec de pré-vérification, on continue et l'API fera foi.
      console.warn('Pré-vérification périodes échouée:', e)
    }

    // Exigence métier:
    // Ne jamais pouvoir ouvrir une période "non encore échue" (today < date_fin).
    // On applique la même logique de calcul des dates que l'API côté serveur.
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      const y = parseInt(periodeForm.annee, 10)

      // Re-calculer semestre/trimestre/mois (mêmes règles que plus haut)
      let semestreVal = null
      let trimestreVal = null
      let moisVal = null
      if (periodeForm.semestre && periodeForm.semestre !== '' && periodeForm.semestre !== '--') {
        semestreVal = periodeForm.semestre === 'S1' ? 1 : 2
      } else if (periodeForm.trimestre && periodeForm.trimestre !== '' && periodeForm.trimestre !== '--') {
        const trimStr = periodeForm.trimestre.toString()
        if (trimStr.startsWith('T')) trimestreVal = parseInt(trimStr.replace('T', ''), 10)
        else if (trimStr.includes('Trimestre')) trimestreVal = parseInt(trimStr.replace('Trimestre ', ''), 10)
        else trimestreVal = parseInt(trimStr, 10)
      } else if (periodeForm.mois && periodeForm.mois !== '' && periodeForm.mois !== '--') {
        const m = parseInt(periodeForm.mois, 10)
        if (Number.isFinite(m)) moisVal = m
        else {
          const moisToNum = {
            'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
            'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
          }
          moisVal = moisToNum[periodeForm.mois] ?? null
        }
      }

      // Calcul date_fin
      let dateFin = null
      if (moisVal) {
        const lastDay = new Date(y, moisVal, 0).getDate()
        dateFin = `${y}-${String(moisVal).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      } else if (trimestreVal) {
        const moisFin = trimestreVal * 3
        const lastDay = new Date(y, moisFin, 0).getDate()
        dateFin = `${y}-${String(moisFin).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      } else if (semestreVal) {
        dateFin = semestreVal === 1 ? `${y}-06-30` : `${y}-12-31`
      } else {
        dateFin = `${y}-12-31`
      }

      if (dateFin && todayStr < dateFin) {
        const libelle = (() => {
          if (moisVal) {
            const moisNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
            return `${moisNoms[moisVal]}-${y}`
          }
          if (trimestreVal) return `T${trimestreVal}-${y}`
          if (semestreVal) return `S${semestreVal}-${y}`
          return `${y}`
        })()

        showAlert('error', `Impossible d'ouvrir la période "${libelle}" car elle n'est pas encore échue (fin prévue le ${dateFin}).`)
        return
      }
    } catch (e) {
      // Si calcul local échoue, on laisse l'API gérer.
      console.warn('Pré-vérification date_fin échouée:', e)
    }
    
    // Compter les indicateurs Risque actifs (ceux chargés via fetchData avec groupe=Risque)
    const nbIndicateursRisque = indicateurs.length
    const periodeLabel = `${periodeForm.annee}${periodeForm.semestre ? ' - ' + periodeForm.semestre : ''}${periodeForm.trimestre ? ' - ' + periodeForm.trimestre : ''}${periodeForm.mois ? ' - ' + periodeForm.mois : ''}`
    
    // Confirmation avant ouverture
    setConfirmAction({
      message: `Voulez-vous ouvrir la période ${periodeLabel} ?\n\nATTENTION: ${nbIndicateursRisque} indicateur(s) du groupe Risque vont ouvrir automatiquement une occurrence sur cette période.`,
      onConfirm: async () => {
        // Barre de progression : uniquement pour l'ouverture effective d'une nouvelle période
        // (pas pour les cas bloquants qui sont déjà interceptés avant la confirmation)
        setProgressOperation({ show: true, message: 'Ouverture de la période en cours...', progress: 10 })

        let progressInterval = null
        try {
          // Simuler une progression pendant l'exécution serveur
          progressInterval = setInterval(() => {
            setProgressOperation(prev => ({
              ...prev,
              progress: Math.min(prev.progress + 12, 85),
              message: prev.progress < 45 ? 'Création de la période...' : 'Création des occurrences...' 
            }))
          }, 450)

          const response = await fetch('/api/periodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...periodeForm, createur: user?.username })
          })

          const data = await response.json()

          if (progressInterval) clearInterval(progressInterval)
          setProgressOperation({ show: true, message: 'Finalisation...', progress: 100 })
          await new Promise(resolve => setTimeout(resolve, 450))
          setProgressOperation({ show: false, message: '', progress: 0 })
          
          if (response.ok) {
            const msg = data.reopened 
              ? 'Période rouverte avec succès' 
              : `Période ouverte avec succès.\n\n${data.nbOccurrencesCreees || 0} occurrence(s) d'indicateurs Risque créée(s).`
            showAlert('success', msg)
            setPeriodeOuverte(data.periode)
            setPeriodeAnalyse({
              annee: periodeForm.annee,
              semestre: periodeForm.semestre,
              trimestre: periodeForm.trimestre,
              mois: periodeForm.mois
            })
            setPeriodeForm({ annee: '', semestre: '', trimestre: '', mois: '', date_limite_saisie: '' })
          } else {
            showAlert('error', data.error || 'Erreur')
          }
        } catch (error) {
          if (progressInterval) clearInterval(progressInterval)
          setProgressOperation({ show: false, message: '', progress: 0 })
          console.error('Erreur:', error)
          showAlert('error', 'Erreur de connexion: ' + error.message)
        }
      }
    })
  }

  // Fonction pour ouvrir les occurrences manquantes de la période ouverte
  const handleOpenOccurrencesManquantes = async () => {
    if (!periodeOuverte) {
      showAlert('error', 'Aucune période n\'est actuellement ouverte')
      return
    }

    const periodLabel = `${periodeOuverte.annee}${periodeOuverte.semestre ? ' - Semestre ' + periodeOuverte.semestre : ''}${periodeOuverte.trimestre ? ' - Trimestre ' + periodeOuverte.trimestre : ''}${periodeOuverte.mois ? ' - ' + periodeOuverte.mois : ''}`
    
    setConfirmAction({
      message: `Voulez-vous créer les occurrences manquantes pour la période ${periodLabel} ?\n\nCela créera une occurrence pour chaque indicateur Risque actif qui n'en a pas encore sur cette période.\n\nLa date limite de saisie sera: ${new Date(periodeOuverte.date_limite_saisie).toLocaleDateString('fr-FR')}`,
      onConfirm: async () => {
        // Afficher la barre de progression immédiatement
        setProgressOperation({ show: true, message: 'Création des occurrences manquantes...', progress: 10 })
        
        try {
          // Simuler une progression
          const progressInterval = setInterval(() => {
            setProgressOperation(prev => ({
              ...prev,
              progress: Math.min(prev.progress + 15, 85)
            }))
          }, 400)
          
          const response = await fetch('/api/periodes/occurrences-manquantes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              annee: periodeOuverte.annee,
              semestre: periodeOuverte.semestre,
              trimestre: periodeOuverte.trimestre,
              mois: periodeOuverte.mois,
              date_limite_saisie: periodeOuverte.date_limite_saisie
            })
          })
          
          clearInterval(progressInterval)
          setProgressOperation({ show: true, message: 'Finalisation...', progress: 100 })
          
          const data = await response.json()
          
          // Garder la barre visible un moment
          await new Promise(resolve => setTimeout(resolve, 500))
          
          setProgressOperation({ show: false, message: '', progress: 0 })
          
          if (response.ok) {
            showAlert('success', `${data.nbOccurrencesCreees || 0} occurrence(s) créée(s) avec succès.`)
          } else {
            showAlert('error', data.error || 'Erreur')
          }
        } catch (error) {
          setProgressOperation({ show: false, message: '', progress: 0 })
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de la création des occurrences: ' + error.message)
        }
      }
    })
  }

  // Fonction pour initier la fermeture de période
  const handleInitFermeturePeriode = async () => {
    if (!periodeOuverte) {
      showAlert('error', 'Aucune période ouverte à fermer')
      return
    }
    
    console.log('🔄 Début fermeture période:', periodeOuverte.id)
    
    // Afficher la barre de progression
    setProgressOperation({ show: true, message: 'Vérification des conditions de fermeture...', progress: 20 })
    
    try {
      // Progression simulée
      setProgressOperation(prev => ({ ...prev, progress: 40 }))
      
      console.log('📤 Appel API /api/periodes/fermeture')
      
      const response = await fetch('/api/periodes/fermeture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', periodeId: periodeOuverte.id })
      })
      
      console.log('📥 Réponse status:', response.status)
      
      setProgressOperation(prev => ({ ...prev, progress: 70, message: 'Analyse des résultats...' }))
      
      const data = await response.json()
      
      console.log('📊 Données reçues:', JSON.stringify(data, null, 2))
      
      setProgressOperation(prev => ({ ...prev, progress: 100 }))
      
      // Attendre un peu pour voir la progression à 100%
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Cacher la barre de progression
      setProgressOperation({ show: false, message: '', progress: 0 })
      
      // Gérer les erreurs HTTP
      if (!response.ok) {
        console.error('❌ Erreur HTTP:', data.error)
        showAlert('error', data.error || 'Erreur lors de la vérification')
        return
      }
      
      // Stocker les données de vérification
      setFermetureData(data)
      
      console.log('✅ canClose:', data.canClose, 'hasBlockingIssues:', data.hasBlockingIssues)
      
      // Décider quoi afficher
      if (data.hasBlockingIssues) {
        // Il y a des risques non évalués - blocage total
        console.log('🚫 Blocage: risques non évalués')
        setFermetureStep('verify')
        setShowFermetureModal(true)
      } else if (!data.canClose) {
        // Il y a des indicateurs non renseignés - afficher les problèmes
        console.log('⚠️ Avertissement: indicateurs non renseignés')
        setFermetureStep('verify')
        setShowFermetureModal(true)
      } else {
        // Tout est OK - passer à la confirmation
        console.log('✅ OK: passage au formulaire de confirmation')
        setFermetureStep('confirm')
        setFermetureCheckboxes({
          cartographie: false,
          infoNonModifiable: false,
          modifNImpacte: false,
          occurrencesArchivees: false
        })
        setFichierCartographie(null)
        setShowFermetureModal(true)
      }
      
    } catch (error) {
      setProgressOperation({ show: false, message: '', progress: 0 })
      console.error('❌ Erreur handleInitFermeturePeriode:', error)
      showAlert('error', 'Erreur de connexion au serveur: ' + error.message)
    }
  }

  // Fonction pour exécuter la fermeture de période
  const handleExecuteFermeture = async () => {
    if (!periodeOuverte || !fichierCartographie) return
    
    const allChecked = Object.values(fermetureCheckboxes).every(v => v)
    if (!allChecked) {
      showAlert('error', 'Veuillez cocher toutes les cases de confirmation')
      return
    }
    
    setFermetureStep('progress')
    setProgressOperation({ show: true, message: 'Archivage des données en cours...', progress: 10 })
    
    try {
      // Simuler la progression
      const progressInterval = setInterval(() => {
        setProgressOperation(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }))
      }, 500)
      
      const response = await fetch('/api/periodes/fermeture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          periodeId: periodeOuverte.id,
          fichierCartographie: fichierCartographie,
          modificateur: user?.username
        })
      })
      
      clearInterval(progressInterval)
      
      const data = await response.json()
      
      if (response.ok) {
        setProgressOperation({ show: true, message: 'Fermeture terminée !', progress: 100 })
        setFermetureStep('done')
        
        setTimeout(() => {
          setShowFermetureModal(false)
          setProgressOperation({ show: false, message: '', progress: 0 })
          setPeriodeOuverte(null)
          // Message conforme aux règles métier:
          // - risques archivés = total risques évalués (qualitatifs + quantitatifs)
          // - indicateurs archivés = total indicateurs du groupe risques renseignés et archivés
          showAlert('success', `Période fermée avec succès. ${data.archived?.risques || 0} risques et ${data.archived?.indicateurs || data.archived?.occurrences || 0} indicateurs archivés.`)
        }, 1500)
      } else {
        setProgressOperation({ show: false, message: '', progress: 0 })
        showAlert('error', data.error || 'Erreur lors de la fermeture')
        setFermetureStep('confirm')
      }
    } catch (error) {
      setProgressOperation({ show: false, message: '', progress: 0 })
      console.error('Erreur:', error)
      showAlert('error', 'Erreur de connexion')
      setFermetureStep('confirm')
    }
  }

  // Fonction pour gérer l'upload du fichier cartographie
  const handleCartographieUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (file.type !== 'application/pdf') {
      showAlert('error', 'Seuls les fichiers PDF sont acceptés')
      return
    }
    
    // Convertir en base64 pour stockage (ou utiliser Supabase Storage)
    const reader = new FileReader()
    reader.onload = (e) => {
      setFichierCartographie(e.target.result)
      setFermetureCheckboxes(prev => ({ ...prev, cartographie: true }))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProcessus = async (e) => {
    e.preventDefault()
    try {
      const method = selectedProcessus ? 'PUT' : 'POST'
      const response = await fetch('/api/processus', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...processusForm, id: selectedProcessus?.id, createur: user?.username, modificateur: user?.username })
      })
      if (response.ok) {
        setShowProcessusModal(false)
        fetchData()
      } else {
        const data = await response.json()
        showAlert('error', data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const handleDeleteProcessus = async (p) => {
    setConfirmAction({
      message: `Supprimer le processus ${p.code_processus} ?`,
      onConfirm: async () => {
        try {
          await fetch(`/api/processus?id=${p.id}`, { method: 'DELETE' })
          fetchData()
          showAlert('success', 'Processus supprimé')
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de la suppression')
        }
      }
    })
  }

  const handleSaveCategorie = async (e) => {
    e.preventDefault()
    try {
      const method = selectedCategorie ? 'PUT' : 'POST'
      const response = await fetch('/api/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...categorieForm, id: selectedCategorie?.id, createur: user?.username, modificateur: user?.username })
      })
      if (response.ok) {
        setShowCategorieModal(false)
        fetchData()
      } else {
        const data = await response.json()
        showAlert('error', data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const handleDeleteCategorie = async (c) => {
    setConfirmAction({
      message: `Supprimer la catégorie "${c.libelle_categorie}" ?`,
      onConfirm: async () => {
        try {
          await fetch(`/api/categories?id=${c.id}`, { method: 'DELETE' })
          fetchData()
          showAlert('success', 'Catégorie supprimée')
        } catch (error) {
          console.error('Erreur:', error)
          showAlert('error', 'Erreur lors de la suppression')
        }
      }
    })
  }

  // Filtrer les risques selon les permissions et les filtres
  const filteredRisques = risques.filter(r => {
    // D'abord vérifier si l'utilisateur peut voir ce risque
    if (!canViewRisk(r)) return false
    // Ensuite appliquer les filtres
    if (filters.categorie && (!r.categories || !r.categories.includes(parseInt(filters.categorie)))) return false
    if (filters.structure && r.code_structure !== filters.structure) return false
    if (filters.qualitatif && r.qualitatif !== filters.qualitatif) return false
    if (filters.processus && r.code_processus !== filters.processus) return false
    if (filters.search) {
      const s = filters.search.toLowerCase()
      return r.code_risque?.toLowerCase().includes(s) || r.libelle_risque?.toLowerCase().includes(s)
    }
    return true
  })

  const filteredProcessus = processus.filter(p => {
    if (processusFilter.statut && p.statut !== processusFilter.statut) return false
    if (processusFilter.search) {
      const s = processusFilter.search.toLowerCase()
      return p.code_processus?.toLowerCase().includes(s) || p.libelle_processus?.toLowerCase().includes(s)
    }
    return true
  })

  const filteredCategories = categories.filter(c => {
    if (categorieFilter.statut && c.statut !== categorieFilter.statut) return false
    if (categorieFilter.search) {
      return c.libelle_categorie?.toLowerCase().includes(categorieFilter.search.toLowerCase())
    }
    return true
  })

  // Risques pour Analyse
  const analyseRisques = risques.filter(r => {
    if (analyseFilters.structure && r.code_structure !== analyseFilters.structure) return false
    if (analyseFilters.processus && r.code_processus !== analyseFilters.processus) return false
    if (analyseFilters.categorie && (!r.categories || !r.categories.includes(parseInt(analyseFilters.categorie)))) return false
    return r.statut === 'Actif'
  })

  // Colonnes du tableau risques - largeurs proportionnelles selon spécifications
  // Code_risque = référence (1x), autres colonnes en multiple de celle-ci
  const baseWidth = 80 // largeur de référence pour Code_risque
  const riskColumns = [
    { key: 'code_risque', label: 'Code', width: `${baseWidth}px`, render: (v) => <span className="font-mono font-bold text-blue-600 text-[11px]">{v}</span> },
    { key: 'libelle_risque', label: 'Libellé risque', width: `${baseWidth * 5.5}px`, render: (v) => <span className="text-[11px] line-clamp-2" title={v}>{v}</span> },
    { key: 'code_processus', label: 'Code proc.', width: `${baseWidth}px`, render: (v) => <span className="font-mono text-[11px]">{v}</span> },
    { key: 'processus_libelle', label: 'Libellé processus', width: `${baseWidth * 5}px`, render: (v, row) => <span className="text-[11px] line-clamp-2" title={row.processus?.libelle_processus}>{row.processus?.libelle_processus || '-'}</span> },
    { key: 'cause', label: 'Cause', width: `${baseWidth * 5}px`, render: (v) => <span className="text-gray-600 text-[11px] line-clamp-2" title={v}>{v || '-'}</span> },
    { key: 'consequence', label: 'Conséquence', width: `${baseWidth * 5}px`, render: (v) => <span className="text-gray-600 text-[11px] line-clamp-2" title={v}>{v || '-'}</span> },
    { key: 'impact', label: 'Impact', width: `${baseWidth}px`, render: (v) => {
      const val = typeof v === 'string' ? parseInt(v.split('-')[0]) : v
      return <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${val >= 4 ? 'bg-red-500' : val >= 3 ? 'bg-orange-500' : val >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{v}</span>
    }},
    { key: 'efficacite_contr', label: 'Eff. Ctrl', width: `${baseWidth}px`, render: (v) => {
      const val = typeof v === 'string' ? parseInt(v.split('-')[0]) : v
      return <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${val <= 1 ? 'bg-green-500' : val <= 2 ? 'bg-yellow-500' : val <= 3 ? 'bg-orange-500' : 'bg-red-500'}`}>{v}</span>
    }},
    { key: 'indicateur', label: 'Indicateur', width: `${baseWidth * 5}px`, render: (v, row) => <span className="text-[11px] line-clamp-2" title={row.indicateur?.libelle_indicateur}>{row.indicateur?.libelle_indicateur || (row.qualitatif === 'Oui' ? <em className="text-gray-400">Qualitatif</em> : '-')}</span> },
    { key: 'statut', label: 'Statut', width: `${baseWidth}px`, render: (v) => <StatusBadge status={v} /> }
  ]

  // Actions sur les risques - 3 boutons : Supprimer, Éditer, Voir actions standards
  const riskActions = [
    { icon: Trash2, label: 'Supprimer', onClick: handleDeleteRisk, className: 'hover:bg-red-50 text-red-500' },
    { icon: Edit, label: 'Éditer', onClick: handleEditRisk, className: 'hover:bg-blue-50 text-blue-500' },
    { icon: List, label: 'Actions standards', onClick: handleActionsStandards, className: 'hover:bg-purple-50 text-purple-500' }
  ]

  const renderIdentification = () => (
    <div>
      {/* Ligne des boutons Nouveau risque et Actions standards */}
      <div className="flex items-center gap-3 mb-4">
        {canEdit() && <Button icon={Plus} onClick={handleCreateRisk}>Nouveau risque</Button>}
        <Button variant="secondary" icon={List} onClick={handleShowAllActions}>
          Actions standards
        </Button>
      </div>

      {/* Cadre des filtres - tous sur la même ligne */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[140px]">
            <SearchableSelect
              label="Catégorie"
              size="sm"
              value={filters.categorie || ''}
              onChange={(v) => setFilters({ ...filters, categorie: v })}
              options={[
                { value: '', label: 'Toutes' },
                ...categories.filter(c => c.statut === 'Actif').map(c => ({
                  value: c.code_categorie?.toString(),
                  label: c.libelle_categorie
                }))
              ]}
              placeholder="Toutes"
            />
          </div>
          <div className="w-[140px]">
            <SearchableSelect
              label="Structure"
              size="sm"
              value={filters.structure || ''}
              onChange={(v) => setFilters({ ...filters, structure: v })}
              options={[
                { value: '', label: 'Toutes' },
                ...structures.map(s => ({
                  value: s.code_structure,
                  label: s.libelle_structure
                }))
              ]}
              placeholder="Toutes"
            />
          </div>
          <div className="w-[90px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Qualitatif</label>
            <select value={filters.qualitatif || ''} onChange={(e) => setFilters({ ...filters, qualitatif: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
              <option value="">Tous</option>
              <option value="Oui">Oui</option>
              <option value="Non">Non</option>
            </select>
          </div>
          <div className="w-[160px]">
            <SearchableSelect
              label="Processus"
              size="sm"
              value={filters.processus || ''}
              onChange={(v) => setFilters({ ...filters, processus: v })}
              options={[
                { value: '', label: 'Tous' },
                ...processus.filter(p => p.statut === 'Actif').map(p => ({
                  value: p.code_processus,
                  label: p.libelle_processus
                }))
              ]}
              placeholder="Tous"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-gray-500 mb-0.5">Recherche</label>
            <input type="text" placeholder="Code, libellé..." value={filters.search || ''} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
          </div>
          <button onClick={() => setFilters({})} className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50" title="Réinitialiser les filtres">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Ligne avec exports et compteurs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={FileSpreadsheet} size="sm" onClick={handleExportRisques}>
            Export risques
          </Button>
          <Button variant="secondary" icon={FileSpreadsheet} size="sm" onClick={handleExportActions}>
            Export actions
          </Button>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="bg-gray-100 px-3 py-1.5 rounded-lg">
            Nb risques total: <strong className="text-gray-900">{filteredRisques.length}</strong>
          </span>
          <span className="bg-green-50 px-3 py-1.5 rounded-lg text-green-700">
            Risques actifs: <strong>{filteredRisques.filter(r => r.statut === 'Actif').length}</strong>
          </span>
        </div>
      </div>

      {/* Tableau des risques */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '550px' }}>
          <table className="w-full text-[10px]" style={{ minWidth: '1800px' }}>
            <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-20">
              <tr>
                <th className="px-2 py-2 text-left text-white whitespace-nowrap sticky left-0 bg-[#1a365d] z-30" style={{ width: '80px', minWidth: '80px' }}>Code</th>
                <th className="px-2 py-2 text-left text-white whitespace-nowrap sticky left-[80px] bg-[#1a365d] z-30" style={{ width: '250px', minWidth: '250px' }}>Libellé risque</th>
                <th className="px-2 py-2 text-left text-white whitespace-nowrap" style={{ width: '80px' }}>Code proc.</th>
                <th className="px-2 py-2 text-left text-white whitespace-nowrap" style={{ width: '200px' }}>Libellé processus</th>
                <th className="px-2 py-2 text-left text-white whitespace-nowrap" style={{ width: '200px' }}>Cause</th>
                <th className="px-2 py-2 text-left text-white whitespace-nowrap" style={{ width: '200px' }}>Conséquence</th>
                <th className="px-2 py-2 text-center text-white whitespace-nowrap" style={{ width: '70px' }}>Impact</th>
                <th className="px-2 py-2 text-center text-white whitespace-nowrap" style={{ width: '70px' }}>Eff. Ctrl</th>
                <th className="px-2 py-2 text-left text-white whitespace-nowrap" style={{ width: '200px' }}>Indicateur</th>
                <th className="px-2 py-2 text-center text-white whitespace-nowrap" style={{ width: '70px' }}>Statut</th>
                <th className="px-2 py-2 text-center text-white whitespace-nowrap sticky right-0 bg-[#2c5282] z-30" style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      Chargement...
                    </div>
                  </td>
                </tr>
              ) : filteredRisques.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500">
                    Aucun risque trouvé
                  </td>
                </tr>
              ) : (
                filteredRisques.map((row) => {
                  const impactVal = typeof row.impact === 'string' ? parseInt(row.impact.split('-')[0]) : row.impact
                  const effVal = typeof row.efficacite_contr === 'string' ? parseInt(row.efficacite_contr.split('-')[0]) : row.efficacite_contr
                  return (
                    <tr key={row.id || row.code_risque} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 sticky left-0 bg-white z-10" style={{ minWidth: '80px' }}>
                        <span className="font-mono font-bold text-blue-600 text-[11px]">{row.code_risque}</span>
                      </td>
                      <td className="px-2 py-1.5 sticky left-[80px] bg-white z-10" style={{ minWidth: '250px' }}>
                        <span className="text-[11px] line-clamp-2" title={row.libelle_risque}>{row.libelle_risque}</span>
                      </td>
                      <td className="px-2 py-1.5"><span className="font-mono text-[11px]">{row.code_processus}</span></td>
                      <td className="px-2 py-1.5"><span className="text-[11px] line-clamp-2" title={row.processus?.libelle_processus}>{row.processus?.libelle_processus || '-'}</span></td>
                      <td className="px-2 py-1.5"><span className="text-gray-600 text-[11px] line-clamp-2" title={row.cause}>{row.cause || '-'}</span></td>
                      <td className="px-2 py-1.5"><span className="text-gray-600 text-[11px] line-clamp-2" title={row.consequence}>{row.consequence || '-'}</span></td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${impactVal >= 4 ? 'bg-red-500' : impactVal >= 3 ? 'bg-orange-500' : impactVal >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{row.impact}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${effVal <= 1 ? 'bg-green-500' : effVal <= 2 ? 'bg-yellow-500' : effVal <= 3 ? 'bg-orange-500' : 'bg-red-500'}`}>{row.efficacite_contr}</span>
                      </td>
                      <td className="px-2 py-1.5"><span className="text-[11px] line-clamp-2" title={row.indicateur?.libelle_indicateur}>{row.indicateur?.libelle_indicateur || (row.qualitatif === 'Oui' ? <em className="text-gray-400">Qualitatif</em> : '-')}</span></td>
                      <td className="px-2 py-1.5 text-center"><StatusBadge status={row.statut} /></td>
                      <td className="px-2 py-1.5 text-center sticky right-0 bg-white z-10">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit() ? (
                            <>
                              <button onClick={() => handleDeleteRisk(row)} className="p-1 rounded hover:bg-red-100 text-red-500" title="Supprimer"><Trash2 size={12} /></button>
                              <button onClick={() => handleEditRisk(row)} className="p-1 rounded hover:bg-blue-100 text-blue-500" title="Éditer"><Edit size={12} /></button>
                              <button onClick={() => handleActionsStandards(row)} className="p-1 rounded hover:bg-purple-100 text-purple-500" title="Actions standards"><List size={12} /></button>
                            </>
                          ) : (
                            <button onClick={() => handleEditRisk(row)} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Voir"><Eye size={12} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // States pour l'évaluation
  const [evaluationFilters, setEvaluationFilters] = useState({ annee: new Date().getFullYear().toString(), semestre: '', trimestre: '', mois: '' })
  const [quantificationData, setQuantificationData] = useState({})
  // States pour l'analyse (période) - par défaut période ouverte
  const [periodeAnalyse, setPeriodeAnalyse] = useState({ annee: '', semestre: '', trimestre: '', mois: '' })
  const [periodeOuverte, setPeriodeOuverte] = useState(null)

  // Par défaut, sur Analyse : période ouverte si existante, sinon période la plus récente (date_fin max)
  useEffect(() => {
    const hasSelection = !!(periodeAnalyse.annee || periodeAnalyse.semestre || periodeAnalyse.trimestre || periodeAnalyse.mois)
    if (hasSelection) return
    if (periodeOuverte) {
      setPeriodeAnalyse(periodeToFormShort(periodeOuverte))
      return
    }
    const mostRecent = getMostRecentPeriode(allPeriodes)
    if (mostRecent) setPeriodeAnalyse(periodeToFormShort(mostRecent))
  }, [periodeOuverte, allPeriodes])
  const [showAnalyseModal, setShowAnalyseModal] = useState(false)
  const [selectedAnalyseRisk, setSelectedAnalyseRisk] = useState(null)
  const [analyseFormData, setAnalyseFormData] = useState({})
  const [indicateurOccurrences, setIndicateurOccurrences] = useState([])
  const [risquesProbabilites, setRisquesProbabilites] = useState([]) // Probabilités manuelles des risques qualitatifs

  // Charger la période ouverte et toutes les périodes au chargement
  useEffect(() => {
    const fetchPeriodes = async () => {
      try {
        // Charger toutes les périodes
        const allRes = await fetch('/api/periodes')
        if (allRes.ok) {
          const allData = await allRes.json()
          setAllPeriodes(allData.periodes || [])
          
          // Charger la période ouverte
          const res = await fetch('/api/periodes?statut=Ouvert')
          if (res.ok) {
            const data = await res.json()
            if (data.periodes && data.periodes.length > 0) {
              const po = data.periodes[0]
              setPeriodeOuverte(po)
              // Définir les filtres par défaut selon la période ouverte pour toutes les sous-rubriques
              const defaultPeriode = {
                annee: po.annee?.toString() || '',
                semestre: po.semestre ? `S${po.semestre}` : '',
                trimestre: po.trimestre ? `T${po.trimestre}` : '',
                mois: po.mois ? moisList[po.mois - 1] : ''
              }
              setPeriodeAnalyse(defaultPeriode)
              setPeriodeEvaluation({
                annee: po.annee?.toString() || '',
                semestre: po.semestre ? `Semestre ${po.semestre}` : '',
                trimestre: po.trimestre ? `Trimestre ${po.trimestre}` : '',
                mois: po.mois ? moisList[po.mois - 1] : ''
              })
              setPeriodeCarto({
                annee: po.annee?.toString() || '',
                semestre: po.semestre ? `Semestre ${po.semestre}` : '',
                trimestre: po.trimestre ? `Trimestre ${po.trimestre}` : '',
                mois: po.mois ? moisList[po.mois - 1] : ''
              })
              setPeriodePlan({
                annee: po.annee?.toString() || '',
                semestre: po.semestre ? `Semestre ${po.semestre}` : '',
                trimestre: po.trimestre ? `Trimestre ${po.trimestre}` : '',
                mois: po.mois ? moisList[po.mois - 1] : ''
              })
              setSynthesePeriode({
                annee: po.annee?.toString() || '',
                // Une seule valeur selon la hiérarchie : Mois > Trimestre > Semestre > Année
                semestre: (!po.mois && !po.trimestre && po.semestre) ? `Semestre ${po.semestre}` : '',
                trimestre: (!po.mois && po.trimestre) ? `Trimestre ${po.trimestre}` : '',
                mois: po.mois ? moisList[po.mois - 1] : ''
              })
            } else {
              // Si aucune période ouverte, prendre la plus récente
              const periodes = allData.periodes || []
              if (periodes.length > 0) {
                const mostRecent = getMostRecentPeriode(periodes)
                if (mostRecent) {
                  const defaultPeriode = {
                    annee: mostRecent.annee?.toString() || '',
                    semestre: mostRecent.semestre ? `S${mostRecent.semestre}` : '',
                    trimestre: mostRecent.trimestre ? `T${mostRecent.trimestre}` : '',
                    mois: mostRecent.mois ? moisList[mostRecent.mois - 1] : ''
                  }
                  setPeriodeAnalyse(defaultPeriode)
                  setPeriodeEvaluation({
                    annee: mostRecent.annee?.toString() || '',
                    semestre: mostRecent.semestre ? `Semestre ${mostRecent.semestre}` : '',
                    trimestre: mostRecent.trimestre ? `Trimestre ${mostRecent.trimestre}` : '',
                    mois: mostRecent.mois ? moisList[mostRecent.mois - 1] : ''
                  })
                  setPeriodeCarto({
                    annee: mostRecent.annee?.toString() || '',
                    semestre: mostRecent.semestre ? `Semestre ${mostRecent.semestre}` : '',
                    trimestre: mostRecent.trimestre ? `Trimestre ${mostRecent.trimestre}` : '',
                    mois: mostRecent.mois ? moisList[mostRecent.mois - 1] : ''
                  })
                  setPeriodePlan({
                    annee: mostRecent.annee?.toString() || '',
                    semestre: mostRecent.semestre ? `Semestre ${mostRecent.semestre}` : '',
                    trimestre: mostRecent.trimestre ? `Trimestre ${mostRecent.trimestre}` : '',
                    mois: mostRecent.mois ? moisList[mostRecent.mois - 1] : ''
                  })
                  setSynthesePeriode({
                    annee: mostRecent.annee?.toString() || '',
                    // Une seule valeur selon la hiérarchie : Mois > Trimestre > Semestre > Année
                    semestre: (!mostRecent.mois && !mostRecent.trimestre && mostRecent.semestre) ? `Semestre ${mostRecent.semestre}` : '',
                    trimestre: (!mostRecent.mois && mostRecent.trimestre) ? `Trimestre ${mostRecent.trimestre}` : '',
                    mois: mostRecent.mois ? moisList[mostRecent.mois - 1] : ''
                  })
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur chargement périodes:', error)
      }
    }
    fetchPeriodes()
  }, [])

  // Années de 2023 à 2050
  const yearsExtended = Array.from({ length: 2050 - 2023 + 1 }, (_, i) => 2023 + i)

  // Vérifier si la période sélectionnée est ouverte
  const isPeriodeOuverte = () => {
    if (!periodeOuverte || !periodeAnalyse.annee) return false
    if (periodeOuverte.annee?.toString() !== periodeAnalyse.annee) return false
    if (periodeAnalyse.semestre && periodeOuverte.semestre !== parseInt(periodeAnalyse.semestre.replace('S', ''))) return false
    if (periodeAnalyse.trimestre && periodeOuverte.trimestre !== parseInt(periodeAnalyse.trimestre.replace('T', ''))) return false
    if (periodeAnalyse.mois && periodeOuverte.mois !== moisList.indexOf(periodeAnalyse.mois) + 1) return false
    return true
  }

  // Vérifier si l'utilisateur peut modifier (STRICTEMENT si la période sélectionnée est ouverte)
  // Exigence: lorsqu'une période est fermée, tout le module Analyse est en lecture seule, y compris pour les admins.
  const canModifyAnalyse = () => {
    if (!isPeriodeOuverte()) return false
    return canEdit()
  }

  // Fonction pour ouvrir le modal d'édition analyse
  const handleEditAnalyse = (risque) => {
    const selectedPeriode = getSelectedPeriode()
    const isQualitatif = risque.qualitatif === 'Oui' || !risque.code_indicateur
    const periodeKey = getPeriodeKey()
    
    // Utiliser la fonction centralisée pour récupérer la probabilité
    const probData = getRisqueProbabilite(risque, periodeKey)

    // Seuils (utilisés uniquement pour affichage/compat)
    const seuils = probData.seuils || {
      seuil1: risque.indicateur?.seuil1 || risque.indicateur?.seuil_1,
      seuil2: risque.indicateur?.seuil2 || risque.indicateur?.seuil_2,
      seuil3: risque.indicateur?.seuil3 || risque.indicateur?.seuil_3
    }
    
    // Valeur de l'indicateur depuis l'occurrence (pas de valeur pour les qualitatifs)
    const valInd = probData.valInd
    const hasValInd = probData.hasValInd
    const storedProba = probData.storedProba || ''
    const calculatedProba = probData.calculatedProba
    const probDisplay = probData.probDisplay
    const hasProb = probData.hasProb
    const indicOcc = probData.indicOcc

    // Commentaires (si une probabilité manuelle existe déjà)
    const probRisqueRow = risquesProbabilites.find(rp => rp.code_risque === risque.code_risque && rp.periode === periodeKey)
    const commentairesInit = probRisqueRow?.commentaires || ''
    
    // Date de saisie :
    // - Si indicateur saisi (hasValInd) → utiliser date_saisie de l'occurrence
    // - Si probabilité saisie manuellement → utiliser date_modification depuis risques_probabilites ou occurrence
    let dateSaisieAnalyse = null
    if (hasValInd) {
      dateSaisieAnalyse = indicOcc?.date_saisie || null
    } else if (storedProba) {
      // Chercher date dans risques_probabilites en priorité
      dateSaisieAnalyse = probRisqueRow?.date_modification || indicOcc?.date_modification || null
    }
    
    // Date limite de la période
    const dateLimite = selectedPeriode?.date_limite_saisie || null
    
    // Calcul du retard
    let retardJours = null
    if (dateLimite) {
      const dlNorm = new Date(new Date(dateLimite + 'T00:00:00').getFullYear(), new Date(dateLimite + 'T00:00:00').getMonth(), new Date(dateLimite + 'T00:00:00').getDate())
      if (hasProb && dateSaisieAnalyse) {
        const ds = new Date(dateSaisieAnalyse)
        const dsNorm = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate())
        retardJours = Math.max(0, Math.floor((dsNorm - dlNorm) / (1000 * 60 * 60 * 24)))
      } else {
        const aujourdhui = new Date()
        const ajdNorm = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())
        retardJours = Math.max(0, Math.floor((ajdNorm - dlNorm) / (1000 * 60 * 60 * 24)))
      }
    }
    
    // Niveau de retard
    const nivRetard = retardJours !== null ? (retardJours <= 0 ? 'Pas retard' : 'Retard') : '-'
    
    // Type indicateur pour affichage (vérifier si c'est un taux)
    // Types de taux: "Taux", "TxCalcule", ou tout type contenant "taux" ou "%"
    const typeIndic = risque.indicateur?.type_indicateur || ''
    const isTaux = typeIndic === 'Taux' || typeIndic === 'TxCalcule' || typeIndic.toLowerCase().includes('taux') || typeIndic.includes('%')
    
    // Formater la valeur : ajouter % si taux, limiter à 2 décimales
    let valIndDisplay = '-'
    if (hasValInd) {
      const numVal = parseFloat(valInd)
      if (isTaux) {
        // Formater avec 2 décimales max pour les taux
        const formatted = Number.isInteger(numVal) ? numVal.toString() : numVal.toFixed(2).replace(/\.?0+$/, '')
        valIndDisplay = `${formatted}%`
      } else {
        valIndDisplay = valInd.toString()
      }
    }
    
    setSelectedAnalyseRisk(risque)
    // Calcul de l'impact net (doit correspondre exactement à la colonne "Imp. net" du tableau Analyse)
    const impactNetCalc = calculateImpactNet(risque.impact, risque.efficacite_contr)

    setAnalyseFormData({
      periode: getPeriodeKey(),
      code_risque: risque.code_risque,
      libelle_risque: risque.libelle_risque,
      code_processus: risque.code_processus,
      libelle_processus: risque.processus?.libelle_processus || '',
      impact: risque.impact,
      efficacite_contr: risque.efficacite_contr,
      impact_net: impactNetCalc,
      qualitatif: risque.qualitatif,
      indic_obtenu: hasValInd ? 'Oui' : 'Non',
      libelle_indicateur: risque.indicateur?.libelle_indicateur || '',
      type_indicateur: typeIndic || '',
      val_indicateur: valInd || '',
      val_indicateur_display: valIndDisplay,
      probabilite: probDisplay,
      // Responsable: pour les risques qualitatifs, utiliser les emails des gestionnaires de risques
      responsable: isQualitatif ? getGestionnairesRisquesEmails() : (risque.indicateur?.responsable || ''),
      date_limite: dateLimite,
      date_saisie: dateSaisieAnalyse,
      retard: retardJours,
      niv_retard: nivRetard,
      // Données supplémentaires pour la sauvegarde
      code_indicateur: risque.code_indicateur,
      seuil1: seuils.seuil1,
      seuil2: seuils.seuil2,
      seuil3: seuils.seuil3,
      sens: risque.indicateur?.sens,
      commentaires: commentairesInit,
      // Flag pour savoir si val_indicateur est vide (pour activer le champ probabilité)
      // Pour les risques qualitatifs, c'est toujours true car ils n'ont pas d'indicateur
      val_indicateur_vide: isQualitatif || !hasValInd
    })
    setShowAnalyseModal(true)
  }

  // Générer la clé de période (format cohérent avec le champ "periode" de la table indicateur_occurrences)
  // Format: Mois-Année, T1-Année, S1-Année, ou Année
  const getPeriodeKey = () => {
    if (!periodeAnalyse.annee) return ''
    if (periodeAnalyse.mois) return `${periodeAnalyse.mois}-${periodeAnalyse.annee}`
    if (periodeAnalyse.trimestre) return `${periodeAnalyse.trimestre}-${periodeAnalyse.annee}`
    if (periodeAnalyse.semestre) return `${periodeAnalyse.semestre}-${periodeAnalyse.annee}`
    return periodeAnalyse.annee
  }

  // Générer le libellé de la période (même format que getPeriodeKey)
  const getPeriodeLibelle = () => {
    return getPeriodeKey()
  }

  // Obtenir la période sélectionnée depuis allPeriodes
  const getSelectedPeriode = () => {
    if (!periodeAnalyse.annee) return null
    return allPeriodes.find(p => {
      if (p.annee?.toString() !== periodeAnalyse.annee) return false
      if (periodeAnalyse.semestre) {
        return p.semestre === parseInt(periodeAnalyse.semestre.replace('S', ''))
      }
      if (periodeAnalyse.trimestre) {
        return p.trimestre === parseInt(periodeAnalyse.trimestre.replace('T', ''))
      }
      if (periodeAnalyse.mois) {
        return p.mois === moisList.indexOf(periodeAnalyse.mois) + 1
      }
      // Annuel (pas de semestre, trimestre ou mois)
      return !p.semestre && !p.trimestre && !p.mois
    })
  }

  // Calcul automatique de val_indicateur
  const calculateValIndicateur = (formData) => {
    if (formData.qualitatif === 'Oui') return ''
    if (!formData.val_numerateur) return ''
    if (formData.type_indicateur === 'Nombre') {
      return parseFloat(formData.val_numerateur)
    }
    if (formData.type_indicateur === 'Taux') {
      if (!formData.val_denominateur || parseFloat(formData.val_denominateur) === 0) return ''
      return ((parseFloat(formData.val_numerateur) / parseFloat(formData.val_denominateur)) * 100).toFixed(2)
    }
    return ''
  }

  // Calcul automatique de la probabilité basée sur les seuils (S1 < S2 < S3)
  // Pour un indicateur Positif: val >= S3 → 1 (faible), val >= S2 → 2, val >= S1 → 3, val < S1 → 4 (élevé)
  // Pour un indicateur Négatif: val <= S1 → 1 (faible), val <= S2 → 2, val <= S3 → 3, val > S3 → 4 (élevé)
  const calculateProbabilite = (valIndicateur, seuils, sens) => {
    if (valIndicateur === null || valIndicateur === undefined || valIndicateur === '') return ''
    if (!seuils?.seuil1) return ''
    
    const val = parseFloat(valIndicateur)
    const s1 = parseFloat(seuils.seuil1)
    const s2 = parseFloat(seuils.seuil2)
    const s3 = parseFloat(seuils.seuil3)
    
    if (isNaN(val) || isNaN(s1) || isNaN(s2) || isNaN(s3)) return ''
    
    if (sens === 'Positif') {
      // Plus la valeur est haute, moins le risque est élevé
      if (val >= s3) return 1  // Très faible
      if (val >= s2) return 2  // Faible
      if (val >= s1) return 3  // Moyen
      return 4                  // Élevé
    } else {
      // Plus la valeur est basse, moins le risque est élevé
      if (val <= s1) return 1  // Très faible
      if (val <= s2) return 2  // Faible
      if (val <= s3) return 3  // Moyen
      return 4                  // Élevé
    }
  }

  // Enregistrer les données d'analyse (uniquement la probabilité manuelle - date_saisie non modifiée)
  const handleSaveAnalyse = async () => {
    if (!analyseFormData.val_indicateur_vide) {
      showAlert('warning', 'La probabilité ne peut être modifiée que si la valeur de l\'indicateur est vide')
      return
    }

    // Champ Commentaires : obligatoire uniquement si la probabilité est renseignée
    const probaIsSet = !(analyseFormData.probabilite === null || analyseFormData.probabilite === undefined || `${analyseFormData.probabilite}`.trim() === '')
    const commentaires = (analyseFormData.commentaires ?? '').toString()
    if (probaIsSet && commentaires.trim() === '') {
      showAlert('warning', 'Le champ "Commentaires" est obligatoire lorsque la probabilité est renseignée.')
      return
    }
    
    // La probabilité est non obligatoire
    try {
      const isQualitatif = analyseFormData.qualitatif === 'Oui' || !analyseFormData.code_indicateur
      
      if (isQualitatif) {
        // Pour les risques QUALITATIFS : stocker la probabilité directement sur le risque
        // via une nouvelle API ou en mettant à jour le risque
        const response = await fetch('/api/risques/probabilite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code_risque: analyseFormData.code_risque,
            periode: analyseFormData.periode,
            probabilite: analyseFormData.probabilite || null,
            modificateur: user?.username,
            // Snapshot "Analyse" (source de vérité) — utilisé pour remplir risques_probabilites
            analyse_snapshot: {
              code_indicateur: analyseFormData.code_indicateur || null,
              libelle_indicateur: analyseFormData.qualitatif === 'Oui' ? 'Qualitatif' : (analyseFormData.libelle_indicateur || null),
              valeur_indicateur: analyseFormData.qualitatif === 'Oui' ? null : (analyseFormData.val_indicateur || null),
              ind_obtenu: analyseFormData.indic_obtenu || null,
              responsable: analyseFormData.responsable || null,
              date_limite_saisie: analyseFormData.date_limite || null,
              date_saisie: analyseFormData.date_saisie || null,
              jours_retard: (analyseFormData.retard === '' || analyseFormData.retard === undefined) ? null : analyseFormData.retard,
              niveau_retard: analyseFormData.niv_retard || null,
              commentaires: commentaires.trim() === '' ? null : commentaires,
              impact_brut: analyseFormData.impact ?? null,
              efficacite_controle: analyseFormData.efficacite_contr ?? null,
              impact_net: analyseFormData.impact_net ?? null,
              probabilite: analyseFormData.probabilite || null,
            }
          })
        })
        const resData = await response.json().catch(() => ({}))

        if (response.ok) {
          if (resData?.deleted) {
            showAlert('success', 'Probabilité effacée (enregistrement supprimé)')
          } else {
            showAlert('success', 'Probabilité enregistrée avec succès')
          }
          setShowAnalyseModal(false)
          // Recharger les probabilités des risques qualitatifs
          fetchRisquesProbabilites()
        } else {
          showAlert('error', resData.error || 'Erreur lors de l\'enregistrement')
        }
      } else {
        // Pour les risques QUANTITATIFS : essayer de mettre à jour l'occurrence existante
        // Si pas d'occurrence, la probabilité sera quand même stockée dans risques_probabilites
        const response = await fetch('/api/indicateurs/occurrences/probabilite', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code_indicateur: analyseFormData.code_indicateur,
            code_risque: analyseFormData.code_risque, // Pour backup dans risques_probabilites
            periode: analyseFormData.periode,
            probabilite: analyseFormData.probabilite || null,
            modificateur: user?.username,
            // Snapshot "Analyse" (source de vérité) — même pour les quantitatifs (probabilité manuelle)
            analyse_snapshot: {
              code_indicateur: analyseFormData.code_indicateur || null,
              libelle_indicateur: analyseFormData.libelle_indicateur || null,
              valeur_indicateur: analyseFormData.val_indicateur || null,
              ind_obtenu: analyseFormData.indic_obtenu || null,
              responsable: analyseFormData.responsable || null,
              date_limite_saisie: analyseFormData.date_limite || null,
              date_saisie: analyseFormData.date_saisie || null,
              jours_retard: (analyseFormData.retard === '' || analyseFormData.retard === undefined) ? null : analyseFormData.retard,
              niveau_retard: analyseFormData.niv_retard || null,
              commentaires: commentaires.trim() === '' ? null : commentaires,
              impact_brut: analyseFormData.impact ?? null,
              efficacite_controle: analyseFormData.efficacite_contr ?? null,
              impact_net: analyseFormData.impact_net ?? null,
              probabilite: analyseFormData.probabilite || null,
            }
          })
        })
        
        const data = await response.json().catch(() => ({}))
        
        if (response.ok) {
          if (data?.deleted) {
            showAlert('success', 'Probabilité effacée (enregistrement supprimé)')
            setShowAnalyseModal(false)
            fetchIndicateurOccurrences()
            fetchRisquesProbabilites()
            return
          }
          if (data.occurrenceUpdated === false) {
            showAlert('success', 'Probabilité enregistrée (occurrence non trouvée, valeur sauvegardée)')
          } else {
            showAlert('success', 'Probabilité enregistrée avec succès')
          }
          setShowAnalyseModal(false)
          fetchIndicateurOccurrences()
          fetchRisquesProbabilites() // Recharger aussi les probabilités
        } else {
          showAlert('error', data.error || 'Erreur lors de l\'enregistrement')
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
      showAlert('error', 'Erreur lors de l\'enregistrement')
    }
  }

  // Exporter le tableau d'analyse en Excel (colonnes du tableau + code indicateur)
  const handleExportAnalyse = () => {
    const filteredData = getFilteredAnalyseRisques()
    const selectedPeriode = getSelectedPeriode()
    const periodeKey = getPeriodeKey()
    
    if (filteredData.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    const rows = filteredData.map(r => {
      const isQualitatif = r.qualitatif === 'Oui' || !r.code_indicateur
      
      // Pour les risques qualitatifs, chercher la probabilité dans risquesProbabilites
      // Pour les risques quantitatifs, chercher dans indicateurOccurrences ET risquesProbabilites (backup)
      let indicOcc = null
      let storedProba = ''
      
      if (isQualitatif) {
        const probQualit = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
        storedProba = probQualit?.probabilite
      } else {
        indicOcc = indicateurOccurrences.find(io => io.code_indicateur === r.code_indicateur && io.periode === periodeKey)
        const probBackup = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
        // La probabilité n'est plus stockée sur indicateur_occurrences (colonne supprimée)
        storedProba = probBackup?.probabilite
      }
      
      // Impact net
      const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
      
      // Valeur de l'indicateur (pas pour les qualitatifs)
      const valInd = isQualitatif ? null : indicOcc?.val_indicateur
      const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''
      // Exigence: si la période est fermée, la colonne "Ind.obt." doit être alimentée
      // EXCLUSIVEMENT depuis `risques_probabilites.ind_obtenu` (aucune dérivation depuis les indicateurs).
      const selectedPeriodeObj = findSelectedPeriodeFromForm(periodeAnalyse)
      const isPeriodeFermee = !!(selectedPeriodeObj && selectedPeriodeObj.statut !== 'Ouvert')
      const rpRowForIndObt = isPeriodeFermee
        ? risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
        : null
      const indicObtenu = isPeriodeFermee
        ? (rpRowForIndObt?.ind_obtenu ?? '')
        : (isQualitatif ? 'N/A' : (hasValInd ? 'Oui' : 'Non'))
      
      // Type et formatage
      const typeIndic = r.indicateur?.type_indicateur || ''
      const isTaux = typeIndic === 'Taux' || typeIndic === 'TxCalcule' || typeIndic.toLowerCase().includes('taux') || typeIndic.includes('%')
      let valIndDisplay = ''
      if (hasValInd) {
        const numVal = parseFloat(valInd)
        if (isTaux) {
          const formatted = Number.isInteger(numVal) ? numVal.toString() : numVal.toFixed(2).replace(/\.?0+$/, '')
          valIndDisplay = `${formatted}%`
        } else {
          valIndDisplay = valInd.toString()
        }
      }
      
      // Probabilité
      const seuils = { 
        seuil1: r.indicateur?.seuil1 || r.indicateur?.seuil_1, 
        seuil2: r.indicateur?.seuil2 || r.indicateur?.seuil_2, 
        seuil3: r.indicateur?.seuil3 || r.indicateur?.seuil_3 
      }
      const calculatedProba = (!isQualitatif && hasValInd) ? calculateProbabilite(valInd, seuils, r.indicateur?.sens) : ''
      // storedProba est déjà défini plus haut
      const probDisplay = calculatedProba || storedProba
      
      // Date de saisie
      let dateSaisieAnalyse = null
      if (!isQualitatif && hasValInd) {
        dateSaisieAnalyse = indicOcc?.date_saisie || null
      } else if (storedProba) {
        // Pour les qualitatifs, récupérer la date depuis risquesProbabilites
        const probData = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
        dateSaisieAnalyse = probData?.date_modification || indicOcc?.date_modification || null
      }
      
      // Date limite
      const dateLimite = selectedPeriode?.date_limite_saisie || null
      
      // Calcul du retard
      let retardJours = null
      const hasProb = probDisplay !== '' && probDisplay !== null
      if (dateLimite) {
        const dlNorm = new Date(new Date(dateLimite + 'T00:00:00').getFullYear(), new Date(dateLimite + 'T00:00:00').getMonth(), new Date(dateLimite + 'T00:00:00').getDate())
        if (hasProb && dateSaisieAnalyse) {
          const ds = new Date(dateSaisieAnalyse)
          const dsNorm = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate())
          retardJours = Math.max(0, Math.floor((dsNorm - dlNorm) / (1000 * 60 * 60 * 24)))
        } else {
          const aujourdhui = new Date()
          const ajdNorm = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())
          retardJours = Math.max(0, Math.floor((ajdNorm - dlNorm) / (1000 * 60 * 60 * 24)))
        }
      }
      
      // Niveau de retard
      const nivRetard = retardJours !== null ? (retardJours <= 0 ? 'Pas retard' : 'Retard') : ''
      
      // Responsable: pour les qualitatifs, utiliser les emails des gestionnaires de risques
      const responsable = isQualitatif ? getGestionnairesRisquesEmails() : (r.indicateur?.responsable || '')
      
      return {
        'Période': periodeKey,
        'Code risque': r.code_risque,
        'Libellé risque': r.libelle_risque,
        'Code proc.': r.code_processus,
        'Libellé processus': r.processus?.libelle_processus || '',
        'Imp. brut': r.impact,
        'Eff.Ctrl': r.efficacite_contr,
        'Imp. net': impactNet,
        'Quali.': r.qualitatif,
        'Ind.obt.': indicObtenu,
        'Code indicateur': isQualitatif ? '' : (r.code_indicateur || ''),
        'Libellé indicateur': isQualitatif ? 'Qualitatif' : (r.indicateur?.libelle_indicateur || ''),
        'Val.Ind.': isQualitatif ? '' : valIndDisplay,
        'Prob.': probDisplay,
        'Responsable': responsable,
        'Date lim.': dateLimite ? new Date(dateLimite).toLocaleDateString('fr-FR') : '',
        'Date sais.': dateSaisieAnalyse ? new Date(dateSaisieAnalyse).toLocaleDateString('fr-FR') : '',
        'Retard': retardJours !== null ? `${retardJours}j` : '',
        'Niv retard': nivRetard
      }
    })
    
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Analyse')
    XLSX.writeFile(wb, `analyse_risques_${periodeKey || periodeAnalyse.annee}_${Date.now()}.xlsx`)
  }

  // Filtrer les risques pour l'analyse
  const getFilteredAnalyseRisques = () => {
    const periodeKey = getPeriodeKey()
    const selectedPeriodeObj = findSelectedPeriodeFromForm(periodeAnalyse)
    const isPeriodeFermee = selectedPeriodeObj && selectedPeriodeObj.statut !== 'Ouvert'

    const base = risques.filter(r => {
      if (r.statut !== 'Actif') return false
      if (analyseFilters.categorie && !r.categories?.includes(parseInt(analyseFilters.categorie))) return false
      if (analyseFilters.structure && r.code_structure !== analyseFilters.structure) return false
      if (analyseFilters.processus && r.code_processus !== analyseFilters.processus) return false
      if (analyseFilters.recherche) {
        const search = analyseFilters.recherche.toLowerCase()
        if (!r.code_risque?.toLowerCase().includes(search) && 
            !r.libelle_risque?.toLowerCase().includes(search) &&
            !r.processus?.libelle_processus?.toLowerCase().includes(search)) return false
      }
      
      // Filtre Type évaluation
      if (analyseFilters.typeEvaluation) {
        if (isPeriodeFermee) {
          // Exigence (période fermée): filtrage EXCLUSIVEMENT via risques_probabilites.ind_obtenu
          const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
          const hasRp = !!rpRow

          switch (analyseFilters.typeEvaluation) {
            case 'Eval. quali':
              if (!(hasRp && rpRow.ind_obtenu === 'Non')) return false
              break
            case 'Eval. quanti':
              if (!(hasRp && rpRow.ind_obtenu === 'Oui')) return false
              break
            case 'Eval. quali & quanti':
              if (!hasRp) return false
              break
            case 'Non évalué':
              if (hasRp) return false
              break
            default:
              break
          }
        } else {
          // Période ouverte : logique historique (calcul indicateur vs saisie manuelle)
          const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey))
          const storedProba = rpRow?.probabilite
          const hasStoredProba = storedProba !== null && storedProba !== undefined && storedProba !== ''

          const indicOcc = indicateurOccurrences.find(io => io.code_indicateur === r.code_indicateur && samePeriodeKey(io.periode, periodeKey))
          const valInd = indicOcc?.val_indicateur
          const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''

          const seuils = {
            seuil1: r.indicateur?.seuil1 || r.indicateur?.seuil_1,
            seuil2: r.indicateur?.seuil2 || r.indicateur?.seuil_2,
            seuil3: r.indicateur?.seuil3 || r.indicateur?.seuil_3
          }
          const calculatedProba = (hasValInd && seuils.seuil1 && seuils.seuil2 && seuils.seuil3)
            ? calculateProbabilite(valInd, seuils, r.indicateur?.sens)
            : ''
          const hasCalculatedProba = calculatedProba !== '' && calculatedProba !== null && calculatedProba !== undefined

          const hasProba = hasCalculatedProba || hasStoredProba
          const isProbFromIndicator = hasCalculatedProba

          switch (analyseFilters.typeEvaluation) {
            case 'Eval. quali':
              if (!(hasProba && !isProbFromIndicator)) return false
              break
            case 'Eval. quanti':
              if (!isProbFromIndicator) return false
              break
            case 'Eval. quali & quanti':
              if (!hasProba) return false
              break
            case 'Non évalué':
              if (hasProba) return false
              break
            default:
              break
          }
        }
      }
      
      return true
    })

    if (!isPeriodeFermee) return base

    // Période fermée : forcer les index (impact/efficacité) depuis risques_probabilites
    return base.map(r => {
      const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
      return {
        ...r,
        impact: rpRow?.impact ?? null,
        efficacite_contr: rpRow?.eff_ctrl ?? null,
        indic_obtenu: rpRow?.ind_obtenu ?? r.indic_obtenu,
        _rp: rpRow
      }
    })
  }

  // Compter les risques avec indicateurs renseignés
  // Compteurs pour l'analyse
  const getAnalyseStats = () => {
    const filtered = getFilteredAnalyseRisques()
    const periodeKey = getPeriodeKey()
    const selectedPeriode = getSelectedPeriode()
    const isPeriodeFermee = !!(selectedPeriode && (selectedPeriode.statut === 'Fermé' || selectedPeriode.statut === 'Fermee' || selectedPeriode.statut === 'Fermée'))
    
    let totalRisques = filtered.length
    let risquesAvecValInd = 0
    let risquesAvecProbManuelle = 0
    let risquesAvecProb = 0
    
    filtered.forEach(r => {
      // Pour les périodes fermées, toute l'évaluation provient de risques_probabilites.
      // On utilise ind_obtenu : 'Oui' => Quantitatif (issu indicateurs), 'Non' => Qualitatif (saisie manuelle).
      if (isPeriodeFermee) {
        const rp = risquesProbabilites.find(x => x.code_risque === r.code_risque && x.periode === periodeKey)
        const hasProba = rp?.probabilite !== null && rp?.probabilite !== undefined && rp?.probabilite !== ''

        if (rp?.ind_obtenu === 'Oui') {
          risquesAvecValInd++
        }
        if (rp?.ind_obtenu === 'Non' && hasProba) {
          risquesAvecProbManuelle++
        }
        if (hasProba) {
          risquesAvecProb++
        }
        return
      }

      // Périodes ouvertes : logique historique (indicOcc + éventuelle proba manuelle)
      const isQualitatif = r.qualitatif === 'Oui' || !r.code_indicateur

      let indicOcc = null
      let storedProba = null

      if (isQualitatif) {
        const probQualit = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
        storedProba = probQualit?.probabilite
      } else {
        indicOcc = indicateurOccurrences.find(io => io.code_indicateur === r.code_indicateur && io.periode === periodeKey)
        const probBackup = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
        storedProba = probBackup?.probabilite
      }

      const valInd = isQualitatif ? null : indicOcc?.val_indicateur
      const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''
      const hasStoredProba = storedProba !== null && storedProba !== undefined && storedProba !== ''

      const seuils = {
        seuil1: r.indicateur?.seuil1 || r.indicateur?.seuil_1,
        seuil2: r.indicateur?.seuil2 || r.indicateur?.seuil_2,
        seuil3: r.indicateur?.seuil3 || r.indicateur?.seuil_3
      }
      const calculatedProba = (!isQualitatif && hasValInd) ? calculateProbabilite(valInd, seuils, r.indicateur?.sens) : ''
      const hasCalculatedProba = calculatedProba !== '' && calculatedProba !== null

      if (hasValInd) {
        risquesAvecValInd++
      }

      if (isQualitatif ? hasStoredProba : (!hasValInd && hasStoredProba)) {
        risquesAvecProbManuelle++
      }

      if (hasCalculatedProba || hasStoredProba) {
        risquesAvecProb++
      }
    })
    
    return { totalRisques, risquesAvecValInd, risquesAvecProbManuelle, risquesAvecProb }
  }

  // SECTION ANALYSE - Refaite selon les instructions détaillées
  const renderAnalyse = () => {
    const filteredRisquesAnalyse = getFilteredAnalyseRisques()
    const selectedPeriode = getSelectedPeriode()
    
    // Obtenir les années disponibles (uniquement celles avec des périodes ouvertes/fermées)
    const availableYears = [...new Set(allPeriodes.map(p => p.annee))].sort((a, b) => b - a)
    
    // Obtenir les semestres disponibles pour l'année sélectionnée
    const availableSemestres = allPeriodes
      .filter(p => p.annee?.toString() === periodeAnalyse.annee && p.semestre)
      .map(p => p.semestre)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
    
    // Obtenir les trimestres disponibles pour l'année sélectionnée
    const availableTrimestres = allPeriodes
      .filter(p => p.annee?.toString() === periodeAnalyse.annee && p.trimestre)
      .map(p => p.trimestre)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
    
    // Obtenir les mois disponibles pour l'année sélectionnée
    const availableMois = allPeriodes
      .filter(p => p.annee?.toString() === periodeAnalyse.annee && p.mois)
      .map(p => p.mois)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b)
    
    return (
      <div className="space-y-4">
        {/* Cadre 1: Filtres sur les risques - tous sur la même ligne */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2 overflow-x-auto">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Catégorie"
                size="sm"
                value={analyseFilters.categorie || ''}
                onChange={(v) => setAnalyseFilters({ ...analyseFilters, categorie: v })}
                options={[
                  { value: '', label: 'Toutes' },
                  ...categories.filter(c => c.statut === 'Actif').map(c => ({
                    value: c.code_categorie?.toString() || c.id?.toString(),
                    label: c.libelle_categorie
                  }))
                ]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Structure"
                size="sm"
                value={analyseFilters.structure || ''}
                onChange={(v) => setAnalyseFilters({ ...analyseFilters, structure: v })}
                options={[
                  { value: '', label: 'Toutes' },
                  ...structures.map(s => ({
                    value: s.code_structure,
                    label: s.libelle_structure
                  }))
                ]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Processus"
                size="sm"
                value={analyseFilters.processus || ''}
                onChange={(v) => setAnalyseFilters({ ...analyseFilters, processus: v })}
                options={[
                  { value: '', label: 'Tous' },
                  ...processus.filter(p => p.statut === 'Actif').map(p => ({
                    value: p.code_processus,
                    label: p.libelle_processus
                  }))
                ]}
                placeholder="Tous"
              />
            </div>
            <div className="w-[140px] flex-shrink-0">
              <SearchableSelect
                label="Type évaluation"
                size="sm"
                value={analyseFilters.typeEvaluation || ''}
                onChange={(v) => setAnalyseFilters({ ...analyseFilters, typeEvaluation: v })}
                options={[
                  { value: '', label: 'Tous' },
                  { value: 'Eval. quali', label: 'Eval. quali' },
                  { value: 'Eval. quanti', label: 'Eval. quanti' },
                  { value: 'Eval. quali & quanti', label: 'Eval. quali & quanti' },
                  { value: 'Non évalué', label: 'Non évalué' }
                ]}
                placeholder="Tous"
              />
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Recherche</label>
              <input type="text" value={analyseFilters.recherche || ''} onChange={(e) => setAnalyseFilters({ ...analyseFilters, recherche: e.target.value })} placeholder="Code, libellé..." className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
            </div>
            <button onClick={() => setAnalyseFilters({ categorie: '', structure: '', typeEvaluation: '', processus: '', recherche: '' })} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser les filtres">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Cadre 2: Filtres sur la période - seulement les périodes déjà ouvertes */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[90px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Année <span className="text-red-500">*</span></label>
              <select value={periodeAnalyse.annee} onChange={(e) => setPeriodeAnalyse({ annee: e.target.value, semestre: '', trimestre: '', mois: '' })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="">--</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Semestre</label>
              <select value={periodeAnalyse.semestre} onChange={(e) => setPeriodeAnalyse({ ...periodeAnalyse, semestre: e.target.value, trimestre: '', mois: '' })} disabled={!periodeAnalyse.annee || availableSemestres.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableSemestres.map(s => <option key={s} value={`S${s}`}>Semestre {s}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Trimestre</label>
              <select value={periodeAnalyse.trimestre} onChange={(e) => setPeriodeAnalyse({ ...periodeAnalyse, trimestre: e.target.value, semestre: '', mois: '' })} disabled={!periodeAnalyse.annee || availableTrimestres.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableTrimestres.map(t => <option key={t} value={`T${t}`}>Trimestre {t}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Mois</label>
              <select value={periodeAnalyse.mois} onChange={(e) => setPeriodeAnalyse({ ...periodeAnalyse, mois: e.target.value, semestre: '', trimestre: '' })} disabled={!periodeAnalyse.annee || availableMois.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableMois.map(m => <option key={m} value={moisList[m - 1]}>{moisList[m - 1]}</option>)}
              </select>
            </div>
            {selectedPeriode && (
              <div className={`text-[10px] px-2 py-1 rounded ${selectedPeriode.statut === 'Ouvert' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>
                <span className="font-medium">Période {selectedPeriode.statut === 'Ouvert' ? '🟢 Ouverte' : '🔴 Fermée'}</span>
                {selectedPeriode.date_limite_saisie && (
                  <span className="ml-2">| Date limite: <strong>{new Date(selectedPeriode.date_limite_saisie).toLocaleDateString('fr-FR')}</strong></span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ligne: Bouton export + compteurs */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button variant="secondary" icon={Download} size="sm" onClick={handleExportAnalyse}>Exporter Excel</Button>
          {(() => {
            const stats = getAnalyseStats()
            return (
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span>Total: <strong className="text-gray-800">{stats.totalRisques}</strong></span>
                <span>Val.Ind.: <strong className="text-blue-600">{stats.risquesAvecValInd}</strong></span>
                <span>Prob. manuelle: <strong className="text-orange-600">{stats.risquesAvecProbManuelle}</strong></span>
                <span>Prob. renseignée: <strong className="text-green-600">{stats.risquesAvecProb}</strong></span>
              </div>
            )
          })()}
        </div>

        {/* Message si période non sélectionnée */}
        {!periodeAnalyse.annee && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center text-yellow-700 text-sm">
            <AlertTriangle size={20} className="inline mr-2" />
            Veuillez sélectionner une période pour afficher les données d'analyse
          </div>
        )}

        {/* Message si année sélectionnée mais aucune période correspondante trouvée */}
        {periodeAnalyse.annee && !selectedPeriode && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center text-orange-700 text-sm">
            <AlertTriangle size={20} className="inline mr-2" />
            Aucune période ouverte ne correspond à cette sélection. Veuillez sélectionner un semestre, trimestre ou mois, ou ouvrir une période depuis la section Gestion.
          </div>
        )}

        {/* Tableau d'analyse - affiché seulement si une période est trouvée */}
        {periodeAnalyse.annee && selectedPeriode && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Explication du calcul Impact net */}
            <div className="bg-blue-50 px-3 py-2 border-b border-blue-100 text-[10px] text-blue-800">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold">ℹ️</span>
                <div>
                  <span className="font-semibold">Calcul de l'Impact net :</span>
                  <span className="ml-2">L'<strong>Efficacité de contrôle (Eff.Ctrl)</strong> atténue l'impact brut selon la règle :</span>
                  <div className="mt-1 flex flex-wrap gap-3 text-[9px]">
                    <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>Eff.Ctrl = 1</strong> → Atténuation <span className="text-green-600 font-bold">-3</span></span>
                    <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>Eff.Ctrl = 2</strong> → Atténuation <span className="text-green-600 font-bold">-2</span></span>
                    <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>Eff.Ctrl = 3</strong> → Atténuation <span className="text-green-600 font-bold">-1</span></span>
                    <span className="bg-white px-2 py-0.5 rounded border border-blue-200"><strong>Eff.Ctrl = 4</strong> → Atténuation <span className="text-gray-500 font-bold">0</span></span>
                  </div>
                  <div className="mt-1 text-[9px]">
                    <span className="bg-purple-100 px-2 py-0.5 rounded border border-purple-200"><strong>Impact net</strong> = max(1, Impact brut − Atténuation)</span>
                    <span className="ml-2 text-gray-600">Une meilleure efficacité de contrôle (valeur faible) réduit davantage l'impact.</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Indication de scroll */}
            <div className="bg-gray-50 px-3 py-1 border-b border-gray-100 text-[10px] text-gray-400 flex items-center gap-1">
              <span>↔</span> Faites défiler horizontalement pour voir toutes les colonnes
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: '60vh' }}>
              <table className="w-full text-[10px]" style={{ minWidth: '1900px' }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]">
                    <th style={{width: '100px', minWidth: '100px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">Période</th>
                    <th style={{width: '90px', minWidth: '90px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">Code risque</th>
                    <th style={{width: '250px', minWidth: '250px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">Libellé risque</th>
                    <th style={{width: '80px', minWidth: '80px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">Code proc.</th>
                    <th style={{width: '200px', minWidth: '200px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">Libellé processus</th>
                    <th style={{width: '70px', minWidth: '70px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Imp. brut</th>
                    <th style={{width: '60px', minWidth: '60px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Eff.Ctrl</th>
                    <th style={{width: '60px', minWidth: '60px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap bg-purple-600">Imp. net</th>
                    <th style={{width: '60px', minWidth: '60px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Quali.</th>
                    <th style={{width: '70px', minWidth: '70px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Ind.obt.</th>
                    <th style={{width: '200px', minWidth: '200px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">Libellé indicateur</th>
                    <th style={{width: '80px', minWidth: '80px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Val.Ind.</th>
                    <th style={{width: '60px', minWidth: '60px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Prob.</th>
                    <th style={{width: '150px', minWidth: '150px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap">Responsable</th>
                    <th style={{width: '90px', minWidth: '90px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Date lim.</th>
                    <th style={{width: '90px', minWidth: '90px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Date sais.</th>
                    <th style={{width: '70px', minWidth: '70px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Retard</th>
                    <th style={{width: '80px', minWidth: '80px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap">Niv retard</th>
                    <th style={{width: '50px', minWidth: '50px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap sticky right-0 bg-[#2c5282]">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRisquesAnalyse.length === 0 ? (
                    <tr><td colSpan={19} className="px-4 py-8 text-center text-gray-500">Aucun risque actif trouvé</td></tr>
                  ) : filteredRisquesAnalyse.map((r, idx) => {
                    const isQualitatif = r.qualitatif === 'Oui' || !r.code_indicateur
                    
                    // Pour les risques qualitatifs, chercher la probabilité dans risquesProbabilites
                    // Pour les risques quantitatifs, chercher dans indicateurOccurrences ET risquesProbabilites (backup)
                    let indicOcc = null
                    let storedProba = ''
                    
                    if (isQualitatif) {
                      const probQualit = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === getPeriodeKey())
                      storedProba = probQualit?.probabilite
                    } else {
                      indicOcc = indicateurOccurrences.find(io => io.code_indicateur === r.code_indicateur && io.periode === getPeriodeKey())
                      const probBackup = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === getPeriodeKey())
                      // La probabilité n'est plus stockée sur indicateur_occurrences (colonne supprimée)
                      storedProba = probBackup?.probabilite
                    }
                    
                    // Calcul de l'impact net
                    const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
                    
                    // Valeur de l'indicateur (avec % si c'est un taux) - pas pour les qualitatifs
                    // Types de taux: "Taux", "TxCalcule", ou tout type contenant "taux" ou "%"
                    const valInd = isQualitatif ? null : indicOcc?.val_indicateur
                    const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''
                    // Exigence: pour une période fermée, la colonne "Ind.obt." doit provenir
                    // EXCLUSIVEMENT de `risques_probabilites.ind_obtenu` (pas calculé via indicateurs).
                    const selectedPeriodeObj = findSelectedPeriodeFromForm(periodeAnalyse)
                    const isPeriodeFermee = !!(selectedPeriodeObj && selectedPeriodeObj.statut !== 'Ouvert')
                    const rpRowForIndObt = isPeriodeFermee
                      ? risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === getPeriodeKey())
                      : null
                    const indicObtenu = isPeriodeFermee
                      ? (rpRowForIndObt?.ind_obtenu ?? '')
                      : (isQualitatif ? 'N/A' : (hasValInd ? 'Oui' : 'Non'))
                    const typeIndic = r.indicateur?.type_indicateur || ''
                    const isTaux = typeIndic === 'Taux' || typeIndic === 'TxCalcule' || typeIndic.toLowerCase().includes('taux') || typeIndic.includes('%')
                    
                    // Formater la valeur : ajouter % si taux, limiter à 2 décimales
                    let valIndDisplay = '-'
                    if (hasValInd) {
                      const numVal = parseFloat(valInd)
                      if (isTaux) {
                        // Formater avec 2 décimales max pour les taux
                        const formatted = Number.isInteger(numVal) ? numVal.toString() : numVal.toFixed(2).replace(/\.?0+$/, '')
                        valIndDisplay = `${formatted}%`
                      } else {
                        valIndDisplay = valInd.toString()
                      }
                    }
                    
                    // Calculer la probabilité basée sur les seuils (utiliser seuil1, seuil2, seuil3 ou seuil_1, seuil_2, seuil_3)
                    // Pour les risques qualitatifs, pas de calcul basé sur indicateur
                    const seuils = { 
                      seuil1: r.indicateur?.seuil1 || r.indicateur?.seuil_1, 
                      seuil2: r.indicateur?.seuil2 || r.indicateur?.seuil_2, 
                      seuil3: r.indicateur?.seuil3 || r.indicateur?.seuil_3 
                    }
                    const calculatedProba = (!isQualitatif && hasValInd) ? calculateProbabilite(valInd, seuils, r.indicateur?.sens) : ''
                    // storedProba est déjà défini plus haut
                    // Utiliser la probabilité calculée (si quantitatif avec indicateur), sinon celle stockée
                    const probDisplay = calculatedProba || storedProba
                    const hasProb = probDisplay !== '' && probDisplay !== null && probDisplay !== undefined
                    
                    // Date de saisie dans Analyse :
                    // - Si indicateur saisi (hasValInd et pas qualitatif) → utiliser date_saisie de l'occurrence
                    // - Si probabilité saisie manuellement (qualitatif ou pas d'indicateur mais prob stockée) → utiliser date_modification
                    let dateSaisieAnalyse = null
                    if (!isQualitatif && hasValInd) {
                      dateSaisieAnalyse = indicOcc?.date_saisie || null
                    } else if (storedProba) {
                      // Pour les qualitatifs ou manuels, récupérer date depuis risquesProbabilites
                      const probData = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === getPeriodeKey())
                      dateSaisieAnalyse = probData?.date_modification || indicOcc?.date_modification || null
                    }
                    
                    // Date limite de la période
                    const dateLimite = selectedPeriode?.date_limite_saisie ? new Date(selectedPeriode.date_limite_saisie + 'T00:00:00') : null
                    
                    // Calcul du retard
                    let retardJours = null
                    if (dateLimite) {
                      if (hasProb && dateSaisieAnalyse) {
                        // Prob renseignée : différence entre date saisie et date limite
                        const ds = new Date(dateSaisieAnalyse)
                        // Normaliser les dates (sans heures) pour un calcul correct
                        const dsNorm = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate())
                        const dlNorm = new Date(dateLimite.getFullYear(), dateLimite.getMonth(), dateLimite.getDate())
                        retardJours = Math.max(0, Math.floor((dsNorm - dlNorm) / (1000 * 60 * 60 * 24)))
                      } else {
                        // Prob non renseignée : différence entre aujourd'hui et date limite
                        const aujourdhui = new Date()
                        const ajdNorm = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())
                        const dlNorm = new Date(dateLimite.getFullYear(), dateLimite.getMonth(), dateLimite.getDate())
                        retardJours = Math.max(0, Math.floor((ajdNorm - dlNorm) / (1000 * 60 * 60 * 24)))
                      }
                    }
                    
                    // Niveau de retard
                    let nivRetard = '-'
                    if (retardJours !== null) {
                      nivRetard = retardJours <= 0 ? 'Pas retard' : 'Retard'
                    }
                    
                    return (
                      <tr key={r.id} className={`hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-2 py-2 text-gray-700 font-medium">{getPeriodeLibelle()}</td>
                        <td className="px-2 py-2 font-mono font-bold text-blue-600">{r.code_risque}</td>
                        <td className="px-2 py-2 text-gray-700" title={r.libelle_risque}>
                          <div className="line-clamp-2">{r.libelle_risque}</div>
                        </td>
                        <td className="px-2 py-2 font-mono text-gray-700">{r.code_processus}</td>
                        <td className="px-2 py-2 text-gray-700" title={r.processus?.libelle_processus}>
                          <div className="line-clamp-2">{r.processus?.libelle_processus || '-'}</div>
                        </td>
                        <td className="px-2 py-2 text-center"><span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${r.impact >= 4 ? 'bg-red-500' : r.impact >= 3 ? 'bg-orange-500' : r.impact >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{r.impact}</span></td>
                        <td className="px-2 py-2 text-center"><span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${r.efficacite_contr >= 4 ? 'bg-red-500' : r.efficacite_contr >= 3 ? 'bg-orange-500' : r.efficacite_contr >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{r.efficacite_contr}</span></td>
                        <td className="px-2 py-2 text-center bg-purple-50"><span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${impactNet >= 4 ? 'bg-red-500' : impactNet >= 3 ? 'bg-orange-500' : impactNet >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{impactNet}</span></td>
                        <td className="px-2 py-2 text-center text-gray-700">{r.qualitatif}</td>
                        <td className="px-2 py-2 text-center"><span className={`px-2 py-1 rounded text-xs ${indicObtenu === 'Oui' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{indicObtenu}</span></td>
                        <td className="px-2 py-2 text-gray-700" title={r.indicateur?.libelle_indicateur}>
                          <div className="line-clamp-2">{isQualitatif ? <em className="text-gray-400">Qualitatif</em> : (r.indicateur?.libelle_indicateur || '-')}</div>
                        </td>
                        <td className={`px-2 py-2 text-center ${isQualitatif ? 'bg-gray-100 text-gray-400' : 'text-gray-700 font-medium'}`}>
                          {isQualitatif ? '-' : valIndDisplay}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${probDisplay >= 4 ? 'bg-red-500' : probDisplay >= 3 ? 'bg-orange-500' : probDisplay >= 2 ? 'bg-yellow-500' : probDisplay == 1 ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {hasProb ? probDisplay : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-700" style={{width: '150px', maxWidth: '150px'}} title={isQualitatif ? getGestionnairesRisquesEmails() : r.indicateur?.responsable}>
                          <div className="line-clamp-2 text-[10px]" style={{overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>{isQualitatif ? getGestionnairesRisquesEmails() : (r.indicateur?.responsable || '-')}</div>
                        </td>
                        <td className="px-2 py-2 text-center text-gray-700">
                          {dateLimite ? dateLimite.toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-2 py-2 text-center text-gray-700">
                          {hasProb && dateSaisieAnalyse ? new Date(dateSaisieAnalyse).toLocaleDateString('fr-FR') : ''}
                        </td>
                        <td className="px-2 py-2 text-center text-gray-700">
                          {retardJours !== null ? `${retardJours}j` : '-'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap ${nivRetard === 'Retard' ? 'bg-red-100 text-red-700' : nivRetard === 'Pas retard' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {nivRetard}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center sticky right-0 bg-inherit">
                          <button onClick={() => handleEditAnalyse(r)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Éditer/Saisir">
                            <Edit size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-2 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              Affichage de {filteredRisquesAnalyse.length} risque(s) actif(s)
            </div>
          </div>
        )}

        {/* Modal d'édition/saisie d'analyse */}
        <Modal isOpen={showAnalyseModal} onClose={() => setShowAnalyseModal(false)} title="Détails de l'analyse" size="lg" closeOnClickOutside={false}>
          <div className="space-y-3 text-xs">
            {/* Ligne 1: Période, Code risque */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Période</label>
                <input type="text" value={analyseFormData.periode || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Code risque</label>
                <input type="text" value={analyseFormData.code_risque || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
            </div>

            {/* Ligne 2: Libellé risque */}
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Libellé risque</label>
              <input type="text" value={analyseFormData.libelle_risque || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
            </div>

            {/* Ligne 3: Code processus, Libellé processus */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Code processus</label>
                <input type="text" value={analyseFormData.code_processus || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Libellé processus</label>
                <input type="text" value={analyseFormData.libelle_processus || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
            </div>

            {/* Ligne 4: Impact, Eff.Ctrl, Qualitatif, Ind.obt. */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Impact</label>
                <input type="text" value={analyseFormData.impact || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Eff.Ctrl</label>
                <input type="text" value={analyseFormData.efficacite_contr || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Qualitatif</label>
                <input type="text" value={analyseFormData.qualitatif || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Ind.obt.</label>
                <input type="text" value={analyseFormData.indic_obtenu || ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
            </div>

            {/* Ligne 5: Libellé indicateur */}
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Libellé indicateur</label>
              <input type="text" value={analyseFormData.qualitatif === 'Oui' ? 'Qualitatif' : (analyseFormData.libelle_indicateur || '-')} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
            </div>

            {/* Ligne 6: Val.Ind., Prob. */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Val.Ind.</label>
                <input 
                  type="text" 
                  value={analyseFormData.qualitatif === 'Oui' ? '-' : (analyseFormData.val_indicateur_display || '-')} 
                  disabled 
                  className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" 
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Prob. (1-4)</label>
                {/* Le champ probabilité est actif seulement si val_indicateur est vide */}
                {analyseFormData.val_indicateur_vide && canModifyAnalyse() ? (
                  <select 
                    value={analyseFormData.probabilite || ''} 
                    onChange={(e) => {
                      const newProb = e.target.value
                      // Si probabilité est renseignée, mettre la date de saisie à aujourd'hui dans le formulaire
                      // Si probabilité est vide, vider la date de saisie dans le formulaire
                      const newDateSaisie = newProb ? new Date().toISOString() : null
                      
                      // Recalculer le retard
                      let newRetard = null
                      let newNivRetard = '-'
                      if (analyseFormData.date_limite) {
                        const dlNorm = new Date(new Date(analyseFormData.date_limite + 'T00:00:00').getFullYear(), new Date(analyseFormData.date_limite + 'T00:00:00').getMonth(), new Date(analyseFormData.date_limite + 'T00:00:00').getDate())
                        if (newProb && newDateSaisie) {
                          const ds = new Date(newDateSaisie)
                          const dsNorm = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate())
                          newRetard = Math.floor((dsNorm - dlNorm) / (1000 * 60 * 60 * 24))
                        } else {
                          const aujourdhui = new Date()
                          const ajdNorm = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())
                          newRetard = Math.floor((ajdNorm - dlNorm) / (1000 * 60 * 60 * 24))
                        }
                        newNivRetard = newRetard <= 0 ? 'Pas retard' : 'Retard'
                      }
                      
                      setAnalyseFormData({ 
                        ...analyseFormData, 
                        probabilite: newProb,
                        date_saisie: newDateSaisie,
                        retard: newRetard,
                        niv_retard: newNivRetard
                      })
                    }}
                    className="w-full px-2 py-1 rounded border border-blue-300 focus:ring-1 focus:ring-blue-400 text-xs"
                  >
                    <option value="">--</option>
                    <option value="1">1 - Très rare</option>
                    <option value="2">2 - Rare</option>
                    <option value="3">3 - Fréquent</option>
                    <option value="4">4 - Très fréquent</option>
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={analyseFormData.probabilite || '-'} 
                    disabled 
                    className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" 
                  />
                )}
              </div>
            </div>

            {/* Ligne 7: Responsable */}
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Responsable</label>
              <input type="text" value={analyseFormData.responsable || '-'} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
            </div>

            {/* Ligne 8: Date lim., Date sais., Retard, Niv retard */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Date lim.</label>
                <input type="text" value={analyseFormData.date_limite ? new Date(analyseFormData.date_limite).toLocaleDateString('fr-FR') : '-'} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Date sais.</label>
                <input type="text" value={analyseFormData.date_saisie ? new Date(analyseFormData.date_saisie).toLocaleDateString('fr-FR') : ''} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Retard</label>
                <input type="text" value={analyseFormData.retard !== null ? `${analyseFormData.retard}j` : '-'} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Niv retard</label>
                <input type="text" value={analyseFormData.niv_retard || '-'} disabled className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600" />
              </div>
            </div>

            {/* Ligne 9: Commentaires (obligatoire si probabilité renseignée) */}
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">
                Commentaires{(analyseFormData.probabilite && `${analyseFormData.probabilite}`.trim() !== '') ? ' *' : ''}
              </label>
              {analyseFormData.val_indicateur_vide && canModifyAnalyse() ? (
                <textarea
                  value={analyseFormData.commentaires || ''}
                  onChange={(e) => setAnalyseFormData({ ...analyseFormData, commentaires: e.target.value })}
                  rows={3}
                  placeholder="Saisir un commentaire..."
                  className="w-full px-2 py-1 rounded border border-blue-300 focus:ring-1 focus:ring-blue-400 text-xs"
                />
              ) : (
                <textarea
                  value={analyseFormData.commentaires || ''}
                  rows={3}
                  disabled
                  className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-600 text-xs"
                />
              )}
              {(analyseFormData.probabilite && `${analyseFormData.probabilite}`.trim() !== '') && (!analyseFormData.commentaires || analyseFormData.commentaires.trim() === '') && (
                <div className="text-[10px] text-red-600 mt-0.5">Le commentaire est obligatoire lorsque la probabilité est renseignée.</div>
              )}
            </div>

            {/* Message si val_indicateur vide et champ probabilité actif */}
            {analyseFormData.val_indicateur_vide && canModifyAnalyse() && (
              <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded">
                💡 La valeur de l'indicateur n'est pas renseignée. Vous pouvez saisir manuellement la probabilité.
              </div>
            )}

            {/* Boutons d'action */}
            <div className="flex justify-between pt-3 border-t border-gray-200">
              <div>
                {/* Bouton Effacer - seulement si probabilité est active et modifiable */}
                {analyseFormData.val_indicateur_vide && canModifyAnalyse() && (
                  <button 
                    onClick={() => {
                      // Effacer la probabilité et la date de saisie
                      let newRetard = null
                      let newNivRetard = '-'
                      if (analyseFormData.date_limite) {
                        const dlNorm = new Date(new Date(analyseFormData.date_limite + 'T00:00:00').getFullYear(), new Date(analyseFormData.date_limite + 'T00:00:00').getMonth(), new Date(analyseFormData.date_limite + 'T00:00:00').getDate())
                        const aujourdhui = new Date()
                        const ajdNorm = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())
                        newRetard = Math.floor((ajdNorm - dlNorm) / (1000 * 60 * 60 * 24))
                        newNivRetard = newRetard <= 0 ? 'Pas retard' : 'Retard'
                      }
                      setAnalyseFormData({ 
                        ...analyseFormData, 
                        probabilite: '', 
                        date_saisie: null,
                        retard: newRetard,
                        niv_retard: newNivRetard
                      })
                    }} 
                    className="px-3 py-1.5 text-xs text-orange-600 bg-orange-50 rounded hover:bg-orange-100"
                  >
                    Effacer
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAnalyseModal(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                  Fermer
                </button>
                {/* Bouton Enregistrer - seulement si probabilité est modifiable */}
                {analyseFormData.val_indicateur_vide && canModifyAnalyse() && (
                  <button onClick={handleSaveAnalyse} className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700">
                    Enregistrer
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // SECTION ÉVALUATION - Refaite selon les instructions détaillées
  // States pour l'évaluation
  const [evaluationFilters2, setEvaluationFilters2] = useState({ 
    categorie: '', structure: '', typeEvaluation: '', processus: '', criticite: '', typeCriticite: 'Nette', recherche: '' 
  })
  const [periodeEvaluation, setPeriodeEvaluation] = useState({ annee: '', semestre: '', trimestre: '', mois: '' })
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [selectedEvaluationRisk, setSelectedEvaluationRisk] = useState(null)

  // Par défaut, sur Évaluation : période ouverte si existante, sinon période la plus récente (date_fin max)
  useEffect(() => {
    const hasSelection = !!(periodeEvaluation.annee || periodeEvaluation.semestre || periodeEvaluation.trimestre || periodeEvaluation.mois)
    if (hasSelection) return
    if (periodeOuverte) {
      setPeriodeEvaluation(periodeToFormLong(periodeOuverte))
      return
    }
    const mostRecent = getMostRecentPeriode(allPeriodes)
    if (mostRecent) setPeriodeEvaluation(periodeToFormLong(mostRecent))
  }, [periodeOuverte, allPeriodes])

  // Filtrer les risques pour l'évaluation
  const getFilteredEvaluationRisques = () => {
    // Générer la clé de période pour l'évaluation
    const getPeriodeKeyEval = () => {
      if (!periodeEvaluation.annee) return ''
      if (periodeEvaluation.mois) return `${periodeEvaluation.mois}-${periodeEvaluation.annee}`
      if (periodeEvaluation.trimestre) {
        const tNum = periodeEvaluation.trimestre.replace('Trimestre ', 'T')
        return `${tNum}-${periodeEvaluation.annee}`
      }
      if (periodeEvaluation.semestre) {
        const sNum = periodeEvaluation.semestre.replace('Semestre ', 'S')
        return `${sNum}-${periodeEvaluation.annee}`
      }
      return periodeEvaluation.annee
    }
    const periodeKey = getPeriodeKeyEval()
    const selectedPeriodeObj = findSelectedPeriodeFromForm(periodeEvaluation)
    const isPeriodeFermee = selectedPeriodeObj && selectedPeriodeObj.statut !== 'Ouvert'
    
    const base = risques.filter(r => {
      if (r.statut !== 'Actif') return false
      if (evaluationFilters2.categorie && !r.categories?.includes(parseInt(evaluationFilters2.categorie))) return false
      if (evaluationFilters2.structure && r.code_structure !== evaluationFilters2.structure) return false
      if (evaluationFilters2.processus && r.code_processus !== evaluationFilters2.processus) return false
      if (evaluationFilters2.recherche) {
        const search = evaluationFilters2.recherche.toLowerCase()
        if (!r.code_risque?.toLowerCase().includes(search) && 
            !r.libelle_risque?.toLowerCase().includes(search) &&
            !r.processus?.libelle_processus?.toLowerCase().includes(search)) return false
      }
      
      // Filtre Type évaluation
      if (evaluationFilters2.typeEvaluation && periodeKey) {
        if (isPeriodeFermee) {
          const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
          const hasRp = !!rpRow

          switch (evaluationFilters2.typeEvaluation) {
            case 'Eval. quali':
              if (!(hasRp && rpRow.ind_obtenu === 'Non')) return false
              break
            case 'Eval. quanti':
              if (!(hasRp && rpRow.ind_obtenu === 'Oui')) return false
              break
            case 'Eval. quali & quanti':
              if (!hasRp) return false
              break
            case 'Non évalué':
              if (hasRp) return false
              break
            default:
              break
          }
        } else {
          // Période ouverte : logique historique
          const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey))
          const storedProba = rpRow?.probabilite
          const hasStoredProba = storedProba !== null && storedProba !== undefined && storedProba !== ''

          const indicOcc = indicateurOccurrences.find(io => io.code_indicateur === r.code_indicateur && samePeriodeKey(io.periode, periodeKey))
          const valInd = indicOcc?.val_indicateur
          const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''

          const seuils = {
            seuil1: r.indicateur?.seuil1 || r.indicateur?.seuil_1,
            seuil2: r.indicateur?.seuil2 || r.indicateur?.seuil_2,
            seuil3: r.indicateur?.seuil3 || r.indicateur?.seuil_3
          }
          const calculatedProba = (hasValInd && seuils.seuil1 && seuils.seuil2 && seuils.seuil3)
            ? calculateProbabilite(valInd, seuils, r.indicateur?.sens)
            : ''
          const hasCalculatedProba = calculatedProba !== '' && calculatedProba !== null && calculatedProba !== undefined

          const hasProba = hasCalculatedProba || hasStoredProba
          const isProbFromIndicator = hasCalculatedProba

          switch (evaluationFilters2.typeEvaluation) {
            case 'Eval. quali':
              if (!(hasProba && !isProbFromIndicator)) return false
              break
            case 'Eval. quanti':
              if (!isProbFromIndicator) return false
              break
            case 'Eval. quali & quanti':
              if (!hasProba) return false
              break
            default:
              break
          }
        }
      }
      
      // Filtre Criticité
      if (evaluationFilters2.criticite && periodeKey) {
        const isQualitatif = r.qualitatif === 'Oui' || !r.code_indicateur
        
        // Chercher la probabilité selon le type de risque
        let indicOcc = null
        let storedProba = null
        let rpRow = null
        
        if (isQualitatif) {
          const probQualit = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
          storedProba = probQualit?.probabilite
        } else {
          indicOcc = indicateurOccurrences.find(io => io.code_indicateur === r.code_indicateur && io.periode === periodeKey)
          const probBackup = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && rp.periode === periodeKey)
          // La probabilité n'est plus stockée sur indicateur_occurrences (colonne supprimée)
          storedProba = probBackup?.probabilite
        }
        
        const valInd = isQualitatif ? null : indicOcc?.val_indicateur
        const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''
        
        const seuils = { 
          seuil1: r.indicateur?.seuil1 || r.indicateur?.seuil_1, 
          seuil2: r.indicateur?.seuil2 || r.indicateur?.seuil_2, 
          seuil3: r.indicateur?.seuil3 || r.indicateur?.seuil_3 
        }
        const calculatedProba = (!isQualitatif && hasValInd) ? calculateProbabilite(valInd, seuils, r.indicateur?.sens) : ''
        const probDisplay = calculatedProba || storedProba || ''
        
        if (probDisplay) {
          // Utiliser l'impact selon le type (brut ou net)
          const useBrute = evaluationFilters2.typeCriticite === 'Brute'
          const impactBrut = r.impact
          const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
          const impact = useBrute ? impactBrut : impactNet
          
          // Nouveau calcul: Criticité = Impact × Probabilité
          const criticite = calculateCriticite(impact, parseInt(probDisplay))
          const niveau = getNiveauCriticite(criticite)
          
          switch (evaluationFilters2.criticite) {
            case 'faible':
              if (niveau.label !== 'Risque faible') return false
              break
            case 'modere':
              if (niveau.label !== 'Risque modéré') return false
              break
            case 'significatif':
              if (niveau.label !== 'Risque significatif') return false
              break
            case 'critique':
              if (niveau.label !== 'Risque critique') return false
              break
          }
        } else if (evaluationFilters2.criticite) {
          // Pas de probabilité = pas de criticité calculée
          return false
        }
      }
      
      return true
    })

    if (!isPeriodeFermee) return base
    return base.map(r => {
      const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
      return {
        ...r,
        impact: rpRow?.impact ?? null,
        efficacite_contr: rpRow?.eff_ctrl ?? null,
        indic_obtenu: rpRow?.ind_obtenu ?? r.indic_obtenu,
        _rp: rpRow
      }
    })
  }

  // Calculer la criticité et le niveau
  // NOUVEAU SYSTÈME DE CALCUL DE CRITICITÉ
  // Calculer l'atténuation basée sur l'efficacité de contrôle
  const calculateAttenuation = (efficacite_contr) => {
    if (efficacite_contr === 1) return -3
    if (efficacite_contr === 2) return -2
    if (efficacite_contr === 3) return -1
    return 0 // efficacite_contr === 4
  }

  // Calculer l'impact net
  const calculateImpactNet = (impactBrut, efficacite_contr) => {
    const attenuation = calculateAttenuation(efficacite_contr)
    return Math.max(1, impactBrut + attenuation) // attenuation est négatif donc on additionne
  }

  // Calculer le score de criticité (brute ou nette)
  const calculateCriticite = (impact, probabilite) => {
    const prob = probabilite || 1
    return impact * prob
  }

  // Ancien calcul gardé pour compatibilité (sera retiré plus tard)
  const calculateCriticiteOld = (impact, probabilite, efficacite_contr) => {
    const prob = probabilite || 1
    return impact * prob * efficacite_contr
  }

  // Nouveau système de niveau de criticité (score 1-16)
  // Score 1-3: Faible, 4-6: Modéré, 8-9: Significatif, 12-16: Critique
  const getNiveauCriticite = (criticite) => {
    if (criticite <= 3) return { label: 'Risque faible', color: 'bg-green-500 text-white' }
    if (criticite <= 6) return { label: 'Risque modéré', color: 'bg-yellow-500 text-white' }
    if (criticite <= 9) return { label: 'Risque significatif', color: 'bg-orange-500 text-white' }
    return { label: 'Risque critique', color: 'bg-red-500 text-white' }
  }

  // Couleur pour le score de criticité
  const getCriticiteColor = (criticite) => {
    if (criticite <= 3) return 'bg-green-100 text-green-800'
    if (criticite <= 6) return 'bg-yellow-100 text-yellow-800'
    if (criticite <= 9) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  // Classe CSS pour les badges de criticité (Plan de maîtrise)
  // Utilisée dans le tableau (colonne niveau/score)
  const getCriticiteBg = (criticite) => {
    if (!criticite) return 'bg-gray-100 text-gray-700'
    // Réutiliser la même palette que getCriticiteColor pour rester cohérent
    return getCriticiteColor(criticite)
  }

  // Niveau de criticité (Plan de maîtrise) - utilisé pour le filtre "Criticité"
  // Retourne uniquement le libellé (sans le préfixe "Risque ")
  const getNiveauCriticitePlan = (criticite) => {
    if (!criticite && criticite !== 0) return ''
    if (criticite <= 3) return 'Faible'
    if (criticite <= 6) return 'Modéré'
    if (criticite <= 9) return 'Significatif'
    return 'Critique'
  }

  // Index numérique (1-4) affiché dans certaines colonnes (Plan de maîtrise)
  const getIndexCriticite = (criticite) => {
    if (!criticite) return ''
    return getNiveauCriticiteNum(criticite)
  }

  // Nombre d'actions associées à un risque (Plan de maîtrise)
  const getNbActionsRisque = (codeRisque) => {
    if (!codeRisque) return 0
    return planActions.filter(a => a.code_risque === codeRisque).length
  }

  // Nouveau système de niveau de criticité numérique (1-4) - basé sur score 1-16
  // Score 1-3: Niveau 1 (Faible), 4-6: Niveau 2 (Modéré), 8-9: Niveau 3 (Significatif), 12-16: Niveau 4 (Critique)
  const getNiveauCriticiteNum = (criticite) => {
    if (criticite <= 3) return 1  // Faible
    if (criticite <= 6) return 2  // Modéré
    if (criticite <= 9) return 3  // Significatif
    return 4                      // Critique
  }

  // Générer la clé de période pour l'évaluation (fonction standalone)
  const getPeriodeKeyEvaluation = () => {
    if (!periodeEvaluation.annee) return ''
    if (periodeEvaluation.mois) return `${periodeEvaluation.mois}-${periodeEvaluation.annee}`
    if (periodeEvaluation.trimestre) {
      const tNum = periodeEvaluation.trimestre.replace('Trimestre ', 'T')
      return `${tNum}-${periodeEvaluation.annee}`
    }
    if (periodeEvaluation.semestre) {
      const sNum = periodeEvaluation.semestre.replace('Semestre ', 'S')
      return `${sNum}-${periodeEvaluation.annee}`
    }
    return periodeEvaluation.annee
  }

  // Compter les risques avec criticité calculée
  const countRisquesAvecCriticite = () => {
    const filtered = getFilteredEvaluationRisques()
    // Pour l'instant, on considère que tous les risques ont une criticité si Impact et Eff.Ctrl sont définis
    return filtered.filter(r => r.impact && r.efficacite_contr).length
  }

  // Exporter le tableau d'évaluation
  const handleExportEvaluation = () => {
    const periodeKey = getPeriodeKeyEvaluation()
    const filteredData = getFilteredEvaluationRisques()
    const useBrute = evaluationFilters2.typeCriticite === 'Brute'
    
    // Filtrer pour n'exporter que les risques avec probabilité renseignée (comme dans le tableau)
    const risquesAvecProb = filteredData.filter(r => {
      const probData = getRisqueProbabilite(r, periodeKey)
      return probData.hasProb
    })
    
    if (risquesAvecProb.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    // Colonnes exactes du tableau - nom de criticité selon le filtre
    const criticiteLabel = useBrute ? 'Criticité brute' : 'Criticité nette'
    
    const rows = risquesAvecProb.map(r => {
      const probData = getRisqueProbabilite(r, periodeKey)
      const probabilite = parseInt(probData.probDisplay)
      
      // Impact selon le type (brut ou net)
      const impactBrut = r.impact
      const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
      const impactPourCriticite = useBrute ? impactBrut : impactNet
      
      // Criticité = Impact × Probabilité
      const criticite = impactPourCriticite * probabilite
      const niveau = getNiveauCriticite(criticite)
      
      return {
        'Période': periodeKey,
        'Code risque': r.code_risque,
        'Libellé risque': r.libelle_risque,
        'Code proc.': r.code_processus,
        'Libellé processus': r.processus?.libelle_processus || '',
        'Impact brut': impactBrut,
        'Eff.Ctrl': r.efficacite_contr,
        'Impact net': impactNet,
        'Prob.': probabilite,
        [criticiteLabel]: criticite,
        'Niv. criticité': niveau.label
      }
    })
    
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluation')
    XLSX.writeFile(wb, `evaluation_risques_${periodeKey}_${useBrute ? 'brute' : 'nette'}_${Date.now()}.xlsx`)
  }

  // Calculer les statistiques de criticité pour l'affichage
  const getEvaluationStats = () => {
    const periodeKey = getPeriodeKeyEvaluation()
    // Si pas de période sélectionnée, ne rien compter
    if (!periodeKey) {
      const pct = () => 0
      return { total: 0, niv1: 0, niv2: 0, niv3: 0, niv4: 0, pct }
    }
    const filteredData = getFilteredEvaluationRisques()
    const useBrute = evaluationFilters2.typeCriticite === 'Brute'

    // Ne garder que les risques avec probabilité renseignée (calculée ou manuelle)
    const risquesAvecProb = filteredData.filter(r => {
      const probData = getRisqueProbabilite(r, periodeKey)
      return probData.hasProb
    })

    const total = risquesAvecProb.length
    let niv1 = 0, niv2 = 0, niv3 = 0, niv4 = 0

    risquesAvecProb.forEach(r => {
      const probData = getRisqueProbabilite(r, periodeKey)
      const prob = parseInt(probData.probDisplay, 10)
      if (!prob || Number.isNaN(prob)) return

      const impactBrut = r.impact
      const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
      const impact = useBrute ? impactBrut : impactNet

      const criticite = calculateCriticite(impact, prob)
      const niveau = getNiveauCriticite(criticite)

      // getNiveauCriticite renvoie un objet {label, color}
      if (niveau?.label === 'Risque faible') niv1++
      else if (niveau?.label === 'Risque modéré') niv2++
      else if (niveau?.label === 'Risque significatif') niv3++
      else if (niveau?.label === 'Risque critique') niv4++
    })

    // % helper (utilisé par l'UI)
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0)

    return { total, niv1, niv2, niv3, niv4, pct }
  }

  // Ouvrir le modal de visualisation
  const handleViewEvaluation = (risque) => {
    setSelectedEvaluationRisk(risque)
    setShowEvaluationModal(true)
  }

  const renderEvaluation = () => {
    const filteredRisquesEval = getFilteredEvaluationRisques()
    
    // Obtenir les années disponibles (uniquement celles avec des périodes ouvertes/fermées)
    const availableYearsEval = [...new Set(allPeriodes.map(p => p.annee))].sort((a, b) => b - a)
    
    // Obtenir les semestres disponibles pour l'année sélectionnée
    const availableSemestresEval = allPeriodes
      .filter(p => p.annee?.toString() === periodeEvaluation.annee && p.semestre)
      .map(p => p.semestre)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
    
    // Obtenir les trimestres disponibles pour l'année sélectionnée
    const availableTrimestresEval = allPeriodes
      .filter(p => p.annee?.toString() === periodeEvaluation.annee && p.trimestre)
      .map(p => p.trimestre)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
    
    // Obtenir les mois disponibles pour l'année sélectionnée
    const availableMoisEval = allPeriodes
      .filter(p => p.annee?.toString() === periodeEvaluation.annee && p.mois)
      .map(p => p.mois)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b)
    
    // Trouver la période sélectionnée
    const getSelectedPeriodeEval = () => {
      if (!periodeEvaluation.annee) return null
      return allPeriodes.find(p => {
        if (p.annee?.toString() !== periodeEvaluation.annee) return false
        if (periodeEvaluation.mois) {
          const moisNum = moisList.indexOf(periodeEvaluation.mois) + 1
          return p.mois === moisNum
        }
        if (periodeEvaluation.trimestre) {
          const tNum = parseInt(periodeEvaluation.trimestre.replace('Trimestre ', ''))
          return p.trimestre === tNum
        }
        if (periodeEvaluation.semestre) {
          const sNum = parseInt(periodeEvaluation.semestre.replace('Semestre ', ''))
          return p.semestre === sNum
        }
        return !p.mois && !p.trimestre && !p.semestre
      })
    }
    const selectedPeriodeEval = getSelectedPeriodeEval()
    
    return (
      <div className="space-y-4">
        {/* Cadre 1: Filtres sur les risques - identique à Analyse + Criticité */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2 overflow-x-auto">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Catégorie"
                size="sm"
                value={evaluationFilters2.categorie || ''}
                onChange={(v) => setEvaluationFilters2({ ...evaluationFilters2, categorie: v })}
                options={[
                  { value: '', label: 'Toutes' },
                  ...categories.filter(c => c.statut === 'Actif').map(c => ({
                    value: c.code_categorie?.toString() || c.id?.toString(),
                    label: c.libelle_categorie
                  }))
                ]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Structure"
                size="sm"
                value={evaluationFilters2.structure || ''}
                onChange={(v) => setEvaluationFilters2({ ...evaluationFilters2, structure: v })}
                options={[
                  { value: '', label: 'Toutes' },
                  ...structures.map(s => ({
                    value: s.code_structure,
                    label: s.libelle_structure
                  }))
                ]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Processus"
                size="sm"
                value={evaluationFilters2.processus || ''}
                onChange={(v) => setEvaluationFilters2({ ...evaluationFilters2, processus: v })}
                options={[
                  { value: '', label: 'Tous' },
                  ...processus.filter(p => p.statut === 'Actif').map(p => ({
                    value: p.code_processus,
                    label: p.libelle_processus
                  }))
                ]}
                placeholder="Tous"
              />
            </div>

            <div className="w-[140px] flex-shrink-0">
              <SearchableSelect
                label="Type évaluation"
                size="sm"
                value={evaluationFilters2.typeEvaluation || ''}
                onChange={(v) => setEvaluationFilters2({ ...evaluationFilters2, typeEvaluation: v })}
                options={[
                  { value: '', label: 'Tous' },
                  { value: 'Eval. quali', label: 'Eval. quali' },
                  { value: 'Eval. quanti', label: 'Eval. quanti' },
                  { value: 'Eval. quali & quanti', label: 'Eval. quali & quanti' }
                ]}
                placeholder="Tous"
              />
            </div>

            <div className="w-[120px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Criticité</label>
              <select value={evaluationFilters2.criticite || ''} onChange={(e) => setEvaluationFilters2({ ...evaluationFilters2, criticite: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="">Toutes</option>
                <option value="faible">Faible</option>
                <option value="modere">Modéré</option>
                <option value="significatif">Significatif</option>
                <option value="critique">Critique</option>
              </select>
            </div>
            <div className="w-[90px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Type crit.</label>
              <select value={evaluationFilters2.typeCriticite} onChange={(e) => setEvaluationFilters2({ ...evaluationFilters2, typeCriticite: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-purple-50">
                <option value="Brute">Brute</option>
                <option value="Nette">Nette</option>
              </select>
            </div>
            <div className="flex-1 min-w-[80px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Recherche</label>
              <input type="text" value={evaluationFilters2.recherche || ''} onChange={(e) => setEvaluationFilters2({ ...evaluationFilters2, recherche: e.target.value })} placeholder="Code, libellé..." className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
            </div>
            <button onClick={() => setEvaluationFilters2({ categorie: '', structure: '', typeEvaluation: '', processus: '', criticite: '', typeCriticite: 'Nette', recherche: '' })} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser les filtres">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Cadre 2: Filtres sur la période - identique à Analyse */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[90px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Année <span className="text-red-500">*</span></label>
              <select value={periodeEvaluation.annee} onChange={(e) => setPeriodeEvaluation({ annee: e.target.value, semestre: '', trimestre: '', mois: '' })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="">--</option>
                {availableYearsEval.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Semestre</label>
              <select value={periodeEvaluation.semestre} onChange={(e) => setPeriodeEvaluation({ ...periodeEvaluation, semestre: e.target.value, trimestre: '', mois: '' })} disabled={!periodeEvaluation.annee || availableSemestresEval.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableSemestresEval.map(s => <option key={s} value={`Semestre ${s}`}>Semestre {s}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Trimestre</label>
              <select value={periodeEvaluation.trimestre} onChange={(e) => setPeriodeEvaluation({ ...periodeEvaluation, trimestre: e.target.value, semestre: '', mois: '' })} disabled={!periodeEvaluation.annee || availableTrimestresEval.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableTrimestresEval.map(t => <option key={t} value={`Trimestre ${t}`}>Trimestre {t}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Mois</label>
              <select value={periodeEvaluation.mois} onChange={(e) => setPeriodeEvaluation({ ...periodeEvaluation, mois: e.target.value, semestre: '', trimestre: '' })} disabled={!periodeEvaluation.annee || availableMoisEval.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableMoisEval.map(m => <option key={m} value={moisList[m - 1]}>{moisList[m - 1]}</option>)}
              </select>
            </div>
            {selectedPeriodeEval && (
              <div className={`text-[10px] px-2 py-1 rounded ${selectedPeriodeEval.statut === 'Ouvert' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>
                <span className="font-medium">Période {selectedPeriodeEval.statut === 'Ouvert' ? '🟢 Ouverte' : '🔴 Fermée'}</span>
                {selectedPeriodeEval.date_limite_saisie && (
                  <span className="ml-2">| Date limite: <strong>{new Date(selectedPeriodeEval.date_limite_saisie).toLocaleDateString('fr-FR')}</strong></span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ligne: Bouton export + compteurs par niveau de criticité */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button variant="secondary" icon={Download} size="sm" onClick={handleExportEvaluation}>Exporter Excel</Button>
          {(() => {
            const stats = getEvaluationStats()
            return (
              <div className="flex items-center gap-3 text-xs">
                <span className="bg-gray-100 px-2 py-1 rounded">
                  Total: <strong className="text-gray-700">{stats.total}</strong>
                </span>
                <span className="bg-green-50 px-2 py-1 rounded text-green-700">
                  Faible: <strong>{stats.niv1}</strong> <span className="text-green-500">({stats.pct(stats.niv1)}%)</span>
                </span>
                <span className="bg-yellow-50 px-2 py-1 rounded text-yellow-700">
                  Modéré: <strong>{stats.niv2}</strong> <span className="text-yellow-500">({stats.pct(stats.niv2)}%)</span>
                </span>
                <span className="bg-orange-50 px-2 py-1 rounded text-orange-700">
                  Significatif: <strong>{stats.niv3}</strong> <span className="text-orange-500">({stats.pct(stats.niv3)}%)</span>
                </span>
                <span className="bg-red-50 px-2 py-1 rounded text-red-700">
                  Critique: <strong>{stats.niv4}</strong> <span className="text-red-500">({stats.pct(stats.niv4)}%)</span>
                </span>
              </div>
            )
          })()}
        </div>

        {/* Message si année non sélectionnée */}
        {!periodeEvaluation.annee && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center text-yellow-700 text-sm">
            <AlertTriangle size={20} className="inline mr-2" />
            Veuillez sélectionner une année pour afficher les données d'évaluation
          </div>
        )}

        {/* Tableau d'évaluation */}
        {periodeEvaluation.annee && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Indication de scroll */}
            <div className="bg-gray-50 px-3 py-1 border-b border-gray-100 text-[10px] text-gray-400 flex items-center gap-1">
              <span>↔</span> Faites défiler horizontalement pour voir toutes les colonnes • <span className="text-purple-600 font-medium">Type criticité: {evaluationFilters2.typeCriticite}</span>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: '60vh' }}>
              <table className="w-full text-[10px]" style={{ minWidth: '1200px' }}>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th style={{width: '100px', minWidth: '100px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Période</th>
                    <th style={{width: '90px', minWidth: '90px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Code risque</th>
                    <th style={{width: '250px', minWidth: '250px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Libellé risque</th>
                    <th style={{width: '80px', minWidth: '80px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Code proc.</th>
                    <th style={{width: '200px', minWidth: '200px'}} className="px-2 py-2.5 text-left text-[11px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Libellé processus</th>
                    <th style={{width: '70px', minWidth: '70px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Impact</th>
                    <th style={{width: '60px', minWidth: '60px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Prob.</th>
                    <th style={{width: '80px', minWidth: '80px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap bg-purple-600">Criticité</th>
                    <th style={{width: '120px', minWidth: '120px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap bg-purple-600">Niv. criticité</th>
                    <th style={{width: '50px', minWidth: '50px'}} className="px-2 py-2.5 text-center text-[11px] font-semibold text-white whitespace-nowrap sticky right-0 bg-[#2c5282]">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const periodeKey = getPeriodeKeyEvaluation()
                    const useBrute = evaluationFilters2.typeCriticite === 'Brute'
                    
                    // Filtrer les risques pour n'afficher que ceux avec probabilité renseignée
                    const risquesAvecProb = filteredRisquesEval.filter(r => {
                      const probData = getRisqueProbabilite(r, periodeKey)
                      return probData.hasProb
                    })
                    
                    if (risquesAvecProb.length === 0) {
                      return (
                        <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Aucun risque avec probabilité renseignée pour cette période</td></tr>
                      )
                    }
                    
                    return risquesAvecProb.map((r, idx) => {
                      const probData = getRisqueProbabilite(r, periodeKey)
                      const probabilite = parseInt(probData.probDisplay)
                      
                      // Calculer l'impact selon le type (brut ou net)
                      const impactBrut = r.impact
                      const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
                      const impact = useBrute ? impactBrut : impactNet
                      
                      // Calculer la criticité (nouveau système: Impact × Probabilité)
                      const criticite = calculateCriticite(impact, probabilite)
                      const niveau = getNiveauCriticite(criticite)
                      
                      return (
                        <tr key={r.id} className={`hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className="px-2 py-2 text-gray-700 font-medium">{periodeKey}</td>
                          <td className="px-2 py-2 font-mono font-bold text-blue-600">{r.code_risque}</td>
                          <td className="px-2 py-2 text-gray-700" title={r.libelle_risque}>
                            <div className="line-clamp-2">{r.libelle_risque}</div>
                          </td>
                          <td className="px-2 py-2 font-mono text-gray-700">{r.code_processus}</td>
                          <td className="px-2 py-2 text-gray-700" title={r.processus?.libelle_processus}>
                            <div className="line-clamp-2">{r.processus?.libelle_processus || '-'}</div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${impact >= 4 ? 'bg-red-500' : impact >= 3 ? 'bg-orange-500' : impact >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{impact}</span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${probabilite >= 4 ? 'bg-red-500' : probabilite >= 3 ? 'bg-orange-500' : probabilite >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{probabilite}</span>
                          </td>
                          <td className="px-2 py-2 text-center bg-purple-50">
                            <span className={`inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded text-xs font-bold ${getCriticiteColor(criticite)}`}>{criticite}</span>
                          </td>
                          <td className="px-2 py-2 text-center bg-purple-50">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-[9px] font-semibold ${niveau.color}`}>{niveau.label}</span>
                          </td>
                          <td className="px-2 py-2 text-center sticky right-0 bg-inherit">
                            <button onClick={() => handleViewEvaluation(r)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Voir détails">
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
            <div className="px-2 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              Affichage de {filteredRisquesEval.length} risque(s) actif(s) • Criticité {evaluationFilters2.typeCriticite}: Impact × Probabilité (1-16)
            </div>
          </div>
        )}

        {/* Modal de visualisation (lecture seule) */}
        <Modal isOpen={showEvaluationModal} onClose={() => setShowEvaluationModal(false)} title="Détails de l'évaluation du risque" size="lg" closeOnClickOutside={false}>
          {selectedEvaluationRisk && (() => {
            const periodeKey = getPeriodeKeyEvaluation()
            // IMPORTANT: utiliser exactement la même logique de probabilité que le tableau
            const probData = getRisqueProbabilite(selectedEvaluationRisk, periodeKey)
            const hasProbabilite = !!probData?.hasProb
            const probabilite = hasProbabilite ? parseInt(probData.probDisplay, 10) : null
            
            // Utiliser le type de criticité (Brute/Nette)
            const useBrute = evaluationFilters2.typeCriticite === 'Brute'
            const impactBrut = selectedEvaluationRisk.impact
            const impactNet = calculateImpactNet(selectedEvaluationRisk.impact, selectedEvaluationRisk.efficacite_contr)
            const impactDisplay = useBrute ? impactBrut : impactNet
            
            // Nouveau calcul: Criticité = Impact × Probabilité
            const criticite = hasProbabilite ? calculateCriticite(impactDisplay, probabilite) : null
            const niveau = criticite ? getNiveauCriticite(criticite) : null
            
            return (
              <div className="space-y-4 text-sm">
                {/* Période et Type criticité */}
                <div className="flex gap-3">
                  <div className="flex-1 p-3 bg-blue-50 rounded-lg">
                    <label className="block text-[10px] text-blue-600 mb-0.5">Période</label>
                    <p className="font-semibold text-blue-900 text-lg">{periodeKey || '-'}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <label className="block text-[10px] text-purple-600 mb-0.5">Type criticité</label>
                    <p className="font-semibold text-purple-900 text-lg">{evaluationFilters2.typeCriticite}</p>
                  </div>
                </div>

                {/* Informations du risque */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Code risque</label>
                    <p className="font-mono font-bold text-blue-600">{selectedEvaluationRisk.code_risque}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Code processus</label>
                    <p className="font-mono">{selectedEvaluationRisk.code_processus}</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <label className="block text-[10px] text-gray-500 mb-0.5">Libellé risque</label>
                  <p className="font-medium">{selectedEvaluationRisk.libelle_risque}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <label className="block text-[10px] text-gray-500 mb-0.5">Libellé processus</label>
                  <p>{selectedEvaluationRisk.processus?.libelle_processus || '-'}</p>
                </div>

                {/* Indices - 4 colonnes incluant Impact net */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <label className="block text-[10px] text-gray-500 mb-1">Impact brut</label>
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg font-bold ${impactBrut >= 4 ? 'bg-red-500' : impactBrut >= 3 ? 'bg-orange-500' : impactBrut >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{impactBrut}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <label className="block text-[10px] text-gray-500 mb-1">Eff. Ctrl</label>
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg font-bold ${selectedEvaluationRisk.efficacite_contr >= 4 ? 'bg-red-500' : selectedEvaluationRisk.efficacite_contr >= 3 ? 'bg-orange-500' : selectedEvaluationRisk.efficacite_contr >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{selectedEvaluationRisk.efficacite_contr}</span>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${!useBrute ? 'bg-purple-50 border-2 border-purple-300' : 'bg-gray-50'}`}>
                    <label className="block text-[10px] text-purple-600 mb-1">Impact net</label>
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg font-bold ${impactNet >= 4 ? 'bg-red-500' : impactNet >= 3 ? 'bg-orange-500' : impactNet >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{impactNet}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <label className="block text-[10px] text-gray-500 mb-1">Probabilité</label>
                    {hasProbabilite ? (
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg font-bold ${probabilite >= 4 ? 'bg-red-500' : probabilite >= 3 ? 'bg-orange-500' : probabilite >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{probabilite}</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-300 text-gray-600 text-lg font-bold">-</span>
                    )}
                  </div>
                </div>

                {/* Formule de calcul */}
                <div className="p-3 bg-blue-50 rounded-lg text-center text-sm">
                  <span className="text-blue-700">
                    Criticité = <strong>{useBrute ? 'Impact brut' : 'Impact net'}</strong> × Probabilité = 
                    <strong className="ml-1">{impactDisplay}</strong> × <strong>{probabilite || '?'}</strong> = 
                    <strong className="ml-1 text-lg">{criticite !== null ? criticite : '?'}</strong>
                  </span>
                </div>

                {/* Criticité et Niveau */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-4 rounded-lg text-center ${criticite !== null ? getCriticiteColor(criticite) : 'bg-gray-100'}`}>
                    <label className="block text-[10px] opacity-75 mb-1">Criticité {evaluationFilters2.typeCriticite}</label>
                    <p className="text-3xl font-bold">{criticite !== null ? criticite : '-'}</p>
                    <p className="text-xs opacity-75">/ 16</p>
                  </div>
                  <div className={`p-4 rounded-lg text-center ${niveau ? niveau.color : 'bg-gray-100 text-gray-600'}`}>
                    <label className="block text-[10px] opacity-75 mb-1">Niveau de criticité</label>
                    <p className="text-lg font-bold">{niveau ? niveau.label : '-'}</p>
                  </div>
                </div>

                {/* Bouton fermer */}
                <div className="flex justify-end pt-3 border-t border-gray-200">
                  <button onClick={() => setShowEvaluationModal(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Fermer
                  </button>
                </div>
              </div>
            )
          })()}
        </Modal>
      </div>
    )
  }

  // SECTION CARTOGRAPHIE - Matrice 4×4 avec scores fixes
  // Les risques sont placés dans la cellule correspondant à leur score P×I×E
  // Scores de référence: P × I × I (où E = I dans la référence)
  
  // States pour la cartographie
  const [cartoFilters, setCartoFilters] = useState({ 
    categorie: '', structure: '', typeEvaluation: '', processus: '', criticite: '', typeCriticite: 'Nette', recherche: '' 
  })
  const [periodeCarto, setPeriodeCarto] = useState({ annee: '', semestre: '', trimestre: '', mois: '' })

  // Par défaut, sur Cartographie : période ouverte si existante, sinon période la plus récente (date_fin max)
  useEffect(() => {
    const hasSelection = !!(periodeCarto.annee || periodeCarto.semestre || periodeCarto.trimestre || periodeCarto.mois)
    if (hasSelection) return
    if (periodeOuverte) {
      setPeriodeCarto(periodeToFormLong(periodeOuverte))
      return
    }
    const mostRecent = getMostRecentPeriode(allPeriodes)
    if (mostRecent) setPeriodeCarto(periodeToFormLong(mostRecent))
  }, [periodeOuverte, allPeriodes])

  // --- Helpers (périodes sélectionnées) ---
  const findSelectedPeriodeFromForm = (form) => {
    console.log('[findSelectedPeriodeFromForm] Recherche période pour:', form)
    if (!form?.annee) {
      console.log('[findSelectedPeriodeFromForm] Pas d\'année → null')
      return null
    }
    
    const result = allPeriodes.find(p => {
      if (p.annee?.toString() !== form.annee) return false

      // Vérifier dans l'ordre : Mois > Trimestre > Semestre > Année
      // IMPORTANT : vérifier que les valeurs ne sont pas vides ou '--'
      
      if (form.mois && form.mois !== '' && form.mois !== '--') {
        const moisNum = moisList.indexOf(form.mois) + 1
        const match = p.mois === moisNum
        console.log(`[findSelectedPeriodeFromForm] Mois: ${form.mois} → ${moisNum}, p.mois=${p.mois}, match=${match}`)
        return match
      }
      
      if (form.trimestre && form.trimestre !== '' && form.trimestre !== '--') {
        const tStr = String(form.trimestre).replace('Trimestre ', '').replace('T', '').trim()
        const tNum = parseInt(tStr, 10)
        const match = !isNaN(tNum) && p.trimestre === tNum
        console.log(`[findSelectedPeriodeFromForm] Trimestre: ${form.trimestre} → tStr="${tStr}", tNum=${tNum}, p.trimestre=${p.trimestre}, match=${match}`)
        return match
      }
      
      if (form.semestre && form.semestre !== '' && form.semestre !== '--') {
        const sStr = String(form.semestre).replace('Semestre ', '').replace('S', '').trim()
        const sNum = parseInt(sStr, 10)
        const match = !isNaN(sNum) && p.semestre === sNum
        console.log(`[findSelectedPeriodeFromForm] Semestre: ${form.semestre} → sStr="${sStr}", sNum=${sNum}, p.semestre=${p.semestre}, match=${match}`)
        return match
      }
      
      // Année seule
      const match = !p.mois && !p.trimestre && !p.semestre
      console.log(`[findSelectedPeriodeFromForm] Année seule, p={mois:${p.mois}, trimestre:${p.trimestre}, semestre:${p.semestre}}, match=${match}`)
      return match
    })
    
    console.log('[findSelectedPeriodeFromForm] Résultat:', result)
    return result
  }

  // Charger automatiquement les données d'archive lorsque l'utilisateur sélectionne une période fermée,
  // afin que les sous-rubriques Analyse/Evaluation/Cartographie/Plan/Synthèse lisent directement
  // dans `archive_risques_periodes`.
  useEffect(() => {
    const getActiveSelectedPeriode = () => {
      if (activeTab === 'analyse') return findSelectedPeriodeFromForm(periodeAnalyse)
      if (activeTab === 'evaluation') return findSelectedPeriodeFromForm(periodeEvaluation)
      if (activeTab === 'cartographie') return findSelectedPeriodeFromForm(periodeCarto)
      if (activeTab === 'plan') return findSelectedPeriodeFromForm(periodeEvaluation)
      if (activeTab === 'synthese') return findSelectedPeriodeFromForm(periodeEvaluation)
      return null
    }

    const selected = getActiveSelectedPeriode()

    // Reset si aucune période sélectionnée
    if (!selected) {
      setArchiveByRisque({})
      setArchiveLoadedPeriodeId(null)
      setArchiveLoadedPeriodeKey(null)
      setCartographieFile(null)
      return
    }

    const isClosed = selected.statut !== 'Ouvert'

    // Si période ouverte : pas d'archive
    if (!isClosed) {
      setArchiveByRisque({})
      setArchiveLoadedPeriodeId(null)
      setArchiveLoadedPeriodeKey(null)
      setCartographieFile(null)
      return
    }

    // Déterminer la clé UI de la période sélectionnée (ex: 2024, T1-2024, S1-2025, 2025-01).
    // On la calcule directement à partir de l'objet période (DB) afin d'éviter toute dépendance
    // à des fonctions locales/imbriquées des onglets.
    const selectedKey = (() => {
      const annee = selected.annee ?? ''
      const mois = selected.mois ?? null
      const trimestre = selected.trimestre ?? null
      const semestre = selected.semestre ?? null

      if (mois) {
        // Harmoniser avec le format de clé utilisé dans les filtres (nom du mois)
        const moisLabel = Array.isArray(moisList) ? moisList[Number(mois) - 1] : null
        return `${moisLabel || mois}-${annee}`
      }
      if (trimestre) return `T${trimestre}-${annee}`
      if (semestre) return `S${semestre}-${annee}`

      // Année simple
      if (annee) return `${annee}`

      // Fallback (si la base ne renseigne pas annee/semestre/trimestre/mois)
      return (selected.libelle || '').toString().trim()
    })()
    setArchiveLoadedPeriodeKey(selectedKey)

    // Charger archive si nécessaire
    if (archiveLoadedPeriodeId !== selected.id) {
      ;(async () => {
        try {
          const res = await fetch(`/api/risques/archive?periodeId=${encodeURIComponent(selected.id)}`)
          if (res.ok) {
            const data = await res.json()
            setArchiveByRisque(data.byRisque || {})
            setArchiveLoadedPeriodeId(selected.id)
          } else {
            setArchiveByRisque({})
            setArchiveLoadedPeriodeId(selected.id)
          }
        } catch (e) {
          console.error('Erreur chargement archive risques:', e)
          setArchiveByRisque({})
          setArchiveLoadedPeriodeId(selected.id)
        }
      })()
    }

    // Cartographie : récupérer le fichier signé pour les périodes fermées
    if (activeTab === 'cartographie') {
      ;(async () => {
        try {
          // IMPORTANT (schéma CNAM): dans `fichiers_cartographie`, l'identifiant de la période
          // est stocké dans `code_periode` et correspond à l'UUID de la période.
          // Donc on envoie toujours `selected.id` (jamais la clé UI du type S1-2025).
          const qs = new URLSearchParams()
          qs.set('code_periode', String(selected.id))
          const res = await fetch(`/api/cartographie/fichier?${qs.toString()}`)
          if (res.ok) {
            const data = await res.json()
            setCartographieFile(data.file || null)
          } else {
            setCartographieFile(null)
          }
        } catch (e) {
          console.error('Erreur chargement fichier cartographie:', e)
          setCartographieFile(null)
        }
      })()
    } else {
      setCartographieFile(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, allPeriodes, periodeAnalyse, periodeEvaluation, periodeCarto])
  const [selectedCartoCell, setSelectedCartoCell] = useState(null) // {row, col, score}
  const [comparaisonActive, setComparaisonActive] = useState(false)
  const [periodeComparaison, setPeriodeComparaison] = useState({ annee: '', semestre: '', trimestre: '', mois: '' })
  const [cartoFullscreen, setCartoFullscreen] = useState(false) // Mode plein écran
  const [cartoFontSize, setCartoFontSize] = useState(5) // Taille police codes (3-8px)

  // Générer la clé de période pour la cartographie
  const getPeriodeKeyCarto = () => {
    if (!periodeCarto.annee) return ''
    if (periodeCarto.mois) return `${periodeCarto.mois}-${periodeCarto.annee}`
    if (periodeCarto.trimestre) {
      const tNum = periodeCarto.trimestre.replace('Trimestre ', 'T')
      return `${tNum}-${periodeCarto.annee}`
    }
    if (periodeCarto.semestre) {
      const sNum = periodeCarto.semestre.replace('Semestre ', 'S')
      return `${sNum}-${periodeCarto.annee}`
    }
    return periodeCarto.annee
  }

  // Générer la clé de période pour la comparaison
  const getPeriodeKeyComparaison = () => {
    if (!periodeComparaison.annee) return ''
    if (periodeComparaison.mois) return `${periodeComparaison.mois}-${periodeComparaison.annee}`
    if (periodeComparaison.trimestre) {
      const tNum = periodeComparaison.trimestre.replace('Trimestre ', 'T')
      return `${tNum}-${periodeComparaison.annee}`
    }
    if (periodeComparaison.semestre) {
      const sNum = periodeComparaison.semestre.replace('Semestre ', 'S')
      return `${sNum}-${periodeComparaison.annee}`
    }
    return periodeComparaison.annee
  }

  // Convertir niveau de criticité en nombre (1-4)
  // Obtenir l'évolution entre deux niveaux de criticité
  const getEvolution = (niveauComparaison, niveauActuel) => {
    // niveauComparaison = XXXX (période antérieure), niveauActuel = YYYY (période actuelle)
    if (!niveauComparaison || !niveauActuel) return null
    
    // Matrice d'évolution selon les règles définies
    const evolutionMatrix = {
      '1-1': { arrow: '→', color: 'text-green-600', direction: 'horizontal' },
      '1-2': { arrow: '↑', color: 'text-yellow-500', direction: 'up' },
      '1-3': { arrow: '↑', color: 'text-orange-500', direction: 'up' },
      '1-4': { arrow: '↑', color: 'text-red-500', direction: 'up' },
      '2-1': { arrow: '↓', color: 'text-green-600', direction: 'down' },
      '2-2': { arrow: '→', color: 'text-yellow-500', direction: 'horizontal' },
      '2-3': { arrow: '↑', color: 'text-orange-500', direction: 'up' },
      '2-4': { arrow: '↑', color: 'text-red-500', direction: 'up' },
      '3-1': { arrow: '↓', color: 'text-green-600', direction: 'down' },
      '3-2': { arrow: '↓', color: 'text-yellow-500', direction: 'down' },
      '3-3': { arrow: '→', color: 'text-orange-500', direction: 'horizontal' },
      '3-4': { arrow: '↑', color: 'text-red-500', direction: 'up' },
      '4-1': { arrow: '↓', color: 'text-green-600', direction: 'down' },
      '4-2': { arrow: '↓', color: 'text-yellow-500', direction: 'down' },
      '4-3': { arrow: '↓', color: 'text-orange-500', direction: 'down' },
      '4-4': { arrow: '→', color: 'text-red-500', direction: 'horizontal' }
    }
    
    return evolutionMatrix[`${niveauComparaison}-${niveauActuel}`]
  }

  // Calculer le taux d'atténuation
  const calculateTauxAttenuation = (criticiteComparaison, criticiteActuelle) => {
    if (!criticiteComparaison || !criticiteActuelle) return null
    
    // Tableau de correspondance du taux d'atténuation selon le tableau fourni
    // Criticité Avant -> Criticité Après -> Taux d'atténuation
    const tauxTable = {
      '1-1': 100, '1-2': -50, '1-3': -75, '1-4': -100,
      '2-1': 100, '2-2': 0, '2-3': -50, '2-4': -100,
      '3-1': 100, '3-2': 50, '3-3': 0, '3-4': -100,
      '4-1': 100, '4-2': 75, '4-3': 50, '4-4': -100
    }
    
    const key = `${criticiteComparaison}-${criticiteActuelle}`
    const taux = tauxTable[key]
    
    if (taux !== undefined) {
      return taux
    }
    
    // Fallback pour les valeurs non prévues dans le tableau
    return null
  }
  
  // Obtenir la flèche associée au taux d'atténuation selon le tableau
  const getTauxAttenuationArrow = (criticiteComparaison, criticiteActuelle) => {
    if (!criticiteComparaison || !criticiteActuelle) return null
    
    // Tableau des flèches selon le tableau fourni
    const arrowTable = {
      '1-1': { direction: 'horizontal', color: 'green', label: 'Flèche verte horizontale vers la droite' },
      '1-2': { direction: 'up', color: 'yellow', label: 'Flèche jaune verticale vers le haut' },
      '1-3': { direction: 'up', color: 'orange', label: 'Flèche orange verticale vers le haut' },
      '1-4': { direction: 'up', color: 'red', label: 'Flèche rouge verticale vers le haut' },
      '2-1': { direction: 'down', color: 'green', label: 'Flèche verte verticale vers le bas' },
      '2-2': { direction: 'horizontal', color: 'yellow', label: 'Flèche jaune horizontale vers la droite' },
      '2-3': { direction: 'up', color: 'orange', label: 'Flèche orange verticale vers le haut' },
      '2-4': { direction: 'up', color: 'red', label: 'Flèche rouge verticale vers le haut' },
      '3-1': { direction: 'down', color: 'green', label: 'Flèche verte verticale vers le bas' },
      '3-2': { direction: 'down', color: 'yellow', label: 'Flèche jaune verticale vers le bas' },
      '3-3': { direction: 'horizontal', color: 'orange', label: 'Flèche orange horizontale vers la droite' },
      '3-4': { direction: 'up', color: 'red', label: 'Flèche rouge verticale vers le haut' },
      '4-1': { direction: 'down', color: 'green', label: 'Flèche verte verticale vers le bas' },
      '4-2': { direction: 'down', color: 'yellow', label: 'Flèche jaune verticale vers le bas' },
      '4-3': { direction: 'down', color: 'orange', label: 'Flèche orange verticale vers le bas' },
      '4-4': { direction: 'horizontal', color: 'red', label: 'Flèche rouge horizontale vers la droite' }
    }
    
    const key = `${criticiteComparaison}-${criticiteActuelle}`
    return arrowTable[key] || null
  }

  // Calculer la date de fin d'une période à partir de ses composants
  const getDateFinPeriode = (periode) => {
    if (!periode || !periode.annee) return null
    const annee = parseInt(periode.annee)
    
    // Si mois spécifié
    if (periode.mois) {
      const moisIndex = typeof periode.mois === 'string' ? moisList.indexOf(periode.mois) : (periode.mois - 1)
      if (moisIndex >= 0) {
        // Dernier jour du mois
        return new Date(annee, moisIndex + 1, 0)
      }
    }
    
    // Si trimestre spécifié
    if (periode.trimestre) {
      const trimNum = typeof periode.trimestre === 'string' 
        ? parseInt(periode.trimestre.replace('Trimestre ', '').replace('T', ''))
        : periode.trimestre
      if (trimNum >= 1 && trimNum <= 4) {
        // Fin du trimestre (T1=31 mars, T2=30 juin, T3=30 sept, T4=31 déc)
        return new Date(annee, trimNum * 3, 0)
      }
    }
    
    // Si semestre spécifié
    if (periode.semestre) {
      const semNum = typeof periode.semestre === 'string'
        ? parseInt(periode.semestre.replace('Semestre ', '').replace('S', ''))
        : periode.semestre
      if (semNum === 1) {
        return new Date(annee, 6, 0) // 30 juin
      } else if (semNum === 2) {
        return new Date(annee, 12, 0) // 31 décembre
      }
    }
    
    // Sinon juste l'année -> 31 décembre
    return new Date(annee, 12, 0)
  }

  // Vérifier si la période de comparaison est strictement antérieure à la période de filtre
  const isComparaisonStrictementAnterieure = () => {
    if (!comparaisonActive) return false
    if (!getPeriodeKeyComparaison()) return false
    
    const dateFinFiltre = getDateFinPeriode(periodeCarto)
    const dateFinComparaison = getDateFinPeriode(periodeComparaison)
    
    if (!dateFinFiltre || !dateFinComparaison) return false
    
    // La date de fin de comparaison doit être strictement avant la date de fin de filtre
    return dateFinComparaison.getTime() < dateFinFiltre.getTime()
  }

  // Vérifier si la période de comparaison a au moins un risque évalué (avec impact, probabilité, criticité)
  const hasRisquesEvaluesComparaison = () => {
    if (!comparaisonActive) return false
    const periodeKeyCompar = getPeriodeKeyComparaison()
    if (!periodeKeyCompar) return false

    // Utiliser la logique centralisée de probabilité (indicateurs + saisie manuelle + sauvegarde)
    const risquesActifs = risques.filter(r => r.statut === 'Actif')
    for (const r of risquesActifs) {
      const probData = getRisqueProbabilite(r, periodeKeyCompar)
      if (probData && probData.hasProb) return true
    }
    return false
  }

  // Déterminer si les colonnes de comparaison doivent s'afficher
  const shouldShowComparaisonColumns = () => {
    if (!comparaisonActive) return false
    if (!getPeriodeKeyComparaison()) return false
    if (!isComparaisonStrictementAnterieure()) return false
    if (!hasRisquesEvaluesComparaison()) return false
    return true
  }

  // Message d'erreur pour la comparaison
  const getComparaisonErrorMessage = () => {
    if (!comparaisonActive) return null
    if (!getPeriodeKeyComparaison()) return null
    
    if (!isComparaisonStrictementAnterieure()) {
      return "⚠️ La période de comparaison doit être strictement antérieure à la période de filtre (date de fin de la période de comparaison < date de fin de la période de filtre)."
    }
    
    if (!hasRisquesEvaluesComparaison()) {
      return "⚠️ Aucun risque n'est évalué (impact, probabilité, criticité) pour la période de comparaison sélectionnée."
    }
    
    return null
  }

  // Filtrer les risques pour la cartographie
  const getFilteredCartoRisques = () => {
    const periodeKey = getPeriodeKeyCarto()
    // Aligner exactement la logique du filtre "Type évaluation" avec la sous-rubrique "Évaluation".
    // Pour les périodes fermées, l'information de type d'évaluation est portée par `ind_obtenu` dans risques_probabilites.
    const selectedPeriodeObj = findSelectedPeriodeFromForm(periodeCarto)
    const isPeriodeFermee = selectedPeriodeObj && selectedPeriodeObj.statut !== 'Ouvert'
    
    const base = risques.filter(r => {
      if (r.statut !== 'Actif') return false
      if (cartoFilters.categorie && !r.categories?.includes(parseInt(cartoFilters.categorie, 10))) return false
      if (cartoFilters.structure && r.code_structure !== cartoFilters.structure) return false
      if (cartoFilters.processus && r.code_processus !== cartoFilters.processus) return false
      if (cartoFilters.recherche) {
        const search = cartoFilters.recherche.toLowerCase()
        if (!r.code_risque?.toLowerCase().includes(search) &&
            !r.libelle_risque?.toLowerCase().includes(search) &&
            !r.processus?.libelle_processus?.toLowerCase().includes(search)) return false
      }
      
      // La cartographie ne s'affiche que pour une période sélectionnée
      if (!periodeKey) return false
      
      // Utiliser la fonction centralisée pour récupérer la probabilité
      const probData = getRisqueProbabilite(r, periodeKey)
      const isQualitatif = r.qualitatif === 'Oui' || !r.code_indicateur
      const hasStoredProba = probData.storedProba !== null && probData.storedProba !== undefined && probData.storedProba !== ''
      const hasCalculatedProba = probData.calculatedProba !== '' && probData.calculatedProba !== null && probData.calculatedProba !== undefined
      const hasProbRenseignee = probData.hasProb
      
      // Filtre obligatoire: exclure les risques sans probabilité renseignée (manuelle ou calculée) pour la période
      if (!hasProbRenseignee) return false
      
      // Filtre Type évaluation (si spécifié)
      if (cartoFilters.typeEvaluation) {
        if (isPeriodeFermee) {
          const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
          const hasRp = !!rpRow

          switch (cartoFilters.typeEvaluation) {
            case 'Eval. quali':
              if (!(hasRp && rpRow.ind_obtenu === 'Non')) return false
              break
            case 'Eval. quanti':
              if (!(hasRp && rpRow.ind_obtenu === 'Oui')) return false
              break
            case 'Eval. quali & quanti':
              if (!hasRp) return false
              break
            case 'Non évalué':
              if (hasRp) return false
              break
            default:
              break
          }
        } else {
          // Période ouverte : logique historique
          const indicOcc = indicateurOccurrences.find(io => io.code_indicateur === r.code_indicateur && samePeriodeKey(io.periode, periodeKey))
          const valInd = indicOcc?.val_indicateur
          const hasValInd = valInd !== null && valInd !== undefined && valInd !== ''

          const seuils = {
            seuil1: r.indicateur?.seuil1 || r.indicateur?.seuil_1,
            seuil2: r.indicateur?.seuil2 || r.indicateur?.seuil_2,
            seuil3: r.indicateur?.seuil3 || r.indicateur?.seuil_3
          }
          const calculatedProba = (hasValInd && seuils.seuil1 && seuils.seuil2 && seuils.seuil3)
            ? calculateProbabilite(valInd, seuils, r.indicateur?.sens)
            : ''
          const hasCalculatedProba = calculatedProba !== '' && calculatedProba !== null && calculatedProba !== undefined

          const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey))
          const storedProba = rpRow?.probabilite
          const hasStoredProba = storedProba !== null && storedProba !== undefined && storedProba !== ''

          const hasProba = hasCalculatedProba || hasStoredProba
          const isProbFromIndicator = hasCalculatedProba

          switch (cartoFilters.typeEvaluation) {
            case 'Eval. quali':
              if (!(hasProba && !isProbFromIndicator)) return false
              break
            case 'Eval. quanti':
              if (!isProbFromIndicator) return false
              break
            case 'Eval. quali & quanti':
              if (!hasProba) return false
              break
            default:
              break
          }
        }
      }
      
      // Filtre Criticité (si spécifié)
      if (cartoFilters.criticite) {
        const probDisplay = probData.probDisplay || ''
        if (probDisplay) {
          const useBrute = cartoFilters.typeCriticite === 'Brute'
          const impactBrut = r.impact
          const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
          const impact = useBrute ? impactBrut : impactNet
          const criticite = calculateCriticite(impact, parseInt(probDisplay, 10))
          const niveauObj = getNiveauCriticite(criticite)
          const niveauLabel = (niveauObj && typeof niveauObj === 'object') ? (niveauObj.label || '') : (niveauObj || '')
          const lbl = String(niveauLabel).toLowerCase()
          if (cartoFilters.criticite === 'faible' && !lbl.includes('faible')) return false
          if (cartoFilters.criticite === 'modere' && !lbl.includes('modéré') && !lbl.includes('modere')) return false
          if (cartoFilters.criticite === 'significatif' && !lbl.includes('significatif')) return false
          if (cartoFilters.criticite === 'critique' && !lbl.includes('critique')) return false
        }
      }
      
      return true
    })

    if (!isPeriodeFermee) return base
    return base.map(r => {
      const rpRow = risquesProbabilites.find(rp => rp.code_risque === r.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
      return {
        ...r,
        impact: rpRow?.impact ?? null,
        efficacite_contr: rpRow?.eff_ctrl ?? null,
        indic_obtenu: rpRow?.ind_obtenu ?? r.indic_obtenu,
        _rp: rpRow
      }
    })
  }

  // NOUVEAU SYSTÈME DE CARTOGRAPHIE P×I (Score 1-16)
  // Matrice de scores fixes de référence (P × I)
  // Ligne 0 = P=4 (Très fréquent), Ligne 3 = P=1 (Très rare)
  // Colonne 0 = I=1 (Mineur), Colonne 3 = I=4 (Critique)
  const scoreMatrix = [
    [4, 8, 12, 16],    // P=4: 4×1, 4×2, 4×3, 4×4
    [3, 6, 9, 12],     // P=3: 3×1, 3×2, 3×3, 3×4
    [2, 4, 6, 8],      // P=2: 2×1, 2×2, 2×3, 2×4
    [1, 2, 3, 4]       // P=1: 1×1, 1×2, 1×3, 1×4
  ]

  // Couleurs fixes selon le nouveau système de criticité (1-16)
  // Score 1-3: Faible (vert), 4-6: Modéré (jaune), 8-9: Significatif (orange), 12-16: Critique (rouge)
  const colorMatrix = [
    ['bg-yellow-400', 'bg-orange-500', 'bg-red-600', 'bg-red-600'],     // P=4: 4,8,12,16
    ['bg-green-500', 'bg-yellow-400', 'bg-orange-500', 'bg-red-600'],   // P=3: 3,6,9,12
    ['bg-green-500', 'bg-yellow-400', 'bg-yellow-400', 'bg-orange-500'],// P=2: 2,4,6,8
    ['bg-green-500', 'bg-green-500', 'bg-green-500', 'bg-yellow-400']   // P=1: 1,2,3,4
  ]

  const colorMatrixHex = [
    ['#facc15', '#f97316', '#dc2626', '#dc2626'],   // P=4
    ['#22c55e', '#facc15', '#f97316', '#dc2626'],   // P=3
    ['#22c55e', '#facc15', '#facc15', '#f97316'],   // P=2
    ['#22c55e', '#22c55e', '#22c55e', '#facc15']    // P=1
  ]

  // Calculer le score P×I d'un risque (avec type Brute ou Nette)
  const calculateRisqueScore = (risque, useBrute = false) => {
    const periodeKey = getPeriodeKeyCarto()
    const probData = getRisqueProbabilite(risque, periodeKey)
    const prob = parseInt(probData.probDisplay || risque.probabilite || 1, 10)

    const impactBrut = risque.impact
    const impactNet = calculateImpactNet(risque.impact, risque.efficacite_contr)
    const impact = useBrute ? impactBrut : impactNet

    return impact * (prob || 1)
  }

  // Trouver la cellule correspondant à un risque (basé sur Impact et Probabilité)
  const findCellForRisque = (risque, useBrute = false) => {
    const periodeKey = getPeriodeKeyCarto()
    
    // Utiliser la fonction centralisée pour récupérer la probabilité
    const probData = getRisqueProbabilite(risque, periodeKey)
    const prob = parseInt(probData.probDisplay || risque.probabilite || 1)
    
    const impactBrut = risque.impact
    const impactNet = calculateImpactNet(risque.impact, risque.efficacite_contr)
    const impact = useBrute ? impactBrut : impactNet
    
    // row: P=4 -> row 0, P=1 -> row 3
    const row = 4 - prob
    // col: I=1 -> col 0, I=4 -> col 3
    const col = impact - 1
    
    return { row: Math.max(0, Math.min(3, row)), col: Math.max(0, Math.min(3, col)) }
  }

  // Obtenir les risques pour une cellule spécifique
  const getRisquesForCell = (row, col) => {
    const filtered = getFilteredCartoRisques()
    const useBrute = cartoFilters.typeCriticite === 'Brute'
    return filtered.filter(r => {
      const cell = findCellForRisque(r, useBrute)
      return cell.row === row && cell.col === col
    })
  }

  // Labels pour les axes
  const impactLabels = ['Mineur', 'Significatif', 'Majeur', 'Critique']
  const probabiliteLabels = ['Très rare', 'Rare', 'Fréquent', 'Très fréquent']

  // Générer le contenu HTML pour l'export PDF/Word en mode paysage

  // Export PDF/Word (Cartographie) :
  // - Les codes peuvent se répartir sur PLUSIEURS LIGNES (comme sur la page Cartographie)
  //   en fonction de la place disponible dans le cadre.
  // - Un même code ne doit JAMAIS être coupé sur deux lignes.
  // - Ne jamais masquer / remplacer par "..."
  // - Le zoom est géré par la taille de police (codeFontPx) exactement comme sur la plateforme
  const buildCodesHtmlForExport = (risquesList, codeFontPx) => {
    if (!Array.isArray(risquesList) || risquesList.length === 0) return ''
    const codes = risquesList
      .map(r => r?.code_risque ?? r?.code ?? r)
      .filter(Boolean)
      .map(c => String(c))

    // Badges (pill) : chaque code reste sur UNE seule ligne (nowrap),
    // mais l'ensemble des codes peut s'enrouler sur plusieurs lignes via le container (flex-wrap).
    // Espacement réduit (≈ moitié) :
    // - pas d'espace ajoutée via join(' ')
    // - marges réduites sur chaque badge
    // IMPORTANT (Export PDF/Word):
    // Certains moteurs HTML->PDF/Word (print, docx, etc.) alignent le texte en haut
    // des badges lorsque la taille de police est très petite (dézoom). Pour garantir
    // un centrage vertical/horizontal identique à l'UI, on force un badge en inline-flex
    // avec align-items/justify-content et une hauteur minimale.
    const badgeHeight = Math.max(8, codeFontPx + 6)

    return codes
      .map(code => `<span style="display:inline-flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.30);padding:0 4px;border-radius:3px;margin:1px 1px;font-size:${codeFontPx}px;white-space:nowrap;line-height:1;height:${badgeHeight}px;min-height:${badgeHeight}px;vertical-align:middle;">${code}</span>`)
      .join('')
  }


  // Structure: Matrice 4×4 avec scores fixes de référence
  const generateExportHTML = () => {
    const filteredData = getFilteredCartoRisques()
    const periodeStr = `${periodeCarto.annee || 'Toutes années'} ${periodeCarto.semestre || periodeCarto.trimestre || periodeCarto.mois || ''}`.trim()
    
    // Construire la matrice 4x4 avec scores fixes - border-spacing pour espaces entre cellules
    // Export: réduire légèrement les espacements pour garantir que l'entête + cartographie + légende
    // tiennent sur UNE seule page paysage.
    let cartoHTML = '<table style="width:100%;border-collapse:separate;border-spacing:4px;margin-bottom:10px;table-layout:fixed;">'
    
    // En-tête avec labels Impact
    cartoHTML += '<tr><td style="width:80px;"></td>'
    impactLabels.forEach(label => {
      cartoHTML += `<td style="text-align:center;font-weight:bold;padding:8px;font-size:11px;background:#e5e7eb;border-radius:6px;">${label}</td>`
    })
    cartoHTML += '</tr>'
    
    // Lignes de la matrice (row 0 = P=4, row 3 = P=1)
    for (let row = 0; row < 4; row++) {
      const probLabel = probabiliteLabels[3 - row] // Inverser pour affichage (haut = Très fréquent)
      cartoHTML += `<tr><td style="text-align:right;font-weight:bold;padding:8px;font-size:10px;background:#e5e7eb;vertical-align:middle;border-radius:6px;">${probLabel}</td>`
      
      // Colonnes (col 0 = I=1, col 3 = I=4)
      for (let col = 0; col < 4; col++) {
        const cellScore = scoreMatrix[row][col]
        const bgColor = colorMatrixHex[row][col]
        const cellRisques = getRisquesForCell(row, col)
        
        // Générer les codes avec fond individuel
        // Maintenir le niveau de zoom (taille des codes) tel qu'affiché dans la plateforme
        const codeFontPx = Math.max(3, Math.min(10, Number(cartoFontSize) || 5))
        // IMPORTANT (Export PDF/Word):
        // - Conserver EXACTEMENT le niveau de zoom (taille des codes) choisi sur la plateforme.
        // - Ne pas masquer des codes (pas de "...") sur les exports PDF/Word.
        //   Si une cellule contient beaucoup de risques, elle doit afficher tous les codes (au besoin en multi-lignes),
        //   même si cela augmente la hauteur de la cellule à l'impression.
        // Dimensions fixes (export) : les cadres gardent exactement la même largeur/hauteur quel que soit le zoom.
        // Le zoom agit uniquement sur la taille des codes (comme sur la plateforme).
        // Hauteur des cadres réduite pour tenir sur 1 page (paysage) avec entête + légende.
        // Ajustement fin (export): on augmente légèrement la hauteur des cadres pour
        // remplir pleinement la page (entête + cartographie + légende sur 1 page).
        const cellHeightPx = 98
        const headerHeightPx = 22 // zone en haut réservée aux badges (P×I + compteur)
        const cellInnerHeightPx = cellHeightPx - headerHeightPx
        const codesHtml = buildCodesHtmlForExport(cellRisques, codeFontPx)

        // Cadre export: dimensions fixes, le zoom agit uniquement sur la taille des codes.
        // IMPORTANT:
        // - aucun code ne doit être masqué (pas de "...")
        // - les codes peuvent se répartir sur plusieurs lignes (wrap) si nécessaire,
        //   mais un même code ne doit jamais être coupé sur deux lignes.
        // Les badges (P×I et compteur) doivent TOUJOURS rester en haut du cadre, même si le cadre est vide.
        cartoHTML += `<td style="background-color:${bgColor};padding:6px;vertical-align:top;height:${cellHeightPx}px;max-height:${cellHeightPx}px;overflow:hidden;border-radius:10px;">`
        cartoHTML += `<div style="position:relative;height:${cellHeightPx}px;">`
        cartoHTML += `<div style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;">`
        cartoHTML += `<div style="font-size:9px;font-weight:bold;color:white;background:rgba(0,0,0,0.25);padding:2px 6px;display:inline-block;border-radius:4px;">P×I = ${cellScore}</div>`
        cartoHTML += `<div style="font-size:9px;color:white;background:rgba(0,0,0,0.25);padding:2px 6px;border-radius:4px;visibility:${cellRisques.length > 0 ? 'visible' : 'hidden'};">${cellRisques.length}</div>`
        cartoHTML += `</div>`
        // Contenu centré (milieu) : on autorise le wrap ENTRE les codes.
        // Chaque badge code est en white-space:nowrap, donc un code n'est jamais coupé.
        // Espacement entre badges réduit (≈ moitié)
        cartoHTML += `<div style="position:absolute;top:${headerHeightPx}px;left:0;right:0;bottom:0;color:white;display:flex;flex-wrap:wrap;align-items:center;align-content:center;justify-content:center;gap:1px;text-align:center;overflow:hidden;line-height:1.25;">${codesHtml}</div>`
        cartoHTML += `</div>`
        cartoHTML += '</td>'
      }
      cartoHTML += '</tr>'
    }
    cartoHTML += '</table>'
    
    // Construire le tableau des risques (sans Eff.Ctrl)
    const useBrute = cartoFilters.typeCriticite === 'Brute'
    const showComparison = shouldShowComparaisonColumns()
    const periodeKeyCompar = getPeriodeKeyComparaison()
    
    let tableHTML = '<table style="width:100%;border-collapse:collapse;font-size:9px;">'
    tableHTML += '<thead><tr style="background:linear-gradient(to right, #1a365d, #2c5282);color:white;">'
    tableHTML += '<th style="padding:8px;border:1px solid #ccc;text-align:left;">Code Proc.</th>'
    tableHTML += '<th style="padding:8px;border:1px solid #ccc;text-align:left;">Libellé Processus</th>'
    tableHTML += '<th style="padding:8px;border:1px solid #ccc;text-align:left;">Code Risque</th>'
    tableHTML += '<th style="padding:8px;border:1px solid #ccc;text-align:left;">Libellé Risque</th>'
    tableHTML += '<th style="padding:8px;border:1px solid #ccc;text-align:center;width:60px;">Impact</th>'
    tableHTML += '<th style="padding:8px;border:1px solid #ccc;text-align:center;width:60px;">Prob.</th>'
    tableHTML += `<th style="padding:8px;border:1px solid #ccc;text-align:center;width:80px;background:#7c3aed;">Crit. ${getPeriodeKeyCarto() || ''}</th>`
    
    // Ajouter les colonnes de comparaison si nécessaire
    if (showComparison) {
      tableHTML += `<th style="padding:8px;border:1px solid #ccc;text-align:center;width:80px;background:#7c3aed;">Crit. ${periodeKeyCompar}</th>`
      tableHTML += '<th style="padding:8px;border:1px solid #ccc;text-align:center;width:80px;background:#7c3aed;">Taux att.</th>'
    }
    tableHTML += '</tr></thead><tbody>'
    
    filteredData.forEach((r, idx) => {
      const periodeKey = getPeriodeKeyCarto()
      const probData = getRisqueProbabilite(r, periodeKey)
      const prob = parseInt(probData.probDisplay || 1)
      
      const impactDisplay = useBrute ? r.impact : calculateImpactNet(r.impact, r.efficacite_contr)
      const criticiteActuelle = impactDisplay * prob
      const niveauActuel = getNiveauCriticiteNum(criticiteActuelle)
      const bgScoreColor = niveauActuel === 1 ? '#22c55e' : niveauActuel === 2 ? '#facc15' : niveauActuel === 3 ? '#f97316' : '#dc2626'
      const bgRow = idx % 2 === 0 ? '#ffffff' : '#f9fafb'
      
      // Calcul comparaison si nécessaire
      let niveauComparaison = null
      let tauxAttenuation = null
      
      if (showComparison && periodeKeyCompar) {
        const probDataCompar = getRisqueProbabilite(r, periodeKeyCompar)
        const probCompar = probDataCompar.probDisplay
        
        if (probCompar) {
          const criticiteComparaison = impactDisplay * parseInt(probCompar)
          niveauComparaison = getNiveauCriticiteNum(criticiteComparaison)
          // Utiliser les niveaux de criticité (1-4) pour le taux d'atténuation
          tauxAttenuation = calculateTauxAttenuation(niveauComparaison, niveauActuel)
        }
      }
      
      tableHTML += `<tr style="background:${bgRow};">`
      tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;">${r.code_processus}</td>`
      tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;">${r.processus?.libelle_processus || '-'}</td>`
      tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold;color:#2563eb;">${r.code_risque}</td>`
      tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;">${r.libelle_risque}</td>`
      tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;">${impactDisplay}</td>`
      tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;">${prob}</td>`
      tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;background:${bgScoreColor};color:white;font-weight:bold;font-size:11px;">${niveauActuel}</td>`
      
      // Colonnes de comparaison
      if (showComparison) {
        if (niveauComparaison) {
          const bgComparColor = niveauComparaison === 1 ? '#22c55e' : niveauComparaison === 2 ? '#facc15' : niveauComparaison === 3 ? '#f97316' : '#dc2626'
          tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;background:${bgComparColor};color:white;font-weight:bold;">${niveauComparaison}</td>`
          
          // Afficher le taux avec flèche et couleur
          if (tauxAttenuation !== null) {
            const tauxArrowInfo = getTauxAttenuationArrow(niveauComparaison, niveauActuel)
            const arrowSymbol = tauxArrowInfo?.direction === 'up' ? '↑' : tauxArrowInfo?.direction === 'down' ? '↓' : '→'
            const arrowColor = tauxArrowInfo?.color === 'green' ? '#22c55e' : tauxArrowInfo?.color === 'yellow' ? '#eab308' : tauxArrowInfo?.color === 'orange' ? '#f97316' : '#dc2626'
            const bgTaux = tauxArrowInfo?.color === 'green' ? '#dcfce7' : tauxArrowInfo?.color === 'yellow' ? '#fef9c3' : tauxArrowInfo?.color === 'orange' ? '#ffedd5' : '#fee2e2'
            tableHTML += `<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;background:${bgTaux};"><span style="color:${arrowColor};font-weight:bold;font-size:14px;">${arrowSymbol}</span> <span style="font-weight:bold;">${tauxAttenuation}%</span></td>`
          } else {
            tableHTML += '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;">-</td>'
          }
        } else {
          tableHTML += '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;">-</td>'
          tableHTML += '<td style="padding:6px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;">-</td>'
        }
      }
      
      tableHTML += '</tr>'
    })
    tableHTML += '</tbody></table>'
    
    // Légende de base (niveaux de criticité)
    const legendeHTML = `
      <div style="margin:15px 0;display:flex;gap:25px;font-size:11px;justify-content:center;align-items:center;">
        <strong>Légende Criticité (Score P×I) - ${cartoFilters.typeCriticite}:</strong>
        <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:18px;height:18px;background:#22c55e;border-radius:3px;"></span>1 - Faible (1-3)</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:18px;height:18px;background:#facc15;border-radius:3px;"></span>2 - Modéré (4-6)</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:18px;height:18px;background:#f97316;border-radius:3px;"></span>3 - Significatif (8-9)</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:18px;height:18px;background:#dc2626;border-radius:3px;"></span>4 - Critique (12-16)</span>
      </div>
    `
    
    // Légende des 16 cas de taux d'atténuation (si colonnes de comparaison actives)
    const legendeTauxHTML = showComparison ? `
      <div style="margin:20px 0;padding:15px;border:1px solid #e5e7eb;border-radius:10px;background:#ffffff;">
        <h4 style="margin:0 0 10px 0;color:#374151;font-size:13px;display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:8px;height:8px;background:#7c3aed;border-radius:50%;"></span>
          Légende - Taux d'atténuation (comparaison ${periodeKeyCompar} → ${getPeriodeKeyCarto()})
        </h4>
        <p style="font-size:10px;color:#6b7280;margin-bottom:15px;">
          Le taux d'atténuation mesure l'évolution du niveau de criticité entre la période de référence et la période actuelle.
          <strong style="color:#22c55e;"> ↓ = Amélioration</strong>, 
          <strong style="color:#6b7280;"> → = Stable</strong>, 
          <strong style="color:#dc2626;"> ↑ = Dégradation</strong>
        </p>
        <div style="display:flex;gap:15px;">
          <!-- Colonne Améliorations -->
          <div style="flex:1;background:#f0fdf4;padding:12px;border-radius:8px;border:1px solid #bbf7d0;">
            <p style="font-weight:bold;color:#166534;margin:0 0 10px 0;font-size:11px;">☑️ Améliorations et situations stables</p>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#dcfce7;color:#22c55e;">→ 100%</span>
                <span style="font-size:9px;"><strong>1→1</strong> : Criticité faible maintenue</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#dcfce7;color:#22c55e;">↓ 100%</span>
                <span style="font-size:9px;"><strong>2→1, 3→1, 4→1</strong> : Retour à criticité faible</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#fef9c3;color:#ca8a04;">↓ 75%</span>
                <span style="font-size:9px;"><strong>4→2</strong> : De critique à modéré</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#fef9c3;color:#ca8a04;">↓ 50%</span>
                <span style="font-size:9px;"><strong>3→2, 4→3</strong> : Amélioration d'un niveau</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#fef9c3;color:#ca8a04;">→ 0%</span>
                <span style="font-size:9px;"><strong>2→2</strong> : Criticité modérée stable</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#ffedd5;color:#ea580c;">→ 0%</span>
                <span style="font-size:9px;"><strong>3→3</strong> : Criticité significative stable</span>
              </div>
            </div>
          </div>
          <!-- Colonne Dégradations -->
          <div style="flex:1;background:#fef2f2;padding:12px;border-radius:8px;border:1px solid #fecaca;">
            <p style="font-weight:bold;color:#991b1b;margin:0 0 10px 0;font-size:11px;">⚠️ Dégradations</p>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#fef9c3;color:#ca8a04;">↑ -50%</span>
                <span style="font-size:9px;"><strong>1→2, 2→3</strong> : Dégradation d'un niveau</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#ffedd5;color:#ea580c;">↑ -75%</span>
                <span style="font-size:9px;"><strong>1→3</strong> : De faible à significatif</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#fee2e2;color:#dc2626;">↑ -100%</span>
                <span style="font-size:9px;"><strong>1→4, 2→4, 3→4</strong> : Passage en criticité critique</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;background:white;padding:6px 8px;border-radius:4px;border:1px solid #e5e7eb;">
                <span style="display:inline-flex;align-items:center;gap:2px;min-width:50px;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;background:#fee2e2;color:#dc2626;">→ -100%</span>
                <span style="font-size:9px;"><strong>4→4</strong> : Criticité critique maintenue</span>
              </div>
            </div>
            <div style="margin-top:12px;padding:8px;background:white;border-radius:4px;border:1px solid #e5e7eb;">
              <p style="font-size:9px;color:#6b7280;margin:0 0 4px 0;font-weight:bold;">Niveaux de criticité :</p>
              <div style="display:flex;align-items:center;gap:8px;font-size:9px;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:#22c55e;color:white;font-weight:bold;font-size:8px;">1</span>=Faible
                <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:#facc15;color:white;font-weight:bold;font-size:8px;">2</span>=Modéré
                <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:#f97316;color:white;font-weight:bold;font-size:8px;">3</span>=Significatif
                <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:#dc2626;color:white;font-weight:bold;font-size:8px;">4</span>=Critique
              </div>
            </div>
          </div>
        </div>
      </div>
    ` : ''
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cartographie des Risques - ${periodeStr}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          @media print { 
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
          body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 10px; }
        </style>
      </head>
      <body>
        <div style="text-align:center;margin-bottom:15px;border-bottom:3px solid #1a365d;padding-bottom:10px;">
          <h1 style="font-size:20px;color:#1a365d;margin:0 0 5px 0;">CARTOGRAPHIE DES RISQUES</h1>
          <h2 style="font-size:14px;color:#4b5563;margin:0;font-weight:normal;">Période: <strong>${periodeStr}</strong></h2>
          <p style="font-size:9px;color:#6b7280;margin:5px 0 0 0;">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} | Score = Impact × Probabilité (Type: ${cartoFilters.typeCriticite})</p>
        </div>
        <!-- Page 1 : entête + cartographie + légende sur UNE SEULE PAGE paysage -->
        <div style="break-inside:avoid;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;margin-bottom:10px;">
          <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-weight:bold;font-size:12px;margin-right:8px;color:#1a365d;">Fréquence (P)</div>
          <div style="flex:1;">
            ${cartoHTML}
            <div style="text-align:center;font-weight:bold;font-size:12px;margin-top:5px;color:#1a365d;">Impact (I)</div>
          </div>
        </div>
        
        ${legendeHTML}
        </div>
        
        <!-- Page 2 : tableau récapitulatif -->
        <h3 style="page-break-before:always;break-before:page;font-size:13px;color:#1a365d;margin:15px 0 8px 0;border-bottom:2px solid #1a365d;padding-bottom:5px;">
          Tableau Récapitulatif - ${filteredData.length} risque(s)
        </h3>
        ${tableHTML}
        
        ${legendeTauxHTML}
        
        <div style="margin-top:15px;font-size:8px;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;padding-top:8px;">
          GIRAS - Gestion Intégrée des Risques et Activités de Soins | CNAM Côte d'Ivoire
        </div>
      </body>
      </html>
    `
  }

  // Exporter en PDF (ouvre dans une nouvelle fenêtre pour impression)
  const handleExportPDF = () => {
    const filteredData = getFilteredCartoRisques()
    if (filteredData.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    const htmlContent = generateExportHTML()
    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // Attendre le chargement puis ouvrir la boîte de dialogue d'impression
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  // Exporter en Word (télécharge un fichier .doc)
  const handleExportWord = () => {
    const filteredData = getFilteredCartoRisques()
    if (filteredData.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    const htmlContent = generateExportHTML()
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const periodeStr = `${periodeCarto.annee || 'all'}_${periodeCarto.semestre || periodeCarto.trimestre || periodeCarto.mois || ''}`
    a.download = `Cartographie_Risques_${periodeStr}_${Date.now()}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Période fermée : télécharger la cartographie signée chargée lors de la fermeture
  const handleDownloadSignedCartography = async () => {
    // IMPORTANT : ce handler est défini dans le scope global du composant (pas dans le bloc Cartographie).
    // Il ne doit donc pas dépendre d'une variable locale comme selectedPeriodeCarto.
    // On recalcule la période sélectionnée à partir de l'état courant (allPeriodes + periodeCarto).
    const selectedPeriodeCartoLocal = (() => {
      if (!periodeCarto?.annee) return null
      return allPeriodes.find(p => {
        if (p.annee?.toString() !== periodeCarto.annee) return false
        if (periodeCarto.mois) {
          const moisNum = moisList.indexOf(periodeCarto.mois) + 1
          return p.mois === moisNum
        }
        if (periodeCarto.trimestre) {
          const tNum = parseInt(periodeCarto.trimestre.replace('Trimestre ', ''))
          return p.trimestre === tNum
        }
        if (periodeCarto.semestre) {
          const sNum = parseInt(periodeCarto.semestre.replace('Semestre ', ''))
          return p.semestre === sNum
        }
        return !p.mois && !p.trimestre && !p.semestre
      })
    })()

    if (!selectedPeriodeCartoLocal || selectedPeriodeCartoLocal.statut === 'Ouvert') {
      showAlert('warning', 'Sélectionnez une période fermée')
      return
    }

    // Recharger à la demande : évite les cas où le fichier n'a pas encore été chargé,
    // ou bien où l'état contient un fichier d'une autre période.
    let fileObj = cartographieFile
    try {
      const needFetch = !fileObj || String(fileObj.code_periode || '') !== String(selectedPeriodeCartoLocal.id)
      if (needFetch) {
        const qs = new URLSearchParams()
        qs.set('code_periode', String(selectedPeriodeCartoLocal.id))
        const res = await fetch(`/api/cartographie/fichier?${qs.toString()}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          showAlert('error', err.error || 'Erreur lors du chargement du fichier signé')
          return
        }
        const data = await res.json().catch(() => ({}))
        fileObj = data.file || null
        setCartographieFile(fileObj)
      }
    } catch (e) {
      console.error('Erreur chargement fichier cartographie (download):', e)
      showAlert('error', 'Impossible de charger le fichier signé')
      return
    }

    const raw = fileObj?.url_fichier || fileObj?.fichier || fileObj?.contenu || fileObj?.data || null
    if (!raw) {
      showAlert('warning', 'Aucun fichier de cartographie signé n\'est disponible pour cette période')
      return
    }

    // Si c'est une URL http(s), on ouvre directement
    if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) {
      window.open(raw, '_blank', 'noopener,noreferrer')
      return
    }

    // Sinon, on suppose un data URL ou un base64
    try {
      const dataUrl = raw.startsWith('data:') ? raw : `data:application/pdf;base64,${raw}`
      const [meta, b64] = dataUrl.split(',')
      const mimeMatch = meta.match(/data:([^;]+);base64/i)
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf'

      const byteChars = atob(b64)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
      const byteArray = new Uint8Array(byteNumbers)

      const blob = new Blob([byteArray], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const periodeKey = getPeriodeKeyCarto() || 'periode'
      a.href = url
      a.download = `Cartographie_Signee_${periodeKey}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Erreur téléchargement cartographie signée:', e)
      showAlert('error', 'Impossible de télécharger le fichier signé')
    }
  }

  // Télécharger la cartographie en image PNG
  const handleExportImage = async () => {
    const filteredData = getFilteredCartoRisques()
    if (filteredData.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    // Trouver l'élément de la cartographie à capturer
    const cartoContainer = document.getElementById('cartoContainer')
    if (!cartoContainer) {
      showAlert('error', 'Impossible de trouver la cartographie')
      return
    }
    
    try {
      // Importer html2canvas dynamiquement
      const html2canvas = (await import('html2canvas')).default
      
      // Capturer l'élément en canvas
      const canvas = await html2canvas(cartoContainer, {
        backgroundColor: '#ffffff',
        scale: 2, // Meilleure qualité
        useCORS: true,
        logging: false,
        windowWidth: cartoContainer.scrollWidth,
        windowHeight: cartoContainer.scrollHeight
      })
      
      // Convertir en image et télécharger
      const link = document.createElement('a')
      link.download = `Cartographie_Risques_${getPeriodeKeyCarto() || 'all'}_${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Erreur export image:', error)
      // Fallback: ouvrir une fenêtre avec l'HTML pour capture manuelle
      const htmlContent = generateExportHTML()
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cartographie des Risques - ${getPeriodeKeyCarto() || 'Toutes périodes'}</title>
          <style>
            body { margin: 0; padding: 30px; font-family: Arial, sans-serif; background: white; }
            .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; }
            h2 { text-align: center; color: #1a365d; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
            .instructions { text-align: center; color: #059669; font-size: 11px; margin-top: 20px; padding: 10px; background: #ecfdf5; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Cartographie des Risques</h2>
            <p class="subtitle">Période: ${getPeriodeKeyCarto() || 'Toutes périodes'} • Type criticité: ${cartoFilters.typeCriticite} • Exporté le ${new Date().toLocaleDateString('fr-FR')}</p>
            ${htmlContent}
            <p class="instructions">💡 Pour sauvegarder: Win + Shift + S (Windows) ou Cmd + Shift + 4 (Mac)</p>
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  // Filtrer le tableau selon la cellule sélectionnée (row, col)
  const getTableRisques = () => {
    let filtered = getFilteredCartoRisques()
    const useBrute = cartoFilters.typeCriticite === 'Brute'
    if (selectedCartoCell) {
      filtered = filtered.filter(r => {
        const cell = findCellForRisque(r, useBrute)
        return cell.row === selectedCartoCell.row && cell.col === selectedCartoCell.col
      })
    }
    return filtered
  }

  const renderCartographie = () => {
    const tableRisques = getTableRisques()
    
    // Obtenir les années disponibles (uniquement celles avec des périodes ouvertes/fermées)
    const availableYearsCarto = [...new Set(allPeriodes.map(p => p.annee))].sort((a, b) => b - a)
    
    // Obtenir les semestres disponibles pour l'année sélectionnée
    const availableSemestresCarto = allPeriodes
      .filter(p => p.annee?.toString() === periodeCarto.annee && p.semestre)
      .map(p => p.semestre)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
    
    // Obtenir les trimestres disponibles pour l'année sélectionnée
    const availableTrimestresCarto = allPeriodes
      .filter(p => p.annee?.toString() === periodeCarto.annee && p.trimestre)
      .map(p => p.trimestre)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
    
    // Obtenir les mois disponibles pour l'année sélectionnée
    const availableMoisCarto = allPeriodes
      .filter(p => p.annee?.toString() === periodeCarto.annee && p.mois)
      .map(p => p.mois)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b)
    
    // Trouver la période sélectionnée
    const getSelectedPeriodeCarto = () => {
      if (!periodeCarto.annee) return null
      return allPeriodes.find(p => {
        if (p.annee?.toString() !== periodeCarto.annee) return false
        if (periodeCarto.mois) {
          const moisNum = moisList.indexOf(periodeCarto.mois) + 1
          return p.mois === moisNum
        }
        if (periodeCarto.trimestre) {
          const tNum = parseInt(periodeCarto.trimestre.replace('Trimestre ', ''))
          return p.trimestre === tNum
        }
        if (periodeCarto.semestre) {
          const sNum = parseInt(periodeCarto.semestre.replace('Semestre ', ''))
          return p.semestre === sNum
        }
        return !p.mois && !p.trimestre && !p.semestre
      })
    }
    const selectedPeriodeCarto = getSelectedPeriodeCarto()
    
    return (
      <div className="space-y-4" id="cartographie-content">
        {/* Cadre 1: Filtres sur les risques - identique à Évaluation */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2 overflow-x-auto">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Catégorie"
                size="sm"
                value={cartoFilters.categorie || ''}
                onChange={(v) => { setCartoFilters({ ...cartoFilters, categorie: v }); setSelectedCartoCell(null); }}
                options={[
                  { value: '', label: 'Toutes' },
                  ...categories.filter(c => c.statut === 'Actif').map(c => ({
                    value: c.code_categorie?.toString() || c.id?.toString(),
                    label: c.libelle_categorie
                  }))
                ]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Structure"
                size="sm"
                value={cartoFilters.structure || ''}
                onChange={(v) => { setCartoFilters({ ...cartoFilters, structure: v }); setSelectedCartoCell(null); }}
                options={[
                  { value: '', label: 'Toutes' },
                  ...structures.map(s => ({
                    value: s.code_structure,
                    label: s.libelle_structure
                  }))
                ]}
                placeholder="Toutes"
              />
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect
                label="Processus"
                size="sm"
                value={cartoFilters.processus || ''}
                onChange={(v) => { setCartoFilters({ ...cartoFilters, processus: v }); setSelectedCartoCell(null); }}
                options={[
                  { value: '', label: 'Tous' },
                  ...processus.filter(p => p.statut === 'Actif').map(p => ({
                    value: p.code_processus,
                    label: p.libelle_processus
                  }))
                ]}
                placeholder="Tous"
              />
            </div>

            <div className="w-[140px] flex-shrink-0">
              <SearchableSelect
                label="Type évaluation"
                size="sm"
                value={cartoFilters.typeEvaluation || ''}
                onChange={(v) => { setCartoFilters({ ...cartoFilters, typeEvaluation: v }); setSelectedCartoCell(null); }}
                options={[
                  { value: '', label: 'Tous' },
                  { value: 'Eval. quali', label: 'Eval. quali' },
                  { value: 'Eval. quanti', label: 'Eval. quanti' },
                  { value: 'Eval. quali & quanti', label: 'Eval. quali & quanti' }
                ]}
                placeholder="Tous"
              />
            </div>

            <div className="w-[120px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Criticité</label>
              <select value={cartoFilters.criticite || ''} onChange={(e) => { setCartoFilters({ ...cartoFilters, criticite: e.target.value }); setSelectedCartoCell(null); }} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="">Toutes</option>
                <option value="faible">Faible</option>
                <option value="modere">Modéré</option>
                <option value="significatif">Significatif</option>
                <option value="critique">Critique</option>
              </select>
            </div>
            <div className="w-[90px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Type crit.</label>
              <select value={cartoFilters.typeCriticite} onChange={(e) => { setCartoFilters({ ...cartoFilters, typeCriticite: e.target.value }); setSelectedCartoCell(null); }} className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-purple-50">
                <option value="Brute">Brute</option>
                <option value="Nette">Nette</option>
              </select>
            </div>
            <div className="flex-1 min-w-[80px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Recherche</label>
              <input type="text" value={cartoFilters.recherche || ''} onChange={(e) => { setCartoFilters({ ...cartoFilters, recherche: e.target.value }); setSelectedCartoCell(null); }} placeholder="Code, libellé..." className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
            </div>
            <button onClick={() => { setCartoFilters({ categorie: '', structure: '', typeEvaluation: '', processus: '', criticite: '', typeCriticite: 'Nette', recherche: '' }); setSelectedCartoCell(null); }} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser les filtres">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Cadre 2: Filtres sur la période - identique à Évaluation */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[90px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Année <span className="text-red-500">*</span></label>
              <select value={periodeCarto.annee} onChange={(e) => setPeriodeCarto({ annee: e.target.value, semestre: '', trimestre: '', mois: '' })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="">--</option>
                {availableYearsCarto.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Semestre</label>
              <select value={periodeCarto.semestre} onChange={(e) => setPeriodeCarto({ ...periodeCarto, semestre: e.target.value, trimestre: '', mois: '' })} disabled={!periodeCarto.annee || availableSemestresCarto.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableSemestresCarto.map(s => <option key={s} value={`Semestre ${s}`}>Semestre {s}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Trimestre</label>
              <select value={periodeCarto.trimestre} onChange={(e) => setPeriodeCarto({ ...periodeCarto, trimestre: e.target.value, semestre: '', mois: '' })} disabled={!periodeCarto.annee || availableTrimestresCarto.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableTrimestresCarto.map(t => <option key={t} value={`Trimestre ${t}`}>Trimestre {t}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Mois</label>
              <select value={periodeCarto.mois} onChange={(e) => setPeriodeCarto({ ...periodeCarto, mois: e.target.value, semestre: '', trimestre: '' })} disabled={!periodeCarto.annee || availableMoisCarto.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableMoisCarto.map(m => <option key={m} value={moisList[m - 1]}>{moisList[m - 1]}</option>)}
              </select>
            </div>
            {selectedPeriodeCarto && (
              <div className={`text-[10px] px-2 py-1 rounded ${selectedPeriodeCarto.statut === 'Ouvert' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>
                <span className="font-medium">Période {selectedPeriodeCarto.statut === 'Ouvert' ? '🟢 Ouverte' : '🔴 Fermée'}</span>
                {selectedPeriodeCarto.date_limite_saisie && (
                  <span className="ml-2">| Date limite: <strong>{new Date(selectedPeriodeCarto.date_limite_saisie).toLocaleDateString('fr-FR')}</strong></span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Boutons d'export PDF et Word */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={FileSpreadsheet} size="sm" onClick={handleExportWord}>Export Word</Button>
          <Button variant="primary" icon={Download} size="sm" onClick={handleExportPDF}>Export PDF</Button>

          {/* Période fermée : permettre le téléchargement de la cartographie signée chargée à la fermeture */}
          {selectedPeriodeCarto && selectedPeriodeCarto.statut !== 'Ouvert' && (
            <Button
              variant="secondary"
              icon={Download}
              size="sm"
              onClick={handleDownloadSignedCartography}
              title="Télécharger le fichier signé chargé lors de la fermeture de période"
            >
              Télécharger cartographie signée
            </Button>
          )}
          
          {/* Contrôle de la taille des codes */}
          <div className="flex items-center gap-1 border border-gray-300 rounded px-1.5 py-0.5">
            <button 
              onClick={() => setCartoFontSize(Math.max(3, cartoFontSize - 1))} 
              className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"
              disabled={cartoFontSize <= 3}
              title="Réduire la taille"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] text-gray-500 w-8 text-center">{cartoFontSize}px</span>
            <button 
              onClick={() => setCartoFontSize(Math.min(10, cartoFontSize + 1))} 
              className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"
              disabled={cartoFontSize >= 10}
              title="Agrandir la taille"
            >
              <ZoomIn size={14} />
            </button>
          </div>
          
          <button 
            onClick={() => setCartoFullscreen(true)} 
            className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 flex-shrink-0" 
            title="Afficher en plein écran"
          >
            <Maximize2 size={16} />
          </button>
          <span className="ml-auto text-xs text-gray-500">
            {selectedCartoCell ? (
              <span className="text-blue-600">
                Filtre actif: Cellule score={scoreMatrix[selectedCartoCell.row][selectedCartoCell.col]}
                <button onClick={() => setSelectedCartoCell(null)} className="ml-2 text-red-500 hover:text-red-700">(Effacer)</button>
              </span>
            ) : (
              `Total: ${getFilteredCartoRisques().length} risque(s)`
            )}
          </span>
        </div>

        {/* CARTOGRAPHIE - Matrice 4x4 avec scores fixes de référence */}
        <div id="cartoContainer" className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex">
            {/* Axe Y - Fréquence/Probabilité */}
            <div className="flex flex-col items-center justify-center mr-2" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              <span className="text-sm font-bold text-gray-700">Fréquence (P)</span>
            </div>
            
            <div className="flex-1">
              {/* Labels Y à gauche */}
              <div className="flex">
                <div className="w-24 flex flex-col justify-around pr-2">
                  {[...probabiliteLabels].reverse().map((label, idx) => (
                    <div key={idx} className="h-32 flex items-center justify-end">
                      <span className="text-[10px] text-gray-600 font-medium text-right">{label}</span>
                    </div>
                  ))}
                </div>
                
                {/* Grille 4x4 avec scores fixes */}
                <div className="flex-1">
                  <div className="grid grid-cols-4 gap-1.5">
                    {/* Lignes de la cartographie (row 0 = P=4 en haut) */}
                    {[0, 1, 2, 3].map(row => (
                      [0, 1, 2, 3].map(col => {
                        const cellScore = scoreMatrix[row][col]
                        const bgColor = colorMatrix[row][col]
                        const cellRisques = getRisquesForCell(row, col)
                        const isSelected = selectedCartoCell?.row === row && selectedCartoCell?.col === col
                        
                        return (
                          <div 
                            key={`${row}-${col}`}
                            onClick={() => setSelectedCartoCell(isSelected ? null : { row, col })}
                            className={`h-32 rounded-xl p-1.5 cursor-pointer transition-all shadow-sm ${bgColor} 
                              ${isSelected ? 'ring-4 ring-blue-600 ring-offset-2 scale-105' : 'hover:opacity-90 hover:shadow-md'}`}
                          >
                            {/* En-tête: Score P×I fixe et nombre de risques */}
                            <div className="flex items-start justify-between mb-0.5">
                              <span className="text-[7px] font-bold text-white bg-black/30 px-1 py-0.5 rounded leading-none">
                                P×I={cellScore}
                              </span>
                              {cellRisques.length > 0 && (
                                <span className="text-[8px] font-bold text-white bg-black/30 px-1 py-0.5 rounded leading-none">
                                  {cellRisques.length}
                                </span>
                              )}
                            </div>
                            {/* Codes des risques - centrés, police dynamique */}
                            <div className="overflow-y-auto h-[100px] scrollbar-thin flex items-center justify-center">
                              {cellRisques.length > 0 && (
                                <div className="flex flex-wrap gap-[2px] justify-center content-center">
                                  {cellRisques.slice(0, 100).map((r, idx) => (
                                    <span 
                                      key={idx} 
                                      className="text-white font-medium bg-black/20 px-[3px] py-[1px] rounded leading-tight"
                                      style={{ fontSize: `${cartoFontSize}px` }}
                                    >
                                      {r.code_risque}
                                    </span>
                                  ))}
                                  {cellRisques.length > 100 && (
                                    <span className="text-white/80 font-bold" style={{ fontSize: `${cartoFontSize}px` }}>+{cellRisques.length - 100}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    ))}
                  </div>
                  
                  {/* Labels X en bas */}
                  <div className="flex mt-3">
                    {impactLabels.map((label, idx) => (
                      <div key={idx} className="flex-1 text-center">
                        <span className="text-[10px] text-gray-600 font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Axe X - Impact */}
                  <div className="text-center mt-2">
                    <span className="text-sm font-bold text-gray-700">Impact (I)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Légende - Échelle P×I (1-16) */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-center gap-6 text-[10px]">
              <span className="font-semibold text-gray-600">Légende (Score P×I) - Type: {cartoFilters.typeCriticite}:</span>
              <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-green-500 shadow-sm"></div><span className="font-medium">1-3 (Faible)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-yellow-400 shadow-sm"></div><span className="font-medium">4-6 (Modéré)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-orange-500 shadow-sm"></div><span className="font-medium">8-9 (Significatif)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-5 rounded bg-red-600 shadow-sm"></div><span className="font-medium">12-16 (Critique)</span></div>
            </div>
          </div>
        </div>

        {/* Cadre 3: Comparaison de la criticité entre deux périodes */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2">
            <div className="w-[100px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5 font-semibold">Comparaison</label>
              <select 
                value={comparaisonActive ? 'Oui' : 'Non'} 
                onChange={(e) => {
                  const active = e.target.value === 'Oui'
                  setComparaisonActive(active)
                  if (!active) setPeriodeComparaison({ annee: '', semestre: '', trimestre: '', mois: '' })
                }} 
                className="w-full px-2 py-1 rounded border border-gray-200 text-xs"
              >
                <option value="Non">Non</option>
                <option value="Oui">Oui</option>
              </select>
            </div>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3 ml-1">
              <span className="text-[10px] font-semibold text-gray-600 whitespace-nowrap">Période de comparaison (antérieure) :</span>
              <div className="w-[80px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Année</label>
                <select 
                  value={periodeComparaison.annee} 
                  onChange={(e) => setPeriodeComparaison({ annee: e.target.value, semestre: '', trimestre: '', mois: '' })} 
                  disabled={!comparaisonActive}
                  className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">--</option>
                  {(() => {
                    // Filtrer les années antérieures à la période principale
                    const anneeActuelle = parseInt(periodeCarto.annee) || 9999
                    return availableYearsCarto.filter(y => parseInt(y) <= anneeActuelle).map(y => <option key={y} value={y}>{y}</option>)
                  })()}
                </select>
              </div>
              <div className="w-[90px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Semestre</label>
                <select 
                  value={periodeComparaison.semestre} 
                  onChange={(e) => setPeriodeComparaison({ ...periodeComparaison, semestre: e.target.value, trimestre: '', mois: '' })} 
                  disabled={!comparaisonActive || !periodeComparaison.annee}
                  className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">--</option>
                  {allPeriodes
                    .filter(p => p.annee?.toString() === periodeComparaison.annee && p.semestre)
                    .map(p => p.semestre)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map(s => <option key={s} value={`Semestre ${s}`}>Semestre {s}</option>)}
                </select>
              </div>
              <div className="w-[90px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Trimestre</label>
                <select 
                  value={periodeComparaison.trimestre} 
                  onChange={(e) => setPeriodeComparaison({ ...periodeComparaison, trimestre: e.target.value, semestre: '', mois: '' })} 
                  disabled={!comparaisonActive || !periodeComparaison.annee}
                  className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">--</option>
                  {allPeriodes
                    .filter(p => p.annee?.toString() === periodeComparaison.annee && p.trimestre)
                    .map(p => p.trimestre)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort()
                    .map(t => <option key={t} value={`Trimestre ${t}`}>Trimestre {t}</option>)}
                </select>
              </div>
              <div className="w-[90px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Mois</label>
                <select 
                  value={periodeComparaison.mois} 
                  onChange={(e) => setPeriodeComparaison({ ...periodeComparaison, mois: e.target.value, semestre: '', trimestre: '' })} 
                  disabled={!comparaisonActive || !periodeComparaison.annee}
                  className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">--</option>
                  {allPeriodes
                    .filter(p => p.annee?.toString() === periodeComparaison.annee && p.mois)
                    .map(p => p.mois)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort((a, b) => a - b)
                    .map(m => <option key={m} value={moisList[m - 1]}>{moisList[m - 1]}</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* Message d'erreur en dessous des champs, sur toute la largeur */}
          {getComparaisonErrorMessage() && (
            <div className="mt-2 text-[9px] text-amber-600 truncate" title={getComparaisonErrorMessage()}>
              {getComparaisonErrorMessage()}
            </div>
          )}
        </div>

        {/* Tableau récapitulatif */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-2 py-1.5 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700">
              Tableau récapitulatif 
              {selectedCartoCell && <span className="text-blue-600 font-normal ml-2">(Impact={selectedCartoCell.col + 1}, Probabilité={4 - selectedCartoCell.row})</span>}
              <span className="text-purple-600 font-normal ml-2">• Type criticité: {cartoFilters.typeCriticite}</span>
            </h4>
          </div>
          {/* Conteneur avec défilement horizontal - toujours actif */}
          <div className="relative">
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '350px' }} id="cartoTableContainer">
              <table className="w-full text-[10px]" style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  {/* Colonnes avec largeurs proportionnelles pour occuper tout le cadre */}
                  <col style={{ width: shouldShowComparaisonColumns() ? '8%' : '10%' }} />
                  <col style={{ width: shouldShowComparaisonColumns() ? '15%' : '18%' }} />
                  <col style={{ width: shouldShowComparaisonColumns() ? '8%' : '10%' }} />
                  <col style={{ width: shouldShowComparaisonColumns() ? '25%' : '32%' }} />
                  <col style={{ width: shouldShowComparaisonColumns() ? '6%' : '8%' }} />
                  <col style={{ width: shouldShowComparaisonColumns() ? '6%' : '8%' }} />
                  <col style={{ width: shouldShowComparaisonColumns() ? '8%' : '14%' }} />
                  {/* Colonnes de comparaison */}
                  {shouldShowComparaisonColumns() && (
                    <>
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '14%' }} />
                    </>
                  )}
                </colgroup>
                <thead className="sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Code Proc.</th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Libellé Processus</th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Code Risque</th>
                    <th className="px-2 py-2 text-left text-[10px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Libellé Risque</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Impact</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-white whitespace-nowrap bg-gradient-to-r from-[#1a365d] to-[#2c5282]">Prob.</th>
                    <th className="px-2 py-2 text-center text-[10px] font-semibold text-white whitespace-nowrap bg-purple-600">Crit. {getPeriodeKeyCarto() || 'actuelle'}</th>
                    {shouldShowComparaisonColumns() && (
                      <>
                        <th className="px-2 py-2 text-center text-[10px] font-semibold text-white whitespace-nowrap bg-purple-600">Crit. {getPeriodeKeyComparaison()}</th>
                        <th className="px-2 py-2 text-center text-[10px] font-semibold text-white whitespace-nowrap bg-purple-600">Taux att.</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tableRisques.length === 0 ? (
                    <tr><td colSpan={shouldShowComparaisonColumns() ? 9 : 7} className="px-4 py-8 text-center text-gray-500">Aucun risque avec probabilité renseignée pour cette période</td></tr>
                  ) : tableRisques.map((r, idx) => {
                    const periodeKeyActuel = getPeriodeKeyCarto()
                    const periodeKeyCompar = getPeriodeKeyComparaison()
                    const useBrute = cartoFilters.typeCriticite === 'Brute'
                    const isQualitatif = r.qualitatif === 'Oui' || !r.code_indicateur
                    
                    // Impact selon le type (brut ou net)
                    const impactBrut = r.impact
                    const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
                    const impactDisplay = useBrute ? impactBrut : impactNet
                    
                    // Probabilité & criticité (période actuelle)
                    const probDataActuel = getRisqueProbabilite(r, periodeKeyActuel)
                    const probActuel = probDataActuel.probDisplay || ''

                    // Criticité actuelle (Score 1-16)
                    const criticiteActuelle = probActuel ? impactDisplay * parseInt(probActuel, 10) : null
                    const niveauActuel = criticiteActuelle ? getNiveauCriticiteNum(criticiteActuelle) : null

                    // Probabilité & criticité (période comparaison)
                    let criticiteComparaison = null
                    let niveauComparaison = null
                    if (shouldShowComparaisonColumns() && periodeKeyCompar) {
                      const probDataCompar = getRisqueProbabilite(r, periodeKeyCompar)
                      const probCompar = probDataCompar.probDisplay || ''
                      if (probCompar) {
                        criticiteComparaison = impactDisplay * parseInt(probCompar, 10)
                        niveauComparaison = getNiveauCriticiteNum(criticiteComparaison)
                      }
                    }
                    const evolution = shouldShowComparaisonColumns() && niveauComparaison && niveauActuel ? getEvolution(niveauComparaison, niveauActuel) : null
                    const tauxAttenuation = shouldShowComparaisonColumns() && niveauComparaison && niveauActuel ? calculateTauxAttenuation(niveauComparaison, niveauActuel) : null
                    const tauxArrow = shouldShowComparaisonColumns() && niveauComparaison && niveauActuel ? getTauxAttenuationArrow(niveauComparaison, niveauActuel) : null
                    
                    // Obtenir la flèche et la couleur pour le taux d'atténuation
                    const getTauxArrowDisplay = (arrow, taux) => {
                      if (!arrow) return null
                      const colorClasses = {
                        green: 'text-green-600',
                        yellow: 'text-yellow-500',
                        orange: 'text-orange-500',
                        red: 'text-red-600'
                      }
                      const bgClasses = {
                        green: 'bg-green-100',
                        yellow: 'bg-yellow-100',
                        orange: 'bg-orange-100',
                        red: 'bg-red-100'
                      }
                      const arrowSymbol = arrow.direction === 'up' ? '↑' : arrow.direction === 'down' ? '↓' : '→'
                      return (
                        <span className={`inline-flex items-center justify-center gap-0.5 min-w-[55px] px-1.5 py-1 rounded text-[10px] font-bold ${bgClasses[arrow.color]} ${colorClasses[arrow.color]}`}>
                          <span className="text-sm">{arrowSymbol}</span>
                          <span>{taux}%</span>
                        </span>
                      )
                    }
                    
                    // Couleur selon le niveau de criticité (1-4)
                    const getNiveauColorBg = (niveau) => {
                      if (niveau === 1) return 'bg-green-500 text-white'
                      if (niveau === 2) return 'bg-yellow-500 text-white'
                      if (niveau === 3) return 'bg-orange-500 text-white'
                      return 'bg-red-500 text-white'
                    }
                    
                    return (
                      <tr key={r.id} className={`hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-2 py-1.5 font-mono text-gray-700 truncate" title={r.code_processus}>{r.code_processus}</td>
                        <td className="px-2 py-1.5 text-gray-600 truncate" title={r.processus?.libelle_processus}>{r.processus?.libelle_processus || '-'}</td>
                        <td className="px-2 py-1.5 font-mono font-bold text-blue-600 truncate" title={r.code_risque}>{r.code_risque}</td>
                        <td className="px-2 py-1.5 text-gray-700 truncate" title={r.libelle_risque}>{r.libelle_risque}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${impactDisplay >= 4 ? 'bg-red-500' : impactDisplay >= 3 ? 'bg-orange-500' : impactDisplay >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{impactDisplay}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {probActuel ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white text-xs font-bold ${parseInt(probActuel) >= 4 ? 'bg-red-500' : parseInt(probActuel) >= 3 ? 'bg-orange-500' : parseInt(probActuel) >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}>{probActuel}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center bg-purple-50 border-l-2 border-purple-300">
                          {niveauActuel ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${getNiveauColorBg(niveauActuel)}`}>{niveauActuel}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        {shouldShowComparaisonColumns() && (
                          <>
                            <td className="px-2 py-1.5 text-center bg-purple-50">
                              {niveauComparaison ? (
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${getNiveauColorBg(niveauComparaison)}`}>{niveauComparaison}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center bg-purple-50 border-r-2 border-purple-300">
                              {tauxAttenuation !== null && tauxArrow ? (
                                getTauxArrowDisplay(tauxArrow, tauxAttenuation)
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Indicateur de défilement */}
            {shouldShowComparaisonColumns() && (
              <div className="bg-blue-50 px-2 py-1 border-t border-blue-100 text-[10px] text-blue-600 flex items-center justify-center gap-1">
                <span>↔</span> Faites défiler horizontalement pour voir toutes les colonnes de comparaison
              </div>
            )}
          </div>
          <div className="px-2 py-1.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500">
            Affichage de {tableRisques.length} risque(s) avec probabilité renseignée • Criticité : <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-green-500 text-white text-[8px] font-bold mx-0.5">1</span>=Faible <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-yellow-500 text-white text-[8px] font-bold mx-0.5">2</span>=Modéré <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-orange-500 text-white text-[8px] font-bold mx-0.5">3</span>=Significatif <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-red-500 text-white text-[8px] font-bold mx-0.5">4</span>=Critique
          </div>
        </div>

        {/* Légende Taux d'atténuation - 16 cas */}
        {shouldShowComparaisonColumns() && (
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Légende - Taux d'atténuation (comparaison {getPeriodeKeyComparaison()} → {getPeriodeKeyCarto()})
            </h4>
            <p className="text-[11px] text-gray-600 mb-4">
              Le taux d'atténuation mesure l'évolution du niveau de criticité entre la période de référence et la période actuelle. 
              <strong className="text-green-600"> ↓ = Amélioration</strong>, 
              <strong className="text-gray-600"> → = Stable</strong>, 
              <strong className="text-red-600"> ↑ = Dégradation</strong>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Colonne 1 - Améliorations et Stables */}
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <p className="font-bold text-green-700 mb-3 text-xs flex items-center gap-1">✅ Améliorations et situations stables</p>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-green-100 text-green-600"><span>→</span><span>100%</span></span>
                    <span><strong>1→1</strong> : Criticité faible maintenue</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-green-100 text-green-600"><span>↓</span><span>100%</span></span>
                    <span><strong>2→1, 3→1, 4→1</strong> : Retour à criticité faible</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-yellow-100 text-yellow-600"><span>↓</span><span>75%</span></span>
                    <span><strong>4→2</strong> : De critique à modéré</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-yellow-100 text-yellow-600"><span>↓</span><span>50%</span></span>
                    <span><strong>3→2, 4→3</strong> : Amélioration d'un niveau</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-yellow-100 text-yellow-600"><span>→</span><span>0%</span></span>
                    <span><strong>2→2</strong> : Criticité modérée stable</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-orange-100 text-orange-600"><span>→</span><span>0%</span></span>
                    <span><strong>3→3</strong> : Criticité significative stable</span>
                  </div>
                </div>
              </div>
              
              {/* Colonne 2 - Dégradations */}
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <p className="font-bold text-red-700 mb-3 text-xs flex items-center gap-1">⚠️ Dégradations</p>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-yellow-100 text-yellow-600"><span>↑</span><span>-50%</span></span>
                    <span><strong>1→2, 2→3</strong> : Dégradation d'un niveau</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-orange-100 text-orange-600"><span>↑</span><span>-75%</span></span>
                    <span><strong>1→3</strong> : De faible à significatif</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-red-100 text-red-600"><span>↑</span><span>-100%</span></span>
                    <span><strong>1→4, 2→4, 3→4</strong> : Passage en criticité critique</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1.5 rounded border">
                    <span className="inline-flex items-center justify-center gap-0.5 min-w-[50px] px-1 py-0.5 rounded font-bold bg-red-100 text-red-600"><span>→</span><span>-100%</span></span>
                    <span><strong>4→4</strong> : Criticité critique maintenue</span>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-white rounded border text-[9px] text-gray-500">
                  <p><strong>Niveaux de criticité :</strong></p>
                  <p className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-green-500 text-white text-[8px] font-bold">1</span>=Faible
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-yellow-500 text-white text-[8px] font-bold">2</span>=Modéré
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-orange-500 text-white text-[8px] font-bold">3</span>=Significatif
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-red-500 text-white text-[8px] font-bold">4</span>=Critique
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Plein écran de la cartographie */}
        {cartoFullscreen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full h-full max-w-[95vw] max-h-[95vh] overflow-auto p-6 relative">
              {/* Barre d'outils en haut */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                {/* Contrôle de la taille des codes */}
                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow">
                  <button 
                    onClick={() => setCartoFontSize(Math.max(3, cartoFontSize - 1))} 
                    className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"
                    disabled={cartoFontSize <= 3}
                    title="Réduire la taille"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-xs text-gray-500 w-10 text-center">{cartoFontSize}px</span>
                  <button 
                    onClick={() => setCartoFontSize(Math.min(10, cartoFontSize + 1))} 
                    className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30"
                    disabled={cartoFontSize >= 10}
                    title="Agrandir la taille"
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>
                <button 
                  onClick={() => setCartoFullscreen(false)} 
                  className="p-2 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white transition-colors"
                  title="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Titre */}
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Cartographie des Risques</h2>
                <p className="text-sm text-gray-600">
                  Période: {getPeriodeKeyCarto() || 'Non sélectionnée'} | Type: {cartoFilters.typeCriticite}
                </p>
              </div>

              {/* Matrice plein écran */}
              <div className="flex justify-center">
                <div className="flex">
                  {/* Axe Y - Fréquence/Probabilité */}
                  <div className="flex flex-col items-center justify-center mr-4" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    <span className="text-lg font-bold text-gray-700">Fréquence (P)</span>
                  </div>
                  
                  <div>
                    {/* Labels Y à gauche */}
                    <div className="flex">
                      <div className="w-32 flex flex-col justify-around pr-3">
                        {[...probabiliteLabels].reverse().map((label, idx) => (
                          <div key={idx} className="h-40 flex items-center justify-end">
                            <span className="text-sm text-gray-600 font-medium text-right">{label}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Grille 4x4 plein écran */}
                      <div>
                        <div className="grid grid-cols-4 gap-2">
                          {[0, 1, 2, 3].map(row => (
                            [0, 1, 2, 3].map(col => {
                              const cellScore = scoreMatrix[row][col]
                              const bgColor = colorMatrix[row][col]
                              const cellRisques = getRisquesForCell(row, col)
                              const isSelected = selectedCartoCell?.row === row && selectedCartoCell?.col === col
                              
                              return (
                                <div 
                                  key={`fs-${row}-${col}`}
                                  onClick={() => setSelectedCartoCell(isSelected ? null : { row, col })}
                                  className={`w-48 h-40 rounded-xl p-2 cursor-pointer transition-all shadow-md ${bgColor} 
                                    ${isSelected ? 'ring-4 ring-blue-600 ring-offset-2 scale-105' : 'hover:opacity-90 hover:shadow-lg'}`}
                                >
                                  {/* En-tête */}
                                  <div className="flex items-start justify-between mb-1">
                                    <span className="text-[9px] font-bold text-white bg-black/30 px-1.5 py-0.5 rounded">
                                      P×I={cellScore}
                                    </span>
                                    {cellRisques.length > 0 && (
                                      <span className="text-[10px] font-bold text-white bg-black/30 px-1.5 py-0.5 rounded">
                                        {cellRisques.length}
                                      </span>
                                    )}
                                  </div>
                                  {/* Codes des risques - centrés verticalement et horizontalement */}
                                  <div className="overflow-y-auto h-[120px] scrollbar-thin flex items-center justify-center">
                                    {cellRisques.length > 0 && (
                                      <div className="flex flex-wrap gap-[3px] justify-center content-center">
                                        {cellRisques.slice(0, 150).map((r, idx) => (
                                          <span 
                                            key={idx} 
                                            className="text-white font-medium bg-black/20 px-1 py-0.5 rounded leading-tight"
                                            style={{ fontSize: `${cartoFontSize}px` }}
                                          >
                                            {r.code_risque}
                                          </span>
                                        ))}
                                        {cellRisques.length > 150 && (
                                          <span className="text-white/80 font-bold" style={{ fontSize: `${cartoFontSize}px` }}>+{cellRisques.length - 150}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          ))}
                        </div>
                        
                        {/* Labels X en bas */}
                        <div className="flex mt-3">
                          {impactLabels.map((label, idx) => (
                            <div key={idx} className="w-48 text-center mx-1">
                              <span className="text-sm text-gray-600 font-medium">{label}</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Axe X - Impact */}
                        <div className="text-center mt-3">
                          <span className="text-lg font-bold text-gray-700">Impact (I)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Légende plein écran */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center gap-8 text-sm">
                  <span className="font-semibold text-gray-600">Légende (Score P×I) - {cartoFilters.typeCriticite}:</span>
                  <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-green-500 shadow"></div><span className="font-medium">1-3 (Faible)</span></div>
                  <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-yellow-400 shadow"></div><span className="font-medium">4-6 (Modéré)</span></div>
                  <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-orange-500 shadow"></div><span className="font-medium">8-9 (Significatif)</span></div>
                  <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-red-600 shadow"></div><span className="font-medium">12-16 (Critique)</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================
  // SECTION PLAN DE MAÎTRISE DES RISQUES (REFAIT)
  // ============================================
  
  // States pour Plan de maîtrise
  const [planFilters, setPlanFilters] = useState({
    categorie: '', structure: '', processus: '', criticite: '', typeCriticite: 'Nette', recherche: ''
  })
  const [periodePlan, setPeriodePlan] = useState({ annee: '', semestre: '', trimestre: '', mois: '' })

  // Par défaut, sur Plan de maîtrise : période ouverte si existante, sinon période la plus récente (date_fin max)
  useEffect(() => {
    const hasSelection = !!(periodePlan.annee || periodePlan.semestre || periodePlan.trimestre || periodePlan.mois)
    if (hasSelection) return
    if (periodeOuverte) {
      setPeriodePlan(periodeToFormLong(periodeOuverte))
      return
    }
    const mostRecent = getMostRecentPeriode(allPeriodes)
    if (mostRecent) setPeriodePlan(periodeToFormLong(mostRecent))
  }, [periodeOuverte, allPeriodes])

  // Générer la clé de période (même format que Analyse/Évaluation/Cartographie)
  const getPeriodeKeyPlan = () => {
    if (!periodePlan.annee) return ''
    if (periodePlan.mois) return `${periodePlan.mois}-${periodePlan.annee}`
    if (periodePlan.trimestre) {
      const tNum = periodePlan.trimestre.replace('Trimestre ', 'T')
      return `${tNum}-${periodePlan.annee}`
    }
    if (periodePlan.semestre) {
      const sNum = periodePlan.semestre.replace('Semestre ', 'S')
      return `${sNum}-${periodePlan.annee}`
    }
    return periodePlan.annee
  }

  const [showPlanActionsModal, setShowPlanActionsModal] = useState(false)
  const [selectedPlanRisque, setSelectedPlanRisque] = useState(null)
  const [planActionsFilters, setPlanActionsFilters] = useState({
    structure: '', responsable: '', niveauAvancement: '', niveauRetard: '', dateDebut: '', dateFin: '', recherche: ''
  })
  const [showPlanActionFormModal, setShowPlanActionFormModal] = useState(false)
  const [planActionForm, setPlanActionForm] = useState({ 
    libelle_action: '', code_groupe: '', code_structure: '', commentaire: '', statut: 'Actif',
    occ_date_debut: '', occ_date_fin: '', occ_responsable: ''
  })
  const [editingPlanAction, setEditingPlanAction] = useState(null)
  const [showPlanTachesModal, setShowPlanTachesModal] = useState(false)
  const [selectedPlanOccurrence, setSelectedPlanOccurrence] = useState(null)
  const [showPlanTacheFormModal, setShowPlanTacheFormModal] = useState(false)
  const [planTacheForm, setPlanTacheForm] = useState({})
  const [editingPlanTache, setEditingPlanTache] = useState(null)
  const [planTaches, setPlanTaches] = useState([])
  const [planActions, setPlanActions] = useState([])
  const [planOccurrences, setPlanOccurrences] = useState([])
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [groupesActions, setGroupesActions] = useState([])
  const [membresProjetRisques, setMembresProjetRisques] = useState([])
  // State pour le modal Suivi du plan (vue globale de toutes les actions)
  const [showSuiviPlanModal, setShowSuiviPlanModal] = useState(false)
  const [suiviPlanFilters, setSuiviPlanFilters] = useState({
    structure: '', responsable: '', niveauAvancement: '', niveauRetard: '', dateDebut: '', dateFin: '', recherche: '', risque: '', processus: ''
  })
  // State pour mémoriser le contexte de retour après ajout/modification de tâche
  // 'actions' = retour au modal actions du risque, 'taches' = retour à la liste des tâches, 'suivi' = retour au suivi global
  const [returnContext, setReturnContext] = useState('actions')

  // Charger les groupes d'actions (projets)
  const fetchGroupesActions = async () => {
    try {
      const res = await fetch('/api/groupes-actions')
      if (res.ok) {
        const data = await res.json()
        setGroupesActions(data.groupes || [])
        // Charger les membres du projet "Projet des Risques" si trouvé
        const projetRisques = (data.groupes || []).find(g => g.libelle_groupe === 'Projet des Risques')
        if (projetRisques) {
          const membresRes = await fetch(`/api/membres-groupe?code_groupe=${projetRisques.code_groupe}`)
          if (membresRes.ok) {
            const membresData = await membresRes.json()
            setMembresProjetRisques(membresData.membres || [])
          }
        }
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error)
    }
  }

  // Charger les actions et occurrences
  const fetchPlanData = async () => {
    try {
      setLoadingPlan(true)
      const [actionsRes, occRes, tachesRes] = await Promise.all([
        fetch('/api/actions'),
        fetch('/api/actions/occurrences'),
        fetch('/api/taches')
      ])
      if (actionsRes.ok) {
        const data = await actionsRes.json()
        setPlanActions(data.actions || [])
      }
      if (occRes.ok) {
        const data = await occRes.json()
        setPlanOccurrences(data.occurrences || [])
      }
      if (tachesRes.ok) {
        const data = await tachesRes.json()
        setPlanTaches(data.taches || [])
      }
    } catch (error) {
      console.error('Erreur chargement plan data:', error)
    } finally {
      setLoadingPlan(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'plan' || activeTab === 'synthese') {
      fetchPlanData()
      fetchGroupesActions()
    }
  }, [activeTab])

  // Trouver ou créer le groupe "Projet des Risques"
  const getProjetDesRisquesId = () => {
    const groupe = groupesActions.find(g => g.libelle_groupe === 'Projet des Risques')
    return groupe?.code_groupe || null
  }

  // Obtenir le projet "Projet des Risques" complet
  const getProjetDesRisques = () => {
    return groupesActions.find(g => g.libelle_groupe === 'Projet des Risques') || null
  }

  // Obtenir les membres du projet (comme dans activites)
  const getProjetMembres = (projet) => {
    if (!projet) return []
    const gestionnaires = Array.isArray(projet.gestionnaires) ? projet.gestionnaires : JSON.parse(projet.gestionnaires || '[]')
    const membres = Array.isArray(projet.membres) ? projet.membres : JSON.parse(projet.membres || '[]')
    return [...new Set([...gestionnaires, ...membres])]
  }

  // Obtenir les responsables disponibles (membre du projet + structure)
  const getResponsablesForPlanAction = () => {
    if (!planActionForm.code_structure) return []
    // Retourner tous les utilisateurs actifs de la structure sélectionnée
    return users.filter(u => u.statut === 'Actif' && u.structure === planActionForm.code_structure)
  }

  // Filtrer risques pour le Plan (actifs + inactifs avec actions non achevées)
  const getFilteredPlanRisques = () => {
    return risques.filter(r => {
      // Risques actifs OU inactifs avec au moins une action non achevée
      const hasActionsNonAchevees = planActions.some(a => {
        if (a.code_risque !== r.code_risque) return false
        // Vérifier si l'occurrence la plus récente n'est pas achevée
        const occ = planOccurrences.find(o => o.code_action === a.code_action)
        if (!occ) return true // Pas d'occurrence = non achevé
        const txAvancement = getTxAvancementPlan(occ)
        return txAvancement < 100 || occ.gestionnaire_conf !== 'Oui'
      })
      
      if (r.statut !== 'Actif' && !hasActionsNonAchevees) return false
      
      // Appliquer les filtres
      if (planFilters.categorie && !r.categories?.includes(parseInt(planFilters.categorie))) return false
      if (planFilters.structure && r.code_structure !== planFilters.structure) return false
      if (planFilters.processus && r.code_processus !== planFilters.processus) return false
      if (planFilters.recherche) {
        const search = planFilters.recherche.toLowerCase()
        if (!r.code_risque?.toLowerCase().includes(search) && !r.libelle_risque?.toLowerCase().includes(search)) return false
      }

      // Filtre criticité (basé sur période sélectionnée)
      if (planFilters.criticite) {
        const criticite = getCriticiteForPlan(r)
        if (!criticite) return false
        const niv = getNiveauCriticitePlan(criticite)
        if (planFilters.criticite === 'faible' && niv !== 'Faible') return false
        if (planFilters.criticite === 'modere' && niv !== 'Modéré') return false
        if (planFilters.criticite === 'significatif' && niv !== 'Significatif') return false
        if (planFilters.criticite === 'critique' && niv !== 'Critique') return false
      }
      
      return true
    })
  }

  // Calculer criticité pour un risque (Plan) - même logique que l'évaluation
  const getCriticiteForPlan = (risque) => {
    const useBrute = planFilters.typeCriticite === 'Brute'
    const periodeKey = getPeriodeKeyPlan()

    // Probabilité (respecte la règle: période fermée => uniquement risques_probabilites)
    const probData = getRisqueProbabilite(risque, periodeKey)
    const prob = parseInt(probData.probDisplay || '', 10)
    if (!prob || Number.isNaN(prob)) return null

    // Impact / Eff.Ctrl
    let impactBrut = risque.impact
    let effCtrl = risque.efficacite_contr

    const periodeObj = (allPeriodes || []).find(p => String(getPeriodeKeyFromPeriode(p)) === String(periodeKey)) || null
    const isPeriodeFermee = !!(periodeObj && periodeObj.statut && String(periodeObj.statut).toLowerCase() !== 'ouvert')
    if (isPeriodeFermee) {
      const rpRow = risquesProbabilites.find(rp => rp.code_risque === risque.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
      impactBrut = rpRow?.impact ?? null
      effCtrl = rpRow?.eff_ctrl ?? null
    }

    if (impactBrut === null || impactBrut === undefined || impactBrut === '') return null
    const impactNet = calculateImpactNet(impactBrut, effCtrl)
    const impact = useBrute ? impactBrut : impactNet

    return calculateCriticite(impact, prob)
  }
// Obtenir les actions d'un risque avec leurs occurrences
  const getActionsRisque = (codeRisque) => {
    const actionsRisque = planActions.filter(a => a.code_risque === codeRisque)
    return actionsRisque.map(a => {
      const occ = planOccurrences.find(o => o.code_action === a.code_action) || {}
      const occTaches = planTaches.filter(t => t.code_occurrence === (occ.code_occurrence || occ.id))
      return { ...a, occurrence: occ, taches: occTaches }
    })
  }

  // Filtrer les actions dans le modal
  const getFilteredPlanActionsModal = () => {
    if (!selectedPlanRisque) return []
    let actions = getActionsRisque(selectedPlanRisque.code_risque)
    
    return actions.filter(a => {
      const occ = a.occurrence || {}
      if (planActionsFilters.structure && a.code_structure !== planActionsFilters.structure) return false
      if (planActionsFilters.responsable && occ.responsable !== planActionsFilters.responsable) return false
      if (planActionsFilters.dateDebut && occ.date_debut && occ.date_debut < planActionsFilters.dateDebut) return false
      if (planActionsFilters.dateFin && occ.date_fin && occ.date_fin > planActionsFilters.dateFin) return false
      if (planActionsFilters.recherche) {
        const search = planActionsFilters.recherche.toLowerCase()
        if (!a.libelle_action?.toLowerCase().includes(search)) return false
      }
      
      // Filtres niveau
      const txAvancement = getTxAvancementPlan(occ)
      const calc = calculateOccPlan(occ, txAvancement)
      if (planActionsFilters.niveauAvancement && calc.niveauAvancement !== planActionsFilters.niveauAvancement) return false
      if (planActionsFilters.niveauRetard && calc.niveauRetard !== planActionsFilters.niveauRetard) return false
      
      return true
    })
  }

  // Obtenir TOUTES les actions de TOUS les risques pour le Suivi du plan
  const getAllPlanActions = () => {
    // Obtenir toutes les actions liées à des risques (code_risque non null)
    const actionsAvecRisque = planActions.filter(a => a.code_risque)
    return actionsAvecRisque.map(a => {
      const occ = planOccurrences.find(o => o.code_action === a.code_action) || {}
      const occTaches = planTaches.filter(t => t.code_occurrence === (occ.code_occurrence || occ.id))
      const risque = risques.find(r => r.code_risque === a.code_risque)
      return { ...a, occurrence: occ, taches: occTaches, risque }
    })
  }

  // Filtrer les actions pour le modal Suivi du plan
  const getFilteredSuiviPlanActions = () => {
    let actions = getAllPlanActions()
    
    return actions.filter(a => {
      const occ = a.occurrence || {}
      // Filtre par risque
      if (suiviPlanFilters.risque && a.code_risque !== suiviPlanFilters.risque) return false
      // Filtre par processus (via le risque)
      if (suiviPlanFilters.processus && a.risque?.code_processus !== suiviPlanFilters.processus) return false
      if (suiviPlanFilters.structure && a.code_structure !== suiviPlanFilters.structure) return false
      if (suiviPlanFilters.responsable && occ.responsable !== suiviPlanFilters.responsable) return false
      if (suiviPlanFilters.dateDebut && occ.date_debut && occ.date_debut < suiviPlanFilters.dateDebut) return false
      if (suiviPlanFilters.dateFin && occ.date_fin && occ.date_fin > suiviPlanFilters.dateFin) return false
      if (suiviPlanFilters.recherche) {
        const search = suiviPlanFilters.recherche.toLowerCase()
        const matchLibelle = a.libelle_action?.toLowerCase().includes(search)
        const matchCode = a.code_risque?.toLowerCase().includes(search)
        const matchRisque = a.risque?.libelle_risque?.toLowerCase().includes(search)
        if (!matchLibelle && !matchCode && !matchRisque) return false
      }
      
      // Filtres niveau
      const txAvancement = getTxAvancementPlan(occ)
      const calc = calculateOccPlan(occ, txAvancement)
      if (suiviPlanFilters.niveauAvancement && calc.niveauAvancement !== suiviPlanFilters.niveauAvancement) return false
      if (suiviPlanFilters.niveauRetard && calc.niveauRetard !== suiviPlanFilters.niveauRetard) return false
      
      return true
    })
  }

  // Calculer tx avancement pour une occurrence (avec tâches)
  const getTxAvancementPlan = (occ) => {
    if (!occ || !occ.id) return 0
    const occId = occ.code_occurrence || occ.id
    const occTaches = planTaches.filter(t => t.code_occurrence === occId)
    if (occTaches.length > 0) {
      const totalTx = occTaches.reduce((sum, t) => sum + (t.tx_avancement || 0), 0)
      return Math.round(totalTx / occTaches.length)
    }
    return occ.tx_avancement || 0
  }

  // Indique si une occurrence possède des tâches (source de calcul du Tx%)
  const hasOccurrenceTachesPlan = (occ) => {
    if (!occ) return false
    const occId = occ.code_occurrence || occ.id
    return planTaches.some(t => t.code_occurrence === occId)
  }

  // Calculer champs occurrence (niveau avancement, retard, etc.)
  const calculateOccPlan = (occ, txAvancement) => {
    if (!occ) return { niveauAvancement: 'Non entamée', jourRetard: 0, niveauRetard: 'Pas retard' }

    const tx = Number(txAvancement) || 0
    const isDone = tx >= 100

    const toDateOnly = (d) => {
      if (!d) return null
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) return null
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
    }

    const today = (() => {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    })()

    const dateFin = toDateOnly(occ?.date_fin)
    // Pour une action terminée, le retard se calcule par rapport à la date de réalisation.
    // Fallback : date_conf, sinon aujourd'hui.
    const dateRef = isDone
      ? (toDateOnly(occ?.date_realisation) || toDateOnly(occ?.date_conf) || today)
      : today

    // Jour retard : peut être négatif (échéance non atteinte) et ne doit pas être décalé de +1.
    let jourRetard = 0
    if (dateFin) {
      jourRetard = Math.floor((dateRef - dateFin) / 86400000)
    }

    // Niveau d'avancement
    let niveauAvancement = 'Non entamée'
    if (tx === 0) niveauAvancement = 'Non entamée'
    else if (tx <= 50) niveauAvancement = 'En cours -50%'
    else if (tx < 100) niveauAvancement = 'En cours +50%'
    else if (tx >= 100 && occ?.gestionnaire_conf !== 'Oui') niveauAvancement = 'Terminée - non confirmée'
    else if (tx >= 100 && occ?.gestionnaire_conf === 'Oui') niveauAvancement = 'Achevée'

    const niveauRetard = jourRetard > 0 ? 'Retard' : 'Pas retard'

    return { niveauAvancement, jourRetard, niveauRetard }
  }

  // Ouvrir modal actions pour un risque
  const handleOpenPlanActions = (risque) => {
    setSelectedPlanRisque(risque)
    setPlanActionsFilters({ structure: '', responsable: '', niveauAvancement: '', niveauRetard: '', dateDebut: '', dateFin: '', recherche: '' })
    setShowPlanActionsModal(true)
  }

  // Ouvrir formulaire création action
  const handleOpenPlanActionForm = () => {
    const projetId = getProjetDesRisquesId()
    setPlanActionForm({
      libelle_action: '',
      code_groupe: projetId,
      code_structure: '',
      commentaire: '',
      statut: 'Actif',
      occ_date_debut: '',
      occ_date_fin: '',
      occ_responsable: '',
      code_risque: selectedPlanRisque?.code_risque
    })
    setEditingPlanAction(null)
    setShowPlanActionFormModal(true)
  }

  // Ouvrir formulaire modification action
  const handleEditPlanAction = (action) => {
    const occ = action.occurrence || {}
    setPlanActionForm({
      id: action.id,
      libelle_action: action.libelle_action,
      code_groupe: action.code_groupe,
      code_structure: action.code_structure,
      commentaire: action.commentaire || '',
      statut: action.statut || 'Actif',
      occ_date_debut: occ.date_debut || '',
      occ_date_fin: occ.date_fin || '',
      occ_responsable: occ.responsable || '',
      tx_avancement: occ.tx_avancement || 0,
      occurrence_id: occ.id
    })
    setEditingPlanAction(action)
    setShowPlanActionFormModal(true)
  }

  // Sauvegarder action (création ou modification)
  const handleSavePlanAction = async () => {
    // Validations identiques à la sous-rubrique Actions
    if (!planActionForm.libelle_action) { showAlert('error', 'Libellé obligatoire'); return }
    if (!planActionForm.code_structure) { showAlert('error', 'Structure obligatoire'); return }
    
    if (!editingPlanAction) {
      // Validations pour la création uniquement
      if (!planActionForm.occ_date_debut || !planActionForm.occ_date_fin) { showAlert('error', 'Dates occurrence obligatoires'); return }
      if (planActionForm.occ_date_fin < planActionForm.occ_date_debut) { showAlert('error', 'La date de fin doit être ultérieure ou égale à la date de début'); return }
      if (!planActionForm.occ_responsable) { showAlert('error', 'Responsable occurrence obligatoire'); return }
    }
    
    try {
      // Trouver ou créer le groupe "Projet des Risques"
      let projetId = getProjetDesRisquesId()
      if (!projetId) {
        // Créer le groupe
        const resGroupe = await fetch('/api/groupes-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ libelle_groupe: 'Projet des Risques', statut: 'Actif', createur: user?.username })
        })
        if (resGroupe.ok) {
          const data = await resGroupe.json()
          projetId = data.groupe?.code_groupe
          await fetchGroupesActions()
        }
      }

      if (editingPlanAction) {
        // Modification
        await fetch('/api/actions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: planActionForm.id,
            libelle_action: planActionForm.libelle_action,
            code_structure: planActionForm.code_structure,
            commentaire: planActionForm.commentaire,
            statut: planActionForm.statut,
            modificateur: user?.username
          })
        })
        // Modifier l'occurrence si elle existe
        if (planActionForm.occurrence_id) {
          await fetch('/api/actions/occurrences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: planActionForm.occurrence_id,
              date_debut: planActionForm.occ_date_debut,
              date_fin: planActionForm.occ_date_fin,
              responsable: planActionForm.occ_responsable,
              // Si des tâches existent, le Tx% est obligatoirement calculé depuis les tâches
              tx_avancement: (() => {
                const occ = editingPlanAction?.occurrence || null
                return occ && hasOccurrenceTachesPlan(occ) ? getTxAvancementPlan(occ) : planActionForm.tx_avancement
              })()
            })
          })
        }
      } else {
        // Création
        const body = {
          libelle_action: planActionForm.libelle_action,
          code_groupe: projetId,
          code_structure: planActionForm.code_structure,
          commentaire: planActionForm.commentaire,
          statut: planActionForm.statut,
          code_risque: selectedPlanRisque?.code_risque,
          createur: user?.username,
          first_occurrence: {
            date_debut: planActionForm.occ_date_debut,
            date_fin: planActionForm.occ_date_fin,
            responsable: planActionForm.occ_responsable
          }
        }
        const actionRes = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (!actionRes.ok) {
          const err = await actionRes.json()
          showAlert('error', err.error || 'Erreur lors de la création')
          return
        }
      }
      
      // Message de succès AVANT de fermer le modal
      showAlert('success', editingPlanAction ? 'Action modifiée' : 'Action et occurrence créées')
      setShowPlanActionFormModal(false)
      await fetchPlanData()
    } catch (error) {
      console.error('Erreur sauvegarde action:', error)
      showAlert('error', 'Erreur lors de la sauvegarde')
    }
  }

  // Supprimer action
  const handleDeletePlanAction = async (action, fromSuivi = false) => {
    setConfirmAction({
      message: 'Supprimer cette action et ses occurrences/tâches ?',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/actions', { 
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: action.id })
          })
          if (res.ok) {
            showAlert('success', 'Action supprimée avec succès')
            await fetchPlanData()
            if (fromSuivi) {
              setShowSuiviPlanModal(true)
            }
          } else {
            const err = await res.json()
            showAlert('error', err.error || 'Erreur lors de la suppression')
          }
        } catch (error) {
          console.error('Erreur suppression:', error)
          showAlert('error', 'Erreur lors de la suppression')
        }
      }
    })
  }

  // Ouvrir liste des tâches
  const handleOpenPlanTaches = (action) => {
    setSelectedPlanOccurrence(action.occurrence)
    setShowPlanTachesModal(true)
  }

  // Ouvrir formulaire tâche (identique à Suivi actions)
  // context: 'actions' | 'taches' | 'suivi' - indique où revenir après sauvegarde
  const handleOpenPlanTacheForm = (tacheOrOcc = null, isOccurrence = false, context = 'actions') => {
    let occ = selectedPlanOccurrence
    
    // Mémoriser le contexte de retour
    setReturnContext(context)
    
    // Si on passe une occurrence directement (pour création depuis le tableau)
    if (isOccurrence && tacheOrOcc) {
      occ = tacheOrOcc
      setSelectedPlanOccurrence(occ)
    }
    
    // Si c'est une tâche (pour modification)
    if (tacheOrOcc && !isOccurrence && tacheOrOcc.libelle_tache) {
      // Modification de tâche
      setPlanTacheForm({ ...tacheOrOcc })
      setEditingPlanTache(tacheOrOcc)
      setShowPlanTacheFormModal(true)
      return
    }
    
    if (!occ) {
      showAlert('error', 'Veuillez sélectionner une occurrence')
      return
    }
    
    // Création - demander confirmation comme dans Suivi actions
    const occId = occ?.code_occurrence || occ?.id
    const hasTaches = planTaches.filter(t => t.code_occurrence === occId).length > 0
    setConfirmAction({
      message: hasTaches ? 'Créer une nouvelle tâche ?' : 'Créer une tâche ? Le Tx sera calculé automatiquement.',
      onConfirm: () => {
        setPlanTacheForm({
          libelle_tache: '',
          date_debut: occ?.date_debut || '',
          date_fin: occ?.date_fin || '',
          responsable: occ?.responsable || '',
          commentaire: '',
          tx_avancement: 0
        })
        setEditingPlanTache(null)
        setShowPlanTacheFormModal(true)
      }
    })
  }

  // Sauvegarder tâche (identique à Suivi actions avec validations)
  const handleSavePlanTache = async () => {
    // Validations obligatoires comme dans Suivi actions
    if (!planTacheForm.libelle_tache) { showAlert('error', 'Libellé obligatoire'); return }
    if (!planTacheForm.date_debut || !planTacheForm.date_fin) { showAlert('error', 'Dates obligatoires'); return }
    if (!planTacheForm.responsable) { showAlert('error', 'Responsable obligatoire'); return }
    
    // Validation des dates par rapport à l'occurrence
    if (selectedPlanOccurrence) {
      const tDebut = new Date(planTacheForm.date_debut), tFin = new Date(planTacheForm.date_fin)
      const oDebut = new Date(selectedPlanOccurrence.date_debut), oFin = new Date(selectedPlanOccurrence.date_fin)
      if (tDebut < oDebut) { showAlert('error', "Date début antérieure à l'occurrence"); return }
      if (tFin > oFin) { showAlert('error', "Date fin postérieure à l'occurrence"); return }
    }
    
    try {
      const occId = selectedPlanOccurrence?.code_occurrence || selectedPlanOccurrence?.id
      const body = {
        ...planTacheForm,
        id: editingPlanTache?.id,
        code_occurrence: editingPlanTache?.code_occurrence || occId,
        code_action: selectedPlanOccurrence?.code_action,
        createur: editingPlanTache?.createur || user?.username,
        modificateur: user?.username
      }
      
      const r = await fetch('/api/taches', {
        method: editingPlanTache ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (r.ok) {
        showAlert('success', editingPlanTache ? 'Tâche modifiée' : 'Tâche créée')
        setShowPlanTacheFormModal(false)
        await fetchPlanData()
        
        // Retourner au bon contexte
        if (returnContext === 'taches') {
          setShowPlanTachesModal(true)
        } else if (returnContext === 'suivi') {
          setShowSuiviPlanModal(true)
        } else {
          // Par défaut, retour au modal actions
          setShowPlanActionsModal(true)
        }
      } else {
        const err = await r.json()
        showAlert('error', err.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur sauvegarde tâche:', error)
      showAlert('error', 'Erreur de connexion')
    }
  }

  // Supprimer tâche
  const handleDeletePlanTache = async (tache) => {
    setConfirmAction({
      message: 'Supprimer cette tâche ?',
      onConfirm: async () => {
        try {
          const r = await fetch('/api/taches', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tache.id })
          })
          if (r.ok) {
            await fetchPlanData()
            showAlert('success', 'Tâche supprimée')
          }
        } catch (error) {
          console.error('Erreur suppression tâche:', error)
          showAlert('error', 'Erreur de connexion')
        }
      }
    })
  }

  // Confirmation gestionnaire
  const handlePlanToggleConf = async (occ, confirm) => {
    try {
      await fetch('/api/actions/occurrences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: occ.id, gestionnaire_conf: confirm ? 'Oui' : 'Non' })
      })
      await fetchPlanData()
    } catch (error) {
      console.error('Erreur confirmation:', error)
    }
  }

  // Export Excel Plan
  const handleExportPlan = () => {
    const filtered = getFilteredPlanRisques()
    if (filtered.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    const headers = ['Code risque', 'Libellé risque', 'Statut', 'Code processus', 'Libellé processus', 'Criticité', 'Nb actions']
    const rows = filtered.map(r => {
      const proc = processus.find(p => p.code_processus === r.code_processus)
      const criticite = getCriticiteForPlan(r)
      return [
        r.code_risque, r.libelle_risque, r.statut, r.code_processus, proc?.libelle_processus || '', 
        getIndexCriticite(criticite), getNbActionsRisque(r.code_risque)
      ]
    })
    
    const csvContent = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `plan_maitrise_risques_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Export Excel pour le Suivi global des actions
  const handleExportSuiviPlan = () => {
    const filtered = getFilteredSuiviPlanActions()
    if (filtered.length === 0) {
      showAlert('warning', 'Aucune donnée à exporter')
      return
    }
    
    const headers = ['Code risque', 'Libellé risque', 'Libellé action', 'Projet', 'Structure', 'Début', 'Fin', 'Tx%', 'Niveau avancement', 'Jours retard', 'Niveau retard', 'Conf. Gestionnaire', 'Responsable']
    const rows = filtered.map(a => {
      const occ = a.occurrence || {}
      const txAvancement = getTxAvancementPlan(occ)
      const calc = calculateOccPlan(occ, txAvancement)
      const respUser = users.find(u => u.username === occ.responsable)
      const respNom = respUser ? `${respUser.nom || ''} ${respUser.prenoms || respUser.prenom || ''}`.trim() : (occ.responsable || '')
      return [
        a.code_risque || '',
        a.risque?.libelle_risque || '',
        a.libelle_action || '',
        'Projet des Risques',
        a.code_structure || '',
        occ.date_debut ? new Date(occ.date_debut).toLocaleDateString('fr-FR') : '',
        occ.date_fin ? new Date(occ.date_fin).toLocaleDateString('fr-FR') : '',
        txAvancement,
        calc.niveauAvancement,
        calc.jourRetard,
        calc.niveauRetard,
        txAvancement >= 100 && occ.gestionnaire_conf === 'Oui' ? 'Oui' : 'Non',
        respNom
      ]
    })
    
    const csvContent = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `suivi_plan_actions_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Statistiques pour le Suivi global
  const getSuiviPlanStats = () => {
    const filtered = getFilteredSuiviPlanActions()
    let achevees = 0, terminees = 0, enCours50Plus = 0, enCours50Moins = 0, nonEntamees = 0
    filtered.forEach(a => {
      const occ = a.occurrence || {}
      const txAvancement = getTxAvancementPlan(occ)
      const calc = calculateOccPlan(occ, txAvancement)
      if (calc.niveauAvancement === 'Achevée') achevees++
      else if (calc.niveauAvancement === 'Terminée - non confirmée') terminees++
      else if (calc.niveauAvancement === 'En cours +50%') enCours50Plus++
      else if (calc.niveauAvancement === 'En cours -50%') enCours50Moins++
      else nonEntamees++
    })
    return { total: filtered.length, achevees, terminees, enCours50Plus, enCours50Moins, nonEntamees }
  }

  const renderPlan = () => {
    const filteredRisques = getFilteredPlanRisques()
    
    // Périodes disponibles
    const availableYearsPlan = [...new Set(allPeriodes.map(p => p.annee))].sort((a, b) => b - a)
    const availableSemestresPlan = allPeriodes.filter(p => p.annee?.toString() === periodePlan.annee && p.semestre).map(p => p.semestre).filter((v, i, a) => a.indexOf(v) === i).sort()
    const availableTrimestresPlan = allPeriodes.filter(p => p.annee?.toString() === periodePlan.annee && p.trimestre).map(p => p.trimestre).filter((v, i, a) => a.indexOf(v) === i).sort()
    const availableMoisPlan = allPeriodes.filter(p => p.annee?.toString() === periodePlan.annee && p.mois).map(p => p.mois).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
    
    // Options pour les filtres du modal
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
    
    // Options responsables - avec gestion des champs undefined
    const responsableOptions = [{ value: '', label: 'Tous' }, ...users.filter(u => u.statut === 'Actif').map(u => ({ value: u.username, label: `${u.nom || ''} ${u.prenoms || u.prenom || ''}`.trim() || u.username }))]
    const structureOptions = [{ value: '', label: 'Toutes' }, ...structures.map(s => ({ value: s.code_structure, label: s.libelle_structure }))]
    
    return (
      <div className="space-y-4">
        {/* Cadre 1: Filtres risques (identique à Évaluation) */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2 overflow-x-auto">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Catégorie" size="sm" value={planFilters.categorie || ''} onChange={(v) => setPlanFilters({ ...planFilters, categorie: v })} options={[{ value: '', label: 'Toutes' }, ...categories.filter(c => c.statut === 'Actif').map(c => ({ value: c.code_categorie?.toString() || c.id?.toString(), label: c.libelle_categorie }))]} placeholder="Toutes"/>
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Structure" size="sm" value={planFilters.structure || ''} onChange={(v) => setPlanFilters({ ...planFilters, structure: v })} options={[{ value: '', label: 'Toutes' }, ...structures.map(s => ({ value: s.code_structure, label: s.libelle_structure }))]} placeholder="Toutes"/>
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Processus" size="sm" value={planFilters.processus || ''} onChange={(v) => setPlanFilters({ ...planFilters, processus: v })} options={[{ value: '', label: 'Tous' }, ...processus.filter(p => p.statut === 'Actif').map(p => ({ value: p.code_processus, label: p.libelle_processus }))]} placeholder="Tous"/>
            </div>

            <div className="w-[120px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Criticité</label>
              <select value={planFilters.criticite || ''} onChange={(e) => setPlanFilters({ ...planFilters, criticite: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="">Toutes</option>
                <option value="faible">Faible</option>
                <option value="modere">Modéré</option>
                <option value="significatif">Significatif</option>
                <option value="critique">Critique</option>
              </select>
            </div>
            <div className="w-[90px] flex-shrink-0">
              <label className="block text-[10px] text-gray-500 mb-0.5">Type crit.</label>
              <select value={planFilters.typeCriticite} onChange={(e) => setPlanFilters({ ...planFilters, typeCriticite: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-purple-50">
                <option value="Brute">Brute</option>
                <option value="Nette">Nette</option>
              </select>
            </div>
            <div className="flex-1 min-w-[80px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Recherche</label>
              <input type="text" value={planFilters.recherche || ''} onChange={(e) => setPlanFilters({ ...planFilters, recherche: e.target.value })} placeholder="Code, libellé..." className="w-full px-2 py-1 rounded border border-gray-200 text-xs"/>
            </div>
            <button onClick={() => setPlanFilters({ categorie: '', structure: '', processus: '', criticite: '', typeCriticite: 'Nette', recherche: '' })} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser">
              <RotateCcw size={14}/>
            </button>
          </div>
        </div>

        {/* Cadre 2: Filtres période */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[90px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Année</label>
              <select value={periodePlan.annee} onChange={(e) => setPeriodePlan({ annee: e.target.value, semestre: '', trimestre: '', mois: '' })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="">--</option>
                {availableYearsPlan.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Semestre</label>
              <select value={periodePlan.semestre} onChange={(e) => setPeriodePlan({ ...periodePlan, semestre: e.target.value, trimestre: '', mois: '' })} disabled={!periodePlan.annee || availableSemestresPlan.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableSemestresPlan.map(s => <option key={s} value={`Semestre ${s}`}>Semestre {s}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Trimestre</label>
              <select value={periodePlan.trimestre} onChange={(e) => setPeriodePlan({ ...periodePlan, trimestre: e.target.value, semestre: '', mois: '' })} disabled={!periodePlan.annee || availableTrimestresPlan.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableTrimestresPlan.map(t => <option key={t} value={`Trimestre ${t}`}>Trimestre {t}</option>)}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Mois</label>
              <select value={periodePlan.mois} onChange={(e) => setPeriodePlan({ ...periodePlan, mois: e.target.value, semestre: '', trimestre: '' })} disabled={!periodePlan.annee || availableMoisPlan.length === 0} className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {availableMoisPlan.map(m => <option key={m} value={moisList[m - 1]}>{moisList[m - 1]}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Bouton export + stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="secondary" icon={List} size="sm" onClick={() => { setSuiviPlanFilters({ structure: '', responsable: '', niveauAvancement: '', niveauRetard: '', dateDebut: '', dateFin: '', recherche: '' }); setShowSuiviPlanModal(true); }}>Suivi du plan</Button>
          <Button variant="primary" icon={Download} size="sm" onClick={handleExportPlan}>Export Excel</Button>
          <div className="text-xs text-gray-500">
            <span className="px-2 py-1 bg-blue-50 rounded">Total: <strong>{filteredRisques.length}</strong> risque(s)</span>
          </div>
        </div>

        {/* Tableau des risques */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: '500px' }}>
            <table className="w-full text-[10px]" style={{ minWidth: '900px' }}>
              <thead className="sticky top-0 bg-gradient-to-r from-[#1a365d] to-[#2c5282] z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-white" style={{width: '90px'}}>Code risque</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-white" style={{width: '300px'}}>Libellé risque</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-white" style={{width: '70px'}}>Statut</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-white" style={{width: '80px'}}>Code proc.</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-white" style={{width: '200px'}}>Libellé processus</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-white" style={{width: '70px'}}>Criticité</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-white" style={{width: '80px'}}>Nb actions</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-white sticky right-0 bg-[#1a365d]" style={{width: '50px'}}>Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingPlan ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
                ) : filteredRisques.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Aucun risque à afficher</td></tr>
                ) : filteredRisques.map((r, idx) => {
                  const proc = processus.find(p => p.code_processus === r.code_processus)
                  const criticite = getCriticiteForPlan(r)
                  const nbActions = getNbActionsRisque(r.code_risque)
                  return (
                    <tr key={r.id} className={`hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-2 py-1.5 font-mono font-bold text-blue-600">{r.code_risque}</td>
                      <td className="px-2 py-1.5 text-gray-700 line-clamp-2" title={r.libelle_risque}>{r.libelle_risque}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${r.statut === 'Actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.statut}</span>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-gray-600">{r.code_processus}</td>
                      <td className="px-2 py-1.5 text-gray-600 line-clamp-2" title={proc?.libelle_processus}>{proc?.libelle_processus || '-'}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getCriticiteBg(criticite)}`}>
                          {getIndexCriticite(criticite)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${nbActions > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{nbActions}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center sticky right-0 bg-inherit">
                        <button onClick={() => handleOpenPlanActions(r)} className="p-1 hover:bg-blue-100 rounded" title="Voir les actions">
                          <Eye size={14} className="text-blue-600"/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-1.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500">
            Affichage de {filteredRisques.length} risque(s)
          </div>
        </div>

        {/* Modal liste des actions du risque */}
        {showPlanActionsModal && selectedPlanRisque && (
          <Modal isOpen={showPlanActionsModal} onClose={() => setShowPlanActionsModal(false)} title={`Actions du risque ${selectedPlanRisque.code_risque}`} size="xl" closeOnClickOutside={false}>
            <div className="space-y-3">
              {/* Info risque */}
              <div className="p-2 bg-blue-50 rounded-lg text-xs">
                <strong>{selectedPlanRisque.code_risque}</strong> - {selectedPlanRisque.libelle_risque}
              </div>
              
              {/* Filtres actions sur une seule ligne */}
              <div className="bg-gray-50 rounded-lg p-2 border">
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="w-[120px]"><SearchableSelect label="Structure" value={planActionsFilters.structure} onChange={v => setPlanActionsFilters({...planActionsFilters, structure: v})} options={structureOptions} placeholder="Toutes" size="sm"/></div>
                  <div className="w-[140px]"><SearchableSelect label="Responsable" value={planActionsFilters.responsable} onChange={v => setPlanActionsFilters({...planActionsFilters, responsable: v})} options={responsableOptions} placeholder="Tous" size="sm"/></div>
                  <div className="w-[130px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niveau av.</label><select value={planActionsFilters.niveauAvancement} onChange={e => setPlanActionsFilters({...planActionsFilters, niveauAvancement: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs">{niveauAvancementOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="w-[85px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niv. ret.</label><select value={planActionsFilters.niveauRetard} onChange={e => setPlanActionsFilters({...planActionsFilters, niveauRetard: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs">{niveauRetardOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Début ≥</label><input type="date" value={planActionsFilters.dateDebut} onChange={e => setPlanActionsFilters({...planActionsFilters, dateDebut: e.target.value})} className="w-full px-1 py-1.5 rounded border text-xs"/></div>
                  <div className="w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Fin ≤</label><input type="date" value={planActionsFilters.dateFin} onChange={e => setPlanActionsFilters({...planActionsFilters, dateFin: e.target.value})} className="w-full px-1 py-1.5 rounded border text-xs"/></div>
                  <div className="flex-1 min-w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={planActionsFilters.recherche} onChange={e => setPlanActionsFilters({...planActionsFilters, recherche: e.target.value})} className="w-full px-2 py-1.5 rounded border text-xs"/></div>
                  <button onClick={() => setPlanActionsFilters({ structure: '', responsable: '', niveauAvancement: '', niveauRetard: '', dateDebut: '', dateFin: '', recherche: '' })} className="p-1.5 hover:bg-gray-200 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
                </div>
              </div>

              {/* Tableau actions */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto" style={{maxHeight:'350px'}}>
                  <table className="w-full text-[10px]" style={{minWidth:'1100px'}}>
                    <thead className="sticky top-0 bg-gradient-to-r from-[#1a365d] to-[#2c5282] z-10">
                      <tr>
                        <th className="px-2 py-2 text-left text-white min-w-[180px] whitespace-nowrap">Libellé</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Projet</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Structure</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Début</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Fin</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Tx%</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Niveau av.</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Jr ret.</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Niv. ret.</th>
                        <th className="px-2 py-2 text-center text-white whitespace-nowrap">Conf. Gest.</th>
                        <th className="px-2 py-2 text-left text-white whitespace-nowrap">Resp.</th>
                        <th className="px-2 py-2 text-center text-white sticky right-0 bg-[#1a365d] min-w-[100px] whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getFilteredPlanActionsModal().length === 0 ? (
                        <tr><td colSpan={12} className="px-4 py-6 text-center text-gray-500">Aucune action</td></tr>
                      ) : getFilteredPlanActionsModal().map((a, i) => {
                        const occ = a.occurrence || {}
                        const txAvancement = getTxAvancementPlan(occ)
                        const calc = calculateOccPlan(occ, txAvancement)
                        const hasTaches = a.taches?.length > 0
                        const confEffective = txAvancement >= 100 && occ.gestionnaire_conf === 'Oui'
                        const bgColor = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        
                        return (
                          <tr key={a.id} className={`hover:bg-blue-50/50 ${bgColor}`}>
                            <td className="px-2 py-1.5 max-w-[180px] truncate" title={a.libelle_action}>{a.libelle_action}</td>
                            <td className="px-2 py-1.5 text-center text-purple-600 font-medium whitespace-nowrap">Projet des Risques</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap">{a.code_structure || '-'}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap">{occ.date_debut ? new Date(occ.date_debut).toLocaleDateString('fr-FR') : '-'}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap">{occ.date_fin ? new Date(occ.date_fin).toLocaleDateString('fr-FR') : '-'}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] font-bold ${txAvancement >= 100 ? 'bg-green-100 text-green-800' : txAvancement > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{txAvancement}%</span>{hasTaches && <span className="ml-0.5 text-[8px] text-gray-400">(calc)</span>}</td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauAvancement === 'Achevée' ? 'bg-green-100 text-green-700' : calc.niveauAvancement.includes('Terminée') ? 'bg-blue-100 text-blue-700' : calc.niveauAvancement.includes('+50') ? 'bg-yellow-100 text-yellow-700' : calc.niveauAvancement.includes('-50') ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{calc.niveauAvancement}</span></td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] font-medium ${calc.jourRetard > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.jourRetard}j</span></td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauRetard === 'Retard' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.niveauRetard}</span></td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap">
                              {txAvancement < 100 ? (
                                <span className="text-gray-300 text-[9px]">-</span>
                              ) : confEffective ? (
                                <div className="flex items-center justify-center gap-1">
                                  <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Oui</span>
                                  {canEdit() && <button onClick={() => handlePlanToggleConf(occ, false)} className="p-0.5 hover:bg-red-100 rounded" title="Annuler"><X size={10} className="text-red-500"/></button>}
                                </div>
                              ) : canEdit() ? (
                                <button onClick={() => handlePlanToggleConf(occ, true)} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] hover:bg-blue-600">Confirmer</button>
                              ) : <span className="text-gray-300 text-[9px]">Non</span>}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap" title={occ.responsable}>{(() => { const u = users.find(x => x.username === occ.responsable); return u ? `${u.nom || ''} ${u.prenoms || u.prenom || ''}`.trim() : (occ.responsable || '-'); })()}</td>
                            <td className="px-2 py-1.5 text-center sticky right-0 bg-inherit whitespace-nowrap">
                              <div className="flex items-center justify-center gap-0.5">
                                {canEdit() && <button onClick={() => handleEditPlanAction(a)} className="p-1 hover:bg-blue-100 rounded" title="Modifier"><Edit size={12} className="text-blue-600"/></button>}
                                {canEdit() && <button onClick={() => handleOpenPlanTacheForm(occ, true, 'actions')} className="p-1 hover:bg-purple-100 rounded" title="Ajouter tâche"><Plus size={12} className="text-purple-600"/></button>}
                                <button onClick={() => handleOpenPlanTaches(a)} className="p-1 hover:bg-gray-100 rounded" title="Tâches"><List size={12} className="text-gray-600"/></button>
                                {canEdit() && <button onClick={() => handleDeletePlanAction(a, false)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bouton Créer action */}
              <div className="flex justify-between pt-2 border-t">
                {canEdit() && <Button size="sm" icon={Plus} onClick={handleOpenPlanActionForm}>Créer action</Button>}
                <Button variant="secondary" onClick={() => setShowPlanActionsModal(false)}>Fermer</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal formulaire action */}
        {showPlanActionFormModal && (
          <Modal isOpen={showPlanActionFormModal} onClose={() => setShowPlanActionFormModal(false)} title={editingPlanAction ? "Modifier l'action" : "Créer une action"} size="md" closeOnClickOutside={false} zIndex={70}>
            <div className="space-y-4">
              {/* Libellé action */}
              <div>
                <label className="block text-sm font-medium mb-1">Libellé *</label>
                <input type="text" value={planActionForm.libelle_action || ''} onChange={e => setPlanActionForm({...planActionForm, libelle_action: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={editingPlanAction && !canEdit()}/>
              </div>
              
              {/* Projet (grisé) et Structure */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Projet *</label>
                  <input type="text" value="Projet des Risques" disabled className="w-full px-3 py-2 rounded-lg border text-sm bg-gray-100 text-gray-500 cursor-not-allowed"/>
                </div>
                <SearchableSelect 
                  label="Structure *" 
                  value={planActionForm.code_structure} 
                  onChange={v => setPlanActionForm({...planActionForm, code_structure: v, occ_responsable: ''})} 
                  options={structures.map(s => ({ value: s.code_structure, label: s.libelle_structure || s.code_structure }))} 
                  placeholder="Sélectionner..." 
                  disabled={editingPlanAction && !canEdit()}
                />
              </div>
              
              {/* Commentaire */}
              <div>
                <label className="block text-sm font-medium mb-1">Commentaire</label>
                <textarea value={planActionForm.commentaire || ''} onChange={e => setPlanActionForm({...planActionForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2} disabled={editingPlanAction && !canEdit()}/>
              </div>
              
              {/* Statut */}
              <div>
                <label className="block text-sm font-medium mb-1">Statut</label>
                <select value={planActionForm.statut || 'Actif'} onChange={e => setPlanActionForm({...planActionForm, statut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" disabled={editingPlanAction && !canEdit()}>
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                </select>
              </div>
              
              {/* Section occurrence - uniquement en création ou en modification */}
              {!editingPlanAction ? (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Planification de la première occurrence</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Date début *</label>
                      <input type="date" value={planActionForm.occ_date_debut || ''} onChange={e => setPlanActionForm({...planActionForm, occ_date_debut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date fin *</label>
                      <input type="date" value={planActionForm.occ_date_fin || ''} onChange={e => setPlanActionForm({...planActionForm, occ_date_fin: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/>
                    </div>
                  </div>
                  <div className="mt-3">
                    <SearchableSelect 
                      label="Responsable * (utilisateur de la structure)" 
                      value={planActionForm.occ_responsable} 
                      onChange={v => setPlanActionForm({...planActionForm, occ_responsable: v})} 
                      options={getResponsablesForPlanAction().map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms || u.prenom} (${u.username})` }))} 
                      placeholder={!planActionForm.code_structure ? '-- Sélectionner structure --' : 'Sélectionner...'}
                      disabled={!planActionForm.code_structure}
                    />
                    {planActionForm.code_structure && getResponsablesForPlanAction().length === 0 && (
                      <p className="text-xs text-orange-600 mt-1">Aucun utilisateur actif dans cette structure.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Occurrence en cours</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Date début</label>
                      <input type="date" value={planActionForm.occ_date_debut || ''} onChange={e => setPlanActionForm({...planActionForm, occ_date_debut: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date fin</label>
                      <input type="date" value={planActionForm.occ_date_fin || ''} onChange={e => setPlanActionForm({...planActionForm, occ_date_fin: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/>
                    </div>
                  </div>
                  <div className="mt-3">
                    <SearchableSelect 
                      label="Responsable (utilisateur de la structure)" 
                      value={planActionForm.occ_responsable} 
                      onChange={v => setPlanActionForm({...planActionForm, occ_responsable: v})} 
                      options={getResponsablesForPlanAction().map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms || u.prenom} (${u.username})` }))} 
                      placeholder={!planActionForm.code_structure ? '-- Sélectionner structure --' : 'Sélectionner...'}
                      disabled={!planActionForm.code_structure}
                    />
                    {planActionForm.code_structure && getResponsablesForPlanAction().length === 0 && (
                      <p className="text-xs text-orange-600 mt-1">Aucun utilisateur actif dans cette structure.</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Taux avancement (%)</label>
                    {(() => {
                      const occ = editingPlanAction?.occurrence || {}
                      const occId = occ.code_occurrence || occ.id || planActionForm.occurrence_id
                      const hasTaches = occId ? planTaches.some(t => t.code_occurrence === occId) : false
                      if (hasTaches) {
                        return (
                          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                            {getTxAvancementPlan(occ)}% (calculé depuis les tâches)
                          </div>
                        )
                      }
                      return (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={planActionForm.tx_avancement || 0}
                          onChange={e => setPlanActionForm({...planActionForm, tx_avancement: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 rounded-lg border text-sm"
                        />
                      )
                    })()}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowPlanActionFormModal(false)}>Annuler</Button>
                <Button onClick={handleSavePlanAction}>Enregistrer</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal liste des tâches (identique à Suivi actions) */}
        {showPlanTachesModal && selectedPlanOccurrence && (
          <Modal isOpen={showPlanTachesModal} onClose={() => setShowPlanTachesModal(false)} title="Tâches de l'occurrence" size="lg" closeOnClickOutside={false} zIndex={70}>
            <div className="space-y-4">
              <div className="p-2 bg-blue-50 rounded-lg text-xs">Occurrence du {selectedPlanOccurrence?.date_debut ? new Date(selectedPlanOccurrence.date_debut).toLocaleDateString('fr-FR') : '-'} au {selectedPlanOccurrence?.date_fin ? new Date(selectedPlanOccurrence.date_fin).toLocaleDateString('fr-FR') : '-'}</div>
              {(() => {
                const occId = selectedPlanOccurrence?.code_occurrence || selectedPlanOccurrence?.id
                const occTaches = planTaches.filter(t => t.code_occurrence === occId)
                return occTaches.length === 0 ? (
                  <p className="text-center text-gray-500 py-6 text-xs">Aucune tâche</p>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]"><tr><th className="px-2 py-2 text-left text-white">Libellé</th><th className="px-2 py-2 text-center text-white">Début</th><th className="px-2 py-2 text-center text-white">Fin</th><th className="px-2 py-2 text-center text-white">Tx%</th><th className="px-2 py-2 text-left text-white">Resp.</th><th className="px-2 py-2 text-right text-white">Act.</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {occTaches.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5">{t.libelle_tache}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">{t.date_debut ? new Date(t.date_debut).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">{t.date_fin ? new Date(t.date_fin).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">{t.tx_avancement || 0}%</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{(() => { const u = users.find(x => x.username === t.responsable); return u ? `${u.nom || ''} ${u.prenoms || u.prenom || ''}`.trim() : (t.responsable || '-'); })()}</td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              {canEdit() && <button onClick={() => handleOpenPlanTacheForm(t, false, 'taches')} className="p-1 hover:bg-blue-100 rounded" title="Modifier"><Edit size={12} className="text-blue-600"/></button>}
                              {canEdit() && <button onClick={() => handleDeletePlanTache(t)} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
              <div className="flex justify-between pt-4 border-t">
                {canEdit() && <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenPlanTacheForm(null, false, 'taches')}>Ajouter tâche</Button>}
                <Button variant="secondary" onClick={() => setShowPlanTachesModal(false)}>Fermer</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal formulaire tâche (identique à Suivi actions) */}
        {showPlanTacheFormModal && (
          <Modal isOpen={showPlanTacheFormModal} onClose={() => setShowPlanTacheFormModal(false)} title={editingPlanTache ? "Modifier la tâche" : "Ajouter une tâche"} size="md" closeOnClickOutside={false} zIndex={75}>
            <div className="space-y-4">
              <div className="p-2 bg-blue-50 rounded-lg text-xs">Occurrence du {selectedPlanOccurrence?.date_debut ? new Date(selectedPlanOccurrence.date_debut).toLocaleDateString('fr-FR') : '-'} au {selectedPlanOccurrence?.date_fin ? new Date(selectedPlanOccurrence.date_fin).toLocaleDateString('fr-FR') : '-'}</div>
              <div><label className="block text-sm font-medium mb-1">Libellé *</label><input type="text" value={planTacheForm.libelle_tache || ''} onChange={e => setPlanTacheForm({...planTacheForm, libelle_tache: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Date début *</label><input type="date" value={planTacheForm.date_debut || ''} onChange={e => setPlanTacheForm({...planTacheForm, date_debut: e.target.value})} min={selectedPlanOccurrence?.date_debut} max={selectedPlanOccurrence?.date_fin} className="w-full px-3 py-2 rounded-lg border text-sm"/></div>
                <div><label className="block text-sm font-medium mb-1">Date fin *</label><input type="date" value={planTacheForm.date_fin || ''} onChange={e => setPlanTacheForm({...planTacheForm, date_fin: e.target.value})} min={selectedPlanOccurrence?.date_debut} max={selectedPlanOccurrence?.date_fin} className="w-full px-3 py-2 rounded-lg border text-sm"/></div>
              </div>
              <SearchableSelect label="Responsable *" value={planTacheForm.responsable} onChange={v => setPlanTacheForm({...planTacheForm, responsable: v})} options={users.filter(u => u.statut === 'Actif').map(u => ({ value: u.username, label: `${u.nom} ${u.prenoms || u.prenom} (${u.username})` }))} placeholder="Sélectionner..."/>
              <div><label className="block text-sm font-medium mb-1">Taux d'avancement (%)</label><input type="number" min="0" max="100" value={planTacheForm.tx_avancement || 0} onChange={e => setPlanTacheForm({...planTacheForm, tx_avancement: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border text-sm"/></div>
              <div><label className="block text-sm font-medium mb-1">Commentaire</label><textarea value={planTacheForm.commentaire || ''} onChange={e => setPlanTacheForm({...planTacheForm, commentaire: e.target.value})} className="w-full px-3 py-2 rounded-lg border text-sm" rows={2}/></div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowPlanTacheFormModal(false)}>Fermer</Button>
                <Button onClick={handleSavePlanTache}>Enregistrer</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal Suivi du plan - Vue globale de toutes les actions (plein écran) */}
        {showSuiviPlanModal && (
          <>
            {/* Overlay pour bloquer les clics en arrière-plan */}
            <div className="fixed inset-0 z-[55] bg-black/50" onClick={() => setShowSuiviPlanModal(false)}/>
            <div className="fixed inset-0 z-[60] bg-white overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] text-white px-4 py-2 flex items-center justify-between shadow-lg flex-shrink-0">
                <h2 className="text-base font-bold">Suivi du plan de maîtrise - Toutes les actions</h2>
                <button onClick={() => setShowSuiviPlanModal(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={18}/></button>
              </div>
              
              {/* Filtres sur une seule ligne */}
              <div className="px-3 py-2 bg-gray-50 border-b flex-shrink-0">
                <div className="flex gap-1.5 items-end flex-wrap">
                  <div className="w-[130px]"><SearchableSelect label="Risque" value={suiviPlanFilters.risque} onChange={v => setSuiviPlanFilters({...suiviPlanFilters, risque: v})} options={[{ value: '', label: 'Tous' }, ...risques.filter(r => r.statut === 'Actif').map(r => ({ value: r.code_risque, label: `${r.code_risque} - ${r.libelle_risque?.substring(0, 30)}...` }))]} placeholder="Tous" size="sm"/></div>
                  <div className="w-[130px]"><SearchableSelect label="Processus" value={suiviPlanFilters.processus} onChange={v => setSuiviPlanFilters({...suiviPlanFilters, processus: v})} options={[{ value: '', label: 'Tous' }, ...processus.filter(p => p.statut === 'Actif').map(p => ({ value: p.code_processus, label: p.libelle_processus }))]} placeholder="Tous" size="sm"/></div>
                  <div className="w-[110px]"><SearchableSelect label="Structure" value={suiviPlanFilters.structure} onChange={v => setSuiviPlanFilters({...suiviPlanFilters, structure: v})} options={structureOptions} placeholder="Toutes" size="sm"/></div>
                  <div className="w-[130px]"><SearchableSelect label="Responsable" value={suiviPlanFilters.responsable} onChange={v => setSuiviPlanFilters({...suiviPlanFilters, responsable: v})} options={responsableOptions} placeholder="Tous" size="sm"/></div>
                  <div className="w-[120px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niveau av.</label><select value={suiviPlanFilters.niveauAvancement} onChange={e => setSuiviPlanFilters({...suiviPlanFilters, niveauAvancement: e.target.value})} className="w-full px-1.5 py-1.5 rounded border text-xs">{niveauAvancementOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="w-[80px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Niv. ret.</label><select value={suiviPlanFilters.niveauRetard} onChange={e => setSuiviPlanFilters({...suiviPlanFilters, niveauRetard: e.target.value})} className="w-full px-1.5 py-1.5 rounded border text-xs">{niveauRetardOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                  <div className="w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Début ≥</label><input type="date" value={suiviPlanFilters.dateDebut} onChange={e => setSuiviPlanFilters({...suiviPlanFilters, dateDebut: e.target.value})} className="w-full px-1 py-1.5 rounded border text-xs"/></div>
                  <div className="w-[100px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Fin ≤</label><input type="date" value={suiviPlanFilters.dateFin} onChange={e => setSuiviPlanFilters({...suiviPlanFilters, dateFin: e.target.value})} className="w-full px-1 py-1.5 rounded border text-xs"/></div>
                  <div className="flex-1 min-w-[100px] max-w-[180px]"><label className="block text-[10px] font-medium text-gray-500 mb-1">Recherche</label><input type="text" placeholder="..." value={suiviPlanFilters.recherche} onChange={e => setSuiviPlanFilters({...suiviPlanFilters, recherche: e.target.value})} className="w-full px-1.5 py-1.5 rounded border text-xs"/></div>
                  <button onClick={() => setSuiviPlanFilters({ structure: '', responsable: '', niveauAvancement: '', niveauRetard: '', dateDebut: '', dateFin: '', recherche: '', risque: '', processus: '' })} className="p-1.5 hover:bg-gray-200 rounded border" title="Réinitialiser"><RotateCcw size={14} className="text-gray-600"/></button>
                </div>
              </div>

              {/* Statistiques + Export */}
              <div className="px-3 py-2 bg-white border-b flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  <Button variant="secondary" icon={Download} size="sm" onClick={handleExportSuiviPlan}>Export Excel</Button>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">Actions planifiées : <strong>{getSuiviPlanStats().total}</strong></span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Actions achevées : <strong>{getSuiviPlanStats().achevees}</strong></span>
                  <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded">Actions terminées att. conf. : <strong>{getSuiviPlanStats().terminees}</strong></span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Actions en cours ≥50% : <strong>{getSuiviPlanStats().enCours50Plus}</strong></span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">Actions en cours &lt;50% : <strong>{getSuiviPlanStats().enCours50Moins}</strong></span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">Actions non entamées : <strong>{getSuiviPlanStats().nonEntamees}</strong></span>
                </div>
              </div>

              {/* Tableau plein écran */}
              <div className="flex-1 overflow-auto px-3 pb-3">
                <table className="w-full text-[10px] border-collapse" style={{minWidth:'1500px'}}>
                  <thead className="sticky top-0 bg-gradient-to-r from-[#1a365d] to-[#2c5282]" style={{zIndex: 15}}>
                    <tr>
                      <th className="px-2 py-2 text-left text-white whitespace-nowrap">Code risque</th>
                      <th className="px-2 py-2 text-left text-white whitespace-nowrap min-w-[180px]">Libellé risque</th>
                      <th className="px-2 py-2 text-left text-white whitespace-nowrap min-w-[160px]">Libellé action</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Projet</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Structure</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Début</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Fin</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Tx%</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Niveau av.</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Jr ret.</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Niv. ret.</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap">Conf. Gest.</th>
                      <th className="px-2 py-2 text-left text-white whitespace-nowrap">Resp.</th>
                      <th className="px-2 py-2 text-center text-white whitespace-nowrap sticky right-0 bg-[#1a365d] min-w-[90px]" style={{zIndex: 16}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getFilteredSuiviPlanActions().length === 0 ? (
                      <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-500">Aucune action</td></tr>
                    ) : getFilteredSuiviPlanActions().map((a, i) => {
                      const occ = a.occurrence || {}
                      const txAvancement = getTxAvancementPlan(occ)
                      const calc = calculateOccPlan(occ, txAvancement)
                      const hasTaches = a.taches?.length > 0
                      const confEffective = txAvancement >= 100 && occ.gestionnaire_conf === 'Oui'
                      const bgColor = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      const respUser = users.find(u => u.username === occ.responsable)
                      
                      return (
                        <tr key={a.id} className={`hover:bg-blue-50/50 ${bgColor}`}>
                          <td className="px-2 py-1.5 font-mono text-blue-600 font-medium whitespace-nowrap">{a.code_risque || '-'}</td>
                          <td className="px-2 py-1.5 max-w-[180px] truncate" title={a.risque?.libelle_risque}>{a.risque?.libelle_risque || '-'}</td>
                          <td className="px-2 py-1.5 max-w-[160px] truncate" title={a.libelle_action}>{a.libelle_action}</td>
                          <td className="px-2 py-1.5 text-center text-purple-600 font-medium whitespace-nowrap">Projet des Risques</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">{a.code_structure || '-'}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">{occ.date_debut ? new Date(occ.date_debut).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">{occ.date_fin ? new Date(occ.date_fin).toLocaleDateString('fr-FR') : '-'}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] font-bold ${txAvancement >= 100 ? 'bg-green-100 text-green-800' : txAvancement > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{txAvancement}%</span>{hasTaches && <span className="ml-0.5 text-[8px] text-gray-400">(calc)</span>}</td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauAvancement === 'Achevée' ? 'bg-green-100 text-green-700' : calc.niveauAvancement.includes('Terminée') ? 'bg-blue-100 text-blue-700' : calc.niveauAvancement.includes('+50') ? 'bg-yellow-100 text-yellow-700' : calc.niveauAvancement.includes('-50') ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{calc.niveauAvancement}</span></td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] font-medium ${calc.jourRetard > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.jourRetard}j</span></td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className={`px-1 py-0.5 rounded text-[9px] ${calc.niveauRetard === 'Retard' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{calc.niveauRetard}</span></td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">
                            {txAvancement < 100 ? (
                              <span className="text-gray-300 text-[9px]">-</span>
                            ) : confEffective ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Oui</span>
                                {canEdit() && <button onClick={() => handlePlanToggleConf(occ, false)} className="p-0.5 hover:bg-red-100 rounded" title="Annuler"><X size={10} className="text-red-500"/></button>}
                              </div>
                            ) : canEdit() ? (
                              <button onClick={() => handlePlanToggleConf(occ, true)} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] hover:bg-blue-600">Confirmer</button>
                            ) : <span className="text-gray-300 text-[9px]">Non</span>}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap" title={occ.responsable}>{respUser ? `${respUser.nom || ''} ${respUser.prenoms || respUser.prenom || ''}`.trim() : (occ.responsable || '-')}</td>
                          <td className={`px-2 py-1.5 text-center whitespace-nowrap sticky right-0 ${bgColor}`} style={{zIndex: 5}}>
                            <div className="flex items-center justify-center gap-0.5">
                              {canEdit() && <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedPlanRisque(a.risque); handleEditPlanAction(a); }} className="p-1 hover:bg-blue-100 rounded" title="Modifier"><Edit size={12} className="text-blue-600"/></button>}
                              {canEdit() && <button type="button" onClick={(e) => { e.stopPropagation(); handleOpenPlanTacheForm(occ, true, 'suivi'); }} className="p-1 hover:bg-purple-100 rounded" title="Ajouter tâche"><Plus size={12} className="text-purple-600"/></button>}
                              <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedPlanOccurrence(occ); setReturnContext('suivi'); setShowPlanTachesModal(true); }} className="p-1 hover:bg-gray-100 rounded" title="Tâches"><List size={12} className="text-gray-600"/></button>
                              {canEdit() && <button type="button" onClick={(e) => { e.stopPropagation(); handleDeletePlanAction(a, true); }} className="p-1 hover:bg-red-100 rounded" title="Supprimer"><Trash2 size={12} className="text-red-600"/></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }
  // ============================================
  // SECTION SYNTHÈSE DES RISQUES
  // ============================================
  const [syntheseFilters, setSyntheseFilters] = useState({
    categorie: '', structure: '', qualitatif: '', processus: '', recherche: ''
  })
  const [synthesePeriode, setSynthesePeriode] = useState({ annee: '', semestre: '', trimestre: '', mois: '' })
  // Filtre "Type crit." (Brute/Nette) pour le bloc "Statistiques sur les caractéristiques des risques"
  // (mêmes modalités que le filtre "Type crit." de la sous-rubrique Évaluation)
  const [syntheseTypeCriticite, setSyntheseTypeCriticite] = useState('Nette')
  const [synthesePlanPeriode, setSynthesePlanPeriode] = useState({ dateDebut: '', dateFin: '' })

  // Définir par défaut la période du bloc "Statistiques sur les caractéristiques des risques"
  // -> période ouverte si existante, sinon période avec date de fin la plus récente
  useEffect(() => {
    const hasSelection = !!(synthesePeriode.annee || synthesePeriode.semestre || synthesePeriode.trimestre || synthesePeriode.mois)
    if (hasSelection) return

    // 1) Période ouverte
    if (periodeOuverte && periodeOuverte.annee) {
      setSynthesePeriode({
        annee: periodeOuverte.annee?.toString() || '',
        // Une seule valeur selon la hiérarchie : Mois > Trimestre > Semestre > Année
        semestre: (!periodeOuverte.mois && !periodeOuverte.trimestre && periodeOuverte.semestre) ? `Semestre ${periodeOuverte.semestre}` : '',
        trimestre: (!periodeOuverte.mois && periodeOuverte.trimestre) ? `Trimestre ${periodeOuverte.trimestre}` : '',
        mois: periodeOuverte.mois ? moisList[periodeOuverte.mois - 1] : ''
      })
      return
    }

    // 2) Période la plus récente (date_fin max)
    if (allPeriodes && allPeriodes.length > 0) {
      const toDate = (p) => {
        const raw = p.date_fin || p.dateFin || p.date_fin_periode || p.date_fin_initiale
        const d = raw ? new Date(raw) : null
        if (d && !isNaN(d.getTime())) return d
        // Fallback: construire une date approximative à partir des champs
        const year = Number(p.annee || 0)
        const month = Number(p.mois || 12)
        const trimestre = Number(p.trimestre || 0)
        const semestre = Number(p.semestre || 0)
        const m = month || (trimestre ? trimestre * 3 : (semestre ? semestre * 6 : 12))
        return new Date(year || 2000, Math.min(Math.max(m, 1), 12) - 1, 28)
      }

      const sorted = [...allPeriodes].sort((a, b) => toDate(b) - toDate(a))
      const pr = sorted[0]
      if (pr && pr.annee) {
        setSynthesePeriode({
          annee: pr.annee?.toString() || '',
          // Une seule valeur selon la hiérarchie : Mois > Trimestre > Semestre > Année
          semestre: (!pr.mois && !pr.trimestre && pr.semestre) ? `Semestre ${pr.semestre}` : '',
          trimestre: (!pr.mois && pr.trimestre) ? `Trimestre ${pr.trimestre}` : '',
          mois: pr.mois ? moisList[pr.mois - 1] : ''
        })
      }
    }
  }, [periodeOuverte, allPeriodes, synthesePeriode])
  const [showProcessusModal2, setShowProcessusModal2] = useState(false)
  const [showStructuresModal, setShowStructuresModal] = useState(false)

  // IMPORTANT (Synthèse) : le bloc "Statistiques sur les caractéristiques des risques"
  // doit être vide tant qu'aucune période n'est choisie.
  // Donc on n'initialise PAS automatiquement la période avec la période ouverte.

  // Filtrer risques pour synthèse
  const getSyntheseRisques = () => {
    return risques.filter(r => {
      if (r.statut !== 'Actif') return false
      if (syntheseFilters.categorie && !r.categories?.includes(parseInt(syntheseFilters.categorie))) return false
      if (syntheseFilters.structure && r.code_structure !== syntheseFilters.structure) return false
      if (syntheseFilters.qualitatif && r.qualitatif !== syntheseFilters.qualitatif) return false
      if (syntheseFilters.processus && r.code_processus !== syntheseFilters.processus) return false
      if (syntheseFilters.recherche) {
        const search = syntheseFilters.recherche.toLowerCase()
        if (!r.code_risque?.toLowerCase().includes(search) && !r.libelle_risque?.toLowerCase().includes(search)) return false
      }
      return true
    })
  }

  // Filtrer actions pour synthèse
  const getSyntheseActions = () => {
    return planActions.filter(a => {
      // Appliquer filtres globaux via risques liés
      // Les actions portent la structure via code_structure (principal) ; certains anciens jeux de données utilisent code_structure_resp
      if (syntheseFilters.structure && (a.code_structure || a.code_structure_resp) !== syntheseFilters.structure) return false
      if (syntheseFilters.processus && a.code_processus !== syntheseFilters.processus) return false
      // Filtre période (sur l'occurrence active de l'action - dates début/fin)
      const occ = planOccurrences.find(o => o.code_action === a.code_action) || null
      if (synthesePlanPeriode.dateDebut && occ?.date_debut && new Date(occ.date_debut) < new Date(synthesePlanPeriode.dateDebut)) return false
      if (synthesePlanPeriode.dateFin && occ?.date_fin && new Date(occ.date_fin) > new Date(synthesePlanPeriode.dateFin)) return false
      return true
    })
  }

  // Calculer criticité d'un risque
  const calculateCriticiteForSynthese = (risque) => {
    const periodeKey = getPeriodeKeySynthese()
    const probData = getRisqueProbabilite(risque, periodeKey)
    const prob = parseInt(probData?.probDisplay || '', 10)
    if (!prob || Number.isNaN(prob)) return null

    let impact = risque.impact
    let effCtrl = risque.efficacite_contr

    const periodeObj = (allPeriodes || []).find(p => String(getPeriodeKeyFromPeriode(p)) === String(periodeKey)) || null
    const isPeriodeFermee = !!(periodeObj && periodeObj.statut && String(periodeObj.statut).toLowerCase() !== 'ouvert')
    if (isPeriodeFermee) {
      const rpRow = risquesProbabilites.find(rp => rp.code_risque === risque.code_risque && samePeriodeKey(rp.periode, periodeKey)) || null
      impact = rpRow?.impact ?? null
      effCtrl = rpRow?.eff_ctrl ?? null
    }

    if (impact === null || impact === undefined || impact === '') return null
    // Conserver le mode de calcul existant de Synthèse (score)
    return Number(impact) * prob * (effCtrl ? Number(effCtrl) : 1)
  }

// Calculer le niveau de criticité (1-4) pour un risque à partir du score
  const getNiveauCriticiteNum2 = (score) => {
    if (!score) return null
    if (score <= 3) return 1 // Faible
    if (score <= 6) return 2 // Modéré
    if (score <= 9) return 3 // Significatif
    return 4 // Critique (12-16)
  }

  // Calculer la criticité nette d'un risque pour une période donnée
  const calculateCriticiteNetteForPeriode = (risque, periode) => {
    if (!risque.impact || !risque.efficacite_contr) return null

    // Construire une clé période cohérente (même format que Cartographie/Evaluation)
    const periodeKey = (() => {
      if (!periode?.annee) return ''
      if (periode.mois) return `${periode.mois}-${periode.annee}`
      if (periode.trimestre) {
        const tNum = periode.trimestre.replace('Trimestre ', 'T')
        return `${tNum}-${periode.annee}`
      }
      if (periode.semestre) {
        const sNum = periode.semestre.replace('Semestre ', 'S')
        return `${sNum}-${periode.annee}`
      }
      return periode.annee
    })()

    const probData = getRisqueProbabilite(risque, periodeKey)
    const prob = probData?.probabilite
    if (!prob) return null
    return risque.impact * parseInt(prob) * risque.efficacite_contr
  }

  // Clé période pour la Synthèse (même logique que Cartographie)
  const getPeriodeKeySynthese = () => {
    if (!synthesePeriode?.annee) return ''
    if (synthesePeriode.mois) return `${synthesePeriode.mois}-${synthesePeriode.annee}`
    if (synthesePeriode.trimestre) {
      const tNum = synthesePeriode.trimestre.replace('Trimestre ', 'T')
      return `${tNum}-${synthesePeriode.annee}`
    }
    if (synthesePeriode.semestre) {
      const sNum = synthesePeriode.semestre.replace('Semestre ', 'S')
      return `${sNum}-${synthesePeriode.annee}`
    }
    return synthesePeriode.annee
  }

  // Convertit un objet période (issu de allPeriodes) en clé "Période" utilisée
  // partout (ex : "2024", "S1-2025", "T3-2024", "01-2026").
  const getPeriodeKeyFromPeriode = (p) => {
    if (!p) return ''
    const annee = p.annee?.toString() || ''

    if (annee && p.semestre) {
      const n = parseInt(String(p.semestre).replace(/\D/g, ''), 10)
      return `S${isNaN(n) ? p.semestre : n}-${annee}`
    }
    if (annee && p.trimestre) {
      const n = parseInt(String(p.trimestre).replace(/\D/g, ''), 10)
      return `T${isNaN(n) ? p.trimestre : n}-${annee}`
    }
    if (annee && p.mois) {
      const n = parseInt(String(p.mois).replace(/\D/g, ''), 10)
      const mm = (isNaN(n) ? String(p.mois) : String(n)).padStart(2, '0')
      return `${mm}-${annee}`
    }
    if (annee) return annee
    return p.libelle || ''
  }

  // Déterminer la dernière période de comparaison (avant la période filtre) en fonction
  // de "Période d'appréciation de l'atténuation des risques" (Gestion).
  const getPreviousPeriodeForAttenuation = () => {
    const selected = findSelectedPeriodeFromForm(synthesePeriode)
    if (!selected) return null
    const selectedStart = getPeriodeDateDebut(selected)
    const type = attenuationAppreciationType || 'Année'
    
    // Chercher une période du type spécifié, indépendamment du type de la période filtre
    const matchesType = (p) => {
      if (type === 'Mois') return !!p?.mois && !p?.trimestre && !p?.semestre
      if (type === 'Trimestre') return !!p?.trimestre && !p?.semestre && !p?.mois
      if (type === 'Semestre') return !!p?.semestre && !p?.trimestre && !p?.mois
      // Année : doit être une période annuelle (pas de semestre/trimestre/mois)
      return !!p?.annee && !p?.semestre && !p?.trimestre && !p?.mois
    }
    
    const candidates = (allPeriodes || [])
      .filter(p => matchesType(p) && getPeriodeDateDebut(p) < selectedStart)
      .sort((a, b) => getPeriodeDateDebut(b) - getPeriodeDateDebut(a))
    return candidates[0] || null
  }

  // Stats caractéristiques risques avec période
  const getRisquesStats = () => {
    const filtered = getSyntheseRisques()
    const actifs = filtered.length

    // IMPORTANT : la Synthèse doit être cohérente avec Analyse / Évaluation / Cartographie.
    // Un risque est "évalué" si Impact + Efficacité contrôle sont renseignés
    // ET si une probabilité existe pour la période (calculée via indicateur OU saisie manuelle via risques_probabilites).
    // Période strictement issue du filtre (aucun fallback).
    const periodeKey = getPeriodeKeySynthese()

    // Si aucune période n'est choisie : chiffres "-" et graphiques vides.
    if (!periodeKey) {
      return {
        hasPeriode: false,
        actifs: '-',
        evalues: '-',
        nonEvalues: '-',
        tauxSuivi: '-',
        tauxMaitrise: '-',
        tauxAttenuation: 'N/A',
        faible: '-',
        modere: '-',
        significatif: '-',
        critique: '-',
        topProcessus: [],
        allProcessus: [],
        totalEvalues: 0,
      }
    }
    const evaluesRisques = filtered.filter(r => {
      if (!periodeKey) return false
      if (!r.impact || !r.efficacite_contr) return false
      const probData = getRisqueProbabilite(r, periodeKey)
      return !!probData?.hasProb
    })

    const evalues = evaluesRisques.length
    const nonEvalues = actifs - evalues
    const tauxSuivi = actifs > 0 ? Math.round((evalues / actifs) * 100) : 0
    
    // Répartition par criticité (niveaux 1-4 basés sur score P×I)
    // Score brut = Impact × Probabilité (1-4 × 1-4 = 1-16)
    // 1-3: Faible (niveau 1), 4-6: Modéré (niveau 2), 8-9: Significatif (niveau 3), 12-16: Critique (niveau 4)
    // Score brut utilisé pour les niveaux de criticité (P×I), comme dans Cartographie.
    const getCriticiteScore = (r) => {
      if (!r.impact) return null
      if (!periodeKey) return null

      const probData = getRisqueProbabilite(r, periodeKey)
      const prob = probData?.probDisplay
      if (!prob) return null
      const p = parseInt(prob)
      if (!p) return null

      // Type criticité : Brute = Impact brut, Nette = Impact net (comme Évaluation/Cartographie)
      const useBrute = syntheseTypeCriticite === 'Brute'
      const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
      const impact = useBrute ? r.impact : impactNet
      return impact * p
    }
    
    const faible = evaluesRisques.filter(r => { const s = getCriticiteScore(r); return s && s >= 1 && s <= 3 }).length
    const modere = evaluesRisques.filter(r => { const s = getCriticiteScore(r); return s && s >= 4 && s <= 6 }).length
    const significatif = evaluesRisques.filter(r => { const s = getCriticiteScore(r); return s && s >= 8 && s <= 9 }).length
    const critique = evaluesRisques.filter(r => { const s = getCriticiteScore(r); return s && s >= 12 && s <= 16 }).length
    
    // Taux de maîtrise = risques niveau 1 / risques évalués
    const tauxMaitrise = evalues > 0 ? Math.round((faible / evalues) * 100) : 0

    // Top processus critiques (score 8-16 = significatif + critique)
    const processusCritiques = {}
    evaluesRisques.forEach(r => {
      const score = getCriticiteScore(r)
      const procCode = r.code_processus || 'N/A'
      if (!processusCritiques[procCode]) {
        processusCritiques[procCode] = { critiques: 0, total: 0, libelle: r.processus?.libelle_processus || procCode }
      }
      processusCritiques[procCode].total++
      if (score && score >= 8 && score <= 16) processusCritiques[procCode].critiques++
    })
    // TOP 4 : classer par pourcentage (critiques / total), puis par volume critiques
    const topProcessus = Object.entries(processusCritiques)
      .filter(([code, data]) => data.critiques > 0 && data.total > 0)
      .sort((a, b) => {
        const pctA = a[1].total > 0 ? (a[1].critiques / a[1].total) : 0
        const pctB = b[1].total > 0 ? (b[1].critiques / b[1].total) : 0
        if (pctB !== pctA) return pctB - pctA
        return b[1].critiques - a[1].critiques
      })
      .slice(0, 4)
      .map(([code, data]) => ({ code, ...data }))

    // Calcul du taux d'atténuation moyen - IDENTIQUE AU TABLEAU DE BORD
    const computeTauxAttenuationMoyen = () => {
      console.log('[SYNTHESE-Atténuation] Début calcul', {
        periodeKey,
        evalues,
        filteredLength: filtered.length,
        attenuationAppreciationType,
        synthesePeriode
      })
      
      // Si aucune période sélectionnée ou aucun risque évalué => N/A
      if (!periodeKey || evalues === 0) {
        console.log('[SYNTHESE-Atténuation] N/A - Pas de période ou pas de risques évalués')
        return 'N/A'
      }

      const prevPeriode = getPreviousPeriodeForAttenuation()
      console.log('[SYNTHESE-Atténuation] Période de comparaison:', prevPeriode)
      
      if (!prevPeriode) {
        console.log('[SYNTHESE-Atténuation] N/A - Pas de période de comparaison trouvée')
        return 'N/A'
      }

      // Construire la clé de la période de comparaison - MÊME LOGIQUE QUE TABLEAU DE BORD
      const prevKey = (() => {
        if (!prevPeriode?.annee) return ''
        if (prevPeriode.mois) {
          const moisNum = typeof prevPeriode.mois === 'number' ? prevPeriode.mois : parseInt(prevPeriode.mois, 10)
          return `${moisList[moisNum - 1]}-${prevPeriode.annee}`
        }
        if (prevPeriode.trimestre) return `T${prevPeriode.trimestre}-${prevPeriode.annee}`
        if (prevPeriode.semestre) return `S${prevPeriode.semestre}-${prevPeriode.annee}`
        return `${prevPeriode.annee}`
      })()
      
      console.log('[SYNTHESE-Atténuation] Clé période comparaison:', prevKey)
      
      if (!prevKey) {
        console.log('[SYNTHESE-Atténuation] N/A - Clé de période vide')
        return 'N/A'
      }

      let prevEvaluatedCount = 0
      const tauxValues = []

      // Fonction utilitaire pour extraire la valeur numérique - IDENTIQUE AU TABLEAU DE BORD
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

      console.log('[SYNTHESE-Atténuation] Début boucle sur', filtered.length, 'risques')

      // Parcourir tous les risques filtrés (pas seulement evaluesRisques)
      filtered.forEach((r, index) => {
        const impactBrut = extractNumber(r.impact)
        const eff = extractNumber(r.efficacite_contr)
        const impactNet = calculateImpactNet(impactBrut, eff)
        
        if (Number.isNaN(impactNet)) return

        // Probabilités pour les deux périodes
        const probPrevData = getRisqueProbabilite(r, prevKey)
        const probCurData = getRisqueProbabilite(r, periodeKey)

        if (index < 3) {
          console.log(`[SYNTHESE-Atténuation] Risque ${r.code_risque}:`, {
            probPrev: probPrevData,
            probCur: probCurData,
            impactBrut,
            eff,
            impactNet
          })
        }

        // Compter les risques évalués en période de comparaison
        if (probPrevData.hasProb) prevEvaluatedCount += 1

        // Les deux périodes doivent avoir une probabilité pour calculer l'atténuation
        if (!probPrevData.hasProb || !probCurData.hasProb) return
        
        const probPrev = parseInt(probPrevData.probDisplay, 10)
        const probCur = parseInt(probCurData.probDisplay, 10)

        if (Number.isNaN(probPrev) || Number.isNaN(probCur)) return

        // Calculer les criticités
        const critPrev = impactNet * probPrev
        const critCur = impactNet * probCur
        
        // Convertir en niveaux - IDENTIQUE AU TABLEAU DE BORD
        const getNiveau = (score) => {
          if (score <= 3) return 1
          if (score <= 7) return 2
          if (score <= 11) return 3
          return 4
        }
        
        const nivPrev = getNiveau(critPrev)
        const nivCur = getNiveau(critCur)

        if (!nivPrev || !nivCur) return

        // Matrice de taux d'atténuation - IDENTIQUE AU TABLEAU DE BORD
        const matrice = {
          '1-1': 100, '1-2': -50, '1-3': -75, '1-4': -100,
          '2-1': 100, '2-2': 0, '2-3': -50, '2-4': -100,
          '3-1': 100, '3-2': 50, '3-3': 0, '3-4': -100,
          '4-1': 100, '4-2': 75, '4-3': 50, '4-4': -100
        }
        
        const taux = matrice[`${nivPrev}-${nivCur}`]
        if (taux !== null && taux !== undefined) {
          tauxValues.push(taux)
        }
      })

      console.log('[SYNTHESE-Atténuation] Résultats:', {
        prevEvaluatedCount,
        tauxValuesCount: tauxValues.length,
        tauxValues
      })

      // Si aucun risque évalué en période de comparaison => N/A
      if (prevEvaluatedCount === 0) {
        console.log('[SYNTHESE-Atténuation] N/A - Aucun risque évalué en période de comparaison')
        return 'N/A'
      }
      if (tauxValues.length === 0) {
        console.log('[SYNTHESE-Atténuation] N/A - Aucun taux calculable')
        return 'N/A'
      }

      const avg = Math.round(tauxValues.reduce((a, b) => a + b, 0) / tauxValues.length)
      console.log('[SYNTHESE-Atténuation] Moyenne calculée:', avg)
      return `${avg}%`
    }
    
    const tauxAttenuation = computeTauxAttenuationMoyen()

    return { 
      hasPeriode: true,
      actifs, evalues, nonEvalues, tauxSuivi, tauxMaitrise, tauxAttenuation,
      faible, modere, significatif, critique, 
      topProcessus, totalEvalues: evalues, 
      // En plein écran : afficher l'ensemble des processus (même ceux sans risques critiques)
      allProcessus: Object.entries(processusCritiques)
        .map(([code, data]) => ({ code, ...data }))
        .sort((a, b) => {
          const pctA = a.total > 0 ? (a.critiques / a.total) : 0
          const pctB = b.total > 0 ? (b.critiques / b.total) : 0
          if (pctB !== pctA) return pctB - pctA
          return b.critiques - a.critiques
        }) 
    }
  }

  // Stats plan maîtrise (Synthèse)
  // IMPORTANT : les KPIs et graphiques doivent être calculés sur les OCCURRENCES actives / non archivées
  // (même principe que le tableau "Suivi du plan"), puis enrichies via l'action correspondante.
  // Source : actions liées aux risques (code_risque) + occurrences (action_occurrences) + tâches.
  const getPlanStats2 = () => {
    // 1) Isoler le bon périmètre : actions du "Projet des Risques" (si le groupe existe), et uniquement les actions liées à un risque.
    const projetRisquesId = getProjetDesRisquesId()
    const actionsProjet = (planActions || [])
      .filter(a => !!a?.code_risque)
      .filter(a => {
        // Si le projet existe, on restreint strictement au projet des risques
        if (projetRisquesId && a?.code_groupe && a.code_groupe !== projetRisquesId) return false
        // Statut action
        const statut = (a?.statut_act ?? a?.statut ?? '').toString().trim()
        if (statut && statut !== 'Actif') return false
        return true
      })

    // Index actions par code_action + enrichissement risque (pour filtres processus/catégorie)
    const actionByCode = {}
    actionsProjet.forEach(a => {
      const r = risques.find(rr => rr.code_risque === a.code_risque)
      actionByCode[a.code_action] = { ...a, risque: r || null }
    })

    // 2) Occurrences du périmètre (actives, non archivées, planifiées)
    const toDateOnly = (d) => {
      if (!d) return null
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) return null
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
    }

    const fDeb = synthesePlanPeriode.dateDebut ? toDateOnly(synthesePlanPeriode.dateDebut) : null
    const fFin = synthesePlanPeriode.dateFin ? toDateOnly(synthesePlanPeriode.dateFin) : null

    let occurrencesProjet = (planOccurrences || [])
      .filter(o => {
        const codeAction = o?.code_action || o?.code_action_occ || o?.__actionCode
        return !!(codeAction && actionByCode[codeAction])
      })
      // IMPORTANT : ne pas filtrer sur action_occurrences.statut (ce champ peut contenir des valeurs métier).
      // On garde uniquement le périmètre des ACTIONS actives (filtré plus haut) et on exclut les occurrences archivées.
      .filter(o => {
        const a = o?.archive
        if (a === true) return false
        if (typeof a === 'string' && a.trim().toLowerCase() === 'oui') return false
        if (typeof a === 'number' && a === 1) return false
        return true
      })
      // Occurrence planifiée (dates obligatoires)
      .filter(o => !!(o?.date_debut && o?.date_fin))
      // Filtre période (dates) sur les dates de l'occurrence
      .filter(o => {
        const dDeb = toDateOnly(o?.date_debut)
        const dFin = toDateOnly(o?.date_fin)
        if (fDeb) {
          if (!dDeb) return false
          if (dDeb < fDeb) return false
        }
        if (fFin) {
          if (!dFin) return false
          if (dFin > fFin) return false
        }
        return true
      })

    // 3) Filtres globaux (catégorie/structure/processus) appliqués via action + risque
    occurrencesProjet = occurrencesProjet.filter(o => {
      const codeAction = o?.code_action || o?.code_action_occ || o?.__actionCode
      const a = actionByCode[codeAction]
      if (!a) return false

      if (syntheseFilters.categorie) {
        const cat = parseInt(syntheseFilters.categorie, 10)
        const cats = a?.risque?.categories || []
        if (!cats.includes(cat)) return false
      }
      if (syntheseFilters.structure) {
        // NB: dans l'appli, "structure" = structure de l'action (porteur) et non structure du responsable de réalisation.
        if ((a?.code_structure || '') !== syntheseFilters.structure) return false
      }
      if (syntheseFilters.processus) {
        if ((a?.risque?.code_processus || '') !== syntheseFilters.processus) return false
      }
      return true
    })

    const total = occurrencesProjet.length

    // === RÈGLES VALIDÉES (utiliser les champs de action_occurrences) ===
    // - tx_avancement : champ de action_occurrences (pas la moyenne des tâches)
    // - retard : champ de action_occurrences (pas un recalcul via dates)
    const parseNum = (x) => {
      if (x === null || x === undefined) return 0
      if (typeof x === 'number') return Number.isFinite(x) ? x : 0
      // Supporte des formats comme "50%", "5j", "5 jours", "1,5"...
      const s = x.toString().trim().replace('%', '').replace(',', '.')
      const m = s.match(/-?\d+(?:\.\d+)?/)
      if (!m) return 0
      const n = Number(m[0])
      return Number.isFinite(n) ? n : 0
    }

    const getTxOcc = (occ) => parseNum(occ?.tx_avancement)
    const getRetardOcc = (occ) => parseNum(occ?.retard)

    // Retard (jours) : champ action_occurrences.retard
    // (selon ta règle, un retard est strictement > 0)

    const getConf = (occ) => {
      const v = (occ?.gestionnaire_conf ?? '').toString().trim().toLowerCase()
      if (v === 'oui') return 'Oui'
      return 'Non'
    }

    const realisees = occurrencesProjet.filter(o => getTxOcc(o) >= 100).length
    const nonRealisees = occurrencesProjet.filter(o => getTxOcc(o) < 100).length
    const tauxRealisation = total > 0 ? Math.round((realisees / total) * 100) : 0

    // En retard : tx_avancement < 100 ET retard > 0
    const occurrencesEnRetard = occurrencesProjet.filter(o => getTxOcc(o) < 100 && getRetardOcc(o) > 0)
    const enRetard = occurrencesEnRetard.length

    // Retard moyen : moyenne du champ action_occurrences.retard sur les actions actives du groupe des risques
    const retardMoyen = total > 0
      ? Math.round(occurrencesProjet.reduce((s, o) => s + getRetardOcc(o), 0) / total)
      : 0

    const nivRepart = {
      'Achevée': occurrencesProjet.filter(o => getTxOcc(o) >= 100 && getConf(o) === 'Oui').length,
      'Terminée - non confirmée': occurrencesProjet.filter(o => getTxOcc(o) >= 100 && getConf(o) === 'Non').length,
      'En cours +50%': occurrencesProjet.filter(o => getTxOcc(o) >= 50 && getTxOcc(o) < 100).length,
      'En cours -50%': occurrencesProjet.filter(o => getTxOcc(o) > 0 && getTxOcc(o) < 50).length,
      'Non entamée': occurrencesProjet.filter(o => getTxOcc(o) === 0).length
    }

    // Top structures en retard : occurrences tx<100 et retard>0 groupées par structure
    const structuresAgg = {}
    occurrencesProjet.forEach(o => {
      const codeAction = o?.code_action || o?.code_action_occ || o?.__actionCode
      const a = actionByCode[codeAction]
      const code = o?.code_structure_resp || a?.code_structure_resp || a?.code_structure || 'N/A'
      const libelleFromRef = (structures || []).find(ss => ss.code_structure === code)?.libelle_structure
      const libelle = libelleFromRef || o?.libelle_structure_resp || a?.libelle_structure_resp || a?.libelle_structure || code

      if (!structuresAgg[code]) structuresAgg[code] = { code, libelle, retard: 0 }
      if (getTxOcc(o) < 100 && getRetardOcc(o) > 0) structuresAgg[code].retard++
    })

    const allStructures = Object.values(structuresAgg)
      .filter(s => (s.retard || 0) > 0)
      .sort((a, b) => (b.retard || 0) - (a.retard || 0))

    const topStructures = allStructures.slice(0, 5)
    const totalRetards = allStructures.reduce((s, x) => s + (x.retard || 0), 0)

    return {
      total,
      realisees,
      nonRealisees,
      tauxRealisation,
      enRetard,
      retardMoyen,

      parAvancement: [
        { label: 'Achevée', value: nivRepart['Achevée'] || 0 },
        { label: 'Terminée - non confirmée', value: nivRepart['Terminée - non confirmée'] || 0 },
        { label: 'En cours +50%', value: nivRepart['En cours +50%'] || 0 },
        { label: 'En cours -50%', value: nivRepart['En cours -50%'] || 0 },
        { label: 'Non entamée', value: nivRepart['Non entamée'] || 0 }
      ],

      // Top / liste complète des structures avec retard
      topRetardStructures: (topStructures || []).map(s => ({ code: s.code, libelle: s.libelle, value: s.retard || 0 })),
      allRetardStructures: (allStructures || []).map(s => ({ code: s.code, libelle: s.libelle, value: s.retard || 0 })),

      totalRetards,
      nivRepart,
      topStructures,
      allStructures
    }
  }



  const renderSynthese = () => {
    const risquesStats = getRisquesStats()
    const planStats2 = getPlanStats2()
    const hasPeriodeSynthese = !!risquesStats?.hasPeriode
    // Pour les graphiques, les barres doivent représenter une proportion sur le total des risques évalués
    const totalEvaluesForBars = hasPeriodeSynthese ? Math.max(risquesStats.totalEvalues || 0, 0) : 0
    const maxNiv = Math.max(...Object.values(planStats2.nivRepart || {}), 1)

    // KPI : Taux d'atténuation (moyenne) entre la période filtre et la dernière période de comparaison
    const computeTauxAttenuationMoyen = () => {
      // Règles :
      // - si aucun risque évalué à la période filtre => N/A
      // - si aucune période précédente correspondante => N/A
      // - si à la période de comparaison il n'y a aucun risque évalué => N/A
      // - sinon : moyenne des taux d'atténuation calculés risque par risque (même logique que Cartographie)
      if (!hasPeriodeSynthese) return '-'
      if ((risquesStats?.evalues || 0) === 0) return 'N/A'

      const prevPeriode = getPreviousPeriodeForAttenuation()
      if (!prevPeriode) return 'N/A'

      // Construire les clés période (mêmes formats que Cartographie)
      const currentKey = getPeriodeKeySynthese()
      const prevKey = (() => {
        if (!prevPeriode?.annee) return ''
        if (prevPeriode.mois) return `${moisList[prevPeriode.mois - 1]}-${prevPeriode.annee}`
        if (prevPeriode.trimestre) return `T${prevPeriode.trimestre}-${prevPeriode.annee}`
        if (prevPeriode.semestre) return `S${prevPeriode.semestre}-${prevPeriode.annee}`
        return `${prevPeriode.annee}`
      })()
      if (!prevKey || !currentKey) return 'N/A'

      const useBrute = (syntheseFilters?.typeCriticite || 'Nette') === 'Brute'
      const risks = getSyntheseRisques()

      let prevEvaluatedCount = 0
      const tauxValues = []

      for (const r of risks) {
        // Impact selon le type (brut ou net) - même logique que Cartographie
        const impactBrut = r.impact
        const impactNet = calculateImpactNet(r.impact, r.efficacite_contr)
        const impactDisplay = useBrute ? impactBrut : impactNet
        if (!impactDisplay) continue

        const probPrevData = getRisqueProbabilite(r, prevKey)
        const probCurData = getRisqueProbabilite(r, currentKey)
        const probPrev = probPrevData?.probDisplay || ''
        const probCur = probCurData?.probDisplay || ''

        // compter risques évalués en période de comparaison
        if (probPrevData?.hasProb) prevEvaluatedCount += 1

        if (!probPrev || !probCur) continue
        const critPrev = impactDisplay * parseInt(probPrev, 10)
        const critCur = impactDisplay * parseInt(probCur, 10)
        const nivPrev = getNiveauCriticiteNum(critPrev)
        const nivCur = getNiveauCriticiteNum(critCur)
        if (!nivPrev || !nivCur) continue
        const taux = calculateTauxAttenuation(nivPrev, nivCur)
        if (taux === null || taux === undefined) continue
        tauxValues.push(taux)
      }

      if (prevEvaluatedCount === 0) return 'N/A'
      if (tauxValues.length === 0) return 'N/A'
      const avg = Math.round(tauxValues.reduce((a, b) => a + b, 0) / tauxValues.length)
      return `${avg}%`
    }

    const tauxAttenuationMoyen = computeTauxAttenuationMoyen()

    return (
      <div className="space-y-6">
        {/* Filtres globaux - même style que Plan de maîtrise */}
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
          <div className="flex items-end gap-2">
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Catégorie" size="sm" value={syntheseFilters.categorie || ''} onChange={(v) => setSyntheseFilters({ ...syntheseFilters, categorie: v })} options={[{ value: '', label: 'Toutes' }, ...categories.filter(c => c.statut === 'Actif').map(c => ({ value: c.code_categorie?.toString() || c.id?.toString(), label: c.libelle_categorie }))]} placeholder="Toutes"/>
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Structure" size="sm" value={syntheseFilters.structure || ''} onChange={(v) => setSyntheseFilters({ ...syntheseFilters, structure: v })} options={[{ value: '', label: 'Toutes' }, ...structures.map(s => ({ value: s.code_structure, label: s.libelle_structure }))]} placeholder="Toutes"/>
            </div>
            <div className="w-[120px] flex-shrink-0">
              <SearchableSelect label="Processus" size="sm" value={syntheseFilters.processus || ''} onChange={(v) => setSyntheseFilters({ ...syntheseFilters, processus: v })} options={[{ value: '', label: 'Tous' }, ...processus.filter(p => p.statut === 'Actif').map(p => ({ value: p.code_processus, label: p.libelle_processus }))]} placeholder="Tous"/>
            </div>
            <button onClick={() => setSyntheseFilters({ categorie: '', structure: '', qualitatif: '', processus: '', recherche: '' })} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser">
              <RotateCcw size={14} />
            </button>
          </div>
          <p className="text-[9px] text-gray-400 mt-2 italic">Ces filtres s'appliquent sur l'ensemble des statistiques des deux blocs</p>
        </div>

        {/* BLOC 1: Statistiques caractéristiques risques */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="text-blue-600" size={20} />
            Statistiques sur les caractéristiques des risques
          </h3>
          
          {/* Filtres période - même style que Plan de maîtrise */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <div className="flex items-end gap-2">
              <div className="w-[90px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Année</label>
                <select value={synthesePeriode.annee} onChange={(e) => { setSynthesePeriode({ annee: e.target.value, semestre: '', trimestre: '', mois: '' }) }} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                  <option value="">--</option>
                  {allPeriodes.map(p => p.annee).filter((v, i, a) => a.indexOf(v) === i).sort().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Semestre</label>
                <select value={synthesePeriode.semestre} onChange={(e) => setSynthesePeriode({...synthesePeriode, semestre: e.target.value, trimestre: '', mois: ''})} disabled={!synthesePeriode.annee} className={`w-full px-2 py-1 rounded border text-xs ${!synthesePeriode.annee ? 'bg-gray-100 text-gray-400' : 'border-gray-200'}`}>
                  <option value="">--</option>
                  {allPeriodes.filter(p => p.annee?.toString() === synthesePeriode.annee && p.semestre).map(p => p.semestre).filter((v, i, a) => a.indexOf(v) === i).sort().map(s => <option key={s} value={`Semestre ${s}`}>Semestre {s}</option>)}
                </select>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Trimestre</label>
                <select value={synthesePeriode.trimestre} onChange={(e) => setSynthesePeriode({...synthesePeriode, trimestre: e.target.value, semestre: '', mois: ''})} disabled={!synthesePeriode.annee} className={`w-full px-2 py-1 rounded border text-xs ${!synthesePeriode.annee ? 'bg-gray-100 text-gray-400' : 'border-gray-200'}`}>
                  <option value="">--</option>
                  {allPeriodes.filter(p => p.annee?.toString() === synthesePeriode.annee && p.trimestre).map(p => p.trimestre).filter((v, i, a) => a.indexOf(v) === i).sort().map(t => <option key={t} value={`Trimestre ${t}`}>Trimestre {t}</option>)}
                </select>
              </div>
              <div className="w-[100px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Mois</label>
                <select value={synthesePeriode.mois} onChange={(e) => setSynthesePeriode({...synthesePeriode, mois: e.target.value, semestre: '', trimestre: ''})} disabled={!synthesePeriode.annee} className={`w-full px-2 py-1 rounded border text-xs ${!synthesePeriode.annee ? 'bg-gray-100 text-gray-400' : 'border-gray-200'}`}>
                  <option value="">--</option>
                  {allPeriodes.filter(p => p.annee?.toString() === synthesePeriode.annee && p.mois).map(p => moisList[p.mois - 1]).filter((v, i, a) => a.indexOf(v) === i).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="w-[90px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Type crit.</label>
                <select value={syntheseTypeCriticite} onChange={(e) => setSyntheseTypeCriticite(e.target.value)} className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-purple-50">
                  <option value="Brute">Brute</option>
                  <option value="Nette">Nette</option>
                </select>
              </div>
              <button onClick={() => { setSynthesePeriode({ annee: '', semestre: '', trimestre: '', mois: '' }); setSyntheseTypeCriticite('Nette') }} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* KPIs risques - tous sur une ligne */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><Target className="text-blue-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-blue-700">{risquesStats.actifs}</p>
                  <p className="text-[10px] text-blue-600">Risques actifs</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-green-700">{risquesStats.evalues}</p>
                  <p className="text-[10px] text-green-600">Risques évalués</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg"><AlertTriangle className="text-orange-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-orange-700">{risquesStats.nonEvalues}</p>
                  <p className="text-[10px] text-orange-600">Non évalués</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg"><BarChart3 className="text-purple-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-purple-700">{hasPeriodeSynthese ? `${risquesStats.tauxSuivi}%` : '-'}</p>
                  <p className="text-[10px] text-purple-600">Taux de suivi</p>
                </div>
              </div>
            </div>
            <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-teal-100 rounded-lg"><Shield className="text-teal-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-teal-700">
                    {!hasPeriodeSynthese ? '-' : ((risquesStats?.evalues || 0) === 0 ? 'N/A' : `${risquesStats.tauxMaitrise}%`)}
                  </p>
                  <p className="text-[10px] text-teal-600">Taux de maîtrise</p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg"><TrendingDown className="text-emerald-600" size={16} /></div>
                <div>
                  <p className="text-xl font-bold text-emerald-700">
                    {risquesStats.tauxAttenuation || 'N/A'}
                  </p>
                  <p className="text-[10px] text-emerald-600">Atténuation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Graphiques risques */}
          <div className="grid grid-cols-2 gap-6">
            {/* Répartition par criticité */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-4">Répartition des risques évalués selon la criticité</h4>
              {!hasPeriodeSynthese ? (
                <p className="text-gray-500 text-center py-6 text-sm">Sélectionnez une période pour afficher les statistiques.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: '1-3 (Faible)', value: risquesStats.faible, color: 'bg-green-500', hoverColor: 'hover:bg-green-600' },
                    { label: '4-6 (Modéré)', value: risquesStats.modere, color: 'bg-yellow-500', hoverColor: 'hover:bg-yellow-600' },
                    { label: '8-9 (Significatif)', value: risquesStats.significatif, color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600' },
                    { label: '12-16 (Critique)', value: risquesStats.critique, color: 'bg-red-500', hoverColor: 'hover:bg-red-600' }
                  ].map((item, idx) => {
                    const pct = totalEvaluesForBars > 0 ? Math.round((item.value / totalEvaluesForBars) * 100) : 0
                    const width = totalEvaluesForBars > 0 ? (item.value / totalEvaluesForBars) * 100 : 0
                    return (
                      <div key={idx} className="group">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="text-gray-600 font-semibold">{item.value} ({pct}%)</span>
                        </div>
                        <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                          <div className={`h-full ${item.color} ${item.hoverColor} transition-all duration-300 rounded-full`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top processus critiques */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700">Taux de risques critiques (8–16) par processus</h4>
                <button onClick={() => setShowProcessusModal2(true)} className="p-1 hover:bg-gray-200 rounded" title="Voir tous">
                  <Layers size={12} className="text-gray-500" />
                </button>
              </div>
              {!hasPeriodeSynthese ? (
                <p className="text-gray-500 text-center py-6 text-sm">Sélectionnez une période pour afficher les statistiques.</p>
              ) : (
                <div className="space-y-3">
                  {risquesStats.topProcessus.length === 0 && <p className="text-gray-500 text-center py-4 text-sm">Aucun processus avec risques critiques</p>}
                  {risquesStats.topProcessus.map((p, idx) => {
                  const pct = p.total > 0 ? Math.round((p.critiques / p.total) * 100) : 0
                  const width = p.total > 0 ? (p.critiques / p.total) * 100 : 0
                  return (
                    <div key={idx} className="group">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 truncate max-w-[200px]" title={p.libelle}>{p.code}</span>
                        <span className="text-gray-600 font-semibold">{p.critiques}/{p.total} ({pct}%)</span>
                      </div>
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                        <div className="h-full bg-red-500 hover:bg-red-600 transition-all duration-300 rounded-full" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOC 2: Statistiques suivi plan maîtrise */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="text-green-600" size={20} />
            Statistiques de suivi du plan de maîtrise des risques
          </h3>
          
          {/* Filtres période activités - style comme Suivi actions */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <div className="flex items-end gap-2">
              <div className="w-[130px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Date début ≥</label>
                <input type="date" value={synthesePlanPeriode.dateDebut} onChange={(e) => setSynthesePlanPeriode({...synthesePlanPeriode, dateDebut: e.target.value})} className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
              </div>
              <div className="w-[130px] flex-shrink-0">
                <label className="block text-[10px] text-gray-500 mb-0.5">Date fin ≤</label>
                <input type="date" value={synthesePlanPeriode.dateFin} onChange={(e) => setSynthesePlanPeriode({...synthesePlanPeriode, dateFin: e.target.value})} className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
              </div>
              <button onClick={() => setSynthesePlanPeriode({ dateDebut: '', dateFin: '' })} className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0" title="Réinitialiser">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* KPIs plan - libellé "Activités" -> "Actions" */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><List className="text-blue-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-blue-700">{planStats2.total}</p>
                  <p className="text-[10px] text-blue-600">Actions</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-green-700">{planStats2.realisees}</p>
                  <p className="text-[10px] text-green-600">Réalisées</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg"><AlertTriangle className="text-orange-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-orange-700">{planStats2.nonRealisees}</p>
                  <p className="text-[10px] text-orange-600">Non réalisées</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg"><BarChart3 className="text-purple-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-purple-700">{planStats2.tauxRealisation}%</p>
                  <p className="text-[10px] text-purple-600">Taux réalis.</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 rounded-lg"><AlertTriangle className="text-red-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-red-700">{planStats2.enRetard}</p>
                  <p className="text-[10px] text-red-600">En retard</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-yellow-100 rounded-lg"><BarChart3 className="text-yellow-600" size={12} /></div>
                <div>
                  <p className="text-xl font-bold text-yellow-700">{planStats2.retardMoyen}j</p>
                  <p className="text-[10px] text-yellow-600">Retard moy.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Graphiques plan */}
          <div className="grid grid-cols-2 gap-6">
            {/* Répartition par niveau de réalisation */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-700 mb-4">Répartition actions par niveau de réalisation</h4>
              <div className="space-y-3">
                {[
                  { label: 'Achevée', value: (planStats2.parAvancement || []).find(x => x.label === 'Achevée')?.value || 0, color: 'bg-green-600' },
                  { label: 'Terminée - non confirmée', value: (planStats2.parAvancement || []).find(x => x.label === 'Terminée - non confirmée')?.value || 0, color: 'bg-green-400' },
                  { label: 'En cours +50%', value: (planStats2.parAvancement || []).find(x => x.label === 'En cours +50%')?.value || 0, color: 'bg-yellow-500' },
                  { label: 'En cours -50%', value: (planStats2.parAvancement || []).find(x => x.label === 'En cours -50%')?.value || 0, color: 'bg-orange-500' },
                  { label: 'Non entamée', value: (planStats2.parAvancement || []).find(x => x.label === 'Non entamée')?.value || 0, color: 'bg-red-600' }
                ].map((item, idx) => (
                  <div key={idx} className="group">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{item.label}</span>
                    </div>
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                      {(() => {
                        const totalActions = planStats2.total || 0
                        const pct = totalActions > 0 ? Math.round((item.value / totalActions) * 100) : 0
                        const width = totalActions > 0 ? (item.value / totalActions) * 100 : 0
                        return (
                          <>
                            <div className={`h-full ${item.color} hover:opacity-80 transition-all duration-300 rounded-full`} style={{ width: `${width}%` }} />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[10px] font-bold">{item.value} ({pct}%)</span>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 05 structures en retard */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700">Top 05 des structures avec un retard</h4>
                <button onClick={() => setShowStructuresModal(true)} className="p-1 hover:bg-gray-200 rounded" title="Voir toutes">
                  <Layers size={12} className="text-gray-500" />
                </button>
              </div>
              <div className="space-y-3">
                {(planStats2.topRetardStructures || []).length === 0 && <p className="text-gray-500 text-center py-4 text-sm">Aucune structure en retard</p>}
                {(planStats2.topRetardStructures || []).map((s, idx) => (
                  <div key={idx} className="group">
                    <div className="flex justify-between text-xs mb-1">
                      <span
                        className="text-gray-600 truncate max-w-[240px]"
                        title={s.libelle ? `${s.code} - ${s.libelle}` : s.code}
                      >
                        {s.libelle && s.libelle !== s.code ? `${s.code} - ${s.libelle}` : s.code}
                      </span>
                    </div>
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden relative">
                      {(() => {
                        const totalRetards = planStats2.totalRetards || (planStats2.topRetardStructures || []).reduce((acc, x) => acc + (x.value || 0), 0)
                        const v = s.value || 0
                        const pct = totalRetards > 0 ? Math.round((v / totalRetards) * 100) : 0
                        const width = totalRetards > 0 ? (v / totalRetards) * 100 : 0
                        return (
                          <>
                            <div className="h-full bg-red-500 hover:bg-red-600 transition-all duration-300 rounded-full" style={{ width: `${width}%` }} />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[10px] font-bold">
                              {v}{totalRetards > 0 ? ` (${pct}%)` : ''}
                            </span>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal tous processus */}
        {showProcessusModal2 && (
          <Modal isOpen={showProcessusModal2} onClose={() => setShowProcessusModal2(false)} title="Tous les processus critiques (score 8-16)" size="lg">
            {!hasPeriodeSynthese ? (
              <p className="text-gray-500 text-center py-6 text-sm">Sélectionnez une période pour afficher les statistiques.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {risquesStats.allProcessus.map((p, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{p.code} - {p.libelle}</span>
                  </div>
                  <div className="h-5 bg-gray-200 rounded-full overflow-hidden relative">
                    {(() => {
                      const pct = p.total > 0 ? Math.round((p.critiques / p.total) * 100) : 0
                      const width = p.total > 0 ? (p.critiques / p.total) * 100 : 0
                      return (
                        <>
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${width}%` }} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[9px] font-bold">{p.critiques}/{p.total} ({pct}%)</span>
                        </>
                      )
                    })()}
                  </div>
                </div>
                ))}
              </div>
            )}
          </Modal>
        )}

        {/* Modal toutes structures */}
        {showStructuresModal && (
          <Modal isOpen={showStructuresModal} onClose={() => setShowStructuresModal(false)} title="Toutes les structures avec retard" size="lg">
            {(() => {
              const all = planStats2.allRetardStructures || []
              const totalRetards = all.reduce((acc, x) => acc + (x.value || 0), 0)
              return (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {all.map((s, idx) => (
                    <div key={idx} className="group">
                      <div className="flex justify-between text-xs mb-1">
                        <span
                          className="text-gray-600 truncate max-w-[360px]"
                          title={s.libelle ? `${s.code} - ${s.libelle}` : s.code}
                        >
                          {s.libelle && s.libelle !== s.code ? `${s.code} - ${s.libelle}` : s.code}
                        </span>
                      </div>
                      <div className="h-5 bg-gray-200 rounded-full overflow-hidden relative">
                        {(() => {
                          const v = s.value || 0
                          const pct = totalRetards > 0 ? Math.round((v / totalRetards) * 100) : 0
                          const width = totalRetards > 0 ? (v / totalRetards) * 100 : 0
                          return (
                            <>
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${width}%` }} />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-700 text-[9px] font-bold">
                                {v}{totalRetards > 0 ? ` (${pct}%)` : ''}
                              </span>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  ))}
                  {all.length === 0 && <p className="text-gray-500 text-center py-6 text-sm">Aucune structure en retard</p>}
                </div>
              )
            })()}
          </Modal>
        )}
      </div>
    )
  }

  const renderGestion = () => {
    if (!canEdit()) {
      return (
        <div className="bg-white rounded-2xl p-12 text-center">
          <Settings size={40} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Accès en lecture seule</h3>
          <p className="text-gray-500">Vous n'avez pas les droits pour modifier cette section</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* AFFICHAGE PERMANENT DE LA PÉRIODE OUVERTE */}
        <div className={`rounded-2xl p-4 shadow-sm border-2 ${periodeOuverte ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${periodeOuverte ? 'bg-green-500' : 'bg-orange-500'}`}>
                <Target size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700">Période d'évaluation actuellement ouverte</h4>
                {periodeOuverte ? (
                  <p className="text-lg font-bold text-green-700">
                    {periodeOuverte.annee} - {periodeOuverte.semestre ? `Semestre ${periodeOuverte.semestre}` : periodeOuverte.trimestre ? `Trimestre ${periodeOuverte.trimestre}` : periodeOuverte.mois ? moisList[periodeOuverte.mois - 1] : 'Année complète'}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-orange-700">Aucune période ouverte</p>
                )}
              </div>
            </div>
            {periodeOuverte && (
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <CheckCircle size={14} /> Ouvert
                </span>
                <button 
                  onClick={handleInitFermeturePeriode}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <XCircle size={16}/>
                  Fermer période
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Ouvrir une nouvelle période d'évaluation */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg"><Target size={20} className="text-blue-600" /></div>
            Ouvrir une nouvelle période d'évaluation
          </h3>
          {periodeOuverte && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700"><AlertTriangle size={12} className="inline mr-1"/>Une période est déjà ouverte. Fermez-la d'abord pour en ouvrir une nouvelle.</p>
            </div>
          )}
          <div className="grid grid-cols-8 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Année *</label>
              <input
                type="text"
                list="yearsGestionList"
                placeholder="Rechercher..."
                value={periodeForm.annee}
                onChange={(e) => setPeriodeForm({ ...periodeForm, annee: e.target.value, semestre: '', trimestre: '', mois: '' })}
                disabled={!!periodeOuverte}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm disabled:bg-gray-100"
              />
              <datalist id="yearsGestionList">
                {yearsGestion.map(y => <option key={y} value={y}>{y}</option>)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Semestre</label>
              <select value={periodeForm.semestre} onChange={(e) => setPeriodeForm({ ...periodeForm, semestre: e.target.value, trimestre: '', mois: '' })} disabled={!!periodeOuverte || !periodeForm.annee} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {semestres.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trimestre</label>
              <select value={periodeForm.trimestre} onChange={(e) => setPeriodeForm({ ...periodeForm, trimestre: e.target.value, semestre: '', mois: '' })} disabled={!!periodeOuverte || !periodeForm.annee} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {trimestres.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mois</label>
              <select value={periodeForm.mois} onChange={(e) => setPeriodeForm({ ...periodeForm, mois: e.target.value, semestre: '', trimestre: '' })} disabled={!!periodeOuverte || !periodeForm.annee} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">--</option>
                {moisList.map((m, i) => <option key={i} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date limite *</label>
              <input type="date" value={periodeForm.date_limite_saisie} onChange={(e) => setPeriodeForm({ ...periodeForm, date_limite_saisie: e.target.value })} disabled={!!periodeOuverte || !periodeForm.annee} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm disabled:bg-gray-100"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>
              <button 
                onClick={handleOpenPeriode} 
                disabled={!!periodeOuverte}
                title="Ouvrir une nouvelle période d'évaluation"
                className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                  periodeOuverte 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Target size={14}/>
                <span className="hidden xl:inline">Ouvrir</span>
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>
              <button 
                onClick={handleOpenOccurrencesManquantes}
                disabled={!periodeOuverte}
                title="Créer les occurrences manquantes pour la période ouverte"
                className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                  !periodeOuverte 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                <FileSpreadsheet size={14}/>
                <span className="hidden xl:inline">Occ.</span>
              </button>
            </div>
            <div></div>
          </div>
          {periodeOuverte && periodeOuverte.date_debut && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
              <p className="text-sm text-green-700">
                <CheckCircle size={12} className="inline mr-1"/>
                Période du <strong>{new Date(periodeOuverte.date_debut).toLocaleDateString('fr-FR')}</strong> au <strong>{new Date(periodeOuverte.date_fin).toLocaleDateString('fr-FR')}</strong>
                {periodeOuverte.date_limite_saisie && <> - Limite de saisie: <strong>{new Date(periodeOuverte.date_limite_saisie).toLocaleDateString('fr-FR')}</strong></>}
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Processus */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg"><Layers size={20} className="text-purple-600" /></div>
              Processus
              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">{processus.filter(p => p.statut === 'Actif').length} actifs</span>
            </h3>
            <Button icon={Plus} size="sm" onClick={() => { setSelectedProcessus(null); setProcessusForm({ statut: 'Actif' }); setShowProcessusModal(true); }}>Nouveau processus</Button>
          </div>
          <div className="flex gap-4 mb-4">
            <select value={processusFilter.statut} onChange={(e) => setProcessusFilter({ ...processusFilter, statut: e.target.value })} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm">
              <option value="">Tous statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
            </select>
            <input type="text" placeholder="Rechercher..." value={processusFilter.search} onChange={(e) => setProcessusFilter({ ...processusFilter, search: e.target.value })} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm flex-1 max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]">
                <tr>
                  <th className="px-2 py-2 text-left text-white">Code</th>
                  <th className="px-2 py-2 text-left text-white">Libellé</th>
                  <th className="px-2 py-2 text-left text-white">Statut</th>
                  <th className="px-2 py-2 text-left text-white">Créateur</th>
                  <th className="px-2 py-2 text-left text-white">Date création</th>
                  <th className="px-2 py-2 text-right text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProcessus.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun processus</td></tr>
                ) : filteredProcessus.map(p => (
                  <tr key={p.id || p.code_processus} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-mono font-bold text-purple-600">{p.code_processus}</td>
                    <td className="px-2 py-1.5">{p.libelle_processus}</td>
                    <td className="px-2 py-1.5"><StatusBadge status={p.statut} /></td>
                    <td className="px-2 py-1.5 text-gray-500">{p.createur || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{p.date_creation ? new Date(p.date_creation).toLocaleDateString('fr-FR') : '-'}</td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelectedProcessus(p); setProcessusForm(p); setShowProcessusModal(true); }} className="p-1 rounded hover:bg-blue-100 text-blue-500"><Edit size={12} /></button>
                        <button onClick={() => handleDeleteProcessus(p)} className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Catégories */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg"><List size={20} className="text-green-600" /></div>
              Catégories
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{categories.filter(c => c.statut === 'Actif').length} actives</span>
            </h3>
            <Button icon={Plus} size="sm" onClick={() => { setSelectedCategorie(null); setCategorieForm({ statut: 'Actif' }); setShowCategorieModal(true); }}>Nouvelle catégorie</Button>
          </div>
          <div className="flex gap-4 mb-4">
            <select value={categorieFilter.statut} onChange={(e) => setCategorieFilter({ ...categorieFilter, statut: e.target.value })} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm">
              <option value="">Tous statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
            </select>
            <input type="text" placeholder="Rechercher..." value={categorieFilter.search} onChange={(e) => setCategorieFilter({ ...categorieFilter, search: e.target.value })} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm flex-1 max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]">
                <tr>
                  <th className="px-2 py-2 text-left text-white">Code</th>
                  <th className="px-2 py-2 text-left text-white">Libellé</th>
                  <th className="px-2 py-2 text-left text-white">Statut</th>
                  <th className="px-2 py-2 text-left text-white">Créateur</th>
                  <th className="px-2 py-2 text-left text-white">Date création</th>
                  <th className="px-2 py-2 text-right text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCategories.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucune catégorie</td></tr>
                ) : filteredCategories.map(c => (
                  <tr key={c.id || c.code_categorie} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-mono font-bold text-green-600">{c.code_categorie}</td>
                    <td className="px-2 py-1.5">{c.libelle_categorie}</td>
                    <td className="px-2 py-1.5"><StatusBadge status={c.statut} /></td>
                    <td className="px-2 py-1.5 text-gray-500">{c.createur || '-'}</td>
                    <td className="px-2 py-1.5 text-gray-500">{c.date_creation ? new Date(c.date_creation).toLocaleDateString('fr-FR') : '-'}</td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelectedCategorie(c); setCategorieForm(c); setShowCategorieModal(true); }} className="p-1 rounded hover:bg-blue-100 text-blue-500"><Edit size={12} /></button>
                        <button onClick={() => handleDeleteCategorie(c)} className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Gestionnaires de risques */}
        {canManageGestionnaires() && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg"><Users size={20} className="text-orange-600" /></div>
                Gestionnaires de risques
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">{gestionnairesRisques.length} désigné(s)</span>
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Les gestionnaires de risques peuvent créer, modifier et supprimer les risques et leurs actions standards. 
              Ils deviennent automatiquement gestionnaires du groupe "Risque" dans le suivi des indicateurs et du projet "Risques" dans le suivi des activités.
            </p>
            <div className="flex gap-4 mb-4 items-end">
              <div className="flex-1 max-w-md">
                <SearchableSelect
                  label="Ajouter un gestionnaire"
                  value={selectedGestionnaireToAdd}
                  onChange={(v) => setSelectedGestionnaireToAdd(v)}
                  options={users.filter(u => u.statut === 'Actif' && !gestionnairesRisques.includes(u.username)).map(u => ({
                    value: u.username,
                    label: `${u.nom} ${u.prenoms} (${u.username})`
                  }))}
                  placeholder="Rechercher un utilisateur..."
                />
              </div>
              <Button 
                icon={Plus} 
                size="sm" 
                disabled={!selectedGestionnaireToAdd}
                onClick={async () => {
                  if (!selectedGestionnaireToAdd) return
                  try {
                    const newGestionnaires = [...gestionnairesRisques, selectedGestionnaireToAdd]
                    // Mettre à jour le groupe "Risque" (Indicateurs des risques)
                    const res = await fetch('/api/groupe-indicateurs', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        code_groupe: 'Risque', 
                        libelle_groupe: 'Indicateurs des risques',
                        gestionnaires: newGestionnaires,
                        modificateur: user?.username
                      })
                    })
                    if (res.ok) {
                      // Synchroniser avec le projet RISQUES (activités)
                      await fetch('/api/groupes-actions', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          code_groupe: 'RISQUES', 
                          gestionnaires: newGestionnaires,
                          modificateur: user?.username
                        })
                      })
                      // Alert AVANT de mettre à jour l'état local
                      showAlert('success', 'Gestionnaire ajouté avec succès')
                      setGestionnairesRisques(newGestionnaires)
                      setSelectedGestionnaireToAdd('')
                    } else {
                      const data = await res.json()
                      showAlert('error', data.error || 'Erreur lors de l\'ajout')
                    }
                  } catch (error) {
                    console.error('Erreur:', error)
                    showAlert('error', 'Erreur de connexion')
                  }
                }}
              >
                Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {gestionnairesRisques.length === 0 ? (
                <p className="text-center py-4 text-gray-500">Aucun gestionnaire désigné</p>
              ) : gestionnairesRisques.map(g => {
                const userInfo = users.find(u => u.username === g)
                return (
                  <div key={g} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <Users size={16} className="text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{userInfo ? `${userInfo.nom} ${userInfo.prenoms}` : g}</p>
                        <p className="text-xs text-gray-500">{g}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const userName = userInfo ? `${userInfo.nom} ${userInfo.prenoms}` : g
                        setConfirmAction({
                          message: `Retirer ${userName} des gestionnaires de risques ?`,
                          onConfirm: async () => {
                            try {
                              const newGestionnaires = gestionnairesRisques.filter(x => x !== g)
                              const res = await fetch('/api/groupe-indicateurs', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  code_groupe: 'Risque', 
                                  gestionnaires: newGestionnaires,
                                  modificateur: user?.username
                                })
                              })
                              if (res.ok) {
                                await fetch('/api/groupes-actions', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    code_groupe: 'RISQUES', 
                                    gestionnaires: newGestionnaires,
                                    modificateur: user?.username
                                  })
                                })
                                showAlert('success', 'Gestionnaire retiré avec succès')
                                setGestionnairesRisques(newGestionnaires)
                              }
                            } catch (error) {
                              console.error('Erreur:', error)
                              showAlert('error', 'Erreur lors du retrait')
                            }
                          }
                        })
                      }}
                      className="p-1 rounded hover:bg-red-100 text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
                  })}
                </div>
          </div>
        )}

        {/* Période d'appréciation de l'atténuation des risques */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg"><TrendingDown size={20} className="text-emerald-600" /></div>
            Période d'appréciation de l'atténuation des risques
          </h3>
          <p className="text-sm text-gray-500 mb-4">Détermine la période de comparaison utilisée pour calculer l’<strong>Atténuation</strong> dans la sous-rubrique Synthèse.</p>
          <div className="max-w-md">
            <label className="block text-xs font-medium text-gray-500 mb-1">Période *</label>
            <select
              value={attenuationAppreciationType}
              onChange={(e) => {
                const next = e.target.value || 'Année'
                if (next === attenuationAppreciationType) return
                setConfirmAction({
                  message: `Confirmer le changement de la période d'appréciation de l'atténuation des risques : "${attenuationAppreciationType}" → "${next}" ?`,
                  onConfirm: () => {
                    setAttenuationAppreciationType(next)
                    try { localStorage.setItem('giras_attenuation_appreciation_type', next) } catch (e) {}
                    showAlert('success', 'Période d\'appréciation mise à jour')
                  }
                })
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            >
              <option value="Année">Année</option>
              <option value="Semestre">Semestre</option>
              <option value="Trimestre">Trimestre</option>
              <option value="Mois">Mois</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-2">La valeur ne doit jamais être vide. Par défaut : <strong>Année</strong>.</p>
          </div>
        </div>

        {/* Modal Processus */}
        <Modal isOpen={showProcessusModal} onClose={() => setShowProcessusModal(false)} title={selectedProcessus ? 'Modifier le processus' : 'Nouveau processus'} size="md">
          <form onSubmit={handleSaveProcessus} className="space-y-4">
            <FormInput label="Code processus" value={processusForm.code_processus || ''} onChange={(v) => setProcessusForm({ ...processusForm, code_processus: v.toUpperCase() })} required disabled={!!selectedProcessus} placeholder="PROC" />
            <FormInput label="Libellé" value={processusForm.libelle_processus || ''} onChange={(v) => setProcessusForm({ ...processusForm, libelle_processus: v })} required placeholder="Libellé du processus" />
            <FormInput label="Statut" type="select" value={processusForm.statut || 'Actif'} onChange={(v) => setProcessusForm({ ...processusForm, statut: v })} options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]} />
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowProcessusModal(false)}>Annuler</Button>
              <Button type="submit">{selectedProcessus ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </form>
        </Modal>

        {/* Modal Catégorie */}
        <Modal isOpen={showCategorieModal} onClose={() => setShowCategorieModal(false)} title={selectedCategorie ? 'Modifier la catégorie' : 'Nouvelle catégorie'} size="md">
          <form onSubmit={handleSaveCategorie} className="space-y-4">
            {selectedCategorie && <div className="text-sm text-gray-500">Code: <strong>{selectedCategorie.code_categorie}</strong> (auto-généré)</div>}
            <FormInput label="Libellé" value={categorieForm.libelle_categorie || ''} onChange={(v) => setCategorieForm({ ...categorieForm, libelle_categorie: v })} required placeholder="Libellé de la catégorie" />
            <FormInput label="Statut" type="select" value={categorieForm.statut || 'Actif'} onChange={(v) => setCategorieForm({ ...categorieForm, statut: v })} options={[{ value: 'Actif', label: 'Actif' }, { value: 'Inactif', label: 'Inactif' }]} />
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowCategorieModal(false)}>Annuler</Button>
              <Button type="submit">{selectedCategorie ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </form>
        </Modal>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'identification': return renderIdentification()
      case 'analyse': return renderAnalyse()
      case 'evaluation': return renderEvaluation()
      case 'cartographie': return renderCartographie()
      case 'plan': return renderPlan()
      case 'synthese': return renderSynthese()
      case 'gestion': return renderGestion()
      default: return (
        <div className="bg-white rounded-2xl p-12 text-center">
          <Layers size={40} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Section {subPages.find(p => p.key === activeTab)?.label}</h3>
          <p className="text-gray-500">Cette section sera disponible prochainement</p>
        </div>
      )
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      <div className="w-64 bg-white border-r border-gray-100 p-4 space-y-2 flex-shrink-0 sticky top-0 h-[calc(100vh-140px)] overflow-y-auto">
        {subPages.map((page) => <SidebarButton key={page.key} icon={page.icon} label={page.label} active={activeTab === page.key} onClick={() => setActiveTab(page.key)} />)}
      </div>

      <div className="flex-1 p-6 overflow-auto bg-gray-50">{renderContent()}</div>

      {/* Modal Risque - Design professionnel ULTRA COMPACT */}
      <Modal isOpen={showModal && modalType === 'risk'} onClose={() => setShowModal(false)} title={selectedRisk ? `Modifier ${selectedRisk.code_risque}` : 'Nouveau risque'} size="md" closeOnClickOutside={false}>
        <form onSubmit={handleSubmitRisk} className="text-xs space-y-3">
          {/* Ligne 1: Code, Structure, Processus, Statut */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Code *</label>
              <input type="text" value={formData.code_risque || ''} onChange={(e) => setFormData({ ...formData, code_risque: e.target.value.toUpperCase() })} disabled={!!selectedRisk} placeholder="RXXX-1" className="w-full px-2 py-1 rounded border border-gray-200 text-xs disabled:bg-gray-50" required />
            </div>
            <div>
              <SearchableSelect
                label="Structure *"
                size="sm"
                value={formData.code_structure || ''}
                onChange={(v) => setFormData({ ...formData, code_structure: v })}
                options={[
                  { value: '', label: 'Sélectionner...' },
                  ...structures.map(s => ({
                    value: s.code_structure,
                    label: `${s.code_structure} - ${s.libelle_structure}`
                  }))
                ]}
                placeholder="Sélectionner..."
                required
              />
            </div>
            <div>
              <SearchableSelect
                label="Processus *"
                size="sm"
                value={formData.code_processus || ''}
                onChange={(v) => setFormData({ ...formData, code_processus: v })}
                options={[
                  { value: '', label: 'Sélectionner...' },
                  ...processus.filter(p => p.statut === 'Actif').map(p => ({
                    value: p.code_processus,
                    label: `${p.code_processus} - ${p.libelle_processus}`
                  }))
                ]}
                placeholder="Sélectionner..."
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Statut</label>
              <select value={formData.statut || 'Actif'} onChange={(e) => setFormData({ ...formData, statut: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs">
                <option value="Actif">Actif</option>
                <option value="Inactif">Inactif</option>
              </select>
            </div>
          </div>

          {/* Ligne 2: Libellé */}
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Libellé du risque *</label>
            <input type="text" value={formData.libelle_risque || ''} onChange={(e) => setFormData({ ...formData, libelle_risque: e.target.value })} placeholder="Description du risque..." className="w-full px-2 py-1 rounded border border-gray-200 text-xs" required />
          </div>

          {/* Ligne 3: Cause et Conséquence */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Cause(s) *</label>
              <textarea value={formData.cause || ''} onChange={(e) => setFormData({ ...formData, cause: e.target.value })} placeholder="Causes potentielles..." rows={2} className="w-full px-2 py-1 rounded border border-gray-200 text-xs resize-none" required />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Conséquence(s) *</label>
              <textarea value={formData.consequence || ''} onChange={(e) => setFormData({ ...formData, consequence: e.target.value })} placeholder="Conséquences..." rows={2} className="w-full px-2 py-1 rounded border border-gray-200 text-xs resize-none" required />
            </div>
          </div>

          {/* Ligne 4: Impact, Eff. Ctrl, Type, Date vigueur */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Impact *</label>
              <select value={formData.impact || ''} onChange={(e) => setFormData({ ...formData, impact: parseInt(e.target.value) })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs" required>
                <option value="">--</option>
                <option value="1">1-Mineur</option>
                <option value="2">2-Significatif</option>
                <option value="3">3-Majeur</option>
                <option value="4">4-Critique</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Eff. Ctrl *</label>
              <select value={formData.efficacite_contr || ''} onChange={(e) => setFormData({ ...formData, efficacite_contr: parseInt(e.target.value) })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs" required>
                <option value="">--</option>
                <option value="1">1-Très eff.</option>
                <option value="2">2-Efficace</option>
                <option value="3">3-Peu eff.</option>
                <option value="4">4-Inefficace</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Type</label>
              <select 
                value={formData.qualitatif || 'Non'} 
                onChange={(e) => {
                  const newValue = e.target.value
                  // Si on passe à Qualitatif, vider l'indicateur
                  if (newValue === 'Oui') {
                    setFormData({ ...formData, qualitatif: newValue, code_indicateur: null })
                  } else {
                    setFormData({ ...formData, qualitatif: newValue })
                  }
                }} 
                className="w-full px-2 py-1 rounded border border-gray-200 text-xs"
              >
                <option value="Non">Quantitatif</option>
                <option value="Oui">Qualitatif</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Date vigueur *</label>
              <input type="date" value={formData.date_vigueur || ''} onChange={(e) => setFormData({ ...formData, date_vigueur: e.target.value })} className="w-full px-2 py-1 rounded border border-gray-200 text-xs" required />
            </div>
          </div>

          {/* Ligne 5: Indicateur (si quantitatif) + Catégories */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <SearchableSelect
                label={`Indicateur ${formData.qualitatif === 'Oui' ? '(N/A)' : ''}`}
                size="sm"
                value={formData.code_indicateur?.toString() || ''}
                onChange={(v) => setFormData({ ...formData, code_indicateur: v ? parseInt(v) : null })}
                options={[
                  { value: '', label: 'Sélectionner...' },
                  ...indicateurs.map(i => ({
                    value: i.code_indicateur?.toString(),
                    label: i.libelle_indicateur
                  }))
                ]}
                placeholder="Sélectionner..."
                disabled={formData.qualitatif === 'Oui'}
              />
            </div>
            <div>
              <SearchableSelect
                label="Catégorie(s) de risque"
                size="sm"
                value={formData.categories || []}
                onChange={(v) => setFormData({ ...formData, categories: v })}
                options={categories.filter(c => c.statut === 'Actif').map(c => ({
                  value: c.code_categorie,
                  label: c.libelle_categorie
                }))}
                placeholder="Sélectionner..."
                multiple
              />
            </div>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end pt-2 border-t border-gray-100 gap-2">
            <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Annuler</button>
            <button type="submit" className="px-3 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-1">
              <CheckCircle size={12} /> {selectedRisk ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Actions Standards par risque */}
      <Modal isOpen={showModal && modalType === 'actions'} onClose={() => setShowModal(false)} title={`Actions standards - ${selectedRisk?.code_risque}`} size="lg" closeOnClickOutside={false}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Risque: <strong>{selectedRisk?.libelle_risque}</strong></p>
            {canEdit() && (
              <Button icon={Plus} size="sm" onClick={() => { 
                const existingActions = actionsStandards.filter(a => a.code_risque === selectedRisk?.code_risque);
                const nextNum = existingActions.length + 1;
                const generatedCode = `${selectedRisk?.code_risque}-A${String(nextNum).padStart(2, '0')}`;
                setActionFormData({ code_risque: selectedRisk?.code_risque, code_action: generatedCode, type_action: 'Haute' }); 
                setModalType('addAction'); 
              }}>Ajouter</Button>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <table className="w-full text-[10px]">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282]">
                <tr>
                  <th className="px-2 py-2 text-left text-white">Code</th>
                  <th className="px-2 py-2 text-left text-white">Libellé</th>
                  <th className="px-2 py-2 text-left text-white">Type</th>
                  {canEdit() && <th className="px-2 py-2 text-right text-white">Act</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {actionsStandards.length === 0 ? (
                  <tr><td colSpan={canEdit() ? 4 : 3} className="px-4 py-8 text-center text-gray-500">Aucune action standard enregistrée</td></tr>
                ) : actionsStandards.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-mono">{a.code_action}</td>
                    <td className="px-2 py-1.5">{a.libelle_action}</td>
                    <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${a.type_action === 'Haute' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{a.type_action}</span></td>
                    {canEdit() && <td className="px-2 py-1.5 text-right"><button onClick={() => handleDeleteAction(a)} className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={12} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Total: {actionsStandards.length} action(s)</span>
            <div className="flex gap-2">
              <Button variant="secondary" icon={FileSpreadsheet} size="sm" onClick={handleExportActionsRisque}>Exporter</Button>
              <Button variant="secondary" onClick={() => setShowModal(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Ajout Action */}
      <Modal isOpen={showModal && modalType === 'addAction'} onClose={() => setModalType('actions')} title="Nouvelle action standard" size="md" closeOnClickOutside={false}>
        <form onSubmit={handleSubmitAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Code risque</label>
              <input type="text" value={actionFormData.code_risque || ''} disabled className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-gray-100" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Code action (auto)</label>
              <input type="text" value={actionFormData.code_action || ''} disabled className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-gray-100" />
            </div>
          </div>
          <FormInput label="Libellé action *" value={actionFormData.libelle_action || ''} onChange={(v) => setActionFormData({ ...actionFormData, libelle_action: v })} required placeholder="Description de l'action..." />
          <FormInput label="Type *" type="select" value={actionFormData.type_action || 'Haute'} onChange={(v) => setActionFormData({ ...actionFormData, type_action: v })} options={[{ value: 'Haute', label: 'Haute' }, { value: 'Basse', label: 'Basse' }]} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setModalType('actions')}>Annuler</Button>
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Vue globale de TOUTES les actions standards avec formulaire */}
      <Modal isOpen={showModal && modalType === 'allActions'} onClose={() => { setShowModal(false); setEditingAction(null); setActionFormData({}); }} title="Actions standards" size="xl" closeOnClickOutside={false}>
        <div className="space-y-4">
          {/* Formulaire d'ajout/modification */}
          {canEdit() && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                {editingAction ? '✏️ Modifier l\'action' : '➕ Nouvelle action standard'}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <SearchableSelect
                    label="Code risque *"
                    size="sm"
                    value={actionFormData.code_risque || ''}
                    onChange={(v) => {
                      const codeRisque = v;
                      if (codeRisque && !editingAction) {
                        const existingActions = allActionsStandards.filter(a => a.code_risque === codeRisque);
                        const nextNum = existingActions.length + 1;
                        const generatedCode = `${codeRisque}-A${String(nextNum).padStart(2, '0')}`;
                        setActionFormData({ ...actionFormData, code_risque: codeRisque, code_action: generatedCode });
                      } else {
                        setActionFormData({ ...actionFormData, code_risque: codeRisque });
                      }
                    }}
                    options={[
                      { value: '', label: 'Sélectionner...' },
                      ...risques.filter(r => r.statut === 'Actif').map(r => ({
                        value: r.code_risque,
                        label: `${r.code_risque} - ${r.libelle_risque?.substring(0, 40)}...`
                      }))
                    ]}
                    placeholder="Sélectionner..."
                    disabled={!!editingAction}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Libellé action *</label>
                  <input 
                    type="text" 
                    value={actionFormData.libelle_action || ''} 
                    onChange={(e) => setActionFormData({ ...actionFormData, libelle_action: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
                    placeholder="Description de l'action..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Type action *</label>
                  <select 
                    value={actionFormData.type_action || ''} 
                    onChange={(e) => setActionFormData({ ...actionFormData, type_action: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Haute">Haute</option>
                    <option value="Basse">Basse</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={handleSubmitAction}>
                  {editingAction ? 'Enregistrer' : 'Ajouter'}
                </Button>
                {editingAction && (
                  <Button size="sm" variant="secondary" onClick={handleCancelEditAction}>
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Tableau des actions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-[45vh] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#1a365d] to-[#2c5282] sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white">Code risque</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white">Libellé risque</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white">Code action</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white">Libellé action</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-white">Type</th>
                  <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-white" style={{ width: '70px' }}>Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allActionsStandards.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">Aucune action standard enregistrée</td></tr>
                ) : allActionsStandards.map((a, idx) => {
                  const risque = risques.find(r => r.code_risque === a.code_risque)
                  return (
                    <tr key={a.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50`}>
                      <td className="px-2 py-1.5 text-[11px] font-mono font-bold text-blue-600">{a.code_risque}</td>
                      <td className="px-2 py-1.5 text-[11px] text-gray-700 max-w-[200px]">
                        <span className="line-clamp-2" title={risque?.libelle_risque}>{risque?.libelle_risque || '-'}</span>
                      </td>
                      <td className="px-2 py-1.5 text-[11px] font-mono">{a.code_action}</td>
                      <td className="px-2 py-1.5 text-[11px] max-w-[200px]">
                        <span className="line-clamp-2" title={a.libelle_action}>{a.libelle_action}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          a.type_action === 'Haute' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {a.type_action}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit() && (
                            <>
                              <button 
                                onClick={() => handleEditAction(a)} 
                                className="p-1 rounded hover:bg-blue-100 text-blue-500"
                                title="Modifier"
                              >
                                <Edit size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteAction(a)} 
                                className="p-1 rounded hover:bg-red-100 text-red-500"
                                title="Supprimer"
                              >
                                <Trash2 size={12} />
                              </button>
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
          
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">Total: <strong>{allActionsStandards.length}</strong> action(s)</span>
              <Button icon={FileSpreadsheet} size="sm" variant="secondary" onClick={handleExportActions}>Exporter</Button>
            </div>
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditingAction(null); setActionFormData({}); }}>Fermer</Button>
          </div>
        </div>
      </Modal>

      {/* Modal de fermeture de période - GLOBAL */}
      {showFermetureModal && (
        <Modal isOpen={showFermetureModal} onClose={() => { if (fermetureStep !== 'progress') setShowFermetureModal(false) }} title="Fermeture de période" size="lg" closeOnClickOutside={false}>
          {fermetureStep === 'verify' && fermetureData && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 flex items-center gap-2"><AlertTriangle size={16}/>Impossible de fermer la période</h4>
                <p className="text-sm text-red-700 mt-1">Les conditions suivantes doivent être remplies avant de pouvoir fermer cette période.</p>
              </div>
              
              {fermetureData.risquesNonEvalues?.length > 0 && (
                <div>
                  <h5 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                    <XCircle size={16}/>
                    Risques actifs non évalués ({fermetureData.risquesNonEvalues.length}) - BLOCAGE
                  </h5>
                  <p className="text-xs text-red-600 mb-2">Impossible de fermer la période tant que ces risques ne sont pas évalués (Impact, Efficacité contrôle et Probabilité doivent être renseignés).</p>
                  <div className="max-h-40 overflow-y-auto border border-red-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50 sticky top-0"><tr><th className="px-2 py-1 text-left">Code</th><th className="px-2 py-1 text-left">Libellé</th><th className="px-2 py-1 text-left">Raison</th></tr></thead>
                      <tbody className="divide-y">{fermetureData.risquesNonEvalues.map((r, i) => (
                        <tr key={i} className="hover:bg-red-50"><td className="px-2 py-1 font-mono text-red-600">{r.code_risque}</td><td className="px-2 py-1">{r.libelle?.slice(0, 50)}...</td><td className="px-2 py-1 text-orange-600">{r.raison}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {fermetureData.indicateursNonRenseignes?.length > 0 && !fermetureData.hasBlockingIssues && (
                <div>
                  <h5 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                    <AlertTriangle size={16}/>
                    Indicateurs risques non renseignés ({fermetureData.indicateursNonRenseignes.length})
                  </h5>
                  <p className="text-xs text-orange-600 mb-2">Vous devez renseigner ou supprimer ces indicateurs avant de pouvoir fermer la période.</p>
                  <div className="max-h-40 overflow-y-auto border border-orange-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-orange-50 sticky top-0"><tr><th className="px-2 py-1 text-left">Indicateur</th><th className="px-2 py-1 text-left">Risque</th><th className="px-2 py-1 text-left">Responsable</th><th className="px-2 py-1 text-left">Occurrences</th></tr></thead>
                      <tbody className="divide-y">{fermetureData.indicateursNonRenseignes.map((ind, i) => (
                        <tr key={i} className="hover:bg-orange-50">
                          <td className="px-2 py-1">{ind.libelle?.slice(0, 30)}...</td>
                          <td className="px-2 py-1 font-mono text-blue-600">{ind.code_risque}</td>
                          <td className="px-2 py-1 text-gray-600">{ind.responsable || '-'}</td>
                          <td className="px-2 py-1 text-orange-600">{ind.occurrences?.length} à renseigner</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="mt-3 p-2 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-700 font-medium">Actions possibles :</p>
                    <ul className="text-xs text-orange-600 mt-1 space-y-1">
                      <li>• Aller dans l'onglet "Suivi des indicateurs" pour renseigner les valeurs manquantes</li>
                      <li>• Ou supprimer les occurrences de cette période qui ne doivent pas être prises en compte</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {fermetureData.stats && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h5 className="font-medium text-gray-700 mb-2">Statistiques de la période</h5>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-lg text-blue-600">{fermetureData.stats.totalRisques}</div>
                      <div className="text-gray-500">Risques actifs</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-lg text-green-600">{fermetureData.stats.risquesEvalues}</div>
                      <div className="text-gray-500">Risques évalués</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-lg text-purple-600">{fermetureData.stats.totalOccurrences}</div>
                      <div className="text-gray-500 text-[10px]">Indicateurs risques à renseigner</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded">
                      <div className="font-bold text-lg text-teal-600">{fermetureData.stats.indicateursRenseignes}</div>
                      <div className="text-gray-500 text-[10px]">Indicateurs risques renseignés</div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowFermetureModal(false)}>Fermer</Button>
              </div>
            </div>
          )}
          
          {fermetureStep === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800">Confirmation de fermeture</h4>
                <p className="text-sm text-blue-700 mt-1">Veuillez confirmer les points suivants avant de fermer la période.</p>
              </div>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="file" accept=".pdf" onChange={handleCartographieUpload} className="hidden" id="cartographie-upload-global"/>
                  <input type="checkbox" checked={fermetureCheckboxes.cartographie} readOnly className="mt-1 w-4 h-4 text-blue-600"/>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Charger la cartographie signée (PDF)</p>
                    <p className="text-xs text-gray-500">Joindre le fichier PDF de la cartographie signée pour cette période</p>
                    {!fichierCartographie && <label htmlFor="cartographie-upload-global" className="text-blue-600 text-xs cursor-pointer hover:underline">Cliquer pour choisir un fichier</label>}
                    {fichierCartographie && <span className="text-green-600 text-xs">✓ Fichier chargé</span>}
                  </div>
                </label>
                
                <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setFermetureCheckboxes(prev => ({ ...prev, infoNonModifiable: !prev.infoNonModifiable }))}>
                  <input type="checkbox" checked={fermetureCheckboxes.infoNonModifiable} readOnly className="mt-1 w-4 h-4 text-blue-600"/>
                  <div>
                    <p className="font-medium text-gray-800">Informations non modifiables</p>
                    <p className="text-xs text-gray-500">Les informations des risques pour cette période ne pourront plus être modifiées (impact, efficacité de contrôle, fréquence, ...)</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setFermetureCheckboxes(prev => ({ ...prev, modifNImpacte: !prev.modifNImpacte }))}>
                  <input type="checkbox" checked={fermetureCheckboxes.modifNImpacte} readOnly className="mt-1 w-4 h-4 text-blue-600"/>
                  <div>
                    <p className="font-medium text-gray-800">Modifications futures sans impact</p>
                    <p className="text-xs text-gray-500">Peu importe les modifications qui interviendront sur le risque et ses caractéristiques, elles n'impacteront plus cette période</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setFermetureCheckboxes(prev => ({ ...prev, occurrencesArchivees: !prev.occurrencesArchivees }))}>
                  <input type="checkbox" checked={fermetureCheckboxes.occurrencesArchivees} readOnly className="mt-1 w-4 h-4 text-blue-600"/>
                  <div>
                    <p className="font-medium text-gray-800">Archivage des occurrences</p>
                    <p className="text-xs text-gray-500">L'ensemble des occurrences des indicateurs risques pour cette période seront archivées et ne pourront plus être modifiées</p>
                  </div>
                </label>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="secondary" onClick={() => setShowFermetureModal(false)}>Annuler</Button>
                <Button onClick={handleExecuteFermeture} disabled={!fichierCartographie || !Object.values(fermetureCheckboxes).every(v => v)} className="bg-red-600 hover:bg-red-700">Confirmer la fermeture</Button>
              </div>
            </div>
          )}
          
          {(fermetureStep === 'progress' || fermetureStep === 'done') && (
            <div className="py-8 text-center">
              <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                <div className="bg-blue-600 h-4 rounded-full transition-all duration-300" style={{ width: `${progressOperation.progress}%` }}></div>
              </div>
              <p className="text-gray-700">{progressOperation.message}</p>
              {fermetureStep === 'done' && <p className="text-green-600 font-medium mt-2">✓ Fermeture terminée avec succès</p>}
            </div>
          )}
        </Modal>
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
      
      {/* Barre de progression globale - toujours visible quand active */}
      {progressOperation.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progressOperation.progress}%` }}
              ></div>
            </div>
            <p className="text-center text-gray-700 font-medium">{progressOperation.message}</p>
            <p className="text-center text-gray-400 text-sm mt-1">{progressOperation.progress}%</p>
          </div>
        </div>
      )}
    </div>
  )
}
