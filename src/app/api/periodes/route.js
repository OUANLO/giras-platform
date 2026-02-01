import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Convertir nom du mois en numéro
const moisToNum = {
  'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
  'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
}

// Calculer les dates de début et fin selon la période
function calculerDates(annee, semestre, trimestre, mois) {
  const a = parseInt(annee)
  let date_debut, date_fin
  
  if (mois) {
    const m = typeof mois === 'string' ? moisToNum[mois] || parseInt(mois) : mois
    const lastDay = new Date(a, m, 0).getDate()
    date_debut = `${a}-${String(m).padStart(2, '0')}-01`
    date_fin = `${a}-${String(m).padStart(2, '0')}-${lastDay}`
  } else if (trimestre) {
    const t = parseInt(trimestre)
    const moisDebut = (t - 1) * 3 + 1
    const moisFin = t * 3
    const lastDay = new Date(a, moisFin, 0).getDate()
    date_debut = `${a}-${String(moisDebut).padStart(2, '0')}-01`
    date_fin = `${a}-${String(moisFin).padStart(2, '0')}-${lastDay}`
  } else if (semestre) {
    const s = parseInt(semestre)
    if (s === 1) {
      date_debut = `${a}-01-01`
      date_fin = `${a}-06-30`
    } else {
      date_debut = `${a}-07-01`
      date_fin = `${a}-12-31`
    }
  } else {
    date_debut = `${a}-01-01`
    date_fin = `${a}-12-31`
  }
  
  return { date_debut, date_fin }
}

// Générer le libellé de la période
function genererLibellePeriode(annee, semestre, trimestre, mois) {
  const moisNoms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  
  if (mois) {
    const m = typeof mois === 'string' ? moisToNum[mois] || parseInt(mois) : mois
    return `${moisNoms[m]}-${annee}`
  } else if (trimestre) {
    return `T${trimestre}-${annee}`
  } else if (semestre) {
    return `S${semestre}-${annee}`
  } else {
    return `${annee}`
  }
}

// Trouver automatiquement une "nouvelle" période disponible pour une année donnée
// lorsque la combinaison demandée existe déjà et est en statut Fermé.
// Contrainte DB: UNIQUE(annee, semestre, trimestre, mois)
function trouverProchainePeriodeDisponible(toutesLesPeriodes, annee) {
  const y = parseInt(annee)
  const set = new Set(
    (toutesLesPeriodes || [])
      .filter(p => parseInt(p.annee) === y)
      .map(p => `${p.semestre ?? 'null'}|${p.trimestre ?? 'null'}|${p.mois ?? 'null'}`)
  )

  // 1) Essayer Semestres (S1 puis S2)
  for (const s of [1, 2]) {
    const key = `${s}|null|null`
    if (!set.has(key)) return { semestre: s, trimestre: null, mois: null, mode: 'Semestre' }
  }

  // 2) Essayer Trimestres (T1..T4)
  for (const t of [1, 2, 3, 4]) {
    const key = `null|${t}|null`
    if (!set.has(key)) return { semestre: null, trimestre: t, mois: null, mode: 'Trimestre' }
  }

  // 3) Essayer Mois (1..12)
  for (let m = 1; m <= 12; m++) {
    const key = `null|null|${m}`
    if (!set.has(key)) return { semestre: null, trimestre: null, mois: m, mode: 'Mois' }
  }

  return null
}

// GET - Récupérer les périodes
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const annee = searchParams.get('annee')
    const statut = searchParams.get('statut')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('periodes_evaluation')
      .select('*')
      .order('annee', { ascending: false })

    if (annee) query = query.eq('annee', annee)
    if (statut) query = query.eq('statut', statut)

    const { data, error } = await query

    if (error) {
      console.error('Erreur requête periodes:', error)
      return NextResponse.json({ periodes: [], message: error.message })
    }

    return NextResponse.json({ periodes: data || [] })
  } catch (error) {
    console.error('Erreur GET periodes:', error)
    return NextResponse.json({ periodes: [], message: error.message })
  }
}

