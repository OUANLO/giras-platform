import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { upsertRisqueProbabiliteSnapshot } from '@/lib/risques-probabilites-sync'

// Créer le client Supabase directement
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Générer la clé de période à partir des données de période
// Format identique à l'interface: mois-annee, S1-annee, T1-annee, ou annee
function getPeriodeKey(periode) {
  if (periode.mois) {
    return `${periode.mois}-${periode.annee}`
  } else if (periode.trimestre) {
    return `T${periode.trimestre}-${periode.annee}`
  } else if (periode.semestre) {
    return `S${periode.semestre}-${periode.annee}`
  } else {
    return `${periode.annee}`
  }
}

// --- Calculs (mêmes règles que l'écran "Risques") ---
// NB: Ces règles doivent rester cohérentes avec /dashboard/risques/page.js
function calculateAttenuation(efficacite_contr) {
  if (efficacite_contr === 1) return -3
  if (efficacite_contr === 2) return -2
  if (efficacite_contr === 3) return -1
  return 0
}

function calculateImpactNet(impact, efficacite_contr) {
  const attenuation = calculateAttenuation(Number(efficacite_contr))
  return Number(impact) + attenuation
}

function calculateCriticite(impact, proba) {
  const i = Number(impact)
  const p = Number(proba)
  if (!Number.isFinite(i) || !Number.isFinite(p)) return null
  return i * p
}

function getNiveauCriticite(criticite) {
  const c = Number(criticite)
  if (!Number.isFinite(c)) return { label: '-', color: '' }
  if (c >= 1 && c <= 3) return { label: '1-3 (Faible)', color: 'green' }
  if (c >= 4 && c <= 7) return { label: '4-7 (Moyen)', color: 'orange' }
  return { label: '8-16 (Elevé)', color: 'red' }
}

// Insert robuste: retente l'insert en supprimant automatiquement les colonnes inconnues
// (PostgREST renvoie typiquement: "Could not find the '<col>' column of '<table>' in the schema cache")
async function safeInsertWithSchemaFallback(supabase, table, rows) {
  if (!rows || rows.length === 0) return { error: null }

  // S'assurer de toujours envoyer un tableau (PostgREST accepte objet ou array, mais on standardise)
  let payload = Array.isArray(rows) ? rows : [rows]
  let lastError = null

  // On limite le nombre de retries pour éviter une boucle infinie
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase.from(table).insert(payload)
    if (!error) return { error: null }

    lastError = error
    const msg = typeof error.message === 'string' ? error.message : ''
    const m = msg.match(/Could not find the '([^']+)' column/i)

    // Si la colonne est inconnue, on la supprime et on retente
    if (m && m[1]) {
      const badCol = m[1]
      payload = payload.map((r) => {
        const copy = { ...(r || {}) }
        delete copy[badCol]
        return copy
      })
      continue
    }

    // Sinon, on s'arrête (contrainte, type mismatch, etc.)
    break
  }

  return { error: lastError }
}

// GET - Test simple pour vérifier que l'API fonctionne
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'API fermeture période disponible',
    timestamp: new Date().toISOString()
  })
}

