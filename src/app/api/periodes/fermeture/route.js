import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
        .in('code_groupe', ['RISQUE', 'Risque', 'Indicateurs des risques', 'Indicateurs risques'])
      
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
        // - La source de vérité de la probabilité est risques_probabilites.

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
          hasProba = hasValIndicateur || hasManualProba
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
        .in('code_groupe', ['RISQUE', 'Risque', 'Indicateurs des risques', 'Indicateurs risques'])
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
          // La probabilité n'est plus stockée sur indicateur_occurrences (colonne supprimée).
          // Source: risques_probabilites (saisie manuelle ou snapshot calculé à la saisie de l'indicateur).
          hasProba = hasValIndicateur || hasManualProba
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
      
      // 2. Archivage de la période (occurrences risques + probabilités)
      const nowIso = new Date().toISOString()

      // 2.1 Archiver toutes les probabilités NON archivées de la période
      // (elles correspondent aux saisies manuelles pendant la période ouverte)
      await supabase
        .from('risques_probabilites')
        .update({
          archive: 'Oui',
          date_archivage: nowIso,
          archive_par: modificateur || null,
          date_modification: nowIso,
        })
        .eq('periode', periodeKey)
        .eq('archive', 'Non')

      // 2.2 Archiver toutes les occurrences des indicateurs du groupe "Risque" pour cette période,
      // qu'ils soient liés à un risque ou non.
      // (Exigence: à la fermeture, tous les indicateurs du groupe risques doivent être archivés.)
      const riskGroupIndCodes = Array.from(
        new Set(
          [
            // Indicateurs du groupe "Risque" (source: table indicateurs)
            ...(indicateurs || []).map((i) => i?.code_indicateur),
            // Sécurité: indicateurs référencés directement depuis les risques actifs
            ...(risques || []).map((r) => r?.code_indicateur),
          ]
            .filter((v) => v !== null && v !== undefined && `${v}` !== '')
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v))
        )
      )

      if (riskGroupIndCodes.length > 0) {
        await supabase
          .from('indicateur_occurrences')
          .update({
            archive: true,
            date_archive: nowIso,
            archive_par: modificateur || null,
            date_modification: nowIso,
          })
          .eq('periode', periodeKey)
          .in('code_indicateur', riskGroupIndCodes)
          .eq('archive', false)
      }

      // 2.3 Renseigner risques_probabilites avec les probabilités finales des risques
      // Pour les risques quantitatifs: calcul basé sur les seuils de l'indicateur.
      // Pour les risques qualitatifs: la probabilité est celle saisie manuellement.
      const indicateurByCode = new Map((indicateurs || []).map((i) => [`${i.code_indicateur}`, i]))

      const calcProbabilite = (valIndicateur, indic, sensFallback = null) => {
        if (valIndicateur === null || valIndicateur === undefined || `${valIndicateur}` === '') return null
        if (!indic) return null

        const val = parseFloat(valIndicateur)
        const s1 = parseFloat(indic.seuil1)
        const s2 = parseFloat(indic.seuil2)
        const s3 = parseFloat(indic.seuil3)
        if (!Number.isFinite(val) || !Number.isFinite(s1) || !Number.isFinite(s2) || !Number.isFinite(s3)) return null

        const sens = String(indic.sens || sensFallback || '').trim()
        if (sens === 'Positif') {
          if (val >= s3) return 1
          if (val >= s2) return 2
          if (val >= s1) return 3
          return 4
        }
        // Négatif (ou non défini)
        if (val <= s1) return 1
        if (val <= s2) return 2
        if (val <= s3) return 3
        return 4
      }

      const finalRows = []

      // Champs "Analyse" à snapshotter dans risques_probabilites lors de la fermeture.
      // Exigence:
      // - Pour les risques évalués quantitativement (ind_obtenu='Oui'), renseigner responsable/date_limite_saisie/date_saisie/jours_retard/niveau_retard.
      // - Pour les qualitatifs (ind_obtenu='Non'), conserver les valeurs déjà saisies manuellement dans risques_probabilites si elles existent.
      const dateLimitePeriode = periode.date_limite_saisie ?? null

      const calcJoursRetard = (dateLimite, dateSaisieOrNull) => {
        if (!dateLimite) return null
        const dl = new Date(`${dateLimite}T00:00:00`)
        const dlNorm = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate())
        const ds = dateSaisieOrNull ? new Date(dateSaisieOrNull) : new Date()
        const dsNorm = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate())
        return Math.max(0, Math.floor((dsNorm - dlNorm) / (1000 * 60 * 60 * 24)))
      }

      const calcNiveauRetard = (jours) => {
        if (jours === null || jours === undefined) return '-'
        return Number(jours) <= 0 ? 'Pas retard' : 'Retard'
      }

      for (const risque of (risques || [])) {
        const q = String(risque?.qualitatif || '').toLowerCase().trim()
        const isQualitatif = q === 'oui' || q === 'true' || q === '1' || !risque?.code_indicateur

        let probaFinal = null
        let responsableSnap = null
        let dateSaisieSnap = null
        let joursRetardSnap = null
        let niveauRetardSnap = null

        if (isQualitatif) {
          const manual = probaManuelleByRisque.get(risque.code_risque)
          const v = manual?.probabilite
          if (v !== null && v !== undefined && `${v}` !== '') probaFinal = Number(v)

          // Conserver les champs déjà saisis manuellement (si disponibles)
          responsableSnap = manual?.responsable ?? null
          dateSaisieSnap = manual?.date_saisie ?? manual?.date_modification ?? null
          joursRetardSnap = manual?.jours_retard ?? null
          niveauRetardSnap = manual?.niveau_retard ?? null
        } else {
          const occ = (occurrencesFiltrees || []).find((o) => `${o?.code_indicateur}` === `${risque.code_indicateur}`) || null
          const indic = indicateurByCode.get(`${risque.code_indicateur}`) || null
          probaFinal = calcProbabilite(occ?.val_indicateur ?? null, indic, indic?.sens)

          // Fallback (robustesse): si le calcul est impossible (seuils manquants, etc.),
          // utiliser la probabilité déjà présente dans risques_probabilites pour ce risque/période.
          if (probaFinal === null || probaFinal === undefined || Number.isNaN(Number(probaFinal))) {
            const existing = probaManuelleByRisque.get(risque.code_risque)
            const v = existing?.probabilite
            if (v !== null && v !== undefined && `${v}` !== '') probaFinal = Number(v)
          }

          // Snapshot "Analyse" pour quantitatif: responsable = responsable indicateur, date_saisie = date_saisie occurrence (fallback: now)
          responsableSnap = indic?.responsable ?? null
          dateSaisieSnap = occ?.date_saisie ?? nowIso
          joursRetardSnap = calcJoursRetard(dateLimitePeriode, dateSaisieSnap)
          niveauRetardSnap = calcNiveauRetard(joursRetardSnap)
        }

        if (probaFinal === null || probaFinal === undefined || Number.isNaN(Number(probaFinal))) continue

        finalRows.push({
          code_risque: risque.code_risque,
          periode: periodeKey,
          probabilite: Number(probaFinal),
          impact: risque.impact || null,                      // Ajout de Impact
          eff_ctrl: risque.efficacite_contr || null,          // Ajout de Eff_ctrl
          ind_obtenu: isQualitatif ? 'Non' : 'Oui',
          responsable: responsableSnap,
          date_limite_saisie: dateLimitePeriode,
          date_saisie: dateSaisieSnap,
          jours_retard: joursRetardSnap,
          niveau_retard: niveauRetardSnap,
          modificateur: modificateur || null,
          date_modification: nowIso,
          archive: 'Oui',
          date_archivage: nowIso,
          archive_par: modificateur || null,
          date_debut_periode: periode.date_debut ?? null,
          date_fin_periode: periode.date_fin ?? null,
        })
      }

      if (finalRows.length > 0) {
        const { error: upErr } = await supabase
          .from('risques_probabilites')
          .upsert(finalRows, { onConflict: 'code_risque,periode' })

        if (upErr) {
          console.error('Erreur alimentation risques_probabilites (fermeture):', upErr)
          return NextResponse.json({ error: 'Erreur alimentation risques_probabilites: ' + upErr.message }, { status: 500 })
        }
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

      // 6. Calculer les totaux affichés dans le message de succès (exigence utilisateur)
      // - risques archivés = nombre TOTAL de risques évalués pour la période (qualitatifs ou quantitatifs)
      //   Ici, la fermeture n'est possible que si tous les risques actifs sont évalués, donc = nb risques actifs.
      // - indicateurs archivés = nombre TOTAL d'indicateurs du groupe "Risques" qui ont été renseignés ET archivés
      //   (qu'ils soient liés à un risque ou non). On compte les code_indicateur DISTINCTS.
      let archivedRisquesCount = (risques || []).length
      let archivedIndicateursCount = 0

      try {
        if (riskGroupIndCodes.length > 0) {
          const { data: occRows, error: occErr } = await supabase
            .from('indicateur_occurrences')
            .select('code_indicateur,val_indicateur')
            .eq('periode', periodeKey)
            .eq('archive', true)
            .in('code_indicateur', riskGroupIndCodes)

          if (occErr) {
            console.warn('Warning comptage indicateurs archivés:', occErr)
          } else {
            const s = new Set()
            for (const r of (occRows || [])) {
              const v = r?.val_indicateur
              if (v === null || v === undefined || `${v}` === '') continue
              const c = r?.code_indicateur
              if (c === null || c === undefined || `${c}` === '') continue
              s.add(String(c))
            }
            archivedIndicateursCount = s.size
          }
        }
      } catch (e) {
        // Ne pas bloquer la fermeture pour un souci de comptage
        console.warn('Warning comptage archivage:', e)
      }
      
      return NextResponse.json({
        success: true,
        message: 'Période fermée avec succès',
        archived: {
          // Clés attendues par l'UI (voir /dashboard/risques/page.js)
          risques: archivedRisquesCount,
          indicateurs: archivedIndicateursCount,
          // Compat: ancienne clé utilisée par l'UI historique
          occurrences: archivedIndicateursCount,
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