// POST - Ouvrir une nouvelle période
export async function POST(request) {
  console.log('=== POST /api/periodes START ===')
  
  try {
    const body = await request.json()
    console.log('Body reçu:', JSON.stringify(body))
    
    const supabase = createAdminClient()

    // Validations
    if (!body.annee) {
      return NextResponse.json({ error: 'Année obligatoire' }, { status: 400 })
    }
    
    if (!body.date_limite_saisie) {
      return NextResponse.json({ error: 'Date limite de saisie obligatoire' }, { status: 400 })
    }

    // Convertir semestre/trimestre/mois en valeurs numériques
    let semestreVal = null
    let trimestreVal = null
    let moisVal = null
    
    if (body.semestre && body.semestre !== '' && body.semestre !== '--') {
      semestreVal = body.semestre === 'S1' ? 1 : 2
    } else if (body.trimestre && body.trimestre !== '' && body.trimestre !== '--') {
      const trimStr = body.trimestre.toString()
      if (trimStr.startsWith('T')) {
        trimestreVal = parseInt(trimStr.replace('T', ''))
      } else if (trimStr.includes('Trimestre')) {
        trimestreVal = parseInt(trimStr.replace('Trimestre ', ''))
      } else {
        trimestreVal = parseInt(trimStr)
      }
    } else if (body.mois && body.mois !== '' && body.mois !== '--') {
      if (typeof body.mois === 'string' && isNaN(parseInt(body.mois))) {
        moisVal = moisToNum[body.mois] || null
      } else {
        moisVal = parseInt(body.mois)
      }
    }

    console.log('Valeurs converties:', { semestreVal, trimestreVal, moisVal })

    // Calculer les dates de la période
    let { date_debut, date_fin } = calculerDates(body.annee, semestreVal, trimestreVal, moisVal)
    let libelle_periode = genererLibellePeriode(body.annee, semestreVal, trimestreVal, moisVal)
    console.log('Dates calculées:', { date_debut, date_fin, libelle_periode })

    // Exigence métier:
    // On ne doit JAMAIS pouvoir ouvrir une période "non encore échue",
    // c.-à-d. quand la date du jour est strictement antérieure à la date de fin.
    // (On laisse passer uniquement si today >= date_fin)
    const todayStr = new Date().toISOString().slice(0, 10)
    if (date_fin && todayStr < date_fin) {
      return NextResponse.json({
        error: `Impossible d'ouvrir la période "${libelle_periode}" car elle n'est pas encore échue (fin prévue le ${date_fin}).`
      }, { status: 400 })
    }

    // Étape 1: Vérifier si une période est déjà ouverte
    console.log('Vérification période ouverte...')
    const { data: periodesOuvertes, error: errOuvertes } = await supabase
      .from('periodes_evaluation')
      .select('id, annee, semestre, trimestre, mois')
      .eq('statut', 'Ouvert')

    if (errOuvertes) {
      console.error('Erreur vérif périodes ouvertes:', errOuvertes)
    }
    
    const periodeOuverteExistante = periodesOuvertes && periodesOuvertes.length > 0 ? periodesOuvertes[0] : null
    console.log('Période ouverte existante:', periodeOuverteExistante)

    // Étape 2: Vérifier si la période demandée existe déjà
    console.log('Vérification période existante...')
    const { data: toutesLesPeriodes, error: errToutes } = await supabase
      .from('periodes_evaluation')
      .select('id, statut, annee, semestre, trimestre, mois')
      .eq('annee', parseInt(body.annee))

    if (errToutes) {
      console.error('Erreur récup périodes:', errToutes)
    }

    // Filtrer pour trouver la période correspondante
    let existing = null
    if (toutesLesPeriodes) {
      existing = toutesLesPeriodes.find(p => {
        if (semestreVal !== null) {
          return p.semestre === semestreVal && p.trimestre === null && p.mois === null
        } else if (trimestreVal !== null) {
          return p.trimestre === trimestreVal && p.semestre === null && p.mois === null
        } else if (moisVal !== null) {
          return p.mois === moisVal && p.semestre === null && p.trimestre === null
        } else {
          return p.semestre === null && p.trimestre === null && p.mois === null
        }
      })
    }
    console.log('Période existante trouvée:', existing)

    let periode = null
    let reopened = false

    // Cas 1: La période demandée existe et est fermée -> impossible de la réouvrir.
    // Exigence métier: une période fermée ne doit plus jamais pouvoir être réouverte.
    if (existing && (existing.statut === 'Fermé' || existing.statut === 'Fermée')) {
      // Afficher un libellé lisible plutôt qu'un UUID.
      const libelleExistante = genererLibellePeriode(
        existing.annee,
        existing.semestre ?? null,
        existing.trimestre ?? null,
        existing.mois ?? null
      )

      return NextResponse.json({
        error: `La période "${libelleExistante}" est fermée et ne peut pas être réouverte. Veuillez créer une nouvelle période.`
      }, { status: 400 })
    }
    // Cas 2: La période demandée existe et est déjà ouverte
    else if (existing && existing.statut === 'Ouvert') {
      console.log('=== CAS 2: Période déjà ouverte ===')
      return NextResponse.json({ error: 'Cette période est déjà ouverte' }, { status: 400 })
    }
    // Cas 3: Nouvelle période
    else {
      console.log('=== CAS 3: Nouvelle période ===')
      
      // Vérifier qu'aucune période n'est ouverte
      if (periodeOuverteExistante) {
        return NextResponse.json({ 
          error: 'Une période est déjà ouverte. Veuillez la fermer avant d\'en ouvrir une nouvelle.' 
        }, { status: 400 })
      }

      // Créer la nouvelle période avec les dates
      const insertData = {
        annee: parseInt(body.annee),
        semestre: semestreVal,
        trimestre: trimestreVal,
        mois: moisVal,
        date_debut: date_debut,
        date_fin: date_fin,
        date_limite_saisie: body.date_limite_saisie,
        statut: 'Ouvert',
        createur: body.createur || null
      }
      
      console.log('Insert data:', insertData)

      const { data: newPeriode, error: insertError } = await supabase
        .from('periodes_evaluation')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('Erreur insertion:', insertError)
        return NextResponse.json({ error: 'Erreur création: ' + insertError.message }, { status: 500 })
      }
      
      periode = newPeriode
      console.log('Nouvelle période créée:', periode)
    }

    // Ajouter les dates calculées à l'objet période pour l'affichage
    periode = { ...periode, date_debut, date_fin }

    // Étape 3: Créer les occurrences pour les indicateurs Risque
    console.log('=== Création occurrences indicateurs Risque ===')
    let nbOccurrencesCreees = 0
    
    try {
      // Récupérer TOUS les indicateurs actifs
      const { data: allIndicateurs, error: indError } = await supabase
        .from('indicateurs')
        .select('code_indicateur, libelle_indicateur, seuil1, type_indicateur, groupes, code_groupe')
        .eq('statut', 'Actif')

      if (indError) {
        console.error('Erreur récup indicateurs:', indError)
      } else {
        console.log('Indicateurs actifs trouvés:', allIndicateurs?.length || 0)
        
        // Log chaque indicateur pour voir le format de groupes
        if (allIndicateurs) {
          allIndicateurs.forEach((ind, idx) => {
            console.log(`Indicateur ${idx}: code=${ind.code_indicateur}, code_groupe=${ind.code_groupe}, groupes=${JSON.stringify(ind.groupes)}, type_groupes=${typeof ind.groupes}`)
          })
        }
        
        // Filtrer les indicateurs du groupe Risque
        const indicateursRisque = (allIndicateurs || []).filter(ind => {
          // Méthode 1: groupes est un tableau JavaScript
          if (Array.isArray(ind.groupes)) {
            const hasRisque = ind.groupes.includes('Risque')
            console.log(`Indicateur ${ind.code_indicateur}: groupes est array, includes Risque = ${hasRisque}`)
            return hasRisque
          }
          // Méthode 2: groupes est une chaîne JSON
          if (typeof ind.groupes === 'string') {
            try {
              const parsed = JSON.parse(ind.groupes)
              if (Array.isArray(parsed)) {
                const hasRisque = parsed.includes('Risque')
                console.log(`Indicateur ${ind.code_indicateur}: groupes est JSON string -> array, includes Risque = ${hasRisque}`)
                return hasRisque
              }
            } catch {
              const hasRisque = ind.groupes === 'Risque'
              console.log(`Indicateur ${ind.code_indicateur}: groupes est string simple = "${ind.groupes}", equals Risque = ${hasRisque}`)
              return hasRisque
            }
          }
          // Méthode 3: Fallback sur code_groupe
          const hasRisque = ind.code_groupe === 'Risque'
          console.log(`Indicateur ${ind.code_indicateur}: fallback code_groupe = "${ind.code_groupe}", equals Risque = ${hasRisque}`)
          return hasRisque
        })

        console.log('Indicateurs Risque filtrés:', indicateursRisque.length)
        indicateursRisque.forEach(ind => {
          console.log(`-> ${ind.code_indicateur}: ${ind.libelle_indicateur}`)
        })
        
        for (const ind of indicateursRisque) {
          console.log(`Traitement indicateur ${ind.code_indicateur}...`)
          
          // Vérifier si occurrence existe
          const { data: existingOccs } = await supabase
            .from('indicateur_occurrences')
            .select('id')
            .eq('code_indicateur', ind.code_indicateur)
            .eq('date_debut', date_debut)
            .eq('date_fin', date_fin)

          if (existingOccs && existingOccs.length > 0) {
            console.log(`Occurrence existe déjà pour ${ind.code_indicateur}`)
            continue
          }

          // Créer l'occurrence
          const occData = {
            code_indicateur: ind.code_indicateur,
            periode: libelle_periode,
            annee: parseInt(body.annee),
            date_debut: date_debut,
            date_fin: date_fin,
            date_limite_saisie: body.date_limite_saisie,
            cible: ind.seuil1 || null,
            statut: 'Pas retard',
            nb_jr_retard: 0
          }
          
          console.log('Insertion occurrence:', occData)

          const { error: occError } = await supabase
            .from('indicateur_occurrences')
            .insert(occData)

          if (occError) {
            console.error(`Erreur occurrence ${ind.code_indicateur}:`, occError)
          } else {
            nbOccurrencesCreees++
            console.log(`Occurrence créée pour ${ind.code_indicateur}`)
          }
        }
      }
    } catch (occErr) {
      console.error('Erreur bloc occurrences:', occErr)
    }

    console.log('=== POST /api/periodes END ===')
    console.log('Occurrences créées:', nbOccurrencesCreees)

    const msg = reopened
      ? 'Période rouverte avec succès'
      : `Période ouverte avec succès. ${nbOccurrencesCreees} occurrence(s) créée(s).`

    return NextResponse.json({ 
      periode,
      message: msg,
      reopened,
      nbOccurrencesCreees
    })
    
  } catch (error) {
    console.error('=== ERREUR GLOBALE POST /api/periodes ===', error)
    return NextResponse.json({ 
      error: 'Erreur serveur: ' + (error?.message || String(error)) 
    }, { status: 500 })
  }
}

// PUT - Fermer/Modifier une période
export async function PUT(request) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('periodes_evaluation')
      .update({ statut: body.statut })
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Erreur PUT periode:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ periode: data })
  } catch (error) {
    console.error('Erreur PUT periode:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
