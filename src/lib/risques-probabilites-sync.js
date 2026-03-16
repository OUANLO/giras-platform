// risques-probabilites-sync.js
//
// Règles (mise à jour 2026-01-24):
// - risques_probabilites stocke l'index de probabilité FINAL par (code_risque, période)
// - Clé UNIQUE: (code_risque, periode)
// - Une seule ligne par risque et par période.
// - Pendant une période OUVERTE: la ligne peut provenir d'une saisie manuelle.
// - À la FERMETURE: la même ligne est mise à jour (archive='Oui') et la probabilité finale
//   est calculée/écrasée pour les risques quantitatifs (et conservée pour les qualitatifs
//   si déjà saisie manuellement).

function getPeriodeLibelle(periode) {
  if (typeof periode === 'string') return String(periode).trim() || null
  if (!periode) return null
  // Priorité au format court normalisé (ex: S1-2025) si disponible
  const preferred = periode.periode_key ?? periode.libelle_court ?? periode.code ?? null
  if (preferred) return String(preferred).trim()

  const lib = periode.libelle ?? periode.periode ?? periode.libelle_periode ?? null
  if (lib) {
    const s = String(lib).trim()
    // Normaliser "Semestre 1 2025" -> "S1-2025" / "Trimestre 2 2025" -> "T2-2025"
    let m = s.match(/semestre\s*(\d)\s*(\d{4})/i)
    if (m) return `S${m[1]}-${m[2]}`
    m = s.match(/trimestre\s*(\d)\s*(\d{4})/i)
    if (m) return `T${m[1]}-${m[2]}`
    // Déjà court ou annuel
    if (/^(S\d|T\d)-\d{4}$/i.test(s) || /^\d{4}$/.test(s)) return s.toUpperCase()
    return s
  }
  if (periode.semestre) return `S${periode.semestre}-${periode.annee}`
  if (periode.trimestre) return `T${periode.trimestre}-${periode.annee}`
  if (periode.mois) {
    const mm = Number(periode.mois)
    if (!Number.isNaN(mm)) return `${mm}-${periode.annee}`
    return `${periode.mois}-${periode.annee}`
  }
  if (periode.annee) return `${periode.annee}`
  return null
}

/**
 * Upsert d'une probabilité (manuel ou calculée à la fermeture).
 * - clé: (code_risque, periode)
 * - archive est un simple état (Oui/Non) et ne fait PAS partie de la clé unique.
 */
