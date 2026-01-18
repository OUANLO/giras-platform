import { calculateCriticite, calculateImpactNet, getNiveauCriticite } from '@/lib/risk-metrics'

/**
 * Construit et upsert une ligne "snapshot" dans risques_probabilites pour un risque et une période.
 * - Utilisé par l'analyse qualitative (proba manuelle)
 * - Utilisé par le suivi indicateurs (proba calculée)
 * - Utilisé lors de la fermeture (marquage archive)
 */
export async function upsertRisqueProbabiliteSnapshot({
  supabase,
  periode,
  codeRisque,
  modificateur,
  probabiliteOverride = null,
  // Quand l'appel vient directement de la sous-rubrique "Analyse",
  // on veut que risques_probabilites reflète *exactement* les valeurs du tableau.
  // Ce payload permet d'écraser les valeurs provenant de risques/occurrence.
  // Champs attendus (tous optionnels):
  //  - code_indicateur, libelle_indicateur, valeur_indicateur
  //  - ind_obtenu, responsable, date_limite_saisie, date_saisie, jours_retard, niveau_retard
  //  - impact_brut, efficacite_controle, impact_net
  //  - probabilite
  analyseSnapshot = null,
  archive = false,
  // Quand on saisit une probabilité manuelle pour un risque qualitatif,
  // on veut une ligne "snapshot" unique même sans indicateur.
  // Ce flag force la sentinelle 'QUALI' si aucun code indicateur n'est résolu.
  forceQualiSentinel = false,
}) {
  // 1) Charger le risque + enrichissements
  const [{ data: risque, error: errR }, { data: indicateurs }, { data: processus }, { data: structures }] = await Promise.all([
    supabase.from('risques').select('*').eq('code_risque', codeRisque).maybeSingle(),
    supabase.from('indicateurs').select('*'),
    supabase.from('processus').select('code_processus, libelle_processus'),
    supabase.from('structures').select('code_structure, libelle_structure'),
  ])

  if (errR) throw errR
  if (!risque) return { data: null, error: new Error(`Risque introuvable: ${codeRisque}`) }

  const procMap = new Map((processus || []).map(p => [p.code_processus, p]))
  const strMap = new Map((structures || []).map(s => [s.code_structure, s]))

  // "qualitatif" est stocké comme 'Oui'/'Non' (aligné avec le champ risques.qualitatif)
  const q = `${risque.qualitatif}`.toLowerCase().trim()
  const isQualitatif = (q === 'oui' || q === 'true' || q === '1')
  const qualitatifValue = isQualitatif ? 'Oui' : 'Non'

  // 2) Charger l'occurrence d'indicateur (si existante) pour la période.
  // IMPORTANT:
  // - indicateur_occurrences n'est pas forcément indexée par code_risque.
  // - Pour un risque quantitatif, la clé la plus fiable est code_indicateur + periode.
  const risqueCodeInd = risque.code_indicateur ?? risque.id_indicateur ?? null
  let occ = null
  if (risqueCodeInd) {
    const { data: occData } = await supabase
      .from('indicateur_occurrences')
      .select('*')
      .eq('code_indicateur', risqueCodeInd)
      .eq('periode', periode.libelle)
      .order('date_modification', { ascending: false })
      .maybeSingle()
    occ = occData || null

    // Fallback: certains environnements stockent la période en "YYYY" (qualitatif) ou utilisent une autre clé.
    // Si aucune occurrence n'est trouvée avec la clé "periode.libelle", on tente avec l'année uniquement.
    if (!occ && periode?.annee) {
      const { data: occYear } = await supabase
        .from('indicateur_occurrences')
        .select('*')
        .eq('code_indicateur', risqueCodeInd)
        .eq('annee', periode.annee)
        .order('date_modification', { ascending: false })
        .maybeSingle()
      occ = occYear || null
    }
  }

  // 3) Déterminer le code indicateur "snapshot".
  // - Pour les risques qualitatifs, il peut ne pas exister d'indicateur :
  //   on utilise alors une valeur sentinelle stable afin de permettre l'UPSERT et la PK.
  const rawCodeInd = analyseSnapshot?.code_indicateur ?? occ?.code_indicateur ?? risque.code_indicateur ?? risque.id_indicateur ?? null
  const codeIndicateurSnapshot = (() => {
    const v = (rawCodeInd === null || rawCodeInd === undefined) ? '' : String(rawCodeInd).trim()
    if (v) return v
    if (forceQualiSentinel) return 'QUALI'
    return isQualitatif ? 'QUALI' : 'INCONNU'
  })()

  // 4) Déterminer l'indicateur + libellé (si un indicateur réel existe)
  const indic = (() => {
    const code = (rawCodeInd === null || rawCodeInd === undefined) ? null : String(rawCodeInd).trim()
    if (!code) return null
    return (indicateurs || []).find(i => `${i.code_indicateur}` === `${code}` || `${i.id}` === `${code}`) || null
  })()

  // 5) Déterminer la probabilité.
  // Règles:
  //  - si analyseSnapshot fournit probabilite → c'est la source de vérité
  //  - sinon, probabiliteOverride (saisie manuelle) a priorité
  //  - sinon, utiliser la probabilité portée par l'occurrence (cas où une occurrence calcule/porte une proba)
  //  - sinon, conserver la valeur déjà existante dans risques_probabilites si elle existe (fallback)
  let probaValue = null

  const snapProb = analyseSnapshot?.probabilite
  const hasSnapProb = !(snapProb === null || snapProb === undefined || `${snapProb}` === '')

  const { data: existingSnap } = await supabase
    .from('risques_probabilites')
    .select('probabilite')
    .eq('code_risque', codeRisque)
    .eq('periode', periode.libelle)
    .eq('code_indicateur', codeIndicateurSnapshot)
    .maybeSingle()

  if (hasSnapProb) {
    probaValue = Number(snapProb)
  } else if (probabiliteOverride !== null && probabiliteOverride !== undefined && `${probabiliteOverride}` !== '') {
    probaValue = Number(probabiliteOverride)
  } else if (occ?.probabilite !== null && occ?.probabilite !== undefined && `${occ.probabilite}` !== '') {
    probaValue = Number(occ.probabilite)
  } else if (existingSnap?.probabilite !== null && existingSnap?.probabilite !== undefined && `${existingSnap.probabilite}` !== '') {
    probaValue = Number(existingSnap.probabilite)
  }
  if (Number.isNaN(probaValue)) probaValue = null

  const impactBrut = (() => {
    const v = analyseSnapshot?.impact_brut
    if (!(v === null || v === undefined || `${v}` === '')) return Number(v)
    const r = risque.impact
    return (r === null || r === undefined || `${r}` === '') ? null : Number(r)
  })()

  const efficaciteContr = (() => {
    const v = analyseSnapshot?.efficacite_controle
    if (!(v === null || v === undefined || `${v}` === '')) return Number(v)
    const r = risque.efficacite_contr
    return (r === null || r === undefined || `${r}` === '') ? null : Number(r)
  })()

  const impactNet = (() => {
    const v = analyseSnapshot?.impact_net
    if (!(v === null || v === undefined || `${v}` === '')) {
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }
    return calculateImpactNet(impactBrut, efficaciteContr)
  })()

  // Scores (P×I)
  const scoreBrut = calculateCriticite(impactBrut, probaValue)
  const scoreNet = calculateCriticite(impactNet, probaValue)

  // Criticités = index 1..4 + libellé, selon la légende UI.
  const niveauBrut = getNiveauCriticite(scoreBrut)
  const niveauNet = getNiveauCriticite(scoreNet)
  const criticiteBruteIndex = niveauBrut?.level ?? null
  const criticiteNetteIndex = niveauNet?.level ?? null
  const niveauCritBrute = niveauBrut?.label ?? null
  const niveauCritNette = niveauNet?.label ?? null

  const proc = risque.code_processus ? procMap.get(risque.code_processus) : null
  const str = risque.code_structure ? strMap.get(risque.code_structure) : null

  // 6) Construire la ligne "snapshot"
  const row = {
    code_risque: risque.code_risque,
    periode: periode.libelle,
    probabilite: probaValue,
    modificateur: modificateur || null,
    date_modification: new Date().toISOString(),

    // Période
    date_debut_periode: periode.date_debut,
    date_fin_periode: periode.date_fin,

    code_indicateur: codeIndicateurSnapshot,
    libelle_indicateur: analyseSnapshot?.libelle_indicateur ?? (indic?.libelle_indicateur ?? null),
    qualitatif: qualitatifValue,
    ind_obtenu: analyseSnapshot?.ind_obtenu ?? (risque.ind_obtenu ?? null),
    // Schémas possibles: cible, cible_saisie
    cible: analyseSnapshot?.cible ?? (occ?.cible ?? occ?.cible_saisie ?? null),
    responsable: analyseSnapshot?.responsable ?? (occ?.responsable ?? null),
    // Schémas possibles: date_limite_saisie, date_limite
    date_limite_saisie: analyseSnapshot?.date_limite_saisie ?? (occ?.date_limite_saisie ?? occ?.date_limite ?? null),
    date_saisie: analyseSnapshot?.date_saisie ?? (occ?.date_saisie ?? null),
    // Si pas d'occurrence, la valeur doit être vide (NULL), pas "0".
    // Schémas possibles: nb_jr_retard, jours_retard
    jours_retard: analyseSnapshot?.jours_retard ?? (occ?.nb_jr_retard ?? occ?.jours_retard ?? null),
    // Schémas possibles: statut, niveau_retard
    niveau_retard: analyseSnapshot?.niveau_retard ?? (occ?.niveau_retard ?? occ?.statut ?? null),

    code_processus: risque.code_processus ?? null,
    libelle_processus: risque.libelle_processus ?? proc?.libelle_processus ?? null,
    code_structure: risque.code_structure ?? null,
    libelle_structure: risque.libelle_structure ?? str?.libelle_structure ?? null,

    libelle_risque: risque.libelle_risque ?? null,
    valeur_indicateur: analyseSnapshot?.valeur_indicateur ?? (occ?.val_indicateur ?? null),

    impact_brut: impactBrut,
    efficacite_controle: efficaciteContr,
    score_brut: scoreBrut,
    score_net: scoreNet,
    impact_net: impactNet,
    // criticite_* = index (1..4)
    criticite_brute: criticiteBruteIndex,
    niveau_criticite_brute: niveauCritBrute,
    criticite_nette: criticiteNetteIndex,
    niveau_criticite_nette: niveauCritNette,

    // Archivage de période
    archive: archive ? 'Oui' : 'Non',
    date_archivage: archive ? new Date().toISOString() : null,
    archive_par: archive ? (modificateur || null) : null,
  }

  // 6) UPSERT
  // IMPORTANT: l'UPSERT doit matcher EXACTEMENT une contrainte UNIQUE/EXCLUDE.
  // Une photographie est unique par (code_risque, periode, code_indicateur)
  // car la sous-rubrique Analyse peut afficher plusieurs lignes (indicateurs)
  // pour un même risque et une même période.
  const { data, error } = await supabase
    .from('risques_probabilites')
    .upsert(row, { onConflict: 'code_risque,periode,code_indicateur' })
    .select()

  return { data, error }
}
