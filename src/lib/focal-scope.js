// Shared, deliberately separate from global administrator privileges.
export const isPointFocal = user => user?.type_utilisateur === 'Point focal'
export const asArray = value => {
  if (Array.isArray(value)) return value
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}
export const focalStructures = user => [...new Set(asArray(user?.structures_point_focal).map(v => String(v).trim()).filter(Boolean))]
export const isFocalForStructure = (user, structure) => isPointFocal(user) && focalStructures(user).includes(String(structure || '').trim())
export const managesGroup = (user, group) => [...asArray(group?.gestionnaires), group?.gestionnaire].filter(Boolean).some(v => String(v).trim().toLowerCase() === String(user?.username || '').trim().toLowerCase())
