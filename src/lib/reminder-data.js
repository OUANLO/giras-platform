// Helpers partagés pour construire le contenu des emails de rappel (manuel + CRON)
//
// Objectif : garantir strictement le même contenu pour un utilisateur donné, quel que
// soit le mode d'envoi (manuel via /api/emailing ou automatique via /api/cron/*).
//
// NOTE: val_indicateur === 0 est une valeur valide. On considère "non renseigné" si
// val_indicateur est null/undefined ou chaîne vide.

// Fonction pour calculer le retard ou les jours restants
export function calculateRetard(dateFin) {
  if (!dateFin) return { jours_retard: 0, jours_restants: 0 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fin = new Date(dateFin)
  fin.setHours(0, 0, 0, 0)
  const diff = Math.floor((today - fin) / (1000 * 60 * 60 * 24))

  if (diff > 0) return { jours_retard: diff, jours_restants: 0 }
  return { jours_retard: 0, jours_restants: Math.abs(diff) }
}

export function getNiveauAvancement(tx) {
  if (tx >= 100) return 'Terminé'
  if (tx >= 75) return 'Avancé'
  if (tx >= 50) return 'En cours'
  if (tx >= 25) return 'Démarré'
  return 'Non démarré'
}

function isEmptyValInd(val) {
  return val === null || val === undefined || val === ''
}

/**
 * Construit les actions et indicateurs en attente pour un utilisateur.
 * @param {object} user - ligne users
 * @param {object} datasets - { actions, actionOccurrences, indicateurs, indicateurOccurrences, groupesIndicateurs }
 * @param {object} limits - { actionFutureLimitStr, indicateurFutureLimitStr, todayStr }
 */
export function buildPendingForUser(user, datasets, limits) {
  const {
    actions = [],
    actionOccurrences = [],
    indicateurs = [],
    indicateurOccurrences = [],
    groupesIndicateurs = []
  } = datasets || {}

  const { actionFutureLimitStr, indicateurFutureLimitStr, todayStr } = limits
  const username = user?.username
  const email = user?.email

  // Le champ "responsable" peut contenir soit le username, soit l'email.
  const isSameResponsable = (value) => {
    if (!value) return false
    const v = String(value).trim().toLowerCase()
    const u = String(username || '').trim().toLowerCase()
    const e = String(email || '').trim().toLowerCase()
    return (u && v === u) || (e && v === e)
  }

  // ========== ACTIONS ==========
  const userActionOccurrences = (actionOccurrences || []).filter(occ => isSameResponsable(occ.responsable))
  const actionsEnRetard = []
  const actionsEnCours = []
  const actionsADebuter = []

  for (const occ of userActionOccurrences) {
    if ((occ.tx_avancement || 0) >= 100) continue
    const action = (actions || []).find(a => a.code_action === occ.code_action)
    const dateDebut = occ.date_debut
    const dateFin = occ.date_fin
    if (actionFutureLimitStr && dateDebut && dateDebut > actionFutureLimitStr) continue

    const retard = calculateRetard(dateFin)
    const actionData = {
      code_groupe: action?.code_groupe || '-',
      libelle_action: action?.libelle_action || 'Action sans libellé',
      date_debut: dateDebut,
      date_fin: dateFin,
      tx_avancement: occ.tx_avancement || 0,
      niveau_avancement: getNiveauAvancement(occ.tx_avancement || 0),
      jours_retard: retard.jours_retard,
      jours_restants: retard.jours_restants
    }

    if (dateFin && todayStr && dateFin < todayStr) actionsEnRetard.push(actionData)
    else if (dateDebut && todayStr && dateDebut <= todayStr) actionsEnCours.push(actionData)
    else actionsADebuter.push(actionData)
  }

  const pendingActions = { enRetard: actionsEnRetard, enCours: actionsEnCours, aDebuter: actionsADebuter }
  const totalActions = actionsEnRetard.length + actionsEnCours.length + actionsADebuter.length

  // ========== INDICATEURS ==========
  // Le responsable est sur la table 'indicateurs'
  const userIndicateurs = (indicateurs || []).filter(i => isSameResponsable(i.responsable))
  const indicateursEnRetard = []
  const indicateursARenseigner = []
  const indicateursAVenir = []

  const processedOccurrences = new Set()

  for (const ind of userIndicateurs) {
    const indOccurrences = (indicateurOccurrences || []).filter(
      o => o.code_indicateur === ind.code_indicateur && isEmptyValInd(o.val_indicateur)
    )

    const groupeCodes = (ind.groupes || [])
      .map(codeGroupe => {
        const groupe = (groupesIndicateurs || []).find(g => g.code_groupe === codeGroupe)
        return groupe?.code_groupe || codeGroupe
      })
      .join(', ') || '-'

    for (const occ of indOccurrences) {
      // Certaines lignes ont code_periode, d'autres code_periode peut être null.
      const periodeKey = occ.code_periode || occ.periode || `${occ.date_debut || ''}-${occ.date_fin || ''}`
      const occKey = `${occ.code_indicateur}-${periodeKey}`
      if (processedOccurrences.has(occKey)) continue
      processedOccurrences.add(occKey)

      const dateDebut = occ.date_debut
      const dateFin = occ.date_fin
      const dateLimite = occ.date_limite_saisie || occ.date_limite

      // Pour le rappel, une occurrence est considérée "à renseigner" si la valeur est vide et
      // qu'une date limite existe. La date fin peut être absente selon les vues.
      if (!dateLimite) continue

      // Ne pas inclure les périodes trop lointaines (au-delà de la fenêtre de rappel).
      // On préfère la date_debut si disponible, sinon la date_fin.
      const refDate = dateDebut || dateFin
      if (indicateurFutureLimitStr && refDate && refDate > indicateurFutureLimitStr) continue

      const retard = calculateRetard(dateLimite)
      const indicateurData = {
        code_groupe: groupeCodes,
        libelle_indicateur: ind.libelle_indicateur,
        periodicite: ind.periodicite || '-',
        periode: occ.periode || `${dateDebut} - ${dateFin}`,
        date_debut: dateDebut || '-',
        date_fin: dateFin,
        date_limite: dateLimite,
        jours_retard: retard.jours_retard,
        jours_restants: retard.jours_restants
      }

      // Règles de classement :
      // - En retard : date limite < aujourd'hui
      // - À renseigner maintenant : période déjà démarrée (date_debut <= aujourd'hui) et pas en retard
      // - À renseigner prochainement : période à venir (date_debut > aujourd'hui)
      if (todayStr && dateLimite < todayStr) {
        indicateursEnRetard.push(indicateurData)
      } else if (todayStr && dateDebut && dateDebut > todayStr) {
        indicateursAVenir.push(indicateurData)
      } else {
        indicateursARenseigner.push(indicateurData)
      }
    }
  }

  const pendingIndicators = {
    enRetard: indicateursEnRetard,
    aRenseigner: indicateursARenseigner,
    aVenir: indicateursAVenir
  }
  const totalIndicateurs = indicateursEnRetard.length + indicateursARenseigner.length + indicateursAVenir.length

  return { pendingActions, pendingIndicators, totalActions, totalIndicateurs }
}
