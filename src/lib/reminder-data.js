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

function toNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = String(value).replace('%', '').replace(',', '.').trim()
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function isFalseLike(value) {
  if (value === false || value === null || value === undefined || value === 0) return true
  const s = String(value).trim().toLowerCase()
  return s === '' || s === 'false' || s === '0' || s === 'non' || s === 'no' || s === 'inactive'
}

function isTrueLike(value) {
  return !isFalseLike(value)
}

function isActionActive(action) {
  if (!action) return false
  if (isTrueLike(action.archive)) return false
  const statutAct = String(action.statut_act || '').trim().toLowerCase()
  const statut = String(action.statut || '').trim().toLowerCase()
  if (statutAct && statutAct === 'inactif') return false
  if (statut && statut === 'inactif') return false
  return !!String(action.code_action || '').trim()
}

function isOccurrenceActive(occ) {
  if (!occ) return false
  if (isTrueLike(occ.archive)) return false
  return !!String(occ?.code_action || occ?.code_action_occ || occ?.__actionCode || '').trim()
}

function getRowSortValue(row) {
  const candidates = [row?.date_modification, row?.updated_at, row?.created_at, row?.date_realisation, row?.date_conf, row?.date_fin, row?.date_debut]
  for (const value of candidates) {
    if (!value) continue
    const ts = new Date(value).getTime()
    if (Number.isFinite(ts)) return ts
  }
  const idNum = Number(row?.id)
  return Number.isFinite(idNum) ? idNum : 0
}

function buildEffectiveActionRows(actions, actionOccurrences) {
  const activeActions = (actions || []).filter(isActionActive)
  const activeActionsByCode = new Map(
    activeActions.map((action) => [String(action?.code_action || '').trim(), action])
  )

  const rows = []
  const seenOccurrenceKeys = new Set()
  const actionsWithOccurrences = new Set()

  for (const occ of actionOccurrences || []) {
    if (!isOccurrenceActive(occ)) continue
    const code = String(occ?.code_action || occ?.code_action_occ || occ?.__actionCode || '').trim()
    if (!code || !activeActionsByCode.has(code)) continue

    const action = activeActionsByCode.get(code)
    const occurrenceKey = String(occ?.code_occurrence || occ?.id || `${code}-${getRowSortValue(occ)}`)
    if (seenOccurrenceKeys.has(occurrenceKey)) continue
    seenOccurrenceKeys.add(occurrenceKey)
    actionsWithOccurrences.add(code)

    rows.push({
      ...action,
      ...occ,
      code_action: code,
      code_occurrence: occ?.code_occurrence || null,
      occurrence_id: occ?.id || null,
      responsable: occ?.responsable || action?.responsable || null,
      code_groupe: action?.code_groupe || occ?.code_groupe || null,
      libelle_action: action?.libelle_action || occ?.libelle_action || null,
      date_debut: occ?.date_debut || action?.date_debut || null,
      date_fin: occ?.date_fin || action?.date_fin || null,
      tx_avancement: toNumber(occ?.tx_avancement) ?? toNumber(action?.tx_avancement) ?? 0,
      statut: action?.statut || action?.statut_act || 'Actif'
    })
  }

  for (const action of activeActions) {
    const code = String(action?.code_action || '').trim()
    if (!code || actionsWithOccurrences.has(code)) continue
    rows.push({
      ...action,
      code_action: code,
      code_occurrence: null,
      occurrence_id: null,
      responsable: action?.responsable || null,
      code_groupe: action?.code_groupe || null,
      libelle_action: action?.libelle_action || null,
      date_debut: action?.date_debut || null,
      date_fin: action?.date_fin || null,
      tx_avancement: toNumber(action?.tx_avancement) ?? 0,
      statut: action?.statut || action?.statut_act || 'Actif'
    })
  }

  return rows.sort((a, b) => getRowSortValue(b) - getRowSortValue(a))
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
  const effectiveActionRows = buildEffectiveActionRows(actions, actionOccurrences)
  const userActionOccurrences = effectiveActionRows.filter((occ) => isSameResponsable(occ.responsable))
  const actionsEnRetard = []
  const actionsEnCours = []
  const actionsAVenir = []

  for (const occ of userActionOccurrences) {
    const txAvancement = toNumber(occ?.tx_avancement) ?? 0
    if (txAvancement >= 100) continue
    const action = (actions || []).find(a => String(a?.code_action || '').trim() === String(occ?.code_action || '').trim())
    const dateDebut = occ?.date_debut || action?.date_debut || null
    const dateFin = occ?.date_fin || action?.date_fin || null

    const retard = calculateRetard(dateFin)
    const actionData = {
      code_groupe: occ?.code_groupe || action?.code_groupe || '-',
      libelle_action: occ?.libelle_action || action?.libelle_action || 'Action sans libellé',
      date_debut: dateDebut,
      date_fin: dateFin,
      tx_avancement: txAvancement,
      niveau_avancement: getNiveauAvancement(txAvancement),
      jours_retard: retard.jours_retard,
      jours_restants: retard.jours_restants
    }

    if (dateFin && todayStr && dateFin < todayStr) {
      actionsEnRetard.push(actionData)
      continue
    }

    if (dateDebut && todayStr && dateDebut <= todayStr) {
      actionsEnCours.push(actionData)
      continue
    }

    if (dateDebut && todayStr && dateDebut > todayStr) {
      actionsAVenir.push(actionData)
    }
  }

  const pendingActions = { enRetard: actionsEnRetard, enCours: actionsEnCours, aVenir: actionsAVenir }
  const totalActions = actionsEnRetard.length + actionsEnCours.length + actionsAVenir.length

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