export async function upsertRisqueProbabiliteSnapshot({
  supabase,
  periode,
  codeRisque,
  modificateur,
  probabiliteOverride = null,
  analyseSnapshot = null,
  archive = false,
  archivePar = null,
  indObtenu = null,
  // Optionnel: forcer les dates de période (utile pour la saisie manuelle où "periode" est une chaîne)
  dateDebutPeriode = null,
  dateFinPeriode = null,
}) {
  if (!supabase) throw new Error('supabase requis')
  if (!codeRisque) throw new Error('codeRisque requis')

  const periodeLibelle = getPeriodeLibelle(periode)
  if (!periodeLibelle) throw new Error('Période introuvable / libellé manquant')

  const archiveFlag = archive ? 'Oui' : 'Non'

  // Déterminer la probabilité
  const snapProb = analyseSnapshot?.probabilite
  const hasSnapProb = !(snapProb === null || snapProb === undefined || `${snapProb}` === '')

  let probaValue = null
  if (hasSnapProb) probaValue = Number(snapProb)
  else if (probabiliteOverride !== null && probabiliteOverride !== undefined && `${probabiliteOverride}` !== '') {
    probaValue = Number(probabiliteOverride)
  }
  if (Number.isNaN(probaValue)) probaValue = null

  // Si aucune proba fournie, conserver l'existante (si présente)
  if (probaValue === null) {
    const { data: existing } = await supabase
      .from('risques_probabilites')
      .select('probabilite')
      .eq('code_risque', codeRisque)
      .eq('periode', periodeLibelle)
      .maybeSingle()

    if (existing?.probabilite !== null && existing?.probabilite !== undefined && `${existing.probabilite}` !== '') {
      probaValue = Number(existing.probabilite)
      if (Number.isNaN(probaValue)) probaValue = null
    }
  }

  // Règle stricte: aucun enregistrement ne doit être créé/maintenu avec une probabilité vide.
  // - Les endpoints de saisie manuelle doivent supprimer la ligne si l'utilisateur efface la probabilité.
  // - Ici, si on ne peut pas déterminer une probabilité (override + snapshot + existant), on refuse l'UPSERT.
  if (probaValue === null) {
    return { data: null, error: new Error('probabilite manquante: refus d\'enregistrer dans risques_probabilites') }
  }

  const nowIso = new Date().toISOString()

  // Colonnes optionnelles (la base peut évoluer via migrations)
  // On récupère les colonnes existantes pour éviter les erreurs "column does not exist".
  const { data: colsData, error: colsErr } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'risques_probabilites')

  if (colsErr) {
    // Ne pas bloquer si l'accès à information_schema est restreint :
    // on continue avec le minimum.
    // (Sur certains environnements Supabase, information_schema est accessible en lecture.)
  }

  const cols = new Set((colsData || []).map(c => String(c.column_name)))
  const hasCol = (name) => cols.size ? cols.has(name) : true

  // Normaliser et calculer (si besoin) les champs de retard
  const snap = analyseSnapshot || {}
  const snapDateLimite = snap.date_limite_saisie || null
  const snapDateSaisie = snap.date_saisie || null

  const toDateOnlyUtc = (d) => {
    if (!d) return null
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return null
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
  }
  const calcJoursRetard = (dateLimite, dateSaisieOrNow) => {
    const dl = toDateOnlyUtc(dateLimite)
    const dr = toDateOnlyUtc(dateSaisieOrNow)
    if (!dl || !dr) return null
    const diff = Math.floor((dr.getTime() - dl.getTime()) / (24 * 60 * 60 * 1000))
    return Math.max(0, diff)
  }
  const calcNiveauRetard = (jours) => {
    if (jours === null || jours === undefined) return null
    if (jours <= 0) return 'Pas retard'
    if (jours <= 7) return 'Faible'
    if (jours <= 30) return 'Moyen'
    return 'Élevé'
  }

  const joursRetardSnap = (snap.jours_retard === '' || snap.jours_retard === undefined) ? null : snap.jours_retard
  const joursRetardValue = joursRetardSnap !== null && joursRetardSnap !== undefined
    ? Number(joursRetardSnap)
    : calcJoursRetard(snapDateLimite, snapDateSaisie || nowIso)

  const niveauRetardValue = snap.niveau_retard || calcNiveauRetard(joursRetardValue)

  const row = {
    code_risque: codeRisque,
    periode: periodeLibelle,
    probabilite: probaValue,
    modificateur: modificateur || null,
    date_modification: nowIso,
    archive: archiveFlag,
    // ces colonnes existent sur certains environnements (migrations v170/v172)
    date_debut_periode: dateDebutPeriode ?? (periode?.date_debut ?? periode?.date_debut_periode ?? null),
    date_fin_periode: dateFinPeriode ?? (periode?.date_fin ?? periode?.date_fin_periode ?? null),
  }

  // Champs demandés : responsable, date_limite_saisie, date_saisie, jours_retard, niveau_retard
  // IMPORTANT: copier EXACTEMENT les valeurs du tableau Analyse (pas de recalcul, pas de normalisation).
  if (hasCol("responsable")) row.responsable = (snap.responsable === "" || snap.responsable === undefined) ? null : snap.responsable
  if (hasCol("date_limite_saisie")) row.date_limite_saisie = (snap.date_limite_saisie === "" || snap.date_limite_saisie === undefined) ? null : snap.date_limite_saisie
  if (hasCol("date_saisie")) row.date_saisie = (snap.date_saisie === "" || snap.date_saisie === undefined) ? null : snap.date_saisie
  if (hasCol("jours_retard")) row.jours_retard = (snap.jours_retard === "" || snap.jours_retard === undefined) ? null : snap.jours_retard
  if (hasCol("niveau_retard")) row.niveau_retard = (snap.niveau_retard === "" || snap.niveau_retard === undefined) ? null : snap.niveau_retard

  // Commentaires (obligatoires si probabilité renseignée côté UI)
  if (hasCol("commentaires")) row.commentaires = (snap.commentaires === "" || snap.commentaires === undefined) ? null : snap.commentaires

  // Type d'évaluation obtenu (Oui/Non)
  // - 'Non' : probabilité saisie manuellement
  // - 'Oui' : probabilité obtenue via indicateur à la fermeture de période
  if (hasCol("ind_obtenu")) {
    const v = (indObtenu ?? snap.ind_obtenu ?? 'Non')
    row.ind_obtenu = (v === 'Oui') ? 'Oui' : 'Non'
  }

  if (archive) {
    row.date_archivage = nowIso
    row.archive_par = archivePar || modificateur || null
  }

  const { data, error } = await supabase
    .from('risques_probabilites')
    .upsert(row, { onConflict: 'code_risque,periode' })
    .select('*')

  return { data, error }
}

/**
 * Supprime la ligne de risques_probabilites pour (code_risque, période).
 * Utilisé: AVANT d'enregistrer une occurrence d'indicateur risque, si une proba existe
 * (donc saisie manuellement), elle doit être obligatoirement supprimée.
 */
export async function deleteRisqueProbabiliteForRisquePeriode({ supabase, codeRisque, periode }) {
  if (!supabase) throw new Error('supabase requis')
  if (!codeRisque || !periode) return { error: null }

  const p = String(periode).trim()
  const candidates = new Set([p])
  // Compat: supprimer aussi les anciens formats "humains" si la base contenait encore ces libellés
  let m = p.match(/^S(\d)-(\d{4})$/i)
  if (m) candidates.add(`Semestre ${m[1]} ${m[2]}`)
  m = p.match(/^T(\d)-(\d{4})$/i)
  if (m) candidates.add(`Trimestre ${m[1]} ${m[2]}`)

  const { error } = await supabase
    .from('risques_probabilites')
    .delete()
    .eq('code_risque', String(codeRisque))
    .in('periode', Array.from(candidates))

  return { error }
}
