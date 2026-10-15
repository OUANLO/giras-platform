export const toDateOnly = (value) => {
  if (!value) return null
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return null
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

export const parseNumericProgress = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const s = String(value).trim().replace('%', '').replace(',', '.')
  const m = s.match(/-?\d+(?:\.\d+)?/)
  if (!m) return 0
  const n = Number(m[0])
  return Number.isFinite(n) ? n : 0
}

const isOui = (value) => String(value ?? '').trim().toLowerCase() === 'oui'

export const getPlanRiskLevel = (txAvancement, gestionnaireConf) => {
  const tx = parseNumericProgress(txAvancement)
  if (tx >= 100 && isOui(gestionnaireConf)) return 'Achevée'
  if (tx >= 100) return 'Terminée - non confirmée'
  if (tx >= 50) return 'En cours +50%'
  if (tx > 0) return 'En cours -50%'
  return 'Non entamée'
}

export const computePlanRiskStats = ({ rows = [], structures = [], filters = {} } = {}) => {
  const today = toDateOnly(new Date())
  const startDate = filters?.dateDebut ? toDateOnly(filters.dateDebut) : null
  const endDate = filters?.dateFin ? toDateOnly(filters.dateFin) : null

  const structureNames = new Map(
    (structures || []).map((item) => [item?.code_structure, item?.libelle_structure || item?.code_structure])
  )

  const filteredRows = (rows || []).filter((row) => {
    const dateDebut = toDateOnly(row?.date_debut)
    const dateFin = toDateOnly(row?.date_fin)
    if (startDate && (!dateDebut || dateDebut < startDate)) return false
    if (endDate && (!dateFin || dateFin > endDate)) return false
    return true
  })

  const normalized = filteredRows.map((row) => {
    const tx = parseNumericProgress(row?.tx_avancement)
    const dateFin = toDateOnly(row?.date_fin)
    const daysLate = dateFin ? Math.floor((today - dateFin) / 86400000) : 0
    const positiveDelay = daysLate > 0 ? daysLate : 0
    const isCompleted = tx >= 100
    const isLate = !isCompleted && positiveDelay > 0
    const structureCode = row?.code_structure || 'N/A'
    const structureLabel = structureNames.get(structureCode) || structureCode
    return {
      row,
      tx,
      level: getPlanRiskLevel(tx, row?.gestionnaire_conf),
      daysLate,
      positiveDelay,
      isCompleted,
      isLate,
      structureCode,
      structureLabel,
    }
  })

  const total = normalized.length
  const realisees = normalized.filter((item) => item.isCompleted).length
  const nonRealisees = normalized.filter((item) => !item.isCompleted).length
  const lateRows = normalized.filter((item) => item.isLate)
  const positiveDelays = normalized.filter((item) => item.positiveDelay > 0)

  const levelOrder = ['Achevée', 'Terminée - non confirmée', 'En cours +50%', 'En cours -50%', 'Non entamée']
  const levelColors = {
    'Achevée': 'bg-emerald-600',
    'Terminée - non confirmée': 'bg-emerald-400',
    'En cours +50%': 'bg-amber-500',
    'En cours -50%': 'bg-orange-500',
    'Non entamée': 'bg-rose-600',
  }
  const levelCounts = levelOrder.reduce((acc, label) => {
    acc[label] = 0
    return acc
  }, {})
  normalized.forEach((item) => {
    levelCounts[item.level] = (levelCounts[item.level] || 0) + 1
  })

  const byStructure = {}
  lateRows.forEach((item) => {
    if (!byStructure[item.structureCode]) {
      byStructure[item.structureCode] = {
        code: item.structureCode,
        label: item.structureLabel,
        libelle: item.structureLabel,
        value: 0,
        totalRetard: 0,
      }
    }
    byStructure[item.structureCode].value += 1
    byStructure[item.structureCode].totalRetard += item.positiveDelay
  })

  const allRetardStructures = Object.values(byStructure)
    .map((item) => ({
      ...item,
      avg: item.value > 0 ? Math.round(item.totalRetard / item.value) : 0,
    }))
    .sort((a, b) => (b.value - a.value) || (b.avg - a.avg) || String(a.label).localeCompare(String(b.label)))

  const totalRetards = allRetardStructures.reduce((sum, item) => sum + (item.value || 0), 0)

  return {
    total,
    realisees,
    nonRealisees,
    tauxRealisation: total > 0 ? Math.round((realisees / total) * 100) : 0,
    enRetard: lateRows.length,
    retardMoyen: positiveDelays.length > 0
      ? Math.round(positiveDelays.reduce((sum, item) => sum + item.positiveDelay, 0) / positiveDelays.length)
      : 0,
    parAvancement: levelOrder.map((label) => ({
      label,
      value: levelCounts[label] || 0,
      color: levelColors[label],
    })),
    nivRepart: levelCounts,
    topRetardStructures: allRetardStructures.slice(0, 5),
    allRetardStructures,
    totalRetards,
    maxRetardStructures: Math.max(1, ...allRetardStructures.map((item) => item.value || 0)),
    maxNiveauAvancement: Math.max(1, ...levelOrder.map((label) => levelCounts[label] || 0)),
  }
}