// POST - Vérifier et fermer une période
export async function POST(request) {
  try {
    const supabase = getSupabaseClient()
    
    if (!supabase) {
      return NextResponse.json({ 
        error: 'Configuration Supabase manquante. Vérifiez les variables d\'environnement.' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { action, periodeId, fichierCartographie, modificateur } = body
    
    if (!periodeId) {
      return NextResponse.json({ error: 'periodeId requis' }, { status: 400 })
    }
    
    // Récupérer la période
    const { data: periode, error: periodeError } = await supabase
      .from('periodes_evaluation')
      .select('*')
      .eq('id', periodeId)
      .single()
    
    if (periodeError) {
      console.error('Erreur récupération période:', periodeError)
      return NextResponse.json({ error: 'Erreur base de données: ' + periodeError.message }, { status: 500 })
    }
    
    if (!periode) {
      return NextResponse.json({ error: 'Période non trouvée' }, { status: 404 })
    }
    
    if (periode.statut !== 'Ouvert') {
      return NextResponse.json({ error: 'Cette période n\'est pas ouverte' }, { status: 400 })
    }

    // Construire le libellé de la période
    let libellePeriode = `${periode.annee}`
    if (periode.semestre) libellePeriode = `Semestre ${periode.semestre} ${periode.annee}`
    else if (periode.trimestre) libellePeriode = `Trimestre ${periode.trimestre} ${periode.annee}`
    else if (periode.mois) libellePeriode = `${periode.mois} ${periode.annee}`

    // =====================================================
    // ACTION: VERIFY
    // =====================================================
    if (action === 'verify') {
      // 1. Récupérer tous les risques actifs avec leurs indicateurs
      const { data: risques, error: risquesError } = await supabase
        .from('risques')
        .select('*, indicateur:indicateurs(*)')
        .eq('statut', 'Actif')
      
      if (risquesError) {
        console.error('Erreur récupération risques:', risquesError)
      }
      
      // 2. Récupérer les indicateurs risques actifs
      const { data: indicateurs, error: indicateursError } = await supabase
        .from('indicateurs')
        .select('*')
        .eq('statut', 'Actif')
        // Selon les données, le groupe peut être stocké comme "Risque" ou "Indicateurs des risques".
        // On accepte les deux pour ne pas bloquer la fermeture.
        .in('code_groupe', ['Risque', 'Indicateurs des risques', 'Indicateurs risques'])
      
      if (indicateursError) {
        console.error('Erreur récupération indicateurs:', indicateursError)
      }
      
      // 3. Récupérer les occurrences pour cette période
      // Note: Les occurrences qualitatifs peuvent ne pas avoir le champ 'annee' renseigné
      // On récupère donc par année OU par période directement
      const { data: occurrencesParAnnee, error: occurrencesError1 } = await supabase
        .from('indicateur_occurrences')
        .select('*')
        .eq('annee', periode.annee)
      
      if (occurrencesError1) {
        console.error('Erreur récupération occurrences par année:', occurrencesError1)
      }
      
      // Récupérer aussi les occurrences par période (pour les qualitatifs sans année)
      const periodeKey = getPeriodeKey(periode)
      const { data: occurrencesParPeriode, error: occurrencesError2 } = await supabase
        .from('indicateur_occurrences')
        .select('*')
        .eq('periode', periodeKey)
      
      if (occurrencesError2) {
        console.error('Erreur récupération occurrences par période:', occurrencesError2)
      }
      
      // Fusionner les occurrences (éviter les doublons)
      const occurrencesMap = new Map()
      for (const occ of (occurrencesParAnnee || [])) {
        occurrencesMap.set(occ.id, occ)
      }
      for (const occ of (occurrencesParPeriode || [])) {
        occurrencesMap.set(occ.id, occ)
      }
      const allOccurrences = Array.from(occurrencesMap.values())
      
      // Filtrer par période
      const occurrencesFiltrees = filtrerOccurrencesParPeriode(allOccurrences, periode)
      
      // 3bis. Récupérer les probabilités manuelles (tous risques)
      // NB: la probabilité saisie manuellement est stockée dans la table risques_probabilites
      // et doit être prise en compte pour la fermeture de période, y compris pour les risques quantitatifs
      const { data: probabilitesManuelles } = await supabase
        .from('risques_probabilites')
        .select('*')
        .eq('periode', periodeKey)

      const probaManuelleByRisque = new Map(
        (probabilitesManuelles || []).map(p => [p.code_risque, p])
      )
      
      // 4. Vérifier les risques actifs non évalués
      // Un risque est ÉVALUÉ pour cette période si :
      // - Impact est renseigné (obligatoire à la création, toujours présent)
      // - Efficacité de contrôle est renseignée (obligatoire à la création, toujours présent)
      // - Probabilité est renseignée pour cette période :
      //   * Si qualitatif (qualitatif='Oui' ou pas d'indicateur) → probabilité dans risques_probabilites
      //   * Si quantitatif → occurrence avec 'val_indicateur' renseigné
      
      const risquesNonEvalues = []
      let risquesEvaluesCount = 0
      
      for (const risque of (risques || [])) {
        // Impact et efficacité sont obligatoires à la création, donc toujours présents
        // On vérifie quand même au cas où
        const hasImpact = risque.impact && risque.impact > 0
        const hasEfficacite = risque.efficacite_contr && risque.efficacite_contr > 0
        
        // Déterminer si le risque est qualitatif (selon la fiche risque) ou s'il n'a pas d'indicateur
        const isQualitatif = risque.qualitatif === 'Oui' || !risque.code_indicateur
        
        // Vérifier si la probabilité est renseignée
        let hasProba = false
        
        // Règle de fermeture (cohérente avec l'UI) :
        // - Une probabilité peut être renseignée soit via l'indicateur (val_indicateur) soit via la saisie manuelle.
        // - La saisie manuelle doit être prise en compte via risques_probabilites (même pour les risques quantitatifs).
        // - Le champ indicateur_occurrences.probabilite peut exister, mais ne doit pas être la seule source.

        const manual = probaManuelleByRisque.get(risque.code_risque)
        const hasManualProba = !!(manual && manual.probabilite !== null && manual.probabilite !== undefined && `${manual.probabilite}` !== '')

        if (isQualitatif) {
          // Risque qualitatif : probabilité uniquement via saisie manuelle
          hasProba = hasManualProba
        } else {
          // Risque quantitatif :
          // - évalué si l'indicateur a une valeur pour la période
          // - OU si une probabilité manuelle a été saisie
          const indicOcc = occurrencesFiltrees.find(o => o.code_indicateur === risque.code_indicateur)
          const hasValIndicateur = !!(indicOcc && indicOcc.val_indicateur !== null && indicOcc.val_indicateur !== undefined && `${indicOcc.val_indicateur}` !== '')
          const hasOccProba = !!(indicOcc && indicOcc.probabilite !== null && indicOcc.probabilite !== undefined && `${indicOcc.probabilite}` !== '')
          hasProba = hasValIndicateur || hasOccProba || hasManualProba
        }
        
        // Le risque est évalué si les 3 conditions sont remplies
        const isEvalue = hasImpact && hasEfficacite && hasProba
        
        if (isEvalue) {
          risquesEvaluesCount++
        } else {
          // Déterminer la raison
          let raison = 'Risque non évalué'
          if (!hasImpact && !hasEfficacite && !hasProba) {
            raison = 'Impact, efficacité et probabilité non renseignés'
          } else if (!hasImpact) {
            raison = 'Impact non renseigné'
          } else if (!hasEfficacite) {
            raison = 'Efficacité de contrôle non renseignée'
          } else if (!hasProba) {
            if (isQualitatif) {
              raison = 'Probabilité non renseignée (saisie manuelle manquante)'
            } else {
              raison = 'Probabilité non renseignée (valeur indicateur non saisie et saisie manuelle absente)'
            }
          }
          
          risquesNonEvalues.push({
            code_risque: risque.code_risque,
            libelle: risque.libelle_risque,
            raison: raison,
            type: isQualitatif ? 'Qualitatif' : 'Quantitatif'
          })
        }
      }
      
      // 5. Vérifier les indicateurs du groupe "Indicateurs des risques" non renseignés et compter les occurrences
      const indicateursNonRenseignes = []
      let totalOccurrencesIndicateurs = 0
      let occurrencesRenseignees = 0
      
      for (const ind of (indicateurs || [])) {
        const occInd = occurrencesFiltrees.filter(o => o.code_indicateur === ind.code_indicateur)
        totalOccurrencesIndicateurs += occInd.length
        
        const renseignes = occInd.filter(o => o.val_indicateur !== null && o.val_indicateur !== undefined && o.val_indicateur !== '')
        occurrencesRenseignees += renseignes.length
        
        const nonRenseignes = occInd.filter(o => o.val_indicateur === null || o.val_indicateur === undefined || o.val_indicateur === '')
        
        if (nonRenseignes.length > 0) {
	          indicateursNonRenseignes.push({
	            code_indicateur: ind.code_indicateur,
	            libelle: ind.libelle_indicateur,
	            code_risque: ind.code_risque,
	            responsable: ind.responsable,
	            occurrences: nonRenseignes.map(o => ({
	              id: o.id,
	              periode: o.periode,
	              date_limite: o.date_limite_saisie,
	            })),
	          })
        }
      }
      
      const canClose = risquesNonEvalues.length === 0 && indicateursNonRenseignes.length === 0
      const hasBlockingIssues = risquesNonEvalues.length > 0
      
      return NextResponse.json({
        success: true,
        canClose,
        hasBlockingIssues,
        risquesNonEvalues,
        indicateursNonRenseignes,
        periode: {
          id: periode.id,
          libelle: libellePeriode,
          date_debut: periode.date_debut,
          date_fin: periode.date_fin
        },
        stats: {
          totalRisques: risques?.length || 0,
          totalIndicateurs: indicateurs?.length || 0,
          totalOccurrences: totalOccurrencesIndicateurs, // Nombre total d'occurrences indicateurs risques
          risquesEvalues: risquesEvaluesCount,
          indicateursRenseignes: occurrencesRenseignees // Nombre d'occurrences renseignées
        }
      })
    }
    
    // =====================================================
    // ACTION: CLOSE
    // =====================================================
    if (action === 'close') {
      // Valeurs de référence utilisées tout au long du processus (cohérence et robustesse)
      // NOTE: les tables d'archivage utilisent un `code_periode` en VARCHAR.
      // On stocke donc l'UUID de la période sous forme de string.
      const codePeriode = `${periode.id}`

      // Refaire une vérification rapide côté serveur avant d'archiver
      // (sécurité : évite de fermer une période avec des incohérences côté UI)

      // Sécurité : une période déjà fermée ne doit plus pouvoir être fermée / réouverte.
      if (periode?.id) {
        const { data: periodeDb } = await supabase
          .from('periodes_evaluation')
          .select('id, statut')
          .eq('id', periode.id)
          .maybeSingle()

        if (periodeDb && (periodeDb.statut === 'Fermé' || periodeDb.statut === 'Fermée')) {
          return NextResponse.json({
            success: false,
            message: 'Cette période est déjà fermée et ne peut plus être modifiée.'
          }, { status: 400 })
        }
      }

      // 1. Récupérer toutes les données
      // Schéma DB (scripts/database-setup.sql) : le statut est géré par `statut` (Actif/Inactif)
      // et l'archivage éventuel par `archive` (ajouté via migration v146).
      const { data: risques } = await supabase
        .from('risques')
        .select('*')
        .eq('statut', 'Actif')

      const { data: indicateurs } = await supabase
        .from('indicateurs')
        .select('*')
        .eq('statut', 'Actif')
        .in('code_groupe', ['Risque', 'Indicateurs des risques', 'Indicateurs risques'])
      const { data: processus } = await supabase.from('processus').select('*')
      const { data: structures } = await supabase.from('structures').select('*')

      const periodeKey = getPeriodeKey(periode)

      // Occurrences : par année + par période (cas qualitatif sans année)
      const { data: occAnnee } = await supabase
        .from('indicateur_occurrences')
        .select('*')
        .eq('annee', periode.annee)

      const { data: occPeriode } = await supabase
        .from('indicateur_occurrences')
        .select('*')
        .eq('periode', periodeKey)

      const occMap = new Map()
      for (const occ of (occAnnee || [])) occMap.set(occ.id, occ)
      for (const occ of (occPeriode || [])) occMap.set(occ.id, occ)
      const occurrencesFiltrees = filtrerOccurrencesParPeriode(Array.from(occMap.values()), periode)

      // Probabilités manuelles pour la période (tous risques)
      const { data: probabilitesManuelles } = await supabase
        .from('risques_probabilites')
        .select('*')
        .eq('periode', periodeKey)

      const probaManuelleByRisque = new Map((probabilitesManuelles || []).map(p => [p.code_risque, p]))

      // Vérifier conditions de fermeture (même logique que 'verify')
      const risquesNonEvalues = []
      for (const risque of (risques || [])) {
        const hasImpact = risque.impact && risque.impact > 0
        const hasEfficacite = risque.efficacite_contr && risque.efficacite_contr > 0
        const isQualitatif = risque.qualitatif === 'Oui' || !risque.code_indicateur

        const manual = probaManuelleByRisque.get(risque.code_risque)
        const hasManualProba = !!(manual && manual.probabilite !== null && manual.probabilite !== undefined && `${manual.probabilite}` !== '')

        let hasProba = false
        if (isQualitatif) {
          hasProba = hasManualProba
        } else {
          const indicOcc = occurrencesFiltrees.find(o => o.code_indicateur === risque.code_indicateur)
          const hasValIndicateur = !!(indicOcc && indicOcc.val_indicateur !== null && indicOcc.val_indicateur !== undefined && `${indicOcc.val_indicateur}` !== '')
          const hasOccProba = !!(indicOcc && indicOcc.probabilite !== null && indicOcc.probabilite !== undefined && `${indicOcc.probabilite}` !== '')
          hasProba = hasValIndicateur || hasOccProba || hasManualProba
        }

        const isEvalue = hasImpact && hasEfficacite && hasProba
        if (!isEvalue) {
          risquesNonEvalues.push({ code_risque: risque.code_risque, libelle: risque.libelle_risque })
        }
      }

      if (risquesNonEvalues.length > 0) {
        return NextResponse.json({
          error: `Impossible de fermer la période: ${risquesNonEvalues.length} risque(s) actif(s) non évalué(s) pour cette période.`,
          risquesNonEvalues
        }, { status: 400 })
      }

      // Indicateurs risques non renseignés (bloquant tant qu'ils existent)
      const indicateursNonRenseignes = []
      for (const ind of (indicateurs || [])) {
        const occInd = occurrencesFiltrees.filter(o => o.code_indicateur === ind.code_indicateur)
        const nonRenseignes = occInd.filter(o => o.val_indicateur === null || o.val_indicateur === undefined || `${o.val_indicateur}` === '')
        if (nonRenseignes.length > 0) {
          // IMPORTANT: fermer correctement l'appel push({ ... })
          indicateursNonRenseignes.push({
            code_indicateur: ind.code_indicateur,
            libelle: ind.libelle_indicateur,
            occurrences: nonRenseignes.map(o => ({
              id: o.id,
              periode: o.periode,
              date_limite: o.date_limite_saisie,
            })),
          })
        }
      }

      if (indicateursNonRenseignes.length > 0) {
        return NextResponse.json({
          error: `Impossible de fermer la période: ${indicateursNonRenseignes.length} indicateur(s) du groupe "Indicateurs des risques" ont des occurrences non renseignées. Veuillez les renseigner ou les supprimer avant fermeture.`,
          indicateursNonRenseignes
        }, { status: 400 })
      }
      
      // 2. Archiver les risques (une ligne par risque, ou par occurrence si un indicateur est lié)
      const archiveRisques = []

      const risquesFiltrees = risques || []
      const indicateurByCode = new Map((indicateurs || []).map(i => [i.code_indicateur, i]))
      const processusByCode = new Map((processus || []).map(p => [p.code_processus, p]))
      const structuresByCode = new Map((structures || []).map(s => [s.code_structure, s]))

      // Occurrences indexées par code_indicateur (c'est la clé la plus fiable)
      const occByIndicateur = new Map()
      for (const occ of (occurrencesFiltrees || [])) {
        if (!occ?.code_indicateur) continue
        if (!occByIndicateur.has(occ.code_indicateur)) occByIndicateur.set(occ.code_indicateur, [])
        occByIndicateur.get(occ.code_indicateur).push(occ)
      }

      for (const risque of risquesFiltrees) {
        const isQualitatif = risque.qualitatif === 'Oui' || !risque.code_indicateur

        const occs = (!isQualitatif && risque.code_indicateur)
          ? (occByIndicateur.get(risque.code_indicateur) || [])
          : []

        // S'il n'y a pas d'occurrence liée, on archive quand même 1 ligne par risque
        const rows = (occs.length > 0) ? occs : [null]

        for (const occ of rows) {
          const indic = (occ?.code_indicateur)
            ? indicateurByCode.get(occ.code_indicateur)
            : (risque.code_indicateur ? indicateurByCode.get(risque.code_indicateur) : null)

          const manual = probaManuelleByRisque.get(risque.code_risque)
          const hasManual = !!(manual && manual.probabilite !== null && manual.probabilite !== undefined && `${manual.probabilite}` !== '')

          // Probabilité : priorité à la saisie manuelle, sinon à l'occurrence (si existante)
          const probaValue = hasManual
            ? Number(manual.probabilite)
            : (occ?.probabilite !== null && occ?.probabilite !== undefined && `${occ.probabilite}` !== '')
              ? Number(occ.probabilite)
              : null

          const impactBrut = (risque.impact !== null && risque.impact !== undefined && `${risque.impact}` !== '')
            ? Number(risque.impact)
            : null

          const efficaciteContr = (risque.efficacite_contr !== null && risque.efficacite_contr !== undefined && `${risque.efficacite_contr}` !== '')
            ? Number(risque.efficacite_contr)
            : null

          const impactNet = calculateImpactNet(impactBrut, efficaciteContr)
          const criticiteBrute = calculateCriticite(impactBrut, probaValue)
          const criticiteNette = calculateCriticite(impactNet, probaValue)
          const niveauCritBrute = getNiveauCriticite(criticiteBrute)?.label || null
          const niveauCritNette = getNiveauCriticite(criticiteNette)?.label || null

          const proc = risque.code_processus ? processusByCode.get(risque.code_processus) : null
          const str = risque.code_structure ? structuresByCode.get(risque.code_structure) : null

          archiveRisques.push({
            // Références période
            code_periode: codePeriode,
            libelle_periode: libellePeriode,
            date_debut_periode: periode.date_debut,
            date_fin_periode: periode.date_fin,

            // Champs indicateur/occurrence (peuvent être null)
            qualitatif: risque.qualitatif ?? null,
            ind_obtenu: risque.ind_obtenu ?? null,
            cible: occ?.cible ?? null,
            responsable: occ?.responsable ?? null,
            date_limite_saisie: occ?.date_limite_saisie ?? null,
            date_saisie: occ?.date_saisie ?? null,
            jours_retard: (occ?.nb_jr_retard ?? 0),
            niveau_retard: occ?.statut ?? null,

            // Références organisation
            code_processus: risque.code_processus ?? null,
            libelle_processus: risque.libelle_processus ?? proc?.libelle_processus ?? null,
            code_structure: risque.code_structure ?? null,
            libelle_structure: risque.libelle_structure ?? str?.libelle_structure ?? null,

            // Références risque
            code_risque: risque.code_risque,
            libelle_risque: risque.libelle_risque,
            code_indicateur: (occ?.code_indicateur ?? risque.code_indicateur ?? null),
            libelle_indicateur: indic?.libelle_indicateur ?? null,
            valeur_indicateur: (occ?.val_indicateur ?? null),

            // Valeurs d'évaluation
            impact_brut: impactBrut,
            efficacite_controle: efficaciteContr,
            probabilite: probaValue,
            score_brut: criticiteBrute,
            score_net: criticiteNette,
            impact_net: impactNet,
            criticite_brute: criticiteBrute,
            niveau_criticite_brute: niveauCritBrute,
            criticite_nette: criticiteNette,
            niveau_criticite_nette: niveauCritNette,
            // Métadonnées d'archivage (la "photo" est stockée dans risques_probabilites)
            archive_par: modificateur || null,
          })
        }
      }
      // Nouveau processus d'archivage:
      // - Plus de tables archive_*.
      // - La "photo" figée de la période est stockée dans risques_probabilites (colonnes étendues)
      //   et marquée archive='Oui'.
      const periodeObj = {
        id: codePeriode,
        libelle: periodeKey,
        date_debut: periode.date_debut,
        date_fin: periode.date_fin,
        statut: 'Fermé'
      }

      if (archiveRisques.length > 0) {
        for (const r of archiveRisques) {
          // On laisse upsertRisqueProbabiliteSnapshot recalculer les champs à partir des tables sources
          // afin d'assurer cohérence (processus/structure/indicateur/occurrence).
          const { error: snapErr } = await upsertRisqueProbabiliteSnapshot({
            supabase,
            periode: periodeObj,
            codeRisque: r.code_risque,
            modificateur,
            probabiliteOverride: r.probabilite,
            archive: true,
          })

          if (snapErr) {
            console.error('Erreur snapshot risques_probabilites:', snapErr)
            return NextResponse.json({ error: 'Erreur archivage (risques_probabilites): ' + (snapErr.message || snapErr) }, { status: 500 })
          }
        }
      }

      // Supprimer les occurrences de la période fermée (la valeur figée est dans risques_probabilites)
      // On ne supprime que les occurrences des indicateurs du groupe "Indicateurs des risques".
      const codesIndicateursRisques = new Set((indicateurs || []).map(i => i.code_indicateur))
      const occurrencesARchiver = occurrencesFiltrees.filter(occ => codesIndicateursRisques.has(occ.code_indicateur))
      if (occurrencesARchiver.length > 0) {
        const occurrencesIds = occurrencesARchiver.map(o => o.id)
        await supabase
          .from('indicateur_occurrences')
          .delete()
          .in('id', occurrencesIds)
      }

      // 4. Enregistrer la cartographie
      if (fichierCartographie) {
        // IMPORTANT: certains environnements n'ont pas encore appliqué la migration v146,
        // donc la table `fichiers_cartographie` peut ne pas contenir toutes les colonnes
        // (ex: `libelle_periode`). PostgREST renvoie alors une erreur "schema cache".
        // On effectue un insert robuste avec fallback en supprimant les colonnes inconnues.
        const basePayload = {
          code_periode: codePeriode,
          libelle_periode: libellePeriode,
          nom_fichier: `Cartographie_${String(libellePeriode || codePeriode).replace(/\s+/g, '_')}.pdf`,
          url_fichier: fichierCartographie,
          upload_par: modificateur,
        }

        const tryInsertCarto = async (payload) => {
          return await supabase.from('fichiers_cartographie').insert(payload)
        }

        let { error: cartoError } = await tryInsertCarto(basePayload)

        // Fallback 1: retirer une colonne inconnue mentionnée par PostgREST
        if (cartoError && typeof cartoError.message === 'string') {
          const m = cartoError.message.match(/Could not find the '([^']+)' column/i)
          if (m && m[1]) {
            const badCol = m[1]
            const fallback = { ...basePayload }
            delete fallback[badCol]
            ;({ error: cartoError } = await tryInsertCarto(fallback))
          }
        }

        // Fallback 2: payload minimal (ultra-compatible)
        if (cartoError) {
          const minimalPayload = {
            code_periode: codePeriode,
            nom_fichier: `Cartographie_${String(libellePeriode || codePeriode).replace(/\s+/g, '_')}.pdf`,
            url_fichier: fichierCartographie,
            upload_par: modificateur,
          }
          ;({ error: cartoError } = await tryInsertCarto(minimalPayload))
        }

        if (cartoError) {
          console.error('Erreur enregistrement cartographie:', cartoError)
          return NextResponse.json(
            { success: false, error: `Erreur enregistrement cartographie: ${cartoError.message}` },
            { status: 500 }
          )
        }
      }
      
      // 5. Fermer la période
      // IMPORTANT: la structure de la table `periodes_evaluation` varie selon les déploiements.
      // Sur certains environnements, il n'existe pas de colonnes d'audit (ex: `modificateur`, `date_modification`).
      // Pour éviter un 500 bloquant, on n'update ici que les champs garantis (statut).
      // IMPORTANT: la contrainte SQL `periodes_evaluation_statut_check` (voir scripts/database-setup.sql)
      // autorise uniquement: 'Ouvert' | 'Fermé'.
      // Il faut donc utiliser exactement ces valeurs (accents inclus).
      const { error: updateError } = await supabase
        .from('periodes_evaluation')
        .update({ statut: 'Fermé' })
        .eq('id', periodeId)
      
      if (updateError) {
        return NextResponse.json({ error: 'Erreur fermeture période: ' + updateError.message }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        message: 'Période fermée avec succès',
        archived: {
          risques: archiveRisques.length,
          occurrences: archiveOccurrences.length
        }
      })
    }
    
    return NextResponse.json({ error: 'Action non reconnue. Utilisez "verify" ou "close".' }, { status: 400 })
    
  } catch (error) {
    console.error('Erreur API fermeture:', error)
    return NextResponse.json({ error: 'Erreur serveur: ' + error.message }, { status: 500 })
  }
}

// Fonction pour filtrer les occurrences par période
function filtrerOccurrencesParPeriode(occurrences, periode) {
  if (!occurrences || !Array.isArray(occurrences)) return []
  
  // Générer les clés de période possibles
  const periodeKey = getPeriodeKey(periode)
  
  return occurrences.filter(occ => {
    if (!occ) return false
    
    // Correspondance exacte de la clé de période
    if (occ.periode === periodeKey) {
      return true
    }
    
    // Correspondance par année (pour les occurrences avec année mais période différente)
    if (occ.annee && occ.annee !== periode.annee) {
      return false
    }
    
    if (periode.semestre) {
      const moisSemestre1 = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin']
      const moisSemestre2 = ['Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
      const mois = (periode.semestre === 1 || periode.semestre === 'S1' || periode.semestre === '1') ? moisSemestre1 : moisSemestre2
      
      if (occ.periode && (occ.periode.includes(`Semestre ${periode.semestre}`) || occ.periode.includes(`S${periode.semestre}`) || occ.periode.includes(`-S${periode.semestre}`))) {
        return true
      }
      if (occ.periode && mois.some(m => occ.periode.includes(m))) {
        return true
      }
      const trimestres = (periode.semestre === 1 || periode.semestre === 'S1' || periode.semestre === '1') ? ['1', '2'] : ['3', '4']
      if (occ.periode && trimestres.some(t => occ.periode.includes(`Trimestre ${t}`) || occ.periode.includes(`T${t}`) || occ.periode.includes(`-T${t}`))) {
        return true
      }
      return false
    }
    
    if (periode.trimestre) {
      return occ.periode && (
        occ.periode.includes(`Trimestre ${periode.trimestre}`) || 
        occ.periode.includes(`T${periode.trimestre}`) ||
        occ.periode.includes(`-T${periode.trimestre}`) ||
        occ.trimestre === periode.trimestre
      )
    }
    
    if (periode.mois) {
      return occ.periode && (
        occ.periode.includes(periode.mois) ||
        occ.periode.includes(`-${periode.mois}`)
      )
    }
    
    // Période annuelle - inclure toutes les occurrences de cette année
    return true
  })
}
