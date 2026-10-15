export const normalizeBusinessLabel = (value) => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export const findDuplicateByNormalizedLabel = (items, fieldName, candidateLabel, excludedId = null) => {
  const normalizedCandidate = normalizeBusinessLabel(candidateLabel)
  if (!normalizedCandidate) return null

  return (items || []).find((item) => {
    if (!item) return false
    if (excludedId !== null && excludedId !== undefined && String(item.id) === String(excludedId)) return false
    return normalizeBusinessLabel(item[fieldName]) === normalizedCandidate
  }) || null
}

export const duplicateLabelError = (kind, existingLabel) => {
  return `Ce libellé ${kind} existe déjà : "${existingLabel}". Veuillez vous y référer.`
}
