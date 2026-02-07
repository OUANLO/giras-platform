import bcrypt from 'bcryptjs'

// Hashage de mot de passe
export async function hashPassword(password) {
  return await bcrypt.hash(password, 12)
}

// Vérification de mot de passe
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword)
}

// Génération de mot de passe aléatoire
export function generatePassword(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Formatage de date
export function formatDate(date, format = 'DD/MM/YYYY') {
  if (!date) return ''
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    case 'MM-YYYY':
      return `${month}-${year}`
    default:
      return `${day}/${month}/${year}`
  }
}

// Calcul du retard en jours
export function calculateDelay(endDate, completionDate = null) {
  const end = new Date(endDate)
  const comparison = completionDate ? new Date(completionDate) : new Date()
  const diffTime = comparison - end
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
}

// Calcul de la criticité
export function calculateCriticality(impact, probability, controlEfficiency) {
  return impact * probability * controlEfficiency
}

// Niveau de criticité
export function getCriticalityLevel(score) {
  if (score <= 9) return { level: 'Faible', color: 'green' }
  if (score <= 18) return { level: 'Modéré', color: 'yellow' }
  if (score <= 36) return { level: 'Significatif', color: 'orange' }
  return { level: 'Critique', color: 'red' }
}

// Niveau d'avancement
export function getProgressLevel(percentage, confirmed) {
  if (percentage === 0) return 'Non entamée'
  if (percentage > 0 && percentage <= 50) return 'En cours – moins de 50%'
  if (percentage > 50 && percentage < 100) return 'En cours – plus de 50%'
  if (percentage >= 100 && !confirmed) return 'Terminée – non confirmée'
  if (percentage >= 100 && confirmed) return 'Achevée'
  return 'Non entamée'
}

// Génération des périodes pour les routines
export function generatePeriods(startDate, endDate, periodicity) {
  const periods = []
  let current = new Date(startDate)
  const end = new Date(endDate)
  
  while (current <= end) {
    let period = ''
    let nextDate = new Date(current)
    
    switch (periodicity) {
      case 'Hebdomadaire':
        const weekNum = getWeekNumber(current)
        period = `S${String(weekNum).padStart(2, '0')}-${current.getFullYear()}`
        nextDate.setDate(nextDate.getDate() + 7)
        break
      case 'Mensuel':
      case 'Mensuelle':
        period = `${String(current.getMonth() + 1).padStart(2, '0')}-${current.getFullYear()}`
        nextDate.setMonth(nextDate.getMonth() + 1)
        break
      case 'Trimestriel':
      case 'Trimestrielle':
        const quarter = Math.floor(current.getMonth() / 3) + 1
        period = `T${quarter}-${current.getFullYear()}`
        nextDate.setMonth(nextDate.getMonth() + 3)
        break
      case 'Semestriel':
      case 'Semestrielle':
        const semester = current.getMonth() < 6 ? 1 : 2
        period = `S${semester}-${current.getFullYear()}`
        nextDate.setMonth(nextDate.getMonth() + 6)
        break
      case 'Annuel':
      case 'Annuelle':
        period = `${current.getFullYear()}`
        nextDate.setFullYear(nextDate.getFullYear() + 1)
        break
      default:
        period = 'Seul'
        nextDate = new Date(end.getTime() + 1)
    }
    
    periods.push({
      period,
      startDate: new Date(current),
      endDate: new Date(Math.min(nextDate.getTime() - 1, end.getTime()))
    })
    
    current = nextDate
  }
  
  return periods
}

// Numéro de semaine
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

// Vérification des permissions utilisateur
export function checkUserPermission(user, action, resource) {
  if (!user) return false
  
  // Super Admin a tous les droits
  if (user.type_utilisateur === 'Super admin') return true
  
  // Admin - droits étendus sauf modification Super Admin
  if (user.type_utilisateur === 'Admin') {
    if (resource?.type_utilisateur === 'Super admin') return false
    if (resource?.type_utilisateur === 'Super manager') return false
    if (resource?.type_utilisateur === 'Admin' && action !== 'view') return false
    return user.acces_admin === 'Oui'
  }
  
  // Super Manager - lecture toutes structures
  if (user.type_utilisateur === 'Super manager') {
    return action === 'view' || action === 'create'
  }
  
  // Manager - filtré sur sa structure et ses collaborateurs
  if (user.type_utilisateur === 'Manager') {
    if (resource?.structure && resource.structure !== user.structure) return false
    return true
  }
  
  // User - uniquement ses propres données
  if (user.type_utilisateur === 'User') {
    if (resource?.username && resource.username !== user.username) return false
    if (resource?.responsable && resource.responsable !== user.username) return false
    return true
  }
  
  return false
}

// Classe des noms avec conditions
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// Debounce function
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Export Excel (utilise xlsx)
export async function exportToExcel(data, filename, sheetName = 'Données') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
