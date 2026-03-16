export const PRIVILEGED_USER_TYPES = ['Admin', 'Super admin', 'Super manager']

export const normalizeUsername = (value) => String(value || '').trim().toLowerCase()
export const normalizeStructure = (value) => String(value || '').trim()

export const isPrivilegedUser = (user) => PRIVILEGED_USER_TYPES.includes(user?.type_utilisateur)

export const isDirectSuperior = (user, targetUsername, users = []) => {
  const currentUsername = normalizeUsername(user?.username)
  const target = (users || []).find((item) => normalizeUsername(item?.username) === normalizeUsername(targetUsername))
  if (!currentUsername || !target) return false
  return normalizeUsername(target?.superieur) === currentUsername
}

export const canAccessRisk = (user, risk) => {
  if (!user || !risk) return false
  if (isPrivilegedUser(user)) return true
  return normalizeStructure(risk?.code_structure || risk?.structure) === normalizeStructure(user?.structure)
}

export const getActionResponsibles = (action, occurrences = []) => {
  const values = new Set()
  const pushValue = (value) => {
    const normalized = normalizeUsername(value)
    if (normalized) values.add(normalized)
  }

  pushValue(action?.responsable)
  pushValue(action?.occ_responsable)
  pushValue(action?.latest_occurrence?.responsable)

  ;(occurrences || []).forEach((occ) => {
    const actionCode = String(action?.code_action || '').trim()
    const occActionCode = String(occ?.code_action || occ?.code_action_occ || occ?.__actionCode || '').trim()
    if (actionCode && occActionCode && actionCode === occActionCode) {
      pushValue(occ?.responsable)
    }
  })

  return [...values]
}

export const canAccessAction = (user, action, users = [], occurrences = []) => {
  if (!user || !action) return false
  if (isPrivilegedUser(user)) return true

  const currentUsername = normalizeUsername(user?.username)
  const responsibles = getActionResponsibles(action, occurrences)

  if (responsibles.includes(currentUsername)) return true
  return responsibles.some((responsable) => isDirectSuperior(user, responsable, users))
}

export const canAccessActionOccurrence = (user, occurrence, users = [], actions = []) => {
  if (!user || !occurrence) return false
  if (isPrivilegedUser(user)) return true

  const currentUsername = normalizeUsername(user?.username)
  const responsable = normalizeUsername(occurrence?.responsable)
  if (responsable && responsable === currentUsername) return true
  if (responsable && isDirectSuperior(user, responsable, users)) return true

  const linkedAction = (actions || []).find((action) => {
    const actionCode = String(action?.code_action || '').trim()
    const occActionCode = String(occurrence?.code_action || occurrence?.code_action_occ || occurrence?.__actionCode || '').trim()
    return actionCode && occActionCode && actionCode === occActionCode
  })

  if (!linkedAction) return false
  return canAccessAction(user, linkedAction, users, [occurrence])
}

export const canAccessIndicator = (user, indicateur, users = []) => {
  if (!user || !indicateur) return false
  if (isPrivilegedUser(user)) return true

  const currentUsername = normalizeUsername(user?.username)
  const responsable = normalizeUsername(indicateur?.responsable)
  if (responsable && responsable === currentUsername) return true
  return responsable ? isDirectSuperior(user, responsable, users) : false
}

export const canAccessIndicatorOccurrence = (user, occurrence, indicateurs = [], users = []) => {
  if (!user || !occurrence) return false
  if (isPrivilegedUser(user)) return true

  const linkedIndicator = (indicateurs || []).find((item) => String(item?.code_indicateur) === String(occurrence?.code_indicateur || occurrence?.code_indicateur_occ))
  if (linkedIndicator) return canAccessIndicator(user, linkedIndicator, users)

  const currentUsername = normalizeUsername(user?.username)
  const responsable = normalizeUsername(occurrence?.responsable)
  if (responsable && responsable === currentUsername) return true
  return responsable ? isDirectSuperior(user, responsable, users) : false
}

export const getVisibleStructuresForUser = (user, users = [], items = [], structureFieldCandidates = ['code_structure', 'structure']) => {
  if (isPrivilegedUser(user)) {
    return [...new Set((items || []).map((item) => {
      const field = structureFieldCandidates.find((candidate) => item?.[candidate])
      return normalizeStructure(field ? item[field] : '')
    }).filter(Boolean))]
  }
  const ownStructure = normalizeStructure(user?.structure)
  return ownStructure ? [ownStructure] : []
}
