export const isAdminType = (user) => ['Admin', 'Super admin'].includes(user?.type_utilisateur)
export const isSuperAdminType = (user) => user?.type_utilisateur === 'Super admin'
export const canAccessAdministration = (user) => user?.type_utilisateur === 'Super admin' || (user?.type_utilisateur === 'Admin' && user?.acces_admin === 'Oui')

export const canSendReminders = (user) => ['Gestionnaire', 'Admin', 'Super admin', 'Super manager'].includes(user?.type_utilisateur)

export const canCreateProjects = (user) => user?.type_utilisateur === 'Super admin' || user?.peut_creer_projets === 'Oui'
export const canCreateIndicatorGroups = (user) => user?.type_utilisateur === 'Super admin' || user?.peut_creer_groupes_indicateurs === 'Oui'

export const getAdminSectionLevel = (user, section) => {
  if (user?.type_utilisateur === 'Super admin') return 'edit'
  if (user?.type_utilisateur !== 'Admin' || user?.acces_admin !== 'Oui') return 'none'

  const map = {
    structures: user?.admin_structures_droit,
    flash: user?.admin_flash_droit,
    emailing: user?.admin_emailing_acces === 'Oui' ? 'edit' : 'none'
  }

  const value = String(map?.[section] || '').trim().toLowerCase()
  if (value === 'edit' || value === 'ecriture') return 'edit'
  if (value === 'read' || value === 'lecture') return 'read'
  return 'none'
}

export const canAccessAdminSection = (user, section) => getAdminSectionLevel(user, section) !== 'none'
export const canEditAdminSection = (user, section) => getAdminSectionLevel(user, section) === 'edit'

export const isSuperManagerReadOnly = (user) => user?.type_utilisateur === 'Super manager'
